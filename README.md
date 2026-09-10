# Mocker

A Slack app that lets you mock your friends. Features real-time reactions, reputation tracking, game modes (Muzzle, Backfire, Counter, etc.), AI-powered summaries, and a web-based search interface for message history with team-scoped access control.

## Architecture

This project is organized as a **npm monorepo** with the following structure:

```
mocker/
├── packages/
│   ├── backend/      # @mocker/backend - Express API server
│   │                 # - Slack bot integration
│   │                 # - REST APIs for Slack commands and events
│   │                 # - Search endpoint (team-scoped, requires OAuth token)
│   │                 # - Slack OAuth flow (/auth/slack, /auth/slack/callback)
│   │                 # - Scheduled jobs (fun-fact, pricing, event-alert)
│   │
│   └── frontend/     # @mocker/frontend - React + Vite
│                     # - Message search UI
│                     # - OAuth login flow
│                     # - Requires session token in URL fragment
│
├── package.json         # Root workspace config
├── tsconfig.base.json   # Shared TypeScript config
└── eslint.config.js     # Root ESLint config (flat config)
```

## Getting Started

### Prerequisites

- **Node.js** 24 LTS (>=24.14.1, for backend and frontend development)
- **MySQL** 5.7+ (for storing messages, users, game state)
- **Slack workspace** (for bot integration)
- **Ngrok** (optional, for local tunneling during development)

### 1. Set Up Slack App

1. Create a Slack workspace for development: https://slack.com/get-started#/create
2. Go to https://api.slack.com/apps and create a new app in your workspace.
3. Configure the app with the following settings:

#### Slash Commands

Add these slash commands with their request URLs:

- `/mock` → `<backend-url>/mock`
- `/define` → `<backend-url>/define`
- `/muzzle` → `<backend-url>/muzzle`
- `/muzzlestats` → `<backend-url>/muzzle/stats`
- `/confess` → `<backend-url>/confess`
- `/list` → `<backend-url>/list/add`
- `/listreport` → `<backend-url>/list/retrieve`
- `/listremove` → `<backend-url>/list/remove`
- `/counter` → `<backend-url>/counter`
- `/repstats` → `<backend-url>/rep/get`
- `/walkie` → `<backend-url>/walkie`

**Important:** Check `Escape Channels, users and links sent to your app` for all commands.

#### Event Subscriptions

- **Request URL:** `<backend-url>/muzzle/handle`
- **Subscribe to Workspace Events:**
  - `messages.channels`
  - `reaction_added`
  - `reaction_removed`
  - `team_join`

#### OAuth & Permissions

- **OAuth Redirect URLs (for app installation):** Configure the URLs required by the bot.
- **Redirect URLs:** Add the backend callback URL for the search/auth UI, such as
  `http://localhost:3000/auth/slack/callback`, under **OAuth & Permissions > Redirect URLs**.
- **Scopes (bot token scopes):**
  - `channels:join`
  - `channels:read`
  - `chat:write`
  - `chat:write.public` — required so Moonbeam can post to public channels it has not joined
  - `commands`
  - `files:read`
  - `files:write`
  - `groups:read`
  - `groups:history`
  - `team:read`
  - `users:read`
  - `users.profile:read`
- **Scopes (user token scopes):**

  The user token must belong to a workspace **admin or owner**, because only an admin user token
  may delete another member's message.
  - `chat:write` — required for `chat.delete` when muzzling
  - `users.profile:write` — required for `users.setPhoto`
  - `openid` — modern Sign in with Slack (see below)

#### Search UI login

The search/auth UI login uses Slack's **modern Sign in with Slack**, built on OpenID Connect.
Members are shown a limited identity consent screen rather than an app-installation screen.

Sign in with Slack scopes may not be combined with bot scopes in the same OAuth flow, so login
requests only `openid` and is kept entirely separate from app installation.

Under **OAuth & Permissions > Redirect URLs**, add the backend callback URL, such as
`http://localhost:3000/auth/slack/callback`. In production this should be
`https://api.muzzle.lol/auth/slack/callback`.

The backend sends `ALLOWED_TEAM_DOMAIN` as Slack's `team` parameter and verifies it against the
`https://slack.com/team_id` claim returned by `openid.connect.userInfo`, so this value must be the
Slack **team ID** (for example `T2ZV0GCNS`), not the workspace domain.

> **Note:** modern Sign in with Slack requires the app's user token scopes to include `openid`. A
> classic app cannot serve the OpenID Connect consent screen and will show members the full
> app-installation screen instead.

Copy your **Bot Token** and **User OAuth Token** from the app credentials page.

