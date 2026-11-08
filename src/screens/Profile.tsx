import { useEffect, useMemo, useState } from 'react';
import { Button, Chip, Icon, Input, Link, Notice, Page, Row, Section, Spinner } from '../components/ui.tsx';
import { AuthError, authAvailable, config, deleteLocalSession, getSession, onAuth, recover, rest, signIn, signOut, signUp, updatePassword } from '../lib/supabase.ts';
import { pull, saveProfile, useStore, type Reminder } from '../lib/store.ts';
import { disablePush, enablePush, navigate, pushSupported, usePromise, api } from '../lib/app.ts';
import { addDays, fullDate, parse, shortDate, today } from '../lib/dates.ts';
import { OfflineCard } from './Bible.tsx';

function useSession() { const [s, set] = useState(getSession()); useEffect(() => onAuth(() => set(getSession())), []); return s; }
const useAdmin = (uid?: string) => usePromise(async () => (uid && authAvailable() ? (await rest<unknown[]>('app_admins?select=user_id')).length > 0 : false), [uid]);

export function streakOf(days: Set<string>, t = today()) { let n = 0, d = days.has(t) ? t : addDays(t, -1); while (days.has(d)) { n++; d = addDays(d, -1); } return n; }

export function ProfileHome() {
  const s = useSession(), name = useStore((x) => x.name), place = useStore((x) => x.place), act = useStore((x) => x.activity), favs = useStore((x) => x.favorites), admin = useAdmin(s?.user.id);
  const streak = useMemo(() => streakOf(new Set(act.map((a) => a.day))), [act]);
  return <Page title={name || "Perfil"}>
    <p className="text-[15px] text-muted">{s ? s.user.email : 'Tus datos están solo en este dispositivo'}</p>
    <div className="mt-4 flex items-end gap-2"><span className="font-serif text-[4.29rem] leading-[1]">{streak}</span><Icon name='flame' fill={streak > 0} size={44} className={`mb-0.5 ${streak ? 'text-flame' : 'text-muted'}`} /><span className="mb-1 text-[15px] leading-tight text-muted">{streak === 1 ? 'día de racha' : 'días de racha'}</span></div>
    {place && <p className="mt-2 flex items-center gap-1 text-sm text-muted"><Icon name="pin" size={14} />{place.name}</p>}
    {!s && authAvailable() && <Link to="/perfil/entrar" className="mt-4 block"><Button className="w-full">Entrar o crear cuenta</Button></Link>}
    {!authAvailable() && <div className="mt-4"><Notice>Las cuentas y la sincronización entre dispositivos se activarán cuando la app publicada se conecte a Supabase. Mientras tanto, todo se guarda en este dispositivo.</Notice></div>}
    <Section className="!mt-5"><div>
      <Row icon="heart" to="/perfil/favoritos" title="Favoritos" detail={favs.length === 1 ? '1 guardado' : `${favs.length} guardados`} />
      <Row icon="flame" to="/perfil/estadisticas" title="Estadísticas" detail="Tu lectura y tu oración" />
      <Row icon="book" to="/perfil/historial" title="Historial" detail="Lecturas y oraciones" />
      <Row icon="bell" to="/perfil/ajustes" title="Ajustes" detail="Apariencia, recordatorios y datos" />
      <OfflineCard />
      <Row icon="shield" to="/privacidad" title="Privacidad y fuentes" />
      {admin.data && <Row icon="text" to="/perfil/admin" title="Administración" detail="Horarios confirmados y contenido" />}
    </div></Section>
    {s && <div className="mt-6"><Button kind="ghost" className="w-full" onClick={() => void signOut()}>Cerrar sesión</Button></div>}
  </Page>;
}

