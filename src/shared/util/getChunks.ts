export const getChunks = (text: string): string[] => {
  let currentChunk = 0;
  let charCount = 0;
  const chunks: string[] = [];
  const hasNewLines = text.includes('\n');

  if (text.length <= 2920) {
    return [text];
  } else if (hasNewLines) {
    return text.split('\n');
  } else {
    text.split(' ').forEach((word) => {
      charCount += word.length + 1;
      if (charCount >= 2920) {
        charCount = word.length + 1;
        chunks.push(`${word} `);
        currentChunk += 1;
      } else if (!chunks[currentChunk]) {
        chunks[currentChunk] = `${word} `;
      } else {
        chunks[currentChunk] += `${word} `;
      }
    });
  }

  return chunks;
};
