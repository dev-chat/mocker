import { getRepository } from 'typeorm';
import { ListPersistenceService } from './list.persistence.service';

jest.mock('typeorm', () => {
  const actual = jest.requireActual('typeorm');
  return {
    ...actual,
    getRepository: jest.fn(),
  };
});

describe('ListPersistenceService', () => {
  let service: ListPersistenceService;
  const save = jest.fn();
  const findOne = jest.fn();
  const remove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ListPersistenceService();
    (getRepository as jest.Mock).mockReturnValue({ save, findOne, remove });
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

    await expect(service.remove('missing')).rejects.toContain('Unable to find `missing`');
  });
});
