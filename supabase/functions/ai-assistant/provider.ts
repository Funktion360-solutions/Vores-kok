import { z } from 'zod';
export class IncompleteAiAnswer extends Error {}
export interface AiProvider {
  chat(messages: { role: string; content: string }[]): Promise<string>;
}
const responseSchema = z.object({
  choices: z
    .array(z.object({ finish_reason: z.string(), message: z.object({ content: z.string().trim().min(1).max(24000) }) }))
    .min(1),
});
export class OpenAiProvider implements AiProvider {
  constructor(
    private key: string,
    private model: string,
    private baseUrl: string,
  ) {
    if (!['https://api.openai.com/v1', 'https://eu.api.openai.com/v1'].includes(baseUrl))
      throw new Error('Invalid provider endpoint');
  }
  async chat(messages: { role: string; content: string }[]) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_completion_tokens: 4500,
        store: false,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error('Provider unavailable');
    const choice = responseSchema.parse(await response.json()).choices[0];
    if (choice.finish_reason !== 'stop') throw new IncompleteAiAnswer('Incomplete response');
    return choice.message.content;
  }
}
