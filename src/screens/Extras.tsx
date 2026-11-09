import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Icon, Input, Link, Notice, Page } from '../components/ui.tsx';
import { useCached } from '../lib/app.ts';
import { getState, setState, useStore, type MyParish } from '../lib/store.ts';
import { countdowns, findSaints, nextDateOf } from '../lib/extras.ts';
import { diffDays, longDate, today } from '../lib/dates.ts';
import { litDay } from '../lib/calendar.ts';
import { POPE_PRAYER_URL, intentionFor } from '../data/popeIntentions.ts';
import { findBio } from '../data/saints.ts';
import type { MisasChurch, MisasResult } from '../../server/misas.ts';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const mdLabel = (md: string) => `${+md.slice(3)} de ${MONTHS[+md.slice(0, 2) - 1]}`;
const hm = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

// ---------- Mi parroquia ----------
export const parishFrom = (m: MisasChurch): MyParish => ({ id: m.id, name: m.name, town: m.town, lat: m.lat, lon: m.lon, url: m.url.replace(/\/\d{4}-\d{2}-\d{2}$/, '') });
export function ParishButton({ church }: { church: MisasChurch }) {
  const mine = useStore((s) => s.parish?.id === church.id);
  return <button onClick={() => setState({ parish: mine ? null : parishFrom(church) })} aria-pressed={mine}
    className={`press mt-3 flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] font-bold transition-colors ${mine ? 'bg-sun text-ink' : 'bg-paper text-gold'}`}>
    <Icon name={mine ? 'check' : 'church'} size={17} />{mine ? 'Es tu parroquia' : 'Fijar como mi parroquia'}
  </button>;
}

