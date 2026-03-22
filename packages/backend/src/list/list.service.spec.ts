import { getManager } from 'typeorm';
import { ListService } from './list.service';

type ListRequest = Parameters<ListService['list']>[0];
type RemoveRequest = Parameters<ListService['remove']>[0];
type ReportRequest = Parameters<ListService['getListReport']>[0];

type ListServiceDependencies = ListService & {
  webService: { uploadFile: typeof uploadFile };
  slackService: { sendResponse: typeof sendResponse };
  listPersistenceService: { store: typeof store; remove: typeof remove };
};

jest.mock('typeorm', () => {
  const actual = jest.requireActual('typeorm');
  return {
    ...actual,
    getManager: jest.fn(),
  };
});

describe('ListService', () => {
  let service: ListService;
  const uploadFile = jest.fn();
  const sendResponse = jest.fn();
  const store = jest.fn();
  const remove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ListService();
    const dependencyTarget = service as unknown as ListServiceDependencies;
    dependencyTarget.webService = { uploadFile };
    dependencyTarget.slackService = { sendResponse };
    dependencyTarget.listPersistenceService = { store, remove };
  });

  it('uploads a formatted list report', async () => {
    (getManager as jest.Mock).mockReturnValue({
      query: jest.fn().mockResolvedValue([
        { name: 'Steve', text: 'Do thing' },
        { name: 'Kim', text: 'Another thing' },
      ]),
    });

    const req = { channel_id: 'C1', channel_name: 'general', user_id: 'U1' } as ReportRequest;
    await service.getListReport(req);

    expect(uploadFile).toHaveBeenCalledWith('C1', expect.stringContaining('#general List'), "#general's List", 'U1');
  });

  it('stores list item and sends in-channel response', async () => {
    const req = {
      user_id: 'U1',
      text: 'buy milk',
      team_id: 'T1',
      channel_id: 'C1',
      response_url: 'https://resp',
    } as ListRequest;

    store.mockResolvedValue(undefined);

    await service.list(req);

    expect(store).toHaveBeenCalledWith('U1', 'buy milk', 'T1', 'C1');
    expect(sendResponse).toHaveBeenCalledWith(
      'https://resp',
      expect.objectContaining({ response_type: 'in_channel', text: '`buy milk` has been `listed`' }),
    );
  });

  it('removes list item and sends success response', async () => {
    remove.mockResolvedValue(undefined);
    const req = { text: 'buy milk', response_url: 'https://resp' } as RemoveRequest;

    await service.remove(req);

    expect(remove).toHaveBeenCalledWith('buy milk');
    expect(sendResponse).toHaveBeenCalledWith('https://resp', expect.objectContaining({ response_type: 'in_channel' }));
  });

  it('logs and sends ephemeral error when remove fails', async () => {
    const err = new Error('remove failed');
    const loggerSpy = jest.spyOn(service.logger, 'error').mockImplementation(() => undefined);
    remove.mockRejectedValue(err);

    await service.remove({ text: 'x', response_url: 'https://resp' } as RemoveRequest);

    expect(loggerSpy).toHaveBeenCalledWith(
      'Failed to remove list item',
      expect.objectContaining({
        context: expect.objectContaining({ text: 'x' }),
        error: expect.objectContaining({ message: 'remove failed', name: 'Error' }),
      }),
    );
    expect(sendResponse).toHaveBeenCalledWith('https://resp', expect.objectContaining({ response_type: 'ephemeral' }));
  });
});
