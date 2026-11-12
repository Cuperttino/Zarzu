import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Chip, FavoriteButton, Icon, Input, Link, Notice, Page, Row, Section, ShareButton, Spinner, Tile } from '../components/ui.tsx';
import { downloadAll, loadBook, loadIndex, parseReference, searchBible, type BookMeta, type SearchHit } from '../lib/bible.ts';
import { navigate, usePromise } from '../lib/app.ts';
import { logActivity, saveProfile, setState, useStore, getState } from '../lib/store.ts';
import { loadCatalog } from '../lib/verses.ts';
import { reflectionFor } from './Home.tsx';
import { fullDate } from '../lib/dates.ts';

export function BibleHome() {
  const idx = usePromise(loadIndex, []), last = useStore((s) => s.lastRead), [q, setQ] = useState('');
  const groups = useMemo(() => { const m = new Map<string, BookMeta[]>(); for (const b of idx.data?.books ?? []) { const k = `${b.testament === 'AT' ? 'Antiguo Testamento' : 'Nuevo Testamento'}|${b.group}`; m.set(k, [...(m.get(k) ?? []), b]); } return [...m]; }, [idx.data]);
  const lastBook = idx.data?.books.find((b) => b.code === last?.book);
  return <Page title="La Biblia" subtitle="Traducción de Félix Torres Amat">
    <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) navigate(`/biblia/buscar?q=${encodeURIComponent(q.trim())}`); }} className="relative">
      <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-[15px] text-muted" />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca una palabra o una cita, como Jn 3,16" aria-label="Buscar en la Biblia" className="pl-10" />
    </form>
    <div className="mt-3 grid grid-cols-2 gap-2.5">
      {lastBook && last ? <Tile to={`/biblia/${last.book}/${last.c}`} icon="book" title={`${lastBook.name} ${last.c}`} sub="Seguir leyendo" />
        : <Tile to="/biblia/MAT/1" icon="book" title="San Mateo" sub="Empieza por aquí" />}
      <Tile to="/biblia/versiculos" icon="pray" title="Versículos" sub="Tu historial" />
    </div>
    {idx.loading && <Spinner />}
    {idx.error && <Notice tone="error">No se ha podido abrir la Biblia. Comprueba tu conexión.</Notice>}
    {groups.map(([k, books]) => { const [t, g] = k.split('|'); return <Section key={k} title={g}>
      <p className="-mt-2 mb-2 text-[13px] text-muted">{t}</p>
      <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">{books.map((b) => <Link key={b.code} to={`/biblia/${b.code}`} className="group flex min-h-12 items-center justify-between gap-2 border-b border-line py-2.5"><span className="text-[15px] font-medium leading-tight transition-colors group-hover:text-gold">{b.name}</span><span className="tabular text-[12px] text-muted">{b.chapters}</span></Link>)}</div>
    </Section>; })}
    {idx.data && <p className="mt-10 border-t border-line pt-4 text-xs leading-relaxed text-muted">{idx.data.edition}. {idx.data.totalVerses.toLocaleString('es-ES')} versículos. Los salmos siguen la numeración de la Vulgata, una menos que en muchas biblias actuales desde el salmo 10. Es una traducción del siglo XIX, con su lenguaje y su ortografía de época.</p>}
  </Page>;
}

export function BibleBook({ code }: { code: string }) {
  const idx = usePromise(loadIndex, []), b = idx.data?.books.find((x) => x.code === code);
  if (idx.data && !b) return <Page title="Libro no encontrado" back="/biblia"><Notice>Ese libro no existe.</Notice></Page>;
  return <Page title={b?.name ?? ''} back="/biblia" subtitle={b ? `${b.chapters} ${b.chapters === 1 ? 'capítulo' : 'capítulos'}` : ''}>
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">{Array.from({ length: b?.chapters ?? 0 }, (_, i) => i + 1).map((c) => <Link key={c} to={`/biblia/${code}/${c}`} className="press cell-in tabular grid aspect-square place-items-center rounded-xl border border-line text-[1.1rem] font-medium transition-colors hover:border-pop hover:bg-pop-soft hover:text-gold" style={{ animationDelay: `${Math.min(c, 40) * 12}ms` }}>{c}</Link>)}</div>
  </Page>;
}

