import { ISlackUser } from "../../shared/models/slack/slack-models";
import { SlackService } from "../slack/slack.service";
import { BackfireService } from "./backfire.service";

describe("BackfireService", () => {
  let backfireService: BackfireService;
  let slackInstance: SlackService;

  beforeEach(() => {
    backfireService = new BackfireService();
    slackInstance = SlackService.getInstance();
    slackInstance.userList = [
      { id: "123", name: "test123" },
      { id: "456", name: "test456" },
      { id: "789", name: "test789" },
      { id: "666", name: "requestor" }
    ] as ISlackUser[];
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runAllTimers();
  });

  it("should create", () => {
    expect(backfireService).toBeTruthy();
  });
});
