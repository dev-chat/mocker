export class ClapService {
  public clap(text: string) {
    if (!text || text.length === 0) {
      return text;
    }
    let output = "";
    const words = text.split(" ");
    for (const word of words) {
      output += `${word} :clap: `;
    }
    return output;
  }
}
