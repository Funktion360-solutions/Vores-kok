import type { Metadata } from 'next';
import { randomUUID } from 'node:crypto';
import { requirePublisher } from '@/lib/data';
import { editionOptions } from '@/lib/editions-data';
import { EditionEditor } from '@/components/edition-editor';
export const metadata: Metadata = {
  title: 'Ny udgivelse',
  robots: { index: false, follow: false },
};
const themes = {
  italian: {
    title: 'En italiensk middag fra mit køkken',
    category: 'Gæstemad',
    chapters: [
      'Forberedelser og menu',
      'Antipasti og salat',
      'Pastaretten',
      'Brød til bordet',
      'Dessert og servering',
    ],
  },
  pasta: {
    title: 'Pasta fra bunden',
    category: 'Pasta',
    chapters: [
      'Mel, æg og udstyr',
      'Dejen og hviletiden',
      'Form din pasta',
      'Saucer med karakter',
      'Saml og servér retten',
    ],
  },
  salads: {
    title: 'Salater med karakter',
    category: 'Salater',
    chapters: [
      'En god salat begynder her',
      'Dressinger og balance',
      'Italienske salater',
      'Salater som hovedmåltid',
      'Sæson og variationer',
    ],
  },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; theme?: string }>;
}) {
  await requirePublisher();
  const params = await searchParams;
  const kind = params.kind === 'book' ? 'book' : 'course';
  const theme =
    params.theme && Object.hasOwn(themes, params.theme)
      ? themes[params.theme as keyof typeof themes]
      : null;
  const seed = {
    title: theme?.title || '',
    excerpt: '',
    intro: '',
    category: theme?.category || 'Italiensk køkken',
    chapters: (theme?.chapters || [kind === 'course' ? 'Første trin' : 'Første kapitel']).map(
      (title) => ({ key: randomUUID(), title, intro: '', items: [] }),
    ),
  };
  return (
    <EditionEditor
      initial={null}
      published={null}
      kind={kind}
      seed={seed}
      options={await editionOptions()}
    />
  );
}
