'use client';
import { useSyncExternalStore } from 'react';

const noop = () => () => undefined;

/** True once React has hydrated on the client. Used to keep submit buttons
 * disabled until JavaScript handles the form (never a native GET fallback). */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
