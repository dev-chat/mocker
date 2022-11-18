import express, { Request, Response, Router } from 'express';
import { ActivityPersistenceService } from '../services/activity/activity.persistence.service';
import { BackFirePersistenceService } from '../services/backfire/backfire.persistence.service';
import { BackfireService } from '../services/backfire/backfire.service';
import { CounterPersistenceService } from '../services/counter/counter.persistence.service';
import { CounterService } from '../services/counter/counter.service';
import { ABUSE_PENALTY_TIME } from '../services/muzzle/constants';
import { getTimeString } from '../services/muzzle/muzzle-utilities';
import { MuzzlePersistenceService } from '../services/muzzle/muzzle.persistence.service';
import { MuzzleService } from '../services/muzzle/muzzle.service';
import { ReactionService } from '../services/reaction/reaction.service';
import { SentimentService } from '../services/sentiment/sentiment.service';
import { SlackService } from '../services/slack/slack.service';
import { WebService } from '../services/web/web.service';
import { CounterMuzzle } from '../shared/models/counter/counter-models';
import { EventRequest } from '../shared/models/slack/slack-models';
import { SuppressorService } from '../shared/services/suppressor.service';

export const eventController: Router = express.Router();

const muzzleService = new MuzzleService();
const backfireService = new BackfireService();
const counterService = new CounterService();
const reactionService = new ReactionService();
const webService = WebService.getInstance();
const slackService = SlackService.getInstance();
const suppressorService = new SuppressorService();
const sentimentService = new SentimentService();
const muzzlePersistenceService = MuzzlePersistenceService.getInstance();
const backfirePersistenceService = BackFirePersistenceService.getInstance();
const counterPersistenceService = CounterPersistenceService.getInstance();
const activityPersistenceService = ActivityPersistenceService.getInstance();

async function handleMuzzledMessage(request: EventRequest): Promise<void> {
  const containsTag = slackService.containsTag(request.event.text);
  const userName = await slackService.getUserNameById(request.event.user, request.team_id);

  if (!containsTag) {
    console.log(`${userName} | ${request.event.user} is muzzled! Suppressing his voice...`);
    webService.deleteMessage(request.event.channel, request.event.ts, request.event.user);
    muzzleService.sendMuzzledMessage(
      request.event.channel,
      request.event.user,
      request.team_id,
      request.event.text,
      request.event.ts,
    );
  } else if (containsTag && (!request.event.subtype || request.event.subtype === 'channel_topic')) {
    const muzzleId: string | null = await muzzlePersistenceService.getMuzzle(request.event.user, request.team_id);
    if (muzzleId) {
      console.log(
        `${userName} attempted to tag someone or change the channel topic. Muzzle increased by ${ABUSE_PENALTY_TIME}!`,
      );
      muzzlePersistenceService.addMuzzleTime(request.event.user, request.team_id, ABUSE_PENALTY_TIME);
      webService.deleteMessage(request.event.channel, request.event.ts, request.event.user);
      muzzlePersistenceService.trackDeletedMessage(+muzzleId, request.event.text);
      webService
        .sendMessage(
          request.event.channel,
          `:rotating_light: <@${
            request.event.user
          }> attempted to @ while muzzled or change the channel topic! Muzzle increased by ${getTimeString(
            ABUSE_PENALTY_TIME,
          )} :rotating_light:`,
        )
        .catch(e => console.error(e));
    }
  }
}

async function handleBackfire(request: EventRequest): Promise<void> {
  const containsTag = slackService.containsTag(request.event.text);
  const userName = await slackService.getUserNameById(request.event.user, request.team_id);
  if (!containsTag) {
    console.log(`${userName} | ${request.event.user} is backfired! Suppressing his voice...`);
    webService.deleteMessage(request.event.channel, request.event.ts, request.event.user);
    backfireService.sendBackfiredMessage(
      request.event.channel,
      request.event.user,
      request.event.text,
      request.event.ts,
      request.team_id,
    );
  } else if (containsTag && (!request.event.subtype || request.event.subtype === 'channel_topic')) {
    const backfireId = backfireService.getBackfire(request.event.user, request.team_id);
    console.log(`${userName} attempted to tag someone. Backfire increased by ${ABUSE_PENALTY_TIME}!`);
    backfireService.addBackfireTime(request.event.user, request.team_id, ABUSE_PENALTY_TIME);
    webService.deleteMessage(request.event.channel, request.event.ts, request.event.user);
    backfireService.trackDeletedMessage(+backfireId, request.event.text);
    webService
      .sendMessage(
        request.event.channel,
        `:rotating_light: <@${request.event.user}> attempted to @ while muzzled! Muzzle increased by ${getTimeString(
          ABUSE_PENALTY_TIME,
        )} :rotating_light:`,
      )
      .catch(e => console.error(e));
  }
}

