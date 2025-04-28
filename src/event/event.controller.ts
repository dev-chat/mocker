import express, { Request, Response, Router } from 'express';
import { WebService } from '../shared/services/web/web.service';
import { EventRequest } from '../shared/models/slack/slack-models';
import { SuppressorService } from '../shared/services/suppressor.service';
import { HistoryPersistenceService } from '../shared/services/history.persistence.service';
import { InsertResult } from 'typeorm';
import { AIService } from '../ai/ai.service';
import { BackFirePersistenceService } from '../backfire/backfire.persistence.service';
import { BackfireService } from '../backfire/backfire.service';
import { CounterPersistenceService } from '../counter/counter.persistence.service';
import { CounterService } from '../counter/counter.service';
import { ABUSE_PENALTY_TIME } from '../muzzle/constants';
import { getTimeString } from '../muzzle/muzzle-utilities';
import { MuzzlePersistenceService } from '../muzzle/muzzle.persistence.service';
import { MuzzleService } from '../muzzle/muzzle.service';
import { ReactionService } from '../reaction/reaction.service';
import { SlackService } from '../shared/services/slack/slack.service';
import { EventPersistenceService } from './event.persistence.service';

export const eventController: Router = express.Router();

const muzzleService = new MuzzleService();
const backfireService = new BackfireService();
const counterService = new CounterService();
const reactionService = new ReactionService();
const webService = WebService.getInstance();
const slackService = SlackService.getInstance();
const suppressorService = new SuppressorService();
const aiService = new AIService();
const muzzlePersistenceService = MuzzlePersistenceService.getInstance();
const backfirePersistenceService = BackFirePersistenceService.getInstance();
const counterPersistenceService = CounterPersistenceService.getInstance();
const eventPersistenceService = EventPersistenceService.getInstance();
const historyPersistenceService = HistoryPersistenceService.getInstance();


async function handleBotMessage(request: EventRequest, botUserToMuzzle: string): Promise<void> {
  console.log(`A user is muzzled and tried to send a bot message! Suppressing...`);
  webService.deleteMessage(request.event.channel, request.event.ts, request.event.user);
  const muzzleId = await muzzlePersistenceService.getMuzzle(botUserToMuzzle, request.team_id);
  if (muzzleId) {
    muzzlePersistenceService.trackDeletedMessage(muzzleId, 'A bot message');
    return;
  }

  const backfireId = await backfirePersistenceService.getBackfireByUserId(botUserToMuzzle, request.team_id);
  if (backfireId) {
    backfirePersistenceService.trackDeletedMessage(backfireId, 'A bot user message');
    return;
  }

  const counter = await counterPersistenceService.getCounterMuzzle(botUserToMuzzle);

  if (counter?.counterId) {
    counterPersistenceService.incrementMessageSuppressions(counter.counterId);
    return;
  }
}

function handleReaction(request: EventRequest): void {
  reactionService.handleReaction(request.event, request.event.type === 'reaction_added', request.team_id);
}

function handleActivity(request: EventRequest): void {
  if (request.event.type !== 'user_profile_changed') {
    return;
  }
  eventPersistenceService.logActivity(request);
}

function logSentiment(request: EventRequest): void {
  eventPersistenceService.performSentimentAnalysis(
    request.event.user,
    request.team_id,
    request.event.channel,
    request.event.text,
  );
}

function logHistory(request: EventRequest): Promise<InsertResult | undefined> {
  return historyPersistenceService.logHistory(request);
}

// Change route to /event/handle instead.
eventController.post('/muzzle/handle', async (req: Request, res: Response) => {
  if (req.body.challenge) {
    res.send({ challenge: req.body.challenge });
  } else {
    console.time('respond-to-event');
    res.status(200).send();
    const request: EventRequest = req.body;
    const isUserProfileChanged = request.event.type === 'user_profile_changed';
    const isReaction = request.event.type === 'reaction_added' || request.event.type === 'reaction_removed';
    const botUserToMuzzle = await suppressorService.shouldBotMessageBeMuzzled(request);
    const isMessage = request.event.type === 'message' || request.event.type === 'message.channels' || request.event.type === 'message.app_home'
    slackService.handle(request);
    muzzleService.handle(request);
    backfireService.handle(request);
    counterService.handle(request)
    if (botUserToMuzzle && !isReaction) {
      handleBotMessage(request, botUserToMuzzle);
    } else if (isReaction) {
      handleReaction(request);
    } else if (isMessage) {
      logSentiment(request);
      logHistory(request)
        .then(() => aiService.participate(request.team_id, request.event.channel))
        .then((message) => {
          if (!!message) {
            webService
              .sendMessage(request.event.channel, message)
              .catch((e) => console.error('Error sending AI Participation message:', e));
          }
        });
    } else if (isUserProfileChanged) {
      const userWhoIsBeingImpersonated = await slackService.getImpersonatedUser(
        (request.event.user as unknown as Record<string, string>).id,
      );
      if (userWhoIsBeingImpersonated) {
        // muzzle the user who is attempting to impersonate, and do it until the user changes their name back
        await muzzleService
          .permaMuzzle((request.event.user as unknown as Record<string, string>).id, request.team_id)
          .then(() => {
            return webService
              .sendMessage(
                '#general',
                `:cop: <@${(request.event.user as unknown as Record<string, string>).id}> is impersonating <@${
                  userWhoIsBeingImpersonated.id
                }>! They are now muzzled until they assume their normal identity. :cop:`,
              )
              .catch((e) => console.error(e));
          });
      } else {
        // unmuzzle the user who was impersonated, or do nothing if this person was not impersonating
        await muzzleService.removePermaMuzzle(
          (request.event.user as unknown as Record<string, string>).id,
          request.team_id,
        );
      }
    }
    handleActivity(request);
    console.timeEnd('respond-to-event');
  }
});
