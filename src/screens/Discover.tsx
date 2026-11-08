import { useMemo, useState } from 'react';
import { Button, Chip, FavoriteButton, Icon, Input, LIT_SWATCH, Link, Notice, Page, Row, Section, ShareButton, Spinner, Tile } from '../components/ui.tsx';
import { COLOR_LABEL, keys, litDay, yearSpans, type LitDay } from '../lib/calendar.ts';
import { fullDate, iso, monthName, relativeTime, shortDate, today } from '../lib/dates.ts';
import { downloadIcs, navigate, useCached, usePromise } from '../lib/app.ts';
import { BIOS, MARTYROLOGY, QUOTES, findBio } from '../data/saints.ts';
import { THEMED } from '../data/reflections.ts';
import { hash } from '../lib/verses.ts';
import { saintOfDay } from './Home.tsx';

export function DiscoverHome() {
  const d = today(), saint = saintOfDay(d), q = QUOTES[hash(d) % QUOTES.length];
  return <Page title="Descubrir">
    <div className="grid grid-cols-2 gap-2.5">
      <Tile to="/descubrir/misas" icon="target" title="Radar de misas" sub="Las misas que empiezan pronto cerca de ti" className="col-span-2 c-ink" />
      <Tile to="/descubrir/templos" icon="church" title="Templos en el mapa" sub="Parroquias, catedrales y santuarios" className="col-span-2" />
      <Tile to="/descubrir/noticias" icon="news" title="Noticias" sub="Vaticano, España y diócesis" />
      <Tile to="/descubrir/calendario" icon="calendar" title="Calendario" sub="Todo el año litúrgico" />
      <Tile to="/descubrir/santos" icon="saint" title="Santos" sub="Busca y conoce sus vidas" />
      <Tile to="/descubrir/reflexiones" icon="flame" title="Reflexiones" sub="Para distintos momentos" />
    </div>
    {saint && <Section title="Santo de hoy"><Row icon="saint" to={`/descubrir/santos/${encodeURIComponent(saint)}`} title={saint} detail="Biografía y datos" /></Section>}
    <Section title="Frase de hoy" action={<Link to="/descubrir/frases" className="text-sm text-gold">Más frases</Link>}>
      <blockquote className="font-serif text-[1.76rem] leading-[1.08]">{q.text}</blockquote><p className="mt-2 text-[15px] text-muted">{q.author}. {q.source}.</p>
    </Section>
  </Page>;
}

