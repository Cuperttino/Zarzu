import { useEffect, useMemo, useState } from 'react';
import { Button, Chip, FavoriteButton, Icon, Input, Link, Notice, Page, Spinner } from '../components/ui.tsx';
import { MapView } from '../components/MapView.tsx';
import { ApiError, api, directionsUrl, fmtKm, km } from '../lib/app.ts';
import { authAvailable, config, getSession, rest } from '../lib/supabase.ts';
import { parseSchedule, weeklyRows } from '../lib/massTimes.ts';
import { saveProfile, useStore } from '../lib/store.ts';
import { overpassQuery, toPlace, type Place, type PlaceKind, type ScheduleInfo } from '../../server/places.ts';
import { fullDate } from '../lib/dates.ts';

const KIND: Record<PlaceKind, string> = { catedral: 'Catedral', basilica: 'Basílica', santuario: 'Santuario', monasterio: 'Monasterio', convento: 'Convento', parroquia: 'Parroquia', ermita: 'Ermita o capilla', iglesia: 'Iglesia' };
type Geo = { lat: number; lon: number; name: string };
const RADII = [2, 5, 10, 20];
const PREVIEW_MAP = 'La vista previa no puede consultar los mapas desde aquí. Funcionará en la app publicada.';

export async function geocode(q: string): Promise<Geo[]> {
  try { return (await api<{ results: { name: string; lat: number; lon: number }[] }>(`/api/geocode?q=${encodeURIComponent(q)}`)).results; }
  catch (e) {
    if ((e as ApiError).code !== 'preview') throw e;
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=es&q=${encodeURIComponent(q)}`).catch(() => { throw new Error(PREVIEW_MAP); });
    return ((await r.json()) as { display_name: string; lat: string; lon: string }[]).map((x) => ({ name: x.display_name, lat: +x.lat, lon: +x.lon }));
  }
}
export async function places(lat: number, lon: number, radiusKm: number): Promise<Place[]> {
  try { return (await api<{ places: Place[] }>(`/api/places?lat=${lat}&lon=${lon}&radius=${radiusKm * 1000}`)).places; }
  catch (e) {
    if ((e as ApiError).code !== 'preview' && (e as ApiError).code !== 'overpass_unavailable') throw e;
    // Si el servidor no llega al mapa, se prueba desde el propio dispositivo.
    const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: overpassQuery(lat, lon, radiusKm * 1000) }) }).catch(() => { throw new Error(PREVIEW_MAP); });
    if (!r.ok) throw new Error('El servicio de mapas no responde.');
    return ((await r.json()).elements as Parameters<typeof toPlace>[0][]).map(toPlace).filter((p): p is Place => !!p);
  }
}

export function TemplesScreen() {
  const fav = useStore((s) => s.place);
  const [origin, setOrigin] = useState<Geo | null>(fav ? { ...fav } : null), [me, setMe] = useState<{ lat: number; lon: number } | null>(null);
  const [radius, setRadius] = useState(5), [kind, setKind] = useState<PlaceKind | ''>(''), [q, setQ] = useState('');
  const [list, setList] = useState<Place[] | null>(null), [busy, setBusy] = useState(''), [err, setErr] = useState(''), [sel, setSel] = useState<string | null>(null), [options, setOptions] = useState<Geo[]>([]);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (!origin) return;
    let live = true; setBusy('Buscando templos…'); setErr('');
    places(+origin.lat.toFixed(4), +origin.lon.toFixed(4), radius).then((p) => { if (live) { setList(p); setSel(null); } }).catch((e: Error) => { if (live) { setErr(e.message); setList(null); } }).finally(() => live && setBusy(''));
    return () => { live = false; };
  }, [origin?.lat, origin?.lon, radius]); // eslint-disable-line

  const locate = () => {
    if (!navigator.geolocation) { setErr('Este navegador no permite obtener tu ubicación. Busca por localidad o código postal.'); return; }
    setBusy('Obteniendo tu ubicación…'); setErr('');
    navigator.geolocation.getCurrentPosition((p) => { const o = { lat: p.coords.latitude, lon: p.coords.longitude, name: 'Tu ubicación' }; setMe(o); setOrigin(o); setMapCenter(null); setBusy(''); },
      (e) => { setBusy(''); setErr(e.code === 1 ? 'Has rechazado el permiso de ubicación. Puedes buscar por localidad o código postal.' : 'No se ha podido obtener tu ubicación. Busca por localidad o código postal.'); }, { enableHighAccuracy: true, timeout: 12000 });
  };
  const search = async () => {
    if (q.trim().length < 2) return;
    setBusy('Buscando la localidad…'); setErr(''); setOptions([]);
    try {
      const r = await geocode(/^\d{5}$/.test(q.trim()) ? `${q.trim()}, España` : q.trim());
      if (!r.length) setErr(`No hemos encontrado «${q}». Prueba con otro nombre o un código postal.`);
      else if (r.length === 1) setOrigin(r[0]); else setOptions(r);
    } catch (e) { setErr((e as Error).message); }
    setBusy('');
  };
  const sorted = useMemo(() => (list ?? []).filter((p) => !kind || p.kind === kind).map((p) => ({ p, d: origin ? km(origin, p) : 0 })).filter((x) => x.d <= radius + 0.01).sort((a, b) => a.d - b.d), [list, kind, origin, radius]);
  const kinds = useMemo(() => [...new Set((list ?? []).map((p) => p.kind))], [list]);
  const selected = sorted.find((x) => x.p.id === sel);

  return <Page title="Templos cerca de ti" back="/descubrir">
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void search(); }}>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Localidad o C.P." aria-label="Localidad o código postal" />
      <Button kind="ghost" aria-label="Buscar"><Icon name="search" size={18} /></Button>
      <Button type="button" kind="primary" aria-label="Usar mi ubicación" title="Usar mi ubicación" onClick={locate}><Icon name="target" size={18} /></Button>
    </form>
    {options.length > 0 && <ul className="mt-2 overflow-hidden rounded-xl border border-line bg-surface">{options.map((o) => <li key={`${o.lat},${o.lon}`}><button className="w-full border-b border-line p-3 text-left text-sm last:border-0 hover:bg-sand" onClick={() => { setOrigin(o); setOptions([]); setMapCenter(null); }}>{o.name}</button></li>)}</ul>}
    {err && <div className="mt-3"><Notice tone="warn">{err}</Notice></div>}
    {busy && <Spinner label={busy} />}
    {!origin && !busy && !err && <div className="mt-4"><h2 className="text-[1.84rem] leading-[1.02]">Encuentra dónde ir a misa o rezar</h2><p className="mt-2 text-[15px] leading-snug text-muted">Solo pedimos tu ubicación si pulsas el botón, y no la guardamos. También puedes buscar por localidad o código postal.</p><Button className="mt-4" onClick={locate}><Icon name="target" size={18} />Usar mi ubicación</Button></div>}
    {origin && <>
      <div className="no-bar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">{RADII.map((r) => <Chip key={r} active={radius === r} onClick={() => setRadius(r)}>{r} km</Chip>)}</div>
      {kinds.length > 1 && <div className="no-bar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5"><Chip active={!kind} onClick={() => setKind('')}>Todos</Chip>{kinds.map((k) => <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{KIND[k]}</Chip>)}</div>}
      <div className="mt-3 h-[42dvh] min-h-64 overflow-hidden rounded-[22px]"><MapView tileUrl={config().tileUrl} center={mapCenter ?? origin} zoom={radius <= 2 ? 14.5 : radius <= 5 ? 13 : radius <= 10 ? 12 : 11} me={me} selected={sel} onSelect={setSel} markers={sorted.map(({ p }) => ({ id: p.id, lat: p.lat, lon: p.lon, label: p.name }))} /></div>
      <div className="mt-3 flex items-center justify-between gap-2 text-sm text-muted"><span className="min-w-0 truncate">{list ? `${sorted.length} ${sorted.length === 1 ? 'templo' : 'templos'} ${origin.name === 'Tu ubicación' ? 'cerca de ti' : `cerca de ${origin.name.split(',')[0]}`}` : ''}</span>
        <button className="shrink-0 text-gold" onClick={() => saveProfile({ place: fav && fav.lat === origin.lat ? null : { name: origin.name.split(',').slice(0, 2).join(','), lat: origin.lat, lon: origin.lon } })}>{fav && fav.lat === origin.lat ? 'Localidad favorita' : 'Guardar localidad'}</button></div>
      {selected && <PlaceCard place={selected.p} distance={selected.d} onClose={() => setSel(null)} />}
      <ul className="mt-2">{sorted.map(({ p, d }) => <li key={p.id}><button onClick={() => { setSel(p.id); setMapCenter({ lat: p.lat, lon: p.lon }); }} className="flex w-full items-start gap-3 border-b border-line py-3 text-left">
        <span className="min-w-0 flex-1"><span className="block font-serif text-[1.08rem] leading-[1.1]">{p.name}</span><span className="text-sm text-muted">{KIND[p.kind]}. {fmtKm(d)}</span>{p.mass.status !== 'unavailable' && <StatusDot s={p.mass} />}</span><Icon name="chevron" size={18} className="mt-1 text-muted" /></button></li>)}</ul>
      {list && !sorted.length && !busy && <p className="mt-4 text-sm text-muted">Ningún templo con estos filtros. Prueba a aumentar la distancia.</p>}
      <p className="mt-6 text-xs leading-relaxed text-muted">Datos de OpenStreetMap, un mapa colaborativo: puede faltar algún templo o algún dato estar desactualizado.</p>
    </>}
  </Page>;
}
const StatusDot = ({ s }: { s: ScheduleInfo }) => <span className={`mt-0.5 block text-xs ${s.status === 'verified' ? 'text-ok' : 'text-warn'}`}>{s.status === 'verified' ? 'Horario de misas confirmado' : 'Horario de misas sin confirmar'}</span>;

function Schedule({ title, s, website, name }: { title: string; s: ScheduleInfo; website: string | null; name: string }) {
  return <div className="border-t border-line py-3">
    <h4 className="font-sans text-sm font-medium">{title}</h4>
    {s.status === 'unavailable' ? <p className="mt-1 text-sm text-muted">No disponible. No mostramos horarios sin una fuente. {website ? <a className="text-gold underline" target="_blank" rel="noreferrer" href={website}>Consultar en su web</a> : <a className="text-gold underline" target="_blank" rel="noreferrer" href={`https://www.google.com/search?q=${encodeURIComponent(`${name} horario de misas`)}`}>Buscar en la web</a>}</p>
      : <>
        <p className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${s.status === 'verified' ? 'bg-ok/15 text-ok' : 'bg-warn/15 text-warn'}`}>{s.status === 'verified' ? 'Confirmado' : 'Sin confirmar'}</p>
        <WeekTable text={s.text} />
        <p className="mt-1 text-xs text-muted">{s.status === 'verified' ? 'Fuente' : 'Dato colaborativo de'}: {s.sourceUrl ? <a className="underline" target="_blank" rel="noreferrer" href={s.sourceUrl}>{s.sourceName ?? 'ver fuente'}</a> : s.sourceName}. {s.checkedOn ? `Comprobado el ${fullDate(s.checkedOn.slice(0, 10))}.` : 'Sin fecha de comprobación.'}{s.status !== 'verified' ? ' Confírmalo antes de ir.' : ''}</p>
      </>}
  </div>;
}
export function PlaceCard({ place: p, distance, onClose }: { place: Place; distance: number; onClose: () => void }) {
  return <article className="sheet mt-3 overflow-hidden rounded-[22px] bg-surface">
    {p.photo && <img src={p.photo} alt={p.name} loading="lazy" className="h-48 w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
    <div className="p-4">
      <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="text-sm text-gold">{KIND[p.kind]}. A {fmtKm(distance)}</p><h3 className="mt-0.5 text-xl leading-snug">{p.name}</h3></div>
        <span className="-mr-2 -mt-2 flex text-muted"><FavoriteButton fav={{ kind: 'place', id: p.id, title: p.name, body: p.address ?? undefined, link: p.osmUrl }} /><button aria-label="Cerrar ficha" className="grid size-11 place-items-center" onClick={onClose}><Icon name="close" size={18} /></button></span></div>
      <p className="mt-1 text-[15px] text-muted">{p.address ?? 'Dirección no disponible'}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={directionsUrl(p.lat, p.lon, p.name)} target="_blank" rel="noreferrer"><Button><Icon name="route" size={18} />Cómo llegar</Button></a>
        {p.phone && <a href={`tel:${p.phone.split(';')[0].replace(/\s/g, '')}`}><Button kind="ghost"><Icon name="phone" size={18} />{p.phone.split(';')[0]}</Button></a>}
        {p.website && <a href={p.website} target="_blank" rel="noreferrer"><Button kind="ghost"><Icon name="globe" size={18} />Web</Button></a>}
      </div>
      <div className="mt-4">
        <Schedule title="Horarios de misas" s={p.mass} website={p.website} name={p.name} />
        <ReportForm place={p} />
        <Schedule title="Confesiones" s={p.confession} website={p.website} name={p.name} />
        <Schedule title="Horario de apertura" s={p.opening} website={p.website} name={p.name} />
      </div>
      <a className="text-xs text-muted underline" target="_blank" rel="noreferrer" href={p.osmUrl}>Ver o corregir en OpenStreetMap</a>
    </div>
  </article>;
}

function WeekTable({ text }: { text: string | null }) {
  const w = parseSchedule(text);
  if (!w) return <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">{text}</p>;
  return <table className="mt-2 w-full text-[15px]"><tbody>{weeklyRows(w).map((r) => <tr key={r.days} className="border-b border-line last:border-0"><th scope="row" className="py-1.5 pr-3 text-left font-normal text-muted">{r.days}</th><td className="py-1.5 text-right font-bold">{r.times}</td></tr>)}</tbody></table>;
}

/** Los horarios que envían los usuarios no se publican hasta que un administrador los comprueba. */
function ReportForm({ place: p }: { place: Place }) {
  const [open, setOpen] = useState(false), [schedule, setSchedule] = useState(''), [src, setSrc] = useState(''), [note, setNote] = useState(''), [state, setState] = useState<'' | 'busy' | 'ok' | string>('');
  if (!open) return <button className="mb-1 min-h-11 text-[15px] font-bold text-gold" onClick={() => setOpen(true)}>{p.mass.status === 'unavailable' ? '¿Conoces el horario de misas? Envíanoslo' : '¿El horario está mal? Envíanos el correcto'}</button>;
  if (!authAvailable()) return <Notice>Para enviar horarios hace falta que la app tenga cuentas activadas.</Notice>;
  if (!getSession()) return <Notice action={<Link to="/perfil/entrar" className="font-bold text-gold underline">Entrar o crear cuenta</Link>}>Para enviar un horario necesitas una cuenta. Así evitamos horarios falsos.</Notice>;
  if (state === 'ok') return <Notice>Gracias. Lo revisaremos antes de publicarlo.</Notice>;
  return <form className="mb-2 space-y-2 rounded-2xl bg-paper p-3" onSubmit={async (e) => {
    e.preventDefault(); setState('busy');
    try { await rest('mass_reports', { method: 'POST', prefer: 'return=minimal', body: { osm_ref: p.id, church_name: p.name, schedule: schedule.trim(), source_url: src.trim() || null, note: note.trim() || null } }); setState('ok'); }
    catch (x) { setState((x as Error).message); }
  }}>
    <label className="block text-sm font-bold">Horario de misas<textarea required minLength={4} maxLength={600} rows={3} value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder={'Lunes a sábado 19:00\nDomingos 10:00 y 12:00'} className="mt-1 w-full rounded-xl border border-line bg-surface p-3 text-[16px] font-normal text-ink" /></label>
    <Input type="url" value={src} onChange={(e) => setSrc(e.target.value)} placeholder="Enlace donde lo has visto (opcional)" aria-label="Enlace a la fuente" />
    <Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Nota: lo vi en el tablón, en verano cambia…" aria-label="Nota" />
    {state && state !== 'busy' && <Notice tone="error">{state}</Notice>}
    <Button className="w-full" disabled={state === 'busy'}>Enviar para revisar</Button>
  </form>;
}
