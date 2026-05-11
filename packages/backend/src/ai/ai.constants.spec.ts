import { describe, expect, it } from 'vitest';

import { MOONBEAM_SYSTEM_INSTRUCTIONS, REDPLOY_MOONBEAM_TEXT_PROMPT } from './ai.constants';

describe('moonbeam prompt constants', () => {
  it('keeps moonbeam system instructions professional and direct', () => {
    expect(MOONBEAM_SYSTEM_INSTRUCTIONS).toContain('your default is clear, professional, and direct.');
    expect(MOONBEAM_SYSTEM_INSTRUCTIONS).toContain('using neutral, professional phrasing');
    expect(MOONBEAM_SYSTEM_INSTRUCTIONS).not.toContain('witty');
    expect(MOONBEAM_SYSTEM_INSTRUCTIONS).not.toContain('sharp, specific joke');
    expect(MOONBEAM_SYSTEM_INSTRUCTIONS).not.toContain('dry sarcasm');
    expect(MOONBEAM_SYSTEM_INSTRUCTIONS).not.toContain("friend who's smart and comfortable in the group");
  });

  it('requires moonbeam to pick a winner when asked comparative or winner-related questions', () => {
    expect(MOONBEAM_SYSTEM_INSTRUCTIONS).toContain("asked who won, who's winning, who's better, did someone win");
    expect(MOONBEAM_SYSTEM_INSTRUCTIONS).toContain(
      'name a winner, declare a clear preference, or state an unambiguous judgment',
    );
    expect(MOONBEAM_SYSTEM_INSTRUCTIONS).toContain('do not give a tie');
    expect(MOONBEAM_SYSTEM_INSTRUCTIONS).toContain('non-committal');
  });

  it('requires winner check in the verification section', () => {
    expect(MOONBEAM_SYSTEM_INSTRUCTIONS).toContain(
      'if the question asks for a winner or asks to pick a side, does it name one clearly without hedging or giving a tie?',
    );
  });

  it('uses a neutral redeploy text prompt', () => {
    expect(REDPLOY_MOONBEAM_TEXT_PROMPT).toContain('concise, professional message');
    expect(REDPLOY_MOONBEAM_TEXT_PROMPT).not.toContain('cryptic');
  });
});
