import { getRepository } from 'typeorm';
import type OpenAI from 'openai';
import { SlackChannel } from '../shared/db/models/SlackChannel';
import type { MessageWithName } from '../shared/models/message/message-with-name';
import { HistoryPersistenceService } from '../shared/services/history.persistence.service';
import { RedisPersistenceService } from '../shared/services/redis.persistence.service';
import { AIService } from '../ai/ai.service';
import { logger } from '../shared/logger/logger';
import { logError } from '../shared/logger/error-logging';
import {
  DAILY_ARGUMENT_JOB_CONCURRENCY,
  ARGUMENT_EXTRACTION_PROMPT,
  GATE_MODEL,
  MOONBEAM_SLACK_ID,
} from '../ai/ai.constants';
import { extractParticipantSlackIds } from '../ai/helpers/extractParticipantSlackIds';
import { ArgumentPersistenceService } from './argument.persistence.service';
import type { ArgumentParticipant } from '../shared/db/models/ArgumentLeaderboard';

interface ArgumentExtractionResult {
  summary: string;
  participants: ArgumentParticipant[];
  winnerSlackId: string;
  pointValue: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const extractAndParseOpenAiResponse = (response: OpenAI.Responses.Response): string | undefined => {
  const textBlock = response.output.find((item) => item.type === 'message');
  if (textBlock && 'content' in textBlock) {
    const outputText = textBlock.content.find((item) => item.type === 'output_text');
    return outputText?.text.trim();
  }
  return undefined;
};

export class ArgumentJob {
  private historyService = new HistoryPersistenceService();
  private argumentPersistenceService = new ArgumentPersistenceService();
  private redis = RedisPersistenceService.getInstance();
  private aiService: AIService;
  private jobLogger = logger.child({ module: 'ArgumentJob' });

  constructor(aiService?: AIService) {
    this.aiService = aiService ?? new AIService();
  }

  async run(): Promise<void> {
    this.jobLogger.info('Starting argument extraction job');

    const channels = await getRepository(SlackChannel).find();
    const results = await this.runWithConcurrencyLimit(
      channels.map((channel) => () => this.extractArgumentForChannel(channel.teamId, channel.channelId)),
      DAILY_ARGUMENT_JOB_CONCURRENCY,
    );

    const failed = results
      .map((result, index) => ({ result, index }))
      .filter((item): item is { result: PromiseRejectedResult; index: number } => item.result.status === 'rejected');

    failed.forEach(({ result, index }) => {
      const channel = channels[index];
      this.jobLogger.warn(
        `Failed to extract argument for channel ${channel.channelId} (team ${channel.teamId}):`,
        result.reason,
      );
    });

    const processed = results.length - failed.length;
    this.jobLogger.info(`Argument extraction job complete: processed ${processed}/${channels.length} channels`);
  }

  private async extractArgumentForChannel(teamId: string, channelId: string): Promise<void> {
    const historyMessages = await this.historyService.getLast24HoursForChannel(teamId, channelId);
    if (historyMessages.length === 0) return;

    const participantSlackIds = extractParticipantSlackIds(historyMessages, {
      excludeSlackIds: [MOONBEAM_SLACK_ID],
    });
    if (participantSlackIds.length < 2) return;

    await this.extractArgument(teamId, channelId, historyMessages);
  }

