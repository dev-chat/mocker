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
  LineupRecommendation,
  FantasyOverview,
  FantasyPlayer,
  FantasyTeam,
  GameToWatch,
  PendingWaiver,
  PendingTrade,
  SleeperLeague,
  SleeperLeagueUser,
  SleeperMatchup,
  SleeperPlayer,
  SleeperProjection,
  SleeperRoster,
  SleeperTransaction,
  SleeperUser,
  TeamHealth,
  TradeSide,
  TradeSuggestion,
  WaiverBidGuidance,
  WaiverSuggestion,
} from './fantasy.model';

const SLEEPER_API_URL = 'https://api.sleeper.app/v1';
const SLEEPER_PROJECTIONS_URL = 'https://api.sleeper.com/projections/nfl';
const ESPN_SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
const PLAYER_CACHE_MS = 24 * 60 * 60 * 1000;
const AI_ANALYSIS_CACHE_MS = 24 * 60 * 60 * 1000;
const WAIVER_MARKET_CACHE_MS = 6 * 60 * 60 * 1000;
const WAIVER_HISTORY_SEASONS = 3;
const NFL_REGULAR_SEASON_WEEKS = 18;
const SLEEPER_ID_PATTERN = /^\d{1,32}$/;
const OPTIONAL_ROSTER_SLOTS = new Set(['BN', 'IR', 'TAXI', 'FLEX', 'SUPER_FLEX', 'REC_FLEX', 'WRRB_FLEX', 'IDP_FLEX']);

interface NflState {
  season: string;
  week: number;
  season_type: 'pre' | 'regular' | 'post';
}

interface WaiverMarketSample {
  pricePerPoint: number;
  position: string | null;
  weight: number;
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

interface RosterNeed {
  position: string;
  rostered: number;
  recommended: number;
  deficit: number;
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
  private waiverMarketCache = new Map<string, { expiresAt: number; samples: WaiverMarketSample[] }>();
  private projectionCache = new Map<string, { expiresAt: number; projections: SleeperProjection[] }>();
  private analysisCache = new Map<string, { expiresAt: number; analysis: AITradeAnalysis }>();
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

