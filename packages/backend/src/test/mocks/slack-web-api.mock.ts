type SlackResult = Record<string, unknown> & { ok: boolean };

const okResult = (): SlackResult => ({ ok: true });

export class WebClient {
  chat = {
    delete: jest.fn().mockResolvedValue(okResult()),
    postEphemeral: jest.fn().mockResolvedValue(okResult()),
    postMessage: jest.fn().mockResolvedValue(okResult()),
    update: jest.fn().mockResolvedValue(okResult()),
  };

  users = {
    list: jest.fn().mockResolvedValue({ ok: true, members: [] }),
  };

  conversations = {
    list: jest.fn().mockResolvedValue({ ok: true, channels: [] }),
  };

  files = {
    upload: jest.fn().mockResolvedValue(okResult()),
  };

  chatStream = jest.fn().mockReturnValue({
    append: jest.fn().mockResolvedValue(null),
    stop: jest.fn().mockResolvedValue(okResult()),
  });

  constructor(_token?: string) {
    void _token;
  }
}
