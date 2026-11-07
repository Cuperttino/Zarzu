/**
 * Versículo diario con antirrepetición.
 * 1) Prioriza siempre los que nunca se han mostrado a este usuario.
 * 2) Agotado el repertorio, recupera primero los mostrados hace más tiempo.
 * 3) Entre los candidatos evita libro y capítulo recientes, varía el tema y atiende al tiempo litúrgico.
 * La función es pura: con el mismo historial y la misma semilla elige lo mismo en cualquier dispositivo.
 */
import type { Season } from './calendar.ts';

export interface Verse { id: string; ref: string; text: string; theme: string; book: string; c: number; v: number }
export interface HistoryEntry { day: string; id: string }

const SEASON_THEMES: Record<Season, string[]> = {
  adviento: ['esperanza', 'vocacion', 'confianza', 'alabanza'], navidad: ['amor', 'alabanza', 'paz', 'vida'], ordinario: [],
  cuaresma: ['conversion', 'misericordia', 'caridad', 'humildad'], 'semana-santa': ['amor', 'misericordia', 'fortaleza', 'consuelo'],
  triduo: ['amor', 'misericordia', 'esperanza', 'fe'], pascua: ['vida', 'esperanza', 'alabanza', 'fe'],
};

export function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export function pickVerse(catalog: Verse[], history: HistoryEntry[], day: string, seed: string, season: Season = 'ordinario'): Verse {
  if (!catalog.length) throw new Error('Catálogo vacío');
  const last = new Map<string, string>();
  for (const h of history) { const p = last.get(h.id); if (!p || h.day > p) last.set(h.id, h.day); }
  const unseen = catalog.filter((v) => !last.has(v.id));
  let pool = unseen;
  if (!pool.length) {
    // Repertorio agotado: solo el 5 % mostrado hace más tiempo.
    const sorted = [...catalog].sort((a, b) => last.get(a.id)!.localeCompare(last.get(b.id)!));
    pool = sorted.slice(0, Math.max(1, Math.ceil(catalog.length * 0.05)));
  }
  const byId = new Map(catalog.map((v) => [v.id, v]));
  const recent = [...history].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 30).map((h) => byId.get(h.id)).filter((v): v is Verse => !!v);
  const recentBooks = new Set(recent.slice(0, 7).map((v) => v.book));
  const recentChapters = new Set(recent.map((v) => `${v.book}.${v.c}`));
  const recentThemes = recent.slice(0, 3).map((v) => v.theme);
  const favoured = SEASON_THEMES[season];
  let best = pool[0], bestScore = -Infinity;
  for (const v of pool) {
    let s = (hash(`${seed}|${day}|${v.id}`) % 1000) / 1000; // desempate estable, distinto para cada persona
    if (recentBooks.has(v.book)) s -= 3;
    if (recentChapters.has(`${v.book}.${v.c}`)) s -= 5;
    if (recentThemes.includes(v.theme)) s -= 2;
    if (favoured.includes(v.theme)) s += 1.5;
    if (s > bestScore) { bestScore = s; best = v; }
  }
  return best;
}

const BASE = () => (typeof __PREVIEW__ !== 'undefined' && __PREVIEW__ ? '' : '/');
let catalog: Promise<Verse[]> | null = null;
export const loadCatalog = (): Promise<Verse[]> => (catalog ??= fetch(`${BASE()}data/verses.json`).then((r) => { if (!r.ok) throw new Error('catálogo'); return r.json(); }));