  public async getOverview(
    slackId: string,
    teamId: string,
    leagueId: string,
    refresh = false,
  ): Promise<FantasyOverview | null> {
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

    const currentWeek = Math.max(state.week, 1);
    const transactionRounds = state.week > 1 ? [state.week, state.week - 1] : [currentWeek];
    const upcomingScoreboardsPromise = Promise.all(
      [currentWeek + 1, currentWeek + 2]
        .filter((week) => state.season_type === 'regular' && week <= NFL_REGULAR_SEASON_WEEKS)
        .map((week) =>
          Axios.get<EspnScoreboard>(ESPN_SCOREBOARD_URL, {
            params: { dates: state.season, seasontype: 2, week },
            timeout: 10000,
          })
            .then((response) => response.data)
            .catch((error) => {
              logError(this.serviceLogger, 'Failed to load an upcoming NFL scoreboard', error, {
                season: state.season,
                week,
              });
              return { events: [] };
            }),
        ),
    );
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
          week: currentWeek,
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
    const upcomingScoreboards = await upcomingScoreboardsPromise;

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
    let lineupRecommendation: LineupRecommendation | null = null;
    let currentProjections: SleeperProjection[] = [];
    let lineupStatus: FantasyOverview['lineupStatus'];
    try {
      const [matchups, projections] = await Promise.all([
        this.get<SleeperMatchup[]>(`/league/${leagueId}/matchups/${Math.max(state.week, 1)}`),
        this.getProjections(state, refresh),
      ]);
      currentProjections = projections;
      lineupRecommendation = this.buildLineupRecommendation(
        Math.max(state.week, 1),
        league,
        roster,
        teams,
        matchups,
        projections,
      );
      lineupStatus = lineupRecommendation ? 'ready' : 'no_matchup';
    } catch (error) {
      logError(this.serviceLogger, 'Failed to build weekly lineup recommendation', error, {
        leagueId,
        rosterId: roster.rosterId,
        week: state.week,
      });
      lineupStatus = 'unavailable';
    }
    let waiverBidGuidance: WaiverBidGuidance = { sampleSize: 0, suggestedBids: {} };
    try {
      waiverBidGuidance = await this.getWaiverBidGuidance(
        league,
        state,
        transactionRounds,
        transactionGroups,
        currentProjections,
        waiverCandidates,
        players,
        remainingWaiverBudget,
      );
    } catch (error) {
      logError(this.serviceLogger, 'Failed to build historical waiver bid guidance', error, { leagueId });
    }
    let analysis: AITradeAnalysis;
    let aiStatus: FantasyOverview['aiStatus'] = 'ready';
    try {
      analysis = await this.getTradeAnalysis(
        `${teamId}:${slackId}:${leagueId}:${roster.rosterId}:${state.season}:${state.week}`,
        refresh,
        () =>
          this.generateTradeAnalysis(
            league,
            roster,
            teams,
            pendingTransactions,
            waiverCandidates,
            remainingWaiverBudget,
            lineupRecommendation,
            waiverBidGuidance,
            currentWeek,
            [scoreboard, ...upcomingScoreboards],
          ),
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
        lineupSummary: '',
      };
      aiStatus = 'unavailable';
    }
    const pendingTrades = this.buildPendingTrades(pendingTransactions, ownerNames, players, analysis);
    const pendingWaivers = this.buildPendingWaivers(pendingWaiverTransactions, roster.rosterId, players);
    const tradeSuggestions = this.buildTradeSuggestions(analysis, roster, teams, leagueId);
    const waiverSuggestions = this.buildWaiverSuggestions(
      analysis,
      roster,
      waiverCandidates,
      leagueId,
      waiverBidGuidance,
    );

    return {
      league,
      roster,
      pendingTrades,
      pendingWaivers,
      gamesToWatch: this.buildGames(scoreboard, roster.players),
      tradeSuggestions,
      waiverSuggestions,
      lineupRecommendation: lineupRecommendation
        ? {
            ...lineupRecommendation,
            summary:
              aiStatus === 'ready' ? analysis.lineupSummary : this.buildLineupFallbackSummary(lineupRecommendation),
          }
        : null,
      lineupStatus,
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

  private getProjections(state: NflState, refresh: boolean): Promise<SleeperProjection[]> {
    const key = `current:${state.season}:${state.season_type}:${Math.max(state.week, 1)}`;
    const cached = this.projectionCache.get(key);
    if (!refresh && cached && cached.expiresAt > Date.now()) {
      return Promise.resolve(cached.projections);
    }
    return Axios.get<SleeperProjection[]>(
      `${SLEEPER_PROJECTIONS_URL}/${encodeURIComponent(state.season)}/${Math.max(state.week, 1)}`,
      {
        params: { season_type: state.season_type },
        timeout: 10000,
      },
    ).then((response) => {
      this.projectionCache.set(key, {
        expiresAt: Date.now() + AI_ANALYSIS_CACHE_MS,
        projections: response.data,
      });
      return response.data;
    });
  }

  private async getTradeAnalysis(
    key: string,
    refresh: boolean,
    generate: () => Promise<AITradeAnalysis>,
  ): Promise<AITradeAnalysis> {
    const cached = this.analysisCache.get(key);
    if (!refresh && cached && cached.expiresAt > Date.now()) {
      return cached.analysis;
    }

    const analysis = await generate();
    this.analysisCache.set(key, {
      expiresAt: Date.now() + AI_ANALYSIS_CACHE_MS,
      analysis,
    });
    return analysis;
  }

  private getSeasonProjections(season: string, week: number): Promise<SleeperProjection[]> {
    const key = `${season}:${week}`;
    const cached = this.projectionCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.projections);
    return Axios.get<SleeperProjection[]>(`${SLEEPER_PROJECTIONS_URL}/${encodeURIComponent(season)}/${week}`, {
      params: { season_type: 'regular' },
      timeout: 10000,
    }).then((response) => {
      this.projectionCache.set(key, {
        expiresAt: Date.now() + WAIVER_MARKET_CACHE_MS,
        projections: response.data,
      });
      return response.data;
    });
  }

  private async getWaiverBidGuidance(
    league: SleeperLeague,
    state: NflState,
    currentRounds: number[],
    currentTransactionGroups: SleeperTransaction[][],
    currentProjections: SleeperProjection[],
    candidates: FantasyPlayer[],
    players: Record<string, SleeperPlayer | undefined>,
    remainingBudget: number,
  ): Promise<WaiverBidGuidance> {
    const cacheKey = `${league.league_id}:${state.season}:${state.week}`;
    const cached = this.waiverMarketCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return this.buildWaiverBidGuidance(cached.samples, league, currentProjections, candidates, remainingBudget);
    }

    type SeasonTransactions = {
      league: SleeperLeague;
      age: number;
      rounds: Array<{ week: number; transactions: SleeperTransaction[] }>;
    };
    const suppliedCurrentRounds = new Map(
      currentRounds.map((week, index) => [week, currentTransactionGroups[index] ?? []]),
    );
    const allCurrentRounds = Array.from({ length: Math.max(state.week, 1) }, (_, index) => index + 1);
    const missingCurrentRounds = allCurrentRounds.filter((week) => !suppliedCurrentRounds.has(week));
    const missingCurrentResults = await Promise.allSettled(
      missingCurrentRounds.map((week) =>
        this.get<SleeperTransaction[]>(`/league/${league.league_id}/transactions/${week}`),
      ),
    );
    missingCurrentRounds.forEach((week, index) => {
      const result = missingCurrentResults[index];
      suppliedCurrentRounds.set(week, result.status === 'fulfilled' ? result.value : []);
    });
    const failedCurrentRounds = missingCurrentResults.filter((result) => result.status === 'rejected').length;
    if (failedCurrentRounds) {
      this.serviceLogger.warn('Some current Sleeper transaction rounds were unavailable for waiver pricing', {
        leagueId: league.league_id,
        failedRounds: failedCurrentRounds,
      });
    }
    const seasons: SeasonTransactions[] = [
      {
        league,
        age: 0,
        rounds: allCurrentRounds.map((week) => ({
          week,
          transactions: suppliedCurrentRounds.get(week) ?? [],
        })),
      },
    ];
    let previousLeagueId = league.previous_league_id;
    for (let age = 1; age < WAIVER_HISTORY_SEASONS && previousLeagueId; age += 1) {
      let historicalLeague: SleeperLeague;
      try {
        historicalLeague = await this.get<SleeperLeague>(`/league/${previousLeagueId}`);
      } catch (error) {
        logError(this.serviceLogger, 'Failed to load a previous Sleeper league for waiver pricing', error, {
          leagueId: previousLeagueId,
        });
        break;
      }
      const rounds = Array.from({ length: NFL_REGULAR_SEASON_WEEKS }, (_, index) => index + 1);
      const transactionResults = await Promise.allSettled(
        rounds.map((week) =>
          this.get<SleeperTransaction[]>(`/league/${historicalLeague.league_id}/transactions/${week}`),
        ),
      );
      const failedRounds = transactionResults.filter((result) => result.status === 'rejected').length;
      if (failedRounds) {
        this.serviceLogger.warn('Some historical Sleeper transaction rounds were unavailable', {
          leagueId: historicalLeague.league_id,
          failedRounds,
        });
      }
      seasons.push({
        league: historicalLeague,
        age,
        rounds: rounds.map((week, index) => ({
          week,
          transactions: transactionResults[index]?.status === 'fulfilled' ? transactionResults[index].value : [],
        })),
      });
      previousLeagueId = historicalLeague.previous_league_id;
    }

    const samples: WaiverMarketSample[] = [];
    for (const season of seasons) {
      const paidWaivers = season.rounds
        .map(({ week, transactions }) => ({
          week,
          transactions: transactions.filter(
            (transaction) =>
              transaction.type === 'waiver' &&
              transaction.status === 'complete' &&
              Number.isFinite(transaction.settings?.waiver_bid) &&
              (transaction.settings?.waiver_bid ?? 0) > 0 &&
              Object.keys(transaction.adds ?? {}).length > 0,
          ),
        }))
        .filter(({ transactions }) => transactions.length);
      const projectionsByWeek = new Map<number, SleeperProjection[]>();
      const projectionResults = await Promise.allSettled(
        paidWaivers.map(async ({ week }) => {
          if (season.age === 0 && season.league.season === state.season && week === Math.max(state.week, 1)) {
            return currentProjections;
          }
          return this.getSeasonProjections(season.league.season, week);
        }),
      );
      projectionResults.forEach((result, index) => {
        if (result.status === 'fulfilled') projectionsByWeek.set(paidWaivers[index]!.week, result.value);
      });
      const failedWeeks = projectionResults.filter((result) => result.status === 'rejected').length;
      if (failedWeeks) {
        this.serviceLogger.warn('Some historical Sleeper projections were unavailable for waiver pricing', {
          leagueId: season.league.league_id,
          failedWeeks,
        });
      }
      const seasonBudget = Math.max(1, season.league.settings?.waiver_budget ?? 100);
      for (const { week, transactions } of paidWaivers) {
        const projections = new Map(
          (projectionsByWeek.get(week) ?? []).map((projection) => [projection.player_id, projection]),
        );
        for (const transaction of transactions) {
          const bidShare = (transaction.settings?.waiver_bid ?? 0) / Object.keys(transaction.adds ?? {}).length;
          for (const playerId of Object.keys(transaction.adds ?? {})) {
            const points = this.projectedPoints(
              projections.get(playerId)?.stats,
              season.league.scoring_settings ?? league.scoring_settings,
            );
            if (points !== null && points > 0) {
              samples.push({
                pricePerPoint: bidShare / seasonBudget / points,
                position: players[playerId]?.position ?? null,
                weight: 1 / (season.age + 1),
              });
            }
          }
        }
      }
    }

    this.waiverMarketCache.set(cacheKey, {
      expiresAt: Date.now() + WAIVER_MARKET_CACHE_MS,
      samples,
    });
    return this.buildWaiverBidGuidance(samples, league, currentProjections, candidates, remainingBudget);
  }

