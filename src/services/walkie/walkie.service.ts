import { NATO_MAPPINGS } from "./constants";

export class WalkieService {
  private userIdRegEx = /[<]@\w+/gm;

  public getUserId(user: string) {
    if (!user) {
      return "";
    }
    const regArray = user.match(this.userIdRegEx);
    return regArray ? regArray[0].slice(2) : "";
  }

  public getNatoName(longUserId: string): string {
    const userId = this.getUserId(longUserId);
    return NATO_MAPPINGS[userId];
  }

  public walkieTalkie(text: string) {
    if (!text || text.length === 0) {
      return text;
    }

    const userId = text.match(/[<]@\w+[ ]?\|[ ]?\w+[>]/gm);
    let fullText = text;

    if (userId) {
      const start = text.indexOf(userId.toString());
      const natoName = this.getNatoName(userId.toString());
      const firstHalf = text.substring(0, start);
      const secondHalf = text.substring(start + userId.toString().length);
      fullText = `${firstHalf}${natoName} (${userId.toString()})${secondHalf}`;
    }

    return `:walkietalkie: *chk* ${fullText} over. *chk* :walkietalkie:`;
  }
}