export function AuthScreen() {
  const [mode, setMode] = useState<'in' | 'up' | 'forgot'>('in'), [email, setEmail] = useState(''), [pw, setPw] = useState(''), [name, setName] = useState(useStore((s) => s.name)), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  if (!authAvailable()) return <Page title="Cuenta" back="/perfil"><Notice>Las cuentas todavía no están activadas en este servidor.</Notice></Page>;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true);
    try {
      if (mode === 'forgot') { await recover(email); setMsg('Si existe una cuenta con ese correo, recibirás un enlace para cambiar la contraseña.'); }
      else if (mode === 'in') { await signIn(email, pw); await pull().catch(() => {}); navigate('/perfil', true); }
      else if (pw.length < 8) setErr('La contraseña debe tener al menos 8 caracteres.');
      else { const r = await signUp(email, pw, name); if (r === 'confirm') setMsg('Te hemos enviado un correo. Abre el enlace para confirmar tu cuenta.'); else { saveProfile({ name }); navigate('/perfil', true); } }
    } catch (x) { setErr(x instanceof AuthError ? x.message : 'Sin conexión. Vuelve a intentarlo.'); }
    setBusy(false);
  };
  return <Page title={mode === 'in' ? 'Entrar' : mode === 'up' ? 'Crear cuenta' : 'Recuperar contraseña'} back="/perfil">
    <form onSubmit={submit} className="mx-auto max-w-md space-y-3">
      {mode === 'up' && <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" aria-label="Tu nombre" autoComplete="given-name" />}
      <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo electrónico" aria-label="Correo electrónico" autoComplete="email" />
      {mode !== 'forgot' && <Input required type="password" value={pw} minLength={mode === 'up' ? 8 : undefined} onChange={(e) => setPw(e.target.value)} placeholder="Contraseña" aria-label="Contraseña" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />}
      {err && <Notice tone="error">{err}</Notice>}{msg && <Notice>{msg}</Notice>}
      <Button className="w-full" disabled={busy}>{busy ? 'Un momento…' : mode === 'in' ? 'Entrar' : mode === 'up' ? 'Crear cuenta' : 'Enviar enlace'}</Button>
      <div className="flex justify-between gap-2 pt-1 text-sm">
        <button type="button" className="min-h-11 text-gold" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>{mode === 'in' ? 'Crear una cuenta' : 'Ya tengo cuenta'}</button>
        {mode === 'in' && <button type="button" className="min-h-11 text-muted" onClick={() => setMode('forgot')}>He olvidado la contraseña</button>}
      </div>
      {mode === 'up' && <p className="text-xs leading-relaxed text-muted">Lo que ya tengas en este dispositivo pasará a tu cuenta. Consulta <Link className="underline" to="/privacidad">la privacidad</Link>.</p>}
    </form>
  </Page>;
}
export function PasswordScreen() {
  const [pw, setPw] = useState(''), [msg, setMsg] = useState(''), [err, setErr] = useState('');
  return <Page title="Nueva contraseña" back="/perfil"><form className="mx-auto max-w-md space-y-3" onSubmit={async (e) => { e.preventDefault(); setErr(''); try { await updatePassword(pw); setMsg('Contraseña cambiada.'); } catch (x) { setErr((x as Error).message); } }}>
    <Input type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Nueva contraseña (8 caracteres o más)" aria-label="Nueva contraseña" autoComplete="new-password" />
    {err && <Notice tone="error">{err}</Notice>}{msg && <Notice>{msg}</Notice>}<Button className="w-full">Cambiar contraseña</Button></form></Page>;
}

