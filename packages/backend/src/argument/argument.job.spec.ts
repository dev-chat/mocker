import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRepository } from 'typeorm';
import { ArgumentJob } from './argument.job';

describe('ArgumentJob', () => {
  let job: ArgumentJob;
  let argumentPersistenceService: {
    saveArgumentOutcome: ReturnType<typeof vi.fn>;
  };
  let redis: {
    getValue: ReturnType<typeof vi.fn>;
    setValueWithExpire: ReturnType<typeof vi.fn>;
  };
  let jobLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
  let historyService: {
    getLast24HoursForChannel: ReturnType<typeof vi.fn>;
  };
  let findUsers: ReturnType<typeof vi.fn>;
  let aiService: {
    formatHistory: ReturnType<typeof vi.fn>;
    openAi: {
      responses: {
        create: ReturnType<typeof vi.fn>;
      };
    };
  };

  beforeEach(() => {
    job = new ArgumentJob({ formatHistory: vi.fn() } as never);
    argumentPersistenceService = {
      saveArgumentOutcome: vi.fn().mockResolvedValue(null),
    };
    redis = {
      getValue: vi.fn().mockResolvedValue(null),
      setValueWithExpire: vi.fn().mockResolvedValue('OK'),
    };
    jobLogger = {
      info: vi.fn(),
      warn: vi.fn(),
    };
    historyService = {
      getLast24HoursForChannel: vi.fn(),
    };
    findUsers = vi.fn();
    aiService = {
      formatHistory: vi.fn().mockReturnValue('formatted history'),
      openAi: {
        responses: {
          create: vi.fn(),
        },
      },
    };

    (job as never as { argumentPersistenceService: unknown }).argumentPersistenceService = argumentPersistenceService;
    (job as never as { historyService: unknown }).historyService = historyService;
    (job as never as { redis: unknown }).redis = redis;
    (job as never as { jobLogger: unknown }).jobLogger = jobLogger;
    (job as never as { aiService: unknown }).aiService = aiService;
    (getRepository as Mock).mockReturnValue({ find: findUsers });
  });

  it('returns early when extraction lock exists', async () => {
    redis.getValue.mockResolvedValue('1');

    await (
      job as never as {
        extractArgument: (
          teamId: string,
          channelId: string,
          historyMessages: Array<{ message: string }>,
        ) => Promise<void>;
      }
    ).extractArgument('T1', 'C1', [{ message: 'history' }]);

    expect(jobLogger.info).toHaveBeenCalled();
    expect(aiService.openAi.responses.create).not.toHaveBeenCalled();
  });

  it('does nothing when extractor returns an empty array', async () => {
    aiService.openAi.responses.create.mockResolvedValue({
      output: [{ type: 'message', content: [{ type: 'output_text', text: '[]' }] }],
    });

    await (
      job as never as {
        extractArgument: (
          teamId: string,
          channelId: string,
          historyMessages: Array<{ message: string }>,
        ) => Promise<void>;
      }
    ).extractArgument('T1', 'C1', [{ message: 'history' }]);

    expect(argumentPersistenceService.saveArgumentOutcome).not.toHaveBeenCalled();
  });

  it('saves each valid extracted argument outcome', async () => {
    aiService.openAi.responses.create.mockResolvedValue({
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: JSON.stringify([
                {
                  summary: 'tabs vs spaces',
                  participants: [
                    { slackId: 'U1', name: 'Alice', viewpoint: 'tabs are faster' },
                    { slackId: 'U2', name: 'Bob', viewpoint: 'spaces are clearer' },
                  ],
                  winnerSlackId: 'U2',
                  pointValue: 4,
                },
                {
                  summary: 'vim vs emacs',
                  participants: [
                    { slackId: 'U3', name: 'Carol', viewpoint: 'vim is faster' },
                    { slackId: 'U4', name: 'Dan', viewpoint: 'emacs is more powerful' },
                  ],
                  winnerSlackId: 'U3',
                  pointValue: 3,
                },
              ]),
            },
          ],
        },
      ],
    });
    argumentPersistenceService.saveArgumentOutcome
      .mockResolvedValueOnce({
        id: 1,
        argument: 'tabs vs spaces',
        participants: [],
        winner: { name: 'Bob', slackId: 'U2' },
        pointValue: 4,
        createdAt: '2026-05-21T00:00:00.000Z',
      })
      .mockResolvedValueOnce({
        id: 2,
        argument: 'vim vs emacs',
        participants: [],
        winner: { name: 'Carol', slackId: 'U3' },
        pointValue: 3,
        createdAt: '2026-05-21T00:10:00.000Z',
      });

    await (
      job as never as {
        extractArgument: (
          teamId: string,
          channelId: string,
          historyMessages: Array<{ message: string; slackId: string; name: string }>,
        ) => Promise<void>;
      }
    ).extractArgument('T1', 'C1', [{ slackId: 'U1', name: 'Alice', message: 'history' }]);

    expect(argumentPersistenceService.saveArgumentOutcome).toHaveBeenNthCalledWith(1, {
      teamId: 'T1',
      channelId: 'C1',
      argumentSummary: 'tabs vs spaces',
      participants: [
        { slackId: 'U1', name: 'Alice', viewpoint: 'tabs are faster' },
        { slackId: 'U2', name: 'Bob', viewpoint: 'spaces are clearer' },
      ],
      winnerSlackId: 'U2',
      pointValue: 4,
    });
    expect(argumentPersistenceService.saveArgumentOutcome).toHaveBeenNthCalledWith(2, {
      teamId: 'T1',
      channelId: 'C1',
      argumentSummary: 'vim vs emacs',
      participants: [
        { slackId: 'U3', name: 'Carol', viewpoint: 'vim is faster' },
        { slackId: 'U4', name: 'Dan', viewpoint: 'emacs is more powerful' },
      ],
      winnerSlackId: 'U3',
      pointValue: 3,
    });
    expect(jobLogger.info).toHaveBeenCalledWith('Argument extracted for C1: "tabs vs spaces"');
    expect(jobLogger.info).toHaveBeenCalledWith('Argument extracted for C1: "vim vs emacs"');
  });

  it('skips extraction when fewer than two known human participants remain after filtering bots', async () => {
    historyService.getLast24HoursForChannel.mockResolvedValue([
      { slackId: 'U1', name: 'Alice', message: 'hello' },
      { slackId: 'B1', name: 'Build Bot', message: 'beep boop' },
    ]);
    findUsers.mockResolvedValue([{ slackId: 'U1', name: 'Alice', isBot: false }]);

    await (
      job as never as { extractArgumentForChannel: (teamId: string, channelId: string) => Promise<void> }
    ).extractArgumentForChannel('T1', 'C1');

    expect(findUsers).toHaveBeenCalledWith({
      where: [
        { slackId: 'U1', teamId: 'T1', isBot: false },
        { slackId: 'B1', teamId: 'T1', isBot: false },
      ],
    });
    expect(aiService.openAi.responses.create).not.toHaveBeenCalled();
  });

  it('continues extraction when at least two known human participants remain after filtering bots', async () => {
    historyService.getLast24HoursForChannel.mockResolvedValue([
      { slackId: 'U1', name: 'Alice', message: 'hello' },
      { slackId: 'B1', name: 'Build Bot', message: 'beep boop' },
      { slackId: 'U2', name: 'Bob', message: 'hi' },
    ]);
    findUsers.mockResolvedValue([
      { slackId: 'U1', name: 'Alice', isBot: false },
      { slackId: 'U2', name: 'Bob', isBot: false },
    ]);
    aiService.openAi.responses.create.mockResolvedValue({
      output: [{ type: 'message', content: [{ type: 'output_text', text: '[]' }] }],
    });

    await (
      job as never as { extractArgumentForChannel: (teamId: string, channelId: string) => Promise<void> }
    ).extractArgumentForChannel('T1', 'C1');

    expect(aiService.openAi.responses.create).toHaveBeenCalledOnce();
  });

  it('skips malformed extraction payloads and logs warnings', async () => {
    aiService.openAi.responses.create.mockResolvedValue({
      output: [{ type: 'message', content: [{ type: 'output_text', text: '{"summary":"oops"}' }] }],
    });

    await (
      job as never as {
        extractArgument: (
          teamId: string,
          channelId: string,
          historyMessages: Array<{ message: string }>,
        ) => Promise<void>;
      }
    ).extractArgument('T1', 'C1', [{ message: 'history' }]);

    expect(argumentPersistenceService.saveArgumentOutcome).not.toHaveBeenCalled();
    expect(jobLogger.warn).toHaveBeenCalled();
  });
});
