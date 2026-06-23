import type OpenAI from 'openai';
import type {
  ResponseCreateParamsNonStreaming,
  Response as OpenAIResponse,
} from 'openai/resources/responses/responses';
import { Counter, Histogram, Registry } from 'prom-client';
import type { OpenAIClientConfig } from '../config/openai';
import { getOpenAIClientConfig } from '../config/openai';
import { logger } from '../shared/logger/logger';
import { logError } from '../shared/logger/error-logging';

// ---------------------------------------------------------------------------
// Public error type
// ---------------------------------------------------------------------------

export class ResilientOpenAIError extends Error {
  constructor(
    message: string,
    public readonly code: 'CIRCUIT_OPEN' | 'TIMEOUT' | 'CONCURRENCY_REJECTED' | 'MAX_RETRIES_EXCEEDED',
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ResilientOpenAIError';
  }
}

// ---------------------------------------------------------------------------
// Metric names (exported so callers can reference them)
// ---------------------------------------------------------------------------

export const METRIC_NAMES = {
  requestsTotal: 'openai_requests_total',
  retriesTotal: 'openai_retries_total',
  failuresTotal: 'openai_failures_total',
  circuitOpenTotal: 'openai_circuit_open_total',
  latencySeconds: 'openai_latency_seconds',
} as const;

// ---------------------------------------------------------------------------
// Circuit-breaker states
// ---------------------------------------------------------------------------

type CircuitState = 'closed' | 'open' | 'half-open';

// ---------------------------------------------------------------------------
// OpenAI-like interface (narrow surface used by AIService)
// ---------------------------------------------------------------------------

export interface OpenAIResponsesAPI {
  create(
    params: ResponseCreateParamsNonStreaming,
    options?: OpenAI.RequestOptions,
  ): Promise<OpenAIResponse>;
}

export interface OpenAIClientLike {
  responses: OpenAIResponsesAPI;
}

// ---------------------------------------------------------------------------
// Resilient client
// ---------------------------------------------------------------------------

export class ResilientOpenAIClient implements OpenAIClientLike {
  public readonly responses: OpenAIResponsesAPI;

  private readonly config: OpenAIClientConfig;
  private readonly clientLogger = logger.child({ module: 'ResilientOpenAIClient' });

  // Circuit-breaker state
  private circuitState: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private lastOpenedAt: number | null = null;
  private lastProbeAt: number | null = null;

  // Bulkhead (concurrency limiter)
  private activeRequests = 0;

  // Prometheus metrics (lazily initialized against a shared or injected registry)
  private readonly registry: Registry;
  private readonly metricRequestsTotal: Counter;
  private readonly metricRetriesTotal: Counter;
  private readonly metricFailuresTotal: Counter;
  private readonly metricCircuitOpenTotal: Counter;
  private readonly metricLatency: Histogram;

