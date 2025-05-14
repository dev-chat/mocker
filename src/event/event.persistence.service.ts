import { getRepository, InsertResult } from 'typeorm';
import { Activity } from '../shared/db/models/Activity';
import { SlackUser } from '../shared/db/models/SlackUser';
import { EventRequest } from '../shared/models/slack/slack-models';
import Sentiment, { AnalysisOptions, AnalysisResult } from 'sentiment';
import { Sentiment as SentimentDB } from '../shared/db/models/Sentiment';

export class EventPersistenceService {
  sentiment = new Sentiment();

  async logActivity(request: EventRequest) {
    // This is a bandaid to stop workflows from breaking the service.
    if (typeof request.event.user !== 'string' || request.event.type === 'user_profile_changed') {
      return;
    }

    const user: SlackUser | null = await getRepository(SlackUser).findOne({
      where: {
        slackId: request?.event?.user,
        teamId: request?.team_id,
      },
    });
    const activity = new Activity();
    activity.channel = request.event.channel || request.event.item.channel;
    activity.channelType = request.event.channel_type;
    activity.teamId = request.team_id;
    activity.userId = user as SlackUser;
    activity.eventType = request.event.type;
    getRepository(Activity).insert(activity);
  }

  public performSentimentAnalysis(userId: string, teamId: string, channelId: string, text: string): void {
    this.analyzeSentimentAndStore(userId, teamId, channelId, text);
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
    return getRepository(SentimentDB).insert(sentimentModel);
  }
}
