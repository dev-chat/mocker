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
  const isValidItem = await storeService.isValidItem(request.text);
  const canAffordItem = await storeService.canAfford(request.text, request.user_id, request.team_id);

  if (!request.text) {
    res.send('You must provide an item id in order to buy an item');
  } else if (!isValidItem) {
    res.send('Invalid item. Please use `/buy item_id`.');
  } else if (!canAffordItem) {
    res.send(`Sorry, you can't afford that item.`);
  } else {
    const receipt: string = await storeService.buyItem(request.text, request.user_id, request.team_id);
    res.status(200).send(receipt);
  }
});

storeController.post('/store/use', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  const isOwnedByUser = await storeService.isOwnedByUser(request.text, request.user_id, request.team_id);
  const isValidItem = await storeService.isValidItem(request.text);

  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!request.text) {
    res.send('You must provide an `item_id` in order to use an item');
  } else if (!isValidItem) {
    res.send('Invalid `item_id`. Please specify an item you own.');
  } else if (!isOwnedByUser) {
    res.send('You do not own that item. Please buy it on the store by using `/buy item_id`.');
  } else {
    const receipt: string = await storeService.useItem(request.text, request.user_id, request.team_id);
    res.status(200).send(receipt);
  }
});

storeController.post('/store/inventory', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  const inventory: string = await storeService.getInventory(request.user_id, request.team_id);
  res.status(200).send(inventory);
});
