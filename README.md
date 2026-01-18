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