  private buildWaiverBidGuidance(
    samples: WaiverMarketSample[],
    league: SleeperLeague,
    currentProjections: SleeperProjection[],
    candidates: FantasyPlayer[],
    remainingBudget: number,
  ): WaiverBidGuidance {
    const allRate = this.weightedMedian(samples);
    const suggestedBids =
      allRate === null
        ? {}
        : Object.fromEntries(
            candidates.flatMap((candidate) => {
              const projection = currentProjections.find((item) => item.player_id === candidate.id);
              const points = this.projectedPoints(projection?.stats, league.scoring_settings);
              if (points === null || points <= 0) return [];
              const positionSamples = samples.filter((sample) => sample.position === candidate.position);
              const rate = this.weightedMedian(positionSamples.length >= 5 ? positionSamples : samples) ?? allRate;
              const budget = Math.max(1, league.settings?.waiver_budget ?? 100);
              const marketBid = Math.max(1, Math.round(rate * points * budget));
              return [[candidate.id, Math.min(remainingBudget, marketBid)]];
            }),
          );
    return { sampleSize: samples.length, suggestedBids };
  }

  private weightedMedian(samples: Array<{ pricePerPoint: number; weight: number }>): number | null {
    if (!samples.length) return null;
    const ordered = [...samples].sort((left, right) => left.pricePerPoint - right.pricePerPoint);
    const midpoint = ordered.reduce((total, sample) => total + sample.weight, 0) / 2;
    let weight = 0;
    for (const sample of ordered) {
      weight += sample.weight;
      if (weight >= midpoint) return sample.pricePerPoint;
    }
    return ordered[ordered.length - 1]?.pricePerPoint ?? null;
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
      fantasyPositions: player?.fantasy_positions?.length
        ? player.fantasy_positions
        : player?.position
          ? [player.position]
          : [],
    };
  }

