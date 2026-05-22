import type OpenAI from 'openai';

export const extractOpenAiResponseText = (response: OpenAI.Responses.Response): string | undefined => {
  const textBlock = response.output.find((item) => item.type === 'message');
  if (textBlock && 'content' in textBlock) {
    const outputText = textBlock.content.find((item) => item.type === 'output_text');
    return outputText?.text.trim();
  }
  return undefined;
};
