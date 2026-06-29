/**
 * Configuration for the resilient OpenAI client.
 * All values are read from environment variables with sensible defaults.
 */

export interface OpenAIClientConfig {
  /** Maximum ms to wait for a single OpenAI request before aborting. */
  timeoutMs: number;
  /** Maximum number of retry attempts on transient errors. */
  retries: number;
  /** Base backoff interval (ms) for exponential backoff with full jitter. */
  backoffBaseMs: number;
  /** Number of consecutive failures required to open the circuit breaker. */
  circuitBreakerFailures: number;
  /** Duration (ms) the circuit stays open before allowing a probe. */
  circuitBreakerWindowMs: number;
  /** Minimum interval (ms) between probe attempts while the circuit is open. */
  circuitBreakerProbeMs: number;
  /** Maximum number of concurrent outbound OpenAI calls. */
  concurrency: number;
  /**
   * When true (default), requests are wrapped with timeouts, retries,
   * the circuit breaker, and the concurrency limiter.
   * Set FEATURE_FLAG_RESILIENT_OPENAI=false to bypass all resilience logic
   * and delegate directly to the underlying OpenAI client.
   */
  featureFlagResilient: boolean;
}

const parseIntWithDefault = (value: string | undefined, defaultValue: number): number => {
  const parsed = parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

export const getOpenAIClientConfig = (): OpenAIClientConfig => ({
  timeoutMs: Math.max(1, parseIntWithDefault(process.env.OPENAI_TIMEOUT_MS, 30_000)),
  retries: Math.max(0, parseIntWithDefault(process.env.OPENAI_RETRIES, 3)),
  backoffBaseMs: Math.max(0, parseIntWithDefault(process.env.OPENAI_BACKOFF_BASE_MS, 500)),
  circuitBreakerFailures: Math.max(1, parseIntWithDefault(process.env.CIRCUIT_BREAKER_FAILURES, 5)),
  circuitBreakerWindowMs: Math.max(1, parseIntWithDefault(process.env.CIRCUIT_BREAKER_WINDOW_MS, 60_000)),
  circuitBreakerProbeMs: Math.max(1, parseIntWithDefault(process.env.CIRCUIT_BREAKER_PROBE_MS, 30_000)),
  concurrency: Math.max(1, parseIntWithDefault(process.env.OPENAI_CONCURRENCY, 10)),
  featureFlagResilient: process.env.FEATURE_FLAG_RESILIENT_OPENAI !== 'false',
});
