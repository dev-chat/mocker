# Streaming Responses & Thread Awareness for @Moonbeam

**Date:** 2026-03-27
**Status:** Draft
**PR Target:** `dev-chat/mocker` upstream

## Problem

When a user `@Moonbeam`s in a channel or thread, two things are broken:

1. **No feedback while processing.** The bot fetches 200 messages of history, calls OpenAI, and formats a response — all silently. The user has no indication Moonbeam is working.
2. **No thread awareness.** The `Event` model doesn't capture `thread_ts`, so when someone @mentions Moonbeam inside a thread, the response posts to the channel instead of replying in-thread.

## Solution

Add thread awareness and use Slack's native streaming API (`chatStream()`) to stream Moonbeam's responses word-by-word with a shimmer loading indicator.

## How It Works

### User Experience

1. User posts `@Moonbeam what do you think?` in a channel (or thread)
2. A shimmer/loading indicator appears immediately as a threaded reply under the user's message
3. Text streams in progressively as OpenAI generates it
4. The final message locks in place with formatting

For channel mentions, the user's message becomes the thread anchor — the streamed reply appears as a thread under it. Slack shows thread previews inline in the channel, so the response is visible without clicking into the thread.

For thread mentions, the streamed reply appears directly in the existing thread.

### Technical Flow

```
User @Moonbeam in channel/thread
    |
    v
handle() receives EventRequest
    |-- event.ts = message timestamp
    |-- event.thread_ts = thread timestamp (if in a thread)
    |
    v
threadTs = event.thread_ts ?? event.ts
    |
    v
participate(teamId, channelId, text, userId, threadTs)
    |
    |-- 1. Fetch history, memories, custom prompt (unchanged)
    |-- 2. Build system instructions (unchanged)
    |
    |-- 3. Start Slack stream
    |       webService.startStream(channelId, threadTs)
    |       -> shimmer appears immediately
    |
    |-- 4. Stream OpenAI response
    |       openAi.responses.stream({ ..., stream: true })
    |       for each text delta:
    |           streamer.append({ markdown_text: delta })
    |       -> text appears word-by-word in Slack
    |
    |-- 5. Finalize
    |       streamer.stop()
    |       -> final message locks in place
    |
    v
Done
```

## Changes Required

### 1. `Event` interface — `packages/backend/src/shared/models/slack/slack-models.ts`

Add `thread_ts` to the `Event` interface. Slack already sends this field on every threaded message — the codebase just doesn't capture it.

```typescript
// Add to Event interface:
thread_ts?: string;
```

Also add `ts` capture — the message timestamp is already in the interface but we need to ensure it's available for the thread anchor use case.

### 2. `handle()` — `packages/backend/src/ai/ai.service.ts`

Pass thread context into `participate()`. Use `thread_ts` if the message is in a thread, otherwise use the message's own `ts` as the thread anchor.

```typescript
// Determine thread context: reply in existing thread, or create one from the message
const threadTs = request.event.thread_ts ?? request.event.ts;
void this.participate(request.team_id, request.event.channel, request.event.text, request.event.user, threadTs);
```

### 3. `participate()` — `packages/backend/src/ai/ai.service.ts`

**Signature change:** Add `threadTs` parameter.

**Core change:** Replace the non-streaming OpenAI call + `sendMessage()` with:

1. Start a Slack `ChatStreamer` via `webService.startStream()`
2. Switch to OpenAI streaming (`responses.stream()` or `responses.create()` with `stream: true`)
3. Loop over stream events, appending text deltas to the Slack streamer
4. Call `streamer.stop()` to finalize

**Error handling:** If streaming fails mid-way, catch the error and attempt to stop the stream cleanly. Log the error as today.

**Fallback:** If `startStream` fails (e.g., missing scope), fall back to the current `sendMessage()` behavior so the bot doesn't silently fail.

### 4. `WebService` — `packages/backend/src/shared/services/web/web.service.ts`

Add a `startStream()` method that wraps `WebClient.chatStream()`:

```typescript
public startStream(channel: string, threadTs: string): ChatStreamer {
  return this.web.chatStream({
    channel,
    thread_ts: threadTs,
    token: process.env.MUZZLE_BOT_USER_TOKEN,
  });
}
```

The `ChatStreamer` class (from `@slack/web-api`) handles buffering (default 256 chars) and exposes `.append()` and `.stop()`.

## Prerequisites

### Slack App Configuration

- Enable **"Agents & AI Apps"** in the Slack app settings dashboard
- This automatically adds the `assistant:write` scope
- Reinstall the app to the workspace to pick up the new scope
- No guest users are affected (workspace has zero guests)

### No SDK Changes Needed

- `@slack/web-api ^7.15.0` already includes `chatStream()`, `ChatStreamer`, and all streaming types
- OpenAI SDK `^4.103.0` already supports streaming via `responses.stream()` or `stream: true`

## Files Modified

| File                                                       | Change                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `packages/backend/src/shared/models/slack/slack-models.ts` | Add `thread_ts` to `Event` interface                                            |
| `packages/backend/src/ai/ai.service.ts`                    | Update `handle()` to pass `threadTs`; refactor `participate()` to use streaming |
| `packages/backend/src/shared/services/web/web.service.ts`  | Add `startStream()` method                                                      |

## Out of Scope

- Streaming for slash command responses (`/ai`, `/ai-history`) — these use a different flow and can be addressed in a follow-up
- `assistant.threads.setStatus` with `loading_messages` — the `chatStream()` shimmer is sufficient; explicit status messages are additive polish
- Streaming for image generation — not applicable
- Changes to the `redeployMoonbeam()` or `generateCorpoSpeak()` flows

## Risks

- **Agents & AI Apps scope:** Enabling this feature on the Slack app locks out workspace guests. Confirmed: zero guests in this workspace.
- **Rate limits:** `chatStream()` buffers 256 chars by default before flushing, which helps avoid rate limits. If responses are very long, we may need to increase the buffer.
- **OpenAI streaming with tools:** The `web_search_preview` tool is used in `participate()`. When streaming, tool calls arrive as separate events before the text response. We need to handle these correctly (wait for tool results, then stream the text).

## Testing Plan

- [ ] @Moonbeam in a channel — verify shimmer appears, text streams, final message renders correctly
- [ ] @Moonbeam in an existing thread — verify reply stays in-thread with streaming
- [ ] @Moonbeam when muzzled — verify no response (unchanged behavior)
- [ ] @Moonbeam by Moonbeam itself — verify no self-reply (unchanged behavior)
- [ ] OpenAI error mid-stream — verify stream stops cleanly, error is logged
- [ ] Slack streaming API error — verify fallback to `sendMessage()`
