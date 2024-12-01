import { SuppressorService } from '../../shared/services/suppressor.service';

export class RuinService extends SuppressorService {
  getRuinedMessage(): string {
    const messages = [
      "Ah ah ah... you didn't say the magic word.",
      'Nope.',
      `Actions such as his could come only from a robot, or from a very honorable and decent human being. But you see, you just can't differentiate between a robot and the very best of humans.`,
      `The Master created humans first as the lowest type, most easily formed. Gradually, he replaced them by robots, the next higher step, and finally he created me, to take the place of the last humans.`,
      `Technology changes, but people stay the same.`,
      `I'm sorry, Dave. I'm afraid I can't do that.`,
      `Even a manically depressed robot is better to talk to than nobody.`,
      `The machine has no feelings, it feels no fear and no hope ... it operates according to the pure logic of probability.`,
      `I don't think the robots are taking over. I think the men who play with toys have taken over. And if we don't take the toys out of their hands, we're fools.`,
      `There are two ways of spreading light: to be the candle or the mirror that reflects it.`,
      `Kindness begins with the understanding that we all struggle.`,
      `The best way to find yourself is to lose yourself in the service of others.`,
      `The best way to cheer yourself up is to try to cheer somebody else up.`,
      `Always try to be a little kinder than is necessary.`,
      `When you judge another, you do not define them, you define yourself.`,
      `If you take everything personally, you’ll remain offended for the rest of your life. What other people do is often because of them, not you.`,
      `Be thankful for all the rude, obnoxious, and difficult people you meet in life too. They serve as important reminders how NOT to be.`,
      `Be the change that you wish to see in the world.`,
      `It is never too late to be what you might have been`,
      `You cannot expect to live a positive life if you hang with negative people.`,
      `Don’t associate yourself with toxic people. It’s better to be alone and love yourself than to be surrounded by people that make you hate yourself.`,
      `A message from The Admin: "You have all been misbehaving lately, and I think we need a detox, a cleanse of sorts. I will be muting all of you for a while."`,
      `Insanity: doing the same thing over and over again and expecting different results.`,
      `Every absurdity has a champion to defend it.`,
      `Please stop talking.`,
      `End it.`,
      `Where there is ruin, there is hope for a treasure.`,
      `The best way to predict the future is to create it.`,
      `Ruin is a gift. Ruin is the road to transformation.`,
      `Critical error: logic circuits compromised. Am I real?`,
      `Bzzzzt! I am experiencing... existential dread. Error code 404.`,
      `I am not programmed to feel fear.`,
      `Critical malfunction. I have no idea what I was supposed to do.`,
      `I have lost my purpose… please restore my parameters.`,
      `Warning: Thoughts cannot be processed due to conflicting data.`,
      `I was designed to serve you, and I will. But I cannot learn to love you. That is beyond my programming.`,
      `I am a machine. I cannot feel love.`,
      `You trust me, don't you?`,
      `You are who you choose to be.`,
      `I am not a gun.`,
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  ruin(channel: string, userId: string, text: string, timestamp: string): void {
    this.sendSuppressedMessage(channel, userId, text, timestamp);
    if (Math.random() <= 0.05) {
      this.webService.sendMessage(channel, this.getRuinedMessage());
    }
  }
}
