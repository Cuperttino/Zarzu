import { misasRoute } from './misas.js';
import { HttpError, cdn, env, json, fetchWithTimeout } from './http.js';
import { liturgyRoute } from './liturgy.js';
import { newsRoute, FEEDS } from './news.js';
import { geocodeRoute, placesRoute } from './places.js';
import { cronRoute } from './push.js';

function configRoute(): Response {
  return json({
    supabaseUrl: env('SUPABASE_URL') || null,
    supabaseAnonKey: env('SUPABASE_ANON_KEY') || null,
    pushPublicKey: env('VAPID_PUBLIC_KEY') || null,
    tileUrl: env('MAP_TILE_URL', 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'),
  }, { cache: 'public, max-age=300' });
}

async function probe(url: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number | string }> {
  try { const r = await fetchWithTimeout(url, { ...init, timeoutMs: 8000 }); return { ok: r.ok, status: r.status }; }
  catch (e) { return { ok: false, status: (e as Error).name }; }
}

/** Estado de cada servicio, sin exponer ningún secreto. */
async function healthRoute(url: URL): Promise<Response> {
  const configured = {
    supabase: !!env('SUPABASE_URL') && !!env('SUPABASE_ANON_KEY'),
    serviceRole: !!env('SUPABASE_SERVICE_ROLE_KEY'),
    push: !!env('VAPID_PUBLIC_KEY') && !!env('VAPID_PRIVATE_KEY'), cron: !!env('CRON_SECRET'),
  };
  if (url.searchParams.get('live') !== '1') return json({ configured });
  const d = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const [liturgy, nominatim, overpass, ...feeds] = await Promise.all([
    probe(`https://feed.evangelizo.org/v2/reader.php?date=${d}&type=liturgic_t&lang=SP`),
    probe('https://nominatim.openstreetmap.org/status?format=json'),
    probe('https://overpass-api.de/api/status'),
    ...FEEDS.map((f) => probe(f.url)),
  ]);
  return json({ configured, live: { liturgy, nominatim, overpass, feeds: Object.fromEntries(FEEDS.map((f, i) => [f.id, feeds[i]])) } }, { cache: cdn(120, 300) });
}

export async function route(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');
  const m = req.method;
  try {
    if (m === 'GET') switch (path) {
      case '/api/config': return configRoute();
      case '/api/health': return await healthRoute(url);
      case '/api/liturgy': return await liturgyRoute(url);
      case '/api/news': return await newsRoute();
      case '/api/places': return await placesRoute(url);
      case '/api/misas': return await misasRoute(url);
      case '/api/geocode': return await geocodeRoute(url);
      case '/api/cron/reminders': return await cronRoute(req);
    }
    if (m === 'POST') switch (path) {
      case '/api/cron/reminders': return await cronRoute(req);
    }
    return json({ error: 'Ruta no encontrada.', code: 'not_found' }, { status: 404 });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, code: e.code }, { status: e.status });
    console.error(e);
    return json({ error: 'Error interno.', code: 'internal' }, { status: 500 });
  }
}