#### Token usage

The bot token (`MUZZLE_BOT_TOKEN`) is granular and is used for posting, editing, uploading and
listing. The user token (`MUZZLE_BOT_USER_TOKEN`) is retained only for the two operations that
genuinely require a user identity:

- `chat.delete` — deleting another member's message requires an admin/owner user token.
- `users.setPhoto` — acts on the authenticated user's own profile.

Perspectival scopes (`chat:write:bot`, `chat:write:user`, `files:write:user`) and the `as_user`
parameter apply only to the classic user token and are not used for bot-token calls.

### 2. Set Up MySQL Database

```bash
# Ensure MySQL is running and create the database
mysql -u <username> -p -e "CREATE DATABASE mockerdbdev;"

# Seed the database (if DB_SEED.sql exists in repo root)
mysql -u <username> -p mockerdbdev < DB_SEED.sql
```

### 3. Environment Variables

Create `.env` files in `packages/backend` and `packages/frontend` (or set them globally).

For backend, start from the checked-in example:

```bash
cp packages/backend/.env.example packages/backend/.env
```

#### Backend (`packages/backend/.env`)

```bash
# Slack Bot Credentials
MUZZLE_BOT_TOKEN=xoxb-your-bot-token
MUZZLE_BOT_USER_TOKEN=xoxp-your-user-token
MUZZLE_BOT_SIGNING_SECRET=your-signing-secret

# Slack OAuth (for search/auth UI login)
# Uses the existing classic app's legacy Sign in with Slack flow (`identity.basic`).
SLACK_CLIENT_ID=your-client-id
SLACK_CLIENT_SECRET=your-client-secret
SLACK_REDIRECT_URI=http://localhost:3000/auth/slack/callback

# Search & Auth
ALLOWED_TEAM_DOMAIN=your-slack-team-id
SEARCH_FRONTEND_URL=http://localhost:3001
SEARCH_AUTH_SECRET=generate-a-random-secret-key

# MySQL / TypeORM
TYPEORM_CONNECTION=mysql
TYPEORM_HOST=localhost
TYPEORM_PORT=3306
TYPEORM_USERNAME=root
TYPEORM_PASSWORD=your-password
TYPEORM_DATABASE=mockerdbdev
TYPEORM_ENTITIES=/absolute/path/to/mocker/packages/backend/src/shared/db/models/*.ts
TYPEORM_SYNCHRONIZE=true

# API Server
PORT=3000
NODE_ENV=development

# External APIs (optional, for AI features)
OPENAI_API_KEY=sk-your-openai-key
GOOGLE_TRANSLATE_API_KEY=your-google-translate-key
```

#### Frontend (`packages/frontend/.env`)

For frontend, start from the checked-in example:

```bash
cp packages/frontend/.env.example packages/frontend/.env
```

```bash
# Backend API URL
VITE_API_BASE_URL=http://localhost:3000
```

### 4. Local Development Setup

```bash
# Install dependencies (installs all workspaces)
npm install

# Start backend development server
npm run start

# In a new terminal, start frontend development server
npm run dev -w @mocker/frontend

# Backend: http://localhost:3000
# Frontend (search UI): http://localhost:5173
```

### 5. Testing

```bash
# Run all tests
npm run test

# Run only backend tests
npm run test -w @mocker/backend

# Run backend tests in watch mode
npm run test:watch -w @mocker/backend

# Run with coverage
npm run test:coverage -w @mocker/backend
```

### 6. Linting & Formatting

```bash
# Check linting and format issues
npm run lint
npm run format:check

# Auto-fix linting and formatting issues
npm run lint:fix
npm run format:fix
```

### 7. Build for Production

```bash
# Build all workspaces
npm run build

# Build only backend
npm run build:backend

# Build backend with production optimizations
npm run build:prod:backend

# Build only frontend
npm run build:frontend
```

### 8. Docker

```bash
# Build backend Docker image
docker build \
  --build-arg PREVIOUS_RELEASE_SHA="$(git rev-parse HEAD^ 2>/dev/null || true)" \
  -f packages/backend/Dockerfile \
  -t mocker-backend:latest \
  .

# Run Docker container
docker run -p 3000:3000 \
  -e TYPEORM_HOST=host.docker.internal \
  -e MUZZLE_BOT_TOKEN=xoxb-... \
  mocker-backend:latest

# View logs
docker logs <container-id>
docker logs <container-id> | jq .
```

## Key Features

### Slack Bot Commands

- **Mock, Define, Muzzle, Counter, Confess, List, Walkie** - Various game modes and actions
- **Reputation Tracking** - Rep stats, reactions, achievements
- **Event Handling** - Real-time reactions, team join events, message history

