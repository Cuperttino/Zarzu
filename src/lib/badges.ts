// Insignias: se calculan a partir de la actividad guardada, sin servidor.
import type { Activity } from './store.ts';
import { addDays } from './dates.ts';

export interface Badge { id: string; title: string; text: string; icon: string; goal: number; value: (s: Progress) => number }
export interface Progress { bestStreak: number; days: number; rosaries: number; gospels: number; chapters: number; prayers: number; psalms: number; gospelBooks: number }

const GOSPELS: Record<string, number> = { MAT: 28, MRK: 16, LUK: 24, JHN: 21 };

/** Racha más larga de días seguidos con actividad. */
export function bestStreak(days: Iterable<string>): number {
  const set = new Set(days); let best = 0;
  for (const d of set) {
    if (set.has(addDays(d, -1))) continue; // solo se cuenta desde el primer día de cada racha
    let n = 1; while (set.has(addDays(d, n))) n++;
    best = Math.max(best, n);
  }
  return best;
}

export function progressOf(activity: Activity[]): Progress {
  const chapters = new Set<string>(), uniq = (k: Activity['kind']) => new Set(activity.filter((a) => a.kind === k).map((a) => `${a.ref}|${a.day}`)).size;
  for (const a of activity) if (a.kind === 'reading' && /^[1-3A-Z]{3}\.\d+$/.test(a.ref)) chapters.add(a.ref);
  const gospelBooks = Object.entries(GOSPELS).filter(([b, n]) => Array.from({ length: n }, (_, i) => `${b}.${i + 1}`).every((c) => chapters.has(c))).length;
  return {
    bestStreak: bestStreak(activity.map((a) => a.day)), days: new Set(activity.map((a) => a.day)).size,
    rosaries: activity.filter((a) => a.kind === 'rosary' && a.ref !== 'coronilla').length, gospels: uniq('gospel'), prayers: uniq('prayer'),
    chapters: chapters.size, psalms: [...chapters].filter((c) => c.startsWith('PSA.')).length, gospelBooks,
  };
}

export const BADGES: Badge[] = [
  { id: 'llama', title: 'Primera llama', text: 'Tu primer día con Zarzu.', icon: 'flame', goal: 1, value: (s) => s.days },
  { id: 'semana', title: 'Una semana', text: '7 días seguidos.', icon: 'flame', goal: 7, value: (s) => s.bestStreak },
  { id: 'mes', title: 'Un mes de fe', text: '30 días seguidos.', icon: 'flame', goal: 30, value: (s) => s.bestStreak },
  { id: 'cien', title: 'Cien días', text: '100 días seguidos.', icon: 'flame', goal: 100, value: (s) => s.bestStreak },
  { id: 'rosario1', title: 'Primer rosario', text: 'Rezaste un rosario completo.', icon: 'rosary', goal: 1, value: (s) => s.rosaries },
  { id: 'rosario10', title: 'Diez rosarios', text: '10 rosarios completos.', icon: 'rosary', goal: 10, value: (s) => s.rosaries },
  { id: 'rosario50', title: 'Corona de rosas', text: '50 rosarios completos.', icon: 'rosary', goal: 50, value: (s) => s.rosaries },
  { id: 'evangelio7', title: 'Oyente de la Palabra', text: 'El Evangelio del día 7 veces.', icon: 'book', goal: 7, value: (s) => s.gospels },
  { id: 'evangelio30', title: 'Un mes con el Evangelio', text: 'El Evangelio del día 30 veces.', icon: 'book', goal: 30, value: (s) => s.gospels },
  { id: 'cap10', title: 'Lector', text: '10 capítulos de la Biblia.', icon: 'book', goal: 10, value: (s) => s.chapters },
  { id: 'cap100', title: 'Gran lector', text: '100 capítulos de la Biblia.', icon: 'book', goal: 100, value: (s) => s.chapters },
  { id: 'salmos', title: 'Salmista', text: '30 salmos distintos.', icon: 'pray', goal: 30, value: (s) => s.psalms },
  { id: 'evangelista', title: 'Un Evangelio entero', text: 'Todos los capítulos de un Evangelio.', icon: 'star', goal: 1, value: (s) => s.gospelBooks },
  { id: 'cuatro', title: 'Los cuatro Evangelios', text: 'Mateo, Marcos, Lucas y Juan completos.', icon: 'star', goal: 4, value: (s) => s.gospelBooks },
  { id: 'orante', title: 'Orante', text: '20 oraciones rezadas.', icon: 'pray', goal: 20, value: (s) => s.prayers },
];

export const earned = (p: Progress) => BADGES.filter((b) => b.value(p) >= b.goal);
