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
    history: jest.fn().mockResolvedValue({ ok: true, messages: [] }),
  };

  files = {
    upload: jest.fn().mockResolvedValue(okResult()),
  };

  constructor(_token?: string) {
    void _token;
  }
}