  private buildLineupRecommendation(
    week: number,
    league: SleeperLeague,
    ownRoster: FantasyTeam,
    teams: FantasyTeam[],
    matchups: SleeperMatchup[],
    projections: SleeperProjection[],
  ): LineupRecommendation | null {
    const ownMatchup = matchups.find((matchup) => matchup.roster_id === ownRoster.rosterId);
    if (!ownMatchup || ownMatchup.matchup_id === null) {
      return null;
    }
    const opponentMatchup = matchups.find(
      (matchup) => matchup.matchup_id === ownMatchup.matchup_id && matchup.roster_id !== ownMatchup.roster_id,
    );
    const opponent = opponentMatchup ? teams.find((team) => team.rosterId === opponentMatchup.roster_id) : undefined;
    const slots = (league.roster_positions ?? []).filter((slot) => !['BN', 'IR', 'TAXI'].includes(slot));
    if (!slots.length) {
      return null;
    }

    const projectionsByPlayer = new Map(projections.map((projection) => [projection.player_id, projection]));
    const scorePlayers = (team: FantasyTeam, matchup: SleeperMatchup) => {
      const activePlayerIds = new Set(matchup.players ?? []);
      return team.players.flatMap((player) => {
        if (!activePlayerIds.has(player.id)) return [];
        const projectedPoints = this.projectedPoints(
          projectionsByPlayer.get(player.id)?.stats,
          league.scoring_settings,
        );
        return projectedPoints === null ? [] : [{ ...player, projectedPoints }];
      });
    };
    const ownPlayers = scorePlayers(ownRoster, ownMatchup);
    if (!ownPlayers.length) {
      throw new Error('Sleeper returned no usable weekly projections for the user roster.');
    }
    const maximum = this.optimizeLineup(ownPlayers, slots, 'max');
    const minimum = this.optimizeLineup(ownPlayers, slots, 'min');
    if (!maximum.length || !minimum.length) {
      return null;
    }
    const currentStarterIds = new Set(ownRoster.starters);
    const recommendedIds = new Set(maximum.map((player) => player.id));
    const opponentPlayers = opponent && opponentMatchup ? scorePlayers(opponent, opponentMatchup) : [];
    if (opponent && !opponentPlayers.length) {
      throw new Error('Sleeper returned no usable weekly projections for the opponent roster.');
    }
    const opponentMaximum = opponent ? this.optimizeLineup(opponentPlayers, slots, 'max') : [];
    const opponentMinimum = opponent ? this.optimizeLineup(opponentPlayers, slots, 'min') : [];

    return {
      week,
      opponentOwnerName: opponent?.ownerName ?? null,
      recommendedStarters: maximum,
      start: maximum.filter((player) => !currentStarterIds.has(player.id)),
      sit: ownPlayers.filter((player) => currentStarterIds.has(player.id) && !recommendedIds.has(player.id)),
      userPotential: {
        min: this.lineupTotal(minimum),
        max: this.lineupTotal(maximum),
      },
      opponentPotential:
        opponentMaximum.length && opponentMinimum.length
          ? {
              min: this.lineupTotal(opponentMinimum),
              max: this.lineupTotal(opponentMaximum),
            }
          : null,
      summary: '',
    };
  }