  constructor(
    private readonly underlying: OpenAIClientLike,
    config?: Partial<OpenAIClientConfig>,
    registry?: Registry,
  ) {
    this.config = { ...getOpenAIClientConfig(), ...config };
    this.registry = registry ?? new Registry();

    this.metricRequestsTotal = new Counter({
      name: METRIC_NAMES.requestsTotal,
      help: 'Total number of outbound OpenAI requests attempted',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.metricRetriesTotal = new Counter({
      name: METRIC_NAMES.retriesTotal,
      help: 'Total number of OpenAI request retry attempts',
      registers: [this.registry],
    });

    this.metricFailuresTotal = new Counter({
      name: METRIC_NAMES.failuresTotal,
      help: 'Total number of failed OpenAI requests (after all retries)',
      labelNames: ['reason'],
      registers: [this.registry],
    });

    this.metricCircuitOpenTotal = new Counter({
      name: METRIC_NAMES.circuitOpenTotal,
      help: 'Total number of times the circuit breaker transitioned to open state',
      registers: [this.registry],
    });

    this.metricLatency = new Histogram({
      name: METRIC_NAMES.latencySeconds,
      help: 'OpenAI request latency in seconds',
      labelNames: ['status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry],
    });

    this.responses = {
      create: (params, options) => this.resilientCreate(params, options),
    };
  }

  // ---------------------------------------------------------------------------
  // Public helpers
  // ---------------------------------------------------------------------------

  /** Returns the current circuit-breaker state for observability / testing. */
  public getCircuitState(): CircuitState {
    return this.circuitState;
  }

  /** Returns the number of currently active (in-flight) requests. */
  public getActiveRequests(): number {
    return this.activeRequests;
  }

  /** Returns the Prometheus registry so callers can expose /metrics if desired. */
  public getRegistry(): Registry {
    return this.registry;
  }

  // ---------------------------------------------------------------------------
  // Core resilient dispatch
  // ---------------------------------------------------------------------------

  private async resilientCreate(
    params: ResponseCreateParamsNonStreaming,
    options?: OpenAI.RequestOptions,
  ): Promise<OpenAIResponse> {
    // Feature-flag bypass: delegate directly to underlying client
    if (!this.config.featureFlagResilient) {
      return this.underlying.responses.create(params, options);
    }

    // --- Circuit-breaker check ---
    if (!this.isCallAllowed()) {
      this.metricFailuresTotal.inc({ reason: 'circuit_open' });
      this.metricRequestsTotal.inc({ status: 'circuit_open' });
      const msg = 'OpenAI circuit breaker is open; request short-circuited';
      this.clientLogger.warn(msg, { circuitState: this.circuitState });
      throw new ResilientOpenAIError(msg, 'CIRCUIT_OPEN');
    }

    // --- Bulkhead / concurrency limiter ---
    if (this.activeRequests >= this.config.concurrency) {
      this.metricFailuresTotal.inc({ reason: 'concurrency_rejected' });
      this.metricRequestsTotal.inc({ status: 'concurrency_rejected' });
      const msg = `OpenAI concurrency limit (${this.config.concurrency}) reached; request rejected`;
      this.clientLogger.warn(msg, { activeRequests: this.activeRequests });
      throw new ResilientOpenAIError(msg, 'CONCURRENCY_REJECTED');
    }

    this.activeRequests++;
    const endTimer = this.metricLatency.startTimer();
    this.metricRequestsTotal.inc({ status: 'attempted' });

    try {
      const result = await this.attemptWithRetry(params, options);
      this.onSuccess();
      this.metricRequestsTotal.inc({ status: 'success' });
      endTimer({ status: 'success' });
      return result;
    } catch (error) {
      this.onFailure(error);
      this.metricFailuresTotal.inc({ reason: 'error' });
      endTimer({ status: 'error' });
      throw error;
    } finally {
      this.activeRequests--;
    }
  }

  // ---------------------------------------------------------------------------
  // Retry loop with exponential backoff + jitter
  // ---------------------------------------------------------------------------

  private async attemptWithRetry(
    params: ResponseCreateParamsNonStreaming,
    options?: OpenAI.RequestOptions,
  ): Promise<OpenAIResponse> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      if (attempt > 0) {
        this.metricRetriesTotal.inc();
        const backoffMs = this.computeBackoffMs(attempt, lastError);
        this.clientLogger.info('Retrying OpenAI request', { attempt, backoffMs });
        await this.sleep(backoffMs);
      }

      try {
        return await this.attemptWithTimeout(params, options);
      } catch (error) {
        lastError = error;

        // Don't retry circuit-open or concurrency errors (they won't be
        // thrown from here, but guard defensively)
        if (error instanceof ResilientOpenAIError) {
          throw error;
        }

        const isLast = attempt === this.config.retries;
        if (isLast) {
          break;
        }

        if (!this.isRetriable(error)) {
          this.clientLogger.warn('Non-retriable OpenAI error; giving up', {
            attempt,
            error: error instanceof Error ? error.message : String(error),
          });
          break;
        }

        logError(this.clientLogger, 'OpenAI request failed; will retry', error, { attempt });
      }
    }

    throw lastError;
  }

  // ---------------------------------------------------------------------------
  // Single attempt with AbortController timeout
  // ---------------------------------------------------------------------------

  private async attemptWithTimeout(
    params: ResponseCreateParamsNonStreaming,
    options?: OpenAI.RequestOptions,
  ): Promise<OpenAIResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.config.timeoutMs);

