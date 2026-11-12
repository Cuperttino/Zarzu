import { useEffect, useMemo } from 'react';
import { Button, Icon, Page } from '../components/ui.tsx';
import { navigate } from '../lib/app.ts';
import { BADGES, earned, progressOf, type Badge } from '../lib/badges.ts';
import { getState, setState, useStore } from '../lib/store.ts';

export function Medal({ badge, got, size = 'md' }: { badge: Badge; got: boolean; size?: 'md' | 'lg' }) {
  const big = size === 'lg';
  return <span className={`relative grid shrink-0 place-items-center rounded-full ${big ? 'size-32' : 'size-16'} ${got ? `medal-on ${big ? 'medal-in' : ''}` : 'bg-surface text-muted/70'}`} aria-hidden="true">
    {got && big && <span className="ring-out" />}
    <Icon name={badge.icon} size={big ? 56 : 28} fill={got && badge.icon === 'flame'} />
  </span>;
}

export function BadgesScreen() {
  const act = useStore((s) => s.activity);
  const p = useMemo(() => progressOf(act), [act]);
  const got = new Set(earned(p).map((b) => b.id));
  return <Page title="Insignias" back="/perfil" subtitle={`${got.size} de ${BADGES.length} conseguidas`}>
    <ul className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line sm:grid-cols-3 [&>li]:border-b [&>li]:border-r [&>li]:border-line">{BADGES.map((b) => {
      const v = Math.min(b.value(p), b.goal), on = got.has(b.id);
      return <li key={b.id} className="reveal -mb-px -mr-px flex flex-col items-center p-5 text-center">
        <Medal badge={b} got={on} />
        <p className={`mt-3 text-[15px] font-semibold leading-tight ${on ? '' : 'text-ink-2'}`}>{b.title}</p>
        <p className="mt-1 text-[13px] leading-snug text-muted">{b.text}</p>
        {!on && <div className="mt-3 w-full"><div className="h-[3px] overflow-hidden rounded-full bg-sand"><div className="grow-x h-full rounded-full bg-pop" style={{ width: `${(v / b.goal) * 100}%` }} /></div><p className="tabular mt-1.5 text-[12px] text-muted">{v} de {b.goal}</p></div>}
      </li>;
    })}</ul>
    <p className="mt-6 text-[13.5px] text-muted">Las insignias se calculan con lo que lees y rezas en Zarzu. Son solo para ti: nadie más las ve.</p>
  </Page>;
}

/** Celebra cada insignia nueva una sola vez. La primera vez se dan por vistas las que ya tenías. */
export function BadgeCelebration() {
  const act = useStore((s) => s.activity), seen = useStore((s) => s.badgesSeen), onboarded = useStore((s) => s.onboarded);
  const got = useMemo(() => earned(progressOf(act)).map((b) => b.id), [act]);
  useEffect(() => { if (seen === null) setState({ badgesSeen: got }); }, [seen, got]);
  const fresh = seen ? BADGES.filter((b) => got.includes(b.id) && !seen.includes(b.id)) : [];
  if (!onboarded || !fresh.length) return null;
  const b = fresh[0];
  const close = () => setState({ badgesSeen: [...new Set([...(getState().badgesSeen ?? []), ...fresh.map((x) => x.id)])] });
  return <div className="fade-in fixed inset-0 z-50 grid place-items-center bg-black/35 p-6 backdrop-blur-[6px]" role="dialog" aria-modal="true" aria-labelledby="badge-title" onClick={close}>
    <div className="sheet relative w-full max-w-sm overflow-hidden rounded-3xl bg-paper p-7 text-center shadow-[var(--shadow-float)]" onClick={(e) => e.stopPropagation()}>
      <p className="text-[13px] font-medium text-muted">{fresh.length > 1 ? 'Nuevas insignias' : 'Nueva insignia'}</p>
      <div className="mt-5 flex justify-center"><Medal badge={b} got size="lg" /></div>
      <h2 id="badge-title" className="rise mt-6 text-[1.75rem] font-semibold leading-tight tracking-[-.025em]" style={{ animationDelay: '.25s' }}>{b.title}</h2>
      <p className="mt-2 text-[15px] text-muted">{b.text}</p>
      {fresh.length > 1 && <p className="mt-2 text-[14.5px] font-medium">Y {fresh.length - 1 === 1 ? 'otra más' : `${fresh.length - 1} más`}: {fresh.slice(1).map((x) => x.title).join(', ')}.</p>}
      <Button className="mt-6 w-full" onClick={close}>¡Gracias, Señor!</Button>
      <button onClick={() => { close(); navigate('/perfil/insignias'); }} className="mt-2 block min-h-10 w-full text-[14.5px] font-medium text-gold">Ver todas las insignias</button>
    </div>
  </div>;
}
