/**
 * Calendario litúrgico (rito romano, forma ordinaria) con las particularidades de España:
 * Epifanía el 6 de enero, Ascensión y Corpus trasladados al domingo.
 * Se calcula en el dispositivo: no depende de ninguna red.
 * Tabla de precedencias: Normas Universales sobre el Año Litúrgico y el Calendario.
 */
import { addDays, diffDays, iso, mmdd, weekday, type ISODate } from './dates.ts';
import { FIXED, type Rank, type LitColor, type FixedFeast } from '../data/romanCalendar.ts';

export type Season = 'adviento' | 'navidad' | 'ordinario' | 'cuaresma' | 'semana-santa' | 'triduo' | 'pascua';
export const SEASON_LABEL: Record<Season, string> = {
  adviento: 'Adviento', navidad: 'Navidad', ordinario: 'Tiempo Ordinario', cuaresma: 'Cuaresma',
  'semana-santa': 'Semana Santa', triduo: 'Triduo Pascual', pascua: 'Pascua',
};
export const COLOR_LABEL: Record<LitColor, string> = { blanco: 'Blanco', rojo: 'Rojo', verde: 'Verde', morado: 'Morado', rosa: 'Rosa' };
export const RANK_LABEL: Record<Rank, string> = { 0: 'Feria', 1: 'Solemnidad', 2: 'Fiesta', 3: 'Memoria obligatoria', 4: 'Memoria libre' };

export interface LitDay {
  date: ISODate; title: string; season: Season; seasonLabel: string; color: LitColor; rank: Rank | 'domingo';
  rankLabel: string; cycle: 'A' | 'B' | 'C'; weekdayCycle: 'I' | 'II'; week: number | null; saint?: string; optional: string[];
}

export function easter(y: number): ISODate {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(new Date(y, month - 1, day, 12));
}

const nextSunday = (s: ISODate) => addDays(s, 7 - weekday(s)); // estrictamente posterior
export const firstAdvent = (y: number) => { const w = weekday(`${y}-11-27`); return addDays(`${y}-11-27`, w === 0 ? 0 : 7 - w); };

export interface YearKeys {
  easter: ISODate; ash: ISODate; palm: ISODate; holyThu: ISODate; goodFri: ISODate; holySat: ISODate; ascension: ISODate;
  pentecost: ISODate; trinity: ISODate; corpus: ISODate; sacredHeart: ISODate; immaculateHeart: ISODate; advent1: ISODate;
  christKing: ISODate; holyFamily: ISODate; baptism: ISODate; maryChurch: ISODate; highPriest: ISODate;
}
const cache = new Map<number, YearKeys>();
export function keys(y: number): YearKeys {
  const hit = cache.get(y); if (hit) return hit;
  const e = easter(y), pent = addDays(e, 49), adv = firstAdvent(y);
  const k: YearKeys = {
    easter: e, ash: addDays(e, -46), palm: addDays(e, -7), holyThu: addDays(e, -3), goodFri: addDays(e, -2), holySat: addDays(e, -1),
    ascension: addDays(e, 42), pentecost: pent, trinity: addDays(pent, 7), corpus: addDays(pent, 14), sacredHeart: addDays(pent, 19),
    immaculateHeart: addDays(pent, 20), maryChurch: addDays(pent, 1), highPriest: addDays(pent, 4), advent1: adv, christKing: addDays(adv, -7),
    holyFamily: weekday(`${y}-12-25`) === 0 ? `${y}-12-30` : nextSunday(`${y}-12-25`), baptism: nextSunday(`${y}-01-06`),
  };
  cache.set(y, k); return k;
}

const ORD = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV', 'XXVI', 'XXVII', 'XXVIII', 'XXIX', 'XXX', 'XXXI', 'XXXII', 'XXXIII', 'XXXIV'];
const WD = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

