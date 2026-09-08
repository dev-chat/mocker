import Axios from 'axios';
import OpenAI from 'openai';
import type {
  ResponseOutputItem,
  ResponseOutputMessage,
  ResponseOutputText,
} from 'openai/resources/responses/responses';
import { getRepository } from 'typeorm';
import { GPT_MODEL } from '../ai/ai.constants';
import { ResilientOpenAIClient } from '../lib/resilientOpenAIClient';
import type { OpenAIClientLike } from '../lib/resilientOpenAIClient';
import { SlackUser } from '../shared/db/models/SlackUser';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';
import type {
  AITradeAnalysis,
  FantasyLandingResponse,
  FantasyOverview,
  FantasyPlayer,
  FantasyTeam,
  GameToWatch,
  PendingWaiver,
  PendingTrade,
  SleeperLeague,
  SleeperLeagueUser,
  SleeperPlayer,
  SleeperRoster,
  SleeperTransaction,
  SleeperUser,
  TeamHealth,
  TradeSide,
  TradeSuggestion,
  WaiverSuggestion,
} from './fantasy.model';

const SLEEPER_API_URL = 'https://api.sleeper.app/v1';
const ESPN_SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
const PLAYER_CACHE_MS = 24 * 60 * 60 * 1000;
const SLEEPER_ID_PATTERN = /^\d{1,32}$/;

interface NflState {
  season: string;
  week: number;
  season_type: 'pre' | 'regular' | 'post';
}

interface EspnTeam {
  abbreviation?: string;
  displayName?: string;
}

interface EspnCompetitor {
  homeAway?: 'home' | 'away';
  team?: EspnTeam;
}

interface EspnEvent {
  id?: string;
  date?: string;
  status?: { type?: { shortDetail?: string } };
  competitions?: Array<{
    competitors?: EspnCompetitor[];
    broadcasts?: Array<{ names?: string[] }>;
  }>;
}

interface EspnScoreboard {
  events?: EspnEvent[];
}

const isOutputMessage = (item: ResponseOutputItem): item is ResponseOutputMessage => item.type === 'message';
const isOutputText = (item: ResponseOutputMessage['content'][number]): item is ResponseOutputText =>
  item.type === 'output_text';

function playerName(player: SleeperPlayer | undefined, id: string): string {
  const name = [player?.first_name, player?.last_name].filter(Boolean).join(' ').trim();
  return name || id;
}

function isRecommendation(value: unknown): value is 'accept' | 'decline' | 'negotiate' {
  return value === 'accept' || value === 'decline' || value === 'negotiate';
}

function isPriority(value: unknown): value is 'high' | 'medium' | 'low' {
  return value === 'high' || value === 'medium' || value === 'low';
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
}

export class FantasyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FantasyValidationError';
  }
}

export class FantasyService {
  private playerCache: { expiresAt: number; players: Record<string, SleeperPlayer | undefined> } | null = null;
  private playerRequest: Promise<Record<string, SleeperPlayer | undefined>> | null = null;
  private readonly openAi: OpenAIClientLike;
  private readonly serviceLogger = logger.child({ module: 'FantasyService' });

