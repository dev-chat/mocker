import express, { Router } from 'express';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { BackFirePersistenceService } from '../services/backfire/backfire.persistence.service';
import { CounterPersistenceService } from '../services/counter/counter.persistence.service';
import { MuzzlePersistenceService } from '../services/muzzle/muzzle.persistence.service';
import { StoreService } from '../services/store/store.service';

export const storeController: Router = express.Router();

const muzzlePersistenceService = MuzzlePersistenceService.getInstance();
const backfirePersistenceService = BackFirePersistenceService.getInstance();
const counterPersistenceService = CounterPersistenceService.getInstance();
const storeService: StoreService = new StoreService();

storeController.post('/store', (req, res) => {
  const storeItems: string = storeService.listItems();
  res.status(200).send(storeItems);
});

storeController.post('/store/buy', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (!storeService.isValidItem(request.text)) {
    res.send('Invalid item. Please use `/buy item_id`.');
  } else if (!storeService.canAfford(request.text, request.user_id)) {
    res.send(`Sorry, you can't afford that item.`);
  }
  const receipt: string = await storeService.buyItem(request.text, request.user_id);
  res.status(200).send(receipt);
});

storeController.post('/store/use', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (
    muzzlePersistenceService.isUserMuzzled(request.user_id) ||
    backfirePersistenceService.isBackfire(request.user_id) ||
    counterPersistenceService.isCounterMuzzled(request.user_id)
  ) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!storeService.isValidItem(request.text)) {
    res.send('Invalid item. PLease use `/buy item_id` or specify an item you own.');
  } else if (!storeService.isOwnedByUser(request.text, request.user_id)) {
    res.send('You do not own that item. Please buy it on the store by using `/buy item_id`.');
  }

  const resp: string = await storeService.useItem(request.text, request.user_id);
  res.status(200).send(resp);
});

storeController.post('/store/inventory', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  const inventory: string = await storeService.getInventory(request.user_id);
  res.status(200).send(inventory);
});