  private projectedPoints(
    stats: Record<string, number | null | undefined> | undefined,
    scoringSettings: Record<string, number> | undefined,
  ): number | null {
    if (!stats) return null;
    if (scoringSettings && Object.keys(scoringSettings).length) {
      const scoringEntries = Object.entries(scoringSettings).filter(([stat]) => stats[stat] !== undefined);
      if (!scoringEntries.length) return null;
      return scoringEntries.reduce((total, [stat, multiplier]) => total + (stats[stat] ?? 0) * multiplier, 0);
    }
    return stats.pts_ppr ?? stats.pts_half_ppr ?? stats.pts_std ?? null;
  }

  private optimizeLineup(
    players: LineupRecommendation['recommendedStarters'],
    slots: string[],
    direction: 'min' | 'max',
  ): LineupRecommendation['recommendedStarters'] {
    const orderedSlots = [...slots].sort(
      (left, right) =>
        players.filter((player) => this.isEligible(player, left)).length -
        players.filter((player) => this.isEligible(player, right)).length,
    );
    type OptimizedLineup = {
      score: number;
      players: LineupRecommendation['recommendedStarters'];
    };
    const memo = new Map<string, OptimizedLineup>();
    const solve = (slotIndex: number, usedPlayers: bigint): OptimizedLineup => {
      if (slotIndex === orderedSlots.length) {
        return { score: 0, players: [] };
      }
      const key = `${slotIndex}:${usedPlayers}`;
      const cached = memo.get(key);
      if (cached) return cached;

      const eligible = players
        .map((player, index) => ({ player, index }))
        .filter(
          ({ player, index }) =>
            (usedPlayers & (1n << BigInt(index))) === 0n && this.isEligible(player, orderedSlots[slotIndex]),
        );
      if (!eligible.length) {
        const result = solve(slotIndex + 1, usedPlayers);
        memo.set(key, result);
        return result;
      }

      let best: OptimizedLineup | null = null;
      for (const { player, index } of eligible) {
        const remaining = solve(slotIndex + 1, usedPlayers | (1n << BigInt(index)));
        const candidate = {
          score: player.projectedPoints + remaining.score,
          players: [player, ...remaining.players],
        };
        if (
          best === null ||
          (direction === 'max' && candidate.score > best.score) ||
          (direction === 'min' && candidate.score < best.score)
        ) {
          best = candidate;
        }
      }
      const result = best ?? { score: 0, players: [] };
      memo.set(key, result);
      return result;
    };

    return solve(0, 0n).players;
  }

