import { split as splitSentences } from 'sentence-splitter';

export const MAX_CHUNK_SIZE = 2920;

export function getChunks(text: string): string[] {
  if (text.length <= MAX_CHUNK_SIZE) return [text];

  // Try to split at sentence boundaries
  const sentences = splitSentences(text)
    .filter((token) => token.type === 'Sentence')
    .map((token) => token.raw);

  if (!sentences) return splitByWords(text);

  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    // If adding this sentence would exceed the chunk size, flush currentChunk
    if ((currentChunk + trimmedSentence).length > MAX_CHUNK_SIZE) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      // If the sentence itself is too long, split by words
      if (trimmedSentence.length > MAX_CHUNK_SIZE) {
        splitSentenceByWords(trimmedSentence, chunks);
        continue; // currentChunk is already flushed
      } else {
        currentChunk = trimmedSentence.trim();
      }
    } else {
      currentChunk += ` ${trimmedSentence.trim()}`;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.map((chunk) => chunk.trim());
}

export function splitByWords(text: string): string[] {
  const words = text.split(' ');
  const chunks: string[] = [];
  let currentChunk = '';

  for (const word of words) {
    // If adding this word would exceed the chunk size, flush currentChunk
    if ((currentChunk ? currentChunk.length + 1 : 0) + word.length > MAX_CHUNK_SIZE) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      if (word.length > MAX_CHUNK_SIZE) {
        splitLongWord(word, chunks);
      } else {
        currentChunk = word;
      }
    } else {
      currentChunk += (currentChunk ? ' ' : '') + word;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

export function splitSentenceByWords(sentence: string, chunks: string[]) {
  let wordChunk = '';
  for (const word of sentence.split(' ')) {
    if ((wordChunk ? wordChunk.length + 1 : 0) + word.length > MAX_CHUNK_SIZE) {
      if (wordChunk.trim()) {
        chunks.push(wordChunk.trim());
        wordChunk = '';
      }
      if (word.length > MAX_CHUNK_SIZE) {
        splitLongWord(word, chunks);
      } else {
        wordChunk = word;
      }
    } else {
      wordChunk += (wordChunk ? ' ' : '') + word;
    }
  }
  if (wordChunk.trim()) {
    chunks.push(wordChunk.trim());
  }
}

export function splitLongWord(word: string, chunks: string[]) {
  let start = 0;
  while (start < word.length) {
    chunks.push(word.slice(start, start + MAX_CHUNK_SIZE));
    start += MAX_CHUNK_SIZE;
  }
}
