import express, { Router } from 'express';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { StoreService } from '../services/store/store.service';
import { SuppressorService } from '../shared/services/suppressor.service';

export const storeController: Router = express.Router();

const suppressorService: SuppressorService = new SuppressorService();
const storeService: StoreService = new StoreService();

storeController.post('/store', async (_req, res) => {
  const storeItems: string = await storeService.listItems();
  res.status(200).send(storeItems);
});

storeController.post('/store/buy', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (!request.text) {
    res.send('You must provide an item id in order to buy an item');
  } else if (!storeService.isValidItem(request.text)) {
    res.send('Invalid item. Please use `/buy item_id`.');
  } else if (!storeService.canAfford(request.text, request.user_id, request.team_id)) {
    res.send(`Sorry, you can't afford that item.`);
  }
  const receipt: string = await storeService.buyItem(request.text, request.user_id, request.team_id);
  res.status(200).send(receipt);
});

storeController.post('/store/use', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!request.text) {
    res.send('You must provide an item id in order to use an item');
  } else if (!storeService.isValidItem(request.text)) {
    res.send('Invalid item. Please use `/buy item_id` or specify an item you own.');
  } else if (!storeService.isOwnedByUser(request.text, request.user_id, request.team_id)) {
    res.send('You do not own that item. Please buy it on the store by using `/buy item_id`.');
  }

  storeService.useItem(request.text, request.user_id, request.team_id);
  res.status(200);
});

storeController.post('/store/inventory', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  const inventory: string = await storeService.getInventory(request.user_id, request.team_id);
  res.status(200).send(inventory);
});