  private isEligible(player: FantasyPlayer, slot: string): boolean {
    const eligiblePositions: Record<string, string[] | undefined> = {
      FLEX: ['RB', 'WR', 'TE'],
      SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
      REC_FLEX: ['WR', 'TE'],
      WRRB_FLEX: ['WR', 'RB'],
      IDP_FLEX: ['DL', 'LB', 'DB'],
    };
    const positions = eligiblePositions[slot] ?? [slot];
    return player.fantasyPositions.some((position) => positions.includes(position));
  }

  private lineupTotal(players: LineupRecommendation['recommendedStarters']): number {
    return Math.round(players.reduce((total, player) => total + player.projectedPoints, 0) * 10) / 10;
  }

  private buildLineupFallbackSummary(recommendation: LineupRecommendation): string {
    const opponent = recommendation.opponentOwnerName ? ` against ${recommendation.opponentOwnerName}` : '';
    return `The highest-projected lineup for week ${recommendation.week}${opponent} is ${recommendation.userPotential.max.toFixed(1)} points.`;
  }

  private buildRosterNeeds(team: FantasyTeam, rosterPositions: string[]): RosterNeed[] {
    const requiredByPosition = rosterPositions
      .filter((slot) => !OPTIONAL_ROSTER_SLOTS.has(slot))
      .reduce<Record<string, number>>((counts, position) => {
        counts[position] = (counts[position] ?? 0) + 1;
        return counts;
      }, {});
    const rosteredByPosition = team.players.reduce<Record<string, number>>((counts, player) => {
      if (player.position) counts[player.position] = (counts[player.position] ?? 0) + 1;
      return counts;
    }, {});

    return Object.entries(requiredByPosition)
      .map(([position, recommended]) => ({
        position,
        rostered: rosteredByPosition[position] ?? 0,
        recommended,
        deficit: Math.max(0, recommended - (rosteredByPosition[position] ?? 0)),
      }))
      .filter((need) => need.deficit > 0)
      .sort((left, right) => right.deficit - left.deficit);
  }