async function handleCounterMuzzle(request: EventRequest): Promise<void> {
  const containsTag = slackService.containsTag(request.event.text);
  const userName = await slackService.getUserNameById(request.event.user, request.team_id);
  if (!containsTag) {
    console.log(`${userName} | ${request.event.user} is counter-muzzled! Suppressing his voice...`);
    counterService.sendCounterMuzzledMessage(
      request.event.channel,
      request.event.user,
      request.event.text,
      request.event.ts,
    );
  } else if (containsTag && (!request.event.subtype || request.event.subtype === 'channel_topic')) {
    console.log(`${userName} attempted to tag someone. Counter Muzzle increased by ${ABUSE_PENALTY_TIME}!`);
    counterPersistenceService.addCounterMuzzleTime(request.event.user, ABUSE_PENALTY_TIME);
    webService.deleteMessage(request.event.channel, request.event.ts, request.event.user);
    webService
      .sendMessage(
        request.event.channel,
        `:rotating_light: <@${request.event.user}> attempted to @ while countered! Muzzle increased by ${getTimeString(
          ABUSE_PENALTY_TIME,
        )} :rotating_light:`,
      )
      .catch(e => console.error(e));
  }
}

async function handleBotMessage(request: EventRequest, botUserToMuzzle: string): Promise<void> {
  console.log(`A user is muzzled and tried to send a bot message! Suppressing...`);
  webService.deleteMessage(request.event.channel, request.event.ts, request.event.user);
  const muzzleId: string | null = await muzzlePersistenceService.getMuzzle(botUserToMuzzle, request.team_id);
  if (muzzleId) {
    muzzlePersistenceService.trackDeletedMessage(+muzzleId, 'A bot message');
    return;
  }

  const backfireId: string | null = await backfirePersistenceService.getBackfireByUserId(
    botUserToMuzzle,
    request.team_id,
  );
  if (backfireId) {
    backfirePersistenceService.trackDeletedMessage(+backfireId, 'A bot user message');
    return;
  }

  const counter: CounterMuzzle | undefined = await counterPersistenceService.getCounterMuzzle(botUserToMuzzle);
  console.log(counter);
  if (counter && counter.counterId) {
    counterPersistenceService.incrementMessageSuppressions(+counter.counterId);
    return;
  }
}

function deleteMessage(request: EventRequest): void {
  console.log('Someone talked in #hot who was not a bot. Suppressing...');
  webService.deleteMessage(request.event.channel, request.event.ts, request.event.user);
}

function handleReaction(request: EventRequest): void {
  reactionService.handleReaction(request.event, request.event.type === 'reaction_added', request.team_id);
}

function handleNewUserAdd(): void {
  slackService.getAllUsers();
}

function handleNewChannelCreated(): void {
  slackService.getAndSaveAllChannels();
}

function handleActivity(request: EventRequest): void {
  activityPersistenceService.logActivity(request);
  activityPersistenceService.updateLatestHotness();
}

function logSentiment(request: EventRequest): void {
  sentimentService.performSentimentAnalysis(
    request.event.user,
    request.team_id,
    request.event.channel,
    request.event.text,
  );
}

// Change route to /event/handle instead.
eventController.post('/muzzle/handle', async (req: Request, res: Response) => {
  if (req.body.challenge) {
    res.send({ challenge: req.body.challenge });
  } else {
    console.time('respond-to-event');
    res.status(200).send();
    const request: EventRequest = req.body;
    console.log(request);
    // console.log(request);
    const isNewUserAdded = request.event.type === 'team_join';
    const isNewChannelCreated = request.event.type === 'channel_created';
    const isReaction = request.event.type === 'reaction_added' || request.event.type === 'reaction_removed';
    const isMuzzled = await muzzlePersistenceService.isUserMuzzled(request.event.user, request.team_id);
    const isUserBackfired = await backfirePersistenceService.isBackfire(request.event.user, request.team_id);
    const isUserCounterMuzzled = await counterPersistenceService.isCounterMuzzled(request.event.user);
    const isMuzzleBot = request.event.user === 'ULG8SJRFF';
    const isInHotAndNotBot = !isMuzzleBot && request.event.channel === 'C027YMYC5CJ';
    const botUserToMuzzle = await suppressorService.shouldBotMessageBeMuzzled(request);
    if (isNewUserAdded) {
      handleNewUserAdd();
    } else if (isNewChannelCreated) {
      handleNewChannelCreated();
    } else if (isMuzzled && !isReaction) {
      handleMuzzledMessage(request);
    } else if (isUserBackfired && !isReaction) {
      handleBackfire(request);
    } else if (isUserCounterMuzzled && !isReaction) {
      handleCounterMuzzle(request);
    } else if (botUserToMuzzle && !isReaction) {
      handleBotMessage(request, botUserToMuzzle);
    } else if (isReaction) {
      handleReaction(request);
    } else if (isInHotAndNotBot) {
      deleteMessage(request);
    } else if (!isReaction && !isNewChannelCreated && !isNewUserAdded) {
      logSentiment(request);
    }
    handleActivity(request);
    console.timeEnd('respond-to-event');
  }
});
