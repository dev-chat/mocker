# Streaming Responses & Thread Awareness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add thread awareness and Slack native streaming to @Moonbeam responses so users see a shimmer loading indicator and word-by-word text as the AI generates.

**Architecture:** Add `thread_ts` to the Event model so the bot knows when a message is in a thread. Pass the message `ts` (or `thread_ts` if already in a thread) to `participate()`, which uses Slack's `chatStream()` API to stream OpenAI's response in real time. The response appears as a threaded reply under the user's message. Falls back to `sendMessage()` if streaming fails.

**Tech Stack:** `@slack/web-api ^7.15.0` (ChatStreamer, chatStream), `openai ^4.103.0` (streaming responses), TypeScript, Jest

---

## File Structure

| File                                                           | Action | Responsibility                                     |
| -------------------------------------------------------------- | ------ | -------------------------------------------------- |
| `packages/backend/src/shared/models/slack/slack-models.ts`     | Modify | Add `thread_ts` to `Event` interface               |
| `packages/backend/src/shared/services/web/web.service.ts`      | Modify | Add `startStream()` method                         |
| `packages/backend/src/ai/ai.service.ts`                        | Modify | Thread-aware `handle()`, streaming `participate()` |
| `packages/backend/src/test/mocks/slack-web-api.mock.ts`        | Modify | Add `chatStream` mock                              |
| `packages/backend/src/shared/services/web/web.service.spec.ts` | Modify | Add `startStream()` tests                          |
| `packages/backend/src/ai/ai.service.spec.ts`                   | Modify | Update `handle()` and `participate()` tests        |

---

### Task 1: Add `thread_ts` to Event interface

**Files:**

- Modify: `packages/backend/src/shared/models/slack/slack-models.ts:38-62`

- [ ] **Step 1: Add `thread_ts` to the `Event` interface**

In `packages/backend/src/shared/models/slack/slack-models.ts`, add `thread_ts` as an optional field to the `Event` interface, after the existing `ts` field on line 45:

```typescript
export interface Event {
  client_msg_id: string;
  type: string;
  subtype: string;
  text: string;
  user: string;
  username: string;
  ts: string;
  thread_ts?: string;
  channel: string;
  event_ts: string;
  channel_type: string;
  authed_users: string[];
  attachments: Event[];
  pretext: string;
  callback_id: string;
  item_user: string;
  reaction: string;
  item: EventItem; // Needs work, not optional either.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks: Record<any, any>[]; // same same
  bot_id: string;
  bot_profile: {
    name: string;
  };
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build:backend`
Expected: Clean compilation with no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/shared/models/slack/slack-models.ts
git commit -m "feat: add thread_ts to Event interface for thread awareness"
```

---

### Task 2: Add `chatStream` to the Slack mock and `startStream()` to WebService

**Files:**

- Modify: `packages/backend/src/test/mocks/slack-web-api.mock.ts`
- Modify: `packages/backend/src/shared/services/web/web.service.spec.ts`
- Modify: `packages/backend/src/shared/services/web/web.service.ts`

- [ ] **Step 1: Add `chatStream` to the Slack WebClient mock**

In `packages/backend/src/test/mocks/slack-web-api.mock.ts`, add a `chatStream` method that returns a mock `ChatStreamer` object with `append` and `stop` methods:

```typescript
type SlackResult = Record<string, unknown> & { ok: boolean };

const okResult = (): SlackResult => ({ ok: true });

export class WebClient {
  chat = {
    delete: jest.fn().mockResolvedValue(okResult()),
    postEphemeral: jest.fn().mockResolvedValue(okResult()),
    postMessage: jest.fn().mockResolvedValue(okResult()),
    update: jest.fn().mockResolvedValue(okResult()),
  };

  users = {
    list: jest.fn().mockResolvedValue({ ok: true, members: [] }),
  };

  conversations = {
    list: jest.fn().mockResolvedValue({ ok: true, channels: [] }),
  };

  files = {
    upload: jest.fn().mockResolvedValue(okResult()),
  };

  chatStream = jest.fn().mockReturnValue({
    append: jest.fn().mockResolvedValue(null),
    stop: jest.fn().mockResolvedValue(okResult()),
  });

