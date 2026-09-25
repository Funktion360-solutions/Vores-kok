import 'server-only';
import { signMediaUrls, type VKClient } from '@vores-kok/database';

/** Signs private media paths for rendering. Failures degrade to "no image". */
export async function signedUrls(db: VKClient, paths: Array<string | null | undefined>): Promise<Record<string, string>> {
  const list = paths.filter((p): p is string => Boolean(p));
  if (!list.length) return {};
  try {
    return await signMediaUrls(db, list, 60 * 60);
  } catch {
    return {};
  }
}