interface Temporal { season: Season; title: string; week: number | null; color: LitColor; priv: 0 | 1 | 2 | 3; movable?: { rank: Rank | 'domingo'; }; }
/** priv: 3 = nada lo desplaza; 2 = solo solemnidades trasladadas se mueven y memorias se omiten; 1 = feria mayor (memorias solo conmemoradas); 0 = normal. */
function temporal(d: ISODate): Temporal {
  const y = +d.slice(0, 4), k = keys(y), wd = weekday(d), sun = wd === 0;
  const dd = (x: ISODate) => diffDays(d, x);
  // Triduo
  if (d === k.holyThu) return { season: 'triduo', title: 'Jueves Santo', week: null, color: 'blanco', priv: 3, movable: { rank: 1 } };
  if (d === k.goodFri) return { season: 'triduo', title: 'Viernes Santo de la Pasión del Señor', week: null, color: 'rojo', priv: 3, movable: { rank: 1 } };
  if (d === k.holySat) return { season: 'triduo', title: 'Sábado Santo', week: null, color: 'morado', priv: 3, movable: { rank: 1 } };
  if (d === k.easter) return { season: 'pascua', title: 'Domingo de Pascua de la Resurrección del Señor', week: 1, color: 'blanco', priv: 3, movable: { rank: 1 } };
  // Pascua
  if (dd(k.easter) > 0 && dd(k.pentecost) <= 0) {
    const n = dd(k.easter), week = Math.floor(n / 7) + 1;
    if (d === k.pentecost) return { season: 'pascua', title: 'Domingo de Pentecostés', week: 8, color: 'rojo', priv: 3, movable: { rank: 1 } };
    if (d === k.ascension) return { season: 'pascua', title: 'La Ascensión del Señor', week: 7, color: 'blanco', priv: 3, movable: { rank: 1 } };
    if (n < 7) return { season: 'pascua', title: `${WD[wd]} de la Octava de Pascua`, week: 1, color: 'blanco', priv: 3 };
    if (sun) return { season: 'pascua', title: n === 7 ? 'II Domingo de Pascua o de la Divina Misericordia' : `${ORD[week]} Domingo de Pascua`, week, color: 'blanco', priv: 3, movable: { rank: 'domingo' } };
    return { season: 'pascua', title: `${WD[wd]} de la ${ORD[week]} semana de Pascua`, week, color: 'blanco', priv: 0 };
  }
  // Cuaresma y Semana Santa
  if (dd(k.ash) >= 0 && d < k.holyThu) {
    if (d === k.ash) return { season: 'cuaresma', title: 'Miércoles de Ceniza', week: 0, color: 'morado', priv: 3 };
    if (d === k.palm) return { season: 'semana-santa', title: 'Domingo de Ramos en la Pasión del Señor', week: null, color: 'rojo', priv: 3, movable: { rank: 'domingo' } };
    if (d > k.palm) return { season: 'semana-santa', title: `${WD[wd]} Santo`, week: null, color: 'morado', priv: 3 };
    const lent1 = addDays(k.ash, 4);
    if (d < lent1) return { season: 'cuaresma', title: `${WD[wd]} después de Ceniza`, week: 0, color: 'morado', priv: 1 };
    const week = Math.floor(dd(lent1) / 7) + 1;
    if (sun) return { season: 'cuaresma', title: `${ORD[week]} Domingo de Cuaresma`, week, color: week === 4 ? 'rosa' : 'morado', priv: 3, movable: { rank: 'domingo' } };
    return { season: 'cuaresma', title: `${WD[wd]} de la ${ORD[week]} semana de Cuaresma`, week, color: 'morado', priv: 1 };
  }
  // Adviento
  if (d >= k.advent1 && d < `${y}-12-25`) {
    const week = Math.floor(dd(k.advent1) / 7) + 1;
    if (sun) return { season: 'adviento', title: `${ORD[week]} Domingo de Adviento`, week, color: week === 3 ? 'rosa' : 'morado', priv: 3, movable: { rank: 'domingo' } };
    if (d >= `${y}-12-17`) return { season: 'adviento', title: `Feria mayor de Adviento, ${+d.slice(8)} de diciembre`, week, color: 'morado', priv: 1 };
    return { season: 'adviento', title: `${WD[wd]} de la ${ORD[week]} semana de Adviento`, week, color: 'morado', priv: 0 };
  }
  // Navidad (dos tramos del año civil)
  if (d >= `${y}-12-25`) {
    if (d === `${y}-12-25`) return { season: 'navidad', title: 'La Natividad del Señor', week: null, color: 'blanco', priv: 3, movable: { rank: 1 } };
    if (d === k.holyFamily) return { season: 'navidad', title: 'La Sagrada Familia de Jesús, María y José', week: null, color: 'blanco', priv: 3, movable: { rank: 2 } };
    return { season: 'navidad', title: `Octava de Navidad, ${+d.slice(8)} de diciembre`, week: null, color: 'blanco', priv: 1 };
  }
  if (d <= k.baptism) {
    if (d === k.baptism) return { season: 'navidad', title: 'El Bautismo del Señor', week: 1, color: 'blanco', priv: 3, movable: { rank: 2 } };
    if (d === `${y}-01-01`) return { season: 'navidad', title: 'Santa María, Madre de Dios', week: null, color: 'blanco', priv: 3, movable: { rank: 1 } };
    if (d === `${y}-01-06`) return { season: 'navidad', title: 'La Epifanía del Señor', week: null, color: 'blanco', priv: 3, movable: { rank: 1 } };
    if (sun) return { season: 'navidad', title: 'II Domingo después de Navidad', week: null, color: 'blanco', priv: 2, movable: { rank: 'domingo' } };
    return { season: 'navidad', title: `Feria del tiempo de Navidad, ${+d.slice(8)} de enero`, week: null, color: 'blanco', priv: 0 };
  }
  // Tiempo Ordinario
  if (d === k.trinity) return { season: 'ordinario', title: 'La Santísima Trinidad', week: null, color: 'blanco', priv: 3, movable: { rank: 1 } };
  if (d === k.corpus) return { season: 'ordinario', title: 'El Santísimo Cuerpo y Sangre de Cristo', week: null, color: 'blanco', priv: 3, movable: { rank: 1 } };
  if (d === k.sacredHeart) return { season: 'ordinario', title: 'El Sagrado Corazón de Jesús', week: null, color: 'blanco', priv: 3, movable: { rank: 1 } };
  if (d === k.christKing) return { season: 'ordinario', title: 'Nuestro Señor Jesucristo, Rey del Universo', week: 34, color: 'blanco', priv: 3, movable: { rank: 1 } };
  const week = d < k.ash ? Math.floor(dd(k.baptism) / 7) + 1 : 34 - Math.ceil(diffDays(k.christKing, d) / 7);
  if (sun) return { season: 'ordinario', title: `${ORD[week]} Domingo del Tiempo Ordinario`, week, color: 'verde', priv: 2, movable: { rank: 'domingo' } };
  return { season: 'ordinario', title: `${WD[wd]} de la ${ORD[week]} semana del Tiempo Ordinario`, week, color: 'verde', priv: 0 };
}

