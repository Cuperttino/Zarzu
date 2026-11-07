import { HttpError, TtlCache, cdn, env, fetchWithTimeout, json, contactUrl, normalize } from './http.js';

export type PlaceKind = 'catedral' | 'basilica' | 'santuario' | 'monasterio' | 'convento' | 'parroquia' | 'ermita' | 'iglesia';
export interface ScheduleInfo { status: 'verified' | 'community' | 'unavailable'; text: string | null; sourceUrl: string | null; sourceName: string | null; checkedOn: string | null; }
export interface Place {
  id: string; name: string; kind: PlaceKind; lat: number; lon: number; address: string | null; phone: string | null; website: string | null;
  photo: string | null; openingHours: string | null; mass: ScheduleInfo; confession: ScheduleInfo; opening: ScheduleInfo; osmUrl: string;
}

const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.openstreetmap.fr/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];

export function classifyPlace(tags: Record<string, string>): PlaceKind {
  const n = normalize(`${tags.name ?? ''} ${tags.alt_name ?? ''}`);
  if (tags.building === 'cathedral' || /\b(catedral|concatedral)\b/.test(n)) return 'catedral';
  if (/\bbasilica\b/.test(n)) return 'basilica';
  if (/\b(santuario|sanctuary)\b/.test(n)) return 'santuario';
  if (tags.amenity === 'monastery' && /\b(convento|carmelo|clarisas)\b/.test(n)) return 'convento';
  if (/\b(convento|carmelo|clarisas)\b/.test(n)) return 'convento';
  if (tags.amenity === 'monastery' || tags.historic === 'monastery' || /\b(monasterio|abadia|cartuja)\b/.test(n)) return 'monasterio';
  if (/\b(parroquia|parroquial)\b/.test(n) || tags.parish) return 'parroquia';
  if (tags.building === 'chapel' || /\b(ermita|capilla)\b/.test(n)) return 'ermita';
  return 'iglesia';
}

export function photoFromTags(t: Record<string, string>): string | null {
  const commons = t.wikimedia_commons;
  if (commons?.startsWith('File:')) return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(commons.slice(5))}?width=900`;
  const img = t.image;
  if (img?.startsWith('File:')) return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(img.slice(5))}?width=900`;
  if (img && /^https:\/\/.+\.(jpe?g|png|webp)(\?|$)/i.test(img)) return img;
  return null;
}

const none: ScheduleInfo = { status: 'unavailable', text: null, sourceUrl: null, sourceName: null, checkedOn: null };
const normUrl = (u?: string) => (u ? (/^https?:\/\//.test(u) ? u : `https://${u}`) : null);

export function toPlace(el: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }): Place | null {
  const t = el.tags ?? {};
  if (!t.name) return null;
  const denom = t.denomination;
  if (denom && !/^(catholic|roman_catholic)$/.test(denom)) return null;
  if (t.religion && t.religion !== 'christian') return null;
  if (/\b(evangelica|protestante|bautista|ortodoxa|anglicana|adventista|testigos de jehova|mormona?)\b/.test(normalize(t.name))) return null;
  const lat = el.lat ?? el.center?.lat; const lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) return null;
  const street = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(', ');
  const addr = [street, [t['addr:postcode'], t['addr:city']].filter(Boolean).join(' ')].filter(Boolean).join('. ');
  const osmUrl = `https://www.openstreetmap.org/${el.type}/${el.id}`;
  const checked = t['check_date:service_times'] ?? t['check_date'] ?? null;
  return {
    id: `${el.type}/${el.id}`, name: t.name, kind: classifyPlace(t), lat, lon, address: addr || null,
    phone: t['contact:phone'] ?? t.phone ?? null, website: normUrl(t['contact:website'] ?? t.website ?? t.url),
    photo: photoFromTags(t), openingHours: t.opening_hours ?? null, osmUrl,
    mass: t.service_times ? { status: 'community', text: t.service_times, sourceUrl: osmUrl, sourceName: 'OpenStreetMap', checkedOn: checked } : none,
    confession: none,
    opening: t.opening_hours ? { status: 'community', text: t.opening_hours, sourceUrl: osmUrl, sourceName: 'OpenStreetMap', checkedOn: t['check_date:opening_hours'] ?? checked } : none,
  };
}

interface VerifiedRow { osm_ref: string; kind: 'mass' | 'confession' | 'opening'; schedule: string; source_url: string; source_name: string | null; checked_on: string; }

