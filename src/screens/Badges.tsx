import { useEffect, useMemo } from 'react';
import { Button, Icon, Page } from '../components/ui.tsx';
import { navigate } from '../lib/app.ts';
import { BADGES, earned, progressOf, type Badge } from '../lib/badges.ts';
import { getState, setState, useStore } from '../lib/store.ts';

export function Medal({ badge, got, size = 'md' }: { badge: Badge; got: boolean; size?: 'md' | 'lg' }) {
  const big = size === 'lg';
  return <span className={`relative grid shrink-0 place-items-center rounded-full ${big ? 'size-32' : 'size-16'} ${got ? 'medal-on' : 'bg-surface text-muted'}`} aria-hidden="true">
    {got && <span className={`absolute inset-[7%] rounded-full border-2 border-dashed border-white/60 ${big ? 'medal-spin' : ''}`} />}
    <Icon name={badge.icon} size={big ? 56 : 28} fill={got && badge.icon === 'flame'} />
  </span>;
}

export function BadgesScreen() {
  const act = useStore((s) => s.activity);
  const p = useMemo(() => progressOf(act), [act]);
  const got = new Set(earned(p).map((b) => b.id));
  return <Page title="Insignias" back="/perfil" subtitle={`${got.size} de ${BADGES.length} conseguidas`}>
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{BADGES.map((b) => {
      const v = Math.min(b.value(p), b.goal), on = got.has(b.id);
      return <li key={b.id} className={`reveal flex flex-col items-center rounded-[22px] p-4 text-center ${on ? 'c-ink' : 'bg-surface'}`}>
        <Medal badge={b} got={on} />
        <p className="mt-3 font-serif text-[1.05rem] leading-tight">{b.title}</p>
        <p className="mt-1 text-sm leading-tight text-muted">{b.text}</p>
        {!on && <div className="mt-3 w-full"><div className="h-1.5 overflow-hidden rounded-full bg-paper"><div className="h-full rounded-full bg-pop" style={{ width: `${(v / b.goal) * 100}%` }} /></div><p className="mt-1 text-xs text-muted">{v} de {b.goal}</p></div>}
      </li>;
    })}</ul>
    <p className="mt-6 text-sm text-muted">Las insignias se calculan con lo que lees y rezas en Zarzu. Son solo para ti: nadie más las ve.</p>
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
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="badge-title" onClick={close}>
    <div className="pop relative w-full max-w-sm overflow-hidden rounded-[32px] bg-paper p-7 text-center" onClick={(e) => e.stopPropagation()}>
      <div aria-hidden="true" className="confetti">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: `${(i * 7.3) % 100}%`, animationDelay: `${(i % 7) * 0.08}s`, background: i % 3 ? 'var(--sun)' : 'var(--pop)' }} />)}</div>
      <p className="text-sm font-bold text-gold">{fresh.length > 1 ? 'Nuevas insignias' : 'Nueva insignia'}</p>
      <div className="mt-4 flex justify-center"><Medal badge={b} got size="lg" /></div>
      <h2 id="badge-title" className="mt-5 text-[2rem] leading-none">{b.title}</h2>
      <p className="mt-2 text-[16px] text-muted">{b.text}</p>
      {fresh.length > 1 && <p className="mt-2 text-[15px] font-bold">Y {fresh.length - 1 === 1 ? 'otra más' : `${fresh.length - 1} más`}: {fresh.slice(1).map((x) => x.title).join(', ')}.</p>}
      <Button className="mt-6 w-full" onClick={close}>¡Gracias, Señor!</Button>
      <button onClick={() => { close(); navigate('/perfil/insignias'); }} className="mt-3 block min-h-10 w-full text-[15px] font-bold text-gold">Ver todas las insignias</button>
    </div>
  </div>;
}
