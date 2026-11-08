import { useEffect, useMemo, useState } from 'react';
import { Button, Chip, FavoriteButton, Icon, Link, Notice, Page, Paragraphs, Row, Section, ShareButton, Tile } from '../components/ui.tsx';
import { CATEGORIES, MYSTERIES, PRAYERS, chapletSteps, mysteriesOfDay, rosarySteps, type Step } from '../data/prayers.ts';
import { logActivity, setState, useStore, getState } from '../lib/store.ts';
import { CONFESSION_STEPS, EXAMEN, EXAMEN_INTRO, EXAMEN_PRAYER } from '../data/examen.ts';

export function PrayerHome() {
  const key = mysteriesOfDay(new Date().getDay()), m = MYSTERIES[key];
  return <Page title="Oración">
    <div className="grid grid-cols-2 gap-2.5">
      <Tile to="/oracion/rosario" icon="rosary" title="Rezar el rosario" sub={`Hoy, ${m.name.toLowerCase()}`} className="col-span-2 c-ink" />
      <Tile to="/oracion/coronilla" icon="sacred" title="Coronilla de la Misericordia" />
      <Tile to="/oracion/examen" icon="candle" title="Examen de conciencia" sub="Para prepararte a la confesión" />
    </div>
    {CATEGORIES.map((c) => <Section key={c} title={c}>{PRAYERS.filter((p) => p.category === c).map((p) => <Row key={p.id} to={`/oracion/${p.id}`} title={p.title} />)}</Section>)}
  </Page>;
}

export function PrayerDetail({ id }: { id: string }) {
  const p = PRAYERS.find((x) => x.id === id);
  useEffect(() => { if (p) logActivity({ kind: 'prayer', ref: p.id, label: p.title }); }, [p]);
  if (!p) return <Page title="Oración" back="/oracion"><Notice>Esa oración no existe.</Notice></Page>;
  return <Page title={p.title} back="/oracion" right={<span className="flex"><FavoriteButton fav={{ kind: 'prayer', id: p.id, title: p.title, link: `/oracion/${p.id}` }} /><ShareButton text={p.text.replace(/\n+/g, ' ').slice(0, 420)} reference={p.title} /></span>}>
    <div className="reading max-w-[34em] text-[calc(1.5rem*var(--reading-scale))] leading-[1.42]"><Paragraphs text={p.text} /></div>
    {p.note && <p className="mt-6 text-sm text-muted">{p.note}</p>}
  </Page>;
}

