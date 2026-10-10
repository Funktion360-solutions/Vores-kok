import { FunctionsHttpError } from '@supabase/supabase-js';
import {
  aiReplySchema,
  aiRequestSchema,
  type AiRequest,
  type AiReply,
} from '@vores-kok/validation';
import type { VKClient } from './client';

/** Shared boundary: errors are translated, and provider output is validated on both clients. */
export async function askAssistant(db: VKClient, request: AiRequest): Promise<AiReply> {
  const body = aiRequestSchema.parse(request);
  const { data, error } = await db.functions.invoke('ai-assistant', { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const messages: Record<number, string> = {
        400: 'Kontrollér beskeden og prøv igen.',
        401: 'Log ind igen for at bruge assistenten.',
        403: 'Du har ikke adgang til assistenten for denne husstand.',
        413: 'Beskeden er for lang.',
        429: 'Vent lidt før næste spørgsmål. Der er højst 50 spørgsmål pr. dag.',
        503: 'Assistenten er ikke klar endnu. Kontrollér serverens opsætning.',
      };
      throw new Error(
        messages[error.context.status] ?? 'Assistenten kunne ikke svare. Prøv igen senere.',
      );
    }
    throw new Error('Kontrollér internetforbindelsen og prøv igen.');
  }
  return aiReplySchema.parse(data);
}