const LABEL: Record<Reminder['id'], [string, string]> = { morning: ['Oración de la mañana', 'Para empezar el día'], gospel: ['Evangelio diario', 'Con la cita de hoy'], evening: ['Oración de la noche', 'Antes de descansar'] };
export function SettingsScreen() {
  const settings = useStore((s) => s.settings), name = useStore((s) => s.name), n = useStore((s) => s.notifications), place = useStore((s) => s.place), [msg, setMsg] = useState(''), session = useSession();
  const setReminder = (id: Reminder['id'], p: Partial<Reminder>) => saveProfile({ notifications: { ...n, reminders: n.reminders.map((r) => (r.id === id ? { ...r, ...p } : r)) } });
  return <Page title="Ajustes" back="/perfil">
    <label className="block"><span className="text-sm text-muted">Tu nombre, para el saludo</span><Input className="mt-1" value={name} maxLength={40} onChange={(e) => saveProfile({ name: e.target.value })} /></label>
    <Section title="Apariencia">
      <div className="flex gap-2">{([['light', 'Claro'], ['dark', 'Oscuro'], ['auto', 'Como el móvil']] as const).map(([k, l]) => <Chip key={k} active={settings.theme === k} onClick={() => saveProfile({ settings: { ...settings, theme: k } })}>{l}</Chip>)}</div>
      <p className="mt-4 text-sm text-muted">Tamaño de la letra de lectura</p>
      <div className="mt-2 flex items-center gap-3"><input aria-label="Tamaño de letra" type="range" min="0.9" max="1.4" step="0.05" value={settings.readingScale} onChange={(e) => saveProfile({ settings: { ...settings, readingScale: +e.target.value } })} className="flex-1 accent-[var(--gold)]" /><span className="w-12 text-right text-sm">{Math.round(settings.readingScale * 100)} %</span></div>
      <p className="reading mt-2 text-muted">Este es el tamaño con el que leerás.</p>
    </Section>
    <Section title="Recordatorios">
      <p className="text-[15px] leading-relaxed text-muted">Como mucho uno por cada opción al día, a la hora que elijas. Nunca publicidad.</p>
      {n.enabled ? <Button kind="ghost" className="mt-3" onClick={() => void disablePush()}>Desactivar recordatorios</Button> : <Button className="mt-3" onClick={async () => setMsg((await enablePush().catch((e: Error) => e.message)) ?? 'Recordatorios activados.')}><Icon name="bell" size={18} />Activar recordatorios</Button>}
      {msg && <div className="mt-3"><Notice>{msg}</Notice></div>}
      {!pushSupported() && /iPhone|iPad/.test(navigator.userAgent) && <p className="mt-2 text-sm text-muted">En iPhone funcionan al añadir Zarzu a la pantalla de inicio desde Safari.</p>}
      <ul className="mt-3">{n.reminders.map((r) => <li key={r.id} className="flex items-center gap-3 border-b border-line py-3">
        <input id={`r-${r.id}`} type="checkbox" checked={r.enabled} onChange={(e) => setReminder(r.id, { enabled: e.target.checked })} className="size-5 accent-[var(--gold)]" />
        <label htmlFor={`r-${r.id}`} className="min-w-0 flex-1"><span className="block font-medium">{LABEL[r.id][0]}</span><span className="text-sm text-muted">{LABEL[r.id][1]}</span></label>
        <input type="time" aria-label={`Hora de ${LABEL[r.id][0]}`} value={r.time} onChange={(e) => setReminder(r.id, { time: e.target.value })} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-ink" />
      </li>)}</ul>
    </Section>
    {place && <Section title="Localidad favorita"><div className="flex items-center justify-between gap-2"><span>{place.name}</span><Button kind="ghost" onClick={() => saveProfile({ place: null })}>Quitar</Button></div></Section>}
    <Section title="Tus datos">
      <Button kind="ghost" onClick={() => { const blob = new Blob([localStorage.getItem('zarzu.v2') ?? '{}'], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'mis-datos-zarzu.json'; a.click(); }}>Descargar mis datos</Button>
      {!session && <Button kind="ghost" className="ml-2" onClick={() => { if (confirm('¿Borrar todos los datos de este dispositivo?')) { localStorage.clear(); location.href = location.pathname; } }}>Borrar datos</Button>}
      {session && <Button kind="ghost" className="ml-2 !text-danger" onClick={async () => { if (!confirm('¿Borrar tu cuenta y todos sus datos? No se puede deshacer.')) return; try { await rest('rpc/delete_my_account', { method: 'POST', body: {} }); await deleteLocalSession(); localStorage.clear(); location.href = '/'; } catch { setMsg('No se ha podido borrar la cuenta. Vuelve a intentarlo con conexión.'); } }}>Borrar mi cuenta</Button>}
    </Section>
  </Page>;
}

export function FavoritesScreen() {
  const favs = useStore((s) => s.favorites), [k, setK] = useState('');
  const L: Record<string, string> = { verse: 'Versículos', prayer: 'Oraciones', saint: 'Santos', quote: 'Frases', place: 'Templos', news: 'Noticias' };
  const kinds = [...new Set(favs.map((f) => f.kind))];
  return <Page title="Favoritos" back="/perfil">
    {kinds.length > 1 && <div className="no-bar -mx-5 mb-2 flex gap-2 overflow-x-auto px-5"><Chip active={!k} onClick={() => setK('')}>Todos</Chip>{kinds.map((x) => <Chip key={x} active={k === x} onClick={() => setK(x)}>{L[x]}</Chip>)}</div>}
    <ul>{favs.filter((f) => !k || f.kind === k).map((f) => { const inner = <><span className="font-bold text-gold">{f.title}</span>{f.body && <span className="mt-1 block font-serif text-[1.12rem] leading-[1.14]">{f.body}</span>}</>; return <li key={f.kind + f.id} className="border-b border-line py-3">{f.link?.startsWith('/') ? <Link to={f.link}>{inner}</Link> : f.link ? <a href={f.link} target="_blank" rel="noreferrer">{inner}</a> : inner}</li>; })}</ul>
    {!favs.length && <p className="py-6 text-center text-[15px] text-muted">Toca el corazón en un versículo, una oración, un santo o un templo para guardarlo aquí.</p>}
  </Page>;
}

export function StatsScreen() {
  const act = useStore((s) => s.activity), verses = useStore((s) => s.verses), t = today();
  const days = useMemo(() => new Set(act.map((a) => a.day)), [act]);
  const count = (k: string) => act.filter((a) => a.kind === k).length;
  const start = addDays(t, -((parse(t).getDay() + 6) % 7) - 7 * 11);
  const weeks = Array.from({ length: 12 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  const stats: [string, number][] = [['Días de racha', streakOf(days)], ['Días activos', days.size], ['Evangelios leídos', count('gospel')], ['Capítulos de la Biblia', count('reading')], ['Rosarios terminados', count('rosary')], ['Oraciones', count('prayer')], ['Versículos recibidos', new Set(verses.map((v) => v.id)).size]];
  return <Page title="Estadísticas" back="/perfil">
    <dl className="grid grid-cols-2 gap-x-5 sm:grid-cols-3">{stats.map(([l, v]) => <div key={l} className="border-b border-line py-3"><dd className="font-serif text-[2.56rem] leading-none">{v}</dd><dt className="mt-1 text-[15px] leading-tight">{l}</dt></div>)}</dl>
    <Section title="Últimas doce semanas">
      <div className="flex gap-1" role="img" aria-label={`${days.size} días activos en total`}>{weeks.map((w, i) => <div key={i} className="flex flex-1 flex-col gap-1">{w.map((d) => <span key={d} title={shortDate(d)} className={`aspect-square rounded-[5px] ${d > t ? 'bg-transparent' : days.has(d) ? 'bg-gold' : 'bg-surface'}`} />)}</div>)}</div>
      <p className="mt-2 text-sm text-muted">Cada casilla es un día; las de color son días en los que leíste o rezaste. Sin puntuaciones: esto es solo para ti.</p>
    </Section>
  </Page>;
}
export function HistoryScreen() {
  const act = useStore((s) => s.activity), [k, setK] = useState<'lecturas' | 'oraciones'>('lecturas');
  const list = act.filter((a) => (k === 'lecturas' ? a.kind === 'reading' || a.kind === 'gospel' : a.kind === 'prayer' || a.kind === 'rosary'));
  return <Page title="Historial" back="/perfil"><div className="flex gap-2"><Chip active={k === 'lecturas'} onClick={() => setK('lecturas')}>Lecturas</Chip><Chip active={k === 'oraciones'} onClick={() => setK('oraciones')}>Oraciones</Chip></div>
    <ul className="mt-3">{list.slice(0, 200).map((a) => <li key={a.kind + a.ref + a.day} className="flex justify-between gap-3 border-b border-line py-3"><span>{a.label}</span><time className="shrink-0 text-sm text-muted">{shortDate(a.day)}</time></li>)}</ul>
    {!list.length && <p className="py-6 text-center text-[15px] text-muted">Aún no hay nada aquí.</p>}</Page>;
}
export const PrivacyScreen = () => <Page title="Privacidad y fuentes" back="/perfil"><div className="space-y-5 text-[15px] leading-relaxed">
  <div><h2 className="text-xl">Tus datos</h2><p className="mt-1">Sin cuenta, todo se guarda solo en tu dispositivo. Con cuenta, tus favoritos e historial se guardan en Supabase con reglas que impiden que otras personas accedan a ellos.</p><p className="mt-2">Tu ubicación solo se usa cuando pulsas el botón y no se guarda.</p></div>
  <div><h2 className="text-xl">Fuentes</h2><ul className="mt-1 list-disc space-y-1 pl-5"><li>Biblia: traducción de Félix Torres Amat (siglo XIX), de dominio público. Transcripción del proyecto Iter Catholicum; Ester 11-16 y Daniel 13-14 proceden de Wikisource.</li><li>Lecturas del día: Evangelio del día (evangelizo.org), con enlace a su web.</li><li>Calendario: calculado en la app según las normas litúrgicas, con el propio de España.</li><li>Noticias: Vatican News, Conferencia Episcopal Española, Alfa y Omega, Vida Nueva y la Archidiócesis de Sevilla. Siempre enlazan al medio original.</li><li>Mapa y templos: © colaboradores de OpenStreetMap (ODbL), Overpass y Nominatim.</li><li>Biografías ampliadas: Wikipedia (CC BY-SA).</li></ul></div>
  <div><h2 className="text-xl">Contenido</h2><p className="mt-1">Las reflexiones y mensajes diarios son textos propios de la app. La app no usa inteligencia artificial. Nada de esto sustituye a la enseñanza de la Iglesia ni al consejo de un sacerdote.</p></div>
</div></Page>;

// ---------- Administración (las políticas RLS impiden escribir a quien no es admin) ----------
interface Sched { id?: string; osm_ref: string; church_name: string; kind: string; schedule: string; source_url: string; source_name: string; checked_on: string }
interface Content { id?: string; kind: string; title: string; body: string; publish_on: string; published: boolean }
export function AdminScreen() {
  const s = useSession(), admin = useAdmin(s?.user.id), [tab, setTab] = useState<'horarios' | 'propuestas' | 'contenido' | 'estado'>('horarios');
  if (admin.loading) return <Page title="Administración" back="/perfil"><Spinner /></Page>;
  if (!admin.data) return <Page title="Administración" back="/perfil"><Notice>Esta sección es solo para administradores.</Notice></Page>;
  return <Page title="Administración" back="/perfil"><div className="no-bar -mx-5 flex gap-2 overflow-x-auto px-5"><Chip active={tab === 'horarios'} onClick={() => setTab('horarios')}>Horarios</Chip><Chip active={tab === 'propuestas'} onClick={() => setTab('propuestas')}>Propuestas</Chip><Chip active={tab === 'contenido'} onClick={() => setTab('contenido')}>Contenido</Chip><Chip active={tab === 'estado'} onClick={() => setTab('estado')}>Estado</Chip></div>{tab === 'horarios' ? <SchedAdmin /> : tab === 'propuestas' ? <ReportsAdmin /> : tab === 'contenido' ? <ContentAdmin /> : <Health />}</Page>;
}
function SchedAdmin() {
  const empty: Sched = { osm_ref: '', church_name: '', kind: 'mass', schedule: '', source_url: '', source_name: '', checked_on: today() };
  const [f, setF] = useState(empty), [n, setN] = useState(0), [err, setErr] = useState('');
  const list = usePromise(() => rest<Sched[]>('verified_schedules?select=*&order=updated_at.desc&limit=200'), [n]);
  const set = (k: keyof Sched) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return <><form className="mt-4 space-y-2" onSubmit={async (e) => { e.preventDefault(); setErr(''); try { await rest('verified_schedules?on_conflict=osm_ref,kind', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: { ...f, updated_by: getSession()!.user.id } }); setF(empty); setN(n + 1); } catch (x) { setErr((x as Error).message); } }}>
    <p className="text-sm text-muted">Solo publica horarios comprobados en la web de la parroquia o de la diócesis. La fuente y la fecha son obligatorias.</p>
    <Input required pattern="(node|way|relation)/[0-9]+" value={f.osm_ref} onChange={set('osm_ref')} placeholder="Referencia OSM, como way/123456" aria-label="Referencia OSM" />
    <Input required value={f.church_name} onChange={set('church_name')} placeholder="Nombre del templo" aria-label="Nombre del templo" />
    <select aria-label="Tipo" value={f.kind} onChange={set('kind')} className="min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-ink"><option value="mass">Misas</option><option value="confession">Confesiones</option><option value="opening">Apertura</option></select>
    <textarea required rows={3} value={f.schedule} onChange={set('schedule')} placeholder={'Horario, tal como aparece en la fuente'} aria-label="Horario" className="w-full rounded-xl border border-line bg-surface p-3 text-[16px] text-ink" />
    <Input required type="url" value={f.source_url} onChange={set('source_url')} placeholder="Enlace a la fuente" aria-label="Enlace a la fuente" />
    <Input value={f.source_name} onChange={set('source_name')} placeholder="Nombre de la fuente" aria-label="Nombre de la fuente" />
    <label className="block text-sm text-muted">Fecha de comprobación<Input required type="date" value={f.checked_on} onChange={set('checked_on')} className="mt-1" /></label>
    {err && <Notice tone="error">{err}</Notice>}<Button className="w-full">Guardar horario confirmado</Button></form>
    <ul className="mt-5">{list.data?.map((x) => <li key={x.id} className="flex items-start gap-2 border-b border-line py-3"><button className="min-w-0 flex-1 text-left" onClick={() => setF({ ...x, source_name: x.source_name ?? '' })}><span className="block font-medium">{x.church_name}</span><span className="text-sm text-muted">{x.kind === 'mass' ? 'Misas' : x.kind === 'confession' ? 'Confesiones' : 'Apertura'}. Comprobado el {x.checked_on}</span></button><button aria-label={`Borrar ${x.church_name}`} className="grid size-11 place-items-center text-muted" onClick={async () => { await rest(`verified_schedules?id=eq.${x.id}`, { method: 'DELETE' }); setN(n + 1); }}><Icon name="trash" size={18} /></button></li>)}</ul></>;
}
interface Report { id: string; osm_ref: string; church_name: string; schedule: string; source_url: string | null; note: string | null; created_at: string }
/** Horarios enviados por usuarios: se publican solo después de comprobarlos con una fuente. */
function ReportsAdmin() {
  const [n, setN] = useState(0), [err, setErr] = useState('');
  const list = usePromise(() => rest<Report[]>('mass_reports?select=*&status=eq.pending&order=created_at.asc&limit=100'), [n]);
  const mark = (id: string, status: string) => rest(`mass_reports?id=eq.${id}`, { method: 'PATCH', prefer: 'return=minimal', body: { status } });
  if (list.loading) return <Spinner />;
  if (!list.data?.length) return <p className="mt-4 text-[15px] text-muted">No hay propuestas pendientes.</p>;
  return <ul className="mt-4 space-y-3">{err && <Notice tone="error">{err}</Notice>}{list.data.map((r) => <ReportItem key={r.id} r={r} onDone={async (publish) => {
    setErr('');
    try {
      if (publish) await rest('verified_schedules?on_conflict=osm_ref,kind', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: { osm_ref: r.osm_ref, church_name: r.church_name, kind: 'mass', schedule: publish.schedule, source_url: publish.source, source_name: publish.sourceName || null, checked_on: today(), updated_by: getSession()!.user.id } });
      await mark(r.id, publish ? 'used' : 'rejected'); setN(n + 1);
    } catch (x) { setErr((x as Error).message); }
  }} />)}</ul>;
}
function ReportItem({ r, onDone }: { r: Report; onDone: (p: { schedule: string; source: string; sourceName: string } | null) => void }) {
  const [schedule, setSchedule] = useState(r.schedule), [source, setSource] = useState(r.source_url ?? ''), [sourceName, setSourceName] = useState('');
  return <li className="rounded-[22px] bg-surface p-4">
    <p className="font-bold">{r.church_name}</p><p className="text-xs text-muted">{r.osm_ref}. Enviado el {r.created_at.slice(0, 10)}</p>
    {r.note && <p className="mt-1 text-sm">Nota: {r.note}</p>}
    <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); onDone({ schedule, source, sourceName }); }}>
      <textarea required rows={3} value={schedule} onChange={(e) => setSchedule(e.target.value)} aria-label="Horario" className="w-full rounded-xl border border-line bg-paper p-3 text-[16px] text-ink" />
      <Input required type="url" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Enlace con el que lo has comprobado" aria-label="Fuente" />
      <Input value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="Nombre de la fuente (web de la parroquia, diócesis…)" aria-label="Nombre de la fuente" />
      <div className="flex gap-2"><Button className="flex-1">Publicar como confirmado</Button><Button type="button" kind="ghost" onClick={() => onDone(null)}>Descartar</Button></div>
    </form>
  </li>;
}
function ContentAdmin() {
  const empty: Content = { kind: 'daily_message', title: '', body: '', publish_on: today(), published: true };
  const [f, setF] = useState(empty), [n, setN] = useState(0), [err, setErr] = useState('');
  const list = usePromise(() => rest<Content[]>('content_items?select=*&order=publish_on.desc&limit=100'), [n]);
  const K: Record<string, string> = { daily_message: 'Mensaje del día', morning_reflection: 'Reflexión de la mañana', announcement: 'Aviso destacado' };
  return <><form className="mt-4 space-y-2" onSubmit={async (e) => { e.preventDefault(); setErr(''); try { await rest('content_items', { method: 'POST', prefer: 'return=minimal', body: { ...f, updated_by: getSession()!.user.id } }); setF(empty); setN(n + 1); } catch (x) { setErr((x as Error).message); } }}>
    <p className="text-sm text-muted">Sustituye el contenido automático del inicio en la fecha indicada.</p>
    <select aria-label="Tipo" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className="min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-ink">{Object.entries(K).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
    <textarea required rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="Texto" aria-label="Texto" className="w-full rounded-xl border border-line bg-surface p-3 text-[16px] text-ink" />
    <Input required type="date" aria-label="Fecha de publicación" value={f.publish_on} onChange={(e) => setF({ ...f, publish_on: e.target.value })} />
    {err && <Notice tone="error">{err}</Notice>}<Button className="w-full">Publicar</Button></form>
    <ul className="mt-5">{list.data?.map((x) => <li key={x.id} className="flex items-start gap-2 border-b border-line py-3"><span className="min-w-0 flex-1"><span className="text-sm text-gold">{K[x.kind]}. {fullDate(x.publish_on)}</span><span className="mt-1 block line-clamp-3 text-sm">{x.body}</span></span><button aria-label="Borrar" className="grid size-11 place-items-center text-muted" onClick={async () => { await rest(`content_items?id=eq.${x.id}`, { method: 'DELETE' }); setN(n + 1); }}><Icon name="trash" size={18} /></button></li>)}</ul></>;
}
function Health() {
  const h = usePromise(() => api<{ configured: Record<string, unknown>; live: { liturgy: { ok: boolean }; nominatim: { ok: boolean }; overpass: { ok: boolean }; feeds: Record<string, { ok: boolean; status: unknown }> } }>('/api/health?live=1'), []);
  if (h.loading) return <Spinner label="Comprobando los servicios…" />;
  if (!h.data) return <Notice tone="error">{h.error}</Notice>;
  const rows: [string, boolean][] = [...Object.entries(h.data.configured).filter(([, v]) => typeof v === 'boolean').map(([k, v]) => [`Configurado: ${k}`, v as boolean] as [string, boolean]), ['Lecturas', h.data.live.liturgy.ok], ['Nominatim', h.data.live.nominatim.ok], ['Overpass', h.data.live.overpass.ok], ...Object.entries(h.data.live.feeds).map(([k, v]) => [`Noticias: ${k}`, v.ok] as [string, boolean])];
  return <ul className="mt-4">{rows.map(([l, ok]) => <li key={l} className="flex justify-between border-b border-line py-2.5 text-[15px]"><span>{l}</span><span className={ok ? 'text-ok' : 'text-danger'}>{ok ? 'Correcto' : 'Falla'}</span></li>)}</ul>;
}
void config;
