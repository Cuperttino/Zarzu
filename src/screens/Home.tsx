import { CountdownStrip, MyParishCard, PopeIntention, SaintCongrats } from './Extras.tsx';
import { useEffect, useState } from 'react';
import { FavoriteButton, Icon, Input, Link, List, Mark, Ribbon, Row, ShareButton, ThemeToggle, Wordmark } from '../components/ui.tsx';
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

  return <div className="mx-auto w-full max-w-2xl px-5 pb-28 md:px-8 md:pb-16">
    <header className="safe-t flex min-h-12 items-center justify-between">
      <Wordmark className="md:invisible" />
      <div className="flex items-center gap-1"><ThemeToggle />
        <Link to="/perfil/estadisticas" label={`Racha: ${streak} ${streak === 1 ? 'día' : 'días'}`} className="press hoverable flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[14px] font-semibold tabular"><Icon name="flame" size={16} fill={streak > 0} className={streak ? 'text-flame' : 'text-muted'} />{streak}</Link></div>
    </header>

    <section className="mt-8 md:mt-10" aria-label="Hoy">
      <p className="rise text-[14px] font-medium text-muted first-letter:uppercase">{longDate(d)}</p>
      <h1 className="rise mt-1 text-[2.25rem] leading-[1.08] tracking-[-.03em] md:text-[2.75rem]" style={{ animationDelay: '40ms' }}>{greeting()}{name ? `, ${name}` : ''}</h1>
      <div className="rise mt-5 flex gap-3" style={{ animationDelay: '80ms' }}>
        <Ribbon color={lit.color} className="mt-[3px]" />
        <div className="min-w-0">
          <Link to="/liturgia" className="block text-[15.5px] font-medium leading-snug hover:underline">{lit.title}</Link>
          <p className="text-[14px] leading-snug text-muted">{lit.seasonLabel}. Color {COLOR_LABEL[lit.color].toLowerCase()}.{saint && <> Hoy recordamos a <Link to={`/descubrir/santos/${encodeURIComponent(saint)}`} className="text-ink-2 underline decoration-line underline-offset-2 hover:decoration-muted">{saint}</Link>.</>}</p>
        </div>
      </div>
      <button disabled={!v} onClick={() => setStories(true)} className="press rise mt-6 flex min-h-[3.25rem] w-full items-center justify-between rounded-xl bg-pop px-5 text-[15.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.14)] transition-[filter] hover:brightness-110 disabled:opacity-50" style={{ animationDelay: '120ms' }}>
        <span>{done ? 'Volver a ver tu día' : 'Empieza tu día'}</span><span className="flex items-center gap-2 text-[13px] font-medium text-white/75">{done ? <><Icon name="check" size={16} />Hecho</> : <>5 pasos · 3 min<Icon name="chevron" size={16} /></>}</span>
      </button>
    </section>

    <SaintCongrats />
    {ann && <p className="mt-6 rounded-xl bg-surface p-4 text-[15px] leading-snug">{ann}</p>}

    <section aria-label="Versículo del día" className="reveal mt-12">
      <div className="flex items-baseline justify-between gap-2"><h2 className="text-[13px] font-medium tracking-normal text-muted">Versículo de hoy</h2><Link to="/biblia/versiculos" className="text-[13px] font-medium text-gold">Anteriores</Link></div>
      {verse.loading && <p className="pulse-soft mt-3 h-28 rounded-xl" />}
      {verse.error && <p className="mt-3 text-[15px] text-muted">No se ha podido cargar el versículo. Abre la app con conexión.</p>}
      {v && <>
        <blockquote className="scripture mt-3 text-[1.6rem] leading-[1.28] text-ink md:text-[1.8rem]">{v.text}</blockquote>
        <div className="mt-3 flex items-center justify-between"><Link to={`/biblia/${v.book}/${v.c}?v=${v.v}`} className="text-[14.5px] font-semibold hover:underline">{v.ref}</Link>
          <span className="-mr-2 flex text-muted"><FavoriteButton fav={{ kind: 'verse', id: v.id, title: v.ref, body: v.text, link: `/biblia/${v.book}/${v.c}?v=${v.v}` }} /><ShareButton text={v.text} reference={v.ref} kicker="Versículo de hoy" /></span></div>
        <p className="mt-1 text-[14.5px] leading-relaxed text-muted">{reflectionFor(v)}</p>
      </>}
    </section>

    <div className="mt-10 grid gap-3">
      <GospelTeaser date={d} />
      <List>
        <Row to="/descubrir/misas" icon="target" title="Radar de misas" detail="Misas y adoración cerca de ti" />
        <Row to="/oracion/rosario" icon="rosary" title="Rosario" detail={myst.name.replace('Misterios ', 'Hoy, misterios ')} />
        <Row to="/perfil/diario" icon="pen" title="Mi diario" detail="¿Qué te ha dicho Dios hoy?" />
      </List>
    </div>

    <MyParishCard />

    <section className="reveal mt-12">
      <h2 className="text-[1.15rem]">Para empezar hoy</h2>
      <p className="mt-2 text-[15.5px] leading-relaxed text-ink-2">{morning}</p>
      <p className="scripture mt-4 text-[1.3rem] italic leading-snug text-ink">{msg}</p>
    </section>

    <PopeIntention />

    <section className="reveal mt-12">
      <div className="mb-3 flex items-baseline justify-between"><h2 className="text-[1.15rem]">Noticias de la Iglesia</h2><Link to="/descubrir/noticias" className="shrink-0 pl-2 text-[13px] font-medium text-gold">Ver todas</Link></div>
      {news.stale && <p className="mb-2 text-sm text-warn">Sin conexión: pueden no ser las más recientes.</p>}
      {news.data ? <div className="no-bar -mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 md:-mx-8 md:px-8">{news.data.items.slice(0, 6).map((n) => <div key={n.id} className="snap-card w-[78%] max-w-80 shrink-0 snap-start"><NewsCard item={n} /></div>)}</div>
        : news.loading ? <p className="pulse-soft h-56 rounded-2xl" /> : <p className="text-[15px] text-muted">Las noticias no están disponibles ahora. {news.error}</p>}
    </section>

    <CountdownStrip />

    <section className="reveal mt-12">
      <div className="mb-1 flex items-baseline justify-between"><h2 className="text-[1.15rem]">Lo que viene</h2><Link to="/descubrir/calendario" className="shrink-0 pl-2 text-[13px] font-medium text-gold">Calendario</Link></div>
      <ul>{upcoming(d, 4).map((u) => <li key={u.date}><Link to={`/liturgia/${u.date}`} className="group flex items-center gap-3 border-b border-line py-3 last:border-0"><Ribbon color={u.color} /><span className="min-w-0 flex-1 text-[15px] font-medium leading-snug group-hover:underline">{u.title}</span><time dateTime={u.date} className="shrink-0 text-[13.5px] text-muted tabular">{shortDate(u.date)}</time></Link></li>)}</ul>
    </section>

    <p className="mt-16 flex items-center justify-center gap-2 text-center text-[13px] font-medium text-muted"><Icon name="pray" size={14} />Alabado sea Jesucristo</p>

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
    { label: 'Versículo de hoy', body: <><Big small={v.text.length > 170}>{v.text}</Big><p className="mt-5 text-[15px] font-semibold">{v.ref}</p><p className="mt-2 text-[15.5px] leading-relaxed text-white/60">{reflectionFor(v)}</p><div className="-ml-2 mt-2 flex"><FavoriteButton fav={{ kind: 'verse', id: v.id, title: v.ref, body: v.text }} /><ShareButton text={v.text} reference={v.ref} kicker="Versículo de hoy" /></div></> },
    { label: 'Evangelio de hoy', body: gospel ? <><Big>{gospel.reference}</Big><p className="scripture mt-4 text-[1.15rem] leading-[1.55] text-white/80">{gospel.text.replace(/\s+/g, ' ').slice(0, 380)}{gospel.text.length > 380 ? '…' : ''}</p><Go to="/liturgia" close={onClose}>Leer las lecturas</Go></> : <><Big>La Palabra de hoy te espera</Big><p className="mt-3 text-[15.5px] text-white/60">{__PREVIEW__ ? 'Las lecturas se activan en la app publicada.' : 'Ábrela con conexión para leerla.'}</p><Go to="/liturgia" close={onClose}>Abrir las lecturas</Go></> },
    { label: 'Hoy recordamos a', body: <><Big>{saint ?? lit.title}</Big>{bio && <p className="mt-4 text-[15.5px] leading-relaxed text-white/70">{bio.bio}</p>}{saint && <Go to={`/descubrir/santos/${encodeURIComponent(saint)}`} close={onClose}>Conocer su vida</Go>}</> },
    { label: 'Para hoy', body: <><Big>{msg}</Big><p className="mt-4 text-[15.5px] leading-relaxed text-white/70">{morning}</p></> },
    { label: 'Hecho', body: <div className="pop"><Mark className="medal-in h-14 w-auto text-flame" /><p className="mt-5 text-[4.5rem] font-semibold leading-none tracking-[-.04em] tabular">{finalStreak}</p><p className="mt-1 text-[17px] font-medium text-white/80">{finalStreak === 1 ? 'día de racha' : 'días de racha'}</p><p className="mt-6 max-w-[30ch] text-[15.5px] leading-relaxed text-white/60">Antes de seguir con tu día, reza un momento. Basta con decir: aquí estoy.</p><Go to="/oracion/padre-nuestro" close={onClose}>Rezar un Padre nuestro</Go><button onClick={onClose} className="mt-2 block min-h-11 text-[14.5px] font-medium text-white/60 hover:text-white">Terminar</button></div> },
  ];
  const last = slides.length - 1;
  useEffect(() => { if (i === last && !done) logActivity({ kind: 'reading', ref: `dia-${date}`, label: 'Tu día' }); }, [i, last, done, date]);
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') setI((x) => Math.min(last, x + 1)); if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1)); }; addEventListener('keydown', f); document.body.style.overflow = 'hidden'; return () => { removeEventListener('keydown', f); document.body.style.overflow = ''; }; }, [last, onClose]);
  const s = slides[i];
  return <div role="dialog" aria-modal="true" aria-label="Tu día" className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#111015] text-white" onClick={(e) => { if ((e.target as HTMLElement).closest('a,button')) return; const r = e.currentTarget.getBoundingClientRect(); if (e.clientX - r.left < r.width * 0.3) setI(Math.max(0, i - 1)); else setI(Math.min(last, i + 1)); }}>
    <div className="safe-t relative mx-auto flex w-full max-w-xl items-center gap-1.5 pl-5 pr-2">
      {slides.map((_, n) => <span key={n} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20"><span className={`block h-full rounded-full bg-white transition-[width] duration-500 ${n <= i ? 'w-full' : 'w-0'}`} /></span>)}
      <button aria-label="Cerrar" className="grid size-11 place-items-center" onClick={onClose}><Icon name="close" /></button>
    </div>
    <div key={i} className="slide relative mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col overflow-y-auto px-6 pb-3"><div className="my-auto py-4"><p className="mb-4 text-[13px] font-medium text-white/50">{s.label}</p>{s.body}</div></div>
    {i < last && <p className="relative pb-5 text-center text-xs text-white/40">Toca para seguir</p>}
  </div>;
}
const Big = ({ children, small }: { children: React.ReactNode; small?: boolean }) => <p className={`scripture leading-[1.22] ${small ? 'text-[1.6rem]' : 'text-[2.1rem]'}`}>{children}</p>;
const Go = ({ to, close, children }: { to: string; close: () => void; children: React.ReactNode }) => <button onClick={() => { close(); navigate(to); }} className="press mt-6 inline-flex min-h-11 w-fit items-center gap-2 rounded-xl bg-white px-4 text-[15px] font-semibold text-[#111015] hover:bg-white/90">{children}<Icon name="chevron" size={16} /></button>;

export function Onboarding() {
  const seen = useStore((s) => s.onboarded), [name, setName] = useState('');
  useEffect(() => { try { if (localStorage.getItem('zarzu.session')) setState({ onboarded: true }); } catch { /* sin almacenamiento */ } }, []);
  if (seen) return null;
  const done = () => { if (name.trim()) saveProfile({ name: name.trim().slice(0, 40) }); setState({ onboarded: true }); };
  return <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-paper md:items-center md:justify-center" role="dialog" aria-modal="true" aria-labelledby="ob">
    <form className="safe-b mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-6 pt-[max(3.5rem,env(safe-area-inset-top))] md:flex-none md:pt-6" onSubmit={(e) => { e.preventDefault(); done(); }}>
      <Mark className="rise h-10 w-auto self-start text-flame" />
      <h2 id="ob" className="rise mt-8 text-[2.6rem] leading-[1.05] tracking-[-.035em]" style={{ animationDelay: '60ms' }}>Tu fe católica,<br />un rato cada día.</h2>
      <ul className="mt-8 space-y-4 text-[15px]">{[['book', 'El Evangelio y las lecturas de cada día'], ['rosary', 'El rosario y las oraciones, paso a paso'], ['target', 'Misas y adoración cerca de ti, con horarios']].map(([icon, text], k) => <li key={icon} className="rise flex items-center gap-3 text-ink-2" style={{ animationDelay: `${140 + k * 60}ms` }}><span className="niche !size-9"><Icon name={icon} size={18} /></span>{text}</li>)}</ul>
      <div className="mt-auto pt-10 md:mt-10">
        <label htmlFor="ob-name" className="text-[13px] font-medium text-muted">¿Cómo te llamas? (opcional)</label>
        <Input id="ob-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoComplete="given-name" className="mt-1.5" aria-label="Tu nombre" />
        <button className="press mt-3 min-h-[3.25rem] w-full rounded-xl bg-pop text-[15.5px] font-semibold text-white transition-[filter] hover:brightness-110">Empezar</button>
        <p className="mt-3 text-center text-[12.5px] text-muted">Sin cuenta y sin anuncios. Tus datos se quedan en este dispositivo.</p>
      </div>
    </form>
  </div>;
}
