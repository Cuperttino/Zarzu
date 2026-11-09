// Horarios de misa de misas.org (Asociación Eucharistia), usados con su permiso.
// Su búsqueda devuelve, para una fecha, los templos cercanos con las misas de ese día,
// ya teniendo en cuenta domingos, vísperas y festivos.
import { cdn, fetchWithTimeout, HttpError, json, TtlCache } from './http.js';

export interface MisasChurch {
  id: number; name: string; address: string; town: string; lat: number; lon: number; photo: string | null;
  /** Misas por fecha (AAAA-MM-DD), en hora local: ["08:30", "19:30"]. */
  masses: Record<string, string[]>;
  /** Adoración del Santísimo por fecha. Las perpetuas duran todo el día. */
  adorations: Record<string, Adoration[]>;
  url: string;
}
export interface Adoration { type: 'normal' | 'prolongada' | 'perpetua'; begin: string; end: string; note: string }
export type MisasKind = 'masses' | 'adorations';
export interface MisasResult { kind: MisasKind; churches: MisasChurch[]; dates: string[]; fetchedAt: string; source: 'misas.org' }

interface RawAdor { begin: string; end: string; type: string; days: number[]; comments?: string }
export interface RawPar { id: number; name: string; uri: string; addr: string | null; loc: string | null; lat: string; long: string; pic: string | null; mass: { time: string }[] | null; ador?: RawAdor[] | null }
interface RawResult { count: number; offset: number; pars: RawPar[] }

const BASE = 'https://misas.org';
const cache = new TtlCache<MisasResult>(3 * 3600_000, 300);

/** Fechas de hoy y mañana en España. */
export function madridDays(now = new Date()): string[] {
  const f = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return [f(now), f(new Date(now.getTime() + 86_400_000))];
}

async function searchDay(lat: number, lon: number, radius: number, day: string, kind: MisasKind): Promise<RawPar[]> {
  const pos = `[${lon.toFixed(6)},${lat.toFixed(6)},${radius}]`;
  const out = new Map<number, RawPar>();
  // misas.org recorre los templos de 20 en 20 y devuelve en «offset» dónde seguir (0 al terminar).
  for (let offset = 0, page = 0; page < 12; page++) {
    const u = `${BASE}/api/parishsearch?sortbypos=${pos}&country=es&date=${day.replaceAll('-', '/')}&${kind}=1&pos=${pos}${offset ? `&offset=${offset}` : ''}`;
    const res = await fetchWithTimeout(u, { timeoutMs: 12000, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`misas.org ${res.status}`);
    const data = await res.json() as RawResult;
    if (!Array.isArray(data.pars)) throw new Error('misas.org: respuesta inesperada');
    for (const p of data.pars) out.set(p.id, p);
    const next = Number(data.offset) || 0;
    if (!next || next <= offset || next >= (data.count ?? 0)) break;
    offset = next;
  }
  return [...out.values()];
}

const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = domingo, como misas.org
const ADOR_TYPE: Record<string, Adoration['type']> = { normal: 'normal', prolongada: 'prolongada', perpetua: 'perpetua' };
export function adorationsFor(raw: RawAdor[] | null | undefined, day: string): Adoration[] {
  const wd = weekday(day);
  return (raw ?? []).filter((a) => Array.isArray(a.days) && a.days.includes(wd) && /^\d{2}:\d{2}$/.test(a.begin) && /^\d{2}:\d{2}$/.test(a.end))
    .map((a) => ({ type: ADOR_TYPE[(a.type ?? '').toLowerCase()] ?? 'normal', begin: a.begin, end: a.end, note: (a.comments ?? '').trim() }))
    .sort((x, y) => x.begin.localeCompare(y.begin));
}

export function mergeDays(days: string[], perDay: RawPar[][]): MisasChurch[] {
  const map = new Map<number, MisasChurch>();
  perDay.forEach((pars, i) => {
    for (const p of pars) {
      const lat = Number(p.lat), lon = Number(p.long);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const c = map.get(p.id) ?? { id: p.id, name: p.name.trim(), address: (p.addr ?? '').trim(), town: (p.loc ?? '').trim(), lat, lon, photo: p.pic ? `${BASE}/images/${p.pic}` : null, masses: {}, adorations: {}, url: `${BASE}/p/${encodeURIComponent(p.uri)}/${days[0]}` };
      const times = [...new Set((p.mass ?? []).map((m) => m.time).filter((t) => /^\d{2}:\d{2}$/.test(t)))].sort();
      if (times.length) c.masses[days[i]] = times;
      const ador = adorationsFor(p.ador, days[i]);
      if (ador.length) c.adorations[days[i]] = ador;
      map.set(p.id, c);
    }
  });
  return [...map.values()];
}

export async function misasRoute(url: URL): Promise<Response> {
  const lat = Number(url.searchParams.get('lat')), lon = Number(url.searchParams.get('lon'));
  const kind: MisasKind = url.searchParams.get('kind') === 'adorations' ? 'adorations' : 'masses';
  const radius = Math.min(kind === 'adorations' ? 30000 : 15000, Math.max(500, Number(url.searchParams.get('radius')) || 3000));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new HttpError(400, 'Coordenadas no válidas.', 'bad_coords');
  // Con ?date=AAAA-MM-DD se consulta solo ese día (hasta 60 días antes o después de hoy).
  const asked = url.searchParams.get('date');
  let days = madridDays();
  if (asked) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asked) || Number.isNaN(Date.parse(`${asked}T12:00:00Z`))) throw new HttpError(400, 'Fecha no válida.', 'bad_date');
    const diff = (Date.parse(`${asked}T12:00:00Z`) - Date.parse(`${days[0]}T12:00:00Z`)) / 86_400_000;
    if (Math.abs(diff) > 60) throw new HttpError(400, 'Solo se pueden consultar fechas de los próximos dos meses.', 'date_range');
    days = [asked];
  }
  const key = `${kind},${lat.toFixed(3)},${lon.toFixed(3)},${radius},${days.join('+')}`;
  let result = cache.get(key);
  if (!result) {
    try {
      const perDay = await Promise.all(days.map((d) => searchDay(lat, lon, radius, d, kind)));
      result = { kind, churches: mergeDays(days, perDay), dates: days, fetchedAt: new Date().toISOString(), source: 'misas.org' };
      cache.set(key, result);
    } catch (e) {
      const stale = cache.get(key, true);
      if (stale) return json(stale, { cache: cdn(600) });
      console.warn('misas.org', (e as Error).message);
      throw new HttpError(502, 'No se han podido consultar los horarios de misas.org ahora mismo.', 'misas_unavailable');
    }
  }
  return json(result, { cache: cdn(1800) });
}