/** Aro de cuentas: un toque avanza y el número dice por dónde vas. */
function BeadRing({ beads, index, label, onPick }: { beads: Step[]; index: number; label: string; onPick: (i: number) => void }) {
  const R = 124, C = 150, n = beads.length, m = label.match(/(\d+) de (\d+)/);
  return <div className="relative mx-auto aspect-square w-full max-w-[19rem]">
    <svg viewBox="0 0 300 300" className="absolute inset-0 size-full" aria-hidden="true">
      {beads.map((b, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2, x = C + R * Math.cos(a), y = C + R * Math.sin(a), big = b.bead === 'large', past = i < index, cur = i === index;
        return <circle key={b.id} cx={x} cy={y} r={big ? 12 : 9} className="bead" style={{ transform: cur ? 'scale(1.5)' : undefined, fill: cur ? 'var(--gold)' : past ? 'var(--ink)' : 'var(--sand)' }} />; })}
    </svg>
    {beads.map((b, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; return <button key={b.id} aria-label={b.label} onClick={(e) => { e.stopPropagation(); onPick(i); }} className="absolute size-9 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${((C + R * Math.cos(a)) / 300) * 100}%`, top: `${((C + R * Math.sin(a)) / 300) * 100}%` }} />; })}
    <div className="pointer-events-none absolute inset-0 grid place-items-center text-center" aria-live="polite">
      <div key={label} className="pop px-14">{m ? <><p className="font-serif text-[5.85rem] leading-[1]">{m[1]}</p><p className="mt-1 text-[15px] text-muted">de {m[2]}</p></> : <p className="font-serif text-[1.76rem] leading-[1.02]">{label}</p>}</div>
    </div>
  </div>;
}

function BeadPrayer({ title, steps, storageKey, activity, subtitle, footer }: { title: string; steps: Step[]; storageKey: string; activity: { kind: 'rosary' | 'prayer'; ref: string; label: string }; subtitle?: string; footer?: React.ReactNode }) {
  const saved = useStore((s) => s.rosary?.[storageKey] as number | undefined);
  const [i, setI] = useState(() => Math.min(saved ?? 0, steps.length - 1));
  const [finished, setFinished] = useState(false);
  const step = steps[i];
  const persist = (n: number) => setState({ rosary: { ...(getState().rosary ?? {}), [storageKey]: n } });
  const go = (n: number) => {
    if (n >= steps.length) { setFinished(true); persist(0); logActivity(activity); navigator.vibrate?.([20, 60, 20]); return; }
    const c = Math.max(0, n); setI(c); persist(c); navigator.vibrate?.(steps[c].bead === 'large' ? 25 : 10);
  };
  const beads = useMemo(() => steps.filter((s) => s.group === step.group && s.bead !== 'none'), [steps, step.group]);
  const beadIndex = beads.findIndex((b) => steps.indexOf(b) >= i);
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(i + 1); } if (e.key === 'ArrowLeft') go(i - 1); }; addEventListener('keydown', f); return () => removeEventListener('keydown', f); });
  if (finished) return <Page title="Oración terminada" back="/oracion"><p className="reading">Queda en tu historial de hoy. Que la paz te acompañe.</p><div className="mt-6 flex flex-wrap gap-2.5"><Button kind="ghost" onClick={() => { setFinished(false); setI(0); }}>Rezar de nuevo</Button><Link to="/oracion"><Button>Volver a Oración</Button></Link></div></Page>;
  return <Page title={title} back="/oracion" subtitle={subtitle}>
    <div role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={i + 1} aria-label="Avance de la oración" className="h-[3px] overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-pop transition-all" style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></div>
    <div onClick={() => go(i + 1)} className="mt-4 cursor-pointer select-none">
      <p className="text-center text-sm font-bold text-gold">{step.group}</p>
      {beads.length > 1 ? <BeadRing beads={beads} index={Math.max(0, beadIndex)} label={step.label} onPick={(n) => go(steps.indexOf(beads[n]))} /> : <p className="py-12 text-center font-serif text-[2.4rem] leading-[1.02]">{step.label}</p>}
    </div>
    {step.mystery && <div className="mt-3 flex items-center gap-3">
      <div className="min-w-0"><h2 className="text-[1.24rem] leading-[1.08]">{step.mystery.title}</h2><p className="mt-0.5 text-sm text-muted">Fruto: {step.mystery.fruit.toLowerCase()}. {step.mystery.ref}</p></div>
    </div>}
    <div className="mt-4">
      <p className="text-sm font-bold">{step.label}</p>
      <div className="reading mt-1"><Paragraphs text={step.id.startsWith('mi-') ? 'Contempla este misterio un momento, en silencio.' : step.text} /></div>
    </div>
    <div className="bottom-fade sticky bottom-[4.8rem] z-10 -mx-5 mt-5 flex gap-2 px-5 pb-2 pt-6 md:bottom-0 md:pb-4">
      <Button kind="ghost" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Anterior"><Icon name="back" size={18} /></Button>
      <Button className="flex-1 !min-h-14 text-[17px]" onClick={() => go(i + 1)}>{i === steps.length - 1 ? 'Terminar' : 'Siguiente'}</Button>
    </div>
    {footer}
  </Page>;
}

export function RosaryScreen() {
  const auto = mysteriesOfDay(new Date().getDay());
  const [key, setKey] = useState<string>(auto);
  return <div key={key}><BeadPrayer title="Santo Rosario" subtitle={MYSTERIES[key].days} storageKey={`rosario-${key}`} steps={rosarySteps(key)} activity={{ kind: 'rosary', ref: `rosario-${key}`, label: `Rosario: ${MYSTERIES[key].name.toLowerCase()}` }}
    footer={<Section title="Cambiar de misterios"><div className="no-bar -mx-5 flex gap-2 overflow-x-auto px-5">{Object.entries(MYSTERIES).map(([k, m]) => <Chip key={k} active={k === key} onClick={() => setKey(k)}>{m.name.replace('Misterios ', '').replace(/^./, (c) => c.toUpperCase())}{k === auto ? ' (hoy)' : ''}</Chip>)}</div></Section>} /></div>;
}
export const ChapletScreen = () => <BeadPrayer title="Coronilla de la Divina Misericordia" subtitle="Santa Faustina Kowalska" storageKey="coronilla" steps={chapletSteps()} activity={{ kind: 'prayer', ref: 'coronilla', label: 'Coronilla de la Divina Misericordia' }} />;

