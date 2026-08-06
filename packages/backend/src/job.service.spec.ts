import { vi } from 'vitest';
import { loggerMock } from './test/mocks/logger.mock';

const { funFactRunMock, pricingRunMock, eventAlertRunMock, scheduleMock } = vi.hoisted(() => ({
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
    funFactRunMock.mockResolvedValue(undefined);
    pricingRunMock.mockResolvedValue(undefined);
    eventAlertRunMock.mockResolvedValue(undefined);
  });

  it('runs each isolated job and bubbles errors', async () => {
    const service = new JobService();

    await service.runFunFactJob();
    await service.runPricingJob();
    await service.runEventAlertJob();

    expect(funFactRunMock).toHaveBeenCalled();
    expect(pricingRunMock).toHaveBeenCalled();
    expect(eventAlertRunMock).toHaveBeenCalled();

    pricingRunMock.mockRejectedValueOnce(new Error('pricing-fail'));
    await expect(service.runPricingJob()).rejects.toThrow('pricing-fail');
  });

  it('schedules all cron jobs with America/New_York timezone', () => {
    const service = new JobService();

    service.scheduleCronJobs();

    expect(scheduleMock).toHaveBeenCalledTimes(3);
    expect(scheduleMock).toHaveBeenNthCalledWith(1, '0 9 * * *', expect.any(Function), {
      timezone: 'America/New_York',
    });
    expect(scheduleMock).toHaveBeenNthCalledWith(2, '10 * * * *', expect.any(Function), {
      timezone: 'America/New_York',
    });
    expect(scheduleMock).toHaveBeenNthCalledWith(3, '5 * * * *', expect.any(Function), {
      timezone: 'America/New_York',
    });
  });

  it('logs errors from scheduled callbacks instead of throwing', async () => {
    const service = new JobService();
    const runFunFactJobSpy = vi.spyOn(service, 'runFunFactJob').mockRejectedValueOnce(new Error('scheduled-failure'));

    service.scheduleCronJobs();

    const funFactCallback = scheduleMock.mock.calls[0]?.[1] as (() => void) | undefined;
    expect(funFactCallback).toBeDefined();

    funFactCallback?.();
    await Promise.resolve();

    expect(runFunFactJobSpy).toHaveBeenCalledOnce();
    expect(loggerMock.error).toHaveBeenCalledWith('Fun-fact job failed:', expect.any(Error));
  });
});
