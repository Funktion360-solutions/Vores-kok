export * from './recipe';
export * from './misc';
export { z } from 'zod';

/** Flattens a ZodError into { "field.path": "first message" } for forms. */
export function fieldErrors(error: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }> }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || '_';
    out[key] ??= issue.message;
  }
  return out;
}
