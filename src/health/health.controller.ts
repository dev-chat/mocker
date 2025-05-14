import express, { Router } from 'express';

export const healthController: Router = express.Router();

healthController.get('/', (_, res) => {
  res.status(200).send('healthy');
});
