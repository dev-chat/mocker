import express, { Request, Response, Router } from 'express';
import { BackFirePersistenceService } from '../services/backfire/backfire.persistence.service';
import { BackfireService } from '../services/backfire/backfire.service';
import { CounterPersistenceService } from '../services/counter/counter.persistence.service';
import { CounterService } from '../services/counter/counter.service';
import { ABUSE_PENALTY_TIME } from '../services/muzzle/constants';
import { getTimeString } from '../services/muzzle/muzzle-utilities';
import { MuzzlePersistenceService } from '../services/muzzle/muzzle.persistence.service';
import { MuzzleService } from '../services/muzzle/muzzle.service';
import { ReactionService } from '../services/reaction/reaction.service';
import { SlackService } from '../services/slack/slack.service';
import { WebService } from '../services/web/web.service';
import { EventRequest } from '../shared/models/slack/slack-models';

export const eventController: Router = express.Router();

const muzzleService = new MuzzleService();
const backfireService = new BackfireService();
const counterService = new CounterService();
const reactionService = new ReactionService();
const webService = WebService.getInstance();
const slackService = SlackService.getInstance();
const muzzlePersistenceService = MuzzlePersistenceService.getInstance();
const backfirePersistenceService = BackFirePersistenceService.getInstance();
const counterPersistenceService = CounterPersistenceService.getInstance();

function handleMuzzledMessage(request: EventRequest): void {
  const containsTag = slackService.containsTag(request.event.text);
  const userName = slackService.getUserName(request.event.user);

  if (!containsTag) {
    console.log(`${userName} | ${request.event.user} is muzzled! Suppressing his voice...`);
    muzzleService.sendMuzzledMessage(request.event.channel, request.event.user, request.event.text, request.event.ts);
  } else if (containsTag && (!request.event.subtype || request.event.subtype === 'channel_topic')) {
    const muzzleId = muzzlePersistenceService.getMuzzleId(request.event.user);
    console.log(
      `${slackService.getUserName(
        request.event.user,
      )} attempted to tag someone or change the channel topic. Muzzle increased by ${ABUSE_PENALTY_TIME}!`,
    );
    muzzlePersistenceService.addMuzzleTime(request.event.user, ABUSE_PENALTY_TIME);
    webService.deleteMessage(request.event.channel, request.event.ts);
    muzzlePersistenceService.trackDeletedMessage(muzzleId, request.event.text);
    webService.sendMessage(
      request.event.channel,
      `:rotating_light: <@${
        request.event.user
      }> attempted to @ while muzzled or change the channel topic! Muzzle increased by ${getTimeString(
        ABUSE_PENALTY_TIME,
      )} :rotating_light:`,
    );
  }
}

function handleBackfire(request: EventRequest): void {
  const containsTag = slackService.containsTag(request.event.text);
  const userName = slackService.getUserName(request.event.user);
  if (!containsTag) {
    console.log(`${userName} | ${request.event.user} is backfired! Suppressing his voice...`);
    backfireService.sendBackfiredMessage(
      request.event.channel,
      request.event.user,
      request.event.text,
      request.event.ts,
    );
  } else if (containsTag && (!request.event.subtype || request.event.subtype === 'channel_topic')) {
    const backfireId = backfireService.getBackfire(request.event.user)!.id;
    console.log(
      `${slackService.getUserName(
        request.event.user,
      )} attempted to tag someone. Backfire increased by ${ABUSE_PENALTY_TIME}!`,
    );
    backfireService.addBackfireTime(request.event.user, ABUSE_PENALTY_TIME);
    webService.deleteMessage(request.event.channel, request.event.ts);
    backfireService.trackDeletedMessage(backfireId, request.event.text);
    webService.sendMessage(
      request.event.channel,
      `:rotating_light: <@${request.event.user}> attempted to @ while muzzled! Muzzle increased by ${getTimeString(
        ABUSE_PENALTY_TIME,
      )} :rotating_light:`,
    );
  }
}

function handleCounterMuzzle(request: EventRequest): void {
  const containsTag = slackService.containsTag(request.event.text);
  const userName = slackService.getUserName(request.event.user);
  if (!containsTag) {
    console.log(`${userName} | ${request.event.user} is counter-muzzled! Suppressing his voice...`);
    counterService.sendCounterMuzzledMessage(
      request.event.channel,
      request.event.user,
      request.event.text,
      request.event.ts,
    );
  } else if (containsTag && (!request.event.subtype || request.event.subtype === 'channel_topic')) {
    console.log(
      `${slackService.getUserName(
        request.event.user,
      )} attempted to tag someone. Counter Muzzle increased by ${ABUSE_PENALTY_TIME}!`,
    );
    console.log(request.event);
    counterPersistenceService.addCounterMuzzleTime(request.event.user, ABUSE_PENALTY_TIME);
    webService.deleteMessage(request.event.channel, request.event.ts);
    webService.sendMessage(
      request.event.channel,
      `:rotating_light: <@${request.event.user}> attempted to @ while countered! Muzzle increased by ${getTimeString(
        ABUSE_PENALTY_TIME,
      )} :rotating_light:`,
    );
  }
}

function handleBotMessage(request: EventRequest): void {
  console.log(`A user is muzzled and tried to send a bot message! Suppressing...`);
  webService.deleteMessage(request.event.channel, request.event.ts);
}

function handleReaction(request: EventRequest): void {
  reactionService.handleReaction(request.event, request.event.type === 'reaction_added');
}

function handleNewUserAdd(): void {
  slackService.getAllUsers();
}
// Change route to /event/handle instead.
eventController.post('/muzzle/handle', (req: Request, res: Response) => {
  const request: EventRequest = req.body;
  const isNewUserAdded = request.event.type === 'team_join';
  const isReaction = request.event.type === 'reaction_added' || request.event.type === 'reaction_removed';
  const isMuzzled = muzzlePersistenceService.isUserMuzzled(request.event.user);
  const isUserBackfired = backfirePersistenceService.isBackfire(request.event.user);
  const isUserCounterMuzzled = counterPersistenceService.isCounterMuzzled(request.event.user);

  console.time('respond-to-event');
  if (isNewUserAdded) {
    handleNewUserAdd();
  } else if (isMuzzled && !isReaction) {
    handleMuzzledMessage(request);
  } else if (isUserBackfired && !isReaction) {
    handleBackfire(request);
  } else if (isUserCounterMuzzled && !isReaction) {
    handleCounterMuzzle(request);
  } else if (
    (muzzleService.shouldBotMessageBeMuzzled(request) ||
      backfireService.shouldBotMessageBeMuzzled(request) ||
      counterService.shouldBotMessageBeMuzzled(request)) &&
    !isReaction
  ) {
    handleBotMessage(request);
  } else if (isReaction) {
    handleReaction(request);
  }
  console.timeEnd('respond-to-event');
  res.send({ challenge: request.challenge });
});
