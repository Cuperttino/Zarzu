// Lee horarios de misa escritos en formato OpenStreetMap ("Mo-Sa 19:00; Su 10:00,12:00")
// o en castellano ("L-V 19:30; Sábados 20:00; Domingos 11:00 y 13:00").
// Si alguna parte no se entiende (temporadas, fechas, notas), devuelve null y la app
// muestra el texto tal cual: nunca calcula una hora a partir de un horario dudoso.

export type Weekly = number[][]; // índice 0 = domingo; minutos desde medianoche

const DAY: Record<string, number> = {
  su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6,
  do: 0, dom: 0, domingo: 0, domingos: 0, d: 0,
  l: 1, lu: 1, lun: 1, lunes: 1,
  m: 2, ma: 2, mar: 2, martes: 2,
  x: 3, mi: 3, mie: 3, miercoles: 3,
  j: 4, ju: 4, jue: 4, jueves: 4,
  v: 5, vi: 5, vie: 5, viernes: 5,
  s: 6, sab: 6, sabado: 6, sabados: 6,
};
const GROUP: Record<string, number[]> = {
  diario: [0, 1, 2, 3, 4, 5, 6], 'todos los dias': [0, 1, 2, 3, 4, 5, 6], diariamente: [0, 1, 2, 3, 4, 5, 6],
  laborables: [1, 2, 3, 4, 5, 6], 'dias laborables': [1, 2, 3, 4, 5, 6], 'lunes a viernes': [1, 2, 3, 4, 5],
  festivos: [0], 'domingos y festivos': [0], 'sabados y visperas': [6], visperas: [6],
};
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function parseDays(sel: string): number[] | null {
  const s = norm(sel).replace(/[:.]\s*$/, '').replace(/\s+/g, ' ').trim().replace(/^(de|los|el)\s+/, '');
  if (!s) return [0, 1, 2, 3, 4, 5, 6];
  if (GROUP[s]) return GROUP[s];
  const out = new Set<number>();
  for (const part of s.split(/\s*(?:,|\by\b|\be\b)\s*/).filter(Boolean)) {
    if (part === 'ph' || part === 'festivos') { if (part === 'festivos') out.add(0); continue; } // los festivos entre semana no se conocen
    if (GROUP[part]) { GROUP[part].forEach((d) => out.add(d)); continue; }
    const r = part.match(/^([a-z]+)\s*(?:-|\ba\b)\s*([a-z]+)$/);
    if (r) {
      const a = DAY[r[1]], b = DAY[r[2]];
      if (a == null || b == null) return null;
      for (let d = a; ; d = (d + 1) % 7) { out.add(d); if (d === b) break; }
      continue;
    }
    if (DAY[part] == null) return null;
    out.add(DAY[part]);
  }
  return out.size ? [...out] : null;
}

function parseTimes(t: string): number[] | null {
  const s = norm(t).replace(/\bh(oras)?\b/g, '').trim();
  if (!s) return null;
  const out: number[] = [];
  for (const raw of s.split(/\s*(?:,|\by\b|\/)\s*/).filter(Boolean)) {
    const m = raw.match(/^(\d{1,2})(?:[:.](\d{2}))?(?:\s*-\s*\d{1,2}(?:[:.]\d{2})?)?$/);
    if (!m) return null;
    const h = +m[1], min = +(m[2] ?? 0);
    if (h > 23 || min > 59) return null;
    out.push(h * 60 + min);
  }
  return out.length ? out.sort((a, b) => a - b) : null;
}

export function parseSchedule(text: string | null | undefined): Weekly | null {
  if (!text || text.length > 600) return null;
  const week: Weekly = [[], [], [], [], [], [], []];
  const rules = text.split(/\s*(?:;|\n|\|)\s*/).filter(Boolean);
  if (!rules.length) return null;
  for (const rule of rules) {
    const r = rule.trim();
    if (/^ph\s+off$/i.test(r)) continue;
    const m = r.match(/^(.*?)(\d{1,2}[:.]\d{2}.*|\d{1,2}\s*h.*)$/i);
    if (!m) return null;
    const days = parseDays(m[1]);
    const times = parseTimes(m[2]);
    if (!days || !times) return null;
    for (const d of days) week[d] = times; // como en OpenStreetMap, la regla posterior manda
  }
  return week.some((d) => d.length) ? week : null;
}

export interface NextMass { at: Date; dayOffset: number; minutes: number }
export function nextMasses(week: Weekly, now = new Date(), horizonHours = 36): NextMass[] {
  const out: NextMass[] = [];
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (let off = 0; off <= Math.ceil(horizonHours / 24); off++) {
    const day = (now.getDay() + off) % 7;
    for (const m of week[day]) {
      if (off === 0 && m < nowMin - 5) continue; // una misa que empezó hace menos de 5 min todavía cuenta
      const at = new Date(base); at.setDate(base.getDate() + off); at.setHours(Math.floor(m / 60), m % 60, 0, 0);
      if (at.getTime() - now.getTime() > horizonHours * 3600_000) continue;
      out.push({ at, dayOffset: off, minutes: m });
    }
  }
  return out;
}

export const hhmm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const DAY_NAME = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
/** Resumen legible: "Lunes a sábado: 19:00 · Domingo: 10:00, 12:00". */
export function weeklyRows(week: Weekly): { days: string; times: string }[] {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const rows: { from: number; to: number; key: string }[] = [];
  for (const d of order) {
    const key = week[d].join(',');
    const last = rows[rows.length - 1];
    if (last && last.key === key) last.to = d; else rows.push({ from: d, to: d, key });
  }
  return rows.filter((r) => r.key).map((r) => ({
    days: r.from === r.to ? DAY_NAME[r.from] : `${DAY_NAME[r.from]} a ${DAY_NAME[r.to].toLowerCase()}`,
    times: r.key.split(',').map((m) => hhmm(+m)).join(', '),
  }));
}
export function untilLabel(at: Date, now = new Date()) {
  const min = Math.round((at.getTime() - now.getTime()) / 60000);
  if (min <= 0) return 'Empezando ahora';
  if (min < 60) return `En ${min} min`;
  const h = Math.floor(min / 60), r = min % 60;
  if (min < 6 * 60) return `En ${h} h${r ? ` ${r} min` : ''}`;
  const sameDay = at.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  return sameDay ? 'Hoy' : at.toDateString() === tomorrow.toDateString() ? 'Mañana' : DAY_NAME[at.getDay()];
}
