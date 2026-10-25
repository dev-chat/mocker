import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import bodyParser from 'body-parser';
import { rateLimit } from 'express-rate-limit';
import axios from 'axios';
import request from 'supertest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

describe('HTTP dependency compatibility in an isolated Express fixture', () => {
  const app = express();
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    app.set('trust proxy', 'loopback');
    app.use(
      bodyParser.json({
        verify: (req, _res, buffer) => {
          (req as express.Request & { rawBody: Buffer }).rawBody = buffer;
        },
      }),
      bodyParser.urlencoded({ extended: true }),
    );
    app.post('/echo', (req, res) =>
      res.json({
        body: req.body,
        rawBody: (req as express.Request & { rawBody?: Buffer }).rawBody?.toString(),
      }),
    );
    app.get('/redirect', (_req, res) => res.redirect('/json'));
    app.get('/json', (_req, res) => res.json({ ok: true }));
    app.use(
      '/limited',
      rateLimit({ windowMs: 60000, max: 2, standardHeaders: true, legacyHeaders: false }),
      (req, res) => res.json({ ip: req.ip }),
    );
    server = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  it('preserves raw JSON bytes for Slack signatures and parses nested URL-encoded bodies', async () => {
    const raw = '{ "text": "hello + world", "count": 2 }';
    const json = await request(app).post('/echo').set('Content-Type', 'application/json').send(raw).expect(200);
    expect(json.body).toEqual({ body: { text: 'hello + world', count: 2 }, rawBody: raw });
    const form = await request(app)
      .post('/echo')
      .type('form')
      .send('user[name]=Alice&items[]=first&items[]=second')
      .expect(200);
    expect(form.body.body).toEqual({ user: { name: 'Alice' }, items: ['first', 'second'] });
    await request(app).post('/echo').type('json').send('{"invalid":').expect(400);
    await request(app)
      .post('/echo')
      .send({ text: 'x'.repeat(110000) })
      .expect(413);
  });

  it('uses explicitly configured proxy trust for per-client limits, standard headers, and IPv6 subnet grouping', async () => {
    const first = await request(app).get('/limited').set('X-Forwarded-For', '192.0.2.10').expect(200);
    expect(first.body.ip).toBe('192.0.2.10');
    expect(first.headers['ratelimit-limit']).toBe('2');
    expect(first.headers['x-ratelimit-limit']).toBeUndefined();
    await request(app).get('/limited').set('X-Forwarded-For', '192.0.2.10').expect(200);
    const blocked = await request(app).get('/limited').set('X-Forwarded-For', '192.0.2.10').expect(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    await request(app).get('/limited').set('X-Forwarded-For', '192.0.2.11').expect(200);
    await request(app).get('/limited').set('X-Forwarded-For', '2001:db8::1').expect(200);
    await request(app).get('/limited').set('X-Forwarded-For', '2001:db8::2').expect(200);
    await request(app).get('/limited').set('X-Forwarded-For', '2001:db8::3').expect(429);
  });

  it('keeps Axios JSON requests, redirects, and rejected HTTP errors working against a local server', async () => {
    const client = axios.create({ baseURL: baseUrl, proxy: false });
    const post = await client.post('/echo', { text: 'hello', list: [1, 2] });
    expect(post.data.body).toEqual({ text: 'hello', list: [1, 2] });
    expect(JSON.parse(post.data.rawBody)).toEqual(post.data.body);
    expect((await client.get('/redirect')).data).toEqual({ ok: true });
    await expect(client.get('/missing')).rejects.toMatchObject({ response: { status: 404 } });
  });
});
