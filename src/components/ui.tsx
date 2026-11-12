import { useEffect, useState, type ReactNode } from 'react';
import { goBack, navigate, shareImage } from '../lib/app.ts';
import { getState, saveProfile, toggleFavorite, useStore, type Favorite } from '../lib/store.ts';

const P: Record<string, ReactNode> = {
  home: <path d="M3.500 11.500 12 4l8.500 7.500M6 9.500V20h12V9.500M12 11v6M9.800 13.200h4.400" />,
  book: <path d="M7 3.500h11.500a.5.5 0 0 1 .5.5v16a.5.5 0 0 1-.5.5H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2ZM5 18.500a2 2 0 0 1 2-2h12M12 6v7M9.500 8.500h5" />,
  pray: <path d="M12 2.500v19M6.500 8h11" />,
  rosary: <><path d="M12 14.500v7M9.500 18h5" />{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <circle key={a} cx={12 + 5.500 * Math.cos((a * Math.PI) / 180)} cy={8.500 + 5.500 * Math.sin((a * Math.PI) / 180)} r="1.250" fill="currentColor" stroke="none" />)}</>,
  church: <path d="M12 2v4.500M10 4h4M12 6.500l5 4.500v9.500H7V11zM7 13.500l-3 2.500v4.500h3M17 13.500l3 2.500v4.500h-3M10 20.500v-3.500a2 2 0 0 1 4 0v3.500" />,
  chalice: <><circle cx="12" cy="4.800" r="2.300" /><path d="M7.500 9.500h9c0 3.800-1.700 5.800-4.500 5.800s-4.500-2-4.500-5.800ZM12 15.300v4.700M8.500 20.800h7" /></>,
  candle: <><path d="M9.300 11h5.400v9.500H9.300zM12 11V9.200M6.500 20.500h11" /><path d="M12 2.500c1.600 1.800 2.400 3 2.400 4.100a2.400 2.400 0 0 1-4.800 0c0-1.100.8-2.300 2.400-4.100Z" fill="currentColor" stroke="none" /></>,
  candleOff: <path d="M9.300 11h5.400v9.500H9.300zM12 11V8.500M6.500 20.500h11" />,
  saint: <><ellipse cx="12" cy="4.800" rx="5" ry="1.700" /><circle cx="12" cy="10.500" r="3.200" /><path d="M5.500 21c.7-4 3.200-6 6.500-6s5.800 2 6.500 6" /></>,
  sacred: <path d="M12 21s-7-4.200-7-9.300A3.900 3.900 0 0 1 12 9.400a3.900 3.900 0 0 1 7 2.300C19 16.800 12 21 12 21ZM12 2v5.500M9.800 4.200h4.400" />,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c1-4 4-6 7.5-6s6.500 2 7.500 6" /></>,
  back: <path d="m15 5-7 7 7 7" />, chevron: <path d="m9 5 7 7-7 7" />, close: <path d="M6 6l12 12M18 6 6 18" />,
  heart: <path d="M12 20s-7.500-4.600-7.500-10.200A4.300 4.300 0 0 1 12 7.300a4.300 4.300 0 0 1 7.500 2.500C19.500 15.400 12 20 12 20Z" />,
  share: <path d="M12 15V4m0 0L8 8m4-4 4 4M5 13v7h14v-7" />, search: <><circle cx="11" cy="11" r="6.500" /><path d="m16 16 4.500 4.500" /></>,
  chat: <path d="M4 4.500h16v12h-9.500L6 20.500v-4H4zM12 7v6.500M9.500 9.500h5" />, pin: <><path d="M12 21s7-6.500 7-11.500a7 7 0 1 0-14 0C5 14.500 12 21 12 21Z" /><circle cx="12" cy="9.500" r="2.500" /></>,
  calendar: <><rect x="4" y="5.500" width="16" height="14.500" rx="1.500" /><path d="M4 10h16M8.500 3.500v4M15.500 3.500v4" /></>, news: <><path d="M5 5h14v14.500H5z" /><path d="M8 9h8M8 12.500h8M8 16h5" /></>,
  star: <path d="m12 4 2.400 5.200 5.600.700-4.100 3.900 1.100 5.600-5-2.800-5 2.800 1.100-5.600L4 9.900l5.600-.700z" />, sun: <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.600 5.600 7 7M17 17l1.400 1.400M5.600 18.400 7 17M17 7l1.400-1.400" /></>,
  moon: <path d="M19 14.500A7.500 7.500 0 0 1 9.500 5a7.500 7.500 0 1 0 9.500 9.500Z" />, bell: <path d="M6 16.500V11a6 6 0 0 1 12 0v5.500l1.500 2h-15zM10 21h4" />,
  send: <path d="M5 12h13m0 0-5-5m5 5-5 5" />, trash: <path d="M5 7h14M10 7V4.500h4V7M7 7l1 13h8l1-13" />, phone: <path d="M6 4h3l1.500 4.500L8.500 10a12 12 0 0 0 5.500 5.500l1.500-2 4.500 1.500v3c0 1-1 2-2 2C10 20 4 14 4 6c0-1 1-2 2-2Z" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3.800 6 3.800 9s-.8 6-3.800 9c-3-3-3.800-6-3.800-9S9 6 12 3Z" /></>, route: <path d="M6 20a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5ZM18 9a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5ZM8 17.500h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.500" />,
  text: <path d="M4 18 8.500 6h1L14 18M5.500 14h7M16 18l2.500-7h.5l2.500 7M17 15.500h4" />, pen: <path d="M4 20h4L19 9a2.100 2.100 0 0 0-4-4L4 16v4ZM13.500 6.500l4 4" />, download: <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" />, target: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3" /></>,
  plus: <path d="M12 5v14M5 12h14" />, flame: <path d="M12.300 2.500c.700 3.100-1.400 4.300-2.700 6.100-.600-.700-.900-1.500-.900-2.300C6.800 8 5.600 10.200 5.600 12.800c0 4 2.900 6.700 6.400 6.700s6.400-2.700 6.400-6.700c0-4.300-3.400-7.100-6.100-10.300Z" />, play: <path d="M8 5.500v13l10.500-6.500z" />, check: <path d="m5 12.500 4.500 4.500L19 7.500" />, shield: <path d="M12 3.500 5 6v6c0 4.500 3 7.500 7 9 4-1.500 7-4.500 7-9V6z" />, down: <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />,
};
export function Icon({ name, size = 22, fill = false, className = '' }: { name: string; size?: number; fill?: boolean; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={fill ? 0 : 1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>{P[name]}</svg>;
}

export function Link({ to, children, className = '', label }: { to: string; children: ReactNode; className?: string; label?: string }) {
  return <a href={to} aria-label={label} className={className} onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); navigate(to); }}>{children}</a>;
}
/** Acceso destacado: tarjeta blanca con borde fino, icono y título. Para listas largas se usa Row dentro de .list. */
export function Tile({ to, icon, title, sub, className = '' }: { to: string; icon: string; title: ReactNode; sub?: ReactNode; className?: string }) {
  return <Link to={to} className={`press tile reveal flex min-h-[7.5rem] flex-col justify-between rounded-2xl border border-line bg-paper p-4 ${className}`}>
    <span className="niche"><Icon name={icon} size={20} /></span>
    <span className="mt-4 block"><span className="block text-[15.5px] font-semibold leading-snug tracking-[-.01em]">{title}</span>{sub && <span className="mt-0.5 block text-[13.5px] leading-snug text-muted">{sub}</span>}</span>
  </Link>;
}
export function Page({ title, back, right, children, subtitle }: { title: string; back?: string; right?: ReactNode; subtitle?: string; children: ReactNode }) {
  return <div className="mx-auto w-full max-w-2xl">
    <header className="page-bar safe-t sticky top-0 z-20 bg-paper/80 px-3 backdrop-blur-xl backdrop-saturate-150">
      <div className="relative flex min-h-11 items-center justify-between gap-1">
        <span aria-hidden="true" className="page-mini pointer-events-none absolute inset-x-14 top-1/2 truncate text-center text-[15px] font-semibold" data-title={title} />
        {back ? <button aria-label="Volver" className="press hoverable -ml-1 grid size-10 place-items-center rounded-full" onClick={() => goBack(back)}><Icon name="back" /></button> : <Wordmark className="px-2 md:invisible" />}
        {right && <div className="flex min-w-0 items-center">{right}</div>}
      </div>
    </header>
    <main className="px-5 pb-32 md:px-8 md:pb-16">
      <h1 className="rise mt-2 text-[2rem] leading-[1.1] md:mt-6 md:text-[2.4rem]">{title}</h1>
      {subtitle && <p className="rise mt-1.5 text-[15px] text-muted">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </main>
  </div>;
}
/** Logo de Zarzu: la llama de la zarza ardiente. */
export const Mark = ({ className = '' }: { className?: string }) => <svg viewBox="100 66 312 374" fill="currentColor" aria-hidden="true" className={className}><path d="M262 76c14 66 -30 92 -58 130 -12 -14 -18 -32 -18 -50 -40 36 -66 84 -66 138 0 86 62 142 136 142s136-58 136-142c0-92-72-150-130-218Z" /></svg>;
export const Wordmark = ({ className = '' }: { className?: string }) => <Link to="/" label="Zarzu, inicio" className={`flex items-center gap-2 text-[1.2rem] font-semibold leading-none tracking-[-.03em] ${className}`}><Mark className="h-[1.3rem] w-auto text-flame" />Zarzu</Link>;
export const LIT_SWATCH: Record<string, string> = { blanco: '#d6d3cb', rojo: '#d92d20', verde: '#1f8a4c', morado: '#6c3fc4', rosa: '#e1719c' };
export const LitDot = ({ color, className = 'size-2.5' }: { color: string; className?: string }) => <span className={`inline-block shrink-0 rounded-full ${className}`} style={{ background: LIT_SWATCH[color] }} />;
/** Cinta de misal con el color litúrgico. */
export const Ribbon = ({ color, className = '' }: { color: string; className?: string }) => <span aria-hidden="true" className={`ribbon shrink-0 ${className}`} style={{ background: LIT_SWATCH[color] }} />;
export const Section = ({ title, action, children, className = '' }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) => (
  <section className={`reveal mt-10 ${className}`}>{(title || action) && <div className="mb-3 flex items-baseline justify-between gap-3">{title && <h2 className="text-[1.15rem] leading-tight">{title}</h2>}{action}</div>}{children}</section>
);
export const Spinner = ({ label = 'Cargando…' }: { label?: string }) => <p role="status" className="flex items-center justify-center gap-2.5 py-8 text-sm text-muted"><span className="spinner" aria-hidden="true" />{label}</p>;
export const Notice = ({ tone = 'info', children, action }: { tone?: 'info' | 'warn' | 'error'; children: ReactNode; action?: ReactNode }) => (
  <div role={tone === 'error' ? 'alert' : undefined} className={`rounded-xl px-4 py-3 text-[14.5px] leading-snug ${tone === 'info' ? 'bg-surface text-ink-2' : tone === 'warn' ? 'bg-warn/10 text-ink' : 'bg-danger/10 text-ink'}`}>
    {children}{action && <div className="mt-2">{action}</div>}
  </div>
);
const BTN = { primary: 'bg-pop text-white hover:brightness-110 shadow-[inset_0_1px_0_rgba(255,255,255,.14)]', ghost: 'bg-surface text-ink hover:bg-sand', gold: 'bg-tile-sol text-ink hover:brightness-95' };
export const Button = ({ kind = 'primary', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: keyof typeof BTN }) => <button {...p} className={`press inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold tracking-[-.01em] transition-[filter,background-color,transform] disabled:pointer-events-none disabled:opacity-45 ${BTN[kind]} ${className}`} />;
export const Chip = ({ active, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) => <button {...p} aria-pressed={active} className={`press min-h-9 shrink-0 rounded-full border px-3.5 text-[14px] font-medium transition-colors duration-200 ${active ? 'border-ink bg-ink text-paper' : 'border-line bg-paper text-ink-2 hover:border-muted/50'}`} />;
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`min-h-12 w-full rounded-xl border border-transparent bg-surface px-4 text-[16px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-muted focus:border-pop focus:shadow-[0_0_0_4px_var(--pop-soft)] ${p.className ?? ''}`} />;
/** Fila de lista. Dentro de un contenedor .list forma un grupo como los ajustes del móvil. */
export const Row = ({ to, icon, title, detail, onClick }: { to?: string; icon?: string; title: ReactNode; detail?: ReactNode; onClick?: () => void }) => {
  const inner = <>{icon && <span className="row-icon niche !size-8 !rounded-[.6rem]"><Icon name={icon} size={18} /></span>}<span className="min-w-0 flex-1"><span className="block text-[15.5px] font-medium leading-snug">{title}</span>{detail && <span className="block text-[13.5px] leading-snug text-muted">{detail}</span>}</span><Icon name="chevron" size={16} className="text-muted/70" /></>;
  const cls = 'row press hoverable flex min-h-14 w-full items-center gap-3 py-2.5 text-left transition-colors';
  return to ? <Link to={to} className={cls}>{inner}</Link> : <button onClick={onClick} className={cls}>{inner}</button>;
};
/** Grupo de filas con título opcional. */
export const List = ({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) => <div className={`reveal ${className}`}>{title && <h2 className="mb-2 px-1 text-[13px] font-medium text-muted">{title}</h2>}<div className="list">{children}</div></div>;

export function useToast(): [ReactNode, (m: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 2600); return () => clearTimeout(t); }, [msg]);
  return [msg ? <div role="status" className="sheet fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 text-[14px] font-medium text-paper shadow-[var(--shadow-float)] md:bottom-8">{msg}</div> : null, setMsg];
}
export function FavoriteButton({ fav, className = '' }: { fav: Omit<Favorite, 'at'>; className?: string }) {
  const on = useStore((s) => s.favorites.some((f) => f.kind === fav.kind && f.id === fav.id));
  return <button aria-pressed={on} aria-label={on ? 'Quitar de favoritos' : 'Guardar en favoritos'} onClick={() => toggleFavorite(fav)} className={`press hoverable grid size-10 place-items-center rounded-full ${className}`}><span key={on ? 'on' : 'off'} className={on ? 'tab-pop' : ''}><Icon name="heart" size={20} fill={on} className={on ? 'text-gold' : ''} /></span></button>;
}
export function ShareButton({ text, reference, kicker, className = '' }: { text: string; reference: string; kicker?: string; className?: string }) {
  const [busy, setBusy] = useState(false); const [toast, show] = useToast();
  return <><button aria-label="Compartir como imagen" disabled={busy} onClick={async () => { setBusy(true); const r = await shareImage({ text, reference, kicker }).catch(() => null); setBusy(false); if (r === 'downloaded') show('Imagen guardada en descargas'); if (r === null) show('No se ha podido crear la imagen'); }} className={`press hoverable grid size-10 place-items-center rounded-full ${className}`}><Icon name="share" size={20} /></button>{toast}</>;
}
export const Paragraphs = ({ text }: { text: string }) => <>{text.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</>;

/** Cambia entre modo claro y oscuro. Con View Transitions, el nuevo modo se abre en círculo desde el botón. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  useStore((s) => s.settings.theme);
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const flip = (e: React.MouseEvent<HTMLButtonElement>) => {
    const settings = getState().settings, next = dark ? 'light' : 'dark';
    const apply = () => saveProfile({ settings: { ...settings, theme: next } });
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void>; updateCallbackDone: Promise<void> } };
    if (!doc.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(); return; }
    const r = e.currentTarget.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.documentElement.dataset.nav = 'theme';
    const vt = doc.startViewTransition(apply);
    vt.finished.catch(() => {}); vt.updateCallbackDone.catch(() => {});
    vt.ready.then(() => document.documentElement.animate({ clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] }, { duration: 520, easing: 'cubic-bezier(.3,.7,.2,1)', pseudoElement: '::view-transition-new(root)' })).catch(() => {});
  };
  return <button onClick={flip} aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} className={`press hoverable grid size-10 place-items-center rounded-full text-ink ${className}`}>
    <span key={dark ? 'd' : 'l'} className="theme-spin"><Icon name={dark ? 'sun' : 'moon'} size={19} /></span>
  </button>;
}
