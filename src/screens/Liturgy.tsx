import { useEffect } from 'react';
import { Button, Chip, Icon, Link, LitDot, Notice, Page, Paragraphs, Section, ShareButton, Spinner } from '../components/ui.tsx';
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
  return <Link to="/liturgia" className="press col-span-2 block rounded-[22px] bg-surface p-5">
    <span className="flex items-center justify-between text-sm font-bold text-gold"><span>Evangelio de hoy</span><Icon name="chevron" size={18} /></span>
    <span className="mt-2 block font-serif text-[1.56rem] leading-[1.06]">{g ? g.reference : 'Abre las lecturas de hoy'}</span>
    {g && <span className="mt-1.5 line-clamp-2 block text-[15px] leading-snug text-muted">{firstSentences(g.text, 160)}</span>}
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
    <header className="mt-5 pb-1">
      <p className="text-[15px] text-muted first-letter:uppercase">{fullDate(d)}</p>
      <h2 className="mt-1 text-[1.84rem] leading-[1.04]">{q.data?.title || lit.title}</h2>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[15px] [&_dd]:font-bold [&_dt]:text-muted">
        <div><dt>Tiempo litúrgico</dt><dd>{lit.seasonLabel}</dd></div>
        <div><dt>Color</dt><dd className="flex items-center gap-1.5"><LitDot color={lit.color} />{COLOR_LABEL[lit.color]}</dd></div>
        <div><dt>Grado</dt><dd>{lit.rankLabel}</dd></div>
        <div><dt>Ciclo</dt><dd>Domingos {lit.cycle}, ferias {lit.weekdayCycle}</dd></div>
        {saint && <div className="col-span-2"><dt>Santo del día</dt><dd><Link to={`/descubrir/santos/${encodeURIComponent(saint)}`} className="text-gold underline underline-offset-2">{saint}</Link></dd></div>}
      </dl>
    </header>

    {q.loading && !q.data && <Spinner label="Consultando las lecturas…" />}
    {q.error && !q.data && <div className="mt-6"><Notice tone="warn" action={<Button kind="ghost" onClick={q.reload}>Volver a intentar</Button>}>
      No se han podido cargar las lecturas: {q.error} Nunca se muestra aquí un texto que no proceda de la fuente.
      <br /><a className="text-gold underline" target="_blank" rel="noreferrer" href={`https://evangeliodeldia.org/SP/gospel/${d}`}>Abrir en evangeliodeldia.org</a>
    </Notice></div>}
    {q.stale && q.data && <div className="mt-4"><Notice tone="warn">Sin conexión. Copia guardada {q.savedAt ? relativeTime(q.savedAt) : ''}.</Notice></div>}

    {q.data?.readings.map((r) => <article key={r.key} className="mt-9">
      <h3 className="font-sans text-sm font-bold tracking-normal text-gold">{r.label}</h3>
      <p className="mt-0.5 font-serif text-[1.6rem] leading-[1.06]">{r.reference}</p>
      <div className={`reading mt-3 ${r.key === 'PS' ? 'whitespace-pre-line' : ''}`}><Paragraphs text={r.text} /></div>
      {r.key !== 'PS' && <p className="mt-3 font-serif text-xl text-gold">{r.key === 'GSP' ? 'Palabra del Señor.' : 'Palabra de Dios.'}</p>}
    </article>)}
    {q.data && !q.data.readings.some((r) => r.key === 'SR') && <p className="mt-6 text-sm text-muted">Hoy no hay segunda lectura.</p>}


    {q.data?.commentary && <Section title="Comentario">
      <p className="font-serif text-xl leading-snug">{q.data.commentary.title}</p>
      <p className="mt-1 text-sm text-muted">{q.data.commentary.author}{q.data.commentary.source ? `. ${q.data.commentary.source}` : ''}</p>
      <details className="mt-3"><summary className="cursor-pointer font-bold text-gold">Leer el comentario</summary><div className="reading mt-3"><Paragraphs text={q.data.commentary.text} /></div></details>
    </Section>}

    {q.data && <p className="mt-8 border-t border-line pt-4 text-xs leading-relaxed text-muted">Lecturas: <a className="underline" target="_blank" rel="noreferrer" href={q.data.source.url}>{q.data.source.name}</a>. Consultado {relativeTime(q.data.fetchedAt)}.</p>}
  </Page>;
}
