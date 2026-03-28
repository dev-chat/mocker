import express from 'express';
import request from 'supertest';

const searchMessagesMock = jest.fn();
const getSearchFiltersMock = jest.fn();

jest.mock('./search.persistence.service', () => ({
  SearchPersistenceService: jest.fn().mockImplementation(() => ({
    searchMessages: searchMessagesMock,
    getSearchFilters: getSearchFiltersMock,
  })),
}));

import { searchController } from './search.controller';

describe('searchController', () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as { authSession?: { userId: string; teamId: string; exp: number } }).authSession = {
      userId: 'U1',
      teamId: 'T1',
      exp: Date.now() + 60000,
    };
    next();
  });
  app.use('/', searchController);

  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with filter options when loading filters succeeds', async () => {
    getSearchFiltersMock.mockResolvedValue({ users: ['alice'], channels: ['general'] });

    const res = await request(app).get('/filters');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ users: ['alice'], channels: ['general'] });
    expect(getSearchFiltersMock).toHaveBeenCalledWith('T1');
  });

  it('returns 500 when loading filters throws an error', async () => {
    getSearchFiltersMock.mockRejectedValue(new Error('DB failure'));

    const res = await request(app).get('/filters');

    expect(res.status).toBe(500);
  });

  it('returns 200 with messages when search succeeds', async () => {
    const messages = [{ id: 1, message: 'hello', name: 'alice', channel: 'C123' }];
    searchMessagesMock.mockResolvedValue({ messages, mentions: {}, total: 1 });

    const res = await request(app)
      .get('/messages')
      .query({ userName: 'alice', channel: 'general', content: 'hello', limit: '10' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ messages, mentions: {}, total: 1 });
    expect(searchMessagesMock).toHaveBeenCalledWith({
      teamId: 'T1',
      userName: 'alice',
      channel: 'general',
      content: 'hello',
      limit: 10,
      offset: undefined,
    });
  });

  it('returns only public channel messages when persistence returns mixed channel types', async () => {
    searchMessagesMock.mockResolvedValue({
      messages: [
        { id: 1, message: 'public', name: 'alice', channel: 'C111' },
        { id: 2, message: 'private', name: 'bob', channel: 'G222' },
        { id: 3, message: 'dm', name: 'carol', channel: 'D333' },
      ],
      mentions: {},
      total: 3,
    });

    const res = await request(app).get('/messages');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      messages: [{ id: 1, message: 'public', name: 'alice', channel: 'C111' }],
      mentions: {},
      total: 3,
    });
  });

  it('passes undefined for query params that are not strings', async () => {
    searchMessagesMock.mockResolvedValue({ messages: [], mentions: {}, total: 0 });

    await request(app).get('/messages').expect(200);

    expect(searchMessagesMock).toHaveBeenCalledWith({
      teamId: 'T1',
      userName: undefined,
      channel: undefined,
      content: undefined,
      limit: undefined,
      offset: undefined,
    });
  });

  it('clamps limit to MAX_LIMIT (1000) when provided value exceeds it', async () => {
    searchMessagesMock.mockResolvedValue({ messages: [], mentions: {}, total: 0 });

    await request(app).get('/messages').query({ limit: '9999' }).expect(200);

    expect(searchMessagesMock).toHaveBeenCalledWith(expect.objectContaining({ limit: 1000 }));
  });

  it('passes undefined for limit when the value is not a valid positive integer (NaN)', async () => {
    searchMessagesMock.mockResolvedValue({ messages: [], mentions: {}, total: 0 });

    await request(app).get('/messages').query({ limit: 'abc' }).expect(200);

    expect(searchMessagesMock).toHaveBeenCalledWith(expect.objectContaining({ limit: undefined }));
  });

  it('passes undefined for limit when the value is zero or negative', async () => {
    searchMessagesMock.mockResolvedValue({ messages: [], mentions: {}, total: 0 });

    await request(app).get('/messages').query({ limit: '-5' }).expect(200);

    expect(searchMessagesMock).toHaveBeenCalledWith(expect.objectContaining({ limit: undefined }));
  });

  it('parses a valid offset and forwards it to the service', async () => {
    searchMessagesMock.mockResolvedValue({ messages: [], mentions: {}, total: 50 });

    await request(app).get('/messages').query({ offset: '25' }).expect(200);

    expect(searchMessagesMock).toHaveBeenCalledWith(expect.objectContaining({ offset: 25 }));
  });

  it('passes undefined for offset when the value is negative', async () => {
    searchMessagesMock.mockResolvedValue({ messages: [], mentions: {}, total: 0 });

    await request(app).get('/messages').query({ offset: '-1' }).expect(200);

    expect(searchMessagesMock).toHaveBeenCalledWith(expect.objectContaining({ offset: undefined }));
  });

  it('passes undefined for offset when the value is not a valid integer', async () => {
    searchMessagesMock.mockResolvedValue({ messages: [], mentions: {}, total: 0 });

    await request(app).get('/messages').query({ offset: 'abc' }).expect(200);

    expect(searchMessagesMock).toHaveBeenCalledWith(expect.objectContaining({ offset: undefined }));
  });

  it('passes undefined for offset when the value is a decimal (e.g. "1.5")', async () => {
    searchMessagesMock.mockResolvedValue({ messages: [], mentions: {}, total: 0 });

    await request(app).get('/messages').query({ offset: '1.5' }).expect(200);

    expect(searchMessagesMock).toHaveBeenCalledWith(expect.objectContaining({ offset: undefined }));
  });

  it('passes undefined for offset when the value has trailing non-digit chars (e.g. "25abc")', async () => {
    searchMessagesMock.mockResolvedValue({ messages: [], mentions: {}, total: 0 });

    await request(app).get('/messages').query({ offset: '25abc' }).expect(200);

    expect(searchMessagesMock).toHaveBeenCalledWith(expect.objectContaining({ offset: undefined }));
  });

  it('includes total in the response body', async () => {
    searchMessagesMock.mockResolvedValue({ messages: [], mentions: {}, total: 99 });

    const res = await request(app).get('/messages');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(99);
  });

  it('returns 500 when search throws an error', async () => {
    searchMessagesMock.mockRejectedValue(new Error('DB failure'));

    const res = await request(app).get('/messages').query({ userName: 'bob' });

    expect(res.status).toBe(500);
  });

  it('returns 401 when auth session is missing teamId', async () => {
    const appWithoutTeam = express();
    appWithoutTeam.use(express.json());
    appWithoutTeam.use((req, _res, next) => {
      (req as { authSession?: { userId: string; teamId: string; exp: number } }).authSession = {
        userId: 'U1',
        teamId: '',
        exp: Date.now() + 60000,
      };
      next();
    });
    appWithoutTeam.use('/', searchController);

    const res = await request(appWithoutTeam).get('/messages');
    const filtersRes = await request(appWithoutTeam).get('/filters');

    expect(res.status).toBe(401);
    expect(filtersRes.status).toBe(401);
    expect(searchMessagesMock).not.toHaveBeenCalled();
    expect(getSearchFiltersMock).not.toHaveBeenCalled();
  });
});
