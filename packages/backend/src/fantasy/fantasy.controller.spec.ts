import express from 'express';
import request from 'supertest';
import Axios from 'axios';
import { FantasyValidationError } from './fantasy.service';

const getLanding = vi.fn();
const linkSleeperUser = vi.fn();
const getOverview = vi.fn();

vi.mock('./fantasy.service', async () => {
  const actual = await vi.importActual('./fantasy.service');
  return {
    ...actual,
    FantasyService: classMock(() => ({ getLanding, linkSleeperUser, getOverview })),
  };
});

import { fantasyController } from './fantasy.controller';

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  Reflect.set(req, 'authSession', { userId: 'U1', teamId: 'T1', exp: Date.now() + 1000 });
  next();
});
app.use('/', fantasyController);

const unauthenticatedApp = express();
unauthenticatedApp.use(express.json());
unauthenticatedApp.use('/', fantasyController);

describe('fantasyController', () => {
  it.each([
    ['get', '/'],
    ['put', '/profile'],
    ['get', '/leagues/999'],
  ] as const)('rejects unauthenticated %s requests to %s', async (method, path) => {
    const response = await request(unauthenticatedApp)[method](path).send({});

    expect(response.status).toBe(401);
  });

  it('returns the fantasy landing data', async () => {
    getLanding.mockResolvedValue({ sleeperUser: null, leagues: [], season: '2026' });

    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ sleeperUser: null, leagues: [], season: '2026' });
    expect(getLanding).toHaveBeenCalledWith('U1', 'T1');
  });

  it('links a Sleeper user', async () => {
    linkSleeperUser.mockResolvedValue({ user_id: '123', username: 'alice', display_name: 'Alice', avatar: null });

    const response = await request(app).put('/profile').send({ sleeperUser: 'alice' });

    expect(response.status).toBe(200);
    expect(response.body.user_id).toBe('123');
    expect(linkSleeperUser).toHaveBeenCalledWith('U1', 'T1', 'alice');
  });

  it('rejects a missing Sleeper username', async () => {
    const response = await request(app).put('/profile').send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/required/i);
  });

  it('returns a selected league overview', async () => {
    getOverview.mockResolvedValue({ league: { league_id: '999' } });

    const response = await request(app).get('/leagues/999');

    expect(response.status).toBe(200);
    expect(response.body.league.league_id).toBe('999');
    expect(getOverview).toHaveBeenCalledWith('U1', 'T1', '999');
  });

  it('returns 404 when the linked roster is unavailable', async () => {
    getOverview.mockResolvedValue(null);

    const response = await request(app).get('/leagues/999');

    expect(response.status).toBe(404);
  });

  it('maps validation errors to 400 responses', async () => {
    getLanding.mockRejectedValue(new FantasyValidationError('Invalid Sleeper user.'));

    const response = await request(app).get('/');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid Sleeper user.');
  });

  it('maps Sleeper 404 errors to 404 responses', async () => {
    getLanding.mockRejectedValue(
      new Axios.AxiosError('Not found', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config: { headers: {} },
        data: {},
      }),
    );

    const response = await request(app).get('/');

    expect(response.status).toBe(404);
    expect(response.body.error).toMatch(/not found/i);
  });

  it('maps unexpected upstream errors to 502 responses', async () => {
    getLanding.mockRejectedValue(new Error('upstream failed'));

    const response = await request(app).get('/');

    expect(response.status).toBe(502);
    expect(response.body.error).toMatch(/temporarily unavailable/i);
  });

  it('maps unexpected league errors to 502 responses', async () => {
    getOverview.mockRejectedValue(new Error('upstream failed'));

    const response = await request(app).get('/leagues/999');

    expect(response.status).toBe(502);
  });
});
