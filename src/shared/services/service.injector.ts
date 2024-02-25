import OpenAI from 'openai';
import { ActivityPersistenceService } from '../../services/activity/activity.persistence';
import { AIPersistenceService } from '../../services/ai/ai.persistence';
import { AIService } from '../../services/ai/ai.service';
import { BackfireService } from '../../services/backfire/backfire.service';
import { ClapService } from '../../services/clap/clap.service';
import { ConfessionService } from '../../services/confession/confession.service';
import { CounterPersistenceService } from '../../services/counter/counter.persistence.service';
import { CounterService } from '../../services/counter/counter.service';
import { DefineService } from '../../services/define/define.service';
import { HistoryPersistenceService } from '../../services/history/history.persistence.service';
import { ItemService } from '../../services/item/item.service';
import { ListPersistenceService } from '../../services/list/list.persistence.service';
import { ListService } from '../../services/list/list.service';
import { MockService } from '../../services/mock/mock.service';
import { MuzzlePersistenceService } from '../../services/muzzle/muzzle.persistence.service';
import { MuzzleReportService } from '../../services/muzzle/muzzle.report.service';
import { MuzzleService } from '../../services/muzzle/muzzle.service';
import { QuoteService } from '../../services/quote/quote.service';
import { ReactionPersistenceService } from '../../services/reaction/reaction.persistence.service';
import { ReactionService } from '../../services/reaction/reaction.service';
import { SentimentService } from '../../services/sentiment/sentiment.service';
import { SlackPersistenceService } from '../../services/slack/slack.persistence.service';
import { SlackService } from '../../services/slack/slack.service';
import { StorePersistenceService } from '../../services/store/store.persistence.service';
import { StoreService } from '../../services/store/store.service';
import { WalkieService } from '../../services/walkie/walkie.service';
import { WebService } from '../../services/web/web.service';
import { RedisPersistenceService } from './redis.persistence.service';
import { ReportService } from './report.service';
import { SuppressorService } from './suppressor.service';
import { TranslationService } from './translation.service';
import { BackfirePersistenceService } from '../../services/backfire/backfire.persistence.service';
import { ReactionReportService } from '../../services/reaction/reaction.report.service';
import { DBClient } from '../db/DBClient';

type ServiceInjection = {
  ActivityPersistenceService: ActivityPersistenceService;
  AIPersistenceService: AIPersistenceService;
  AIService: AIService;
  BackfirePersistenceService: BackfirePersistenceService;
  BackfireService: BackfireService;
  ClapService: ClapService;
  ConfessionService: ConfessionService;
  CounterPersistenceService: CounterPersistenceService;
  CounterService: CounterService;
  DefineService: DefineService;
  HistoryPersistenceService: HistoryPersistenceService;
  ItemService: ItemService;
  ListPersistenceService: ListPersistenceService;
  ListService: ListService;
  MockService: MockService;
  MuzzlePersistenceService: MuzzlePersistenceService;
  MuzzleReportService: MuzzleReportService;
  MuzzleService: MuzzleService;
  QuoteService: QuoteService;
  ReactionPersistenceService: ReactionPersistenceService;
  ReactionReportService: ReactionReportService;
  ReactionService: ReactionService;
  RedisPersistenceService: RedisPersistenceService;
  ReportService: ReportService;
  SentimentService: SentimentService;
  SlackPersistenceService: SlackPersistenceService;
  SlackService: SlackService;
  StorePersistenceService: StorePersistenceService;
  StoreService: StoreService;
  SuppressorService: SuppressorService;
  TranslationService: TranslationService;
  WalkieService: WalkieService;
  WebService: WebService;
};

const services = {} as ServiceInjection;

