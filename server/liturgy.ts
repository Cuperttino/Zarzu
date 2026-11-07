import { HttpError, TtlCache, cdn, fetchWithTimeout, htmlToText, json, assertDate } from './http';

export interface Reading { key: 'FR' | 'PS' | 'SR' | 'GSP'; label: string; reference: string; text: string; }
export interface Liturgy {
  date: string; title: string; readings: Reading[]; saints: string[];
  commentary: { title: string; author: string; source: string; text: string } | null;
  source: { name: string; url: string }; fetchedAt: string;
}

const BASE = 'https://feed.evangelizo.org/v2/reader.php';
const LABELS: Record<Reading['key'], string> = { FR: 'Primera lectura', PS: 'Salmo responsorial', SR: 'Segunda lectura', GSP: 'Evangelio' };
const cache = new TtlCache<Liturgy>(12 * 3600_000, 60);

async function part(date: string, type: string, content?: string): Promise<string> {
  const q = new URLSearchParams({ date: date.replaceAll('-', ''), type, lang: 'SP' });
  if (content) q.set('content', content);
  const res = await fetchWithTimeout(`${BASE}?${q}`, { timeoutMs: 9000 });
  if (!res.ok) throw new Error(`Evangelizo respondió ${res.status}`);
  return res.text();
}

/** Los nombres llegan como enlaces consecutivos, sin separador. */
export function parseSaints(html: string): string[] {
  const links = [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => htmlToText(m[1]));
  const list = links.length ? links : htmlToText(html).split(/\n|,/);
  return [...new Set(list.map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s.length > 2))];
}

export const cleanReference = (s: string) => htmlToText(s).replace(/\s+/g, ' ').replace(/\.$/, '').trim();

const looksLikeError = (s: string) => /wrong param|invalid date|no data|error/i.test(s.slice(0, 80));

export async function getLiturgy(date: string): Promise<Liturgy> {
  const hit = cache.get(date);
  if (hit) return hit;
  const keys: Reading['key'][] = ['FR', 'PS', 'SR', 'GSP'];
  const [title, saints, cT, cA, cS, cB, ...rs] = await Promise.all([
    part(date, 'liturgic_t'), part(date, 'saint').catch(() => ''),
    part(date, 'comment_t').catch(() => ''), part(date, 'comment_a').catch(() => ''),
    part(date, 'comment_s').catch(() => ''), part(date, 'comment').catch(() => ''),
    ...keys.flatMap((k) => [part(date, 'reading_lt', k).catch(() => ''), part(date, 'reading', k).catch(() => '')]),
  ]);
  const readings: Reading[] = [];
  keys.forEach((key, i) => {
    const reference = cleanReference(rs[i * 2]);
    const text = htmlToText(rs[i * 2 + 1]);
    if (text && !looksLikeError(text)) readings.push({ key, label: LABELS[key], reference, text });
  });
  if (!readings.some((r) => r.key === 'GSP')) throw new HttpError(502, 'La fuente litúrgica no ha devuelto el Evangelio de esa fecha.', 'liturgy_unavailable');
  const body = htmlToText(cB);
  const out: Liturgy = {
    date, title: htmlToText(title), readings, saints: parseSaints(saints),
    commentary: body && !looksLikeError(body) ? { title: htmlToText(cT), author: htmlToText(cA), source: htmlToText(cS), text: body } : null,
    source: { name: 'Evangelio del día (evangelizo.org)', url: 'https://evangeliodeldia.org/SP/gospel/' + date },
    fetchedAt: new Date().toISOString(),
  };
  cache.set(date, out);
  return out;
}

export async function liturgyRoute(url: URL): Promise<Response> {
  const date = assertDate(url.searchParams.get('date'));
  try {
    return json(await getLiturgy(date), { cache: cdn(6 * 3600, 24 * 3600) });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, 'No se ha podido consultar la fuente litúrgica. Vuelve a intentarlo en unos minutos.', 'liturgy_unavailable');
  }
}