  constructor(_token?: string) {
    void _token;
  }
}
```

- [ ] **Step 2: Write the failing test for `startStream()`**

Add a new `describe` block to `packages/backend/src/shared/services/web/web.service.spec.ts`:

```typescript
describe('startStream', () => {
  it('calls chatStream with channel, thread_ts, and token', () => {
    const streamer = webService.startStream('C1', '1700000001.123456');

    expect(mockWebClient.chatStream).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'C1',
        thread_ts: '1700000001.123456',
      }),
    );
    expect(streamer).toBeDefined();
    expect(streamer.append).toBeDefined();
    expect(streamer.stop).toBeDefined();
  });
});
```

Also update the `MockWebClient` type at the top of the test file to include `chatStream`:

```typescript
type MockWebClient = {
  chat: {
    postMessage: jest.Mock;
    delete: jest.Mock;
    postEphemeral: jest.Mock;
    update: jest.Mock;
  };
  users: { list: jest.Mock };
  conversations: { list: jest.Mock };
  files: { upload: jest.Mock };
  chatStream: jest.Mock;
};
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test:backend -- --testPathPattern="web.service.spec" --verbose`
Expected: FAIL — `webService.startStream is not a function`

- [ ] **Step 4: Implement `startStream()` in WebService**

In `packages/backend/src/shared/services/web/web.service.ts`, add the import for `ChatStreamer` and the new method:

Add to the imports at the top:

```typescript
import type {
  ChatDeleteArguments,
  ChatPostMessageArguments,
  FilesUploadArguments,
  WebAPICallResult,
  ChatPostEphemeralArguments,
  ChatUpdateArguments,
  KnownBlock,
  Block,
  ConversationsListResponse,
  UsersListResponse,
} from '@slack/web-api';
import { WebClient } from '@slack/web-api';
import type { ChatStreamer } from '@slack/web-api/dist/chat-stream';
import { logError } from '../../logger/error-logging';
import { logger } from '../../logger/logger';
```

Add the method to the `WebService` class, after `editMessage()`:

```typescript
  public startStream(channel: string, threadTs: string): ChatStreamer {
    return this.web.chatStream({
      channel,
      thread_ts: threadTs,
      token: process.env.MUZZLE_BOT_USER_TOKEN,
    });
  }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:backend -- --testPathPattern="web.service.spec" --verbose`
Expected: All tests PASS, including the new `startStream` test.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/test/mocks/slack-web-api.mock.ts packages/backend/src/shared/services/web/web.service.ts packages/backend/src/shared/services/web/web.service.spec.ts
git commit -m "feat: add startStream() to WebService for Slack chat streaming"
```

---

### Task 3: Update `handle()` to pass thread context

**Files:**

- Modify: `packages/backend/src/ai/ai.service.ts:780-790`
- Modify: `packages/backend/src/ai/ai.service.spec.ts` (handle tests)

- [ ] **Step 1: Write the failing test for thread_ts passthrough**

In `packages/backend/src/ai/ai.service.spec.ts`, update the existing `handle` describe block. Add a new test and update the existing test to verify `threadTs` is passed:

```typescript
it('passes event.ts as threadTs when not in a thread', async () => {
  (aiService.slackService.containsTag as jest.Mock).mockReturnValue(true);
  (aiService.slackService.isUserMentioned as jest.Mock).mockReturnValue(true);
  (aiService.muzzlePersistenceService.isUserMuzzled as jest.Mock).mockResolvedValue(false);
  const participateSpy = jest.spyOn(aiService, 'participate').mockResolvedValue();

  await aiService.handle({
    team_id: 'T1',
    event: {
      user: 'U1',
      channel: 'C1',
      text: `<@${MOONBEAM_SLACK_ID}> hello`,
      ts: '1700000001.123456',
    },
  } as never);

  expect(participateSpy).toHaveBeenCalledWith('T1', 'C1', `<@${MOONBEAM_SLACK_ID}> hello`, 'U1', '1700000001.123456');
});

it('passes event.thread_ts as threadTs when in a thread', async () => {
  (aiService.slackService.containsTag as jest.Mock).mockReturnValue(true);
  (aiService.slackService.isUserMentioned as jest.Mock).mockReturnValue(true);
  (aiService.muzzlePersistenceService.isUserMuzzled as jest.Mock).mockResolvedValue(false);
  const participateSpy = jest.spyOn(aiService, 'participate').mockResolvedValue();

  await aiService.handle({
    team_id: 'T1',
    event: {
      user: 'U1',
      channel: 'C1',
      text: `<@${MOONBEAM_SLACK_ID}> hello`,
      ts: '1700000002.654321',
      thread_ts: '1700000001.123456',
    },
  } as never);

  expect(participateSpy).toHaveBeenCalledWith('T1', 'C1', `<@${MOONBEAM_SLACK_ID}> hello`, 'U1', '1700000001.123456');
});
```

