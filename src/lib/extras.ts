// Cuenta atrás de los tiempos litúrgicos y búsqueda de «tu santo».
import { FIXED } from '../data/romanCalendar.ts';
import { MARTYROLOGY } from '../data/saints.ts';
import { keys } from './calendar.ts';
import { addDays, diffDays, type ISODate } from './dates.ts';

export interface Countdown { id: string; label: string; date: ISODate; days: number }

/** Próximas fechas clave del año litúrgico (y tu santo, si lo has elegido), de la más cercana a la más lejana. */
export function countdowns(from: ISODate, saint?: { name: string; date: string } | null): Countdown[] {
  const y = +from.slice(0, 4), out: Countdown[] = [];
  const add = (id: string, label: string, date: ISODate) => { const days = diffDays(date, from); if (days >= 0 && !out.some((c) => c.id === id)) out.push({ id, label, date, days }); };
  for (const yy of [y, y + 1]) {
    const k = keys(yy);
    add('adviento', 'Adviento', k.advent1);
    add('navidad', 'Navidad', `${yy}-12-25`);
    add('cuaresma', 'Miércoles de Ceniza', k.ash);
    add('ramos', 'Domingo de Ramos', k.palm);
    add('pascua', 'Domingo de Pascua', k.easter);
    add('pentecostes', 'Pentecostés', k.pentecost);
    if (saint) add('santo', `Tu santo: ${saint.name}`, `${yy}-${saint.date}`);
  }
  return out.sort((a, b) => a.days - b.days);
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const SKIP = /^(nuestra senora|santa maria, madre|natividad|anunciacion|ascension|presentacion del senor|bautismo del senor|transfiguracion|exaltacion|dedicacion|todos los santos|conmemoracion|epifania|sagrada familia|inmaculada concepcion)/;

export interface SaintOption { name: string; date: string } // date: MM-DD
/** Busca santos por nombre en el calendario y el martirologio. «Santi» o «Santiago» encuentran a Santiago. */
export function findSaints(query: string): SaintOption[] {
  const q = norm(query.trim());
  if (q.length < 3) return [];
  const words = q.split(/\s+/);
  const all: SaintOption[] = [];
  for (const [md, f] of Object.entries(FIXED)) all.push({ name: f.name, date: md });
  MARTYROLOGY.forEach((month, m) => month.forEach((name, d) => all.push({ name, date: `${String(m + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}` })));
  const seen = new Set<string>(), out: SaintOption[] = [];
  for (const o of all) {
    const n = norm(o.name);
    if (SKIP.test(n)) continue;
    const tokens = n.replace(/[^a-z\s]/g, ' ').split(/\s+/);
    if (!words.every((w) => tokens.some((t) => t.startsWith(w)))) continue;
    const key = `${o.date}|${n}`;
    if (seen.has(key)) continue;
    seen.add(key); out.push(o);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 30);
}
export const nextDateOf = (md: string, from: ISODate): ISODate => { const y = +from.slice(0, 4); const d = `${y}-${md}`; return d < from ? `${y + 1}-${md}` : d; };
export { addDays };
