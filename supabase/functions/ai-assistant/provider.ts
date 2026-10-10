import { z } from 'zod';
export interface AiProvider {
  chat(messages: { role: string; content: string }[]): Promise<string>;
}
const responseSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().trim().min(1).max(6000) }) }))
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
        max_completion_tokens: 1600,
        store: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error('Provider unavailable');
    return responseSchema.parse(await response.json()).choices[0].message.content;
  }
}
