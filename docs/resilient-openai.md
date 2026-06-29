# Resilient OpenAI Client

This document describes the resilient OpenAI wrapper introduced in
`packages/backend/src/lib/resilientOpenAIClient.ts`. The wrapper prevents
transient or sustained OpenAI failures from cascading and taking down the
broader Moonbeam service.

---

## Overview

`ResilientOpenAIClient` wraps the official `openai` SDK client and adds:

| Feature                                                  | Default                            |
| -------------------------------------------------------- | ---------------------------------- |
| Per-request timeout                                      | 30 s                               |
| Automatic retries with exponential backoff + full jitter | 3 retries                          |
| `Retry-After` header honored on 429 responses            | yes                                |
| Circuit breaker                                          | opens after 5 consecutive failures |
| Concurrency / bulkhead limiter                           | 10 concurrent calls                |
| Graceful degradation via `ResilientOpenAIError`          | yes                                |
| Structured logging (Winston)                             | yes                                |
| Prometheus metrics (`prom-client`)                       | yes                                |

The wrapper exposes the same narrow `responses.create` surface used by
`AIService`, so the change is a drop-in replacement.

---

## Feature flag

Set the environment variable `FEATURE_FLAG_RESILIENT_OPENAI` to `false` to
bypass all resilience logic and delegate directly to the underlying OpenAI SDK
client. This is the rollback switch.

```
FEATURE_FLAG_RESILIENT_OPENAI=false   # bypass resilience (rollback)
FEATURE_FLAG_RESILIENT_OPENAI=true    # enable resilience (default)
```

---

## Environment variables

All variables are optional. Defaults are shown.

| Variable                        | Default | Description                                                   |
| ------------------------------- | ------- | ------------------------------------------------------------- |
| `FEATURE_FLAG_RESILIENT_OPENAI` | `true`  | Set to `false` to bypass the wrapper entirely.                |
| `OPENAI_TIMEOUT_MS`             | `30000` | Maximum ms to wait for a single request before aborting.      |
| `OPENAI_RETRIES`                | `3`     | Maximum retry attempts on transient errors.                   |
| `OPENAI_BACKOFF_BASE_MS`        | `500`   | Base interval (ms) for exponential backoff with full jitter.  |
| `CIRCUIT_BREAKER_FAILURES`      | `5`     | Consecutive failures needed to open the circuit.              |
| `CIRCUIT_BREAKER_WINDOW_MS`     | `60000` | Duration (ms) the circuit stays open before allowing a probe. |
| `CIRCUIT_BREAKER_PROBE_MS`      | `30000` | Minimum interval (ms) between probe attempts while open.      |
| `OPENAI_CONCURRENCY`            | `10`    | Maximum concurrent outbound OpenAI calls per instance.        |

Configuration is loaded by `packages/backend/src/config/openai.ts` which reads
these variables at instantiation time with sensible defaults.

---

## Retry behaviour

Requests are retried when the error is classified as _retriable_:

- HTTP 429 (rate limit) — also extracts `Retry-After` header and waits
  accordingly before retrying.
- HTTP 5xx (server errors).
- Network / connection errors (`ECONNRESET`, `ETIMEDOUT`, socket hang-up,
  `fetch failed`, etc.).
- `ResilientOpenAIError` with code `TIMEOUT`.

Non-retriable errors (4xx other than 429, business-logic errors) are surfaced
immediately.

Backoff is computed as:

```
sleep = random(0, backoffBaseMs * 2^attempt)   # full jitter
```

If a `Retry-After` header is present on a 429 response, that duration (in
seconds) overrides the computed backoff.

---

## Circuit-breaker states

```
CLOSED ──(N consecutive failures)──► OPEN
  ▲                                    │
  │   (probe succeeds)       (window + probe interval elapsed)
  └──────── HALF-OPEN ◄────────────────┘
                │
          (probe fails)
                │
              OPEN
```

- **CLOSED**: normal operation.
- **OPEN**: calls are short-circuited immediately with
  `ResilientOpenAIError(code: 'CIRCUIT_OPEN')`. No requests reach OpenAI.