    try {
      return await this.underlying.responses.create(params, {
        ...options,
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        const msg = `OpenAI request timed out after ${this.config.timeoutMs}ms`;
        this.clientLogger.warn(msg, { timeoutMs: this.config.timeoutMs });
        throw new ResilientOpenAIError(msg, 'TIMEOUT', error);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  // ---------------------------------------------------------------------------
  // Circuit-breaker helpers
  // ---------------------------------------------------------------------------

  private isCallAllowed(): boolean {
    if (this.circuitState === 'closed') {
      return true;
    }

    const now = Date.now();

    if (this.circuitState === 'open') {
      const openedAt = this.lastOpenedAt ?? 0;
      const windowElapsed = now - openedAt >= this.config.circuitBreakerWindowMs;
      const probeIntervalElapsed = now - (this.lastProbeAt ?? 0) >= this.config.circuitBreakerProbeMs;

      if (windowElapsed && probeIntervalElapsed) {
        this.circuitState = 'half-open';
        this.lastProbeAt = now;
        this.clientLogger.info('Circuit breaker transitioning to half-open (probing)', {
          openedAt,
          circuitWindowMs: this.config.circuitBreakerWindowMs,
        });
        return true;
      }
      return false;
    }

    // half-open: allow exactly one probe at a time
    return true;
  }

  private onSuccess(): void {
    if (this.circuitState !== 'closed') {
      this.clientLogger.info('Circuit breaker closing after successful probe', {
        previousState: this.circuitState,
      });
      this.circuitState = 'closed';
    }
    this.consecutiveFailures = 0;
  }

  private onFailure(error: unknown): void {
    this.consecutiveFailures++;

    if (this.circuitState === 'half-open') {
      this.clientLogger.warn('Circuit breaker probe failed; re-opening circuit', {
        consecutiveFailures: this.consecutiveFailures,
      });
      this.openCircuit();
      return;
    }

    if (
      this.circuitState === 'closed' &&
      this.consecutiveFailures >= this.config.circuitBreakerFailures
    ) {
      logError(this.clientLogger, 'Circuit breaker opening after consecutive failures', error, {
        consecutiveFailures: this.consecutiveFailures,
        threshold: this.config.circuitBreakerFailures,
      });
      this.openCircuit();
    }
  }

  private openCircuit(): void {
    this.circuitState = 'open';
    this.lastOpenedAt = Date.now();
    this.metricCircuitOpenTotal.inc();
    this.clientLogger.warn('Circuit breaker is now open', {
      consecutiveFailures: this.consecutiveFailures,
      windowMs: this.config.circuitBreakerWindowMs,
    });
  }

  // ---------------------------------------------------------------------------
  // Retry classification
  // ---------------------------------------------------------------------------

  private isRetriable(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    // Timeout errors are retriable
    if (error instanceof ResilientOpenAIError && error.code === 'TIMEOUT') {
      return true;
    }

    // Network / connection errors
    if (
      error.message.includes('ECONNRESET') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('socket hang up') ||
      error.message.includes('fetch failed') ||
      error.message.includes('network')
    ) {
      return true;
    }

    // OpenAI HTTP status codes: 429 (rate-limit) and 5xx are retriable
    const statusCode = this.getStatusCode(error);
    if (statusCode === 429 || (statusCode !== undefined && statusCode >= 500)) {
      return true;
    }

    return false;
  }

  private getStatusCode(error: unknown): number | undefined {
    if (typeof error === 'object' && error !== null) {
      const status = Reflect.get(error as object, 'status');
      return typeof status === 'number' ? status : undefined;
    }
    return undefined;
  }

  // ---------------------------------------------------------------------------
  // Backoff with full jitter; respects Retry-After header on 429
  // ---------------------------------------------------------------------------

  private computeBackoffMs(attempt: number, error: unknown): number {
    // Honour Retry-After header on 429 responses
    const retryAfterMs = this.extractRetryAfterMs(error);
    if (retryAfterMs !== null) {
      return retryAfterMs;
    }

    // Exponential backoff with full jitter: random(0, base * 2^attempt)
    const cap = this.config.backoffBaseMs * Math.pow(2, attempt);
    return Math.random() * cap;
  }

  private extractRetryAfterMs(error: unknown): number | null {
    if (typeof error !== 'object' || error === null) {
      return null;
    }

    const headers = Reflect.get(error as object, 'headers');
    if (typeof headers !== 'object' || headers === null) {
      return null;
    }

    const retryAfterHeader =
      (Reflect.get(headers as object, 'retry-after') as string | undefined) ??
      (Reflect.get(headers as object, 'Retry-After') as string | undefined);

    if (!retryAfterHeader) {
      return null;
    }

    const seconds = parseFloat(retryAfterHeader);
    if (Number.isFinite(seconds)) {
      return seconds * 1000;
    }

    // Could be an HTTP-date; fall back to default backoff
    return null;
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
  }
}
