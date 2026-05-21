import { vi } from 'vitest';
import { loggerMock } from './test/mocks/logger.mock';

const {
  memoryRunMock,
  argumentRunMock,
  traitRunMock,
  funFactRunMock,
  pricingRunMock,
  eventAlertRunMock,
  scheduleMock,
} = vi.hoisted(() => ({
  memoryRunMock: vi.fn(),
  argumentRunMock: vi.fn(),
  traitRunMock: vi.fn(),
  funFactRunMock: vi.fn(),
  pricingRunMock: vi.fn(),
  eventAlertRunMock: vi.fn(),
  scheduleMock: vi.fn(),
}));

vi.mock('node-cron', async () => ({
  default: {
    schedule: scheduleMock,
  },
}));

vi.mock('./ai/memory/memory.job', async () => ({
  MemoryJob: classMock(() => ({
    run: memoryRunMock,
  })),
}));

vi.mock('./argument/argument.job', async () => ({
  ArgumentJob: classMock(() => ({
    run: argumentRunMock,
  })),
}));

vi.mock('./trait/trait.job', async () => ({
  TraitJob: classMock(() => ({
    run: traitRunMock,
  })),
}));

vi.mock('./jobs/fun-fact.job', async () => ({
  FunFactJob: classMock(() => ({
    run: funFactRunMock,
  })),
}));

vi.mock('./jobs/pricing.job', async () => ({
  PricingJob: classMock(() => ({
    run: pricingRunMock,
  })),
}));

vi.mock('./jobs/event-alert.job', async () => ({
  EventAlertJob: classMock(() => ({
    run: eventAlertRunMock,
  })),
}));

import { JobService } from './job.service';

describe('JobService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memoryRunMock.mockResolvedValue(undefined);
    argumentRunMock.mockResolvedValue(undefined);
    traitRunMock.mockResolvedValue(undefined);
    funFactRunMock.mockResolvedValue(undefined);
    pricingRunMock.mockResolvedValue(undefined);
    eventAlertRunMock.mockResolvedValue(undefined);
  });

  it('runs nightly analysis jobs sequentially', async () => {
    const service = new JobService();

    await service.runNightlyAnalysisJobs();

    expect(memoryRunMock).toHaveBeenCalledOnce();
    expect(argumentRunMock).toHaveBeenCalledOnce();
    expect(traitRunMock).toHaveBeenCalledOnce();
  });

  it('throws when nightly analysis sequence fails', async () => {
    const service = new JobService();
    memoryRunMock.mockRejectedValueOnce(new Error('memory-fail'));

    await expect(service.runNightlyAnalysisJobs()).rejects.toThrow('memory-fail');
    expect(argumentRunMock).not.toHaveBeenCalled();
    expect(traitRunMock).not.toHaveBeenCalled();
  });

  it('does not run trait job when argument job fails', async () => {
    const service = new JobService();
    argumentRunMock.mockRejectedValueOnce(new Error('argument-fail'));

    await expect(service.runNightlyAnalysisJobs()).rejects.toThrow('argument-fail');
    expect(traitRunMock).not.toHaveBeenCalled();
  });

  it('runs each isolated job and bubbles errors', async () => {
    const service = new JobService();

    await service.runMemoryJob();
    await service.runArgumentJob();
    await service.runTraitJob();
    await service.runFunFactJob();
    await service.runPricingJob();
    await service.runEventAlertJob();

    expect(memoryRunMock).toHaveBeenCalled();
    expect(argumentRunMock).toHaveBeenCalled();
    expect(traitRunMock).toHaveBeenCalled();
    expect(funFactRunMock).toHaveBeenCalled();
    expect(pricingRunMock).toHaveBeenCalled();
    expect(eventAlertRunMock).toHaveBeenCalled();

    pricingRunMock.mockRejectedValueOnce(new Error('pricing-fail'));
    await expect(service.runPricingJob()).rejects.toThrow('pricing-fail');
  });

  it('schedules all cron jobs with America/New_York timezone', () => {
    const service = new JobService();

    service.scheduleCronJobs();

    expect(scheduleMock).toHaveBeenCalledTimes(4);
    expect(scheduleMock).toHaveBeenNthCalledWith(1, '0 3 * * *', expect.any(Function), {
      timezone: 'America/New_York',
    });
    expect(scheduleMock).toHaveBeenNthCalledWith(2, '0 9 * * *', expect.any(Function), {
      timezone: 'America/New_York',
    });
    expect(scheduleMock).toHaveBeenNthCalledWith(3, '10 * * * *', expect.any(Function), {
      timezone: 'America/New_York',
    });
    expect(scheduleMock).toHaveBeenNthCalledWith(4, '5 * * * *', expect.any(Function), {
      timezone: 'America/New_York',
    });
  });

  it('logs errors from scheduled callbacks instead of throwing', async () => {
    const service = new JobService();
    const runNightlyAnalysisJobsSpy = vi
      .spyOn(service, 'runNightlyAnalysisJobs')
      .mockRejectedValueOnce(new Error('scheduled-failure'));

    service.scheduleCronJobs();

    const memoryCallback = scheduleMock.mock.calls[0]?.[1] as (() => void) | undefined;
    expect(memoryCallback).toBeDefined();

    memoryCallback?.();
    await Promise.resolve();

    expect(runNightlyAnalysisJobsSpy).toHaveBeenCalledOnce();
    expect(loggerMock.error).toHaveBeenCalledWith('Nightly analysis job sequence failed:', expect.any(Error));
  });
});
