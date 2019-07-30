export class ClapService {
  public clap(text: string) {
    if (!text || text.length === 0) {
      return text;
    }
    let output = "";
    const words = text.split(" ");
    for (let i = 0; i < words.length; i++) {
      output += i !== words.length - 1 ? `${words[i]} :clap: ` : words[i];
    }
    return output;
  }
}
