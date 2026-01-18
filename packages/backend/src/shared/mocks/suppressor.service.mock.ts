import { MockAIService } from './ai.service.mock';
import { MockBackFirePersistenceService } from './backfire.persistence.service.mock';
import { MockCounterPersistenceService } from './counter.persistence.service.mock';
import { MuzzlePersistenceServiceMock } from './muzzle.persistence.service.mock';
import { MockSlackService } from './slack.service.mock';
import { MockTranslationService } from './translation.service.mock';
import { MockWebService } from './web.service.mock';

export const mockSuppressorService = {
  SuppressorService: jest.fn().mockImplementation(() => ({
    webService: MockWebService,
    slackService: MockSlackService,
    translationService: MockTranslationService,
    backfirePersistenceService: MockBackFirePersistenceService,
    muzzlePersistenceService: MuzzlePersistenceServiceMock,
    counterPersistenceService: MockCounterPersistenceService,
    aiService: MockAIService,
    isBot: jest.fn(),
    findUserIdInBlocks: jest.fn(),
    findUserInBlocks: jest.fn(),
    isSuppressed: jest.fn(),
    removeSuppression: jest.fn(),
    shouldBotMessageBeMuzzled: jest.fn(),
    getFallbackReplacementWord: jest.fn(),
    logTranslateSuppression: jest.fn(),
    sendSuppressedMessage: jest.fn(),
    sendFallbackSuppressedMessage: jest.fn(),
    shouldBackfire: jest.fn(),
    handleBotMessage: jest.fn(),
  })),
};
