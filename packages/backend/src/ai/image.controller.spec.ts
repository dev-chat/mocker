import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { imageController } from './image.controller';
import { AIService } from './ai.service';
import { signatureVerificationMiddleware } from '../shared/middleware/signatureVerification';

describe('imageController', () => {
  let directory: string;
  const app = express();
  app.use('/images', imageController);
  app.use(signatureVerificationMiddleware);

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mocker-images-'));
    vi.stubEnv('IMAGE_DIR', directory);
    vi.stubEnv('IMAGE_BASE_URL', 'https://example.com/images');
    vi.stubEnv('MUZZLE_BOT_SIGNING_SECRET', 'test-signing-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('serves generated image bytes without a Slack signature', async () => {
    const image = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9kAAAAASUVORK5CYII=',
      'base64',
    );
    const url = await new AIService().writeToDiskAndReturnUrl(image.toString('base64'));

    const response = await request(app).get(new URL(url).pathname).expect(200);

    expect(response.headers['content-type']).toBe('image/png');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.body).toEqual(image);
    await request(app).head(new URL(url).pathname).expect(200);
  });

  it.each(['/.env', '/secret.txt', '/', '/%2e%2e%2fsecret.txt'])('does not expose non-image paths: %s', async (url) => {
    fs.writeFileSync(path.join(directory, '.env'), 'private-config');
    fs.writeFileSync(path.join(directory, 'secret.txt'), 'private-config');

    const response = await request(app).get(`/images${url}`);

    expect(response.status).not.toBe(200);
    expect(response.text).not.toContain('private-config');
  });

  it('does not bypass Slack signature verification for command requests', async () => {
    await request(app).post('/ai/image').send({ text: 'cat' }).expect(400);
  });
});
