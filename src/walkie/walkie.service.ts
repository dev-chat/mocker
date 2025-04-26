import { NATO_MAPPINGS, USER_ID_REGEX } from './constants';

export class WalkieService {
  public getUserId(user: string): string {
    if (!user) {
      return '';
    }
    const regArray = user.match(USER_ID_REGEX);
    return regArray ? regArray[0].slice(2) : '';
  }

  public getNatoName(longUserId: string): string {
    const userId = this.getUserId(longUserId);
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
