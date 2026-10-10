import { z } from 'zod';
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const commerceLineSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    quantity: z.number().positive().max(1000000).nullable(),
    unit: z.string().max(40).nullable(),
    price_ore: z.number().int().min(-100000000).max(100000000).nullable(),
    kind: z.enum(['product', 'deposit', 'discount', 'other']),
    valid_from: dateSchema.nullable(),
    valid_to: dateSchema.nullable(),
    membership: z.boolean(),
    warnings: z.array(z.string().max(500)).max(10),
  })
  .strict();
export const commerceDocumentSchema = z
  .object({
    store: z.string().max(200).nullable(),
    date: dateSchema.nullable(),
    currency: z.string().max(3).nullable(),
    total_ore: z.number().int().min(0).max(100000000).nullable(),
    lines: z.array(commerceLineSchema).min(1).max(100),
    warnings: z.array(z.string().max(1000)).max(20),
  })
  .strict();
export type CommerceDocument = z.infer<typeof commerceDocumentSchema>;
export type CommerceLine = z.infer<typeof commerceLineSchema>;
export const money = (ore: number) =>
  new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK' }).format(ore / 100);
export function parseOre(text: string): number | null {
  if (!text.trim()) return null;
  const normalized = text.trim().replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) throw new Error('Skriv prisen i kroner, fx 19,95.');
  const value = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(value) || Math.abs(value) > 100000000)
    throw new Error('Prisen er for stor.');
  return value;
}

export function copenhagenDay(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Copenhagen',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function offerWeek(day: string): string {
  const date = new Date(day + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 4) % 7));
  return date.toISOString().slice(0, 10);
}
export function offerStatus(
  from: string | null,
  to: string | null,
  today: string,
): 'active' | 'future' | 'expired' | 'unknown' {
  if (to && to < today) return 'expired';
  if (from && from > today) return 'future';
  return to ? 'active' : 'unknown';
}
export const providerOfferSchema = z.object({
  product_id: z.number().int(),
  name: z.string().nullable(),
  brand: z.string().nullable().optional(),
  chain_slug: z.string(),
  chain_name: z.string(),
  price: z.number().int().nonnegative(),
  normal_price: z.number().int().nonnegative().nullable(),
  quantity_label: z.string().nullable(),
  offer_starts: dateSchema.nullable(),
  offer_ends: dateSchema,
  source: z.enum(['scraped', 'flyer']),
  chain_gtins: z.array(z.string()).default([]),
  chain_gtins_source: z.enum(['chain', 'matched']).nullable().optional(),
  multi_buy: z
    .object({
      quantity: z.number().int().min(2),
      price: z.number().int().nonnegative(),
      price_each: z.number().int().nonnegative(),
    })
    .nullable()
    .optional(),
});
export const providerFlyerSchema = z.object({
  chain_slug: z.string(),
  chain_name: z.string(),
  flyer_id: z.string(),
  valid_from: dateSchema,
  valid_to: dateSchema,
  page_urls: z.array(z.string().url()).max(200),
  offer_count: z.number().int().nonnegative(),
});
export const offerCacheSchema = z.object({
  offers: z.array(providerOfferSchema).max(800),
  flyers: z.array(providerFlyerSchema).max(100),
  warnings: z.array(z.string()),
  as_of: z.string().nullable(),
  fetched_at: z.string(),
});
export type ProviderOffer = z.infer<typeof providerOfferSchema>;
export type OfferCache = z.infer<typeof offerCacheSchema>;

export const priceSchema = z.object({
  item_id: z.uuid(),
  household_id: z.uuid(),
  store: z.string(),
  item_signature: z.string(),
  total_ore: z.number().int().nonnegative().nullable(),
  updated_at: z.string(),
});
export type ShoppingPrice = z.infer<typeof priceSchema>;
export const approvedLineSchema = commerceLineSchema.extend({
  id: z.uuid(),
  pantry_location_id: z.uuid().nullable(),
});
export const approvedDocumentSchema = commerceDocumentSchema.extend({
  currency: z.literal('DKK'),
  lines: z.array(approvedLineSchema).min(1).max(100),
});
export type ApprovedDocument = z.infer<typeof approvedDocumentSchema>;
export const savedDocumentSchema = z.object({
  id: z.uuid(),
  kind: z.enum(['receipt', 'flyer']),
  created_at: z.string(),
  payload: approvedDocumentSchema,
});
export type SavedDocument = z.infer<typeof savedDocumentSchema>;