export function BibleReader({ code, chapter, verse }: { code: string; chapter: number; verse?: number }) {
  const idx = usePromise(loadIndex, []), book = usePromise(() => loadBook(code), [code]);
  const meta = idx.data?.books.find((b) => b.code === code), vs = book.data?.chapters[String(chapter)];
  const [zen, setZen] = useState(false), [sel, setSel] = useState<number | null>(verse ?? null), scale = useStore((s) => s.settings.readingScale), settings = useStore((s) => s.settings);
  const target = useRef<HTMLElement | null>(null);
  useEffect(() => { setSel(verse ?? null); }, [verse, chapter]);
  useEffect(() => { if (vs && meta) { setState({ lastRead: { book: code, c: chapter } }); logActivity({ kind: 'reading', ref: `${code}.${chapter}`, label: `${meta.name} ${chapter}` }); } }, [vs, meta, code, chapter]);
  useEffect(() => { if (verse && target.current) target.current.scrollIntoView({ block: 'center' }); }, [verse, vs]);
  const ref = (v: number) => `${code === 'PSA' ? 'Salmo' : meta?.name} ${chapter},${v}`;
  const body = vs ? <>
    {meta?.partial?.includes(chapter) && <div className="mb-4"><Notice>Este capítulo procede de una transcripción parcial y puede tener versículos sin revisar.</Notice></div>}
    <div className="reading max-w-[34em]">{Object.entries(vs).sort((a, b) => +a[0] - +b[0]).map(([n, t]) => <span key={n} ref={+n === verse ? (e) => { target.current = e; } : undefined} onClick={() => setSel(sel === +n ? null : +n)} className={`cursor-pointer rounded transition-colors ${sel === +n ? 'bg-pop-soft' : ''}`}><sup className="mr-0.5 font-sans text-[.58em] font-semibold text-gold">{n}</sup>{t} </span>)}</div>
  </> : book.loading ? <Spinner /> : <Notice tone="warn">{book.error ? 'No se ha podido abrir el capítulo. Comprueba tu conexión.' : 'Ese capítulo no existe.'}</Notice>;
  const nav = <nav className="mt-10 flex items-center justify-between gap-2 border-t border-line pt-4 text-[14.5px] font-medium">
    {chapter > 1 ? <Link to={`/biblia/${code}/${chapter - 1}`} className="flex min-h-11 items-center gap-1 text-gold"><Icon name="back" size={16} />Capítulo {chapter - 1}</Link> : <span />}
    {meta && chapter < meta.chapters ? <Link to={`/biblia/${code}/${chapter + 1}`} className="flex min-h-11 items-center gap-1 text-gold">Capítulo {chapter + 1}<Icon name="chevron" size={16} /></Link> : <span />}
  </nav>;
  const bar = sel && vs?.[sel] && <div className="sheet fixed inset-x-3 bottom-[4.8rem] z-30 mx-auto flex max-w-md items-center gap-1 rounded-2xl bg-ink py-1 pl-4 pr-1 text-paper shadow-[var(--shadow-float)] md:bottom-6">
    <span className="flex-1 truncate text-[14px] font-medium">{ref(sel)}</span>
    <FavoriteButton fav={{ kind: 'verse', id: `${code}.${chapter}.${sel}`, title: ref(sel), body: vs[sel], link: `/biblia/${code}/${chapter}?v=${sel}` }} />
    <ShareButton text={vs[sel]} reference={ref(sel)} />
    <button aria-label="Cerrar" className="grid size-11 place-items-center" onClick={() => setSel(null)}><Icon name="close" size={18} /></button>
  </div>;
  if (zen) return <div className="fixed inset-0 z-40 overflow-y-auto bg-paper px-6 py-12"><button aria-label="Salir del modo lectura" className="fixed right-3 top-3 grid size-11 place-items-center rounded-full bg-surface" onClick={() => setZen(false)}><Icon name="close" /></button><div className="mx-auto max-w-[36em]"><h1 className="mb-6 text-[1.6rem] font-semibold tracking-[-.02em]">{meta?.name} {chapter}</h1>{body}{nav}</div></div>;
  return <Page title={`${meta?.name ?? ''} ${chapter}`} back={`/biblia/${code}`} right={<div className="flex">
    <button aria-label="Cambiar tamaño de letra" title={`Tamaño ${Math.round(scale * 100)} %`} className="grid size-11 place-items-center rounded-full" onClick={() => saveProfile({ settings: { ...settings, readingScale: scale >= 1.3 ? 0.9 : +(scale + 0.1).toFixed(1) } })}><Icon name="text" /></button>
    <button className="hoverable min-h-11 rounded-full px-3 text-[14px] font-medium" onClick={() => setZen(true)}>Modo lectura</button>
  </div>}>{body}{nav}{bar}</Page>;
}