/** Tarjeta de Inicio con las próximas misas y la adoración de tu parroquia. */
export function MyParishCard() {
  const p = useStore((s) => s.parish);
  const q = `lat=${p?.lat.toFixed(5)}&lon=${p?.lon.toFixed(5)}&radius=500`;
  const masses = useCached<MisasResult>(p ? `parroquia.m.${p.id}.${today()}` : null, p ? `/api/misas?${q}` : null);
  const ador = useCached<MisasResult>(p ? `parroquia.a.${p.id}.${today()}` : null, p ? `/api/misas?kind=adorations&${q}` : null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);
  if (!p) return <Link to="/descubrir/misas" className="press mt-10 flex items-center gap-3 rounded-[22px] border-2 border-dashed border-sand p-4">
    <span className="niche !bg-surface"><Icon name="church" size={22} /></span>
    <span className="flex-1"><span className="block font-bold">Elige tu parroquia</span><span className="text-sm text-muted">Búscala en el radar y verás aquí sus misas cada día.</span></span><Icon name="chevron" size={18} className="text-muted" />
  </Link>;
  const m = masses.data?.churches.find((c) => c.id === p.id), a = ador.data?.churches.find((c) => c.id === p.id);
  const times = m ? Object.entries(m.masses).flatMap(([day, ts]) => ts.map((t) => { const [y, mo, d] = day.split('-').map(Number), [h, mi] = t.split(':').map(Number); return new Date(y, mo - 1, d, h, mi); })).filter((d) => d.getTime() > now.getTime() - 5 * 60000).slice(0, 4) : [];
  const adorToday = a ? (a.adorations[today()] ?? []) : [];
  const day = (d: Date) => (d.toDateString() === now.toDateString() ? '' : 'mañana ');
  return <section aria-label="Mi parroquia" className="reveal mt-10 rounded-[26px] bg-surface p-5">
    <p className="flex items-center gap-1.5 text-sm font-bold text-gold"><Icon name="church" size={16} />Mi parroquia</p>
    <h2 className="mt-1 text-[1.4rem] leading-[1.1]">{p.name}</h2>
    {masses.loading && !masses.data ? <p className="pulse-soft mt-3 h-10 rounded-full bg-paper" />
      : times.length ? <><p className="mt-3 text-sm text-muted">Próximas misas</p><div className="mt-1.5 flex flex-wrap gap-1.5">{times.map((d, i) => <span key={d.getTime()} className={`rounded-full px-3 py-1.5 text-[15px] font-bold ${i === 0 ? 'bg-pop text-white' : 'bg-paper'}`}>{day(d)}{hm(d)}</span>)}</div></>
      : <p className="mt-3 text-[15px] text-muted">{masses.error ? 'No se han podido cargar los horarios ahora.' : 'Según misas.org no hay más misas hoy ni mañana.'}</p>}
    {adorToday.length > 0 && <p className="mt-3 text-[15px]"><b>Adoración hoy:</b> {adorToday.map((x) => x.type === 'perpetua' ? 'perpetua, día y noche' : `${x.begin}–${x.end}${x.note ? ` (${x.note})` : ''}`).join(', ')}</p>}
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[15px] font-bold">
      <a href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`} target="_blank" rel="noopener" className="flex min-h-10 items-center gap-1 text-gold"><Icon name="route" size={16} />Cómo llegar</a>
      <a href={`${p.url}/${today()}`} target="_blank" rel="noopener" className="flex min-h-10 items-center gap-1 text-gold"><Icon name="globe" size={16} />misas.org</a>
      <Link to="/descubrir/misas" className="flex min-h-10 items-center gap-1 text-muted">Cambiar</Link>
    </div>
  </section>;
}

// ---------- Cuenta atrás ----------
export function CountdownStrip() {
  const saint = useStore((s) => s.mySaint);
  const list = useMemo(() => countdowns(today(), saint).slice(0, 5), [saint]);
  return <section className="mt-12" aria-label="Cuenta atrás">
    <h2 className="text-[1.6rem] leading-tight">Cuenta atrás</h2>
    <div className="no-bar -mx-5 mt-3 flex snap-x gap-2.5 overflow-x-auto px-5 pb-1">{list.map((c, i) => <div key={c.id} className={`snap-card w-36 shrink-0 snap-start rounded-[22px] p-4 ${i === 0 ? 'c-ink' : 'bg-surface'}`}>
      {c.days === 0 ? <p className="font-serif text-[2rem] leading-none">¡Hoy!</p> : <p className="font-serif text-[2.6rem] leading-none">{c.days}<span className="ml-1 font-sans text-sm font-bold">{c.days === 1 ? 'día' : 'días'}</span></p>}
      <p className="mt-2 font-bold leading-tight">{c.id === 'santo' ? 'Tu santo' : c.label}</p>
      <p className="mt-0.5 text-sm text-muted first-letter:uppercase">{longDate(c.date)}</p>
    </div>)}</div>
  </section>;
}

// ---------- Intención del Papa ----------
export function PopeIntention() {
  const now = new Date(), text = intentionFor(now);
  if (!text) return null;
  return <section className="reveal mt-12 rounded-[26px] bg-surface p-5" aria-label="Intención del Papa">
    <p className="flex items-center gap-1.5 text-sm font-bold text-gold"><Icon name="pray" size={16} />Intención del Papa para {MONTHS[now.getMonth()]}</p>
    <p className="mt-2 font-serif text-[1.3rem] leading-[1.15]">{text}</p>
    <p className="mt-2 text-sm text-muted">Reza este mes con el Papa y con la Iglesia de todo el mundo.</p>
    <a href={POPE_PRAYER_URL} target="_blank" rel="noopener" className="mt-2 inline-flex min-h-10 items-center gap-1 text-[15px] font-bold text-gold">Texto completo y vídeo del Papa<Icon name="chevron" size={15} /></a>
  </section>;
}

// ---------- Tu santo ----------
export function SaintCongrats() {
  const saint = useStore((s) => s.mySaint), name = useStore((s) => s.name);
  if (!saint || saint.date !== today().slice(5)) return null;
  return <Link to="/perfil/santo" className="press pop mt-6 flex items-center gap-3 rounded-[22px] bg-sun p-4 text-ink">
    <span className="text-[2rem]" aria-hidden="true">🎉</span>
    <span><span className="block font-serif text-[1.35rem] leading-tight">¡Feliz santo{name ? `, ${name}` : ''}!</span><span className="text-sm">Hoy es {saint.name}. Pide su intercesión.</span></span>
  </Link>;
}

export function MySaintScreen() {
  const saint = useStore((s) => s.mySaint), userName = useStore((s) => s.name);
  const [q, setQ] = useState(userName), [manual, setManual] = useState(false), [mName, setMName] = useState(''), [mDate, setMDate] = useState('');
  const results = useMemo(() => findSaints(q), [q]);
  const bio = saint ? findBio(saint.name) : undefined;
  const choose = (name: string, date: string) => { setState({ mySaint: { name, date } }); scrollTo({ top: 0, behavior: 'smooth' }); };
  const next = saint ? nextDateOf(saint.date, today()) : null;
  return <Page title="Tu santo" back="/perfil" subtitle="El día de tu santo, tu onomástica">
    {saint && next && <div className="pop rounded-[26px] c-ink p-5">
      <p className="text-sm font-bold">Tu santo</p>
      <p className="mt-1 font-serif text-[1.6rem] leading-[1.1]">{saint.name}</p>
      <p className="mt-1">{mdLabel(saint.date)}. {diffDays(next, today()) === 0 ? '¡Es hoy! Felicidades.' : `Faltan ${diffDays(next, today())} días.`}</p>
      {bio && <p className="mt-3 text-[15px] leading-snug">{bio.bio}</p>}
      <button onClick={() => setState({ mySaint: null })} className="mt-3 min-h-10 text-sm font-bold underline">Quitar</button>
    </div>}
    <h2 className="mt-8 text-[1.3rem]">{saint ? 'Cambiar de santo' : 'Busca tu santo'}</h2>
    <Input className="mt-2" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tu nombre, por ejemplo Santiago" aria-label="Nombre del santo" />
    {q.trim().length >= 3 && (results.length ? <ul className="mt-2">{results.map((r) => <li key={r.date + r.name}><button onClick={() => choose(r.name, r.date)} className="flex min-h-12 w-full items-center gap-3 border-b border-line py-2 text-left">
      <span className="min-w-0 flex-1 font-serif text-[1.05rem] leading-tight">{r.name}</span><span className="shrink-0 text-sm text-muted">{mdLabel(r.date)}</span></button></li>)}</ul>
      : <p className="mt-2 text-[15px] text-muted">No lo encontramos en nuestro santoral. Puedes añadirlo a mano.</p>)}
    {!manual ? <button className="mt-4 min-h-11 text-[15px] font-bold text-gold" onClick={() => setManual(true)}>Añadirlo a mano</button>
      : <form className="mt-4 space-y-2 rounded-[22px] bg-surface p-4" onSubmit={(e) => { e.preventDefault(); if (mName.trim() && mDate) choose(mName.trim(), mDate.slice(5)); }}>
        <Input value={mName} onChange={(e) => setMName(e.target.value)} placeholder="Nombre del santo" aria-label="Nombre del santo a mano" required />
        <Input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} aria-label="Día de su fiesta" required />
        <Button className="w-full">Guardar</Button>
      </form>}
    <p className="mt-6 text-sm text-muted">Se guarda en este dispositivo. El día de tu santo te felicitaremos en Inicio y aparecerá en la cuenta atrás.</p>
  </Page>;
}

// ---------- Diario espiritual ----------
export function JournalScreen() {
  const journal = useStore((s) => s.journal), d = today();
  const [text, setText] = useState(journal[d]?.text ?? ''), [saved, setSaved] = useState(false), [open, setOpen] = useState<string | null>(null), [confirm, setConfirm] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const save = (v: string) => {
    const j = { ...getState().journal };
    if (v.trim()) j[d] = { text: v.slice(0, 20000), updated: new Date().toISOString() }; else delete j[d];
    setState({ journal: j }); setSaved(true);
  };
  const onChange = (v: string) => { setText(v); setSaved(false); clearTimeout(timer.current); timer.current = setTimeout(() => save(v), 700); };
  useEffect(() => () => clearTimeout(timer.current), []);
  const past = Object.entries(journal).filter(([k]) => k !== d).sort((a, b) => b[0].localeCompare(a[0]));
  const remove = (k: string) => { const j = { ...getState().journal }; delete j[k]; setState({ journal: j }); setConfirm(null); setOpen(null); };
  const download = () => {
    const all = Object.entries(getState().journal).sort((a, b) => a[0].localeCompare(b[0])).map(([k, e]) => `${longDate(k)}\n\n${e.text}\n`).join('\n——————\n\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([`Mi diario espiritual (Zarzu)\n\n${all}`], { type: 'text/plain;charset=utf-8' })); a.download = `diario-zarzu-${d}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return <Page title="Mi diario" back="/perfil" subtitle="Solo lo ves tú">
    <p className="text-sm font-bold text-gold first-letter:uppercase">{longDate(d)}. {litDay(d).title}</p>
    <label className="mt-2 block font-serif text-[1.35rem] leading-tight" htmlFor="diario">¿Qué te ha dicho Dios hoy?</label>
    <p className="text-sm text-muted">Una frase del Evangelio, algo que agradeces, alguien por quien rezar…</p>
    <textarea id="diario" value={text} onChange={(e) => onChange(e.target.value)} onBlur={() => save(text)} rows={8} placeholder="Escribe aquí…" className="reading mt-3 w-full resize-y rounded-[22px] border border-line bg-surface p-4 text-ink outline-none focus:border-gold" />
    <p className="mt-1 h-5 text-sm text-muted" aria-live="polite">{saved ? 'Guardado en este dispositivo' : ''}</p>
    <Link to="/liturgia" className="inline-flex min-h-10 items-center gap-1 text-[15px] font-bold text-gold"><Icon name="book" size={16} />Leer el Evangelio de hoy</Link>

    {past.length > 0 && <section className="mt-10"><h2 className="text-[1.4rem]">Días anteriores</h2>
      <ul className="mt-2">{past.map(([k, e]) => <li key={k} className="border-b border-line">
        <button onClick={() => setOpen(open === k ? null : k)} aria-expanded={open === k} className="flex w-full items-center gap-3 py-3 text-left">
          <span className="min-w-0 flex-1"><span className="block text-sm font-bold first-letter:uppercase">{longDate(k)}</span><span className="block truncate text-[15px] text-muted">{e.text}</span></span>
          <Icon name="chevron" size={18} className={`text-muted transition-transform ${open === k ? 'rotate-90' : ''}`} /></button>
        {open === k && <div className="sheet pb-4"><p className="reading whitespace-pre-line">{e.text}</p>
          {confirm === k ? <div className="mt-3 flex gap-2"><Button kind="ghost" onClick={() => setConfirm(null)}>Cancelar</Button><button onClick={() => remove(k)} className="press min-h-11 rounded-full bg-danger px-5 font-bold text-white">Borrar para siempre</button></div>
            : <button onClick={() => setConfirm(k)} className="mt-2 min-h-10 text-sm font-bold text-danger">Borrar esta entrada</button>}
        </div>}
      </li>)}</ul></section>}

    <div className="mt-8"><Notice><b>Tu diario no sale de este dispositivo:</b> no se sube a ningún servidor ni se sincroniza con tu cuenta. Si borras los datos de la app o cambias de móvil, se pierde. Descárgalo para guardar una copia.</Notice></div>
    {Object.keys(journal).length > 0 && <Button kind="ghost" className="mt-3 w-full" onClick={download}><Icon name="download" size={18} />Descargar mi diario</Button>}
  </Page>;
}
