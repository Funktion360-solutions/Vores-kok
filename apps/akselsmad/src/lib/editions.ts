export type EditionKind = 'course' | 'book';
export type EditionItem = { type: 'recipe' | 'guide' | 'blog'; id: string };
export type EditionChapter = { key: string; title: string; intro: string; items: EditionItem[] };
export type EditionContent = {
  title: string;
  excerpt: string;
  intro: string;
  category: string;
  chapters: EditionChapter[];
};
export type EditionDraft = {
  id: string;
  kind: EditionKind;
  slug: string;
  content: EditionContent;
  revision: number;
  updated_at: string;
};
export type Edition = Omit<EditionDraft, 'revision' | 'updated_at'> & {
  published_revision: number;
  visible: boolean;
  published_at: string;
};
export type EditionOption = EditionItem & { title: string; category: string; href: string };
export const editionCategories = [
  'Italiensk køkken',
  'Pasta',
  'Salater',
  'Gæstemad',
  'Hverdagsmad',
  'Råvarer og teknikker',
  'Bagning',
  'Surdej',
  'Dessert',
];
export function editionPath(e: { kind: EditionKind; slug: string }) {
  return '/' + (e.kind === 'course' ? 'forloeb' : 'kogeboeger') + '/' + e.slug;
}
export function moveEditionItem<T>(items: T[], index: number, direction: number) {
  const result = [...items];
  const next = index + direction;
  if (index < 0 || index >= items.length || next < 0 || next >= items.length) return result;
  const item = result.splice(index, 1)[0]!;
  result.splice(next, 0, item);
  return result;
}
export function validEdition(value: unknown): value is EditionContent {
  if (!value || typeof value !== 'object') return false;
  const c = value as EditionContent;
  const text = (v: unknown, min: number, max: number) =>
    typeof v === 'string' && v.trim().length >= min && v.length <= max;
  const id = (v: unknown) =>
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
  if (
    !text(c.title, 3, 180) ||
    !text(c.excerpt, 0, 600) ||
    !text(c.intro, 0, 20000) ||
    !text(c.category, 1, 80) ||
    !Array.isArray(c.chapters) ||
    c.chapters.length < 1 ||
    c.chapters.length > 30
  )
    return false;
  if (Object.keys(c).sort().join() !== 'category,chapters,excerpt,intro,title') return false;
  const keys = new Set<string>();
  let count = 0;
  for (const chapter of c.chapters) {
    if (
      !chapter ||
      !id(chapter.key) ||
      keys.has(chapter.key) ||
      !text(chapter.title, 1, 180) ||
      !text(chapter.intro, 0, 20000) ||
      !Array.isArray(chapter.items) ||
      chapter.items.length > 20 ||
      Object.keys(chapter).sort().join() !== 'intro,items,key,title'
    )
      return false;
    keys.add(chapter.key);
    const refs = new Set<string>();
    for (const item of chapter.items) {
      if (
        !item ||
        !['recipe', 'guide', 'blog'].includes(item.type) ||
        !id(item.id) ||
        Object.keys(item).sort().join() !== 'id,type' ||
        refs.has(item.type + item.id)
      )
        return false;
      refs.add(item.type + item.id);
      count++;
    }
  }
  return count <= 100 && new TextEncoder().encode(JSON.stringify(c)).length <= 200000;
}