  private buildMatchupContext(scoreboards: EspnScoreboard[], players: FantasyPlayer[], startingWeek: number) {
    const rosterTeams = new Set(
      players
        .map((player) => (player.team ? this.normalizeTeam(player.team) : null))
        .filter((team): team is string => !!team),
    );
    return scoreboards.flatMap((scoreboard, index) =>
      (scoreboard.events ?? []).flatMap((event) => {
        const competitors = event.competitions?.[0]?.competitors ?? [];
        const away = competitors.find((team) => team.homeAway === 'away')?.team?.abbreviation;
        const home = competitors.find((team) => team.homeAway === 'home')?.team?.abbreviation;
        if (!away || !home) return [];
        const normalizedAway = this.normalizeTeam(away);
        const normalizedHome = this.normalizeTeam(home);
        const rosterTeam = [normalizedAway, normalizedHome].find((team) => rosterTeams.has(team));
        if (!rosterTeam) return [];
        return [
          {
            week: startingWeek + index,
            rosterTeam,
            opponent: rosterTeam === normalizedAway ? normalizedHome : normalizedAway,
            startsAt: event.date ?? null,
          },
        ];
      }),
    );
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
    bidGuidance: WaiverBidGuidance,
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
          recommendedBid: bidGuidance.suggestedBids[add.id] ?? suggestion.recommendedBid,
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
    lineupRecommendation: LineupRecommendation | null,
    waiverBidGuidance: WaiverBidGuidance,
    currentWeek: number,
    scoreboards: EspnScoreboard[],
  ): Promise<AITradeAnalysis> {
    const rosterNeeds = new Map(
      teams.map((team) => [team.rosterId, this.buildRosterNeeds(team, league.roster_positions ?? [])]),
    );
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
      needs: rosterNeeds.get(team.rosterId) ?? [],
    }));
    const matchupContext = this.buildMatchupContext(
      scoreboards,
      [...ownRoster.players, ...waiverCandidates],
      currentWeek,
    );
    const response = await this.openAi.responses.create({
      model: GPT_MODEL,
      reasoning: { effort: 'low' },
      instructions:
        'You are a fantasy football analyst. Return only valid JSON with keys teamHealth, tradeInsights, suggestions, waiverSuggestions, and lineupSummary. ' +
        'teamHealth must assess the user roster relative to the supplied league with an integer percentage from 0 to 100 and a concise summary. ' +
        'tradeInsights must include exactly one item per pending transaction with transactionId, a concise insight, ' +
        'and recommendation of accept, decline, or negotiate. suggestions must contain up to 3 realistic options ' +
        'with targetRosterId, givePlayerIds, receivePlayerIds, and rationale. Make each proposed trade fair enough that ' +
        'the target manager is likely to accept, but favor a small, subtle value edge for the user. Consider the current ' +
        'week, upcoming schedule, roster needs for both teams, positional scarcity, and whether the timing makes the offer ' +
        'more or less appealing. waiverSuggestions must contain up to 3 ' +
        'add/drop proposals using only the supplied waiver candidate and user roster IDs, with rationale and a high, ' +
        'medium, or low priority, plus an integer recommendedBid in dollars that does not exceed remainingWaiverBudget. ' +
        'Prioritize the user roster gaps first, then compare current and upcoming matchups for the candidate and the dropped ' +
        'player; do not recommend a player solely because of name value or season-long projections. ' +
        'When historicalBidGuidance contains a suggested bid for a player, use that exact amount; it is calculated from ' +
        'the league history using recency-weighted dollars per projected point and is authoritative. ' +
        'Waivers process Wednesday and Sunday. lineupSummary must briefly explain the supplied deterministic weekly lineup recommendation, ' +
        'including its overall potential versus the opponent; do not change or invent player IDs or projections. Use only supplied IDs and rosters.',
      input: JSON.stringify({
        league: { name: league.name, season: league.season },
        userRosterId: ownRoster.rosterId,
        teams: compactTeams,
        pendingTransactions,
        waiverCandidates,
        remainingWaiverBudget,
        historicalBidGuidance: waiverBidGuidance,
        lineupRecommendation,
        currentWeek,
        rosterNeeds: rosterNeeds.get(ownRoster.rosterId) ?? [],
        matchupContext,
      }),
      text: {
        format: {
          type: 'json_schema',
          name: 'fantasy_trade_analysis',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['teamHealth', 'tradeInsights', 'suggestions', 'waiverSuggestions', 'lineupSummary'],
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
              lineupSummary: { type: 'string' },
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
    const lineupSummary = Reflect.get(value, 'lineupSummary');
    if (
      !teamHealth ||
      typeof teamHealth !== 'object' ||
      !Array.isArray(tradeInsights) ||
      !Array.isArray(suggestions) ||
      !Array.isArray(waiverSuggestions) ||
      typeof lineupSummary !== 'string' ||
      !lineupSummary.trim()
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
      lineupSummary: lineupSummary.trim(),
    };
  }
}
