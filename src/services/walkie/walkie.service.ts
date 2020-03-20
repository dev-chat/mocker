export class WalkieService {
  public walkieTalkie(text: string) {
    if (!text || text.length === 0) {
      return text;
    }
    return `:walkietalkie: *chk* ${text} over. *chk* :walkietalkie:`;
  }
}
