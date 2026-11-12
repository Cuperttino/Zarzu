import { useEffect, useMemo, useState } from 'react';
import { Button, Chip, Icon, Input, Link, Notice, Page, Spinner } from '../components/ui.tsx';
import { api, fmtKm, km } from '../lib/app.ts';
import { useStore } from '../lib/store.ts';
import { hhmm, nextMasses, parseSchedule, untilLabel, type Weekly } from '../lib/massTimes.ts';
import { PlaceCard, geocode, places } from './Temples.tsx';
import type { Place } from '../../server/places.ts';
import type { Adoration, MisasChurch, MisasResult } from '../../server/misas.ts';
import { ParishButton } from './Extras.tsx';
import { addDays, longDate, today } from '../lib/dates.ts';

type Geo = { lat: number; lon: number; name: string };
type Mode = 'misa' | 'adoracion' | 'perpetua';
const MODES: { id: Mode; label: string }[] = [{ id: 'misa', label: 'Misas' }, { id: 'adoracion', label: 'Adoración' }, { id: 'perpetua', label: 'Adoración perpetua' }];
const RADII: Record<Mode, number[]> = { misa: [1, 3, 5, 10], adoracion: [1, 3, 5, 10], perpetua: [5, 10, 25] };
const SOON = 120; // minutos: lo que empieza en las próximas 2 horas se marca como «pronto»
const MISAS_ORG = 'https://misas.org/buscar/misa';
const SAME_PLACE_KM = 0.08;
const ADOR_LABEL: Record<Adoration['type'], string> = { normal: 'Adoración', prolongada: 'Adoración prolongada', perpetua: 'Adoración perpetua' };

const bearing = (a: Geo, b: { lat: number; lon: number }) => {
  const r = Math.PI / 180, y = Math.sin((b.lon - a.lon) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lon - a.lon) * r);
  return Math.atan2(y, x); // 0 = norte, sentido horario
};

/** Una misa o un rato de adoración. Las misas no tienen hora de fin; la adoración sí. */
interface Slot { at: Date; end: Date | null; minutes: number; label: string; note: string; perpetual: boolean }
/** Un templo del radar: de misas.org, de OpenStreetMap o de ambos. */
interface Item { id: string; name: string; lat: number; lon: number; d: number; p: Place | null; m: MisasChurch | null; week: Weekly | null; slots: Slot[] }

const dayDate = (day: string, t = '00:00') => { const [y, mo, d] = day.split('-').map(Number), [h, mi] = t.split(':').map(Number); return new Date(y, mo - 1, d, h, mi); };
const isOpen = (s: Slot, now: Date) => s.perpetual || (!!s.end && s.at <= now && now < s.end);
const sortKey = (s: Slot, now: Date) => (isOpen(s, now) ? now.getTime() : s.at.getTime());
const minsTo = (s: Slot, now: Date) => (isOpen(s, now) ? 0 : (s.at.getTime() - now.getTime()) / 60000);

function massSlots(m: MisasChurch, now: Date): Slot[] {
  return Object.entries(m.masses).flatMap(([day, times]) => times.map((t) => ({ at: dayDate(day, t), end: null, minutes: dayDate(day, t).getHours() * 60 + dayDate(day, t).getMinutes(), label: 'Misa', note: '', perpetual: false })))
    .filter((s) => s.at.getTime() >= now.getTime() - 5 * 60000);
}
function adorationSlots(m: MisasChurch, now: Date): Slot[] {
  const out: Slot[] = [];
  for (const [day, list] of Object.entries(m.adorations)) for (const a of list) {
    const at = dayDate(day, a.begin);
    let end = dayDate(day, a.end);
    if (end <= at) end = new Date(end.getTime() + 86_400_000); // termina a medianoche o pasada
    out.push({ at, end, minutes: at.getHours() * 60 + at.getMinutes(), label: ADOR_LABEL[a.type], note: a.note, perpetual: a.type === 'perpetua' });
  }
  const perpetual = out.find((s) => s.perpetual);
  return perpetual ? [perpetual] : out.filter((s) => s.end! > now);
}
const sourceLabel = (it: Item) => it.m ? 'Horario de misas.org' : it.p?.mass.status === 'verified' ? 'Horario confirmado' : 'Horario sin confirmar';

