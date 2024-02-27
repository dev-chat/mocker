export class ClapService {
  public clap(text: string): string {
    if (!text.length) {
      return text;
    }
    let output = '';
    const words = text.trim().split(' ');
    for (let i = 0; i < words.length; i++) {
      output += i !== words.length - 1 ? `${words[i]} :clap: ` : `${words[i]} :clap:`;
    }
    return output;
  }
}
