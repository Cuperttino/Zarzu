/**
 * Estado del usuario. Funciona sin cuenta guardándolo en el dispositivo; con cuenta se sincroniza con Supabase
 * (primero se escribe aquí, luego se sube; al volver la conexión se reintenta lo pendiente).
 */
import { useSyncExternalStore } from 'react';
import { authAvailable, getSession, onAuth, rest } from './supabase.ts';
import { today, type ISODate } from './dates.ts';
import { litDay } from './calendar.ts';
import { loadCatalog, pickVerse, type HistoryEntry, type Verse } from './verses.ts';

export interface Reminder { id: 'morning' | 'gospel' | 'evening'; time: string; enabled: boolean }
export interface Favorite { kind: 'verse' | 'prayer' | 'saint' | 'quote' | 'news' | 'place'; id: string; title: string; body?: string; link?: string; at: string }
export interface Activity { kind: 'reading' | 'gospel' | 'prayer' | 'rosary'; ref: string; label: string; day: ISODate }
export interface FavPlace { name: string; lat: number; lon: number }

export interface State {
  name: string; onboarded: boolean;
  settings: { theme: 'auto' | 'light' | 'dark'; readingScale: number };
  place: FavPlace | null;
  notifications: { enabled: boolean; reminders: Reminder[] };
  verses: HistoryEntry[]; favorites: Favorite[]; activity: Activity[];
  lastRead: { book: string; c: number } | null;
  rosary: Record<string, unknown> | null;
}
const initial: State = {
  name: '', onboarded: false, settings: { theme: 'light', readingScale: 1 }, place: null,
  notifications: { enabled: false, reminders: [{ id: 'morning', time: '08:00', enabled: true }, { id: 'gospel', time: '08:30', enabled: false }, { id: 'evening', time: '22:00', enabled: false }] },
  verses: [], favorites: [], activity: [], lastRead: null, rosary: null,
};
const KEY = 'zarzu.v2';
const load = (): State => { try { return { ...initial, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return initial; } };
let state = load();
const subs = new Set<() => void>();
function commit(next: Partial<State>) {
  state = { ...state, ...next };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  applyTheme(); subs.forEach((f) => f());
}
export const getState = () => state;
export const setState = commit;
export function useStore<T>(sel: (s: State) => T): T { return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => sel(state)); }

export function applyTheme() {
  const t = state.settings.theme;
  const host = document.documentElement.dataset.theme;
  const dark = t === 'dark' || (t === 'auto' && (host ? host === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches));
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.setProperty('--reading-scale', String(state.settings.readingScale));
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#120828' : '#fbf9ff');
}

// ---------- cola de operaciones pendientes con Supabase ----------
type Op = { path: string; method: string; body?: unknown; prefer?: string };
const QKEY = 'zarzu.queue';
const readQ = (): Op[] => { try { return JSON.parse(localStorage.getItem(QKEY) ?? '[]'); } catch { return []; } };
const writeQ = (q: Op[]) => { try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch {} };
const signed = () => authAvailable() && !!getSession();
let flushing = false;
export async function flush() {
  if (flushing || !signed() || !navigator.onLine) return;
  flushing = true;
  try {
    // Se relee la cola en cada vuelta: mientras se envía pueden llegar operaciones nuevas.
    for (let q = readQ(); q.length; q = readQ()) { await rest(q[0].path, { method: q[0].method, body: q[0].body, prefer: q[0].prefer }); writeQ(readQ().slice(1)); }
  } catch (e) { console.warn('Sincronización pendiente', e); } finally { flushing = false; }
}
function enqueue(op: Op) { if (!signed()) return; writeQ([...readQ(), op]); void flush(); }
const UPSERT = 'resolution=merge-duplicates,return=minimal';
const uid = () => getSession()!.user.id;

