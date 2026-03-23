# Mocker

## A Slack app to annoy your friends.

## Project Structure

This project is organized as a monorepo using npm workspaces:

```
mocker/
├── packages/
│   ├── backend/      # @mocker/backend - Express API server with Slack integration
│   ├── frontend/     # @mocker/frontend - Frontend application
│   └── jobs/         # Scheduled jobs
│       ├── fun-fact-job/
│       ├── health-job/
│       └── pricing-job/
├── package.json      # Root package with workspace configuration
└── tsconfig.base.json
```

## Getting Started

### Setting Up Your Slack Environment

1. Set up a new slack workspace for development purposes. (https://slack.com/get-started#/create)
2. Go to: https://api.slack.com/apps and click Create New App
3. Choose your newly created workspace as your Development Workspace and click Create App.
4. Configure Ngrok for your newly created bot: https://api.slack.com/tutorials/tunneling-with-ngrok
5. Add your bot oauth token as MUZZLE_BOT_TOKEN and your bot user token as MUZZLE_BOT_USER_TOKEN to your environment variables. Alternatively, you can pass these in as command line arguments.
6. Your app should have the following features per the Slack management web app:

- Slash Commands
  - /mock - Request URL: `<ngrokUrl>/mock`
  - /define - Request URL: `<ngrokUrl>/define`
  - /muzzle - Request URL: `<ngrokUrl>/muzzle`
  - /muzzlestats - Request URL: `<ngrokUrl>/muzzle/stats`
  - /confess - Request URL: `<ngrokUrl>/confess`
  - /list - Request URL: `<ngrokUrl>/list/add`
  - /listreport - Request URL: `<ngrokUrl>/list/retrieve`
  - /listremove - Request URL: `<ngrokUrl>/list/remove`
  - /counter - Request URL: `<ngrokUrl>/counter`
  - /repstats - Request URL: `<ngrokUrl>/rep/get`
  - /walkie - Request URL: `<ngrokUrl>/walkie`

Each of the slash commands should have `Escape Channels, users and links sent to your app` checked.

- Event Subscriptions
  - Request URL: `<ngrokUrl>/muzzle/handle`
  - Subscribe to Workspace Events:
    - messages.channels
    - reaction_added
    - reaction_removed
    - team_join

- Permissions
  - admin
  - channels:history
  - chat:write:bot
  - chat:write:user
  - commands
  - files:write:user
  - groups:history
  - reactions:read
  - users.profile:read
  - users:read

### Setting Up Your MYSQL Instance

1. Be sure to have mysql installed and configured.
2. Create a database called `mockerdbdev`.
3. `mysql -u <user> -p < DB_SEED.sql`
4. You should now have a fully seeded database.

### Running Locally

1. `npm install` (from the root directory - this installs dependencies for all workspaces)
2. Add the following environment variables for typeORM:

```
  TYPEORM_CONNECTION: mysql,
  TYPEORM_HOST: localhost,
  TYPEORM_PORT: 3306,
  TYPEORM_USERNAME: <USER-NAME-FOR-MYSQL>,
  TYPEORM_PASSWORD: <PASSWORD-FOR-MYSQL>,
  TYPEORM_DATABASE: mockerdbdev,
  TYPEORM_ENTITIES: /absolute/path/to/mocker/packages/backend/src/shared/db/models/*.ts,
  TYPEORM_SYNCHRONIZE: true
```

3. `npm run start` (starts the backend server)

### Scheduled Jobs

The scripts in `packages/jobs` are standalone bash jobs intended for cron-style execution. They no longer require Python or Pipenv.

Each job now logs timestamped `INFO`, `WARN`, and `ERROR` lines to stdout/stderr so cron can capture clear success and failure status in its own logs or redirected log files.

The jobs will try to load environment variables from the first file that exists in this order:

1. `JOB_ENV_FILE`
2. `packages/jobs/<job-name>/.env`
3. `$HOME/.bash_profile`
4. `$HOME/.profile`
5. `/home/muzzle.lol/.bash_profile`

If none of those files exist, the jobs fall back to whatever environment cron provides directly.

- `packages/jobs/health-job/script.sh` requires `bash` and `curl`
- `packages/jobs/fun-fact-job/script.sh` requires `bash`, `curl`, `jq`, and `mysql`
- `packages/jobs/pricing-job/script.sh` requires `bash`, `mysql`, and `awk`

Example `crontab -e` entries when the default shell is bash:

```bash
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin
MAILTO=""

# Optional shared env file for the jobs
JOB_ENV_FILE=/home/steve/code/mocker/.cron.env

# Daily fun facts at 09:00
0 9 * * * /home/steve/code/mocker/packages/jobs/fun-fact-job/script.sh >> /home/steve/logs/fun-fact-job.log 2>&1

# Health check every 5 minutes
*/5 * * * * /home/steve/code/mocker/packages/jobs/health-job/script.sh >> /home/steve/logs/health-job.log 2>&1

# Price refresh every hour at minute 10
10 * * * * /home/steve/code/mocker/packages/jobs/pricing-job/script.sh >> /home/steve/logs/pricing-job.log 2>&1
```

Use root only if the jobs truly need root-owned resources such as privileged ports, root-only files, or system-level service management. These jobs only need network access, MySQL access, and Slack credentials, so they should normally run as a dedicated non-root user that owns the repo and the log directory.

### Available Scripts

From the root directory, you can run:

| Command                                                   | Description                          |
| --------------------------------------------------------- | ------------------------------------ |
| `npm run start`                                           | Start the backend development server |
| `npm run start:prod`                                      | Start the backend in production mode |
| `npm run build`                                           | Build all workspaces                 |
| `npm run build:backend`                                   | Build only the backend               |
| `npm run test`                                            | Run tests across all workspaces      |
| `npm run test:backend`                                    | Run tests for the backend only       |
| `npm run lint`                                            | Lint all packages                    |
| `npm run lint:fix`                                        | Lint and auto-fix issues             |
| `docker build -f packages/backend/Dockerfile -t muzzle .` | Build the backend Docker image       |

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
