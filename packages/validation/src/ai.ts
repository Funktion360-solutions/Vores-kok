import { z } from 'zod';
export const aiRequestSchema = z
  .object({
    householdId: z.uuid(),
    message: z.string().trim().min(1).max(2000),
    history: z
      .array(
        z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(6000) }),
      )
      .max(8)
      .default([]),
  })
  .strict();
export const aiReplySchema = z.object({
  answer: z.string().trim().min(1).max(6000),
  recipes: z.array(z.object({ id: z.uuid(), title: z.string().max(200) })).max(6),
});
export type AiRequest = z.infer<typeof aiRequestSchema>;
export type AiReply = z.infer<typeof aiReplySchema>;
