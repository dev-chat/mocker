export const getChunks = (text: string): string[] => {
  let characterCount = 0;
  let currentChunk = 0;
  const chunks: string[] = [];

  text.split(' ').forEach(word => {
    characterCount += word.length + 1;
    if (characterCount >= 2920) {
      characterCount = word.length + 1;
      chunks.push(`${word} `);
      currentChunk += 1;
    } else if (!chunks[currentChunk]) {
      chunks[currentChunk] = `${word} `;
    } else {
      chunks[currentChunk] += `${word} `;
    }
  });

  return chunks;
};
