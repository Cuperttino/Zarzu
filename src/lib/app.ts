/** Enrutado, peticiones a la API con respaldo, recordatorios, compartir imagen y utilidades. */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { config } from './supabase.ts';
import { getState, saveProfile } from './store.ts';
import { token, getSession } from './supabase.ts';
import { litDay } from './calendar.ts';
import { today } from './dates.ts';

// ---------- rutas ----------
const PREVIEW = typeof __PREVIEW__ !== 'undefined' && __PREVIEW__;
let memPath = '/';
const memStack: string[] = [];
let depth = 0;
const subs = new Set<() => void>();
const current = () => (PREVIEW ? memPath : location.pathname + location.search);
export function navigate(to: string, replace = false) {
  if (PREVIEW) { if (!replace) memStack.push(memPath); memPath = to; }
  else if (replace) history.replaceState(null, '', to); else { history.pushState(null, '', to); depth++; }
  scrollTo(0, 0);
  subs.forEach((f) => f());
}
if (!PREVIEW) addEventListener('popstate', () => { depth = Math.max(0, depth - 1); subs.forEach((f) => f()); });
export const usePath = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, current);
export function goBack(fallback: string) {
  if (PREVIEW) { memPath = memStack.pop() ?? fallback; subs.forEach((f) => f()); return; }
  if (depth > 0) history.back(); else navigate(fallback, true);
}

// ---------- API con copia de respaldo ----------
export interface Loaded<T> { data: T | null; error: string | null; loading: boolean; stale: boolean; savedAt: number | null; reload: () => void }
export class ApiError extends Error { constructor(msg: string, public code: string, public status: number) { super(msg); } }

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  if (PREVIEW) throw new ApiError('Esta función necesita el servidor de la app publicada.', 'preview', 0);
  let r: Response;
  try { r = await fetch(path, init); } catch { throw new ApiError('Sin conexión.', 'offline', 0); }
  const isJson = (r.headers.get('content-type') ?? '').includes('json');
  if (!isJson) throw new ApiError('El servidor no ha respondido correctamente.', 'bad_response', r.status);
  const j = await r.json();
  if (!r.ok) throw new ApiError(j.error ?? 'No se ha podido completar.', j.code ?? 'error', r.status);
  return j as T;
}
/** Carga con respaldo en el dispositivo: si falla la red, muestra la última copia indicando su antigüedad. */
export function useCached<T>(key: string | null, path: string | null): Loaded<T> {
  const read = () => { if (!key) return null; try { return JSON.parse(localStorage.getItem(`zarzu.c.${key}`) ?? 'null') as { at: number; v: T } | null; } catch { return null; } };
  const [nonce, setNonce] = useState(0);
  const [st, setSt] = useState<{ data: T | null; error: string | null; loading: boolean; stale: boolean; savedAt: number | null }>(() => { const c = read(); return { data: c?.v ?? null, error: null, loading: true, stale: false, savedAt: c?.at ?? null }; });
  useEffect(() => {
    if (!path) { setSt((s) => ({ ...s, loading: false })); return; }
    let live = true;
    const c = read();
    setSt({ data: c?.v ?? null, error: null, loading: true, stale: false, savedAt: c?.at ?? null });
    api<T>(path).then((v) => {
      if (!live) return;
      try { localStorage.setItem(`zarzu.c.${key}`, JSON.stringify({ at: Date.now(), v })); } catch {}
      setSt({ data: v, error: null, loading: false, stale: false, savedAt: Date.now() });
    }).catch((e: Error) => { if (live) setSt((s) => ({ ...s, error: e.message, loading: false, stale: !!s.data })); });
    return () => { live = false; };
  }, [key, path, nonce]);
  return { ...st, reload: () => setNonce((n) => n + 1) };
}
export function usePromise<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [st, setSt] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  useEffect(() => {
    let live = true; setSt((s) => ({ ...s, loading: true, error: null }));
    fn().then((data) => live && setSt({ data, error: null, loading: false })).catch((e: Error) => live && setSt({ data: null, error: e.message, loading: false }));
    return () => { live = false; };
    // eslint-disable-next-line
  }, deps);
  return st;
}

// ---------- geografía ----------
export const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const R = 6371, r = Math.PI / 180, x = (b.lat - a.lat) * r, y = (b.lon - a.lon) * r;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(y / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
export const fmtKm = (d: number) => (d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(d < 10 ? 1 : 0).replace('.', ',')} km`);
export const directionsUrl = (lat: number, lon: number, name: string) => /iPhone|iPad|Mac/.test(navigator.userAgent)
  ? `https://maps.apple.com/?daddr=${lat},${lon}&q=${encodeURIComponent(name)}`
  : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;

// ---------- imagen para compartir ----------
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const lines: string[] = []; let line = '';
  for (const w of text.split(/\s+/)) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > max && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}
