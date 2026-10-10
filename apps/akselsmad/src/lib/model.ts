export type Ingredient = {
  name: string;
  quantity: number | null;
  unit: string | null;
  preparation?: string | null;
};
export type Step = { body: string; timer_seconds?: number | null };
export type Recipe = {
  title: string;
  description: string;
  category: string;
  cuisine: string;
  servings: number;
  yield_unit: string;
  prep_minutes: number | null;
  cook_minutes: number | null;
  total_minutes: number | null;
  difficulty: string;
  ingredients: Ingredient[];
  steps: Step[];
  tags: string[];
  equipment?: string;
  notes?: string;
  tips?: string;
  storage?: string;
  freezing?: string;
  variations?: string;
  troubleshooting?: string;
  baking?: string;
  cover_path?: string;
};
export type PublicRecipe = {
  id: string;
  slug: string;
  content: Recipe;
  published_revision: number;
  published_at: string;
  visible: boolean;
};
export type Draft = {
  id: string;
  slug: string;
  content: Recipe;
  revision: number;
  source_recipe_id: string | null;
  updated_at: string;
};
export const categories = [
  'Morgenmad',
  'Brunch',
  'Frokost',
  'Aftensmad',
  'Pasta',
  'Pizza',
  'Supper',
  'Salater',
  'Sandwich',
  'Burgere',
  'Gryderetter',
  'Ovnretter',
  'Grillmad',
  'Boller',
  'Brød',
  'Surdej',
  'Focaccia',
  'Rundstykker',
  'Rugbrød',
  'Kager',
  'Småkager',
  'Sødt bagværk',
  'Dessert',
  'Snacks',
  'Tilbehør',
  'Drikke',
];
export const collections = [
  'Hverdagsmad',
  'Gæstemad',
  'Weekendmad',
  'Madpakker',
  'Jul',
  'Påske',
  'Fødselsdag',
  'Italiensk',
  'Danske klassikere',
  'Budgetmad',
  'Hurtig mad',
  'Frysevenligt',
  'Mad med rester',
];
export const emptyRecipe: Recipe = {
  title: '',
  description: '',
  category: 'Aftensmad',
  cuisine: '',
  servings: 4,
  yield_unit: 'personer',
  prep_minutes: null,
  cook_minutes: null,
  total_minutes: null,
  difficulty: '',
  ingredients: [{ name: '', quantity: null, unit: '' }],
  steps: [{ body: '', timer_seconds: null }],
  tags: [],
};
export const detailFields = [
  ['equipment', 'Udstyr'],
  ['tips', 'Gode råd'],
  ['troubleshooting', 'Typiske fejl og løsninger'],
  ['storage', 'Opbevaring'],
  ['freezing', 'Frysning og genopvarmning'],
  ['variations', 'Variationer og erstatninger'],
  ['baking', 'Bagenoter og tidsplan'],
  ['notes', 'Andre noter'],
] as const;
export function slugify(s: string) {
  return s
    .toLowerCase()
    .replaceAll('æ', 'ae')
    .replaceAll('ø', 'oe')
    .replaceAll('å', 'aa')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 160);
}
export function totalTime(r: Recipe) {
  return r.total_minutes ?? (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);
}
export function filterRecipes(
  rows: PublicRecipe[],
  q: string,
  category: string,
  maxMinutes: number,
  difficulty: string,
) {
  const query = q.toLocaleLowerCase('da').trim();
  return rows.filter(
    ({ content: r }) =>
      (!category || r.category === category) &&
      (!difficulty || r.difficulty === difficulty) &&
      (!maxMinutes || (totalTime(r) > 0 && totalTime(r) <= maxMinutes)) &&
      (!query ||
        [
          r.title,
          r.description,
          r.category,
          r.cuisine,
          ...r.tags,
          ...r.ingredients.map((i) => i.name),
        ]
          .join(' ')
          .toLocaleLowerCase('da')
          .includes(query)),
  );
}
