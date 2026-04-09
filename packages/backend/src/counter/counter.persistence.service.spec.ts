import { vi } from 'vitest';
import { getRepository } from 'typeorm';
import { CounterPersistenceService } from './counter.persistence.service';
import { Counter } from '../shared/db/models/Counter';

vi.mock('typeorm', async () => {
  const actual = await vi.importActual('typeorm');
  return {
    ...actual,
    getRepository: vi.fn(),
  };
});

describe('CounterPersistenceService', () => {
  let service: CounterPersistenceService;

  const repo = {
    save: vi.fn(),
    findOne: vi.fn(),
    increment: vi.fn(),
  };

  const muzzlePersistenceService = {
    removeMuzzlePrivileges: vi.fn(),
  };

  const webService = {
    sendMessage: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    service = new CounterPersistenceService();
    type CounterServiceDependencies = CounterPersistenceService & {
      muzzlePersistenceService: typeof muzzlePersistenceService;
      webService: typeof webService;
      counters: Map<number, { requestorId: string; removalFn: ReturnType<typeof setTimeout> }>;
    };
    const dependencyTarget = service as unknown as CounterServiceDependencies;
    dependencyTarget.muzzlePersistenceService = muzzlePersistenceService;
    dependencyTarget.webService = webService;

    (getRepository as Mock).mockImplementation((model: unknown) => {
      if (model === Counter) {
        return repo;
      }
      return {};
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds counter and stores in in-memory map', async () => {
    repo.save.mockResolvedValue({ id: 22 });

    await service.addCounter('U1', 'T1');

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ requestorId: 'U1', teamId: 'T1', countered: false }),
    );
    expect(service.hasCounter('U1')).toBe(true);
    expect(service.getCounterByRequestorId('U1')).toBe(22);
  });

  it('rejects addCounter when save fails', async () => {
    repo.save.mockRejectedValue(new Error('db fail'));

    await expect(service.addCounter('U1', 'T1')).rejects.toThrow('Error on saving counter to DB');
  });

  it('updates countered flag and optional requestor id', async () => {
    repo.findOne.mockResolvedValue({ id: 3, countered: false });
    repo.save.mockResolvedValue({ id: 3, countered: true, counteredId: 'U9' });

    const out = await service.setCounteredToTrue(3, 'U9');

    expect(out).toEqual({ id: 3, countered: true, counteredId: 'U9' });
  });

  it('manages counter muzzle map and checks status', () => {
    const fn = setTimeout(() => undefined, 1);
    service.setCounterMuzzle('U1', { suppressionCount: 1, counterId: 3, removalFn: fn });

    expect(service.isCounterMuzzled('U1')).toBe(true);
    expect(service.getCounterMuzzle('U1')).toEqual(expect.objectContaining({ counterId: 3 }));

    service.removeCounterMuzzle('U1');
    expect(service.isCounterMuzzled('U1')).toBe(false);
    clearTimeout(fn);
  });

  it('adds counter muzzle time when entry exists', () => {
    const fn = setTimeout(() => undefined, 1000);
    service.setCounterMuzzle('U1', { suppressionCount: 0, counterId: 7, removalFn: fn });

    service.addCounterMuzzleTime('U1', 500);

    const updated = service.getCounterMuzzle('U1');
    expect(updated).toBeDefined();
    expect(updated?.counterId).toBe(7);
    if (updated?.removalFn) {
      clearTimeout(updated.removalFn);
    }
  });

  it('handles used counter removal by setting countered to true', async () => {
    type CounterStateAccess = CounterPersistenceService & {
      counters: Map<number, { requestorId: string; removalFn: ReturnType<typeof setTimeout> }>;
    };
    (service as unknown as CounterStateAccess).counters.set(10, {
      requestorId: 'U1',
      removalFn: setTimeout(() => undefined, 5000),
    });
    const setCounteredSpy = vi.spyOn(service, 'setCounteredToTrue').mockResolvedValue({ id: 10 } as Counter);

    await service.removeCounter(10, true, 'C1', 'T1', 'U2');

    expect(setCounteredSpy).toHaveBeenCalledWith(10, 'U2');
    expect(service.getCounter(10)).toBeUndefined();
  });

  it('handles unused counter removal by applying penalties', async () => {
    type CounterStateAccess = CounterPersistenceService & {
      counters: Map<number, { requestorId: string; removalFn: ReturnType<typeof setTimeout> }>;
    };
    (service as unknown as CounterStateAccess).counters.set(11, {
      requestorId: 'U1',
      removalFn: setTimeout(() => undefined, 5000),
    });
    webService.sendMessage.mockResolvedValue({ ok: true });

    await service.removeCounter(11, false, '#general', 'T1');

    expect(muzzlePersistenceService.removeMuzzlePrivileges).toHaveBeenCalledWith('U1', 'T1');
    expect(webService.sendMessage).toHaveBeenCalled();
    expect(service.isCounterMuzzled('U1')).toBe(true);
  });

  it('tracks counter privileges probation', () => {
    expect(service.canCounter('U1')).toBe(true);
    service.removeCounterPrivileges('U1');
    expect(service.canCounter('U1')).toBe(false);
  });

  it('increments suppression counters in DB', async () => {
    repo.increment.mockResolvedValue({ affected: 1 });

    await service.incrementMessageSuppressions(1);
    await service.incrementWordSuppressions(1, 3);
    await service.incrementCharacterSuppressions(1, 9);

    expect(repo.increment).toHaveBeenCalledWith({ id: 1 }, 'messagesSuppressed', 1);
    expect(repo.increment).toHaveBeenCalledWith({ id: 1 }, 'wordsSuppressed', 3);
    expect(repo.increment).toHaveBeenCalledWith({ id: 1 }, 'charactersSuppressed', 9);
  });
});
