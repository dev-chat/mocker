import { getChunks, MAX_CHUNK_SIZE, splitByWords, splitLongWord, splitSentenceByWords } from './getChunks';

describe('getChunks', () => {
  it('should just return text if length is <= to 2920', () => {
    const text = 'a '.repeat(1460);
    const result = getChunks(text);
    expect(result).toEqual([text]);
  });

  it('returns the whole text if under the limit', () => {
    const text = 'Short text.';
    expect(getChunks(text)).toEqual([text]);
  });

  it('splits text at sentence boundaries when possible', () => {
    const sentence = 'A sentence. ';
    const text = sentence.repeat(Math.ceil(MAX_CHUNK_SIZE / sentence.length) + 2);
    const chunks = getChunks(text);
    expect(chunks.every((chunk) => chunk.length <= MAX_CHUNK_SIZE)).toBe(true);
    // Should split at sentence boundaries
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(' ')).toContain('A sentence.');
  });

  it('splits a single long sentence by words if needed', () => {
    const longWord = 'a'.repeat(MAX_CHUNK_SIZE - 10);
    const text = `${longWord} ${longWord} ${longWord}`;
    const chunks = getChunks(text);
    expect(chunks.every((chunk) => chunk.length <= MAX_CHUNK_SIZE)).toBe(true);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('handles a sentence longer than the chunk size', () => {
    const longSentence = 'a'.repeat(MAX_CHUNK_SIZE + 100) + '.';
    const text = longSentence + ' Short sentence.';
    const chunks = getChunks(text);
    expect(
      chunks.every((chunk) => {
        return chunk.length <= MAX_CHUNK_SIZE;
      }),
    ).toBe(true);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[chunks.length - 1]).toContain('Short sentence.');
  });

  it('handles text with no punctuation', () => {
    const text = 'a '.repeat(MAX_CHUNK_SIZE + 100);
    const chunks = getChunks(text);
    expect(chunks.every((chunk) => chunk.length <= MAX_CHUNK_SIZE)).toBe(true);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('handles empty string', () => {
    expect(getChunks('')).toEqual(['']);
  });

  it('handles text with various punctuation', () => {
    const text = 'Hello! How are you? I am fine. Thanks for asking!';
    expect(getChunks(text)).toEqual([text]);
  });

  it('handles words longer than chunk size', () => {
    const longWord = 'a'.repeat(MAX_CHUNK_SIZE + 10);
    const text = `${longWord} end.`;
    const chunks = getChunks(text);
    expect(chunks[0].length).toBeLessThanOrEqual(MAX_CHUNK_SIZE);
    expect(chunks.join(' ')).toContain('end.');
  });
});

describe('splitByWords', () => {
  it('splits text into chunks by words', () => {
    const word = 'a'.repeat(100);
    const text = Array(40).fill(word).join(' ');
    const chunks = splitByWords(text);
    expect(chunks.every((chunk) => chunk.length <= MAX_CHUNK_SIZE)).toBe(true);
    expect(chunks.join(' ')).toBe(text);
  });

  it('handles a single word longer than MAX_CHUNK_SIZE', () => {
    const longWord = 'x'.repeat(MAX_CHUNK_SIZE + 10);
    const chunks = splitByWords(longWord);
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(MAX_CHUNK_SIZE);
    expect(chunks[1].length).toBe(10);
  });

  it('returns empty array for empty string', () => {
    expect(splitByWords('')).toEqual([]);
  });
});

describe('splitSentenceByWords', () => {
  it('splits a long sentence by words into chunks', () => {
    const word = 'b'.repeat(200);
    const sentence = Array(20).fill(word).join(' ');
    const chunks: string[] = [];
    splitSentenceByWords(sentence, chunks);
    expect(chunks.every((chunk) => chunk.length <= MAX_CHUNK_SIZE)).toBe(true);
    expect(chunks.join(' ')).toBe(sentence);
  });

  it('handles a word longer than MAX_CHUNK_SIZE in a sentence', () => {
    const longWord = 'y'.repeat(MAX_CHUNK_SIZE + 5);
    const sentence = `short ${longWord} end`;
    const chunks: string[] = [];
    splitSentenceByWords(sentence, chunks);
    expect(chunks.some((chunk) => chunk.includes('short'))).toBe(true);
    expect(chunks.some((chunk) => chunk.includes('end'))).toBe(true);
    expect(chunks.some((chunk) => chunk.length === MAX_CHUNK_SIZE)).toBe(true);
  });

  it('handles empty sentence', () => {
    const chunks: string[] = [];
    splitSentenceByWords('', chunks);
    expect(chunks).toEqual([]);
  });
});

describe('splitLongWord', () => {
  it('splits a long word into fixed-size chunks', () => {
    const longWord = 'z'.repeat(MAX_CHUNK_SIZE * 2 + 5);
    const chunks: string[] = [];
    splitLongWord(longWord, chunks);
    expect(chunks.length).toBe(3);
    expect(chunks[0].length).toBe(MAX_CHUNK_SIZE);
    expect(chunks[1].length).toBe(MAX_CHUNK_SIZE);
    expect(chunks[2].length).toBe(5);
    expect(chunks.join('')).toBe(longWord);
  });

  it('handles word shorter than MAX_CHUNK_SIZE', () => {
    const word = 'shortword';
    const chunks: string[] = [];
    splitLongWord(word, chunks);
    expect(chunks).toEqual([word]);
  });

  it('handles empty word', () => {
    const chunks: string[] = [];
    splitLongWord('', chunks);
    expect(chunks).toEqual([]);
  });
});