export async function shareImage(opts: { text: string; reference: string; kicker?: string; filename?: string }): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  await Promise.all([document.fonts.load('800 48px Bricolage'), document.fonts.load('400 30px Bricolage')]).catch(() => {});
  const accent = '#ffb81c'; const g = x.createLinearGradient(0, 0, W * .4, H); g.addColorStop(0, '#e9e0ff'); g.addColorStop(.6, '#f5f0ff'); g.addColorStop(1, '#fff3cc'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  // Llama arriba
  x.save(); x.translate(84 - 30, 70 - 20); x.scale(.28, .28); x.translate(-100 + 100, 0); x.fillStyle = accent; x.fill(new Path2D('M262 76c14 66 -30 92 -58 130 -12 -14 -18 -32 -18 -50 -40 36 -66 84 -66 138 0 86 62 142 136 142s136-58 136-142c0-92-72-150-130-218Z')); x.restore();
  x.textAlign = 'left';
  let size = 96, lines: string[] = [];
  for (; size >= 44; size -= 2) { x.font = `800 ${size}px Bricolage, Arial, sans-serif`; lines = wrap(x, opts.text, W - 170); if (lines.length * size * 1.08 < 780) break; }
  const lh = size * 1.08; let y = 250 + size;
  x.fillStyle = '#1e1640'; for (const l of lines) { x.fillText(l, 84, y); y += lh; }
  x.font = '800 44px Bricolage, Arial, sans-serif'; x.fillStyle = '#5b2ee0'; x.fillText(opts.reference, 84, Math.min(y + 30, H - 180));
  x.font = '800 56px Bricolage, Arial, sans-serif'; x.fillStyle = '#1e1640'; x.fillText('Zarzu', 84, H - 88);
  if (opts.kicker) { x.font = '400 30px Bricolage, Arial, sans-serif'; x.fillStyle = '#6d6690'; x.textAlign = 'right'; x.fillText(opts.kicker, W - 84, H - 92); }
  const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/png'));
  const file = new File([blob], opts.filename ?? 'zarzu.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text: `${opts.reference}` }); return 'shared'; } catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled'; }
  }
  if (PREVIEW) {
    const d = await (window as unknown as { claude?: { use(n: string): Promise<{ save(o: { filename: string; data: Blob }): Promise<unknown> } | null> } }).claude?.use('downloads');
    if (!d) throw new Error('sin descargas');
    await d.save({ filename: file.name, data: blob });
    return 'downloaded';
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return 'downloaded';
}

// ---------- recordatorios ----------
const b64ToBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(s.length + (4 - s.length % 4) % 4, '=')), (c) => c.charCodeAt(0));
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export async function enablePush(): Promise<string | null> {
  if (!pushSupported()) return /iPhone|iPad/.test(navigator.userAgent) ? 'En iPhone, primero añade Zarzu a la pantalla de inicio desde Safari.' : 'Este navegador no admite notificaciones.';
  if (!config().pushPublicKey) return 'Los recordatorios todavía no están configurados en este servidor.';
  if (!getSession()) return 'Inicia sesión para recibir recordatorios.';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'Has rechazado el permiso. Puedes cambiarlo en los ajustes del navegador.';
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(config().pushPublicKey!) });
  const k = sub.toJSON().keys!;
  const { rest } = await import('./supabase.ts');
  await rest('push_subscriptions', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: { endpoint: sub.endpoint, user_id: getSession()!.user.id, p256dh: k.p256dh, auth: k.auth } });
  saveProfile({ notifications: { ...getState().notifications, enabled: true } });
  return null;
}
export async function disablePush() {
  saveProfile({ notifications: { ...getState().notifications, enabled: false } });
  try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) { const { rest } = await import('./supabase.ts'); await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, { method: 'DELETE' }); await sub.unsubscribe(); } } catch {}
}
export const authHeader = async (): Promise<Record<string, string>> => { const t = await token(); return t ? { authorization: `Bearer ${t}` } : {}; };

// ---------- calendario .ics ----------
export function downloadIcs(name: string, events: { date: string; title: string; note?: string }[]) {
  const stamp = new Date().toISOString().replace(/[-:]|\.\d+/g, '');
  const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1');
  const body = events.map((e, i) => { const d = e.date.replaceAll('-', ''); const dt = new Date(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6) + 1); const n = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`; return `BEGIN:VEVENT\r\nUID:${d}-${i}@zarzu\r\nDTSTAMP:${stamp}\r\nDTSTART;VALUE=DATE:${d}\r\nDTEND;VALUE=DATE:${n}\r\nSUMMARY:${esc(e.title)}${e.note ? `\r\nDESCRIPTION:${esc(e.note)}` : ''}\r\nTRANSP:TRANSPARENT\r\nEND:VEVENT`; }).join('\r\n');
  const blob = new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Zarzu//ES\r\nCALSCALE:GREGORIAN\r\nX-WR-CALNAME:Calendario litúrgico\r\n${body}\r\nEND:VCALENDAR\r\n`], { type: 'text/calendar' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
