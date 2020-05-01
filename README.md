# Mocker

## A Slack app to annoy your friends.

## Getting Started

### Setting Up Your Slack Environment

1. Set up a new slack workspace for development purposes. (https://slack.com/get-started#/create)
2. Go to: https://api.slack.com/apps and click Create New App
3. Choose your newly created workspace as your Development Workspace and click Create App.
4. Under add features and functionality, do the following:
5. TODO: Do a bunch of stuff to make your app have the right slash commands, bot users, permissions, etc.
6. Add your bot oauth token as MUZZLE_BOT_TOKEN and your bot user token as MUZZLE_BOT_USER_TOKEN to your environment variables. Alternatively, you can pass these in as command line arguments.
7. At this point, you should have a fully configured slack workspace to begin testing in.

### Setting Up Your MYSQL Instance

1. Be sure to have mysql installed and configured.
2. Create a database called `mockerdbdev`.
3. `mysql -u <user> -p < DB_SEED.sql`
4. You should now have a fully seeded database.

### Running Locally

1. `npm install`
2. Add the following environment variables for typeORM:

```
  TYPEORM_CONNECTION: mysql,
  TYPEORM_HOST: localhost,
  TYPEORM_PORT: 3306,
  TYPEORM_USERNAME: <USER-NAME-FOR-MYSQL>,
  TYPEORM_PASSWORD: <PASSWORD-FOR-MYSQL>,
  TYPEORM_DATABASE: mockerdbdev,
  TYPEORM_ENTITIES: /absolute/path/to/mocker/src/shared/db/models/*.ts,
  TYPEORM_SYNCHRONIZE: true
```

3. `npm run start`