/** Días en que una solemnidad fija debe trasladarse. */
const blocksSolemnity = (t: Temporal) => t.priv === 3 && !(t.season === 'navidad');

/** Resuelve la fecha real de las solemnidades con traslado (San José, Anunciación, Inmaculada, Natividad del Bautista…). */
export function transferred(y: number): Map<ISODate, FixedFeast> {
  const map = new Map<ISODate, FixedFeast>(), k = keys(y);
  for (const [md, f] of Object.entries(FIXED)) {
    if (f.rank !== 1) continue;
    let d = `${y}-${md}`;
    const t = temporal(d);
    if (!blocksSolemnity(t) && !(t.movable?.rank === 1)) continue;
    if (md === '03-19' && d >= k.palm && d <= k.easter) d = addDays(k.palm, -1);
    else if (md === '06-24' && d === k.sacredHeart) d = addDays(d, -1);
    else if (d >= k.palm && d <= addDays(k.easter, 7)) d = addDays(k.easter, 8);
    else { do d = addDays(d, 1); while (blocksSolemnity(temporal(d)) || temporal(d).movable?.rank === 1); }
    if (d !== `${y}-${md}`) map.set(d, f);
  }
  return map;
}

const cycleOf = (d: ISODate) => {
  const y = +d.slice(0, 4), ly = d >= keys(y).advent1 ? y + 1 : y;
  return { cycle: (['C', 'A', 'B'] as const)[ly % 3], weekdayCycle: (ly % 2 ? 'I' : 'II') as 'I' | 'II' };
};

