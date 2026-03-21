import { textMiddleware } from './textMiddleware';

type TextReq = Parameters<typeof textMiddleware>[0];
type TextRes = Parameters<typeof textMiddleware>[1];
type TextNext = Parameters<typeof textMiddleware>[2];

describe('textMiddleware', () => {
  it('rejects missing text', async () => {
    const req = { body: { user_id: 'U1', team_id: 'T1' } } as TextReq;
    const send = jest.fn();
    const res = { send } as TextRes;
    const next = jest.fn() as TextNext;

    await textMiddleware(req, res, next);

    expect(send).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects too long text', async () => {
    const req = { body: { user_id: 'U1', team_id: 'T1', text: 'a'.repeat(801) } } as TextReq;
    const send = jest.fn();
    const res = { send } as TextRes;
    const next = jest.fn() as TextNext;

    await textMiddleware(req, res, next);

    expect(send).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next on valid text', async () => {
    const req = { body: { user_id: 'U1', team_id: 'T1', text: 'hello' } } as TextReq;
    const res = { send: jest.fn() } as TextRes;
    const next = jest.fn() as TextNext;

    await textMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
