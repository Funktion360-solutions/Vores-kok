import type { MetadataRoute } from 'next';
import { articles } from '@/lib/editorial-data';
import { articlePath } from '@/lib/editorial';
import { editions } from '@/lib/editions-data';
import { editionPath } from '@/lib/editions';
import { publicRecipes } from '@/lib/data';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://akselsmad.dk';
  const [recipes, editorial, courses, books] = await Promise.all([
    publicRecipes(),
    articles(),
    editions('course'),
    editions('book'),
  ]);
  return [
    { url: origin },
    { url: origin + '/opskrifter' },
    { url: origin + '/om' },
    { url: origin + '/guides' },
    { url: origin + '/blog' },
    { url: origin + '/nyhedsbrev' },
    { url: origin + '/forloeb' },
    { url: origin + '/kogeboeger' },
    ...[...courses, ...books].map((e) => ({
      url: origin + editionPath(e),
      lastModified: e.published_at,
    })),
    ...editorial.map((a) => ({ url: origin + articlePath(a), lastModified: a.published_at })),
    ...recipes.map((r) => ({
      url: origin + '/opskrifter/' + r.slug,
      lastModified: r.published_at,
    })),
  ];
}
