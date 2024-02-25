import { DataSource } from 'typeorm';

export const DBClient = new DataSource({
  type: 'mysql',
  host: process.env.TYPEORM_HOST,
  port: 3306,
  username: process.env.TYPEORM_USERNAME,
  password: process.env.TYPEORM_PASSWORD,
  database: process.env.TYPEORM_DATABASE,
  synchronize: process.env.TYPEORM_SYNCHRONIZE === 'true',
  entities: [__dirname + '/models/*.ts'],
});