Also update the existing `'participates when Moonbeam is tagged and user is not muzzled'` test to include `ts` in the event and expect the 5th argument:

```typescript
it('participates when Moonbeam is tagged and user is not muzzled', async () => {
  (aiService.slackService.containsTag as jest.Mock).mockReturnValue(true);
  (aiService.slackService.isUserMentioned as jest.Mock).mockReturnValue(true);
  (aiService.muzzlePersistenceService.isUserMuzzled as jest.Mock).mockResolvedValue(false);
  const participateSpy = jest.spyOn(aiService, 'participate').mockResolvedValue();

  await aiService.handle({
    team_id: 'T1',
    event: {
      user: 'U1',
      channel: 'C1',
      text: `<@${MOONBEAM_SLACK_ID}> hello`,
      ts: '1700000001.000000',
    },
  } as never);

  expect(participateSpy).toHaveBeenCalledWith('T1', 'C1', `<@${MOONBEAM_SLACK_ID}> hello`, 'U1', '1700000001.000000');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:backend -- --testPathPattern="ai.service.spec" --verbose`
Expected: FAIL — `participate` called with 4 args, expected 5.

- [ ] **Step 3: Update `handle()` to pass threadTs**

In `packages/backend/src/ai/ai.service.ts`, update the `handle()` method (lines 780-790):

```typescript
  async handle(request: EventRequest): Promise<void> {
    const isUserMuzzled = await this.muzzlePersistenceService.isUserMuzzled(request.event.user, request.team_id);
    if (this.slackService.containsTag(request.event.text) && !isUserMuzzled) {
      // Check if Moonbeam is mentioned ANYWHERE in the message (not just first mention)
      const isMoonbeamTagged = this.slackService.isUserMentioned(request.event.text, MOONBEAM_SLACK_ID);
      const isPosterMoonbeam = request.event.user === MOONBEAM_SLACK_ID;
      if (isMoonbeamTagged && !isPosterMoonbeam) {
        const threadTs = request.event.thread_ts ?? request.event.ts;
        void this.participate(
          request.team_id,
          request.event.channel,
          request.event.text,
          request.event.user,
          threadTs,
        );
      }
    }
  }
```

- [ ] **Step 4: Update `participate()` signature to accept threadTs**

Change the signature on line 441 from:

```typescript
public async participate(teamId: string, channelId: string, taggedMessage: string, userId?: string): Promise<void> {
```

to:

```typescript
public async participate(teamId: string, channelId: string, taggedMessage: string, userId?: string, threadTs?: string): Promise<void> {
```

Do NOT change the body yet — just the signature. The streaming implementation is Task 4.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:backend -- --testPathPattern="ai.service.spec" --verbose`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/ai/ai.service.ts packages/backend/src/ai/ai.service.spec.ts
git commit -m "feat: pass thread context from handle() to participate()"
```

---

### Task 4: Refactor `participate()` to use streaming

**Files:**

- Modify: `packages/backend/src/ai/ai.service.ts:441-499`
- Modify: `packages/backend/src/ai/ai.service.spec.ts`

- [ ] **Step 1: Write the failing test for streaming participate**

In `packages/backend/src/ai/ai.service.spec.ts`, first update `buildAiService()` to add `startStream` to the mock webService:

```typescript
ai.webService = {
  sendMessage: jest.fn().mockResolvedValue({ ok: true }),
  startStream: jest.fn().mockReturnValue({
    append: jest.fn().mockResolvedValue(null),
    stop: jest.fn().mockResolvedValue({ ok: true }),
  }),
} as unknown as AIService['webService'];
```

Then add new tests in the `describe('handle', ...)` block or create a new `describe('participate', ...)` block:

```typescript
describe('participate', () => {
  it('streams response to Slack when threadTs is provided', async () => {
    const mockAppend = jest.fn().mockResolvedValue(null);
    const mockStop = jest.fn().mockResolvedValue({ ok: true });
    (aiService.webService.startStream as jest.Mock).mockReturnValue({
      append: mockAppend,
      stop: mockStop,
    });

    const mockStream = {
      async *[Symbol.asyncIterator]() {
        yield { type: 'response.output_text.delta', delta: 'Hello ' };
        yield { type: 'response.output_text.delta', delta: 'world!' };
      },
    };
    (aiService.openAi.responses.create as jest.Mock).mockResolvedValue(mockStream);

    await aiService.participate('T1', 'C1', 'hey @Moonbeam', 'U1', '1700000001.123456');

    expect(aiService.webService.startStream).toHaveBeenCalledWith('C1', '1700000001.123456');
    expect(mockAppend).toHaveBeenCalledWith({ markdown_text: 'Hello ' });
    expect(mockAppend).toHaveBeenCalledWith({ markdown_text: 'world!' });
    expect(mockStop).toHaveBeenCalled();
  });

  it('falls back to sendMessage when threadTs is not provided', async () => {
    (aiService.openAi.responses.create as jest.Mock).mockResolvedValue({
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'Response text' }] }],
    });

    await aiService.participate('T1', 'C1', 'hey @Moonbeam', 'U1');

    expect(aiService.webService.startStream).not.toHaveBeenCalled();
    expect(aiService.webService.sendMessage).toHaveBeenCalledWith('C1', 'Response text', [
      { type: 'markdown', text: 'Response text' },
    ]);
  });

  it('falls back to sendMessage when streaming throws', async () => {
    (aiService.webService.startStream as jest.Mock).mockImplementation(() => {
      throw new Error('streaming not available');
    });
    (aiService.openAi.responses.create as jest.Mock).mockResolvedValue({
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'Fallback text' }] }],
    });

    await aiService.participate('T1', 'C1', 'hey @Moonbeam', 'U1', '1700000001.123456');

    expect(aiService.webService.sendMessage).toHaveBeenCalledWith('C1', 'Fallback text', [
      { type: 'markdown', text: 'Fallback text' },
    ]);
  });

  it('stops stream cleanly on OpenAI error', async () => {
    const mockAppend = jest.fn().mockResolvedValue(null);
    const mockStop = jest.fn().mockResolvedValue({ ok: true });
    (aiService.webService.startStream as jest.Mock).mockReturnValue({
      append: mockAppend,
      stop: mockStop,
    });

    const mockStream = {
      async *[Symbol.asyncIterator]() {
        yield { type: 'response.output_text.delta', delta: 'partial' };
        throw new Error('OpenAI stream error');
      },
    };
    (aiService.openAi.responses.create as jest.Mock).mockResolvedValue(mockStream);

    await expect(aiService.participate('T1', 'C1', 'hey @Moonbeam', 'U1', '1700000001.123456')).rejects.toThrow(
      'OpenAI stream error',
    );

    expect(mockStop).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:backend -- --testPathPattern="ai.service.spec" --verbose`
Expected: FAIL — streaming logic not yet implemented.

- [ ] **Step 3: Implement streaming in `participate()`**

Replace the `participate()` method body in `packages/backend/src/ai/ai.service.ts` (lines 441-499) with:

```typescript
  public async participate(
    teamId: string,
    channelId: string,
    taggedMessage: string,
    userId?: string,
    threadTs?: string,
  ): Promise<void> {
    await this.redis.setParticipationInFlight(channelId, teamId);

    try {
      const historyMessages = await this.historyService.getHistoryWithOptions({
        teamId,
        channelId,
        maxMessages: 200,
        timeWindowMinutes: 120,
      });

      const history = this.formatHistory(historyMessages);

      const customPrompt = userId ? await this.slackPersistenceService.getCustomPrompt(userId, teamId) : null;
      const normalizedCustomPrompt = customPrompt?.trim() || null;

      const participantSlackIds = this.extractParticipantSlackIds(historyMessages, {
        excludeSlackIds: [MOONBEAM_SLACK_ID],
      });
      const memoryContext = await this.fetchMemoryContext(participantSlackIds, teamId, history, historyMessages);
      const baseInstructions = normalizedCustomPrompt ?? MOONBEAM_SYSTEM_INSTRUCTIONS;
      const systemInstructions = this.appendMemoryContext(baseInstructions, memoryContext);

      const input = `${history}\n\n---\n[Tagged message to respond to]:\n${taggedMessage}`;

      if (threadTs) {
        await this.participateWithStreaming(channelId, teamId, systemInstructions, input, threadTs);
      } else {
        await this.participateWithMessage(channelId, teamId, systemInstructions, input);
      }

      await this.redis.setHasParticipated(teamId, channelId);
    } catch (e) {
      logError(this.aiServiceLogger, 'Failed to generate AI participation response', e, {
        teamId,
        channelId,
        taggedMessage,
      });
      throw e;
    } finally {
      void this.redis.removeParticipationInFlight(channelId, teamId);
    }
  }

  private async participateWithStreaming(
    channelId: string,
    teamId: string,
    instructions: string,
    input: string,
    threadTs: string,
  ): Promise<void> {
    let streamer;
    try {
      streamer = this.webService.startStream(channelId, threadTs);
    } catch (e) {
      this.aiServiceLogger.warn('Failed to start Slack stream, falling back to sendMessage', e);
      return this.participateWithMessage(channelId, teamId, instructions, input);
    }

    try {
      const stream = await this.openAi.responses.create({
        model: GPT_MODEL,
        tools: [{ type: 'web_search_preview' }],
        instructions,
        input,
        stream: true,
        user: `participation-${channelId}-${teamId}-DaBros2016`,
      });

      for await (const event of stream) {
        if (event.type === 'response.output_text.delta') {
          await streamer.append({ markdown_text: event.delta });
        }
      }

      await streamer.stop();
    } catch (e) {
      await streamer.stop().catch((stopErr: unknown) => {
        this.aiServiceLogger.warn('Failed to stop stream after error', stopErr);
      });
      throw e;
    }
  }

  private async participateWithMessage(
    channelId: string,
    _teamId: string,
    instructions: string,
    input: string,
  ): Promise<void> {
    const response = await this.openAi.responses.create({
      model: GPT_MODEL,
      tools: [{ type: 'web_search_preview' }],
      instructions,
      input,
      user: `participation-${channelId}-${_teamId}-DaBros2016`,
    });

    const result = extractAndParseOpenAiResponse(response);
    if (result) {
      await this.webService.sendMessage(channelId, result, [{ type: 'markdown', text: result }]);
    }
  }
```

Add the `Stream` and `ResponseStreamEvent` import at the top of `ai.service.ts` if the compiler requires it. The `for await` loop handles the `Stream<ResponseStreamEvent>` return type from `create({ stream: true })` automatically.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:backend -- --testPathPattern="ai.service.spec" --verbose`
Expected: All tests PASS.

- [ ] **Step 5: Run the full test suite**

Run: `npm run test:backend`
Expected: All tests PASS, no regressions.

- [ ] **Step 6: Verify the build compiles**

Run: `npm run build:backend`
Expected: Clean compilation.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/ai/ai.service.ts packages/backend/src/ai/ai.service.spec.ts
git commit -m "feat: stream @Moonbeam responses via Slack chatStream API

When a user @mentions Moonbeam, the response now streams word-by-word
with a native Slack shimmer loading indicator. Replies appear as
threaded responses under the user's message. Falls back to the
previous sendMessage() behavior when no thread context is available."
```

---

### Task 5: Verify end-to-end and create PR

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npm run test:backend`
Expected: All tests PASS.

- [ ] **Step 2: Run lint and format checks**

Run: `npm run lint && npm run format:check`
Expected: No errors.

- [ ] **Step 3: Run the build**

Run: `npm run build:backend`
Expected: Clean compilation.

- [ ] **Step 4: Create feature branch and push**

```bash
git checkout -b feature/streaming-responses
git push -u origin feature/streaming-responses
```

- [ ] **Step 5: Create the PR**

Create a PR against `dev-chat/mocker` upstream `master` branch with:

- Title: `feat: stream @Moonbeam responses with shimmer UX and thread awareness`
- Body summarizing: thread awareness fix, streaming via chatStream, fallback behavior
- Note: requires enabling "Agents & AI Apps" in Slack app settings and reinstalling

---

## Prerequisites (Manual, before deploying)

These are Slack admin tasks that must be done before the streaming feature works in production:

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and select the Moonbeam app
2. Enable **"Agents & AI Apps"** in the app settings
3. This automatically adds the `assistant:write` scope
4. Reinstall the app to the workspace to activate the new scope