// ---------- Noticias ----------
export interface NewsItem { id: string; title: string; summary: string; date: string; image: string | null; source: string; sourceId: string; link: string; categories: string[] }
export interface NewsResult { items: NewsItem[]; sources: { id: string; name: string; ok: boolean; count: number }[]; fetchedAt: string }
const CATS: [string, string][] = [['', 'Todas'], ['vaticano', 'Vaticano'], ['papa', 'Papa y Santa Sede'], ['espana', 'Iglesia en España'], ['diocesis', 'Diócesis'], ['semana-santa', 'Semana Santa'], ['cofradias', 'Hermandades y cofradías'], ['santos', 'Santos y canonizaciones'], ['internacional', 'Internacional'], ['cultura', 'Cultura y patrimonio']];
export function NewsCard({ item: n, compact }: { item: NewsItem; compact?: boolean }) {
  const [imgOk, setImgOk] = useState(true);
  const img = n.image && imgOk ? <img src={n.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgOk(false)} className="size-full object-cover" /> : <span className="grid size-full place-items-center bg-sand px-3 text-center text-sm font-bold leading-tight text-muted">{n.source}</span>;
  const meta = <span className="mt-1 block text-xs text-muted">{n.source}. <time dateTime={n.date}>{relativeTime(n.date)}</time></span>;
  if (compact) return <a href={n.link} target="_blank" rel="noreferrer" className="press flex gap-3"><span className="size-20 shrink-0 overflow-hidden rounded-2xl">{img}</span><span className="min-w-0 py-0.5"><span className="line-clamp-3 font-serif text-[1rem] leading-[1.12]">{n.title}</span>{meta}</span></a>;
  return <a href={n.link} target="_blank" rel="noreferrer" className="press block h-full overflow-hidden rounded-[22px] bg-surface"><span className="block aspect-[16/9] overflow-hidden">{img}</span><span className="block p-4"><span className="block font-serif text-[1.24rem] leading-[1.08]">{n.title}</span><span className="mt-1 line-clamp-2 block text-[15px] leading-snug text-muted">{n.summary}</span>{meta}</span></a>;
}
export function NewsScreen() {
  const q = useCached<NewsResult>('news', '/api/news'), [cat, setCat] = useState('');
  const items = useMemo(() => (q.data?.items ?? []).filter((i) => !cat || i.categories.includes(cat)), [q.data, cat]);
  return <Page title="Noticias de la Iglesia" back="/descubrir">
    <div className="no-bar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">{CATS.map(([k, l]) => <Chip key={k} active={cat === k} onClick={() => setCat(k)}>{l}</Chip>)}</div>
    {q.stale && q.savedAt && <div className="mt-4"><Notice tone="warn">Sin conexión. Estas noticias se guardaron {relativeTime(q.savedAt)} y pueden no ser las más actuales.</Notice></div>}
    {q.loading && !q.data && <Spinner label="Consultando las fuentes…" />}
    {!q.data && q.error && <div className="mt-4"><Notice tone="warn" action={<Button kind="ghost" onClick={q.reload}>Volver a intentar</Button>}>No se han podido cargar las noticias. {q.error}</Notice></div>}
    <div className="mt-4 space-y-3">{items.map((n, i) => <NewsCard key={n.id} item={n} compact={i % 4 !== 0} />)}</div>
    {q.data && !items.length && <p className="mt-6 text-sm text-muted">Ninguna noticia reciente en esta categoría.</p>}
    {q.data && <p className="mt-8 text-xs leading-relaxed text-muted">Titulares y resúmenes de sus medios, con enlace al original. Fuentes: {q.data.sources.map((s) => `${s.name}${s.ok ? '' : ' (sin respuesta)'}`).join(', ')}. Actualizado {relativeTime(q.data.fetchedAt)}.</p>}
  </Page>;
}

