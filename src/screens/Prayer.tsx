import { useEffect, useMemo, useState } from 'react';
import { Button, Chip, FavoriteButton, Icon, Link, Notice, Page, Paragraphs, Row, Section, ShareButton, Tile } from '../components/ui.tsx';
import { CATEGORIES, MYSTERIES, PRAYERS, chapletSteps, mysteriesOfDay, rosarySteps, type Step } from '../data/prayers.ts';
import { logActivity, setState, useStore, getState } from '../lib/store.ts';

export function PrayerHome() {
  const key = mysteriesOfDay(new Date().getDay()), m = MYSTERIES[key];
  return <Page title="Oración">
    <div className="grid grid-cols-2 gap-2.5">
      <Tile to="/oracion/rosario" icon="rosary" title="Rezar el rosario" sub={`Hoy, ${m.name.toLowerCase()}`} className="col-span-2 c-ink" />
      <Tile to="/oracion/coronilla" icon="sacred" title="Coronilla de la Misericordia" className="col-span-2" />
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
