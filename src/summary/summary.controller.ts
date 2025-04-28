import express, { Router } from 'express';

export const summaryController: Router = express.Router();

summaryController.post('/summary/daily', async (req, res) => {
  res.status(200).send('This is deprecated. Please use /prompt.')
});

summaryController.post('/summary', async (req, res) => {
    res.status(200).send('This is deprecated. Please use /prompt.')
});
