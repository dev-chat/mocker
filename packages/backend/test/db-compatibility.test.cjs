const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const mysql = require('mysql');
const { createConnection } = require('typeorm');

const socketPath = process.env.MOCKER_TEST_MYSQL_SOCKET;
const database = `mocker_test_${randomUUID().replaceAll('-', '')}`;
let admin;
let connection;

const query = (sql) =>
  new Promise((resolve, reject) => {
    admin.query(sql, (error, result) => (error ? reject(error) : resolve(result)));
  });

before(async () => {
  if (!socketPath) {
    throw new Error('MOCKER_TEST_MYSQL_SOCKET must point to an isolated disposable MySQL/MariaDB server');
  }
  admin = mysql.createConnection({ socketPath, user: 'root' });
  await query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4`);
  connection = await createConnection({
    name: database,
    type: 'mysql',
    database,
    username: 'root',
    charset: 'utf8mb4',
    extra: { socketPath },
    entities: [path.join(__dirname, '../dist/shared/db/models/*.js')],
    synchronize: true,
    logging: false,
  });
});

after(async () => {
  if (connection?.isConnected) await connection.close();
  if (admin) {
    try {
      await query(`DROP DATABASE IF EXISTS \`${database}\``);
    } finally {
      await new Promise((resolve) => admin.end(resolve));
    }
  }
});

test('real MySQL driver preserves UUIDs, relations, updates, rollback, and cascade deletion', async () => {
  const users = connection.getRepository('SlackUser');
  const events = connection.getRepository('CalendarEvent');
  const user = await users.save({
    slackId: 'U_TEST',
    teamId: 'T_TEST',
    name: 'Compatibility 😀',
    isBot: false,
    botId: '',
  });
  const event = await events.save({
    createdByUser: user,
    title: 'Before update',
    location: null,
    isAllDay: false,
    startsAt: new Date('2026-10-24T12:00:00Z'),
    endsAt: new Date('2026-10-24T13:00:00Z'),
    recurrenceRule: null,
  });
  assert.match(event.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  await events.update(event.id, { title: 'After update' });
  const loaded = await events.findOneOrFail({ where: { id: event.id }, relations: { createdByUser: true } });
  assert.equal(loaded.title, 'After update');
  assert.equal(loaded.createdByUser.name, 'Compatibility 😀');
  assert.equal(loaded.startsAt.toISOString(), '2026-10-24T12:00:00.000Z');
  assert.equal(loaded.location, null);
  await assert.rejects(
    connection.transaction(async (manager) => {
      await manager.update('CalendarEvent', event.id, { title: 'Rolled back' });
      throw new Error('rollback sentinel');
    }),
    /rollback sentinel/,
  );
  assert.equal((await events.findOneByOrFail({ id: event.id })).title, 'After update');
  assert.ok(loaded.createdAt instanceof Date);
  assert.ok(loaded.updatedAt instanceof Date);
  await users.delete(user.id);
  assert.equal(await events.count(), 0);
});
