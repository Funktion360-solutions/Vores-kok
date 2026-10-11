export type ArticleBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; path: string; alt: string; caption: string }
  | { type: 'recipe'; id: string };
export type ArticleContent = {
  title: string;
  excerpt: string;
  category: string;
  cover_path: string;
  cover_alt: string;
  blocks: ArticleBlock[];
};
export type Article = {
  id: string;
  kind: 'guide' | 'blog';
  slug: string;
  content: ArticleContent;
  published_revision: number;
  visible: boolean;
  published_at: string;
};
export type ArticleDraft = {
  id: string;
  kind: 'guide' | 'blog';
  slug: string;
  content: ArticleContent;
  revision: number;
  updated_at: string;
};
export const articleCategories = [
  'Bagning',
  'Surdej',
  'Italiensk køkken',
  'Teknikker',
  'Råvarer',
  'Fra mit køkken',
  'Madglæde',
];
export function articlePath(article: Pick<Article, 'kind' | 'slug'>) {
  return '/' + (article.kind === 'guide' ? 'guides' : 'blog') + '/' + article.slug;
}
export function readingMinutes(content: ArticleContent) {
  const words = content.blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join(' ')
    .trim()
    .split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}
export function articleStatus(article: Article | undefined, revision: number, now = Date.now()) {
  if (!article?.visible) return 'Kladde';
  if (Date.parse(article.published_at) > now) return 'Planlagt';
  return article.published_revision === revision ? 'Udgivet' : 'Udgivet · nye ændringer';
}
