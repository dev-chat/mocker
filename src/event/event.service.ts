import { AIService } from '../ai/ai.service';
import { BackfireService } from '../backfire/backfire.service';
import { CounterService } from '../counter/counter.service';
import { MuzzleService } from '../muzzle/muzzle.service';
import { ReactionService } from '../reaction/reaction.service';
import { logger } from '../shared/logger/logger';
import { EventRequest } from '../shared/models/slack/slack-models';
import { HistoryPersistenceService } from '../shared/services/history.persistence.service';
import { SlackService } from '../shared/services/slack/slack.service';
import { SuppressorService } from '../shared/services/suppressor.service';
import { EventPersistenceService } from './event.persistence.service';

export class EventService {
  eventPersistenceService = new EventPersistenceService();
  historyPersistenceService = new HistoryPersistenceService();
  slackService = new SlackService();
  muzzleService = new MuzzleService();
  backfireService = new BackfireService();
  reactionService = new ReactionService();
  counterService = new CounterService();
  aiService = new AIService();
  suppressorService = new SuppressorService();
  logger = logger.child({ module: 'EventService' });

  handleEvent(request: EventRequest) {
    const isMessage =
      request.event.type === 'message' ||
      request.event.type === 'message.channels' ||
      request.event.type === 'message.app_home';
    const isAnyEventOtherThanUserProfileChanged = request.event.type !== 'user_profile_changed';
    if (isMessage) {
      this.eventPersistenceService.performSentimentAnalysis(
        request.event.user,
        request.team_id,
        request.event.channel,
        request.event.text,
      );
      this.historyPersistenceService.logHistory(request);
    } else if (isAnyEventOtherThanUserProfileChanged) {
      this.eventPersistenceService.logActivity(request);
    }
  }

  handle(request: EventRequest) {
    this.logger.info('Handling event:', request);
    const handlers = [
      this.handleEvent(request),
      this.slackService.handle(request),
      this.muzzleService.handle(request),
      this.backfireService.handle(request),
      this.counterService.handle(request),
      this.reactionService.handle(request),
      this.suppressorService.handleBotMessage(request),
      this.aiService.handle(request),
    ];
    return Promise.all(handlers).catch((error) => {
      this.logger.error('Error handling event:', error);
      throw error;
    });
  }
}
