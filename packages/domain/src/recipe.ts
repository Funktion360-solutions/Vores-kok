export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Let',
  medium: 'Middel',
  hard: 'Svær',
};

/** Maps legacy Mors Opskrifter difficulty strings (and common synonyms). */
export function parseDifficulty(value: string | null | undefined): Difficulty | null {
  switch ((value ?? '').trim().toLowerCase()) {
    case 'let':
    case 'nem':
    case 'easy':
      return 'easy';
    case 'middel':
    case 'mellem':
    case 'medium':
      return 'medium';
    case 'svær':
    case 'svaer':
    case 'hard':
    case 'difficult':
      return 'hard';
    default:
      return null;
  }
}

export const MEAL_TYPES = ['breakfast', 'brunch', 'lunch', 'dinner', 'dessert', 'snack', 'baking', 'drink', 'side'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Morgenmad',
  brunch: 'Brunch',
  lunch: 'Frokost',
  dinner: 'Aftensmad',
  dessert: 'Dessert',
  snack: 'Snack',
  baking: 'Bagværk',
  drink: 'Drikke',
  side: 'Tilbehør',
};

export const SOURCE_TYPES = ['manual', 'legacy_import', 'url', 'text', 'image', 'pdf', 'scan', 'other'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  manual: 'Skrevet ind i hånden',
  legacy_import: 'Overført fra Mors Opskrifter',
  url: 'Hentet fra hjemmeside',
  text: 'Indsat tekst',
  image: 'Fra billede',
  pdf: 'Fra PDF',
  scan: 'Scannet original',
  other: 'Andet',
};

export const MEDIA_KINDS = ['photo', 'original_scan', 'historical_photo', 'document'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_KIND_LABELS: Record<MediaKind, string> = {
  photo: 'Foto af retten',
  original_scan: 'Original opskrift (scan)',
  historical_photo: 'Historisk billede',
  document: 'Dokument',
};

/** Legacy icon names available in Mors Opskrifter, kept for categories. */
export const CATEGORY_ICONS = ['bread', 'cake', 'cookie', 'croissant', 'dessert', 'folder', 'star'] as const;

export function totalMinutes(r: { prep_minutes?: number | null; cook_minutes?: number | null; total_minutes?: number | null }): number | null {
  if (r.total_minutes != null) return r.total_minutes;
  if (r.prep_minutes == null && r.cook_minutes == null) return null;
  return (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);
}

/** 45 → "45 min", 60 → "1 t.", 150 → "2 t. 30 min", 1440 → "1 døgn". Matches legacy TotalTimeLabel. */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || minutes < 0) return '';
  if (minutes >= 1440 && minutes % 1440 === 0) {
    const d = minutes / 1440;
    return d === 1 ? '1 døgn' : `${d} døgn`;
  }
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h} t.` : `${h} t. ${m} min`;
  }
  return `${minutes} min`;
}

/** "4 personer", "16 stk", "40 kranse". */
export function formatYield(servings: number | null | undefined, yieldUnit: string | null | undefined): string {
  if (!servings) return '';
  const unit = yieldUnit?.trim() || (servings === 1 ? 'person' : 'personer');
  return `${servings} ${unit}`;
}

/** Danish long date: "10. maj 2026". */
export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  const months = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];
  return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatYear(year: number | null | undefined, approx = true): string {
  if (!year) return '';
  return approx ? `ca. ${year}` : String(year);
}
