import { MuzzlePersistenceService } from "../muzzle/muzzle.persistence.service";
import { SlackService } from "../slack/slack.service";
import { WebService } from "../web/web.service";
import { COUNTER_TIME } from "./constants";
import { CounterPersistenceService } from "./counter.persistence.service";

export class CounterService {
  private slackService = SlackService.getInstance();
  private webService = WebService.getInstance();
  private muzzlePersistenceService = MuzzlePersistenceService.getInstance();
  private counterPersistenceService = CounterPersistenceService.getInstance();

  /**
   * Creates a counter in DB and stores it in memory.
   */
  public createCounter(
    counteredId: string,
    requestorId: string
  ): Promise<string> {
    const counterUserName = this.slackService.getUserName(counteredId);
    const requestorUserName = this.slackService.getUserName(requestorId);
    return new Promise(async (resolve, reject) => {
      if (!counteredId || requestorId) {
        reject(
          `Invalid username passed in. You can only counter existing slack users.`
        );
      } else if (
        this.counterPersistenceService.getCounterByRequestorAndUserId(
          requestorId,
          counteredId
        )
      ) {
        reject("You already have a counter for this user.");
      } else {
        await this.counterPersistenceService
          .addCounter(requestorId, counteredId, false)
          .then(() => {
            resolve(
              `${requestorUserName} has countered ${counterUserName} from muzzling him for the next ${COUNTER_TIME}ms`
            );
          })
          .catch(e => reject(e));
      }
    });
  }

  public removeCounter(id: number, isUsed: boolean, channel?: string) {
    const counter = this.counterPersistenceService.getCounter(id);
    this.counterPersistenceService.removeCounter(id, isUsed, channel);
    if (isUsed && channel) {
      this.muzzlePersistenceService.muzzleAndRemovePrivileges(
        counter!.counteredId,
        counter!.requestorId,
        id
      );

      this.webService.sendMessage(
        channel,
        `:crossed_swords: $<@${
          counter!.requestorId
        }> successfully countered <@${counter!.counteredId}>! <@${
          counter!.counteredId
        }> has lost muzzle privileges for one hour and is muzzled for the next 5 minutes! :crossed_swords:`
      );
    } else {
      this.muzzlePersistenceService.muzzleAndRemovePrivileges(
        counter!.requestorId,
        counter!.counteredId,
        id
      );
      // Should send message to chat indicating that the counter failed
      this.webService.sendMessage(
        "#general",
        `:flesh: <@${counter!.requestorId}> lives in fear of <@${
          counter!.counteredId
        }> and is now muzzled and has lost muzzle privileges for one hour. :flesh:`
      );
    }
  }
}
