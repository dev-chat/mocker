import express, { Router } from 'express';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { StoreService } from './store.service';
import { SuppressorService } from '../shared/services/suppressor.service';
import { ItemService } from './item.service';

export const storeController: Router = express.Router();

const suppressorService: SuppressorService = new SuppressorService();
const storeService: StoreService = new StoreService();
const itemService: ItemService = new ItemService();

storeController.post('/store', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  const storeItems: string = await storeService.listItems(request.user_id, request.team_id);
  res.status(200).send(storeItems);
});

storeController.post('/store/buy', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  const textArgs = request.text.split(' ');
  let itemId: string | undefined;
  let userIdForItem: string | undefined;

  if (textArgs.length >= 2) {
    itemId = textArgs[0];
    userIdForItem = await suppressorService.slackService.getUserId(textArgs[1]);
  } else {
    itemId = textArgs[0];
  }

  const isValidItem = await storeService.isValidItem(itemId, request.team_id);

  if (!isValidItem) {
    res.send('Invalid item. Please use `/buy item_id`.');
    return;
  }

  const canAffordItem = await storeService.canAfford(itemId, request.user_id, request.team_id);
  const isUserRequired = await storeService.isUserRequired(itemId);

  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!itemId) {
    res.send('You must provide an item_id in order to buy an item');
  } else if (!canAffordItem) {
    res.send(`Sorry, you can't afford that item.`);
  } else if (!isUserRequired && userIdForItem) {
    res.send(
      'Sorry, this item cannot be used on other people. Try `/buy item_id`. You do not need to specify a user you wish to use this on.',
    );
  } else if (isUserRequired && (!userIdForItem || userIdForItem === request.user_id)) {
    res.send('Sorry, this item can only be used on other people. Try `/buy item_id @user` in order to use this item.');
  } else {
    const useReceipt = await itemService
      .useItem(itemId, request.user_id, request.team_id, userIdForItem as string, request.channel_name)
      .catch(e => {
        console.error(e, {
          item: itemId,
          userId: request.user_id,
          teamId: request.team_id,
          userIdForItem,
          channel: request.channel_name,
        });
        res.status(500).send(e);
        return undefined;
      });

    if (!useReceipt) {
      return;
    }

    const purchaseReceipt: string | undefined = await storeService
      .buyItem(itemId, request.user_id, request.team_id)
      .catch(e => {
        console.error(e, {
          item: itemId,
          userId: request.user_id,
          teamId: request.team_id,
        });
        res.status(500).send(`Failure occurred when trying to buy ${itemId}`);
        return undefined;
      });

    console.log(purchaseReceipt);

    if (!purchaseReceipt) {
      return;
    }

    console.log(useReceipt);
    res.status(200).send(useReceipt);
  }
});
