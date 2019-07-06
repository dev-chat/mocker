export function mock(input: string): string {
  let output = "";
  if (!input || input.length === 0) {
    return input;
  } else {
    let shouldChangeCase = true;
    for (const letter of input) {
      if (letter === " ") {
        output += letter;
      } else {
        output += shouldChangeCase
          ? letter.toLowerCase()
          : letter.toUpperCase();
        shouldChangeCase = !shouldChangeCase;
      }
    }
    return output;
  }
}
