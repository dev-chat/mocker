import { createLogger, format, transports } from 'winston';
const { combine, timestamp, prettyPrint } = format;

export const logger = createLogger({
  level: 'info',
  format: combine(timestamp(), prettyPrint()),
  defaultMeta: {},
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' }),
  ],
});
