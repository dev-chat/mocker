import { vi } from 'vitest';
const mockGetAllMemoriesForUser = vi.fn();
const mockSendEphemeral = vi.fn();

vi.mock('../ai/memory/memory.persistence.service', async () => ({
  MemoryPersistenceService: classMock(() => ({
    getAllMemoriesForUser: mockGetAllMemoriesForUser,
  })),
}));

vi.mock('../shared/services/web/web.service', async () => ({
  WebService: classMock(() => ({
    sendEphemeral: mockSendEphemeral,
  })),
}));

vi.mock('../shared/middleware/suppression', async () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  suppressedMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../shared/logger/logger', async () => ({
  logger: { child: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }) },
}));

import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';
import { memoryController } from './memory.controller';

let server: http.Server;
let port: number;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/memory', memoryController);

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      port = (server.address() as AddressInfo).port;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err !== undefined) {
        reject(err);
        return;
      }

      resolve();
    });
  });
});

function postMemory(body: Record<string, string>): Promise<number> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/memory',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode!);
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

describe('MemoryController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should respond 200 and send ephemeral with formatted memories', async () => {
    const memories = [
      { content: 'loves TypeScript', updatedAt: new Date('2026-02-15') },
      { content: 'works at Acme', updatedAt: new Date('2026-03-01') },
    ];
    mockGetAllMemoriesForUser.mockResolvedValue(memories);

    const status = await postMemory({ user_id: 'U001', team_id: 'T001', channel_id: 'C001' });

    expect(status).toBe(200);

    // Wait for async work after res.send()
    await new Promise((r) => setTimeout(r, 100));

    expect(mockGetAllMemoriesForUser).toHaveBeenCalledWith('U001', 'T001');
    expect(mockSendEphemeral).toHaveBeenCalledWith('C001', expect.stringContaining('loves TypeScript'), 'U001');
    expect(mockSendEphemeral).toHaveBeenCalledWith('C001', expect.stringContaining('works at Acme'), 'U001');
  });

  it('should send "no memories" ephemeral when user has none', async () => {
    mockGetAllMemoriesForUser.mockResolvedValue([]);

    const status = await postMemory({ user_id: 'U002', team_id: 'T001', channel_id: 'C001' });
    await new Promise((r) => setTimeout(r, 100));

    expect(status).toBe(200);
    expect(mockSendEphemeral).toHaveBeenCalledWith('C001', "Moonbeam doesn't remember anything about you yet.", 'U002');
  });

  it('should send error ephemeral when persistence throws', async () => {
    mockGetAllMemoriesForUser.mockRejectedValue(new Error('DB down'));

    const status = await postMemory({ user_id: 'U003', team_id: 'T001', channel_id: 'C001' });
    await new Promise((r) => setTimeout(r, 100));

    expect(status).toBe(200);
    expect(mockSendEphemeral).toHaveBeenCalledWith(
      'C001',
      'Sorry, something went wrong fetching your memories.',
      'U003',
    );
  });
});
