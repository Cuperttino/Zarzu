import { useEffect, useMemo, useState } from 'react';
import { Button, Chip, Icon, Input, Link, Notice, Page, Spinner } from '../components/ui.tsx';
import { fmtKm, km } from '../lib/app.ts';
import { useStore } from '../lib/store.ts';
import { hhmm, nextMasses, parseSchedule, untilLabel, type NextMass, type Weekly } from '../lib/massTimes.ts';
import { PlaceCard, geocode, places } from './Temples.tsx';
import type { Place } from '../../server/places.ts';

type Geo = { lat: number; lon: number; name: string };
const RADII = [1, 3, 5, 10];
const SOON = 120;
const MISAS_ORG = 'https://misas.org/buscar/misa'; // minutos: una misa en las próximas 2 horas se marca como «pronto»

const bearing = (a: Geo, b: { lat: number; lon: number }) => {
  const r = Math.PI / 180, y = Math.sin((b.lon - a.lon) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lon - a.lon) * r);
  return Math.atan2(y, x); // 0 = norte, sentido horario
};

interface Item { p: Place; d: number; week: Weekly | null; next: NextMass[] }

function useNow() { const [n, set] = useState(() => new Date()); useEffect(() => { const t = setInterval(() => set(new Date()), 30_000); return () => clearInterval(t); }, []); return n; }

