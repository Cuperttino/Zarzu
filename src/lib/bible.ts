/** Biblia Torres Amat incluida con la app: se descarga por libros y queda disponible sin conexión. */
export interface BookMeta { code: string; name: string; abbr: string; testament: 'AT' | 'NT'; group: string; chapters: number; verses: Record<string, number>; partial?: number[] }
export interface BookText { code: string; name: string; abbr: string; chapters: Record<string, Record<string, string>>; partial?: number[] }
export interface SearchHit { book: BookMeta; c: number; v: number; text: string; score: number }

const BASE = () => (typeof __PREVIEW__ !== 'undefined' && __PREVIEW__ ? '' : '/');
let index: Promise<{ edition: string; books: BookMeta[]; totalVerses: number }> | null = null;
const cache = new Map<string, Promise<BookText>>();

export const loadIndex = (): Promise<{ edition: string; books: BookMeta[]; totalVerses: number }> => (index ??= fetch(`${BASE()}data/books.json`).then((r) => { if (!r.ok) throw new Error('índice'); return r.json(); }).catch((e) => { index = null; throw e; }));
export const loadBook = (code: string): Promise<BookText> => {
  let p = cache.get(code);
  if (!p) { p = fetch(`${BASE()}bible/${code}.json`).then((r) => { if (!r.ok) throw new Error('libro'); return r.json(); }); p.catch(() => cache.delete(code)); cache.set(code, p); }
  return p;
};

export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Alias habituales en español, además de los nombres y abreviaturas del índice. */
const ALIASES: Record<string, string> = { gn: 'GEN', ex: 'EXO', lv: 'LEV', nm: 'NUM', dt: 'DEU', jos: 'JOS', jue: 'JDG', rt: 'RUT', '1s': '1SA', '1sam': '1SA', '2s': '2SA', '2sam': '2SA', '1r': '1KI', '1re': '1KI', '2r': '2KI', '2re': '2KI', '1cr': '1CH', '1cro': '1CH', '2cr': '2CH', '2cro': '2CH', esd: 'EZR', ne: 'NEH', tb: 'TOB', jdt: 'JDT', est: 'EST', '1m': '1MA', '1mac': '1MA', '2m': '2MA', '2mac': '2MA', jb: 'JOB', sal: 'PSA', salmo: 'PSA', salmos: 'PSA', pr: 'PRO', prov: 'PRO', qo: 'ECC', ecl: 'ECC', cant: 'SNG', ct: 'SNG', sb: 'WIS', sab: 'WIS', si: 'SIR', eclo: 'SIR', is: 'ISA', jr: 'JER', jer: 'JER', lm: 'LAM', ba: 'BAR', bar: 'BAR', ez: 'EZK', dn: 'DAN', os: 'HOS', jl: 'JOL', am: 'AMO', ab: 'OBA', abd: 'OBA', jon: 'JON', mi: 'MIC', miq: 'MIC', na: 'NAM', ha: 'HAB', sof: 'ZEP', ag: 'HAG', za: 'ZEC', zac: 'ZEC', ml: 'MAL', mal: 'MAL', mt: 'MAT', mc: 'MRK', lc: 'LUK', jn: 'JHN', hch: 'ACT', rm: 'ROM', rom: 'ROM', '1co': '1CO', '1cor': '1CO', '2co': '2CO', '2cor': '2CO', ga: 'GAL', gal: 'GAL', ef: 'EPH', flp: 'PHP', fil: 'PHP', col: 'COL', '1ts': '1TH', '1tes': '1TH', '2ts': '2TH', '2tes': '2TH', '1tm': '1TI', '1tim': '1TI', '2tm': '2TI', '2tim': '2TI', tt: 'TIT', tit: 'TIT', flm: 'PHM', hb: 'HEB', heb: 'HEB', st: 'JAS', sant: 'JAS', '1p': '1PE', '1pe': '1PE', '2p': '2PE', '2pe': '2PE', '1jn': '1JN', '2jn': '2JN', '3jn': '3JN', jds: 'JUD', ap: 'REV' };

export function resolveBook(raw: string, books: BookMeta[]): BookMeta | undefined {
  const k = fold(raw).replace(/[\s.]/g, '');
  if (!k) return undefined;
  const code = ALIASES[k];
  return (code && books.find((b) => b.code === code))
    || books.find((b) => fold(b.abbr).replace(/\s/g, '') === k)
    || books.find((b) => { const n = fold(b.name).replace(/\s/g, ''); return n === k; })
    || (k.length >= 3 ? books.find((b) => fold(b.name).replace(/\s/g, '').startsWith(k)) : undefined);
}

/** Reconoce "Jn 3,16", "1 Cor 13", "Salmo 22:1" o "Juan 3". */
export function parseReference(q: string, books: BookMeta[]) {
  const m = q.trim().match(/^([1-3]?\s*[\p{L}.\s]+?)\s*(\d+)(?:\s*[,:.]\s*(\d+))?$/u);
  if (!m) { const b = resolveBook(q, books); return b ? { book: b, c: 1, v: undefined as number | undefined, onlyBook: true } : null; }
  const book = resolveBook(m[1], books);
  if (!book) return null;
  const c = +m[2];
  if (c < 1 || c > book.chapters) return null;
  const v = m[3] ? +m[3] : undefined;
  return { book, c, v: v && book.verses[String(c)] >= v ? v : undefined, onlyBook: false };
}

/** Búsqueda en todo el texto. Filtros: testamento o libro. Frase exacta entre comillas o todas las palabras. */
export async function searchBible(q: string, opts: { testament?: 'AT' | 'NT'; book?: string; limit?: number; onProgress?: (p: number) => void } = {}): Promise<{ hits: SearchHit[]; total: number }> {
  const { books } = await loadIndex();
  const exact = q.match(/^"(.+)"$/)?.[1];
  const terms = exact ? [fold(exact)] : fold(q).split(/\s+/).filter((t) => t.length > 1);
  if (!terms.length) return { hits: [], total: 0 };
  const list = books.filter((b) => (!opts.testament || b.testament === opts.testament) && (!opts.book || b.code === opts.book));
  const hits: SearchHit[] = []; let total = 0, done = 0;
  // De 8 en 8 para que la pantalla siga respondiendo.
  for (let i = 0; i < list.length; i += 8) {
    const batch = await Promise.all(list.slice(i, i + 8).map((b) => loadBook(b.code).then((t) => [b, t] as const)));
    for (const [b, t] of batch) for (const [c, vs] of Object.entries(t.chapters)) for (const [v, text] of Object.entries(vs)) {
      const f = fold(text);
      if (!terms.every((x) => f.includes(x))) continue;
      total++;
      const score = terms.reduce((s, x) => s + (new RegExp(`\\b${x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(f) ? 2 : 1), 0) + (f.includes(terms.join(' ')) ? 3 : 0) + (b.testament === 'NT' ? 0.3 : 0);
      hits.push({ book: b, c: +c, v: +v, text, score });
    }
    done += batch.length; opts.onProgress?.(done / list.length);
    await new Promise((r) => setTimeout(r));
  }
  hits.sort((a, b) => b.score - a.score);
  return { hits: hits.slice(0, opts.limit ?? 100), total };
}

/** Descarga todos los libros a la caché del service worker. */
export async function downloadAll(onProgress: (done: number, total: number) => void) {
  const { books } = await loadIndex();
  let done = 0;
  for (let i = 0; i < books.length; i += 6) {
    await Promise.all(books.slice(i, i + 6).map((b) => loadBook(b.code).then(() => onProgress(++done, books.length))));
  }
}
