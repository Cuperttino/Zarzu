import { useEffect } from 'react';
import { Button, Chip, Icon, Link, LitDot, Notice, Page, Paragraphs, Ribbon, Section, ShareButton, Spinner } from '../components/ui.tsx';
import { COLOR_LABEL, litDay } from '../lib/calendar.ts';
import { addDays, fullDate, relativeTime, today } from '../lib/dates.ts';
import { navigate, useCached } from '../lib/app.ts';
import { logActivity } from '../lib/store.ts';
import { saintOfDay } from './Home.tsx';

interface Reading { key: 'FR' | 'PS' | 'SR' | 'GSP'; label: string; reference: string; text: string }
interface Liturgy { date: string; title: string; readings: Reading[]; saints: string[]; commentary: { title: string; author: string; source: string; text: string } | null; source: { name: string; url: string }; fetchedAt: string }

const firstSentences = (t: string, n = 220) => { const c = t.replace(/\s+/g, ' '); if (c.length <= n) return c; const i = c.lastIndexOf(' ', n); return `${c.slice(0, i)}…`; };

export function useGospel(date: string) { return useCached<Liturgy>(`lit.${date}`, `/api/liturgy?date=${date}`).data?.readings.find((r) => r.key === 'GSP') ?? null; }
export function GospelTeaser({ date }: { date: string }) {
  const q = useCached<Liturgy>(`lit.${date}`, `/api/liturgy?date=${date}`);
  const g = q.data?.readings.find((r) => r.key === 'GSP');
  return <Link to="/liturgia" className="press tile reveal block rounded-2xl border border-line bg-paper p-5">
    <span className="flex items-center justify-between text-[13px] font-medium text-muted"><span className="flex items-center gap-2"><Icon name="book" size={16} className="text-gold" />Evangelio de hoy</span><Icon name="chevron" size={16} /></span>
    <span className="mt-3 block text-[1.2rem] font-semibold leading-snug tracking-[-.015em]">{g ? g.reference : q.loading ? <span className="pulse-soft inline-block h-6 w-40 rounded-md" /> : 'Las lecturas de hoy'}</span>
    {g ? <span className="scripture mt-1.5 line-clamp-3 block text-[1.05rem] leading-[1.5] text-ink-2">{firstSentences(g.text, 200)}</span> : !q.loading && <span className="mt-1 block text-[14.5px] text-muted">Primera lectura, salmo y Evangelio del día.</span>}
  </Link>;
}

export function LiturgyScreen({ date }: { date?: string }) {
  const d = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today(), lit = litDay(d), t = today();
  const q = useCached<Liturgy>(`lit.${d}`, `/api/liturgy?date=${d}`);
  const saint = saintOfDay(d, lit);
  useEffect(() => { if (q.data?.readings.length && d === t) logActivity({ kind: 'gospel', ref: d, label: q.data.title || lit.title }); }, [q.data, d, t, lit.title]);
  const gospel = q.data?.readings.find((r) => r.key === 'GSP');

  return <Page title="Lecturas de hoy" back="/" right={gospel && <ShareButton text={firstSentences(gospel.text, 340)} reference={gospel.reference} kicker="Evangelio del día" />}>
    <div className="no-bar -mx-5 flex gap-2 overflow-x-auto px-5">
      {[-1, 0, 1, 2].map((n) => { const x = addDays(t, n); return <Chip key={n} active={x === d} onClick={() => navigate(`/liturgia/${x}`, true)}>{n === -1 ? 'Ayer' : n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : 'Pasado mañana'}</Chip>; })}
    </div>
    <header className="mt-6 pb-1">
      <p className="text-[14px] font-medium text-muted first-letter:uppercase">{fullDate(d)}</p>
      <h2 className="mt-1 flex gap-3 text-[1.5rem] leading-[1.15]"><Ribbon color={lit.color} className="mt-[7px]" /><span>{q.data?.title || lit.title}</span></h2>
      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line text-[14px] [&>div]:bg-paper [&>div]:px-3.5 [&>div]:py-2.5 [&_dd]:font-medium [&_dt]:text-[12.5px] [&_dt]:text-muted">
        <div><dt>Tiempo litúrgico</dt><dd>{lit.seasonLabel}</dd></div>
        <div><dt>Color</dt><dd className="flex items-center gap-1.5"><LitDot color={lit.color} />{COLOR_LABEL[lit.color]}</dd></div>
        <div><dt>Grado</dt><dd>{lit.rankLabel}</dd></div>
        <div><dt>Ciclo</dt><dd>Domingos {lit.cycle}, ferias {lit.weekdayCycle}</dd></div>
        {saint && <div className="col-span-2"><dt>Santo del día</dt><dd><Link to={`/descubrir/santos/${encodeURIComponent(saint)}`} className="text-gold hover:underline">{saint}</Link></dd></div>}
      </dl>
    </header>

    {q.loading && !q.data && <Spinner label="Consultando las lecturas…" />}
    {q.error && !q.data && <div className="mt-6"><Notice tone="warn" action={<Button kind="ghost" onClick={q.reload}>Volver a intentar</Button>}>
      No se han podido cargar las lecturas: {q.error} Nunca se muestra aquí un texto que no proceda de la fuente.
      <br /><a className="text-gold underline" target="_blank" rel="noreferrer" href={`https://evangeliodeldia.org/SP/gospel/${d}`}>Abrir en evangeliodeldia.org</a>
    </Notice></div>}
    {q.stale && q.data && <div className="mt-4"><Notice tone="warn">Sin conexión. Copia guardada {q.savedAt ? relativeTime(q.savedAt) : ''}.</Notice></div>}

    {q.data?.readings.map((r) => <article key={r.key} className="reveal mt-12">
      <h3 className="text-[13px] font-medium tracking-normal text-gold">{r.label}</h3>
      <p className="mt-1 text-[1.3rem] font-semibold leading-snug tracking-[-.015em]">{r.reference}</p>
      <div className={`reading mt-4 ${r.key === 'PS' ? 'whitespace-pre-line' : ''}`}><Paragraphs text={r.text} /></div>
      {r.key !== 'PS' && <p className="scripture mt-4 text-[1.1rem] italic text-muted">{r.key === 'GSP' ? 'Palabra del Señor.' : 'Palabra de Dios.'}</p>}
    </article>)}
    {q.data && !q.data.readings.some((r) => r.key === 'SR') && <p className="mt-6 text-sm text-muted">Hoy no hay segunda lectura.</p>}


    {q.data?.commentary && <Section title="Comentario">
      <p className="text-[1.05rem] font-semibold leading-snug">{q.data.commentary.title}</p>
      <p className="mt-1 text-sm text-muted">{q.data.commentary.author}{q.data.commentary.source ? `. ${q.data.commentary.source}` : ''}</p>
      <details className="mt-3"><summary className="cursor-pointer text-[15px] font-semibold text-gold">Leer el comentario</summary><div className="reading mt-3"><Paragraphs text={q.data.commentary.text} /></div></details>
    </Section>}

    {q.data && <p className="mt-8 border-t border-line pt-4 text-xs leading-relaxed text-muted">Lecturas: <a className="underline" target="_blank" rel="noreferrer" href={q.data.source.url}>{q.data.source.name}</a>. Consultado {relativeTime(q.data.fetchedAt)}.</p>}
  </Page>;
}
