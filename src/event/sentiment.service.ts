import Sentiment, { AnalysisOptions, AnalysisResult } from 'sentiment';
import { getRepository, InsertResult } from 'typeorm';
import { Sentiment as SentimentDB } from '../shared/db/models/Sentiment';

export class SentimentService {
  sentiment = new Sentiment();

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
