import { NATO_MAPPINGS } from './constants';

export class WalkieService {
  private userIdRegEx = /[<]@\w+/gm;

  public getUserId(user: string): string {
    if (!user) {
      return '';
    }
    const regArray = user.match(this.userIdRegEx);
    return regArray ? regArray[0].slice(2) : '';
  }

  public getNatoName(longUserId: string): string {
    const userId = this.getUserId(longUserId);
    console.log(userId);
    return NATO_MAPPINGS[userId] || longUserId;
  }

  public walkieTalkie(text: string): string {
    if (!text || text.length === 0) {
      return text;
    }

    const userIds = text.match(/[<]@\w+[ ]?\|[ ]?\w+[>]/gm);
    let fullText = text;

    if (userIds && userIds.length) {
      for (const userId of userIds) {
        fullText = fullText.replace(userId, this.getNatoName(userId));
      }
    }

    return `:walkietalkie: *chk* ${fullText} over. *chk* :walkietalkie:`;
  }
}