  private async extractArgument(teamId: string, channelId: string, historyMessages: MessageWithName[]): Promise<void> {
    const lockKey = `argument_extraction_lock:${teamId}:${channelId}`;
    const locked = await this.redis.getValue(lockKey);
    if (locked) {
      this.jobLogger.info(`Argument extraction lock active for ${channelId}-${teamId}, skipping`);
      return;
    }
    await this.redis.setValueWithExpire(lockKey, 1, 'EX', 300000);

    try {
      const history = this.aiService.formatHistory(historyMessages);
      const result = await this.aiService.openAi.responses
        .create({
          model: GATE_MODEL,
          instructions: ARGUMENT_EXTRACTION_PROMPT,
          input: history,
          user: `nightly-argument-${channelId}-${teamId}`,
        })
        .then((response) => extractAndParseOpenAiResponse(response));

      const parsedResults = this.parseExtractionResults(result);
      if (parsedResults.length === 0) {
        return;
      }

      for (const parsedResult of parsedResults) {
        const saved = await this.argumentPersistenceService.saveArgumentOutcome({
          teamId,
          channelId,
          argumentSummary: parsedResult.summary,
          participants: parsedResult.participants,
          winnerSlackId: parsedResult.winnerSlackId,
          pointValue: parsedResult.pointValue,
        });

        if (saved) {
          this.jobLogger.info(`Argument extracted for ${channelId}: "${saved.argument}"`);
        }
      }
    } catch (error) {
      logError(this.jobLogger, 'Argument extraction failed', error, { teamId, channelId });
    }
  }

  private parseExtractionResults(result: string | undefined): ArgumentExtractionResult[] {
    if (!result) {
      this.jobLogger.warn('Argument extraction returned no result');
      return [];
    }

    const trimmed = result.trim();
    if (trimmed === 'NONE' || trimmed === '"NONE"') {
      return [];
    }

    try {
      const parsed: unknown = JSON.parse(trimmed);
      const rawArguments = Array.isArray(parsed) ? parsed : isRecord(parsed) ? [parsed] : null;
      if (!rawArguments) {
        this.jobLogger.warn(`Argument extraction returned non-array JSON: ${trimmed}`);
        return [];
      }

      const parsedArguments = rawArguments
        .map((argument) => {
          if (!isRecord(argument)) {
            return null;
          }

          const participants = Array.isArray(argument.participants)
            ? argument.participants
                .map((participant) => {
                  if (!isRecord(participant)) {
                    return null;
                  }

                  return typeof participant.slackId === 'string' &&
                    typeof participant.name === 'string' &&
                    typeof participant.viewpoint === 'string'
                    ? {
                        slackId: participant.slackId.trim(),
                        name: participant.name.trim(),
                        viewpoint: participant.viewpoint.trim(),
                      }
                    : null;
                })
                .filter((participant): participant is ArgumentParticipant => participant !== null)
            : [];

          const summary = typeof argument.summary === 'string' ? argument.summary.trim() : '';
          const winnerSlackId = typeof argument.winnerSlackId === 'string' ? argument.winnerSlackId.trim() : '';
          const pointValue =
            typeof argument.pointValue === 'number' ? argument.pointValue : Number(argument.pointValue);

          if (
            !summary ||
            participants.length < 2 ||
            !winnerSlackId ||
            !participants.some((participant) => participant.slackId === winnerSlackId)
          ) {
            return null;
          }

          return {
            summary,
            participants,
            winnerSlackId,
            pointValue: Math.min(5, Math.max(0, Number.isFinite(pointValue) ? Math.round(pointValue) : 0)),
          };
        })
        .filter((argument): argument is ArgumentExtractionResult => argument !== null);

      if (parsedArguments.length === 0 && rawArguments.length > 0) {
        this.jobLogger.warn(`Argument extraction returned incomplete payload: ${trimmed}`);
      }

      return parsedArguments;
    } catch {
      this.jobLogger.warn(`Argument extraction returned malformed JSON: ${trimmed}`);
      return [];
    }
  }

  private async runWithConcurrencyLimit<T>(
    tasks: Array<() => Promise<T>>,
    concurrency: number,
  ): Promise<PromiseSettledResult<T>[]> {
    const results: PromiseSettledResult<T>[] = new Array(tasks.length);
    let nextIndex = 0;

    const runNext = async (): Promise<void> => {
      while (nextIndex < tasks.length) {
        const index = nextIndex++;
        try {
          results[index] = { status: 'fulfilled', value: await tasks[index]() };
        } catch (reason) {
          results[index] = { status: 'rejected', reason };
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => runNext()));
    return results;
  }
}