### Search & Auth System (New)

- **OAuth Login** - Users authenticate via Slack to access the search UI
- **Team-Scoped Search** - Messages are filtered by `teamId` to prevent cross-workspace leakage
- **Session Tokens** - HMAC-signed custom session tokens (base64url payload + signature, not JWT), issued after OAuth callback, required for all search requests
- **Rate Limiting** - Auth endpoints: 20/15min, Search endpoints: 60/1min

### AI Features (Optional)

- **Sentiment Analysis** - Analyzes message tone
- **AI Summaries** - Generates summaries of message threads

Schema changes are managed by TypeORM using your configured synchronization settings.

### Scheduled Jobs

Most scheduled jobs run inside the backend Node.js process using `node-cron`. They are started automatically when the server connects to the database.

| Job              | Schedule                         | Location    | Description                                                                        |
| ---------------- | -------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| **Fun Fact**     | `0 9 * * *` (9 AM ET)            | In-process  | Posts daily facts, joke, quote, and on-this-day event to Slack                     |
| **Pricing**      | `10 * * * *` (every hour at :10) | In-process  | Recalculates item prices based on median reputation                                |
| **Health Check** | `*/5 * * * *` (every 5 min)      | Bash script | Checks the `/health` endpoint from outside the process and alerts Slack on failure |

#### Fun Fact Job environment variables

| Variable                 | Default      | Description                                                         |
| ------------------------ | ------------ | ------------------------------------------------------------------- |
| `API_NINJA_KEY`          | _(required)_ | API key for [api-ninjas.com](https://api-ninjas.com) facts endpoint |
| `FUN_FACT_SLACK_CHANNEL` | `#general`   | Slack channel to post the daily fun-fact message                    |
| `FACT_TARGET_COUNT`      | `5`          | Number of unique facts to collect per run                           |
| `MAX_FACT_ATTEMPTS`      | `50`         | Maximum fetch attempts before giving up on facts                    |
| `MAX_JOKE_ATTEMPTS`      | `20`         | Maximum fetch attempts before giving up on the joke                 |

#### Health Check Job (bash script)

The health check job lives in `packages/jobs/health-job/script.sh` and must be run from **outside** the Node.js process so it can detect when the server itself is down. Schedule it with an external cron daemon:

```bash
# Health check every 5 minutes
*/5 * * * * /path/to/mocker/packages/jobs/health-job/script.sh >> /path/to/logs/health-job.log 2>&1
```

The script requires `bash`, `curl`, `grep`, `mktemp`, and `tr`. It reads environment from the first file found in: `JOB_ENV_FILE`, `script dir/.env`, `~/.bash_profile`, `~/.profile`, or `/home/muzzle.lol/.bash_profile`.

### Available Scripts

From the root directory, you can run:

| Command                 | Description                          |
| ----------------------- | ------------------------------------ |
| `npm run start`         | Start the backend development server |
| `npm run start:prod`    | Start the backend in production mode |
| `npm run build`         | Build all workspaces                 |
| `npm run build:backend` | Build only the backend               |
| `npm run test`          | Run tests across all workspaces      |
| `npm run test:backend`  | Run tests for the backend only       |
| `npm run lint`          | Lint all packages                    |
| `npm run lint:fix`      | Lint and auto-fix issues             |

To build the backend Docker image locally, first generate the release metadata, then build:

```bash
PREVIOUS_RELEASE_SHA="$(git rev-parse HEAD^ 2>/dev/null || true)" \
  node packages/backend/scripts/write-release-metadata.js packages/backend/release-metadata.json
docker build -f packages/backend/Dockerfile -t muzzle .
```

You can also run workspace-specific commands using:

```
npm run <script> -w @mocker/backend
npm run <script> -w @mocker/frontend
```

## Docker Logs

The backend writes structured JSON logs to stdout so deployed failures can be investigated directly with `docker logs`.

Each log entry includes:

- `timestamp`
- `level`
- `module`
- `message`
- `context`
- `error.name`
- `error.message`
- `error.stack`

Useful commands:

```bash
docker logs <container-name>
docker logs <container-name> | grep '"level":"error"'
docker logs <container-name> | grep '"module":"AIService"'
docker logs <container-name> | grep '"channelId":"C123"'
docker logs <container-name> | jq .
```

The `context` object is where request-specific identifiers live, such as `userId`, `teamId`, `channelId`, `itemId`, `symbol`, and prompt text. In production, start with `module` and `message`, then use `context` to isolate the failing request, and finally inspect `error.stack` for the root cause.
