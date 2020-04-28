# Mocker

## A Slack app to annoy your friends.

## Getting Started

1. `npm install`
2. Add the following environment variables:

```
  TYPEORM_CONNECTION: mysql,
  TYPEORM_HOST: localhost,
  TYPEORM_PORT: 3306,
  TYPEORM_USERNAME: <USER-NAME-FOR-YOUR-DB>,
  TYPEORM_PASSWORD: <PASSWORD-FOR-YOUR-DB>,
  TYPEORM_DATABASE: <DATABASE-FOR-YOUR-INSTANCE>,
  TYPEORM_ENTITIES: ./src/shared/db/models/*.ts, // Need clarity on this one
  TYPEORM_SYNCHRONIZE: true
  MUZZLE_BOT_TOKEN: <TOKEN-FOR-YOUR-SLACKBOT>
  MUZZLE_BOT_USER_TOKEN: <TOKEN-FOR-YOUR-SLACKBOT-USER>
```

3.
