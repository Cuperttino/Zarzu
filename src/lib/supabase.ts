/** Cliente mínimo de Supabase sobre su API REST pública (GoTrue y PostgREST), sin dependencias. */
export interface Session { access_token: string; refresh_token: string; expires_at: number; user: { id: string; email: string } }
export interface RuntimeConfig { supabaseUrl: string | null; supabaseAnonKey: string | null; pushPublicKey: string | null; tileUrl: string }

const DEFAULT_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
let cfg: RuntimeConfig = { supabaseUrl: null, supabaseAnonKey: null, pushPublicKey: null, tileUrl: DEFAULT_TILES };
let loaded = false;
export const config = () => cfg;
export const configLoaded = () => loaded;
export async function loadConfig(): Promise<RuntimeConfig> {
  if (typeof __PREVIEW__ !== 'undefined' && __PREVIEW__) { loaded = true; return cfg; }
  try {
    const r = await fetch('/api/config');
    if (r.ok) { cfg = await r.json(); try { localStorage.setItem('zarzu.cfg', JSON.stringify(cfg)); } catch {} }
    else throw new Error();
  } catch { try { const c = localStorage.getItem('zarzu.cfg'); if (c) cfg = JSON.parse(c); } catch {} }
  loaded = true;
  return cfg;
}
export const authAvailable = () => !!(cfg.supabaseUrl && cfg.supabaseAnonKey);

const KEY = 'zarzu.session';
let session: Session | null = null;
try { session = JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch {}
const listeners = new Set<() => void>();
export const onAuth = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const getSession = () => session;
function setSession(s: Session | null) {
  session = s;
  try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch {}
  listeners.forEach((f) => f());
}

export class AuthError extends Error {}
const MESSAGES: [RegExp, string][] = [
  [/invalid login|invalid_credentials/i, 'El correo o la contraseña no son correctos.'], [/already registered|already exists|user_already/i, 'Ya existe una cuenta con ese correo. Inicia sesión.'],
  [/not confirmed/i, 'Confirma tu correo con el enlace que te hemos enviado.'], [/at least|weak|password should/i, 'La contraseña debe tener al menos 8 caracteres.'],
  [/rate limit|too many|security purposes/i, 'Demasiados intentos. Espera un minuto y vuelve a probar.'], [/invalid.*email|unable to validate email|email_address_invalid/i, 'Revisa el correo: no parece válido.'],
];
const friendly = (m: string) => MESSAGES.find(([r]) => r.test(m))?.[1] ?? 'No se ha podido completar. Vuelve a intentarlo.';

async function auth(path: string, body: unknown, method = 'POST', token?: string) {
  const r = await fetch(`${cfg.supabaseUrl}/auth/v1/${path}`, { method, headers: { apikey: cfg.supabaseAnonKey!, 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new AuthError(friendly(`${j.error_code ?? ''} ${j.msg ?? j.error_description ?? j.message ?? j.error ?? ''}`));
  return j;
}
const toSession = (j: { access_token: string; refresh_token: string; expires_in: number; user: { id: string; email: string } }): Session => ({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + j.expires_in * 1000, user: { id: j.user.id, email: j.user.email } });

export async function signUp(email: string, password: string, name: string): Promise<'confirm' | 'ok'> {
  const j = await auth('signup', { email, password, data: { display_name: name } });
  if (j.access_token) { setSession(toSession(j)); return 'ok'; }
  return 'confirm';
}
export async function signIn(email: string, password: string) { setSession(toSession(await auth('token?grant_type=password', { email, password }))); }
export async function recover(email: string) { await auth(`recover?redirect_to=${encodeURIComponent(location.origin + '/perfil')}`, { email }); }
export async function updatePassword(password: string) { const t = await token(); await auth('user', { password }, 'PUT', t!); }
export async function signOut() { const s = session; setSession(null); if (s) await auth('logout', {}, 'POST', s.access_token).catch(() => {}); }
export async function deleteLocalSession() { setSession(null); }

/** Recoge el enlace de recuperación o confirmación (#access_token=…). Devuelve el tipo de enlace. */
export async function consumeAuthRedirect(): Promise<string | null> {
  if (!location.hash.includes('access_token=')) return null;
  const p = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname);
  const access = p.get('access_token')!, refresh = p.get('refresh_token') ?? '';
  const u = await auth('user', null, 'GET', access);
  setSession({ access_token: access, refresh_token: refresh, expires_at: Date.now() + Number(p.get('expires_in') ?? 3600) * 1000, user: { id: u.id, email: u.email } });
  return p.get('type');
}

let refreshing: Promise<void> | null = null;
export async function token(): Promise<string | null> {
  if (!session) return null;
  if (session.expires_at - Date.now() > 60_000) return session.access_token;
  refreshing ??= auth('token?grant_type=refresh_token', { refresh_token: session.refresh_token })
    .then((j) => setSession(toSession(j)))
    .catch((e) => { if (e instanceof AuthError) setSession(null); })
    .finally(() => { refreshing = null; });
  await refreshing;
  return session?.access_token ?? null;
}

/** Petición a PostgREST con la sesión del usuario (las políticas RLS hacen el resto). */
export async function rest<T = unknown>(path: string, init: { method?: string; body?: unknown; prefer?: string } = {}): Promise<T> {
  const t = await token();
  const r = await fetch(`${cfg.supabaseUrl}/rest/v1/${path}`, {
    method: init.method ?? 'GET',
    headers: { apikey: cfg.supabaseAnonKey!, authorization: `Bearer ${t ?? cfg.supabaseAnonKey}`, 'content-type': 'application/json', ...(init.prefer ? { prefer: init.prefer } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const text = await r.text();
  return (text ? JSON.parse(text) : null) as T;
}