function useNow() { const [n, set] = useState(() => new Date()); useEffect(() => { const t = setInterval(() => set(new Date()), 30_000); return () => clearInterval(t); }, []); return n; }

export function RadarScreen() {
  const fav = useStore((s) => s.place);
  const [mode, setMode] = useState<Mode>('misa');
  const [day, setDay] = useState(''); // '' = hoy y mañana; si no, una fecha concreta
  const [origin, setOrigin] = useState<Geo | null>(fav ? { ...fav } : null);
  const [radius, setRadius] = useState(3), [list, setList] = useState<Place[] | null>(null), [misas, setMisas] = useState<MisasChurch[] | null>(null), [busy, setBusy] = useState(''), [err, setErr] = useState('');
  const [sel, setSel] = useState<string | null>(null), [q, setQ] = useState(''), [options, setOptions] = useState<Geo[]>([]), [showAll, setShowAll] = useState(false);
  const now = useNow();
  const ador = mode !== 'misa';

  const changeMode = (m: Mode) => { setMode(m); setSel(null); setShowAll(false); if (!RADII[m].includes(radius)) setRadius(m === 'perpetua' ? 10 : 3); };

  useEffect(() => {
    if (!origin) return;
    let live = true; setBusy(ador ? 'Buscando adoración…' : 'Buscando misas…'); setErr(''); setMisas(null);
    const lat = +origin.lat.toFixed(4), lon = +origin.lon.toFixed(4), r = Math.max(radius, 3);
    void Promise.allSettled([ador ? Promise.resolve([] as Place[]) : places(lat, lon, r), api<MisasResult>(`/api/misas?kind=${ador ? 'adorations' : 'masses'}&lat=${lat}&lon=${lon}&radius=${r * 1000}${day ? `&date=${day}` : ''}`)]).then(([p, m]) => {
      if (!live) return;
      setList(p.status === 'fulfilled' ? p.value : []);
      setMisas(m.status === 'fulfilled' ? m.value.churches : null);
      if (m.status === 'rejected' && (ador || p.status === 'rejected')) { setErr(ador ? (m.reason as Error).message : (p.reason as Error).message); if (ador || p.status === 'rejected') setList(null); }
    }).finally(() => live && setBusy(''));
    return () => { live = false; };
  }, [origin?.lat, origin?.lon, radius, ador, day]); // eslint-disable-line

  const locate = () => {
    if (!navigator.geolocation) { setErr('Este navegador no permite obtener tu ubicación. Busca por localidad.'); return; }
    setBusy('Buscando tu ubicación…'); setErr('');
    navigator.geolocation.getCurrentPosition((p) => { setOrigin({ lat: p.coords.latitude, lon: p.coords.longitude, name: 'Tu ubicación' }); setBusy(''); },
      (e) => { setBusy(''); setErr(e.code === 1 ? 'Has rechazado el permiso de ubicación. Puedes buscar por localidad.' : 'No se ha podido obtener tu ubicación. Busca por localidad.'); }, { enableHighAccuracy: true, timeout: 12000 });
  };
  const search = async () => {
    if (q.trim().length < 2) return;
    setBusy('Buscando la localidad…'); setErr(''); setOptions([]);
    try { const r = await geocode(/^\d{5}$/.test(q.trim()) ? `${q.trim()}, España` : q.trim()); if (!r.length) setErr(`No hemos encontrado «${q}».`); else if (r.length === 1) setOrigin(r[0]); else setOptions(r); }
    catch (e) { setErr((e as Error).message); }
    setBusy('');
  };

  const items = useMemo<Item[]>(() => {
    if (!origin || !list) return [];
    const used = new Set<string>(), out: Item[] = [];
    for (const m of misas ?? []) {
      const p = list.filter((x) => !used.has(x.id) && km(m, x) < SAME_PLACE_KM).sort((a, b) => km(m, a) - km(m, b))[0] ?? null;
      if (p) used.add(p.id);
      const slots = mode === 'misa' ? massSlots(m, now) : adorationSlots(m, now);
      if (mode === 'perpetua' && !slots.some((s) => s.perpetual)) continue;
      if (ador && !slots.length) continue;
      out.push({ id: `m${m.id}`, name: m.name, lat: m.lat, lon: m.lon, d: km(origin, m), p, m, week: null, slots });
    }
    if (mode === 'misa' && !day) for (const p of list) {
      if (used.has(p.id)) continue;
      const week = parseSchedule(p.mass.text);
      const slots = week ? nextMasses(week, now).map((n) => ({ at: n.at, end: null, minutes: n.minutes, label: 'Misa', note: '', perpetual: false })) : [];
      out.push({ id: p.id, name: p.name, lat: p.lat, lon: p.lon, d: km(origin, p), p, m: null, week, slots });
    }
    return out.filter((x) => x.d <= radius + 0.01).sort((a, b) => a.d - b.d);
  }, [list, misas, origin, radius, now, mode, ador, day]);

  const upcoming = useMemo(() => items.flatMap((it) => it.slots.slice(0, 3).map((s) => ({ it, s })))
    .sort((a, b) => mode === 'perpetua' ? a.it.d - b.it.d : sortKey(a.s, now) - sortKey(b.s, now)), [items, now, mode]);
  const withText = mode === 'misa' ? items.filter((x) => !x.m && x.p && !x.week && x.p.mass.status !== 'unavailable') : [];
  const unknown = mode === 'misa' ? items.filter((x) => !x.m && x.p?.mass.status === 'unavailable') : [];
  const noMassToday = mode === 'misa' ? items.filter((x) => x.m && !x.slots.length) : [];
  const selected = items.find((x) => x.id === sel);
  const soonCount = upcoming.filter((u) => minsTo(u.s, now) <= SOON).length;
  const what = mode === 'misa' ? (n: number) => (n === 1 ? '1 misa' : `${n} misas`) : (n: number) => (n === 1 ? '1 rato de adoración' : `${n} ratos de adoración`);
  const otherDay = !!day && day !== today() && day !== addDays(today(), 1);
  const heading = mode === 'perpetua' ? 'Adoración perpetua' : day ? `${mode === 'misa' ? 'Misas' : 'Adoración'} del ${longDate(day)}` : mode === 'misa' ? 'Próximas misas' : 'Adoración hoy y mañana';

  return <Page title="Radar de misas" back="/" subtitle="Misas y adoración del Santísimo a tu alrededor">
    <div role="tablist" aria-label="Qué buscar" className="no-bar -mx-5 mb-2 flex gap-2 overflow-x-auto px-5">
      {MODES.map((m) => <Chip key={m.id} role="tab" aria-selected={mode === m.id} active={mode === m.id} onClick={() => changeMode(m.id)}>{m.label}</Chip>)}
    </div>
    {mode !== 'perpetua' && <div className="no-bar -mx-5 mb-2 flex items-center gap-2 overflow-x-auto px-5">
      <Chip active={!day} onClick={() => setDay('')}>Hoy y mañana</Chip>
      <label className={`press relative flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-medium transition-colors duration-200 focus-within:ring-4 focus-within:ring-pop-soft ${day ? 'border-ink bg-ink text-paper' : 'border-line bg-paper text-ink-2 hover:border-muted/50'}`}>
        <Icon name="calendar" size={16} />{day ? longDate(day).replace(/^./, (c) => c.toUpperCase()) : 'Otro día'}
        <input type="date" aria-label="Elegir día" min={today()} max={addDays(today(), 60)} value={day} onChange={(e) => setDay(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
    </div>}
    <RadarView origin={origin} items={items} radius={radius} now={now} selected={sel} onSelect={(id) => setSel(id === sel ? null : id)} scanning={!!busy} mode={mode} />
    {!origin && !busy && <div className="mt-4 text-center">
      <Button onClick={locate} className="w-full"><Icon name="target" size={18} />Activar el radar</Button>
      <p className="mt-2 text-[13px] text-muted">Solo usamos tu ubicación al pulsar el botón y no la guardamos.</p>
    </div>}
    <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void search(); }}>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="O busca una localidad" aria-label="Localidad o código postal" />
      <Button kind="ghost" aria-label="Buscar"><Icon name="search" size={18} /></Button>
      {origin && <Button type="button" kind="ghost" aria-label="Usar mi ubicación" onClick={locate}><Icon name="target" size={18} /></Button>}
    </form>
    {options.length > 0 && <ul className="list sheet mt-2">{options.map((o) => <li key={`${o.lat},${o.lon}`}><button className="hoverable w-full px-4 py-3 text-left text-[14.5px]" onClick={() => { setOrigin(o); setOptions([]); }}>{o.name}</button></li>)}</ul>}
    {err && <div className="mt-3"><Notice tone="warn">{err}</Notice></div>}
    {busy && <Spinner label={busy} />}

    {origin && list && !busy && <>
      <div className="no-bar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">{RADII[mode].map((r) => <Chip key={r} active={radius === r} onClick={() => setRadius(r)}>{r} km</Chip>)}</div>
      <p className="mt-4 text-[14.5px] leading-snug text-muted">{items.length} {items.length === 1 ? 'templo' : 'templos'} a menos de {radius} km{origin.name !== 'Tu ubicación' ? ` de ${origin.name.split(',')[0]}` : ''}. {mode !== 'perpetua' && soonCount ? <b className="font-semibold text-ink">{what(soonCount)} ahora o en las próximas 2 horas.</b> : ''}</p>

      {selected && (selected.m ? <MisasCard it={selected} now={now} mode={mode} onClose={() => setSel(null)} /> : selected.p && <PlaceCard place={selected.p} distance={selected.d} onClose={() => setSel(null)} />)}
      {misas === null && !__PREVIEW__ && mode === 'misa' && <div className="mt-3"><Notice tone="warn">Ahora mismo no se pueden consultar los horarios de misas.org. Mostramos los que tenemos de otras fuentes.</Notice></div>}

      <h2 className="mt-8 text-[1.3rem] font-semibold leading-tight tracking-[-.015em]">{heading}</h2>
      {upcoming.length ? <ul className="mt-3 overflow-hidden rounded-2xl border border-line">{(showAll ? upcoming : upcoming.slice(0, 8)).map(({ it, s }) => {
        const open = isOpen(s, now), soon = minsTo(s, now) <= SOON;
        const big = s.perpetual ? '24 h' : s.end ? `${hhmm(s.minutes)}` : hhmm(s.minutes);
        const until = otherDay ? '' : untilLabel(s.at, now);
        const small = s.perpetual ? 'Día y noche' : open ? `Ahora, hasta las ${hhmm(s.end!.getHours() * 60 + s.end!.getMinutes())}` : s.end ? `${until ? `${until}, h` : 'H'}asta las ${hhmm(s.end.getHours() * 60 + s.end.getMinutes())}` : until;
        return <li key={`${it.id}-${s.at.getTime()}`} className="border-b border-line last:border-0"><button onClick={() => setSel(it.id)} aria-pressed={sel === it.id} className={`press flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors ${sel === it.id ? 'bg-surface' : 'hoverable'}`}>
          <span className="w-[5.4rem] shrink-0"><span className={`tabular block text-[1.6rem] font-semibold leading-none tracking-[-.03em] ${soon ? 'text-gold' : ''}`}>{big}</span><span className={`mt-1 block text-[12px] font-medium leading-tight ${soon ? 'text-gold' : 'text-muted'}`}>{small}</span></span>
          <span className="min-w-0 flex-1"><span className="block text-[15px] font-medium leading-snug">{it.name}</span><span className="mt-0.5 block text-[13px] text-muted">{fmtKm(it.d)}. {ador ? `${s.label}${s.note ? ` (${s.note})` : ''}. misas.org` : sourceLabel(it)}</span></span>
          <Icon name="chevron" size={16} className="text-muted/70" /></button></li>;
      })}</ul> : <p className="mt-2 text-[15px] leading-snug text-muted">{mode === 'misa' ? 'No conocemos el horario de ningún templo de esta zona. Abre uno de la lista para llamar, ver su web o enviarnos su horario.' : mode === 'adoracion' ? 'misas.org no tiene adoración del Santísimo hoy ni mañana en esta zona. Prueba con más distancia.' : 'misas.org no tiene ninguna capilla de adoración perpetua en esta zona. Prueba con 25 km.'}</p>}
      {upcoming.length > 8 && !showAll && <button className="mt-2 min-h-11 text-[14.5px] font-medium text-gold" onClick={() => setShowAll(true)}>Ver todo ({upcoming.length})</button>}

      {withText.length > 0 && <><h2 className="mt-10 text-[1.05rem] font-semibold leading-tight">Con horario por revisar</h2><p className="mt-1 text-[13.5px] text-muted">Tienen un horario escrito que no sabemos leer con seguridad. Ábrelos para verlo.</p>
        <ul className="mt-1">{withText.map((x) => <PlaceRow key={x.id} it={x} onClick={() => setSel(x.id)} />)}</ul></>}
      {unknown.length > 0 && <><h2 className="mt-10 text-[1.05rem] font-semibold leading-tight">Sin horario todavía</h2><p className="mt-1 text-[13.5px] text-muted">Ábrelos para llamar, ver su web o enviarnos el horario si lo conoces. También puedes buscarlos en <a href={MISAS_ORG} target="_blank" rel="noopener" className="font-medium text-gold underline">misas.org</a>.</p>
        <ul className="mt-1">{unknown.map((x) => <PlaceRow key={x.id} it={x} onClick={() => setSel(x.id)} />)}</ul></>}
      {noMassToday.length > 0 && <><h2 className="mt-10 text-[1.05rem] font-semibold leading-tight">{day ? 'Sin misa ese día' : 'Sin misa hoy ni mañana'}</h2><p className="text-sm text-muted">{day ? 'Según misas.org, estos templos no tienen misa ese día.' : 'Según misas.org, estos templos no tienen misa en los próximos dos días.'}</p>
        <ul className="mt-1">{noMassToday.map((x) => <PlaceRow key={x.id} it={x} onClick={() => setSel(x.id)} />)}</ul></>}
      <p className="mt-10 border-t border-line pt-4 text-xs leading-relaxed text-muted">Horarios de <a href="https://misas.org" target="_blank" rel="noopener" className="underline">misas.org</a>, de la Asociación Eucharistia.{mode === 'misa' ? ' Donde no los tiene, salen de OpenStreetMap (sin confirmar) o los ha comprobado nuestro equipo (confirmados).' : ' Algunos ratos de adoración cambian en verano o en invierno: lo indica entre paréntesis.'} No mostramos horarios inventados. Si es importante, confírmalo con la parroquia. <Link to="/descubrir/templos" className="underline">Ver los templos en el mapa</Link></p>
    </>}
  </Page>;
}

