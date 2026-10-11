import {
  validateNewsletter,
  type NewsletterCampaign,
  type NewsletterContent,
  type NewsletterItem,
} from './newsletter';
export type NewsletterSummary = Pick<
  NewsletterCampaign,
  'id' | 'revision' | 'status' | 'updated_at'
> & { subject: string; title: string };
export const newsletterTemplates = [
  {
    id: 'kitchen',
    label: 'Nyt fra køkkenet',
    tag: 'OPSKRIFTER & FORTÆLLINGER',
    description:
      'Et personligt brev med plads til en blanding af opskrifter, guides og små historier.',
    content: {
      subject: 'Nyt fra Aksels køkken',
      preheader: 'Opskrifter, guides og madglæde til dit køkken.',
      title: 'Velkommen indenfor i mit køkken',
      intro:
        'Her er lidt inspiration fra mit køkken. Jeg håber, du finder noget, du får lyst til at lave.\n\nTag dig tid til at gå på opdagelse i opskrifterne og nyd processen undervejs.',
      closing: 'Tak, fordi du læser med. Jeg glæder mig til at dele mere madglæde med dig.',
      items: [],
    },
  },
  {
    id: 'italian',
    label: 'En bid af Italien',
    tag: 'ITALIENSK INSPIRATION',
    description: 'Pasta, brød og italiensk madglæde. Vælg selv de opskrifter, der skal med.',
    content: {
      subject: 'En bid af Italien fra AkselsMad',
      preheader: 'Inspiration til italiensk mad i dit eget køkken.',
      title: 'Lad os tage en tur til Italien',
      intro:
        'Italiensk mad er en af mine store glæder. Gode råvarer, enkle idéer og tid til at nyde maden.\n\nI dette brev finder du inspiration til at tage lidt af den glæde med ind i dit eget køkken.',
      closing:
        'Sæt gerne lidt ekstra tid af til både madlavningen og måltidet. Det er en del af fornøjelsen.',
      items: [],
    },
  },
  {
    id: 'baking',
    label: 'Tid til at bage',
    tag: 'BRØD & BAGNING',
    description: 'Et brev til læsere, der elsker mel på bordet og duften af hjemmebagt brød.',
    content: {
      subject: 'Tid til at bage med AkselsMad',
      preheader: 'Bagning, gode råd og inspiration til dit næste bagværk.',
      title: 'Mel på bordet. Glæde i køkkenet.',
      intro:
        'Der er noget særligt ved at følge en dej fra de første ingredienser til det færdige bagværk.\n\nHer finder du inspiration til næste gang, du har lyst til at bage. Læs opskriften igennem først og giv dejen den tid, den har brug for.',
      closing:
        'Hvis du prøver en af opskrifterne, må du gerne svare på brevet og fortælle, hvordan det gik.',
      items: [],
    },
  },
  {
    id: 'guide',
    label: 'Lær noget nyt',
    tag: 'GUIDES & GODE RÅD',
    description:
      'Sæt en teknik eller guide i centrum, og følg op med opskrifter, hvor den kan bruges.',
    content: {
      subject: 'Lær noget nyt i køkkenet med AkselsMad',
      preheader: 'Grundige guides og inspiration til at prøve noget nyt.',
      title: 'De små detaljer gør en forskel',
      intro:
        'Glæden ved at lave mad bliver ofte større, når vi forstår, hvad der sker undervejs.\n\nHer får du inspiration til at blive mere fortrolig med dit køkken. Prøv én ting ad gangen, og brug gerne guiden sammen med en opskrift.',
      closing: 'Tag det i dit eget tempo. Det er helt i orden at prøve sig frem og lære undervejs.',
      items: [],
    },
  },
] satisfies {
  id: string;
  label: string;
  tag: string;
  description: string;
  content: NewsletterContent;
}[];
export function newsletterTemplate(id?: string): NewsletterContent {
  const chosen = newsletterTemplates.find((t) => t.id === id) || newsletterTemplates[0]!;
  return validateNewsletter({ ...chosen.content, items: [] });
}
export function copyNewsletterDraft(
  source: Pick<NewsletterCampaign, 'content' | 'status'>,
  available: NewsletterItem[],
) {
  if (source.status !== 'draft' && source.status !== 'sent')
    throw Error('Vent med at genbruge brevet, indtil den igangværende udsendelse er afklaret.');
  const original = validateNewsletter(source.content);
  const items = original.items.filter((i) =>
    available.some((x) => x.kind === i.kind && x.id === i.id),
  );
  return {
    content: validateNewsletter({
      ...original,
      subject: ('Nyt brev: ' + original.subject).slice(0, 200),
      items,
    }),
    removed: original.items.length - items.length,
  };
}
export function moveNewsletterItem(
  items: NewsletterContent['items'],
  index: number,
  direction: -1 | 1,
) {
  const next = index + direction;
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= items.length ||
    next < 0 ||
    next >= items.length
  )
    return items;
  const copy = items.slice();
  [copy[index], copy[next]] = [copy[next]!, copy[index]!];
  return copy;
}
export type NewsletterFilter = 'all' | 'draft' | 'ready' | 'progress' | 'sent';
export const newsletterFilters = {
  all: 'Alle breve',
  draft: 'Kladder',
  ready: 'Klar til godkendelse',
  progress: 'Skal følges op',
  sent: 'Udsendte',
};
export function filterNewsletters(
  list: NewsletterSummary[],
  search: string,
  status: NewsletterFilter,
  sort: 'recent' | 'oldest' | 'subject',
) {
  const term = search.trim().toLocaleLowerCase('da');
  return list
    .filter(
      (c) =>
        (status === 'all' ||
          (status === 'progress'
            ? ['preparing', 'sending', 'submitted'].includes(c.status)
            : c.status === status)) &&
        (!term || (c.subject + ' ' + c.title).toLocaleLowerCase('da').includes(term)),
    )
    .sort((a, b) =>
      sort === 'subject'
        ? a.subject.localeCompare(b.subject, 'da')
        : sort === 'oldest'
          ? Date.parse(a.updated_at) - Date.parse(b.updated_at)
          : Date.parse(b.updated_at) - Date.parse(a.updated_at),
    );
}