export function RadarScreen() {
  const fav = useStore((s) => s.place);
  const [origin, setOrigin] = useState<Geo | null>(fav ? { ...fav } : null);
  const [radius, setRadius] = useState(3), [list, setList] = useState<Place[] | null>(null), [busy, setBusy] = useState(''), [err, setErr] = useState('');
  const [sel, setSel] = useState<string | null>(null), [q, setQ] = useState(''), [options, setOptions] = useState<Geo[]>([]), [showAll, setShowAll] = useState(false);
  const now = useNow();

  useEffect(() => {
    if (!origin) return;
    let live = true; setBusy('Buscando misas cerca…'); setErr('');
    places(+origin.lat.toFixed(4), +origin.lon.toFixed(4), Math.max(radius, 3)).then((p) => { if (live) setList(p); }).catch((e: Error) => { if (live) { setErr(e.message); setList(null); } }).finally(() => live && setBusy(''));
    return () => { live = false; };
  }, [origin?.lat, origin?.lon, radius]); // eslint-disable-line

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

  const items = useMemo<Item[]>(() => !origin || !list ? [] : list.map((p) => {
    const d = km(origin, p), week = parseSchedule(p.mass.text);
    return { p, d, week, next: week ? nextMasses(week, now) : [] };
  }).filter((x) => x.d <= radius + 0.01).sort((a, b) => a.d - b.d), [list, origin, radius, now]);

  const upcoming = useMemo(() => items.flatMap((it) => it.next.slice(0, 3).map((n) => ({ it, n }))).sort((a, b) => a.n.at.getTime() - b.n.at.getTime()), [items]);
  const withText = items.filter((x) => !x.week && x.p.mass.status !== 'unavailable');
  const unknown = items.filter((x) => x.p.mass.status === 'unavailable');
  const selected = items.find((x) => x.p.id === sel);
  const soonCount = upcoming.filter((u) => (u.n.at.getTime() - now.getTime()) / 60000 <= SOON).length;

  return <Page title="Radar de misas" back="/" subtitle="Las misas que empiezan pronto a tu alrededor">
    <RadarView origin={origin} items={items} radius={radius} now={now} selected={sel} onSelect={(id) => setSel(id === sel ? null : id)} scanning={!!busy} />
    {!origin && !busy && <div className="mt-4 text-center">
      <Button onClick={locate} className="w-full"><Icon name="target" size={18} />Activar el radar</Button>
      <p className="mt-2 text-sm text-muted">Solo usamos tu ubicación al pulsar el botón y no la guardamos.</p>
    </div>}
    <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void search(); }}>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="O busca una localidad" aria-label="Localidad o código postal" />
      <Button kind="ghost" aria-label="Buscar"><Icon name="search" size={18} /></Button>
      {origin && <Button type="button" kind="ghost" aria-label="Usar mi ubicación" onClick={locate}><Icon name="target" size={18} /></Button>}
    </form>
    {options.length > 0 && <ul className="mt-2 overflow-hidden rounded-2xl bg-surface">{options.map((o) => <li key={`${o.lat},${o.lon}`}><button className="w-full border-b border-line p-3 text-left text-sm last:border-0" onClick={() => { setOrigin(o); setOptions([]); }}>{o.name}</button></li>)}</ul>}
    {err && <div className="mt-3"><Notice tone="warn">{err}</Notice></div>}
    {busy && <Spinner label={busy} />}

    {origin && list && <>
      <div className="no-bar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">{RADII.map((r) => <Chip key={r} active={radius === r} onClick={() => setRadius(r)}>{r} km</Chip>)}</div>
      <p className="mt-3 text-[15px] text-muted">{items.length} {items.length === 1 ? 'templo' : 'templos'} a menos de {radius} km{origin.name !== 'Tu ubicación' ? ` de ${origin.name.split(',')[0]}` : ''}. {soonCount ? <b className="text-ink">{soonCount === 1 ? '1 misa en las próximas 2 horas.' : `${soonCount} misas en las próximas 2 horas.`}</b> : ''}</p>

      {selected && <PlaceCard place={selected.p} distance={selected.d} onClose={() => setSel(null)} />}

      <h2 className="mt-7 text-[1.6rem] leading-tight">Próximas misas</h2>
      {upcoming.length ? <ul className="mt-2 space-y-2">{(showAll ? upcoming : upcoming.slice(0, 8)).map(({ it, n }) => {
        const mins = (n.at.getTime() - now.getTime()) / 60000;
        return <li key={`${it.p.id}-${n.at.getTime()}`}><button onClick={() => setSel(it.p.id)} className={`press flex w-full items-center gap-3 rounded-[22px] p-3.5 text-left ${mins <= SOON ? 'c-ink' : 'bg-surface'}`}>
          <span className="w-[5.6rem] shrink-0"><span className="block font-serif text-[1.7rem] leading-none">{hhmm(n.minutes)}</span><span className="mt-1 block text-xs font-bold leading-tight">{untilLabel(n.at, now)}</span></span>
          <span className="min-w-0 flex-1"><span className="block font-serif text-[1.05rem] leading-[1.15]">{it.p.name}</span><span className="mt-0.5 block text-sm text-muted">{fmtKm(it.d)}. {it.p.mass.status === 'verified' ? 'Horario confirmado' : 'Horario sin confirmar'}</span></span>
          <Icon name="chevron" size={18} className="text-muted" /></button></li>;
      })}</ul> : <p className="mt-2 text-[15px] leading-snug text-muted">No conocemos el horario de ningún templo de esta zona. Abre uno de la lista para llamar, ver su web o enviarnos su horario.</p>}
      {upcoming.length > 8 && !showAll && <button className="mt-2 min-h-11 text-[15px] font-bold text-gold" onClick={() => setShowAll(true)}>Ver las {upcoming.length} misas</button>}

      {withText.length > 0 && <><h2 className="mt-7 text-[1.3rem] leading-tight">Con horario por revisar</h2><p className="text-sm text-muted">Tienen un horario escrito que no sabemos leer con seguridad. Ábrelos para verlo.</p>
        <ul className="mt-1">{withText.map((x) => <PlaceRow key={x.p.id} it={x} onClick={() => setSel(x.p.id)} />)}</ul></>}
      {unknown.length > 0 && <><h2 className="mt-7 text-[1.3rem] leading-tight">Sin horario todavía</h2><p className="text-sm text-muted">Ábrelos para llamar, ver su web o enviarnos el horario si lo conoces. También puedes buscarlos en <a href={MISAS_ORG} target="_blank" rel="noopener" className="font-bold text-gold underline">misas.org</a>.</p>
        <ul className="mt-1">{unknown.map((x) => <PlaceRow key={x.p.id} it={x} onClick={() => setSel(x.p.id)} />)}</ul></>}
      <p className="mt-6 text-xs leading-relaxed text-muted">Los horarios salen de OpenStreetMap (sin confirmar) o los ha comprobado nuestro equipo en la web de la parroquia (confirmados). No mostramos horarios inventados. Los días de fiesta entre semana y los cambios de verano pueden variar: si es importante, confírmalo con la parroquia. <Link to="/descubrir/templos" className="underline">Ver los templos en el mapa</Link></p>
    </>}
  </Page>;
}

