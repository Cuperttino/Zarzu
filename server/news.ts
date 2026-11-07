import { TtlCache, cdn, env, fetchWithTimeout, json, normalize } from './http.js';
import { type RawItem, ogImage, parseFeed } from './rss.js';

export const CATEGORIES = ['vaticano', 'papa', 'espana', 'diocesis', 'semana-santa', 'cofradias', 'santos', 'internacional', 'cultura'] as const;
export type Category = (typeof CATEGORIES)[number];
export interface Feed { id: string; name: string; url: string; categories: Category[]; exclude?: RegExp; }
export interface NewsItem { id: string; title: string; summary: string; date: string; image: string | null; source: string; sourceId: string; link: string; categories: Category[]; }

export const FEEDS: Feed[] = [
  { id: 'vaticannews', name: 'Vatican News', url: 'https://www.vaticannews.va/es.rss.xml', categories: ['vaticano'] },
  { id: 'cee', name: 'Conferencia Episcopal Española', url: 'https://www.conferenciaepiscopal.es/feed/', categories: ['espana'], exclude: /^evangelio$/i },
  { id: 'alfayomega', name: 'Alfa y Omega', url: 'https://alfayomega.es/feed/', categories: [] },
  { id: 'vidanueva', name: 'Vida Nueva', url: 'https://www.vidanuevadigital.com/feed/', categories: [] },
  { id: 'archisevilla', name: 'Archidiócesis de Sevilla', url: 'https://www.archisevilla.org/feed/', categories: ['diocesis'] },
];

function extraFeeds(): Feed[] {
  const raw = env('NEWS_EXTRA_FEEDS');
  if (!raw) return [];
  try { return (JSON.parse(raw) as Feed[]).filter((f) => f.id && f.name && /^https:\/\//.test(f.url)).map((f) => ({ ...f, categories: f.categories ?? [] })); } catch { return []; }
}

const RULES: [Category, RegExp][] = [
  ['papa', /\b(papa|leon xiv|pontifice|santo padre|santa sede|audiencia general|angelus)\b/],
  ['vaticano', /\b(vaticano|vaticana|santa sede|curia romana|dicasterio|san pedro)\b/],
  ['espana', /\b(espana|espanol[a]?|espanoles|cee|conferencia episcopal espanola|omella|arguello|madrid|sevilla|barcelona|toledo|granada|valencia|santiago de compostela|andalucia|cataluna|galicia)\b/],
  ['diocesis', /\b(diocesis|diocesano|diocesana|archidiocesis|obispo de|arzobispo de|obispado|arzobispado|seminario|parroquia)\b/],
  ['semana-santa', /\b(semana santa|cuaresma|domingo de ramos|viernes santo|jueves santo|pregon|nazarenos?|via crucis)\b/],
  ['cofradias', /\b(hermandad(es)?|cofradia[s]?|costalero[s]?|capataz|paso de misterio|palio|penitencia|hermano mayor|coronacion canonica)\b/],
  ['santos', /\b(santoral|santo[s]?|santa[s]?|beato[s]?|beata[s]?|beatificacion|canonizacion|canonizado|martir(es)?)\b/],
  ['internacional', /\b(america|africa|asia|europa|ucrania|gaza|tierra santa|libano|nigeria|mexico|argentina|peru|colombia|francia|italia|alemania|estados unidos|china|india|internacional|celam)\b/],
  ['cultura', /\b(cine|musica|exposicion|museo|patrimonio|catedral|restauracion|arte|cultura|libro|concierto|retablo|libros)\b/],
];

export function classify(item: RawItem, base: Category[]): Category[] {
  const hay = normalize(`${item.title} ${item.categories.join(' ')}`);
  const set = new Set<Category>(base);
  for (const [c, re] of RULES) if (re.test(hay)) set.add(c);
  // "Santa" y "santo" aparecen en muchos titulares ("Santa Sede", "Semana Santa"): se exige algo más.
  if (set.has('santos') && !base.includes('santos') && /\b(santa sede|semana santa|santo padre|tierra santa|viernes santo|jueves santo)\b/.test(hay) && !/\b(santoral|beat[oa]s?|canoniz|beatific)/.test(hay)) set.delete('santos');
  if (!set.size) set.add('internacional');
  return [...set];
}

const pageImage = new TtlCache<string | null>(24 * 3600_000, 800);
async function imageFromPage(link: string): Promise<string | null> {
  const hit = pageImage.get(link);
  if (hit !== undefined) return hit;
  try {
    const res = await fetchWithTimeout(link, { timeoutMs: 3500, headers: { accept: 'text/html' } });
    if (!res.ok) throw new Error();
    const html = (await res.text()).slice(0, 200_000);
    const img = ogImage(html);
    pageImage.set(link, img);
    return img;
  } catch { pageImage.set(link, null); return null; }
}

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };

export interface NewsResult { items: NewsItem[]; sources: { id: string; name: string; ok: boolean; count: number }[]; fetchedAt: string; }
const cache = new TtlCache<NewsResult>(15 * 60_000, 3);

export async function collectNews(feeds: Feed[] = [...FEEDS, ...extraFeeds()], fetcher = fetchWithTimeout): Promise<NewsResult> {
  const results = await Promise.all(feeds.map(async (f) => {
    try {
      const res = await fetcher(f.url, { timeoutMs: 7000, headers: { accept: 'application/rss+xml, application/xml, text/xml, */*' } });
      if (!res.ok) throw new Error(String(res.status));
      const items = parseFeed(await res.text()).filter((i) => i.date && !i.categories.some((c) => f.exclude?.test(c)));
      return { feed: f, items, ok: true };
    } catch { return { feed: f, items: [] as RawItem[], ok: false }; }
  }));
  const seen = new Set<string>(); const items: NewsItem[] = [];
  for (const { feed, items: list } of results) for (const it of list) {
    const k = normalize(it.title).replace(/[^a-z0-9]/g, '').slice(0, 60);
    if (seen.has(k)) continue;
    seen.add(k);
    items.push({
      id: hash(it.link), title: it.title, summary: it.summary, date: it.date!, image: it.image?.replace(/^http:/, 'https:') ?? null,
      source: feed.name, sourceId: feed.id, link: it.link, categories: classify(it, feed.categories),
    });
  }
  items.sort((a, b) => b.date.localeCompare(a.date));
  const top = items.slice(0, 80);
  // Foto: si el feed no la trae, se toma la de la página original. Nunca una genérica.
  const missing = top.filter((i) => !i.image).slice(0, 24);
  for (let i = 0; i < missing.length; i += 6) await Promise.all(missing.slice(i, i + 6).map(async (n) => { n.image = await imageFromPage(n.link); }));
  return { items: top, sources: results.map((r) => ({ id: r.feed.id, name: r.feed.name, ok: r.ok, count: r.items.length })), fetchedAt: new Date().toISOString() };
}

export async function newsRoute(): Promise<Response> {
  let data = cache.get('all');
  if (!data) {
    const fresh = await collectNews();
    if (fresh.items.length) { cache.set('all', fresh); data = fresh; }
    else data = cache.get('all', true) ?? fresh;
  }
  if (!data.items.length) return json({ ...data, error: 'Ahora mismo no responde ninguna fuente de noticias.' }, { status: 502 });
  return json(data, { cache: cdn(900, 3600) });
}