- **HALF-OPEN**: one probe call is allowed through. If it succeeds the circuit
  closes; if it fails the circuit re-opens.

The current state is observable via `client.getCircuitState()`.

---

## Concurrency limiter

At most `OPENAI_CONCURRENCY` requests may be in-flight simultaneously.
Additional requests are rejected immediately with
`ResilientOpenAIError(code: 'CONCURRENCY_REJECTED')`.

`client.getActiveRequests()` returns the current in-flight count.

---

## Error types

```typescript
import { ResilientOpenAIError } from '../lib/resilientOpenAIClient';

try {
  await openAi.responses.create({ ... });
} catch (err) {
  if (err instanceof ResilientOpenAIError) {
    // err.code is one of:
    //   'CIRCUIT_OPEN'        – circuit is open, request was not sent
    //   'TIMEOUT'             – request exceeded OPENAI_TIMEOUT_MS
    //   'CONCURRENCY_REJECTED'– too many concurrent requests
    //   'MAX_RETRIES_EXCEEDED'– reserved for future use
    handleDegradedMode(err.code);
  }
}
```

Upstream code (e.g. `AIService`) can check `err instanceof ResilientOpenAIError`
to distinguish transient/infrastructure failures from application errors and
return appropriate degraded UX to users.

---

## Metrics

The client registers the following Prometheus metrics via `prom-client`. Each
`ResilientOpenAIClient` instance uses its own `Registry` so multiple instances
in the same process do not collide. Expose the registry on a `/metrics`
endpoint if Prometheus scraping is desired.

| Metric                      | Type      | Description                                                                                                        |
| --------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------ |
| `openai_requests_total`     | Counter   | Total requests attempted, labelled `status` (`attempted`, `success`, `circuit_open`, `concurrency_rejected`).      |
| `openai_retries_total`      | Counter   | Total retry attempts.                                                                                              |
| `openai_failures_total`     | Counter   | Total failed requests after all retries, labelled `reason` (`error`, `circuit_open`, `concurrency_rejected`).      |
| `openai_circuit_open_total` | Counter   | Number of times the circuit transitioned to open.                                                                  |
| `openai_latency_seconds`    | Histogram | End-to-end request latency in seconds, labelled `status` (`success`, `error`). Buckets: 0.1, 0.5, 1, 2, 5, 10, 30. |

---

## Logging

The wrapper emits structured Winston logs (child logger `ResilientOpenAIClient`)
for:

- Per-retry failures (level `info`).
- Non-retriable errors (level `warn`).
- Timeout aborts (level `warn`).
- Circuit-breaker state transitions (level `info` / `warn`).
- Concurrency limit reached (level `warn`).

---

## Rollout / migration plan

### Phase 1 — Behind feature flag (current state)

The wrapper is **enabled by default** (`FEATURE_FLAG_RESILIENT_OPENAI=true`).

1. **Deploy to staging** — verify smoke tests pass; inspect logs and metrics.
2. **Enable in a canary production host** — monitor `openai_failures_total`,
   `openai_circuit_open_total`, and p99 latency via `openai_latency_seconds`.
3. **Gradually roll out** across all production instances while monitoring the
   metrics above and Sentry/Datadog error rates.

### Phase 2 — Stabilisation

Once the canary shows stable behaviour for 24–48 h:

- Enable for all production instances.
- Set alerting on `openai_circuit_open_total > 0` and high
  `openai_failures_total` rates.

### Rollback

If issues occur at any phase, flip the feature flag:

```
FEATURE_FLAG_RESILIENT_OPENAI=false
```

Restart the service. The wrapper delegates directly to the underlying OpenAI
SDK; no other code changes are required.

### Phase 3 — Cleanup (future)

After the feature has been stable in production for a sprint:

- Remove the `featureFlagResilient` branch and env-var check.
- Remove the `FEATURE_FLAG_RESILIENT_OPENAI` documentation references.
