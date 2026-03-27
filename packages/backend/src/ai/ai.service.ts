import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { MessageWithName } from '../shared/models/message/message-with-name';
import { HistoryPersistenceService } from '../shared/services/history.persistence.service';
import type { EventRequest, SlashCommandRequest } from '../shared/models/slack/slack-models';
import { AIPersistenceService } from './ai.persistence';
import type { KnownBlock } from '@slack/web-api';
import { WebService } from '../shared/services/web/web.service';
import {
  CORPO_SPEAK_INSTRUCTIONS,
  GENERAL_TEXT_INSTRUCTIONS,
  MOONBEAM_SYSTEM_INSTRUCTIONS,
  getHistoryInstructions,
  MAX_AI_REQUESTS_PER_DAY,
  REDPLOY_MOONBEAM_IMAGE_PROMPT,
  REDPLOY_MOONBEAM_TEXT_PROMPT,
  GATE_MODEL,
  MOONBEAM_SLACK_ID,
  MEMORY_USAGE_INSTRUCTION,
  MEMORY_SELECTION_PROMPT,
  MEMORY_EXTRACTION_PROMPT,
  GPT_MODEL,
} from './ai.constants';
import { MemoryPersistenceService } from './memory/memory.persistence.service';
import type { MemoryWithSlackId } from '../shared/db/models/Memory';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';
import { SlackService } from '../shared/services/slack/slack.service';
import { SlackPersistenceService } from '../shared/services/slack/slack.persistence.service';
import { MuzzlePersistenceService } from '../muzzle/muzzle.persistence.service';
import OpenAI from 'openai';
import type {
  ResponseOutputMessage,
  ResponseOutputItem,
  ResponseOutputText,
  ResponseOutputRefusal,
} from 'openai/resources/responses/responses';
import type { Part } from '@google/genai';
import { GoogleGenAI } from '@google/genai';

interface ExtractionResult {
  slackId: string;
  content: string;
  mode: 'NEW' | 'REINFORCE' | 'EVOLVE';
  existingMemoryId: number | null;
}

const isResponseOutputMessage = (block: ResponseOutputItem): block is ResponseOutputMessage => block.type === 'message';

const isResponseOutputText = (block: ResponseOutputText | ResponseOutputRefusal): block is ResponseOutputText =>
  block.type === 'output_text';

const extractAndParseOpenAiResponse = (response: OpenAI.Responses.Response): string | undefined => {
  const textBlock = response.output.find(isResponseOutputMessage);
  const outputText = textBlock?.content.find(isResponseOutputText)?.text;
  return outputText?.trim();
};

const DEFAULT_IMAGE_DIR = path.join('/tmp', 'mocker-images');

