import express, { Router } from 'express';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { SuppressorService } from '../shared/services/suppressor.service';
import { HistoryPersistenceService } from '../services/history/history.persistence.service';
import { MessageWithName } from '../shared/models/message/message-with-name';
import { AIService } from '../services/ai/ai.service';
import { WebService } from '../services/web/web.service';
import { KnownBlock } from '@slack/web-api';
import { getChunks } from '../shared/util/getChunks';
import { StoreService } from '../services/store/store.service';

export const summaryController: Router = express.Router();

const historyPersistenceService = new HistoryPersistenceService();
const aiService = new AIService();
const suppressorService = new SuppressorService();
const webService = new WebService();
const storeService = new StoreService();

summaryController.post('/summary', async (req, res) => {
  const request: SlashCommandRequest = req.body;

  // Hardcoded 4 for Moon Token Item Id.
  const hasAvailableMoonToken = await storeService.isItemActive(request.user_id, request.team_id, 4);
  const isAlreadyAtMaxRequests = await aiService.isAlreadyAtMaxRequests(request.user_id, request.team_id);

  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (isAlreadyAtMaxRequests && !hasAvailableMoonToken) {
    res.send(
      'Sorry, you have reached your maximum number of requests per day. Try again tomorrow or consider purchasing a Moon Token in the store.',
    );
  } else {
    res.status(200).send('Processing your request. Please be patient...');
    const history: MessageWithName[] = await historyPersistenceService.getHistory(request);
    const formattedHistory: string = aiService.formatHistory(history);
    const summary = await aiService.getSummary(request.user_id, request.team_id, formattedHistory).catch(e => {
      console.error(e);
      const errorMessage = `\`Sorry! Your request for ${request.text} failed. Please try again.\``;
      webService.sendEphemeral(request.channel_id, errorMessage, request.user_id);
      return undefined;
    });

    if (!summary) {
      return;
    }
    const blocks: KnownBlock[] = [];

    const chunks = getChunks(summary);

    if (chunks) {
      chunks.forEach(chunk => {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${chunk}`,
          },
        });
      });
    }

    blocks.push({
      type: 'divider',
    });

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `:book: _Summary as requested by <@${request.user_id}>_ :book:`,
        },
      ],
    });

    webService.sendMessage(request.channel_id, request.text, blocks).catch(e => {
      console.error(e);
      aiService.decrementDaiyRequests(request.user_id, request.team_id);
      webService.sendMessage(
        request.user_id,
        'Sorry, unable to send the requested text to Slack. You have been credited for your Moon Token. Perhaps you were trying to send in a private channel? If so, invite @MoonBeam and try again.',
      );
    });

    if (isAlreadyAtMaxRequests && hasAvailableMoonToken) {
      storeService.removeEffect(request.user_id, request.team_id, 4);
    }
  }
});