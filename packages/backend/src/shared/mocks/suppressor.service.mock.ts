import { vi } from 'vitest';
import { MockAIService } from './ai.service.mock';
import { MockBackFirePersistenceService } from './backfire.persistence.service.mock';
import { MockCounterPersistenceService } from './counter.persistence.service.mock';
import { MuzzlePersistenceServiceMock } from './muzzle.persistence.service.mock';
import { MockSlackService } from './slack.service.mock';
import { MockTranslationService } from './translation.service.mock';
import { MockWebService } from './web.service.mock';

export const mockSuppressorService = {
  SuppressorService: vi.fn().mockImplementation(() => ({
    webService: MockWebService,
    slackService: MockSlackService,
    translationService: MockTranslationService,
    backfirePersistenceService: MockBackFirePersistenceService,
    muzzlePersistenceService: MuzzlePersistenceServiceMock,
    counterPersistenceService: MockCounterPersistenceService,
    aiService: MockAIService,
    isBot: vi.fn(),
    findUserIdInBlocks: vi.fn(),
    findUserInBlocks: vi.fn(),
    isSuppressed: vi.fn(),
    removeSuppression: vi.fn(),
    shouldBotMessageBeMuzzled: vi.fn(),
    getFallbackReplacementWord: vi.fn(),
    logTranslateSuppression: vi.fn(),
    sendSuppressedMessage: vi.fn(),
    sendFallbackSuppressedMessage: vi.fn(),
    shouldBackfire: vi.fn(),
    handleBotMessage: vi.fn(),
  })),
};