export class AIService {
  redis = new AIPersistenceService();
  openAi = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  gemini = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });

  muzzlePersistenceService = new MuzzlePersistenceService();
  historyService = new HistoryPersistenceService();
  webService = new WebService();
  slackService = new SlackService();
  slackPersistenceService = new SlackPersistenceService();
  memoryPersistenceService = new MemoryPersistenceService();
  aiServiceLogger = logger.child({ module: 'AIService' });

  public decrementDaiyRequests(userId: string, teamId: string): Promise<string | null> {
    return this.redis.decrementDailyRequests(userId, teamId);
  }

  public isAlreadyInflight(userId: string, teamId: string): Promise<boolean> {
    return this.redis.getInflight(userId, teamId).then((x) => !!x);
  }

  public isAlreadyAtMaxRequests(userId: string, teamId: string): Promise<boolean> {
    return this.redis.getDailyRequests(userId, teamId).then((x) => Number(x) >= MAX_AI_REQUESTS_PER_DAY);
  }

  public setCustomPrompt(userId: string, teamId: string, prompt: string): Promise<boolean> {
    return this.slackPersistenceService.setCustomPrompt(userId, teamId, prompt);
  }

  public clearCustomPrompt(userId: string, teamId: string): Promise<boolean> {
    return this.slackPersistenceService.clearCustomPrompt(userId, teamId);
  }

  public async generateText(userId: string, teamId: string, channelId: string, text: string): Promise<void> {
    await this.redis.setInflight(userId, teamId);
    await this.redis.setDailyRequests(userId, teamId);

    // Fetch and select relevant memories for the requesting user
    const memoryContext = await this.fetchMemoryContext([userId], teamId, `User prompt: ${text}`, []);
    const instructions = this.appendMemoryContext(GENERAL_TEXT_INSTRUCTIONS, memoryContext);

    return this.openAi.responses
      .create({
        model: GPT_MODEL,
        tools: [{ type: 'web_search_preview' }],
        instructions,
        input: text,
        user: `${userId}-DaBros2016`,
      })
      .then((x) => {
        return extractAndParseOpenAiResponse(x);
      })
      .then(async (result) => {
        await this.redis.removeInflight(userId, teamId);
        if (result) {
          this.sendGptText(result, userId, teamId, channelId, text);
        } else {
          this.aiServiceLogger.warn(`No result returned for prompt: ${text}`);
          throw new Error(`No result returned for prompt: ${text}`);
        }
      })
      .catch(async (e) => {
        logError(this.aiServiceLogger, 'Failed to generate AI text response', e, {
          userId,
          teamId,
          channelId,
          prompt: text,
        });
        await this.redis.removeInflight(userId, teamId);
        await this.redis.decrementDailyRequests(userId, teamId);
        throw e;
      });
  }

  public async writeToDiskAndReturnUrl(base64Image: string): Promise<string> {
    const dir = process.env.IMAGE_DIR ?? DEFAULT_IMAGE_DIR;
    const filename = `${uuidv4()}.png`;
    const filePath = path.join(dir, filename);
    const base64Data = base64Image.replace(/^data:image\/png;base64,/, '');

    try {
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(filePath, base64Data, 'base64');
      return `https://muzzle.lol/${filename}`;
    } catch (error) {
      logError(this.aiServiceLogger, 'Failed to write AI image to disk', error, {
        imageDirectory: dir,
        filePath,
      });
      throw error;
    }
  }

  public async redeployMoonbeam(): Promise<void> {
    const aiQuote = this.openAi.responses
      .create({
        model: GPT_MODEL,
        input: REDPLOY_MOONBEAM_TEXT_PROMPT,
        user: 'Moonbeam',
      })
      .then((x) => extractAndParseOpenAiResponse(x));

    const aiImage = this.gemini.models
      .generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: REDPLOY_MOONBEAM_IMAGE_PROMPT,
        config: {
          candidateCount: 1,
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio: '16:9',
            imageSize: '1K',
          },
        },
      })
      .then((response) => {
        this.aiServiceLogger.info('Gemini response structure:', {
          hasCandidates: !!response.candidates,
          candidatesLength: response.candidates?.length,
          firstCandidateKeys: response.candidates?.[0] ? Object.keys(response.candidates[0]) : null,
          contentKeys: response.candidates?.[0]?.content ? Object.keys(response.candidates[0].content) : null,
          partsLength: response.candidates?.[0]?.content?.parts?.length,
          fullResponse: JSON.stringify(response, null, 2),
        });

        let imageBytes = Buffer.from([]);
        if (!response.candidates || response.candidates.length === 0) {
          this.aiServiceLogger.warn('No candidates in Gemini response');
          return '';
        }

        const parts = response.candidates[0].content?.parts;
        if (!parts || parts.length === 0) {
          this.aiServiceLogger.warn('No parts in first candidate');
          return '';
        }

        parts.forEach((part: Part) => {
          if (part.inlineData?.data) {
            imageBytes = Buffer.concat([imageBytes, Buffer.from(part.inlineData.data, 'base64')]);
          } else {
            this.aiServiceLogger.info('Part does not have inlineData.data:', Object.keys(part));
          }
        });

        return imageBytes.toString('base64');
      })
      .then(async (x) => {
        if (x) {
          return this.writeToDiskAndReturnUrl(x);
        } else {
          const error = new Error(`No b64_json was returned for prompt: ${REDPLOY_MOONBEAM_IMAGE_PROMPT}`);
          logError(this.aiServiceLogger, 'Gemini redeploy image generation returned no image data', error, {
            prompt: REDPLOY_MOONBEAM_IMAGE_PROMPT,
          });
          throw error;
        }
      });

    return Promise.all([aiImage, aiQuote])
      .then((results) => {
        const [imageUrl, quote] = results;
        const blocks: KnownBlock[] = [
          {
            type: 'image',
            image_url: imageUrl,
            alt_text: 'Moonbeam has been deployed.',
          },
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: 'Moonbeam has been deployed.',
            },
          },
          { type: 'markdown', text: quote ? `"${quote}"` : '' },
        ];
        void this.webService.sendMessage('#muzzlefeedback', 'Moonbeam has been deployed.', blocks);
      })
      .catch((e) => {
        logError(this.aiServiceLogger, 'Failed to redeploy Moonbeam assets', e);
      });
  }

  public async generateImage(userId: string, teamId: string, channel: string, text: string): Promise<void> {
    await this.redis.setInflight(userId, teamId);
    await this.redis.setDailyRequests(userId, teamId);
    return this.gemini.models
      .generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: text,
        config: {
          candidateCount: 1,
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio: '16:9',
            imageSize: '1K',
          },
        },
      })
      .then((response) => {
        this.aiServiceLogger.info('Gemini generateImage response structure:', {
          hasCandidates: !!response.candidates,
          candidatesLength: response.candidates?.length,
          firstCandidateKeys: response.candidates?.[0] ? Object.keys(response.candidates[0]) : null,
          contentKeys: response.candidates?.[0]?.content ? Object.keys(response.candidates[0].content) : null,
          partsLength: response.candidates?.[0]?.content?.parts?.length,
        });

        let imageBytes = Buffer.from([]);
        if (!response.candidates || response.candidates.length === 0) {
          this.aiServiceLogger.warn('No candidates in Gemini response for generateImage');
          return '';
        }

        const parts = response.candidates[0].content?.parts;
        if (!parts || parts.length === 0) {
          this.aiServiceLogger.warn('No parts in first candidate for generateImage');
          return '';
        }

        parts.forEach((part: Part) => {
          if (part.inlineData?.data) {
            imageBytes = Buffer.concat([imageBytes, Buffer.from(part.inlineData.data, 'base64')]);
          } else {
            this.aiServiceLogger.info('GenerateImage part does not have inlineData.data:', Object.keys(part));
          }
        });

        return imageBytes.toString('base64');
      })
      .then(async (x) => {
        await this.redis.removeInflight(userId, teamId);

        if (x) {
          return this.writeToDiskAndReturnUrl(x);
        } else {
          const error = new Error(`No b64_json was returned for prompt: ${text}`);
          logError(this.aiServiceLogger, 'Gemini image generation returned no image data', error, {
            userId,
            teamId,
            channelId: channel,
            prompt: text,
          });
          throw error;
        }
      })
      .then((imageUrl) => {
        this.sendImage(imageUrl, userId, teamId, channel, text);
      })
      .catch(async (e) => {
        logError(this.aiServiceLogger, 'Failed to generate AI image response', e, {
          userId,
          teamId,
          channelId: channel,
          prompt: text,
        });
        await this.redis.removeInflight(userId, teamId);
        await this.redis.decrementDailyRequests(userId, teamId);
        throw e;
      });
  }

  public generateCorpoSpeak(text: string): Promise<string | undefined> {
    return this.openAi.responses
      .create({ model: GPT_MODEL, input: text, user: 'Moonbeam', instructions: CORPO_SPEAK_INSTRUCTIONS })
      .then((x) => {
        return extractAndParseOpenAiResponse(x);
      })
      .catch(async (e) => {
        logError(this.aiServiceLogger, 'Failed to generate corpo-speak response', e, {
          prompt: text,
        });
        throw e;
      });
  }

  public formatHistory(history: MessageWithName[]): string {
    if (history.length === 0) {
      return '[No recent messages in channel]';
    }

    return history
      .map((x) => {
        const timestamp = new Date(x.createdAt).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const prefix = `[${timestamp}] `;
        const slackIdTag = ` (${x.slackId})`;
        return `${prefix}${x.name}${slackIdTag}: ${x.message}`;
      })
      .join('\n');
  }

  public async promptWithHistory(request: SlashCommandRequest): Promise<void> {
    const { user_id, team_id, text: prompt } = request;
    await this.redis.setInflight(user_id, team_id);
    await this.redis.setDailyRequests(user_id, team_id);
    const history: MessageWithName[] = await this.historyService.getHistory(request, true);
    const formattedHistory: string = this.formatHistory(history);

    const customPrompt = await this.slackPersistenceService.getCustomPrompt(user_id, team_id);
    const normalizedCustomPrompt = customPrompt?.trim() || null;

    // Fetch and select relevant memories
    const memoryContext = await this.fetchMemoryContext(
      this.extractParticipantSlackIds(history, { includeSlackId: user_id }),
      team_id,
      `${formattedHistory}\n\nUser prompt: ${prompt}`,
      history,
    );
    const baseInstructions = normalizedCustomPrompt
      ? `${normalizedCustomPrompt}\n\n${getHistoryInstructions(formattedHistory)}`
      : getHistoryInstructions(formattedHistory);
    const systemInstructions = this.appendMemoryContext(baseInstructions, memoryContext);

    return this.openAi.responses
      .create({
        model: GPT_MODEL,
        tools: [{ type: 'web_search_preview' }],
        instructions: systemInstructions,
        input: prompt,
        user: `${user_id}-DaBros2016`,
      })
      .then((x) => extractAndParseOpenAiResponse(x))
      .then(async (result) => {
        await this.redis.removeInflight(user_id, team_id);
        if (!result) {
          this.aiServiceLogger.warn(`No result returned for prompt: ${prompt}`);
          return;
        }

        const blocks: KnownBlock[] = [];

        blocks.push({ type: 'markdown', text: result });

        blocks.push({
          type: 'divider',
        });

        blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `:technologist: _Context-aware prompt generated by <@${request.user_id}> | "${request.text}"_ :technologist:`,
            },
          ],
        });

        this.webService.sendMessage(request.channel_id, request.text, blocks).catch((e) => {
          logError(this.aiServiceLogger, 'Failed to send prompt-with-history response to Slack', e, {
            userId: request.user_id,
            teamId: request.team_id,
            channelId: request.channel_id,
            prompt: request.text,
          });
          void this.webService.sendMessage(
            request.user_id,
            'Sorry, unable to send the requested text to Slack. You have been credited for your Moon Token. Perhaps you were trying to send in a private channel? If so, invite @MoonBeam and try again.',
          );
        });
      })
      .catch(async (e) => {
        logError(this.aiServiceLogger, 'Failed to process prompt with history', e, {
          userId: request.user_id,
          teamId: request.team_id,
          channelId: request.channel_id,
          prompt: request.text,
        });
        await this.redis.removeInflight(user_id, team_id);
        await this.redis.decrementDailyRequests(user_id, team_id);
        throw e;
      });
  }

  public async participate(teamId: string, channelId: string, taggedMessage: string, userId?: string, threadTs?: string): Promise<void> {
    await this.redis.setParticipationInFlight(channelId, teamId);

    const historyMessages = await this.historyService.getHistoryWithOptions({
      teamId,
      channelId,
      maxMessages: 200,
      timeWindowMinutes: 120,
    });

    const history = this.formatHistory(historyMessages);

    const customPrompt = userId ? await this.slackPersistenceService.getCustomPrompt(userId, teamId) : null;
    const normalizedCustomPrompt = customPrompt?.trim() || null;

    // Fetch and select relevant memories
    const participantSlackIds = this.extractParticipantSlackIds(historyMessages, {
      excludeSlackIds: [MOONBEAM_SLACK_ID],
    });
    const memoryContext = await this.fetchMemoryContext(participantSlackIds, teamId, history, historyMessages);
    const baseInstructions = normalizedCustomPrompt ?? MOONBEAM_SYSTEM_INSTRUCTIONS;
    const systemInstructions = this.appendMemoryContext(baseInstructions, memoryContext);

    const input = `${history}\n\n---\n[Tagged message to respond to]:\n${taggedMessage}`;

    return this.openAi.responses
      .create({
        model: GPT_MODEL,
        tools: [{ type: 'web_search_preview' }],
        instructions: systemInstructions,
        input,
        user: `participation-${channelId}-${teamId}-DaBros2016`,
      })
      .then((x) => extractAndParseOpenAiResponse(x))
      .then((result) => {
        if (result) {
          this.webService
            .sendMessage(channelId, result, [{ type: 'markdown', text: result }])
            .then(() => this.redis.setHasParticipated(teamId, channelId))
            .catch((e) =>
              logError(this.aiServiceLogger, 'Failed to send AI participation message', e, {
                teamId,
                channelId,
              }),
            );
        }
      })
      .catch(async (e) => {
        logError(this.aiServiceLogger, 'Failed to generate AI participation response', e, {
          teamId,
          channelId,
          taggedMessage,
        });
        throw e;
      })
      .finally(() => {
        void this.redis.removeParticipationInFlight(channelId, teamId);
      });
  }

  private async selectRelevantMemories(
    conversation: string,
    memoriesMap: Map<string, MemoryWithSlackId[]>,
  ): Promise<MemoryWithSlackId[]> {
    if (memoriesMap.size === 0) return [];

    const formattedMemories = Array.from(memoriesMap.entries())
      .map(([slackId, memories]) => {
        const lines = memories.map((m) => `  [ID:${m.id}] "${m.content}"`).join('\n');
        return `${slackId}:\n${lines}`;
      })
      .join('\n\n');

    const prompt = MEMORY_SELECTION_PROMPT.replace('{all_memories_grouped_by_user}', formattedMemories);

    try {
      const raw = await this.openAi.responses
        .create({
          model: GATE_MODEL,
          instructions: prompt,
          input: conversation,
        })
        .then((x) => extractAndParseOpenAiResponse(x));

      if (!raw) return [];

      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const selectedIds = parsed.map(Number).filter((n) => !isNaN(n));

      return Array.from(memoriesMap.values())
        .flat()
        .filter((m) => selectedIds.includes(m.id));
    } catch (e) {
      this.aiServiceLogger.warn('Memory selection failed, proceeding without memories:', e);
      return [];
    }
  }

  private formatMemoryContext(memories: MemoryWithSlackId[], history: MessageWithName[]): string {
    if (memories.length === 0) return '';

    const nameMap = new Map<string, string>();
    history.forEach((msg) => {
      if (msg.slackId && msg.name) nameMap.set(msg.slackId, msg.name);
    });

    const grouped = new Map<string, MemoryWithSlackId[]>();
    for (const mem of memories) {
      const slackId = mem.slackId || 'unknown';
      if (!grouped.has(slackId)) grouped.set(slackId, []);
      grouped.get(slackId)!.push(mem);
    }

    const lines = Array.from(grouped.entries())
      .map(([slackId, mems]) => {
        const name = nameMap.get(slackId) || slackId;
        const memLines = mems.map((m) => `"${m.content}"`).join(', ');
        return `- ${name}: ${memLines}`;
      })
      .join('\n');

    return `${MEMORY_USAGE_INSTRUCTION}\n\nthings you remember about the people in this conversation:\n${lines}`;
  }

  private extractParticipantSlackIds(
    history: MessageWithName[],
    options?: { includeSlackId?: string; excludeSlackIds?: string[] },
  ): string[] {
    const excludeSet = new Set(options?.excludeSlackIds || []);
    const ids = [
      ...new Set(history.filter((msg) => msg.slackId && !excludeSet.has(msg.slackId!)).map((msg) => msg.slackId!)),
    ];
    if (options?.includeSlackId && !ids.includes(options.includeSlackId)) {
      ids.push(options.includeSlackId);
    }
    return ids;
  }

  private async fetchMemoryContext(
    participantSlackIds: string[],
    teamId: string,
    conversation: string,
    history: MessageWithName[],
  ): Promise<string> {
    if (participantSlackIds.length === 0) return '';
    const memoriesMap = await this.memoryPersistenceService.getAllMemoriesForUsers(participantSlackIds, teamId);
    const selectedMemories = await this.selectRelevantMemories(conversation, memoriesMap);
    return this.formatMemoryContext(selectedMemories, history);
  }

  private appendMemoryContext(baseInstructions: string, memoryContext: string): string {
    if (!memoryContext) return baseInstructions;
    return `${baseInstructions}\n\n${memoryContext}`;
  }

  public async extractMemoriesForChannel(teamId: string, channelId: string): Promise<void> {
    const historyMessages = await this.historyService.getLast24HoursForChannel(teamId, channelId);
    if (historyMessages.length === 0) return;

    const history = this.formatHistory(historyMessages);
    const participantSlackIds = this.extractParticipantSlackIds(historyMessages, {
      excludeSlackIds: [MOONBEAM_SLACK_ID],
    });

    if (participantSlackIds.length === 0) return;

    await this.extractMemories(teamId, channelId, history, participantSlackIds);
  }

  private async extractMemories(
    teamId: string,
    channelId: string,
    conversationHistory: string,
    participantSlackIds: string[],
  ): Promise<void> {
    const locked = await this.redis.getExtractionLock(channelId, teamId);
    if (locked) {
      this.aiServiceLogger.info(`Extraction lock active for ${channelId}-${teamId}, skipping`);
      return;
    }
    await this.redis.setExtractionLock(channelId, teamId);

    try {
      const existingMemoriesMap = await this.memoryPersistenceService.getAllMemoriesForUsers(
        participantSlackIds,
        teamId,
      );

      const existingMemoriesText =
        existingMemoriesMap.size > 0
          ? Array.from(existingMemoriesMap.entries())
              .map(([slackId, memories]) => {
                const lines = memories.map((m) => `  [ID:${m.id}] "${m.content}"`).join('\n');
                return `${slackId}:\n${lines}`;
              })
              .join('\n\n')
          : '(no existing memories)';

      const extractionInput = conversationHistory;
      const prompt = MEMORY_EXTRACTION_PROMPT.replace('{existing_memories}', existingMemoriesText);

      const result = await this.openAi.responses
        .create({
          model: GATE_MODEL,
          instructions: prompt,
          input: extractionInput,
        })
        .then((x) => extractAndParseOpenAiResponse(x));

      if (!result) {
        this.aiServiceLogger.warn('Extraction returned no result');
        return;
      }

      const trimmed = result.trim();
      if (trimmed === 'NONE' || trimmed === '"NONE"') return;

      let extractions: Array<Partial<ExtractionResult>>;
      try {
        const parsed: unknown = JSON.parse(trimmed);
        extractions = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        this.aiServiceLogger.warn(`Extraction returned malformed JSON: ${trimmed}`);
        return;
      }

      for (const extraction of extractions) {
        if (!extraction.slackId || !extraction.content || !extraction.mode) {
          this.aiServiceLogger.warn('Extraction missing required fields, skipping:', extraction);
          continue;
        }

        if (!/^U[A-Z0-9]+$/.test(extraction.slackId)) {
          this.aiServiceLogger.warn(`Invalid slackId format: ${extraction.slackId}`);
          continue;
        }

        switch (extraction.mode) {
          case 'NEW':
            await this.memoryPersistenceService.saveMemories(extraction.slackId, teamId, [extraction.content]);
            break;

          case 'REINFORCE':
            if (extraction.existingMemoryId) {
              await this.memoryPersistenceService.reinforceMemory(extraction.existingMemoryId);
            } else {
              this.aiServiceLogger.warn('REINFORCE extraction missing existingMemoryId, skipping');
            }
            break;

          case 'EVOLVE':
            if (extraction.existingMemoryId) {
              await this.memoryPersistenceService.deleteMemory(extraction.existingMemoryId);
            }
            await this.memoryPersistenceService.saveMemories(extraction.slackId, teamId, [extraction.content]);
            break;

          default:
            this.aiServiceLogger.warn(`Unknown extraction mode: ${String(extraction.mode)}`);
        }
      }

      this.aiServiceLogger.info(`Extraction complete for ${channelId}: ${extractions.length} observations processed`);
    } catch (e) {
      this.aiServiceLogger.warn('Memory extraction failed:', e);
    }
  }

  sendImage(image: string | undefined, userId: string, teamId: string, channel: string, text: string): void {
    if (image) {
      const blocks: KnownBlock[] = [
        {
          type: 'image',
          image_url: image,
          alt_text: text,
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `:camera_with_flash: _Generated by <@${userId}> | "${text}"_ :camera_with_flash:`,
            },
          ],
        },
      ];
      this.webService.sendMessage(channel, text, blocks).catch((e) => {
        logError(this.aiServiceLogger, 'Failed to send generated AI image to Slack', e, {
          userId,
          teamId,
          channelId: channel,
          prompt: text,
        });
        void this.decrementDaiyRequests(userId, teamId);
        void this.webService.sendMessage(
          userId,
          'Sorry, unable to send the requested image to Slack. You have been credited for your Moon Token. Perhaps you were trying to send in a private channel? If so, invite @MoonBeam and try again.',
        );
      });
    }
  }

  sendGptText(text: string | undefined, userId: string, teamId: string, channelId: string, query: string): void {
    if (text) {
      const blocks: KnownBlock[] = [];

      blocks.push({ type: 'markdown', text });

      blocks.push({
        type: 'divider',
      });

      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `:altman: _Generated by <@${userId}> | "${query}"_ :altman:`,
          },
        ],
      });

      this.webService.sendMessage(channelId, text, blocks).catch((e) => {
        logError(this.aiServiceLogger, 'Failed to send generated AI text to Slack', e, {
          userId,
          teamId,
          channelId,
          prompt: query,
        });
        void this.decrementDaiyRequests(userId, teamId);
        void this.webService.sendMessage(
          userId,
          'Sorry, unable to send the requested text to Slack. You have been credited for your Moon Token. Perhaps you were trying to send in a private channel? If so, invite @MoonBeam and try again.',
        );
      });
    }
  }

  async handle(request: EventRequest): Promise<void> {
    const isUserMuzzled = await this.muzzlePersistenceService.isUserMuzzled(request.event.user, request.team_id);
    if (this.slackService.containsTag(request.event.text) && !isUserMuzzled) {
      // Check if Moonbeam is mentioned ANYWHERE in the message (not just first mention)
      const isMoonbeamTagged = this.slackService.isUserMentioned(request.event.text, MOONBEAM_SLACK_ID);
      const isPosterMoonbeam = request.event.user === MOONBEAM_SLACK_ID;
      if (isMoonbeamTagged && !isPosterMoonbeam) {
        const threadTs = request.event.thread_ts ?? request.event.ts;
        void this.participate(
          request.team_id,
          request.event.channel,
          request.event.text,
          request.event.user,
          threadTs,
        );
      }
    }
  }
}
