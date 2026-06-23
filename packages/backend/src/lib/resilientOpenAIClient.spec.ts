import { vi, it, describe, expect, beforeEach, afterEach } from 'vitest';
import { ResilientOpenAIClient, ResilientOpenAIError, METRIC_NAMES } from './resilientOpenAIClient';
import type { OpenAIClientLike } from './resilientOpenAIClient';
import { Registry } from 'prom-client';
import type { OpenAIClientConfig } from '../config/openai';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const makeResponse = (text = 'hello') => ({
  output: [
    {
      type: 'message' as const,
      content: [{ type: 'output_text' as const, text }],
    },
  ],
});

const makeUnderlying = (createImpl: Mock): OpenAIClientLike => ({
  responses: {
    create: createImpl,
  },
});

/** Build a minimal config with fast timings for tests. */
const fastConfig = (overrides: Partial<OpenAIClientConfig> = {}): Partial<OpenAIClientConfig> => ({
  timeoutMs: 500,
  retries: 2,
  backoffBaseMs: 0,
  circuitBreakerFailures: 3,
  circuitBreakerWindowMs: 100,
  circuitBreakerProbeMs: 50,
  concurrency: 10,
  featureFlagResilient: true,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ResilientOpenAIClient', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
    vi.useFakeTimers({ shouldAdvanceTime: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Feature-flag bypass
  // -------------------------------------------------------------------------

  describe('feature flag', () => {
    it('delegates directly to the underlying client when featureFlagResilient is false', async () => {
      const createMock = vi.fn().mockResolvedValue(makeResponse());
      const client = new ResilientOpenAIClient(
        makeUnderlying(createMock),
        fastConfig({ featureFlagResilient: false }),
        registry,
      );

      const params = { model: 'gpt-4o', input: 'hello' };
      await client.responses.create(params);

      expect(createMock).toHaveBeenCalledOnce();
      expect(createMock).toHaveBeenCalledWith(params, undefined);
    });

    it('applies resilience when featureFlagResilient is true (default)', async () => {
      const createMock = vi.fn().mockResolvedValue(makeResponse());
      const client = new ResilientOpenAIClient(
        makeUnderlying(createMock),
        fastConfig({ featureFlagResilient: true }),
        registry,
      );

      await client.responses.create({ model: 'gpt-4o', input: 'hello' });
      expect(createMock).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // Retry behaviour
  // -------------------------------------------------------------------------

  describe('retry behaviour', () => {
    it('returns successfully on first attempt without retrying', async () => {
      const createMock = vi.fn().mockResolvedValue(makeResponse('first try'));
      const client = new ResilientOpenAIClient(makeUnderlying(createMock), fastConfig(), registry);

      const result = await client.responses.create({ model: 'gpt-4o', input: 'hi' });

      expect(createMock).toHaveBeenCalledOnce();
      expect(result).toEqual(makeResponse('first try'));
    });

    it('retries on transient 500 error and succeeds', async () => {
      const transientError = Object.assign(new Error('Internal Server Error'), { status: 500 });
      const createMock = vi
        .fn()
        .mockRejectedValueOnce(transientError)
        .mockResolvedValue(makeResponse('retry success'));

      const client = new ResilientOpenAIClient(makeUnderlying(createMock), fastConfig(), registry);

      const resultPromise = client.responses.create({ model: 'gpt-4o', input: 'hi' });
      // Advance past the (near-zero) backoff
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(createMock).toHaveBeenCalledTimes(2);
      expect(result).toEqual(makeResponse('retry success'));
    });

    it('retries on 429 rate-limit error and succeeds', async () => {
      const rateLimitError = Object.assign(new Error('Rate limit exceeded'), { status: 429 });
      const createMock = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue(makeResponse('ok after 429'));

      const client = new ResilientOpenAIClient(makeUnderlying(createMock), fastConfig(), registry);

      const resultPromise = client.responses.create({ model: 'gpt-4o', input: 'hi' });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(createMock).toHaveBeenCalledTimes(2);
      expect(result).toEqual(makeResponse('ok after 429'));
    });

    it('honors Retry-After header on 429 response', async () => {
      const retryAfterSeconds = 2;
      const rateLimitError = Object.assign(new Error('Rate limited'), {
        status: 429,
        headers: { 'retry-after': String(retryAfterSeconds) },
      });
      const createMock = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue(makeResponse('after retry-after'));

      const client = new ResilientOpenAIClient(makeUnderlying(createMock), fastConfig(), registry);

      const resultPromise = client.responses.create({ model: 'gpt-4o', input: 'hi' });
      // Advance past the Retry-After delay (2000ms)
      await vi.advanceTimersByTimeAsync(retryAfterSeconds * 1000 + 100);
      const result = await resultPromise;

      expect(result).toEqual(makeResponse('after retry-after'));
      expect(createMock).toHaveBeenCalledTimes(2);
    });

    it('does not retry on 400 (non-retriable) error', async () => {
      const badRequestError = Object.assign(new Error('Bad Request'), { status: 400 });
      const createMock = vi.fn().mockRejectedValue(badRequestError);

      const client = new ResilientOpenAIClient(makeUnderlying(createMock), fastConfig(), registry);

      await expect(client.responses.create({ model: 'gpt-4o', input: 'hi' })).rejects.toThrow(
        'Bad Request',
      );
      // One attempt only (no retries for 4xx other than 429)
      expect(createMock).toHaveBeenCalledOnce();
    });

    it('throws after exhausting all retries', async () => {
      const transientError = Object.assign(new Error('Service Unavailable'), { status: 503 });
      const createMock = vi.fn().mockRejectedValue(transientError);

      const client = new ResilientOpenAIClient(makeUnderlying(createMock), fastConfig({ retries: 2 }), registry);

      const resultPromise = client.responses.create({ model: 'gpt-4o', input: 'hi' });
      // Pre-attach a no-op handler so the promise is never "unhandled" while
      // we wait for the fake timers to drain the retry backoff sleeps.
      resultPromise.catch(() => undefined);
      await vi.runAllTimersAsync();

      await expect(resultPromise).rejects.toThrow('Service Unavailable');
      // initial attempt + 2 retries = 3 calls total
      expect(createMock).toHaveBeenCalledTimes(3);
    });
  });

  // -------------------------------------------------------------------------
  // Timeout behaviour
  // -------------------------------------------------------------------------

  describe('timeout behaviour', () => {
    it('throws ResilientOpenAIError with TIMEOUT code when request exceeds timeoutMs', async () => {
      // Simulate an underlying client that respects AbortSignal (as the real
      // OpenAI client / fetch does): reject with an AbortError when the signal
      // fires.
      const createMock = vi.fn().mockImplementation(
        (_params: unknown, options?: { signal?: AbortSignal }) =>
          new Promise<never>((_, reject) => {
            const signal = options?.signal;
            if (!signal) return;
            const onAbort = () => {
              const err = new Error('The operation was aborted');
              err.name = 'AbortError';
              reject(err);
            };
            if (signal.aborted) {
              onAbort();
            } else {
              signal.addEventListener('abort', onAbort, { once: true });
            }
          }),
      );

      const client = new ResilientOpenAIClient(
        makeUnderlying(createMock as Mock),
        fastConfig({ timeoutMs: 100, retries: 0 }),
        registry,
      );

      const resultPromise = client.responses.create({ model: 'gpt-4o', input: 'hi' });
      // Pre-attach a no-op handler so the rejected promise is never "unhandled"
      // while we wait for the fake abort timer to fire.
      resultPromise.catch(() => undefined);
      // Advance past the 100 ms abort timer
      await vi.advanceTimersByTimeAsync(200);

      await expect(resultPromise).rejects.toMatchObject({
        name: 'ResilientOpenAIError',
        code: 'TIMEOUT',
      });
    });

    it('does not throw when request completes within timeoutMs', async () => {
      const createMock = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(makeResponse()), 50)),
      );

      const client = new ResilientOpenAIClient(
        makeUnderlying(createMock),
        fastConfig({ timeoutMs: 200, retries: 0 }),
        registry,
      );

      const resultPromise = client.responses.create({ model: 'gpt-4o', input: 'hi' });
      await vi.advanceTimersByTimeAsync(100);

      await expect(resultPromise).resolves.toEqual(makeResponse());
    });
  });

  // -------------------------------------------------------------------------
  // Circuit-breaker transitions
  // -------------------------------------------------------------------------

  describe('circuit breaker', () => {
    it('stays closed on successes', async () => {
      const createMock = vi.fn().mockResolvedValue(makeResponse());
      const client = new ResilientOpenAIClient(
        makeUnderlying(createMock),
        fastConfig({ circuitBreakerFailures: 3 }),
        registry,
      );

      for (let i = 0; i < 5; i++) {
        await client.responses.create({ model: 'gpt-4o', input: 'hi' });
      }

      expect(client.getCircuitState()).toBe('closed');
    });

    it('opens after N consecutive failures', async () => {
      const badRequestError = Object.assign(new Error('boom'), { status: 503 });
      const createMock = vi.fn().mockRejectedValue(badRequestError);

      const client = new ResilientOpenAIClient(
        makeUnderlying(createMock),
        fastConfig({ circuitBreakerFailures: 3, retries: 0 }),
        registry,
      );

      // 3 failures should open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(client.responses.create({ model: 'gpt-4o', input: 'hi' })).rejects.toThrow();
      }

      expect(client.getCircuitState()).toBe('open');
    });

    it('short-circuits calls when open and throws ResilientOpenAIError with CIRCUIT_OPEN code', async () => {
      const badRequestError = Object.assign(new Error('boom'), { status: 503 });
      const createMock = vi.fn().mockRejectedValue(badRequestError);

      const client = new ResilientOpenAIClient(
        makeUnderlying(createMock),
        fastConfig({ circuitBreakerFailures: 2, retries: 0 }),
        registry,
      );

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        await expect(client.responses.create({ model: 'gpt-4o', input: 'hi' })).rejects.toThrow();
      }
      expect(client.getCircuitState()).toBe('open');

      const callCountBeforeShortCircuit = createMock.mock.calls.length;

      // Next call should be short-circuited (no underlying call)
      await expect(client.responses.create({ model: 'gpt-4o', input: 'hi' })).rejects.toMatchObject({
        name: 'ResilientOpenAIError',
        code: 'CIRCUIT_OPEN',
      });

      expect(createMock).toHaveBeenCalledTimes(callCountBeforeShortCircuit);
    });

    it('transitions to half-open and closes on successful probe', async () => {
      const badRequestError = Object.assign(new Error('boom'), { status: 503 });
      const createMock = vi
        .fn()
        .mockRejectedValue(badRequestError);

      const client = new ResilientOpenAIClient(
        makeUnderlying(createMock),
        fastConfig({ circuitBreakerFailures: 2, retries: 0, circuitBreakerWindowMs: 100, circuitBreakerProbeMs: 50 }),
        registry,
      );

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        await expect(client.responses.create({ model: 'gpt-4o', input: 'hi' })).rejects.toThrow();
      }
      expect(client.getCircuitState()).toBe('open');

      // Advance past the window AND probe interval so a probe is allowed
      await vi.advanceTimersByTimeAsync(150);

      // Now configure the underlying to succeed on the probe
      createMock.mockResolvedValue(makeResponse('probe success'));

      const result = await client.responses.create({ model: 'gpt-4o', input: 'probe' });
      expect(result).toEqual(makeResponse('probe success'));
      expect(client.getCircuitState()).toBe('closed');
    });

    it('reopens the circuit when the probe fails', async () => {
      const badRequestError = Object.assign(new Error('boom'), { status: 503 });
      const createMock = vi.fn().mockRejectedValue(badRequestError);

      const client = new ResilientOpenAIClient(
        makeUnderlying(createMock),
        fastConfig({ circuitBreakerFailures: 2, retries: 0, circuitBreakerWindowMs: 100, circuitBreakerProbeMs: 50 }),
        registry,
      );

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        await expect(client.responses.create({ model: 'gpt-4o', input: 'hi' })).rejects.toThrow();
      }

      // Advance past window + probe interval
      await vi.advanceTimersByTimeAsync(150);

      // Probe also fails → should re-open
      await expect(client.responses.create({ model: 'gpt-4o', input: 'probe' })).rejects.toThrow();
      expect(client.getCircuitState()).toBe('open');
    });
  });

  // -------------------------------------------------------------------------
  // Concurrency / bulkhead limiter
  // -------------------------------------------------------------------------

  describe('concurrency limiter', () => {
    it('rejects requests that exceed the concurrency limit', async () => {
      // Create a mock that never resolves so we can accumulate inflight requests
      const neverResolves = () => new Promise<never>(() => undefined);
      const createMock = vi.fn().mockImplementation(neverResolves);

      const client = new ResilientOpenAIClient(
        makeUnderlying(createMock),
        fastConfig({ concurrency: 2, retries: 0 }),
        registry,
      );

      // Kick off 2 requests that occupy all slots
      void client.responses.create({ model: 'gpt-4o', input: '1' });
      void client.responses.create({ model: 'gpt-4o', input: '2' });

      expect(client.getActiveRequests()).toBe(2);

      // Third request should be rejected
      await expect(client.responses.create({ model: 'gpt-4o', input: '3' })).rejects.toMatchObject({
        name: 'ResilientOpenAIError',
        code: 'CONCURRENCY_REJECTED',
      });
    });

    it('allows new requests after a slot is freed', async () => {
      let resolveFirst!: (v: ReturnType<typeof makeResponse>) => void;
      const firstRequest = new Promise<ReturnType<typeof makeResponse>>((resolve) => {
        resolveFirst = resolve;
      });

      const createMock = vi
        .fn()
        .mockImplementationOnce(() => firstRequest)
        .mockResolvedValue(makeResponse('second'));

      const client = new ResilientOpenAIClient(
        makeUnderlying(createMock),
        fastConfig({ concurrency: 1, retries: 0 }),
        registry,
      );

      // Start first request (will hold the slot)
      const firstPromise = client.responses.create({ model: 'gpt-4o', input: '1' });

      // Second request should be rejected while slot is held
      await expect(client.responses.create({ model: 'gpt-4o', input: '2' })).rejects.toMatchObject({
        code: 'CONCURRENCY_REJECTED',
      });

      // Free the slot
      resolveFirst(makeResponse('first'));
      await firstPromise;

      // Now a new request should succeed
      const result = await client.responses.create({ model: 'gpt-4o', input: '3' });
      expect(result).toEqual(makeResponse('second'));
    });
  });

  // -------------------------------------------------------------------------
  // Metrics
  // -------------------------------------------------------------------------

  describe('metrics', () => {
    it('increments openai_requests_total on successful request', async () => {
      const createMock = vi.fn().mockResolvedValue(makeResponse());
      const client = new ResilientOpenAIClient(makeUnderlying(createMock), fastConfig(), registry);

      await client.responses.create({ model: 'gpt-4o', input: 'hi' });

      const metric = await registry.getSingleMetricAsString(METRIC_NAMES.requestsTotal);
      expect(metric).toContain('openai_requests_total');
      expect(metric).toContain('status="success"');
    });

    it('increments openai_retries_total on retry', async () => {
      const transientError = Object.assign(new Error('oops'), { status: 503 });
      const createMock = vi
        .fn()
        .mockRejectedValueOnce(transientError)
        .mockResolvedValue(makeResponse());

      const client = new ResilientOpenAIClient(makeUnderlying(createMock), fastConfig(), registry);

      const resultPromise = client.responses.create({ model: 'gpt-4o', input: 'hi' });
      await vi.runAllTimersAsync();
      await resultPromise;

      const metric = await registry.getSingleMetricAsString(METRIC_NAMES.retriesTotal);
      expect(metric).toContain('openai_retries_total 1');
    });

    it('increments openai_circuit_open_total when circuit opens', async () => {
      const badError = Object.assign(new Error('boom'), { status: 503 });
      const createMock = vi.fn().mockRejectedValue(badError);

      const client = new ResilientOpenAIClient(
        makeUnderlying(createMock),
        fastConfig({ circuitBreakerFailures: 2, retries: 0 }),
        registry,
      );

      for (let i = 0; i < 2; i++) {
        await expect(client.responses.create({ model: 'gpt-4o', input: 'hi' })).rejects.toThrow();
      }

      const metric = await registry.getSingleMetricAsString(METRIC_NAMES.circuitOpenTotal);
      expect(metric).toContain('openai_circuit_open_total 1');
    });

    it('records openai_latency_seconds histogram', async () => {
      const createMock = vi.fn().mockResolvedValue(makeResponse());
      const client = new ResilientOpenAIClient(makeUnderlying(createMock), fastConfig(), registry);

      await client.responses.create({ model: 'gpt-4o', input: 'hi' });

      const metric = await registry.getSingleMetricAsString(METRIC_NAMES.latencySeconds);
      expect(metric).toContain('openai_latency_seconds_bucket');
    });

    it('does not throw or produce unhandled rejections on failure', async () => {
      const badError = Object.assign(new Error('fail'), { status: 503 });
      const createMock = vi.fn().mockRejectedValue(badError);

      const client = new ResilientOpenAIClient(
        makeUnderlying(createMock),
        fastConfig({ retries: 0 }),
        registry,
      );

      // Should reject but not crash the process
      await expect(client.responses.create({ model: 'gpt-4o', input: 'hi' })).rejects.toThrow(
        'fail',
      );

      // Metrics should still be recorded
      const metric = await registry.getSingleMetricAsString(METRIC_NAMES.failuresTotal);
      expect(metric).toContain('openai_failures_total');
    });
  });
});
