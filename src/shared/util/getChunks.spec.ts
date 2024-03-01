import { getChunks } from './getChunks';
import { mockTextWithNewLines } from './getChunks.mock';

describe('getChunks', () => {
  it('should just return text if length is <= to 2920', () => {
    const text = 'a '.repeat(1460);
    const result = getChunks(text);
    expect(result).toEqual([text]);
  });

  it('should return text split by new lines when new lines exist', () => {
    const result = getChunks(mockTextWithNewLines);
    const expected = mockTextWithNewLines.split('\n');
    expect(result).toEqual(expected);
  });

  it('should return text without new lines split by 2920 characters', () => {
    const text = 'a '.repeat(5840);
    const length = text.length;
    console.log(length);
    const result = getChunks(text);
    const expected = [
      'a '.repeat(1459),
      'a '.repeat(1459),
      'a '.repeat(1459),
      'a '.repeat(1459),
      'a '.repeat(3) + 'a  ',
    ];
    for (let i = 0; i < result.length; i++) {
      expect(result[i].length).toBe(expected[i].length);
    }

    expect(result).toEqual(expected);
  });
});
