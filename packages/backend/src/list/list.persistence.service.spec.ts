import { vi } from 'vitest';
import { getRepository } from 'typeorm';
import { ListPersistenceService } from './list.persistence.service';

vi.mock('typeorm', async () => {
  const actual = await vi.importActual('typeorm');
  return {
    ...actual,
    getRepository: vi.fn(),
  };
});

describe('ListPersistenceService', () => {
  let service: ListPersistenceService;
  const save = vi.fn();
  const findOne = vi.fn();
  const remove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ListPersistenceService();
    (getRepository as Mock).mockReturnValue({ save, findOne, remove });
  });

  it('stores list item', async () => {
    save.mockResolvedValue({ id: 1, text: 'task' });

    const result = await service.store('U1', 'task', 'T1', 'C1');

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ requestorId: 'U1', text: 'task', teamId: 'T1', channelId: 'C1' }),
    );
    expect(result).toEqual({ id: 1, text: 'task' });
  });

  it('removes an item when found', async () => {
    findOne.mockResolvedValue({ id: 3, text: 'task' });
    remove.mockResolvedValue({ id: 3, text: 'task' });

    const result = await service.remove('task');

    expect(findOne).toHaveBeenCalledWith({ where: { text: 'task' } });
    expect(remove).toHaveBeenCalledWith({ id: 3, text: 'task' });
    expect(result).toEqual({ id: 3, text: 'task' });
  });

  it('rejects when item is not found', async () => {
    findOne.mockResolvedValue(undefined);

    await expect(service.remove('missing')).rejects.toThrow('Unable to find `missing`');
  });
});
