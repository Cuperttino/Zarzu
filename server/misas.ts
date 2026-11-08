// Horarios de misa de misas.org (Asociación Eucharistia), usados con su permiso.
// Su búsqueda devuelve, para una fecha, los templos cercanos con las misas de ese día,
// ya teniendo en cuenta domingos, vísperas y festivos.
import { cdn, fetchWithTimeout, HttpError, json, TtlCache } from './http.js';

export interface MisasChurch {
  id: number; name: string; address: string; town: string; lat: number; lon: number; photo: string | null;
  /** Misas por fecha (AAAA-MM-DD), en hora local: ["08:30", "19:30"]. */
  masses: Record<string, string[]>;
  url: string;
}
export interface MisasResult { churches: MisasChurch[]; dates: string[]; fetchedAt: string; source: 'misas.org' }

interface RawPar { id: number; name: string; uri: string; addr: string | null; loc: string | null; lat: string; long: string; pic: string | null; mass: { time: string }[] | null }
interface RawResult { count: number; pars: RawPar[] }

const BASE = 'https://misas.org';
const cache = new TtlCache<MisasResult>(3 * 3600_000, 300);

/** Fechas de hoy y mañana en España. */
export function madridDays(now = new Date()): string[] {
  const f = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return [f(now), f(new Date(now.getTime() + 86_400_000))];
}

async function searchDay(lat: number, lon: number, radius: number, day: string): Promise<RawPar[]> {
  const pos = `[${lon.toFixed(6)},${lat.toFixed(6)},${radius}]`;
  const out = new Map<number, RawPar>();
  for (let offset = 0, page = 0; page < 5; page++) {
    const u = `${BASE}/api/parishsearch?sortbypos=${pos}&country=es&date=${day.replaceAll('-', '/')}&masses=1&pos=${pos}${offset ? `&offset=${offset}` : ''}`;
    const res = await fetchWithTimeout(u, { timeoutMs: 12000, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`misas.org ${res.status}`);
    const data = await res.json() as RawResult;
    if (!Array.isArray(data.pars)) throw new Error('misas.org: respuesta inesperada');
    const before = out.size;
    for (const p of data.pars) out.set(p.id, p);
    offset += 20;
    if (offset >= (data.count ?? 0) || out.size === before) break;
  }
  return [...out.values()];
}

export function mergeDays(days: string[], perDay: RawPar[][]): MisasChurch[] {
  const map = new Map<number, MisasChurch>();
  perDay.forEach((pars, i) => {
    for (const p of pars) {
      const lat = Number(p.lat), lon = Number(p.long);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const c = map.get(p.id) ?? { id: p.id, name: p.name.trim(), address: (p.addr ?? '').trim(), town: (p.loc ?? '').trim(), lat, lon, photo: p.pic ? `${BASE}/images/${p.pic}` : null, masses: {}, url: `${BASE}/p/${encodeURIComponent(p.uri)}/${days[0]}` };
      const times = [...new Set((p.mass ?? []).map((m) => m.time).filter((t) => /^\d{2}:\d{2}$/.test(t)))].sort();
      if (times.length) c.masses[days[i]] = times;
      map.set(p.id, c);
    }
  });
  return [...map.values()];
}

export async function misasRoute(url: URL): Promise<Response> {
  const lat = Number(url.searchParams.get('lat')), lon = Number(url.searchParams.get('lon'));
  const radius = Math.min(15000, Math.max(500, Number(url.searchParams.get('radius')) || 3000));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new HttpError(400, 'Coordenadas no válidas.', 'bad_coords');
  const days = madridDays();
  const key = `${lat.toFixed(3)},${lon.toFixed(3)},${radius},${days[0]}`;
  let result = cache.get(key);
  if (!result) {
    try {
      const perDay = await Promise.all(days.map((d) => searchDay(lat, lon, radius, d)));
      result = { churches: mergeDays(days, perDay), dates: days, fetchedAt: new Date().toISOString(), source: 'misas.org' };
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
