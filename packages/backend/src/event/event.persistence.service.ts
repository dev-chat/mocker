import type { InsertResult } from 'typeorm';
import { getRepository } from 'typeorm';
import { Activity } from '../shared/db/models/Activity';
import { SlackUser } from '../shared/db/models/SlackUser';
import type { EventRequest } from '../shared/models/slack/slack-models';
import type { AnalysisOptions, AnalysisResult } from 'sentiment';
import Sentiment from 'sentiment';
import { Sentiment as SentimentDB } from '../shared/db/models/Sentiment';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';

export class EventPersistenceService {
  sentiment = new Sentiment();
  logger = logger.child({ module: 'EventPersistenceService' });

  async logActivity(request: EventRequest) {
    // This is a bandaid to stop workflows from breaking the service.
    if (typeof request.event.user !== 'string' || request.event.type === 'user_profile_changed') {
      return;
    }

    const user: SlackUser | null = await getRepository(SlackUser).findOne({
      where: {
        slackId: request.event.user,
        teamId: request.team_id,
      },
    });
    if (!user) {
      return;
    }
    const activity = new Activity();
    activity.channel = request.event.channel || request.event.item.channel;
    activity.channelType = request.event.channel_type;
    activity.teamId = request.team_id;
    activity.userId = user;
    activity.eventType = request.event.type;
    void getRepository(Activity)
      .insert(activity)
      .catch((e) => {
        logError(this.logger, 'Failed to persist Slack activity event', e, {
          eventType: request.event.type,
          teamId: request.team_id,
          userId: request.event.user,
          channelId: activity.channel,
        });
      });
  }

  public performSentimentAnalysis(userId: string, teamId: string, channelId: string, text: string): void {
    void this.analyzeSentimentAndStore(userId, teamId, channelId, text);
  }

  private async analyzeSentimentAndStore(
    userId: string,
    teamId: string,
    channelId: string,
    text: string,
  ): Promise<InsertResult> {
    const options: AnalysisOptions = {
      extras: {
        wtf: 0,
        WTF: 0,
      },
    };
    const emotionalScore: AnalysisResult = this.sentiment.analyze(text, options);
    const sentimentModel = new SentimentDB();
    sentimentModel.sentiment = emotionalScore.comparative;
    sentimentModel.teamId = teamId;
    sentimentModel.userId = userId;
    sentimentModel.channelId = channelId;
    return getRepository(SentimentDB)
      .insert(sentimentModel)
      .catch((e) => {
        logError(this.logger, 'Failed to persist sentiment analysis', e, {
          userId,
          teamId,
          channelId,
        });
        throw e;
      });
  }
}