export function BibleSearch({ initial }: { initial: string }) {
  const idx = usePromise(loadIndex, []), [q, setQ] = useState(initial), [t, setT] = useState<'' | 'AT' | 'NT'>(''), [bookF, setBookF] = useState('');
  const [res, setRes] = useState<{ hits: SearchHit[]; total: number; q: string } | null>(null), [pct, setPct] = useState<number | null>(null);
  const run = async (text = q) => {
    const s = text.trim(); if (!s || !idx.data) return;
    const r = parseReference(s, idx.data.books);
    if (r && /\d/.test(s)) { navigate(`/biblia/${r.book.code}/${r.c}${r.v ? `?v=${r.v}` : ''}`, true); return; }
    if (r?.onlyBook) { navigate(`/biblia/${r.book.code}`, true); return; }
    setPct(0);
    try { const o = await searchBible(s, { testament: t || undefined, book: bookF || undefined, onProgress: setPct }); setRes({ ...o, q: s }); } catch { setRes({ hits: [], total: -1, q: s }); }
    setPct(null);
  };
  useEffect(() => { if (initial && idx.data) void run(initial); }, [idx.data]); // eslint-disable-line
  useEffect(() => { if (res) void run(res.q); }, [t, bookF]); // eslint-disable-line
  const marked = (text: string) => { const terms = res!.q.replace(/"/g, '').split(/\s+/).filter((x) => x.length > 1); const f = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); return text.split(/(\s+)/).map((w, i) => terms.some((x) => f(w).includes(f(x))) ? <mark key={i} className="rounded bg-pop-soft text-inherit">{w}</mark> : w); };
  return <Page title="Buscar en la Biblia" back="/biblia">
    <form onSubmit={(e) => { e.preventDefault(); void run(); }} className="flex gap-2"><Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="misericordia, «buen pastor», Jn 3,16" aria-label="Texto a buscar" /><Button aria-label="Buscar"><Icon name="search" size={18} /></Button></form>
    <div className="no-bar -mx-5 mt-3 flex items-center gap-2 overflow-x-auto px-5">
      {([['', 'Toda la Biblia'], ['AT', 'Antiguo Testamento'], ['NT', 'Nuevo Testamento']] as const).map(([k, l]) => <Chip key={k} active={t === k && !bookF} onClick={() => { setBookF(''); setT(k); }}>{l}</Chip>)}
      <select aria-label="Filtrar por libro" value={bookF} onChange={(e) => setBookF(e.target.value)} className="min-h-9 rounded-full border border-line bg-paper px-3 text-[14px] text-ink-2"><option value="">Un libro…</option>{idx.data?.books.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}</select>
    </div>
    <p className="mt-2 text-xs text-muted">Pon una frase entre comillas para buscarla exacta. Sin comillas, busca versículos con todas las palabras.</p>
    {pct !== null && <div className="mt-6" role="status"><p className="text-sm text-muted">Buscando en los 73 libros…</p><div className="mt-2 h-[3px] overflow-hidden rounded-full bg-sand"><div className="h-full rounded-full bg-pop transition-[width]" style={{ width: `${pct * 100}%` }} /></div></div>}
    {res && pct === null && (res.total < 0 ? <div className="mt-6"><Notice tone="error">La búsqueda necesita conexión hasta que descargues la Biblia desde Perfil.</Notice></div> : <>
      <p className="mt-5 text-sm text-muted">{res.total === 0 ? `Sin resultados para «${res.q}». Prueba con otra palabra: esta traducción usa lenguaje de época.` : `${res.total.toLocaleString('es-ES')} ${res.total === 1 ? 'versículo' : 'versículos'}${res.total > res.hits.length ? `. Se muestran los ${res.hits.length} más relevantes.` : ''}`}</p>
      <ul className="mt-2">{res.hits.map((h) => <li key={`${h.book.code}${h.c}.${h.v}`} className="border-b border-line"><Link to={`/biblia/${h.book.code}/${h.c}?v=${h.v}`} className="hoverable -mx-2 block rounded-lg px-2 py-3"><span className="text-[13px] font-semibold text-gold">{h.book.name} {h.c},{h.v}</span><span className="mt-1 block reading !text-[1.15rem] leading-snug">{marked(h.text)}</span></Link></li>)}</ul>
    </>)}
  </Page>;
}

export function VerseHistory() {
  const hist = useStore((s) => s.verses), cat = usePromise(loadCatalog, []);
  const byId = useMemo(() => new Map((cat.data ?? []).map((v) => [v.id, v])), [cat.data]);
  const seen = new Set(hist.map((h) => h.id)).size, total = cat.data?.length ?? 0;
  return <Page title="Versículos diarios" back="/biblia">
    {total > 0 && <div><p className="text-[13px] font-medium text-muted">Has recibido</p><p className="tabular mt-0.5 text-[2.2rem] font-semibold leading-none tracking-[-.04em]">{seen}<span className="ml-1.5 text-[1rem] font-medium tracking-normal text-muted">de {total.toLocaleString('es-ES')}</span></p><div className="mt-3 h-[3px] overflow-hidden rounded-full bg-sand"><div className="grow-x h-full rounded-full bg-pop" style={{ width: `${Math.max(1, (seen / total) * 100)}%` }} /></div><p className="mt-2 text-[15px] leading-snug text-muted">Ninguno se repite hasta terminar el repertorio. Después vuelven primero los más antiguos. Con cuenta, el historial te acompaña en todos tus dispositivos.</p></div>}
    <ul className="mt-4">{hist.map((h) => { const v = byId.get(h.id); if (!v) return null; return <li key={h.day} className="border-b border-line py-4">
      <time className="text-[13px] first-letter:uppercase text-muted" dateTime={h.day}>{fullDate(h.day)}</time>
      <p className="scripture mt-1 text-[1.3rem] leading-[1.3]">{v.text}</p>
      <div className="mt-1 flex items-center justify-between"><Link to={`/biblia/${v.book}/${v.c}?v=${v.v}`} className="text-sm font-medium text-gold">{v.ref}</Link><span className="-mr-2 flex text-muted"><FavoriteButton fav={{ kind: 'verse', id: v.id, title: v.ref, body: v.text }} /><ShareButton text={v.text} reference={v.ref} /></span></div>
      <p className="text-sm leading-relaxed text-muted">{reflectionFor(v)}</p>
    </li>; })}</ul>
    {!hist.length && <Notice>Tu historial empezará con el versículo de hoy. <Link to="/" className="text-gold underline">Ir al inicio</Link></Notice>}
  </Page>;
}

export function OfflineCard() {
  const [p, setP] = useState<[number, number] | null>(null), [done, setDone] = useState(() => { try { return !!localStorage.getItem('zarzu.bibleOffline'); } catch { return false; } }), [err, setErr] = useState('');
  return <div>
    <Row icon="down" title={done ? 'Biblia descargada' : 'Descargar la Biblia'} detail={p ? `Descargando ${p[0]} de ${p[1]} libros…` : done ? 'Disponible sin conexión. Toca para actualizar.' : 'Unos 5 MB, para leer y buscar sin conexión.'}
      onClick={async () => { setErr(''); try { await downloadAll((a, b) => setP([a, b])); try { localStorage.setItem('zarzu.bibleOffline', '1'); } catch {} setDone(true); } catch { setErr('La descarga no se ha completado. Revisa tu conexión.'); } setP(null); }} />
    {err && <p className="pb-2 text-sm text-danger">{err}</p>}
  </div>;
}
void getState;
