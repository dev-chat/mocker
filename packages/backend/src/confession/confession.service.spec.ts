import { ConfessionService } from './confession.service';

type ConfessionDependencies = ConfessionService & {
  webService: { sendMessage: jest.Mock };
};

describe('ConfessionService', () => {
  let service: ConfessionService;
  const sendMessage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConfessionService();
    (service as unknown as ConfessionDependencies).webService = { sendMessage };
  });

  it('sends confession message to channel', async () => {
    sendMessage.mockResolvedValue({ ok: true });

    await service.confess('U1', 'C1', 'hello there');

    expect(sendMessage).toHaveBeenCalledWith('C1', ':chicken: <@U1> :chicken: says: `hello there`');
  });

  it('logs when sending confession fails', async () => {
    const err = new Error('boom');
    const loggerSpy = jest.spyOn(service.logger, 'error').mockImplementation(() => undefined);
    sendMessage.mockRejectedValue(err);

    await service.confess('U1', 'C1', 'bad');
    await Promise.resolve();

    expect(loggerSpy).toHaveBeenCalledWith(err);
  });
});