async function verified(ids: string[]): Promise<VerifiedRow[]> {
  const url = env('SUPABASE_URL'); const key = env('SUPABASE_ANON_KEY');
  if (!url || !key || !ids.length) return [];
  try {
    const list = ids.map((i) => `"${i}"`).join(',');
    const res = await fetchWithTimeout(`${url}/rest/v1/verified_schedules?select=osm_ref,kind,schedule,source_url,source_name,checked_on&osm_ref=in.(${encodeURIComponent(list)})`, { headers: { apikey: key, authorization: `Bearer ${key}` }, timeoutMs: 4000 });
    return res.ok ? await res.json() as VerifiedRow[] : [];
  } catch { return []; }
}

export function applyVerified(places: Place[], rows: VerifiedRow[]): Place[] {
  const by = new Map(places.map((p) => [p.id, p]));
  for (const r of rows) {
    const p = by.get(r.osm_ref);
    if (!p || !/^https?:\/\//.test(r.source_url)) continue;
    p[r.kind] = { status: 'verified', text: r.schedule, sourceUrl: r.source_url, sourceName: r.source_name, checkedOn: r.checked_on };
  }
  return places;
}

export function overpassQuery(lat: number, lon: number, radius: number): string {
  const a = `(around:${radius},${lat},${lon})`;
  return `[out:json][timeout:20];(nwr["amenity"="place_of_worship"]["religion"="christian"]${a};nwr["amenity"="monastery"]${a};nwr["building"="cathedral"]${a};nwr["historic"="monastery"]${a};);out center tags 400;`;
}

const placeCache = new TtlCache<Place[]>(6 * 3600_000, 300);

export async function placesRoute(url: URL): Promise<Response> {
  const lat = Number(url.searchParams.get('lat')); const lon = Number(url.searchParams.get('lon'));
  const radius = Math.min(30000, Math.max(500, Number(url.searchParams.get('radius')) || 5000));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new HttpError(400, 'Coordenadas no válidas.', 'bad_coords');
  const key = `${lat.toFixed(3)},${lon.toFixed(3)},${radius}`;
  let places = placeCache.get(key);
  if (!places) {
    const body = new URLSearchParams({ data: overpassQuery(+lat.toFixed(4), +lon.toFixed(4), radius) }).toString();
    // Se consulta a todos los servidores a la vez y se usa la primera respuesta válida.
    const errors: string[] = [];
    const ask = async (m: string) => {
      try {
        const res = await fetchWithTimeout(m, { method: 'POST', body, timeoutMs: 25000, headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' } });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json() as { elements?: Parameters<typeof toPlace>[0][] };
        if (!Array.isArray(data.elements)) throw new Error('respuesta sin datos');
        return data.elements.map(toPlace).filter((p): p is Place => !!p);
      } catch (e) { errors.push(`${new URL(m).host}: ${(e as Error).message}`); throw e; }
    };
    try { places = await Promise.any(MIRRORS.map(ask)); }
    catch { throw new HttpError(502, 'El servicio de mapas no responde ahora mismo. Vuelve a intentarlo en un momento.', 'overpass_unavailable'); }
    finally { if (errors.length) console.warn('overpass', errors.join(' | ')); }
    placeCache.set(key, places);
  }
  const copy = structuredClone(places);
  applyVerified(copy, await verified(copy.map((p) => p.id)));
  return json({ places: copy, attribution: '© OpenStreetMap contributors (ODbL)', fetchedAt: new Date().toISOString() }, { cache: cdn(3600, 6 * 3600) });
}

let lastNominatim = 0;
const geoCache = new TtlCache<unknown>(7 * 24 * 3600_000, 500);
export async function geocodeRoute(url: URL): Promise<Response> {
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 120);
  if (q.length < 2) throw new HttpError(400, 'Escribe una localidad o un código postal.', 'bad_query');
  const hit = geoCache.get(q.toLowerCase());
  if (hit) return json(hit, { cache: cdn(86400) });
  // Norma de uso de Nominatim: como máximo una petición por segundo.
  const wait = lastNominatim + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatim = Date.now();
  const params = new URLSearchParams({ format: 'jsonv2', limit: '5', addressdetails: '1', 'accept-language': 'es', q, email: '' });
  params.delete('email');
  try {
    const res = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { referer: contactUrl() }, timeoutMs: 8000 });
    if (!res.ok) throw new Error(String(res.status));
    const raw = await res.json() as { display_name: string; lat: string; lon: string; type: string }[];
    const out = { results: raw.map((r) => ({ name: r.display_name, lat: +r.lat, lon: +r.lon })), attribution: 'Datos de Nominatim / © OpenStreetMap' };
    geoCache.set(q.toLowerCase(), out);
    return json(out, { cache: cdn(86400) });
  } catch { throw new HttpError(502, 'El buscador de localidades no responde. Vuelve a intentarlo en un momento.', 'nominatim_unavailable'); }
}
