import { describe, expect, it } from 'vitest';
import {
  articlePath,
  articleStatus,
  readingMinutes,
  type Article,
} from '../../../apps/akselsmad/src/lib/editorial';
const now = Date.parse('2026-10-11T12:00:00Z');
const article: Article = {
  id: 'test',
  kind: 'guide',
  slug: 'laer-surdej',
  content: {
    title: 'Surdej',
    excerpt: '',
    category: 'Bagning',
    cover_path: '',
    cover_alt: '',
    blocks: [{ type: 'text', text: 'God mad' }],
  },
  visible: true,
  published_revision: 2,
  published_at: new Date(now).toISOString(),
};
describe('AkselsMad editorial publication', () => {
  it('uses the selected public section', () => {
    expect(articlePath(article)).toBe('/guides/laer-surdej');
    expect(articlePath({ kind: 'blog', slug: 'mit-koekken' })).toBe('/blog/mit-koekken');
  });
  it('marks future snapshots as scheduled and releases at the exact boundary', () => {
    expect(
      articleStatus({ ...article, published_at: new Date(now + 1).toISOString() }, 2, now),
    ).toBe('Planlagt');
    expect(articleStatus(article, 2, now)).toBe('Udgivet');
  });
  it('distinguishes an unpublished draft and changes after publication', () => {
    expect(articleStatus(undefined, 2, now)).toBe('Kladde');
    expect(articleStatus({ ...article, visible: false }, 2, now)).toBe('Kladde');
    expect(articleStatus(article, 3, now)).toBe('Udgivet · nye ændringer');
  });
  it('estimates reading time from text without counting photos or recipe IDs', () => {
    expect(
      readingMinutes({
        ...article.content,
        blocks: [
          { type: 'image', path: 'a', alt: 'b', caption: 'c' },
          { type: 'recipe', id: 'recipe' },
        ],
      }),
    ).toBe(1);
    expect(
      readingMinutes({
        ...article.content,
        blocks: [{ type: 'text', text: Array(401).fill('mad').join(' ') }],
      }),
    ).toBe(3);
  });
});