// ---------- acciones ----------
export function toggleFavorite(f: Omit<Favorite, 'at'>) {
  const exists = state.favorites.some((x) => x.kind === f.kind && x.id === f.id);
  if (exists) {
    commit({ favorites: state.favorites.filter((x) => !(x.kind === f.kind && x.id === f.id)) });
    enqueue({ path: `favorites?kind=eq.${f.kind}&item_id=eq.${encodeURIComponent(f.id)}`, method: 'DELETE' });
  } else {
    const fav = { ...f, at: new Date().toISOString() };
    commit({ favorites: [fav, ...state.favorites] });
    if (signed()) enqueue({ path: 'favorites', method: 'POST', prefer: UPSERT, body: { user_id: uid(), kind: f.kind, item_id: f.id, payload: { title: f.title, body: f.body, link: f.link } } });
  }
}
export function logActivity(a: Omit<Activity, 'day'>) {
  const day = today();
  if (state.activity.some((x) => x.kind === a.kind && x.ref === a.ref && x.day === day)) return;
  const entry = { ...a, ref: a.ref.slice(0, 120), label: a.label.slice(0, 160), day };
  commit({ activity: [entry, ...state.activity].slice(0, 3000) });
  if (signed()) enqueue({ path: 'activity_log', method: 'POST', prefer: 'resolution=ignore-duplicates,return=minimal', body: { user_id: uid(), kind: entry.kind, ref: entry.ref, label: entry.label, day } });
}
export function saveProfile(patch: Partial<Pick<State, 'name' | 'place' | 'settings' | 'notifications'>>) {
  commit(patch);
  if (signed()) enqueue({ path: 'profiles', method: 'POST', prefer: UPSERT, body: profileRow() });
}
const profileRow = () => ({ id: uid(), display_name: state.name.slice(0, 80), favorite_place: state.place, appearance: state.settings, notifications: state.notifications, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, updated_at: new Date().toISOString() });

// ---------- sincronización completa al entrar o al abrir la app ----------
export async function pull() {
  if (!signed()) return;
  await flush();
  const id = uid();
  const [profile, vh, favs, act] = await Promise.all([
    rest<{ display_name: string | null; favorite_place: FavPlace | null; appearance: Partial<State['settings']>; notifications: Partial<State['notifications']> }[]>(`profiles?id=eq.${id}&select=*`),
    rest<{ shown_on: string; verse_id: string }[]>('verse_history?select=shown_on,verse_id&order=shown_on.desc&limit=5000'),
    rest<{ kind: Favorite['kind']; item_id: string; payload: { title?: string; body?: string; link?: string }; created_at: string }[]>('favorites?select=*&order=created_at.desc&limit=2000'),
    rest<{ kind: Activity['kind']; ref: string; label: string | null; day: string }[]>('activity_log?select=kind,ref,label,day&order=day.desc&limit=3000'),
  ]);
  const p = profile[0];
  // Unión de lo local (por ejemplo, lo hecho antes de crear la cuenta) con lo remoto.
  const remoteDays = new Set(vh.map((h) => h.shown_on));
  const localOnly = state.verses.filter((h) => !remoteDays.has(h.day));
  if (localOnly.length) await rest('verse_history', { method: 'POST', prefer: 'resolution=ignore-duplicates,return=minimal', body: localOnly.map((h) => ({ user_id: id, shown_on: h.day, verse_id: h.id })) }).catch(() => {});
  const remoteFav = new Set(favs.map((f) => `${f.kind}:${f.item_id}`));
  const localFav = state.favorites.filter((f) => !remoteFav.has(`${f.kind}:${f.id}`));
  if (localFav.length) await rest('favorites', { method: 'POST', prefer: UPSERT, body: localFav.map((f) => ({ user_id: id, kind: f.kind, item_id: f.id, payload: { title: f.title, body: f.body, link: f.link } })) }).catch(() => {});
  const remoteAct = new Set(act.map((a) => `${a.kind}:${a.ref}:${a.day}`));
  const localAct = state.activity.filter((a) => !remoteAct.has(`${a.kind}:${a.ref}:${a.day}`));
  if (localAct.length) await rest('activity_log', { method: 'POST', prefer: 'resolution=ignore-duplicates,return=minimal', body: localAct.slice(0, 500).map((a) => ({ user_id: id, kind: a.kind, ref: a.ref, label: a.label, day: a.day })) }).catch(() => {});
  commit({
    name: p?.display_name || state.name,
    place: p?.favorite_place ?? state.place,
    settings: { ...state.settings, ...(p?.appearance ?? {}) },
    notifications: p?.notifications?.reminders ? (p.notifications as State['notifications']) : state.notifications,
    verses: [...vh.map((h) => ({ day: h.shown_on, id: h.verse_id })), ...localOnly].sort((a, b) => b.day.localeCompare(a.day)),
    favorites: [...favs.map((f) => ({ kind: f.kind, id: f.item_id, title: f.payload?.title ?? '', body: f.payload?.body, link: f.payload?.link, at: f.created_at })), ...localFav],
    activity: [...act.map((a) => ({ kind: a.kind, ref: a.ref, label: a.label ?? a.ref, day: a.day })), ...localAct],
  });
  if (!p) await rest('profiles', { method: 'POST', prefer: UPSERT, body: profileRow() }).catch(() => {});
}

