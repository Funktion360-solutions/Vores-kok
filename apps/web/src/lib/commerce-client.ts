import type { SupabaseClient } from '@supabase/supabase-js';
import type { ShoppingItem } from '@vores-kok/database';
export {
  priceSchema,
  approvedLineSchema,
  approvedDocumentSchema,
  savedDocumentSchema,
} from '../../../../packages/validation/src/commerce';
export type {
  ShoppingPrice,
  ApprovedDocument,
  SavedDocument,
} from '../../../../packages/validation/src/commerce';
import { getBrowserClient } from './supabase/client';
// The shared project includes other apps. Keep these additive tables isolated
// instead of regenerating all of its database types into the browser package.
export const commerceDb = () => getBrowserClient() as unknown as SupabaseClient;
export const itemSignature = (item: ShoppingItem) =>
  JSON.stringify([item.name, item.quantity, item.unit]);
