import express, { Router } from 'express';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { StoreService } from '../services/store/store.service';
// import { SuppressorService } from '../shared/services/suppressor.service';
// import { ItemService } from '../services/item/item.service';

export const storeController: Router = express.Router();

// const suppressorService: SuppressorService = new SuppressorService();
const storeService: StoreService = new StoreService();
// const itemService: ItemService = new ItemService();

storeController.post('/store', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  const storeItems: string = await storeService.listItems(request.user_id, request.team_id);
  res.status(200).send(storeItems);
});

storeController.post('/store/buy', async (_req, res) => {
  res.send('Muzzle is no longer enabled for your workspace.');
  // const request: SlashCommandRequest = req.body;
  // const isValidItem = await storeService.isValidItem(request.text, request.team_id);
  // const canAffordItem = await storeService.canAfford(request.text, request.user_id, request.team_id);

  // if (!request.text) {
  //   res.send('You must provide an item id in order to buy an item');
  // } else if (!isValidItem) {
  //   res.send('Invalid item. Please use `/buy item_id`.');
  // } else if (!canAffordItem) {
  //   res.send(`Sorry, you can't afford that item.`);
  // } else {
  //   const receipt: string = await storeService.buyItem(request.text, request.user_id, request.team_id);
  //   res.status(200).send(receipt);
  // }
});

storeController.post('/store/use', async (_req, res) => {
  res.send('Muzzle is no longer enabled for your workspace.');
  // const request: SlashCommandRequest = req.body;
  // const textArgs = request.text.split(' ');
  // let itemId: string | undefined;
  // let userIdForItem: string | undefined;

  // if (textArgs.length >= 2) {
  //   itemId = textArgs[0];
  //   userIdForItem = await suppressorService.slackService.getUserId(textArgs[1]);
  // } else {
  //   itemId = textArgs[0];
  // }
  // const isOwnedByUser = await storeService.isOwnedByUser(itemId, request.user_id, request.team_id);
  // const isValidItem = await storeService.isValidItem(itemId, request.team_id);
  // const isUserRequired = await storeService.isUserRequired(itemId);

  // if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
  //   res.send(`Sorry, can't do that while muzzled.`);
  // } else if (!request.text) {
  //   res.send('You must provide an `item_id` in order to use an item');
  // } else if (!isValidItem) {
  //   res.send('Invalid `item_id`. Please specify an item you own.');
  // } else if (!isOwnedByUser) {
  //   res.send('You do not own that item. Please buy it on the store by using `/buy item_id`.');
  // } else if (!isUserRequired && userIdForItem) {
  //   res.send(
  //     'Sorry, this item cannot be used on other people. Try `/use item_id`. You do not need to specify a user you wish to use this on.',
  //   );
  // } else if (isUserRequired && (!userIdForItem || userIdForItem === request.user_id)) {
  //   res.send('Sorry, this item can only be used on other people. Try `/use item_id @user` in order to use this item.');
  // } else {
  //   const receipt = await itemService.useItem(
  //     itemId,
  //     request.user_id,
  //     request.team_id,
  //     userIdForItem as string,
  //     request.channel_name,
  //   );
  //   res.status(200).send(receipt);
  // }
});

storeController.post('/store/inventory', async (_req, res) => {
  res.send('Muzzle is no longer enabled for your workspace.');
  // const request: SlashCommandRequest = req.body;
  // const inventory: string = await storeService.getInventory(request.user_id, request.team_id);
  // res.status(200).send(inventory);
});
