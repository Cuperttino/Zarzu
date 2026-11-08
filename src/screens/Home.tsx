import { useEffect, useState } from 'react';
import { FavoriteButton, Icon, Input, Link, LitDot, Mark, ShareButton, ThemeToggle, Tile, Wordmark } from '../components/ui.tsx';
import { COLOR_LABEL, litDay, upcoming, type LitDay } from '../lib/calendar.ts';
import { longDate, parse, shortDate, today } from '../lib/dates.ts';
import { dailyVerse, getState, logActivity, saveProfile, setState, useStore } from '../lib/store.ts';
import { hash, type Verse } from '../lib/verses.ts';
import { navigate, useCached, usePromise } from '../lib/app.ts';
import { config, rest, authAvailable } from '../lib/supabase.ts';
import { MARTYROLOGY, findBio } from '../data/saints.ts';
import { DAILY_MESSAGES, MORNING_REFLECTIONS, VERSE_REFLECTIONS } from '../data/reflections.ts';
import { mysteriesOfDay, MYSTERIES } from '../data/prayers.ts';
import { GospelTeaser, useGospel } from './Liturgy.tsx';
import { NewsCard, type NewsResult } from './Discover.tsx';
import { streakOf } from './Profile.tsx';

export const greeting = (h = new Date().getHours()) => (h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches');
export const saintOfDay = (d: string, l: LitDay = litDay(d)) => l.saint ?? (MARTYROLOGY[+d.slice(5, 7) - 1]?.[+d.slice(8) - 1] || null);
export const reflectionFor = (v: Verse) => { const list = VERSE_REFLECTIONS[v.theme] ?? VERSE_REFLECTIONS.confianza; return list[hash(v.id) % list.length]; };

function useDaily(d: string) {
  const editorial = usePromise(async () => {
    if (!authAvailable()) return [] as { kind: string; body: string }[];
    return rest<{ kind: string; body: string }[]>(`content_items?select=kind,body&published=is.true&publish_on=eq.${d}`).catch(() => []);
  }, [d, config().supabaseUrl]);
  return {
    msg: editorial.data?.find((x) => x.kind === 'daily_message')?.body ?? DAILY_MESSAGES[hash(`m${d}`) % DAILY_MESSAGES.length],
    morning: editorial.data?.find((x) => x.kind === 'morning_reflection')?.body ?? MORNING_REFLECTIONS[hash(`r${d}`) % MORNING_REFLECTIONS.length],
    ann: editorial.data?.find((x) => x.kind === 'announcement')?.body,
  };
}

export function Home() {
  const d = today(), lit = litDay(d), name = useStore((s) => s.name), activity = useStore((s) => s.activity);
  const verse = usePromise(() => dailyVerse(d), [d]);
  const news = useCached<NewsResult>('news', '/api/news');
  const { msg, morning, ann } = useDaily(d);
  const [stories, setStories] = useState(false);
  const saint = saintOfDay(d, lit), v = verse.data, myst = MYSTERIES[mysteriesOfDay(parse(d).getDay())];
  const streak = streakOf(new Set(activity.map((a) => a.day)));
  const done = activity.some((a) => a.ref === `dia-${d}`);

  return <div className="mx-auto w-full max-w-2xl px-5 pb-28 md:pb-12">
    <section className="soft-hero relative -mx-5 overflow-hidden rounded-b-[36px] px-5 pb-6 md:mt-4 md:rounded-[36px]">
      <Mark className="flicker absolute -right-5 top-20 h-44 w-auto text-flame" />
      <header className="safe-t relative flex min-h-12 items-center justify-between">
        <Wordmark className="md:invisible" />
        <div className="flex items-center gap-2"><ThemeToggle />
        <Link to="/perfil/estadisticas" label={`Racha: ${streak} ${streak === 1 ? 'día' : 'días'}`} className="press flex min-h-10 items-center gap-1 rounded-full bg-paper px-3 font-bold text-ink"><Icon name="flame" size={20} fill={streak > 0} className="text-flame" />{streak}</Link></div>
      </header>
      <div className="relative mt-8">
        <p className="text-[15px] text-muted first-letter:uppercase">{longDate(d)}</p>
        <h1 className="mt-1 max-w-[80%] text-[2.9rem] leading-[1]">{greeting()}{name ? <>,<br />{name}</> : ''}</h1>
        <p className="mt-5 flex items-start gap-2 text-[1.08rem] font-bold leading-[1.2]"><LitDot color={lit.color} className="mt-1 size-3 ring-2 ring-paper" />{lit.title}</p>
        <p className="mt-0.5 pl-5 text-[15px] text-muted">{lit.seasonLabel}. Color {COLOR_LABEL[lit.color].toLowerCase()}.</p>
        {saint && <Link to={`/descubrir/santos/${encodeURIComponent(saint)}`} className="block min-h-8 pl-5 text-[15px] text-muted">Hoy recordamos a {saint}<Icon name="chevron" size={14} className="ml-0.5 inline align-[-2px]" /></Link>}
        <button disabled={!v} onClick={() => setStories(true)} className="press mt-4 flex min-h-14 w-full items-center justify-between rounded-full bg-pop pl-6 pr-2 text-[17px] font-extrabold text-white disabled:opacity-50">{done ? 'Volver a ver tu día' : 'Empieza tu día'}<span className="grid size-10 place-items-center rounded-full bg-paper text-gold"><Icon name={done ? 'check' : 'chevron'} size={19} /></span></button>
      </div>
    </section>

    {ann && <p className="mt-6 rounded-[22px] bg-surface p-4 text-[15px] leading-snug">{ann}</p>}

    <section aria-label="Versículo del día" className="mt-12">
      <div className="flex items-baseline justify-between gap-2"><h2 className="flex items-center gap-1 font-sans text-sm font-bold tracking-normal text-gold"><Icon name="book" size={16} />Versículo de hoy</h2><Link to="/biblia/versiculos" className="text-sm text-muted">Anteriores</Link></div>
      {verse.loading && <p className="pulse-soft mt-3 h-32 rounded-[22px] bg-surface" />}
      {verse.error && <p className="mt-3 text-[15px] text-muted">No se ha podido cargar el versículo. Abre la app con conexión.</p>}
      {v && <>
        <blockquote className="mt-2 font-serif text-[1.88rem] leading-[1.08] tracking-[-.012em]">{v.text}</blockquote>
        <div className="mt-3 flex items-center justify-between"><Link to={`/biblia/${v.book}/${v.c}?v=${v.v}`} className="font-bold">{v.ref}</Link>
          <span className="-mr-2 flex text-muted"><FavoriteButton fav={{ kind: 'verse', id: v.id, title: v.ref, body: v.text, link: `/biblia/${v.book}/${v.c}?v=${v.v}` }} /><ShareButton text={v.text} reference={v.ref} kicker="Versículo de hoy" /></span></div>
        <p className="text-[15px] leading-snug text-muted">{reflectionFor(v)}</p>
      </>}
    </section>

    <div className="mt-10 grid grid-cols-2 gap-2.5">
      <GospelTeaser date={d} />
      <Tile to="/descubrir/misas" icon="target" title="Radar de misas" sub="Las misas que empiezan pronto cerca de ti" className="col-span-2 c-sun" />
      <Tile to="/oracion/rosario" icon="rosary" title="Rosario" sub={myst.name.replace('Misterios ', 'Hoy, ')} className="c-ink" />
      <Tile to="/biblia" icon="book" title="Biblia" sub="Los 73 libros" />
      <Tile to="/oracion" icon="pray" title="Oraciones" sub="Para cada momento" className="col-span-2" />
    </div>

    <section className="mt-12">
      <h2 className="text-[1.6rem] leading-tight">Para empezar hoy</h2>
      <p className="reading mt-2">{morning}</p>
      <p className="mt-4 font-serif text-[1.32rem] leading-[1.14] text-gold">{msg}</p>
    </section>

    <section className="mt-12">
      <div className="mb-3 flex items-baseline justify-between"><h2 className="text-[1.6rem] leading-tight">Noticias de la Iglesia</h2><Link to="/descubrir/noticias" className="shrink-0 pl-2 text-sm text-muted">Ver todas</Link></div>
      {news.stale && <p className="mb-2 text-sm text-warn">Sin conexión: pueden no ser las más recientes.</p>}
      {news.data ? <div className="no-bar -mx-5 flex snap-x gap-2.5 overflow-x-auto px-5 pb-1">{news.data.items.slice(0, 6).map((n) => <div key={n.id} className="snap-card w-[78%] max-w-80 shrink-0 snap-start"><NewsCard item={n} /></div>)}</div>
        : news.loading ? <p className="pulse-soft h-48 rounded-[22px] bg-surface" /> : <p className="text-[15px] text-muted">Las noticias no están disponibles ahora. {news.error}</p>}
    </section>

    <section className="mt-12">
      <div className="mb-1 flex items-baseline justify-between"><h2 className="text-[1.6rem] leading-tight">Lo que viene</h2><Link to="/descubrir/calendario" className="shrink-0 pl-2 text-sm text-muted">Calendario</Link></div>
      <ul>{upcoming(d, 4).map((u) => <li key={u.date}><Link to={`/liturgia/${u.date}`} className="flex items-center gap-3 border-b border-line py-3 last:border-0"><LitDot color={u.color} /><span className="min-w-0 flex-1 font-serif text-[0.98rem] leading-[1.15]">{u.title}</span><time dateTime={u.date} className="shrink-0 text-sm text-muted">{shortDate(u.date)}</time></Link></li>)}</ul>
    </section>

    <p className="mt-14 flex flex-col items-center gap-2 text-center font-serif text-xl text-muted"><Icon name="pray" size={22} />Alabado sea Jesucristo</p>

    {stories && v && <DayStories date={d} verse={v} msg={msg} morning={morning} saint={saint} lit={lit} done={done} onClose={() => setStories(false)} />}
  </div>;
}

/** «Tu día»: pantallas de letra grande. Toca a la derecha para avanzar y a la izquierda para volver. */
function DayStories({ date, verse: v, msg, morning, saint, lit, done, onClose }: { date: string; verse: Verse; msg: string; morning: string; saint: string | null; lit: LitDay; done: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const gospel = useGospel(date);
  const bio = saint ? findBio(saint) : undefined;
  const finalStreak = streakOf(new Set([date, ...getState().activity.map((a) => a.day)]));
  const slides: { label: string; body: React.ReactNode }[] = [
    { label: 'Versículo de hoy', body: <><Big small={v.text.length > 170}>{v.text}</Big><p className="mt-4 font-serif text-2xl">{v.ref}</p><p className="mt-2 text-[17px] leading-snug opacity-65">{reflectionFor(v)}</p><div className="-ml-2 mt-2 flex"><FavoriteButton fav={{ kind: 'verse', id: v.id, title: v.ref, body: v.text }} /><ShareButton text={v.text} reference={v.ref} kicker="Versículo de hoy" /></div></> },
    { label: 'Evangelio de hoy', body: gospel ? <><Big>{gospel.reference}</Big><p className="mt-3 text-[1.1rem] leading-[1.45] opacity-85">{gospel.text.replace(/\s+/g, ' ').slice(0, 380)}{gospel.text.length > 380 ? '…' : ''}</p><Go to="/liturgia" close={onClose}>Leer las lecturas</Go></> : <><Big>La Palabra de hoy te espera</Big><p className="mt-3 text-[17px] opacity-65">{__PREVIEW__ ? 'Las lecturas se activan en la app publicada.' : 'Ábrela con conexión para leerla.'}</p><Go to="/liturgia" close={onClose}>Abrir las lecturas</Go></> },
    { label: 'Hoy recordamos a', body: <><Big>{saint ?? lit.title}</Big>{bio && <p className="mt-3 text-[1.1rem] leading-[1.4] opacity-80">{bio.bio}</p>}{saint && <Go to={`/descubrir/santos/${encodeURIComponent(saint)}`} close={onClose}>Conocer su vida</Go>}</> },
    { label: 'Para hoy', body: <><Big>{msg}</Big><p className="mt-4 text-[1.1rem] leading-[1.4] opacity-80">{morning}</p></> },
    { label: 'Hecho', body: <div className="pop"><Mark className="h-24 w-auto text-flame" /><p className="mt-2 font-serif text-[5.07rem] leading-[1]">{finalStreak}</p><p className="mt-3 font-serif text-2xl">{finalStreak === 1 ? 'día de racha' : 'días de racha'}</p><p className="mt-5 max-w-[28ch] text-[17px] leading-snug opacity-65">Antes de seguir con tu día, reza un momento. Basta con decir: aquí estoy.</p><Go to="/oracion/padre-nuestro" close={onClose}>Rezar un Padre nuestro</Go><button onClick={onClose} className="mt-1 block min-h-11 text-[15px] underline underline-offset-2 opacity-70">Terminar</button></div> },
  ];
  const last = slides.length - 1;
  useEffect(() => { if (i === last && !done) logActivity({ kind: 'reading', ref: `dia-${date}`, label: 'Tu día' }); }, [i, last, done, date]);
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') setI((x) => Math.min(last, x + 1)); if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1)); }; addEventListener('keydown', f); document.body.style.overflow = 'hidden'; return () => { removeEventListener('keydown', f); document.body.style.overflow = ''; }; }, [last, onClose]);
  const s = slides[i];
  return <div role="dialog" aria-modal="true" aria-label="Tu día" className="c-ink fixed inset-0 z-50 flex flex-col overflow-hidden" onClick={(e) => { if ((e.target as HTMLElement).closest('a,button')) return; const r = e.currentTarget.getBoundingClientRect(); if (e.clientX - r.left < r.width * 0.3) setI(Math.max(0, i - 1)); else setI(Math.min(last, i + 1)); }}>
    <div className="safe-t relative mx-auto flex w-full max-w-xl items-center gap-1.5 pl-5 pr-2">
      {slides.map((_, n) => <span key={n} className={`h-[3px] flex-1 rounded-full bg-current ${n <= i ? '' : 'opacity-25'}`} />)}
      <button aria-label="Cerrar" className="grid size-11 place-items-center" onClick={onClose}><Icon name="close" /></button>
    </div>
    <div key={i} className="slide relative mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col overflow-y-auto px-6 pb-3"><div className="my-auto py-4"><p className="mb-3 text-sm font-bold opacity-65">{s.label}</p>{s.body}</div></div>
    {i < last && <p className="relative pb-5 text-center text-xs opacity-50">Toca para seguir</p>}
  </div>;
}
const Big = ({ children, small }: { children: React.ReactNode; small?: boolean }) => <p className={`font-serif leading-[1.06] ${small ? 'text-[1.68rem]' : 'text-[2.4rem]'}`}>{children}</p>;
const Go = ({ to, close, children }: { to: string; close: () => void; children: React.ReactNode }) => <button onClick={() => { close(); navigate(to); }} className="press mt-5 inline-flex min-h-12 w-fit items-center gap-2 rounded-full bg-pop px-6 font-extrabold text-white">{children}<Icon name="chevron" size={17} /></button>;

export function Onboarding() {
  const seen = useStore((s) => s.onboarded), [name, setName] = useState('');
  useEffect(() => { try { if (localStorage.getItem('zarzu.session')) setState({ onboarded: true }); } catch { /* sin almacenamiento */ } }, []);
  if (seen) return null;
  const done = () => { if (name.trim()) saveProfile({ name: name.trim().slice(0, 40) }); setState({ onboarded: true }); };
  return <div className="soft-hero fixed inset-0 z-50 flex flex-col justify-end overflow-hidden md:items-center md:justify-center" role="dialog" aria-modal="true" aria-labelledby="ob">
    <Mark className="flicker absolute -right-16 top-6 h-[26rem] w-auto text-flame" />
    <form className="sheet safe-b relative w-full p-6 md:max-w-md" onSubmit={(e) => { e.preventDefault(); done(); }}>
      <h2 id="ob" className="text-[5rem] leading-none">Zarzu</h2>
      <p className="mt-1 text-[1.6rem] font-extrabold leading-[1.1] tracking-[-.02em]">Tu fe católica, un rato cada día.</p>
      <p className="mt-2 text-[17px] leading-snug text-muted">El Evangelio, el rosario, los santos y misa cerca de ti.</p>
      <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="¿Cómo te llamas? (opcional)" autoComplete="given-name" className="mt-7 !bg-paper" aria-label="Tu nombre" />
      <button className="press mt-2.5 min-h-14 w-full rounded-full bg-pop text-[17px] font-extrabold text-white">Empezar</button>
    </form>
  </div>;
}
