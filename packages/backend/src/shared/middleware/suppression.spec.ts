import { suppressedMiddleware } from './suppression';

type SuppressedReq = Parameters<typeof suppressedMiddleware>[0];
type SuppressedRes = Parameters<typeof suppressedMiddleware>[1];
type SuppressedNext = Parameters<typeof suppressedMiddleware>[2];

const isSuppressed = jest.fn();

jest.mock('../services/suppressor.service', () => ({
  SuppressorService: jest.fn().mockImplementation(() => ({
    isSuppressed,
  })),
}));

describe('suppressedMiddleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects suppressed users', async () => {
    isSuppressed.mockResolvedValue(true);
    const req = { body: { user_id: 'U1', team_id: 'T1' } } as SuppressedReq;
    const send = jest.fn();
    const res = { send } as SuppressedRes;
    const next = jest.fn() as SuppressedNext;

    await suppressedMiddleware(req, res, next);

    expect(send).toHaveBeenCalledWith("Sorry, can't do that while muzzled.");
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next for unsuppressed users', async () => {
    isSuppressed.mockResolvedValue(false);
    const req = { body: { user_id: 'U1', team_id: 'T1' } } as SuppressedReq;
    const res = { send: jest.fn() } as SuppressedRes;
    const next = jest.fn() as SuppressedNext;

    await suppressedMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