const PlaceRow = ({ it, onClick }: { it: Item; onClick: () => void }) => <li><button onClick={onClick} className="flex w-full items-center gap-3 border-b border-line py-3 text-left">
  <span className="min-w-0 flex-1"><span className="block font-serif text-[1.02rem] leading-[1.15]">{it.p.name}</span><span className="text-sm text-muted">{fmtKm(it.d)}{it.p.phone ? '. Tiene teléfono' : ''}{it.p.website ? '. Tiene web' : ''}</span></span>
  <Icon name="chevron" size={18} className="text-muted" /></button></li>;

function RadarView({ origin, items, radius, now, selected, onSelect, scanning }: { origin: Geo | null; items: Item[]; radius: number; now: Date; selected: string | null; onSelect: (id: string) => void; scanning: boolean }) {
  const R = 150, C = 160;
  return <div className="relative mx-auto mt-1 aspect-square w-full max-w-[22rem]">
    <svg viewBox="0 0 320 320" className="absolute inset-0 size-full" role="img" aria-label={origin ? `Radar con ${items.length} templos a menos de ${radius} km` : 'Radar apagado'}>
      <defs><radialGradient id="rg"><stop offset="0" stopColor="var(--radar-glow)" stopOpacity=".35" /><stop offset="1" stopColor="var(--surface)" stopOpacity="1" /></radialGradient></defs>
      <circle cx={C} cy={C} r={R} fill="url(#rg)" />
      {[1, 2, 3].map((k) => <circle key={k} cx={C} cy={C} r={(R * k) / 3} fill="none" stroke="var(--sand)" strokeWidth="1.5" />)}
      <path d={`M${C} ${C - R}V${C + R}M${C - R} ${C}H${C + R}`} stroke="var(--sand)" strokeWidth="1" />
      <text x={C} y={C - R + 14} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--muted)">N</text>
      {origin && [1, 2, 3].map((k) => <text key={k} x={C + 4} y={C - (R * k) / 3 - 3} fontSize="9.5" fill="var(--muted)">{fmtKm((radius * k) / 3)}</text>)}
    </svg>
    {(scanning || origin) && <div aria-hidden="true" className="radar-sweep absolute inset-[3.1%] rounded-full" />}
    <svg viewBox="0 0 320 320" className="absolute inset-0 size-full">
      {origin && items.map((it) => {
        const a = bearing(origin, it.p), r = Math.min(1, it.d / radius) * (R - 8);
        const x = C + Math.sin(a) * r, y = C - Math.cos(a) * r;
        const mins = it.next[0] ? (it.next[0].at.getTime() - now.getTime()) / 60000 : Infinity;
        const tone = mins <= SOON ? 'soon' : it.next.length ? 'known' : 'none';
        const on = selected === it.p.id;
        return <g key={it.p.id} role="button" tabIndex={0} aria-label={`${it.p.name}, a ${fmtKm(it.d)}${it.next[0] ? `, próxima misa a las ${hhmm(it.next[0].minutes)}` : ', sin horario'}`} onClick={() => onSelect(it.p.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(it.p.id); }} className="cursor-pointer outline-none">
          <circle cx={x} cy={y} r="14" fill="transparent" />
          {tone === 'soon' && <circle cx={x} cy={y} r="7" fill="var(--pop)" className="radar-ping" />}
          <circle cx={x} cy={y} r={on ? 8.5 : tone === 'none' ? 4.5 : 6.5} fill={tone === 'soon' ? 'var(--pop)' : tone === 'known' ? 'var(--sun)' : 'var(--paper)'} stroke={tone === 'none' ? 'var(--muted)' : on ? 'var(--ink)' : 'var(--pop)'} strokeWidth={on ? 3 : 1.6} />
        </g>;
      })}
      <circle cx={C} cy={C} r="7" fill="var(--ink)" stroke="var(--paper)" strokeWidth="3" />
    </svg>
    {origin && <div className="absolute -bottom-1 left-0 right-0 flex justify-center gap-3 text-xs text-muted">
      <span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-full bg-pop" />En 2 horas</span>
      <span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-full border border-pop bg-sun" />Más tarde</span>
      <span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-full border border-muted bg-paper" />Sin horario</span>
    </div>}
  </div>;
}
