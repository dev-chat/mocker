import { vi } from 'vitest';
type SlackResult = Record<string, unknown> & { ok: boolean };

const okResult = (): SlackResult => ({ ok: true });

export class WebClient {
  chat = {
    delete: vi.fn().mockResolvedValue(okResult()),
    postEphemeral: vi.fn().mockResolvedValue(okResult()),
    postMessage: vi.fn().mockResolvedValue(okResult()),
    update: vi.fn().mockResolvedValue(okResult()),
  };

  users = {
    list: vi.fn().mockResolvedValue({ ok: true, members: [] }),
    setPhoto: vi.fn().mockResolvedValue(okResult()),
  };

  conversations = {
    list: vi.fn().mockResolvedValue({ ok: true, channels: [] }),
  };

  files = {
    upload: vi.fn().mockResolvedValue(okResult()),
  };

  constructor(_token?: string) {
    void _token;
  }
}