/** Examen de conciencia guiado. Lo que marcas solo vive en esta pantalla: no se guarda ni se sincroniza. */
export function ExamenScreen() {
  const [i, setI] = useState(0), [marked, setMarked] = useState<Set<string>>(() => new Set());
  const total = EXAMEN.length + 1, section = EXAMEN[i - 1];
  const toggle = (q: string) => setMarked((s) => { const n = new Set(s); if (n.has(q)) n.delete(q); else n.add(q); return n; });
  const go = (n: number) => { setI(n); scrollTo({ top: 0, behavior: 'smooth' }); };
  const contrition = PRAYERS.find((p) => p.id === 'senor-mio');
  return <Page title="Examen de conciencia" back="/oracion" subtitle="Para prepararte a la confesión">
    <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={i} aria-label="Progreso del examen"><div className="h-full rounded-full bg-pop transition-[width] duration-500" style={{ width: `${(i / total) * 100}%` }} /></div>
    {i === 0 && <div key="intro" className="slide">
      {EXAMEN_INTRO.map((p) => <p key={p} className="mt-3 text-[17px] leading-relaxed">{p}</p>)}
      <blockquote className="mt-5 rounded-[22px] bg-surface p-4 font-serif text-[1.15rem] leading-snug">{EXAMEN_PRAYER}</blockquote>
      <Notice><b>Nada de lo que marques se guarda.</b> Solo sirve para que lo recuerdes al final, y se borra al salir de esta pantalla.</Notice>
      <Button className="mt-5 w-full !min-h-14 text-[17px]" onClick={() => go(1)}>Empezar</Button>
    </div>}
    {section && <div key={section.id} className="slide">
      <p className="text-sm font-bold text-gold">{section.summary}. {i} de {EXAMEN.length}</p>
      <h2 className="mt-1 text-[1.8rem] leading-[1.08]">{section.title}</h2>
      <ul className="mt-4 space-y-2">{section.questions.map((q) => { const on = marked.has(q); return <li key={q}>
        <button onClick={() => toggle(q)} aria-pressed={on} className={`press flex w-full items-start gap-3 rounded-[20px] p-4 text-left text-[16px] leading-snug transition-colors duration-300 ${on ? 'c-ink' : 'bg-surface'}`}>
          <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors ${on ? 'border-pop bg-pop text-white' : 'border-muted'}`}>{on && <Icon name="check" size={14} />}</span>{q}
        </button></li>; })}</ul>
      <p className="mt-3 text-sm text-muted">Marca lo que quieras recordar al confesarte.</p>
      <div className="bottom-fade sticky bottom-[4.8rem] z-10 -mx-5 mt-5 flex gap-2 px-5 pb-2 pt-6 md:bottom-0 md:pb-4">
        <Button kind="ghost" aria-label="Anterior" onClick={() => go(i - 1)}><Icon name="back" size={18} /></Button>
        <Button className="flex-1 !min-h-14 text-[17px]" onClick={() => go(i + 1)}>{i === EXAMEN.length ? 'Terminar' : 'Siguiente'}</Button>
      </div>
    </div>}
    {i === total && <div key="fin" className="slide">
      <h2 className="text-[1.8rem] leading-[1.08]">Dios te espera con los brazos abiertos</h2>
      {marked.size > 0 ? <Section title="Para recordar"><ul className="space-y-1.5">{[...marked].map((q) => <li key={q} className="flex gap-2 text-[16px] leading-snug"><Icon name="check" size={16} className="mt-1 shrink-0 text-gold" />{q}</li>)}</ul></Section>
        : <p className="mt-3 text-[16px] leading-relaxed">No has marcado nada. Aun así, la confesión frecuente ayuda a crecer y da la gracia de Dios.</p>}
      <Section title="Cómo confesarte"><ol className="space-y-3">{CONFESSION_STEPS.map((s, n) => <li key={s.title} className="flex gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface font-bold">{n + 1}</span><span><b className="block">{s.title}</b><span className="text-[15px] leading-snug text-muted">{s.text}</span></span></li>)}</ol></Section>
      {contrition && <Section title="Acto de contrición"><p className="reading whitespace-pre-line">{contrition.text}</p></Section>}
      <div className="mt-8 flex flex-col gap-2">
        <Link to="/descubrir/templos"><Button className="w-full"><Icon name="church" size={18} />Buscar una iglesia cerca</Button></Link>
        <Button kind="ghost" onClick={() => { setMarked(new Set()); go(0); }}>Borrar lo marcado y empezar de nuevo</Button>
      </div>
    </div>}
  </Page>;
}