  constructor(openAi?: OpenAIClientLike) {
    this.openAi =
      openAi ??
      new ResilientOpenAIClient(
        new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        }),
      );
  }

  public async getLanding(slackId: string, teamId: string): Promise<FantasyLandingResponse> {
    const dbUser = await getRepository(SlackUser).findOne({ where: { slackId, teamId } });
    if (!dbUser) {
      throw new Error('Authenticated user was not found.');
    }

    const state = await this.getNflState();
    if (!dbUser.sleeperUserId) {
      return { sleeperUser: null, leagues: [], season: state.season };
    }

    const [sleeperUser, leagues] = await Promise.all([
      this.getSleeperUser(dbUser.sleeperUserId),
      this.getLeagues(dbUser.sleeperUserId, state.season),
    ]);
    return { sleeperUser, leagues, season: state.season };
  }

  public async getOverview(slackId: string, teamId: string, leagueId: string): Promise<FantasyOverview | null> {
    if (!SLEEPER_ID_PATTERN.test(leagueId)) {
      throw new FantasyValidationError('Invalid league ID.');
    }

    const dbUser = await getRepository(SlackUser).findOne({ where: { slackId, teamId } });
    if (!dbUser?.sleeperUserId) {
      return null;
    }

    const state = await this.getNflState();
    const leagues = await this.getLeagues(dbUser.sleeperUserId, state.season);
    const league = leagues.find((item) => item.league_id === leagueId);
    if (!league) {
      return null;
    }

    const transactionRounds = state.week > 1 ? [state.week, state.week - 1] : [Math.max(state.week, 1)];
    const [rosters, users, transactionGroups, players, scoreboard] = await Promise.all([
      this.get<SleeperRoster[]>(`/league/${leagueId}/rosters`),
      this.get<SleeperLeagueUser[]>(`/league/${leagueId}/users`),
      Promise.all(
        transactionRounds.map((round) => this.get<SleeperTransaction[]>(`/league/${leagueId}/transactions/${round}`)),
      ),
      this.getPlayers(),
      Axios.get<EspnScoreboard>(ESPN_SCOREBOARD_URL, {
        params: {
          dates: state.season,
          seasontype: state.season_type === 'pre' ? 1 : state.season_type === 'post' ? 3 : 2,
          week: Math.max(state.week, 1),
        },
        timeout: 10000,
      }).then((response) => response.data),
    ]);
    const transactions = Array.from(
      new Map(transactionGroups.flat().map((transaction) => [transaction.transaction_id, transaction])).values(),
    );

    const ownerNames = this.buildOwnerNames(rosters, users);
    const ownRoster = rosters.find((roster) => roster.owner_id === dbUser.sleeperUserId);
    if (!ownRoster) {
      return null;
    }

    const teams = rosters.map((roster) => this.toFantasyTeam(roster, ownerNames, players));
    const roster = teams.find((team) => team.rosterId === ownRoster.roster_id);
    if (!roster) {
      return null;
    }

    const pendingTransactions = transactions.filter(
      (transaction) => transaction.type === 'trade' && transaction.status === 'pending',
    );
    const pendingWaiverTransactions = transactions.filter(
      (transaction) =>
        transaction.type === 'waiver' &&
        transaction.status === 'pending' &&
        transaction.roster_ids.includes(roster.rosterId),
    );
    const rosteredPlayerIds = new Set(rosters.flatMap((item) => item.players ?? []));
    const waiverCandidates = Object.entries(players)
      .filter(
        ([id, player]) =>
          !rosteredPlayerIds.has(id) &&
          !!player?.team &&
          ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(player.position ?? ''),
      )
      .sort(
        ([, left], [, right]) =>
          (left?.search_rank ?? Number.MAX_SAFE_INTEGER) - (right?.search_rank ?? Number.MAX_SAFE_INTEGER),
      )
      .slice(0, 120)
      .map(([id]) => this.toPlayer(id, players));
    const waiverBudget = Math.max(0, league.settings?.waiver_budget ?? 100);
    const waiverBudgetUsed = Math.max(0, ownRoster.settings?.waiver_budget_used ?? 0);
    const remainingWaiverBudget = Math.max(0, waiverBudget - waiverBudgetUsed);
    let analysis: AITradeAnalysis;
    let aiStatus: FantasyOverview['aiStatus'] = 'ready';
    try {
      analysis = await this.generateTradeAnalysis(
        league,
        roster,
        teams,
        pendingTransactions,
        waiverCandidates,
        remainingWaiverBudget,
      );
    } catch (error) {
      logError(this.serviceLogger, 'Failed to generate fantasy trade analysis', error, {
        leagueId,
        rosterId: roster.rosterId,
      });
      analysis = {
        teamHealth: { percentage: 0, summary: '' },
        tradeInsights: [],
        suggestions: [],
        waiverSuggestions: [],
      };
      aiStatus = 'unavailable';
    }
    const pendingTrades = this.buildPendingTrades(pendingTransactions, ownerNames, players, analysis);
    const pendingWaivers = this.buildPendingWaivers(pendingWaiverTransactions, roster.rosterId, players);
    const tradeSuggestions = this.buildTradeSuggestions(analysis, roster, teams, leagueId);
    const waiverSuggestions = this.buildWaiverSuggestions(analysis, roster, waiverCandidates, leagueId);

    return {
      league,
      roster,
      pendingTrades,
      pendingWaivers,
      gamesToWatch: this.buildGames(scoreboard, roster.players),
      tradeSuggestions,
      waiverSuggestions,
      teamHealth: aiStatus === 'ready' ? this.buildTeamHealth(analysis) : null,
      aiStatus,
      sleeperUrl: `https://sleeper.com/leagues/${leagueId}`,
    };
  }

  private async get<T>(path: string): Promise<T> {
    return Axios.get<T>(`${SLEEPER_API_URL}${path}`, { timeout: 10000 }).then((response) => response.data);
  }

  private getNflState(): Promise<NflState> {
    return this.get<NflState>('/state/nfl');
  }

  private getSleeperUser(usernameOrId: string): Promise<SleeperUser> {
    return this.get<SleeperUser | null>(`/user/${encodeURIComponent(usernameOrId)}`).then((user) => {
      if (!user || !user.user_id) {
        throw new FantasyValidationError('Sleeper user was not found.');
      }
      return user;
    });
  }

  private getLeagues(userId: string, season: string): Promise<SleeperLeague[]> {
    return this.get<SleeperLeague[]>(`/user/${encodeURIComponent(userId)}/leagues/nfl/${encodeURIComponent(season)}`);
  }

  private async getPlayers(): Promise<Record<string, SleeperPlayer | undefined>> {
    if (this.playerCache && this.playerCache.expiresAt > Date.now()) {
      return this.playerCache.players;
    }
    if (this.playerRequest) {
      return this.playerRequest;
    }
    this.playerRequest = this.get<Record<string, SleeperPlayer | undefined>>('/players/nfl?active=true')
      .then((players) => {
        this.playerCache = { expiresAt: Date.now() + PLAYER_CACHE_MS, players };
        return players;
      })
      .finally(() => {
        this.playerRequest = null;
      });
    return this.playerRequest;
  }

  private buildOwnerNames(rosters: SleeperRoster[], users: SleeperLeagueUser[]): Map<number, string> {
    const usersById = new Map(users.map((user) => [user.user_id, user]));
    return new Map(
      rosters.map((roster) => {
        const user = roster.owner_id ? usersById.get(roster.owner_id) : undefined;
        return [
          roster.roster_id,
          user?.metadata?.team_name?.trim() || user?.display_name || user?.username || `Roster ${roster.roster_id}`,
        ];
      }),
    );
  }

  private toPlayer(id: string, players: Record<string, SleeperPlayer | undefined>): FantasyPlayer {
    const player = players[id];
    return {
      id,
      name: playerName(player, id),
      position: player?.position ?? null,
      team: player?.team ?? null,
      injuryStatus: player?.injury_status ?? null,
    };
  }

  private toFantasyTeam(
    roster: SleeperRoster,
    ownerNames: Map<number, string>,
    players: Record<string, SleeperPlayer | undefined>,
  ): FantasyTeam {
    return {
      rosterId: roster.roster_id,
      ownerName: ownerNames.get(roster.roster_id) ?? `Roster ${roster.roster_id}`,
      players: (roster.players ?? []).map((id) => this.toPlayer(id, players)),
      starters: roster.starters ?? [],
    };
  }

  private buildTradeSides(
    transaction: SleeperTransaction,
    ownerNames: Map<number, string>,
    players: Record<string, SleeperPlayer | undefined>,
  ): TradeSide[] {
    return transaction.roster_ids.map((rosterId) => ({
      rosterId,
      ownerName: ownerNames.get(rosterId) ?? `Roster ${rosterId}`,
      players: Object.entries(transaction.adds ?? {})
        .filter(([, destinationRosterId]) => destinationRosterId === rosterId)
        .map(([playerId]) => this.toPlayer(playerId, players)),
      draftPicks: (transaction.draft_picks ?? [])
        .filter((pick) => pick.owner_id === rosterId)
        .map((pick) => `${pick.season} round ${pick.round}`),
    }));
  }

  private buildPendingTrades(
    transactions: SleeperTransaction[],
    ownerNames: Map<number, string>,
    players: Record<string, SleeperPlayer | undefined>,
    analysis: AITradeAnalysis,
  ): PendingTrade[] {
    return transactions.map((transaction) => {
      const insight = analysis.tradeInsights.find((item) => item.transactionId === transaction.transaction_id);
      return {
        transactionId: transaction.transaction_id,
        createdAt: new Date(transaction.created).toISOString(),
        sides: this.buildTradeSides(transaction, ownerNames, players),
        insight: insight?.insight ?? 'AI insight is temporarily unavailable for this trade.',
        recommendation: insight?.recommendation ?? 'negotiate',
      };
    });
  }

  private buildPendingWaivers(
    transactions: SleeperTransaction[],
    rosterId: number,
    players: Record<string, SleeperPlayer | undefined>,
  ): PendingWaiver[] {
    return transactions.map((transaction) => {
      const addPlayerId = Object.entries(transaction.adds ?? {}).find(
        ([, destination]) => destination === rosterId,
      )?.[0];
      const dropPlayerId = Object.entries(transaction.drops ?? {}).find(([, source]) => source === rosterId)?.[0];
      return {
        transactionId: transaction.transaction_id,
        createdAt: new Date(transaction.created).toISOString(),
        add: addPlayerId ? this.toPlayer(addPlayerId, players) : null,
        drop: dropPlayerId ? this.toPlayer(dropPlayerId, players) : null,
        bid: Number.isFinite(transaction.settings?.waiver_bid) ? (transaction.settings?.waiver_bid ?? null) : null,
      };
    });
  }

  private buildTradeSuggestions(
    analysis: AITradeAnalysis,
    ownRoster: FantasyTeam,
    teams: FantasyTeam[],
    leagueId: string,
  ): TradeSuggestion[] {
    const teamsById = new Map(teams.map((team) => [team.rosterId, team]));
    const ownPlayers = new Map(ownRoster.players.map((player) => [player.id, player]));

    return analysis.suggestions.flatMap((suggestion) => {
      const target = teamsById.get(suggestion.targetRosterId);
      if (!target || target.rosterId === ownRoster.rosterId) {
        this.serviceLogger.warn('Ignoring AI suggestion with an invalid trade partner', {
          targetRosterId: suggestion.targetRosterId,
        });
        return [];
      }
      const targetPlayers = new Map(target.players.map((player) => [player.id, player]));
      const give = suggestion.givePlayerIds
        .map((id) => ownPlayers.get(id))
        .filter((item): item is FantasyPlayer => !!item);
      const receive = suggestion.receivePlayerIds
        .map((id) => targetPlayers.get(id))
        .filter((item): item is FantasyPlayer => !!item);
      if (!give.length || !receive.length) {
        this.serviceLogger.warn('Ignoring AI suggestion with players outside the proposed rosters', {
          targetRosterId: suggestion.targetRosterId,
        });
        return [];
      }
      return [
        {
          targetRosterId: target.rosterId,
          targetOwnerName: target.ownerName,
          give,
          receive,
          rationale: suggestion.rationale,
          sleeperUrl: `https://sleeper.com/leagues/${leagueId}`,
        },
      ];
    });
  }

  private buildWaiverSuggestions(
    analysis: AITradeAnalysis,
    ownRoster: FantasyTeam,
    waiverCandidates: FantasyPlayer[],
    leagueId: string,
  ): WaiverSuggestion[] {
    const rosterPlayers = new Map(ownRoster.players.map((player) => [player.id, player]));
    const availablePlayers = new Map(waiverCandidates.map((player) => [player.id, player]));

    return analysis.waiverSuggestions.flatMap((suggestion) => {
      const add = availablePlayers.get(suggestion.addPlayerId);
      const drop = rosterPlayers.get(suggestion.dropPlayerId);
      if (!add || !drop) {
        this.serviceLogger.warn('Ignoring AI waiver suggestion with unavailable players', {
          addPlayerId: suggestion.addPlayerId,
          dropPlayerId: suggestion.dropPlayerId,
        });
        return [];
      }
      return [
        {
          add,
          drop,
          rationale: suggestion.rationale,
          priority: suggestion.priority,
          recommendedBid: suggestion.recommendedBid,
          sleeperUrl: `https://sleeper.com/leagues/${leagueId}`,
        },
      ];
    });
  }

  private buildTeamHealth(analysis: AITradeAnalysis): TeamHealth {
    const { percentage, summary } = analysis.teamHealth;
    return {
      percentage,
      rating: percentage >= 75 ? 'good' : percentage >= 50 ? 'ok' : 'bad',
      summary,
    };
  }

  private buildGames(scoreboard: EspnScoreboard, players: FantasyPlayer[]): GameToWatch[] {
    const playersByTeam = new Map<string, FantasyPlayer[]>();
    for (const player of players) {
      if (player.team) {
        const team = this.normalizeTeam(player.team);
        playersByTeam.set(team, [...(playersByTeam.get(team) ?? []), player]);
      }
    }

    return (scoreboard.events ?? []).flatMap((event) => {
      const competition = event.competitions?.[0];
      const away = competition?.competitors?.find((team) => team.homeAway === 'away')?.team;
      const home = competition?.competitors?.find((team) => team.homeAway === 'home')?.team;
      if (!event.id || !event.date || !away?.abbreviation || !home?.abbreviation) {
        return [];
      }
      const rosterPlayers = [
        ...(playersByTeam.get(this.normalizeTeam(away.abbreviation)) ?? []),
        ...(playersByTeam.get(this.normalizeTeam(home.abbreviation)) ?? []),
      ];
      if (!rosterPlayers.length) {
        return [];
      }
      return [
        {
          id: event.id,
          startsAt: event.date,
          status: event.status?.type?.shortDetail ?? 'Scheduled',
          broadcast: competition?.broadcasts?.[0]?.names?.[0] ?? null,
          awayTeam: away.displayName ?? away.abbreviation,
          homeTeam: home.displayName ?? home.abbreviation,
          rosterPlayers,
        },
      ];
    });
  }

  private normalizeTeam(team: string): string {
    const aliases: Record<string, string | undefined> = { WAS: 'WSH', JAC: 'JAX' };
    return aliases[team] ?? team;
  }

  private async generateTradeAnalysis(
    league: SleeperLeague,
    ownRoster: FantasyTeam,
    teams: FantasyTeam[],
    pendingTransactions: SleeperTransaction[],
    waiverCandidates: FantasyPlayer[],
    remainingWaiverBudget: number,
  ): Promise<AITradeAnalysis> {
    const compactTeams = teams.map((team) => ({
      rosterId: team.rosterId,
      ownerName: team.ownerName,
      players: team.players.map(({ id, name, position, team: nflTeam, injuryStatus }) => ({
        id,
        name,
        position,
        team: nflTeam,
        injuryStatus,
      })),
    }));
    const response = await this.openAi.responses.create({
      model: GPT_MODEL,
      reasoning: { effort: 'low' },
      instructions:
        'You are a fantasy football analyst. Return only valid JSON with keys teamHealth, tradeInsights, suggestions, and waiverSuggestions. ' +
        'teamHealth must assess the user roster relative to the supplied league with an integer percentage from 0 to 100 and a concise summary. ' +
        'tradeInsights must include exactly one item per pending transaction with transactionId, a concise insight, ' +
        'and recommendation of accept, decline, or negotiate. suggestions must contain up to 3 realistic options ' +
        'with targetRosterId, givePlayerIds, receivePlayerIds, and rationale. waiverSuggestions must contain up to 3 ' +
        'add/drop proposals using only the supplied waiver candidate and user roster IDs, with rationale and a high, ' +
        'medium, or low priority, plus an integer recommendedBid in dollars that does not exceed remainingWaiverBudget. ' +
        'Waivers process Wednesday and Sunday. Use only supplied IDs and rosters.',
      input: JSON.stringify({
        league: { name: league.name, season: league.season },
        userRosterId: ownRoster.rosterId,
        teams: compactTeams,
        pendingTransactions,
        waiverCandidates,
        remainingWaiverBudget,
      }),
      text: {
        format: {
          type: 'json_schema',
          name: 'fantasy_trade_analysis',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['teamHealth', 'tradeInsights', 'suggestions', 'waiverSuggestions'],
            properties: {
              teamHealth: {
                type: 'object',
                additionalProperties: false,
                required: ['percentage', 'summary'],
                properties: {
                  percentage: { type: 'integer', minimum: 0, maximum: 100 },
                  summary: { type: 'string' },
                },
              },
              tradeInsights: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['transactionId', 'insight', 'recommendation'],
                  properties: {
                    transactionId: { type: 'string' },
                    insight: { type: 'string' },
                    recommendation: { type: 'string', enum: ['accept', 'decline', 'negotiate'] },
                  },
                },
              },
              suggestions: {
                type: 'array',
                maxItems: 3,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['targetRosterId', 'givePlayerIds', 'receivePlayerIds', 'rationale'],
                  properties: {
                    targetRosterId: { type: 'number' },
                    givePlayerIds: { type: 'array', minItems: 1, items: { type: 'string' } },
                    receivePlayerIds: { type: 'array', minItems: 1, items: { type: 'string' } },
                    rationale: { type: 'string' },
                  },
                },
              },
              waiverSuggestions: {
                type: 'array',
                maxItems: 3,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['addPlayerId', 'dropPlayerId', 'rationale', 'priority', 'recommendedBid'],
                  properties: {
                    addPlayerId: { type: 'string' },
                    dropPlayerId: { type: 'string' },
                    rationale: { type: 'string' },
                    priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                    recommendedBid: { type: 'integer', minimum: 0, maximum: remainingWaiverBudget },
                  },
                },
              },
            },
          },
        },
      },
      user: `fantasy-${ownRoster.rosterId}`,
    });
    const message = response.output.find(isOutputMessage);
    const text = message?.content.find(isOutputText)?.text;
    if (!text) {
      throw new Error('AI did not return trade analysis.');
    }

    const parsed: unknown = JSON.parse(text);
    return this.validateAnalysis(parsed, pendingTransactions, remainingWaiverBudget);
  }

  private validateAnalysis(
    value: unknown,
    pendingTransactions: SleeperTransaction[],
    remainingWaiverBudget: number,
  ): AITradeAnalysis {
    if (!value || typeof value !== 'object') {
      throw new Error('AI returned invalid trade analysis.');
    }
    const teamHealth = Reflect.get(value, 'teamHealth');
    const tradeInsights = Reflect.get(value, 'tradeInsights');
    const suggestions = Reflect.get(value, 'suggestions');
    const waiverSuggestions = Reflect.get(value, 'waiverSuggestions');
    if (
      !teamHealth ||
      typeof teamHealth !== 'object' ||
      !Array.isArray(tradeInsights) ||
      !Array.isArray(suggestions) ||
      !Array.isArray(waiverSuggestions)
    ) {
      throw new Error('AI returned invalid trade analysis.');
    }
    const healthPercentage = Reflect.get(teamHealth, 'percentage');
    const healthSummary = Reflect.get(teamHealth, 'summary');
    if (!isIntegerInRange(healthPercentage, 0, 100) || typeof healthSummary !== 'string' || !healthSummary.trim()) {
      throw new Error('AI returned invalid team health.');
    }

    const validTransactionIds = new Set(pendingTransactions.map((trade) => trade.transaction_id));
    const validatedInsights = tradeInsights.map((item: unknown) => {
      if (!item || typeof item !== 'object') throw new Error('AI returned an invalid trade insight.');
      const transactionId = Reflect.get(item, 'transactionId');
      const insight = Reflect.get(item, 'insight');
      const recommendation = Reflect.get(item, 'recommendation');
      if (
        typeof transactionId !== 'string' ||
        !validTransactionIds.has(transactionId) ||
        typeof insight !== 'string' ||
        !insight.trim() ||
        !isRecommendation(recommendation)
      ) {
        throw new Error('AI returned an invalid trade insight.');
      }
      return { transactionId, insight: insight.trim(), recommendation };
    });

    const insightTransactionIds = new Set(validatedInsights.map((item) => item.transactionId));
    if (
      validatedInsights.length !== insightTransactionIds.size ||
      insightTransactionIds.size !== validTransactionIds.size
    ) {
      throw new Error('AI returned incomplete trade insights.');
    }
    const validatedSuggestions = suggestions.slice(0, 3).map((item: unknown) => {
      if (!item || typeof item !== 'object') throw new Error('AI returned an invalid trade suggestion.');
      const targetRosterId = Reflect.get(item, 'targetRosterId');
      const givePlayerIds = Reflect.get(item, 'givePlayerIds');
      const receivePlayerIds = Reflect.get(item, 'receivePlayerIds');
      const rationale = Reflect.get(item, 'rationale');
      if (
        typeof targetRosterId !== 'number' ||
        !Array.isArray(givePlayerIds) ||
        !givePlayerIds.every((id) => typeof id === 'string') ||
        !Array.isArray(receivePlayerIds) ||
        !receivePlayerIds.every((id) => typeof id === 'string') ||
        typeof rationale !== 'string' ||
        !rationale.trim()
      ) {
        throw new Error('AI returned an invalid trade suggestion.');
      }
      return { targetRosterId, givePlayerIds, receivePlayerIds, rationale: rationale.trim() };
    });

    const validatedWaiverSuggestions = waiverSuggestions.slice(0, 3).map((item: unknown) => {
      if (!item || typeof item !== 'object') throw new Error('AI returned an invalid waiver suggestion.');
      const addPlayerId = Reflect.get(item, 'addPlayerId');
      const dropPlayerId = Reflect.get(item, 'dropPlayerId');
      const rationale = Reflect.get(item, 'rationale');
      const priority = Reflect.get(item, 'priority');
      const recommendedBid = Reflect.get(item, 'recommendedBid');
      if (
        typeof addPlayerId !== 'string' ||
        typeof dropPlayerId !== 'string' ||
        typeof rationale !== 'string' ||
        !rationale.trim() ||
        !isPriority(priority) ||
        !isIntegerInRange(recommendedBid, 0, remainingWaiverBudget)
      ) {
        throw new Error('AI returned an invalid waiver suggestion.');
      }
      return {
        addPlayerId,
        dropPlayerId,
        rationale: rationale.trim(),
        priority,
        recommendedBid,
      };
    });

    return {
      teamHealth: { percentage: healthPercentage, summary: healthSummary.trim() },
      tradeInsights: validatedInsights,
      suggestions: validatedSuggestions,
      waiverSuggestions: validatedWaiverSuggestions,
    };
  }
}
