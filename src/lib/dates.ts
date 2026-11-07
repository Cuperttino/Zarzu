/** Utilidades de fecha sobre la fecha civil local (nunca UTC) expresada como YYYY-MM-DD. */
export type ISODate = string;
const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date): ISODate => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: ISODate) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const addDays = (s: ISODate, n: number): ISODate => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const today = (): ISODate => iso(new Date());
export const diffDays = (a: ISODate, b: ISODate) => Math.round((parse(a).getTime() - parse(b).getTime()) / 86400000);
export const weekday = (s: ISODate) => parse(s).getDay();
export const mmdd = (s: ISODate) => s.slice(5);

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-ES', o);
export const longDate = (s: ISODate) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(parse(s));
export const fullDate = (s: ISODate) => fmt({ day: 'numeric', month: 'long', year: 'numeric' }).format(parse(s));
export const shortDate = (s: ISODate) => fmt({ day: 'numeric', month: 'short' }).format(parse(s));
export const monthName = (y: number, m: number) => fmt({ month: 'long', year: 'numeric' }).format(new Date(y, m, 1));
export const relativeTime = (when: string | number) => {
  const ms = Date.now() - new Date(when).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return 'hace un momento';
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return d === 1 ? 'ayer' : `hace ${d} días`;
  return fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(when));
};
