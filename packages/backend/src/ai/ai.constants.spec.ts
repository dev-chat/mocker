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

  it('uses a neutral redeploy text prompt', () => {
    expect(REDPLOY_MOONBEAM_TEXT_PROMPT).toContain('concise, professional message');
    expect(REDPLOY_MOONBEAM_TEXT_PROMPT).not.toContain('cryptic');
  });
});