const PlaceRow = ({ it, onClick }: { it: Item; onClick: () => void }) => <li><button onClick={onClick} className="hoverable -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg border-b border-line px-2 py-3 text-left">
  <span className="min-w-0 flex-1"><span className="block text-[15px] font-medium leading-snug">{it.name}</span><span className="text-[13px] text-muted">{fmtKm(it.d)}{it.p?.phone ? '. Tiene teléfono' : ''}{it.p?.website ? '. Tiene web' : ''}</span></span>
  <Icon name="chevron" size={16} className="text-muted/70" /></button></li>;

function RadarView({ origin, items, radius, now, selected, onSelect, scanning, mode }: { origin: Geo | null; items: Item[]; radius: number; now: Date; selected: string | null; onSelect: (id: string) => void; scanning: boolean; mode: Mode }) {
  const R = 150, C = 160;
  return <div className="relative mx-auto mt-1 aspect-square w-full max-w-[22rem]">
    <svg viewBox="0 0 320 320" className="absolute inset-0 size-full" role="img" aria-label={origin ? `Radar con ${items.length} templos a menos de ${radius} km` : 'Radar apagado'}>
      <defs><radialGradient id="rg"><stop offset="0" stopColor="var(--radar-glow)" stopOpacity=".07" /><stop offset=".85" stopColor="var(--paper)" stopOpacity="1" /></radialGradient></defs>
      <circle cx={C} cy={C} r={R} fill="url(#rg)" stroke="var(--line)" />
      {[1, 2, 3].map((k) => <circle key={k} cx={C} cy={C} r={(R * k) / 3} fill="none" stroke="var(--line)" strokeWidth="1" />)}
      <path d={`M${C} ${C - R}V${C + R}M${C - R} ${C}H${C + R}`} stroke="var(--line)" strokeWidth="1" strokeDasharray="2 4" />
      <text x={C} y={C - R + 14} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--muted)">N</text>
      {origin && [1, 2, 3].map((k) => <text key={k} x={C + 4} y={C - (R * k) / 3 - 3} fontSize="9.5" fill="var(--muted)">{fmtKm((radius * k) / 3)}</text>)}
    </svg>
    {(scanning || origin) && <div aria-hidden="true" className="radar-sweep absolute inset-[3.1%] rounded-full" />}
    <svg viewBox="0 0 320 320" className="absolute inset-0 size-full">
      {origin && items.map((it) => {
        const a = bearing(origin, it), r = Math.min(1, it.d / radius) * (R - 8);
        const x = C + Math.sin(a) * r, y = C - Math.cos(a) * r;
        const first = it.slots[0], mins = first ? Math.min(...it.slots.map((s) => minsTo(s, now))) : Infinity;
        const tone = mins <= SOON ? 'soon' : it.slots.length ? 'known' : 'none';
        const on = selected === it.id;
        const desc = !first ? ', sin horario' : first.perpetual ? ', adoración perpetua' : isOpen(first, now) ? ', adoración ahora' : `, próxima ${mode === 'misa' ? 'misa' : 'adoración'} a las ${hhmm(first.minutes)}`;
        return <g key={it.id} role="button" tabIndex={0} aria-label={`${it.name}, a ${fmtKm(it.d)}${desc}`} onClick={() => onSelect(it.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(it.id); }} className="cursor-pointer outline-none">
          <circle cx={x} cy={y} r="14" fill="transparent" />
          {tone === 'soon' && <circle cx={x} cy={y} r="7" fill="var(--pop)" className="radar-ping" />}
          <circle cx={x} cy={y} r={on ? 8.5 : tone === 'none' ? 4.5 : 6.5} fill={tone === 'soon' ? 'var(--pop)' : tone === 'known' ? 'var(--sun)' : 'var(--paper)'} stroke={tone === 'none' ? 'var(--muted)' : on ? 'var(--ink)' : 'var(--pop)'} strokeWidth={on ? 3 : 1.6} />
        </g>;
      })}
      <circle cx={C} cy={C} r="7" fill="var(--ink)" stroke="var(--paper)" strokeWidth="3" pointerEvents="none" />
    </svg>
    {origin && <div className="absolute -bottom-1 left-0 right-0 flex justify-center gap-3 text-xs text-muted">
      <span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-full bg-pop" />{mode === 'misa' ? 'En 2 horas' : mode === 'perpetua' ? 'Adoración perpetua' : 'Ahora o en 2 h'}</span>
      {mode !== 'perpetua' && <span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-full border border-pop bg-sun" />Más tarde</span>}
      {mode === 'misa' && <span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-full border border-muted bg-paper" />Sin horario</span>}
    </div>}
  </div>;
}

function MisasCard({ it, now, mode, onClose }: { it: Item; now: Date; mode: Mode; onClose: () => void }) {
  const m = it.m!, p = it.p;
  const dayName = (day: string) => { const t = new Date(now.getTime() + 86_400_000); return dayDate(day).toDateString() === now.toDateString() ? 'Hoy' : dayDate(day).toDateString() === t.toDateString() ? 'Mañana' : longDate(day).replace(/^./, (c) => c.toUpperCase()); };
  const past = (day: string, t: string) => dayDate(day, t).getTime() < now.getTime() - 5 * 60000;
  const masses = Object.entries(m.masses), adorations = Object.entries(m.adorations);
  return <article className="sheet mt-4 rounded-2xl border border-line bg-paper p-5 shadow-[var(--shadow-float)]" aria-label={m.name}>
    <div className="flex items-start justify-between gap-3">
      <div><h3 className="text-[1.25rem] font-semibold leading-tight tracking-[-.015em]">{m.name}</h3><p className="mt-1 text-[13.5px] text-muted">{[m.address, m.town].filter(Boolean).join(', ')}. A {fmtKm(it.d)}.</p></div>
      <button onClick={onClose} aria-label="Cerrar" className="press hoverable -mr-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-full"><Icon name="close" size={20} /></button>
    </div>
    {mode === 'misa' ? (masses.length ? masses.map(([day, times]) => <div key={day} className="mt-4"><p className="text-[13px] font-medium text-muted">{dayName(day)}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">{times.map((t) => <span key={t} className={`tabular rounded-lg px-2.5 py-1 text-[15px] font-semibold ${past(day, t) ? 'bg-surface text-muted line-through' : 'bg-pop-soft text-gold'}`}>{t}</span>)}</div></div>)
      : <p className="mt-4 text-[15px]">Según misas.org no hay misa en esos días.</p>)
      : adorations.some(([, l]) => l.some((a) => a.type === 'perpetua')) ? <p className="mt-4 rounded-xl bg-surface p-3 text-[14.5px]"><b className="font-semibold">Adoración perpetua.</b> El Santísimo está expuesto día y noche. Conviene confirmar el horario de acceso a la capilla.</p>
      : adorations.map(([day, list]) => <div key={day} className="mt-4"><p className="text-[13px] font-medium text-muted">{dayName(day)}</p>
        <ul className="mt-1.5 space-y-1.5">{list.map((a) => <li key={a.begin + a.end + a.note} className={`rounded-xl px-3 py-2 text-[14.5px] ${past(day, a.end === '00:00' ? '23:59' : a.end) ? 'bg-surface text-muted line-through' : 'bg-pop-soft'}`}><b className="tabular font-semibold">{a.begin}–{a.end}</b> {ADOR_LABEL[a.type]}{a.note ? `, ${a.note}` : ''}</li>)}</ul></div>)}
    {mode === 'misa' && <ParishButton church={m} />}
    <div className="mt-5 flex flex-wrap gap-2">
      <a href={`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lon}`} target="_blank" rel="noopener"><Button><Icon name="route" size={18} />Cómo llegar</Button></a>
      {p?.phone && <a href={`tel:${p.phone.replace(/\s/g, '')}`}><Button kind="ghost"><Icon name="phone" size={18} />Llamar</Button></a>}
      <a href={m.url} target="_blank" rel="noopener"><Button kind="ghost"><Icon name="globe" size={18} />Ver en misas.org</Button></a>
    </div>
    <p className="mt-4 border-t border-line pt-3 text-xs text-muted">Horario de misas.org. Puede cambiar en fiestas o en verano: si es importante, confírmalo con la parroquia.</p>
  </article>;
}