export function litDay(d: ISODate): LitDay {
  const y = +d.slice(0, 4), k = keys(y), t = temporal(d), { cycle, weekdayCycle } = cycleOf(d), md = mmdd(d);
  const base = { date: d, season: t.season, seasonLabel: SEASON_LABEL[t.season], cycle, weekdayCycle, week: t.week, optional: [] as string[] };
  const moved = transferred(y);
  let fixed: FixedFeast | undefined = moved.get(d);
  const native = FIXED[md];
  if (!fixed && native) {
    // Una solemnidad cuya fecha propia queda impedida se ha trasladado: no se celebra hoy.
    const blockedSol = native.rank === 1 && (blocksSolemnity(t) || t.movable?.rank === 1);
    if (!blockedSol) fixed = native;
  }
  const out = (title: string, rank: Rank | 'domingo', color: LitColor, saint?: string, optional: string[] = []): LitDay => ({
    ...base, title, rank, color, saint, optional, rankLabel: rank === 'domingo' ? 'Domingo' : RANK_LABEL[rank],
  });
  const tRank = t.movable?.rank;
  // Las celebraciones móviles propias del Tiempo Ordinario (memorias y fiestas posteriores a Pentecostés)
  if (d === k.maryChurch && (!fixed || fixed.rank >= 3)) return out('Bienaventurada Virgen María, Madre de la Iglesia', 3, 'blanco', 'Santa María, Madre de la Iglesia');
  if (d === k.highPriest && (!fixed || fixed.rank >= 3)) return out('Jesucristo, Sumo y Eterno Sacerdote', 2, 'blanco');
  if (d === k.immaculateHeart && (!fixed || fixed.rank >= 3)) return out('Inmaculado Corazón de María', 3, 'blanco', 'Inmaculado Corazón de María');
  if (!fixed) return out(t.title, tRank ?? 0, t.color);
  const saint = fixed.saint === false ? undefined : fixed.name;
  // Solemnidades: ceden solo a lo que ya se ha resuelto con traslado
  if (fixed.rank === 1) return out(fixed.name, 1, fixed.color, saint);
  // Conmemoración de los fieles difuntos: prevalece sobre el domingo
  if (md === '11-02') return out(fixed.name, 1, 'morado');
  if (t.priv === 3) return out(t.title, tRank ?? 1, t.color, undefined, [fixed.name]);
  if (fixed.rank === 2) {
    if (t.priv === 2 && t.movable?.rank === 'domingo') {
      if (fixed.lord) return out(fixed.name, 2, fixed.color); // fiesta del Señor en domingo ordinario
      return out(t.title, 'domingo', t.color, undefined, [fixed.name]);
    }
    return out(fixed.name, 2, fixed.color, saint);
  }
  // Memorias
  if (t.priv === 2) return out(t.title, tRank ?? 0, t.color, undefined, [fixed.name]);
  if (t.priv === 1) return out(t.title, 0, t.color, saint, [fixed.name]); // solo conmemoración
  if (fixed.rank === 3) return out(fixed.name, 3, fixed.color, saint);
  return out(t.title, 0, t.color, saint, [fixed.name]); // memoria libre: el color de la feria
}

/** Celebraciones importantes próximas (solemnidades, fiestas y momentos del año) */
export function upcoming(from: ISODate, count = 5): LitDay[] {
  const out: LitDay[] = [];
  for (let i = 1; i <= 400 && out.length < count; i++) {
    const l = litDay(addDays(from, i));
    const big = l.rank === 1 || l.rank === 2 || l.title === 'Miércoles de Ceniza' || l.season === 'triduo' || l.title.startsWith('Domingo de Ramos') || l.title === 'I Domingo de Adviento';
    if (big) out.push(l);
  }
  return out;
}

export interface SeasonSpan { season: Season; label: string; from: ISODate; to: ISODate; color: LitColor }
/** Tramos del año civil para el calendario anual. */
export function yearSpans(y: number): SeasonSpan[] {
  const k = keys(y), S = (season: Season, from: ISODate, to: ISODate, color: LitColor): SeasonSpan => ({ season, label: SEASON_LABEL[season], from, to, color });
  return [
    S('navidad', `${y}-01-01`, k.baptism, 'blanco'),
    S('ordinario', addDays(k.baptism, 1), addDays(k.ash, -1), 'verde'),
    S('cuaresma', k.ash, addDays(k.palm, -1), 'morado'),
    S('semana-santa', k.palm, addDays(k.holyThu, -1), 'morado'),
    S('triduo', k.holyThu, k.holySat, 'rojo'),
    S('pascua', k.easter, k.pentecost, 'blanco'),
    S('ordinario', addDays(k.pentecost, 1), addDays(k.advent1, -1), 'verde'),
    S('adviento', k.advent1, `${y}-12-24`, 'morado'),
    S('navidad', `${y}-12-25`, `${y}-12-31`, 'blanco'),
  ];
}