// ---------- versículo diario ----------
let claiming: Promise<Verse> | null = null;
/** Devuelve el versículo del día. Lo elige una sola vez por usuario y día, también entre dispositivos. */
export function dailyVerse(day: ISODate = today()): Promise<Verse> { return (claiming ??= resolveVerse(day).finally(() => { claiming = null; })); }

async function resolveVerse(day: ISODate): Promise<Verse> {
  const catalog = await loadCatalog();
  const byId = new Map(catalog.map((v) => [v.id, v]));
  const local = state.verses.find((h) => h.day === day);
  if (signed() && navigator.onLine) {
    try {
      const rows = await rest<{ shown_on: string; verse_id: string }[]>('verse_history?select=shown_on,verse_id&order=shown_on.desc&limit=5000');
      const remote = rows.map((r) => ({ day: r.shown_on, id: r.verse_id }));
      const has = new Set(remote.map((h) => h.day));
      const merged = [...remote, ...state.verses.filter((h) => !has.has(h.day))].sort((a, b) => b.day.localeCompare(a.day));
      const existing = remote.find((h) => h.day === day);
      if (existing) { commit({ verses: merged }); return byId.get(existing.id) ?? catalog[0]; }
      const chosen = local ? byId.get(local.id)! : pickVerse(catalog, merged.filter((h) => h.day !== day), day, uid(), litDay(day).season);
      // La clave única (usuario, día) resuelve la carrera: si otro dispositivo se adelantó, se adopta el suyo.
      await rest('verse_history', { method: 'POST', prefer: 'resolution=ignore-duplicates,return=minimal', body: { user_id: uid(), shown_on: day, verse_id: chosen.id } });
      const final = await rest<{ verse_id: string }[]>(`verse_history?select=verse_id&shown_on=eq.${day}`);
      const id = final[0]?.verse_id ?? chosen.id;
      commit({ verses: [{ day, id }, ...merged.filter((h) => h.day !== day)] });
      return byId.get(id) ?? chosen;
    } catch (e) { console.warn('Versículo sin sincronizar', e); }
  }
  if (local && byId.has(local.id)) return byId.get(local.id)!;
  const seed = getSession()?.user.id ?? deviceSeed();
  const v = pickVerse(catalog, state.verses, day, seed, litDay(day).season);
  commit({ verses: [{ day, id: v.id }, ...state.verses] });
  return v;
}
function deviceSeed() {
  try { let s = localStorage.getItem('zarzu.seed'); if (!s) { s = crypto.randomUUID(); localStorage.setItem('zarzu.seed', s); } return s; } catch { return 'zarzu'; }
}

export function initSync() {
  addEventListener('online', () => { void flush(); });
  addEventListener('focus', () => { void flush(); });
  onAuth(() => { void pull().catch((e) => console.warn(e)); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  applyTheme();
}
