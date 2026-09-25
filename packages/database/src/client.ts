import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.gen';

export type VKClient = SupabaseClient<Database>;

/** Error surfaced to UIs with a Danish, user-safe message. Raw details stay in `cause`. */
export class DataError extends Error {
  readonly code: string;
  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DataError';
    this.code = code;
  }
  get isConflict() {
    return this.code === 'VK409';
  }
  get isForbidden() {
    return this.code === '42501' || this.code === 'PGRST301';
  }
  get isNetwork() {
    return this.code === 'NETWORK';
  }
}

const MESSAGES: Record<string, string> = {
  VK409: 'Opskriften er blevet ændret af en anden, mens du redigerede. Hent den nyeste version og prøv igen.',
  '42501': 'Du har ikke adgang til at gøre dette.',
  PGRST301: 'Din session er udløbet. Log ind igen.',
  '23505': 'Der findes allerede et element med det navn.',
  '23503': 'Et relateret element findes ikke (længere).',
  '23514': 'Nogle af værdierne er ugyldige.',
  '22023': 'Ugyldigt input.',
  '54000': 'Grænsen er nået.',
  P0002: 'Elementet blev ikke fundet.',
  NETWORK: 'Ingen forbindelse. Prøv igen, når du er online.',
};

interface PgErrorLike {
  code?: string;
  message?: string;
}

export function toDataError(err: unknown): DataError {
  if (err instanceof DataError) return err;
  const e = (err ?? {}) as PgErrorLike;
  const msg = e.message ?? '';
  let code = e.code ?? '';
  if (!code && /fetch|network|Failed to fetch|Network request failed/i.test(msg)) code = 'NETWORK';
  if (code === '23514' && /last owner|at least one owner/.test(msg)) {
    return new DataError(code, 'En husstand skal have mindst én ejer.', { cause: err });
  }
  if (code === '22023' && /invalid invite/.test(msg)) {
    return new DataError(code, 'Invitationen er ugyldig, udløbet eller allerede brugt.', { cause: err });
  }
  return new DataError(code || 'UNKNOWN', MESSAGES[code] ?? 'Noget gik galt. Prøv igen.', { cause: err });
}

/** Unwraps a Supabase response; throws on error or when no data came back. */
export function unwrap<T>(res: { data: T | null; error: PgErrorLike | null }): NonNullable<T> {
  if (res.error) throw toDataError(res.error);
  if (res.data == null) throw new DataError('P0002', MESSAGES.P0002!);
  return res.data as NonNullable<T>;
}

/** Like unwrap, but null data is a valid answer (maybeSingle, nullable RPCs). */
export function maybe<T>(res: { data: T | null; error: PgErrorLike | null }): T | null {
  if (res.error) throw toDataError(res.error);
  return res.data;
}

/** Only checks for an error (void RPCs, deletes). */
export function check(res: { error: PgErrorLike | null }): void {
  if (res.error) throw toDataError(res.error);
}