// ---------- Calendario ----------
const SWATCH = LIT_SWATCH;
export function CalendarScreen() {
  const t = today(), [y, setY] = useState(+t.slice(0, 4)), [m, setM] = useState(+t.slice(5, 7) - 1), [sel, setSel] = useState(t), [view, setView] = useState<'mes' | 'ano'>('mes');
  const cells = useMemo(() => { const first = new Date(y, m, 1, 12), pad = (first.getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate(); return [...Array(pad).fill(null), ...Array.from({ length: n }, (_, i) => iso(new Date(y, m, i + 1, 12)))] as (string | null)[]; }, [y, m]);
  const l = litDay(sel), k = keys(y);
  const move = (dm: number) => { const dt = new Date(y, m + dm, 1); setY(dt.getFullYear()); setM(dt.getMonth()); };
  const exportYear = () => { const ev: { date: string; title: string; note?: string }[] = []; for (let dt = new Date(y, 0, 1, 12); dt.getFullYear() === y; dt.setDate(dt.getDate() + 1)) { const x = litDay(iso(dt)); if (x.rank === 1 || x.rank === 2 || x.rank === 3 || x.season === 'triduo' || x.title === 'Miércoles de Ceniza') ev.push({ date: x.date, title: x.title, note: x.rankLabel }); } downloadIcs(`calendario-liturgico-${y}.ics`, ev); };
  return <Page title="Calendario litúrgico" back="/descubrir" right={<button aria-label="Añadir a mi calendario" title="Descargar .ics" className="grid size-11 place-items-center" onClick={exportYear}><Icon name="down" /></button>}>
    <div className="flex gap-2"><Chip active={view === 'mes'} onClick={() => setView('mes')}>Mes</Chip><Chip active={view === 'ano'} onClick={() => setView('ano')}>Año {y}</Chip></div>
    {view === 'mes' ? <>
      <div className="mt-4 flex items-center justify-between"><button aria-label="Mes anterior" className="grid size-11 place-items-center" onClick={() => move(-1)}><Icon name="back" /></button><h2 className="text-xl first-letter:uppercase">{monthName(y, m)}</h2><button aria-label="Mes siguiente" className="grid size-11 place-items-center" onClick={() => move(1)}><Icon name="chevron" /></button></div>
      <div className="mt-2 grid grid-cols-7 text-center text-xs text-muted">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <span key={d}>{d}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">{cells.map((c, i) => { if (!c) return <span key={`e${i}`} />; const x = litDay(c), big = x.rank === 1 || x.rank === 2 || x.rank === 'domingo'; return <button key={c} onClick={() => setSel(c)} aria-label={`${fullDate(c)}. ${x.title}`} aria-pressed={sel === c} className={`press relative flex aspect-square flex-col items-center justify-center rounded-xl text-[1.05rem] ${sel === c ? 'bg-pop text-white' : c === t ? 'bg-surface' : ''} ${big ? 'font-bold' : ''}`}>{+c.slice(8)}<span className="absolute bottom-1.5 size-1.5 rounded-full" style={{ background: SWATCH[x.color] }} /></button>; })}</div>
      <DayDetail l={l} />
    </> : <>
      <ul className="mt-4">{yearSpans(y).map((s, i) => <li key={i} className="flex items-center gap-3 border-b border-line py-3"><span className="size-3 shrink-0 rounded-full" style={{ background: SWATCH[s.color] }} /><span className="flex-1 font-serif text-[1.08rem] leading-tight">{s.label}</span><span className="text-right text-sm">{shortDate(s.from)} a {shortDate(s.to)}</span></li>)}</ul>
      <Section title="Semana Santa y fechas clave"><dl className="grid grid-cols-[1fr_auto] gap-y-2 text-[15px]">{[['Miércoles de Ceniza', k.ash], ['Domingo de Ramos', k.palm], ['Jueves Santo', k.holyThu], ['Viernes Santo', k.goodFri], ['Domingo de Pascua', k.easter], ['Ascensión del Señor', k.ascension], ['Pentecostés', k.pentecost], ['Corpus Christi', k.corpus], ['Primer domingo de Adviento', k.advent1]].map(([a, b]) => <div key={a} className="contents"><dt>{a}</dt><dd className="text-right text-muted">{shortDate(b)}</dd></div>)}</dl></Section>
      <div className="mt-5 flex justify-center gap-2"><Button kind="ghost" onClick={() => setY(y - 1)}>{y - 1}</Button><Button kind="ghost" onClick={() => setY(y + 1)}>{y + 1}</Button></div>
    </>}
    <p className="mt-8 text-xs leading-relaxed text-muted">Calculado según las normas del año litúrgico con el calendario general y el propio de España. Las diócesis y órdenes religiosas pueden tener celebraciones propias.</p>
  </Page>;
}
function DayDetail({ l }: { l: LitDay }) {
  const saint = saintOfDay(l.date, l);
  return <div className="mt-5 rounded-[22px] bg-surface p-5">
    <p className="text-[15px] text-muted first-letter:uppercase">{fullDate(l.date)}</p><h3 className="mt-1 text-[1.48rem] leading-[1.06]">{l.title}</h3>
    <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[15px]"><span className="inline-block size-3 rounded-full" style={{ background: SWATCH[l.color] }} />{COLOR_LABEL[l.color]}. {l.rankLabel}. {l.seasonLabel}.</p>
    {l.optional.length > 0 && <p className="mt-1 text-[15px] text-muted">También: {l.optional.join(', ')}.</p>}
    {saint && saint !== l.title && <p className="mt-1 text-[15px] text-muted">Santo: <Link className="font-bold text-gold" to={`/descubrir/santos/${encodeURIComponent(saint)}`}>{saint}</Link></p>}
    <Link to={`/liturgia/${l.date}`} className="mt-2 inline-flex min-h-11 items-center gap-1 font-bold text-gold">Ver las lecturas<Icon name="chevron" size={16} /></Link>
  </div>;
}

// ---------- Santos ----------
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function SaintsScreen() {
  const [q, setQ] = useState(''), d = today(), s = saintOfDay(d);
  const results = useMemo(() => {
    const n = fold(q.trim()); if (n.length < 2) return [];
    const out: { name: string; when: string }[] = [], seen = new Set<string>();
    for (const b of BIOS) if (fold(b.name).includes(n) || b.aliases?.some((a) => fold(a).includes(n)) || fold(b.patron ?? '').includes(n)) { seen.add(b.name); out.push({ name: b.name, when: b.feast }); }
    MARTYROLOGY.forEach((days, m) => days.forEach((name, i) => { if (name && fold(name).includes(n) && !seen.has(name)) { seen.add(name); out.push({ name, when: `${i + 1} de ${MONTHS[m]}` }); } }));
    return out.slice(0, 40);
  }, [q]);
  return <Page title="Santos" back="/descubrir">
    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o patronazgo: Teresa, enfermos, estudiantes…" aria-label="Buscar santos" />
    {q.trim().length >= 2 ? <ul className="mt-2">{results.map((r) => <li key={r.name}><Row to={`/descubrir/santos/${encodeURIComponent(r.name)}`} title={r.name} detail={r.when} /></li>)}{!results.length && <li className="py-4 text-sm text-muted">Sin resultados en nuestro santoral. <button className="text-gold underline" onClick={() => navigate(`/descubrir/santos/${encodeURIComponent(q.trim())}`)}>Buscar «{q.trim()}» en Wikipedia</button></li>}</ul> : <>
      {s && <Section title="Hoy"><Row icon="saint" to={`/descubrir/santos/${encodeURIComponent(s)}`} title={s} /></Section>}
      <Section title="Biografías" action={<Link to="/descubrir/frases" className="text-sm text-gold">Frases de santos</Link>}><div className="grid gap-x-6 sm:grid-cols-2">{BIOS.map((b) => <Row key={b.name} to={`/descubrir/santos/${encodeURIComponent(b.name)}`} title={b.name} detail={b.feast} />)}</div></Section>
    </>}
  </Page>;
}
interface Wiki { title: string; extract: string; image: string | null; url: string }
async function wikipedia(name: string): Promise<Wiki | null> {
  const clean = name.replace(/,.*$/, '');
  const url = `https://es.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&generator=search&gsrlimit=3&gsrsearch=${encodeURIComponent(clean)}&prop=extracts|pageimages|info&exintro=1&explaintext=1&exsentences=5&piprop=thumbnail&pithumbsize=720&inprop=url`;
  const r = await fetch(url); if (!r.ok) throw new Error('wiki');
  const pages = Object.values((await r.json()).query?.pages ?? {}) as { index: number; title: string; extract?: string; thumbnail?: { source: string }; fullurl: string }[];
  const words = fold(clean).split(/\s+/).filter((w) => w.length > 3 && !['santo', 'santa', 'beato', 'beata'].includes(w));
  const p = pages.sort((a, b) => a.index - b.index).find((x) => x.extract && words.length && words.every((w) => fold(x.title + ' ' + x.extract!.slice(0, 200)).includes(w)));
  return p ? { title: p.title, extract: p.extract!, image: p.thumbnail?.source ?? null, url: p.fullurl } : null;
}
export function SaintDetail({ name }: { name: string }) {
  const bio = findBio(name), wiki = usePromise(() => wikipedia(bio?.name ?? name), [name]);
  return <Page title={bio?.name ?? name} back="/descubrir/santos" right={<span><FavoriteButton fav={{ kind: 'saint', id: name, title: name, link: `/descubrir/santos/${encodeURIComponent(name)}` }} /></span>}>
    {wiki.data?.image && <img src={wiki.data.image} alt={wiki.data.title} className="mb-4 max-h-96 w-full rounded-[22px] object-cover object-top" />}
    {bio && <><p className="text-sm text-muted">{bio.dates}. Fiesta: {bio.feast}.{bio.patron ? ` Patrón de ${bio.patron}.` : ''}</p><p className="reading mt-3">{bio.bio}</p></>}
    {wiki.loading && !bio && <Spinner label="Buscando la biografía…" />}
    {wiki.data && <Section title={bio ? 'En Wikipedia' : undefined}><p className="reading whitespace-pre-line">{wiki.data.extract}</p><p className="mt-3 text-xs text-muted">Texto de <a className="underline" target="_blank" rel="noreferrer" href={wiki.data.url}>Wikipedia: {wiki.data.title}</a>, bajo licencia CC BY-SA.</p></Section>}
    {!bio && !wiki.loading && !wiki.data && <Notice>No tenemos una biografía contrastada de {name}. <a className="text-gold underline" target="_blank" rel="noreferrer" href={`https://es.wikipedia.org/w/index.php?search=${encodeURIComponent(name)}`}>Buscar en Wikipedia</a></Notice>}
    {QUOTES.filter((q) => bio && q.author.includes(bio.name)).map((q) => <figure key={q.text} className="mt-6 border-l-2 border-gold-soft pl-3"><blockquote className="font-serif text-[1.16rem] leading-[1.14]">{q.text}</blockquote><figcaption className="mt-1 text-sm text-muted">{q.source}</figcaption></figure>)}
  </Page>;
}
export function QuotesScreen() {
  return <Page title="Frases de santos" back="/descubrir/santos"><ul>{QUOTES.map((q) => <li key={q.text} className="border-b border-line py-4"><blockquote className="font-serif text-[1.28rem] leading-[1.12]">{q.text}</blockquote><div className="mt-1 flex items-center justify-between gap-2"><span className="text-sm text-muted">{q.author}. {q.source}.</span><span className="-mr-2 flex shrink-0 text-muted"><FavoriteButton fav={{ kind: 'quote', id: q.text.slice(0, 80), title: q.author, body: q.text }} /><ShareButton text={q.text} reference={q.author} /></span></div></li>)}</ul></Page>;
}
export const ThemedList = () => <Page title="Reflexiones" back="/descubrir">{THEMED.map((t) => <Row key={t.id} to={`/descubrir/reflexiones/${t.id}`} title={t.title} detail={t.intro} />)}</Page>;
export function ThemedDetail({ id }: { id: string }) {
  const t = THEMED.find((x) => x.id === id);
  if (!t) return <Page title="Reflexiones" back="/descubrir/reflexiones"><Notice>Esa reflexión no existe.</Notice></Page>;
  return <Page title={t.title} back="/descubrir/reflexiones"><p className="text-muted">{t.intro}</p><div className="reading mt-4">{t.body.map((p, i) => <p key={i}>{p}</p>)}</div><p className="mt-6 text-sm text-muted">Para leer en la Biblia:</p><div className="mt-2 flex flex-wrap gap-2">{t.refs.map((r) => <Link key={r} to={`/biblia/buscar?q=${encodeURIComponent(r.replace(/\s*\(\d+\)/, ''))}`} className="press inline-flex min-h-10 items-center gap-1.5 rounded-full bg-surface px-4 text-[15px] font-bold"><Icon name="book" size={16} />{r}</Link>)}</div></Page>;
}
void ShareButton;
