import express from 'express';
import request from 'supertest';

const searchMessagesMock = jest.fn();

jest.mock('./search.persistence.service', () => ({
  SearchPersistenceService: jest.fn().mockImplementation(() => ({
    searchMessages: searchMessagesMock,
  })),
}));

import { searchController } from './search.controller';

describe('searchController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', searchController);

  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with messages when search succeeds', async () => {
    const messages = [{ id: 1, message: 'hello', name: 'alice', channel: 'general' }];
    searchMessagesMock.mockResolvedValue(messages);

    const res = await request(app)
      .get('/messages')
      .query({ userName: 'alice', channel: 'general', content: 'hello', limit: '10' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(messages);
    expect(searchMessagesMock).toHaveBeenCalledWith({
      userName: 'alice',
      channel: 'general',
      content: 'hello',
      limit: 10,
    });
  });

  it('passes undefined for query params that are not strings', async () => {
    searchMessagesMock.mockResolvedValue([]);

    await request(app).get('/messages').expect(200);

    expect(searchMessagesMock).toHaveBeenCalledWith({
      userName: undefined,
      channel: undefined,
      content: undefined,
      limit: undefined,
    });
  });

  it('returns 500 when search throws an error', async () => {
    searchMessagesMock.mockRejectedValue(new Error('DB failure'));

    const res = await request(app).get('/messages').query({ userName: 'bob' });

    expect(res.status).toBe(500);
  });
});