const serviceCreator = {
  ActivityPersistenceService: () => {
    return new ActivityPersistenceService(DBClient);
  },
  AIPersistenceService: () => {
    const redis = getService('RedisPersistenceService');
    return new AIPersistenceService(redis);
  },
  AIService: () => {
    const aiPersistence = getService('AIPersistenceService');
    return new AIService(aiPersistence, new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
  },
  BackfirePersistenceService: () => {
    const redis = getService('RedisPersistenceService');
    return new BackfirePersistenceService(redis, DBClient);
  },
  BackfireService: () => {
    const webService = getService('WebService');
    const slackService = getService('SlackService');
    const translationService = getService('TranslationService');
    const backfirePersistenceService = getService('BackfirePersistenceService');
    const muzzlePersistenceService = getService('MuzzlePersistenceService');
    const counterPersistenceService = getService('CounterPersistenceService');
    return new BackfireService(
      webService,
      slackService,
      translationService,
      backfirePersistenceService,
      muzzlePersistenceService,
      counterPersistenceService,
    );
  },
  ClapService: () => {
    return new ClapService();
  },
  ConfessionService: () => {
    const webService = getService('WebService');
    const slackService = getService('SlackService');
    return new ConfessionService(webService, slackService);
  },
  CounterPersistenceService: () => {
    const webService = getService('WebService');
    const muzzlePersistenceService = getService('MuzzlePersistenceService');
    return new CounterPersistenceService(webService, muzzlePersistenceService, DBClient);
  },
  CounterService: () => {
    const webService = getService('WebService');
    const slackService = getService('SlackService');
    const translationService = getService('TranslationService');
    const backfirePersistenceService = getService('BackfirePersistenceService');
    const muzzlePersistenceService = getService('MuzzlePersistenceService');
    const counterPersistenceService = getService('CounterPersistenceService');
    return new CounterService(
      webService,
      slackService,
      translationService,
      backfirePersistenceService,
      muzzlePersistenceService,
      counterPersistenceService,
    );
  },
  DefineService: () => {
    return new DefineService();
  },
  HistoryPersistenceService: () => {
    return new HistoryPersistenceService(DBClient);
  },
  ItemService: () => {
    const webService = getService('WebService');
    const suppressorService = getService('SuppressorService');
    const storeService = getService('StoreService');
    return new ItemService(webService, suppressorService, storeService);
  },
  ListPersistenceService: () => {
    return new ListPersistenceService(DBClient);
  },
  ListService: () => {
    const slackService = getService('SlackService');
    return new ListService(slackService);
  },
  MockService: () => {
    return new MockService();
  },
  MuzzlePersistenceService: () => {
    const redis = getService('RedisPersistenceService');
    const storePersistenceService = getService('StorePersistenceService');
    return new MuzzlePersistenceService(redis, storePersistenceService, DBClient);
  },
  MuzzleReportService: () => {
    const slackService = getService('SlackService');
    return new MuzzleReportService(slackService);
  },
  MuzzleService: () => {
    const webService = getService('WebService');
    const slackService = getService('SlackService');
    const translationService = getService('TranslationService');
    const backfirePersistenceService = getService('BackfirePersistenceService');
    const muzzlePersistenceService = getService('MuzzlePersistenceService');
    const counterPersistenceService = getService('CounterPersistenceService');
    const counterService = getService('CounterService');
    const storePersistenceService = getService('StorePersistenceService');
    return new MuzzleService(
      webService,
      slackService,
      translationService,
      backfirePersistenceService,
      muzzlePersistenceService,
      counterPersistenceService,
      counterService,
      storePersistenceService,
    );
  },
  QuoteService: () => {
    return new QuoteService();
  },
  ReactionPersistenceService: () => {
    return new ReactionPersistenceService(DBClient);
  },
  ReactionReportService: () => {
    const reactionPersistenceService = getService('ReactionPersistenceService');
    const slackService = getService('SlackService');
    return new ReactionReportService(reactionPersistenceService, slackService);
  },
  ReactionService: () => {
    const reactionPersistenceService = getService('ReactionPersistenceService');
    return new ReactionService(reactionPersistenceService);
  },
  RedisPersistenceService: () => {
    return new RedisPersistenceService();
  },
  ReportService: () => {
    const slackService = getService('SlackService');
    return new ReportService(slackService);
  },
  SentimentService: () => {
    return new SentimentService();
  },
  SlackPersistenceService: () => {
    const redis = getService('RedisPersistenceService');
    return new SlackPersistenceService(redis, DBClient);
  },
  SlackService: () => {
    const webService = getService('WebService');
    const slackPersistenceService = getService('SlackPersistenceService');
    return new SlackService(webService, slackPersistenceService);
  },
  StorePersistenceService: () => {
    const redis = getService('RedisPersistenceService');
    return new StorePersistenceService(redis, DBClient);
  },
  StoreService: () => {
    const storePersistenceService = getService('StorePersistenceService');
    const reactionPersistenceService = getService('ReactionPersistenceService');
    return new StoreService(storePersistenceService, reactionPersistenceService);
  },
  SuppressorService: () => {
    const webService = getService('WebService');
    const slackService = getService('SlackService');
    const translationService = getService('TranslationService');
    const muzzlePersistenceService = getService('MuzzlePersistenceService');
    const counterPersistenceService = getService('CounterPersistenceService');
    const backfirePersistenceService = getService('BackfirePersistenceService');

    return new SuppressorService(
      webService,
      slackService,
      translationService,
      backfirePersistenceService,
      muzzlePersistenceService,
      counterPersistenceService,
    );
  },
  TranslationService: () => {
    return new TranslationService();
  },
  WalkieService: () => {
    return new WalkieService();
  },
  WebService: () => {
    return new WebService();
  },
};

export const getService = <T extends keyof ServiceInjection>(service: T): ServiceInjection[T] => {
  if (!services[service]) {
    services[service] = serviceCreator[service]() as ServiceInjection[T];
    return services[service];
  }
  return services[service];
};
