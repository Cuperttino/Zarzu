import { useEffect, useRef, useState } from 'react';
import { Button, Icon, Link, Notice, Page } from '../components/ui.tsx';
import { authHeader, navigate } from '../lib/app.ts';
import { authAvailable, config, configLoaded, getSession } from '../lib/supabase.ts';
import { deleteConversation, getState, upsertConversation, useStore, type ChatMessage, type Conversation } from '../lib/store.ts';
import { relativeTime } from '../lib/dates.ts';
import { SYSTEM_PROMPT } from '../../server/ai.ts';

/** Solo en la vista previa de claude.ai: usa Claude a través del visor, sin servidor propio. */
async function previewSample() { const c = (window as unknown as { claude?: { use(n: string): Promise<SampleFn | null> } }).claude; return c ? c.use('sample') : null; }
type SampleFn = (input: { role: string; content: string }[], o: { onText: (x: { text: string }) => void; cache: boolean }) => Promise<{ text: string }>;

const IDEAS = ['¿Qué significa «bienaventurados los pobres de espíritu»?', 'Escríbeme una oración para un día difícil', 'Llevo años sin confesarme. ¿Cómo vuelvo?', '¿Qué se celebra en la Inmaculada?', '¿Por qué los católicos rezan a los santos?', '¿Quién fue santa Teresa de Jesús?'];
const uuid = () => crypto.randomUUID();
const Rich = ({ text }: { text: string }) => <>{text.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line [&+p]:mt-2.5">{p.split(/(\*\*[^*]+\*\*)/).map((x, j) => x.startsWith('**') ? <strong key={j}>{x.slice(2, -2)}</strong> : x)}</p>)}</>;

export function GuideScreen({ id, initial }: { id?: string; initial?: string }) {
  const conv = useStore((s) => s.conversations);
  const [cid, setCid] = useState(id ?? null), [draft, setDraft] = useState(initial ?? ''), [stream, setStream] = useState<string | null>(null), [err, setErr] = useState(''), [showList, setShowList] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const cur = conv.find((c) => c.id === cid) ?? null;
  const cfg = config(), needLogin = authAvailable() && !getSession() && !cfg.aiAllowAnon;
  useEffect(() => { setCid(id ?? null); }, [id]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: stream ? 'auto' : 'smooth' }); }, [cur?.messages.length, stream]);

  const send = async (text: string) => {
    const t = text.trim(); if (!t || stream !== null) return;
    setErr(''); setDraft('');
    const now = new Date().toISOString();
    const user: ChatMessage = { id: uuid(), role: 'user', content: t, at: now };
    const base: Conversation = cur ?? { id: uuid(), title: t.slice(0, 70), updated: now, messages: [] };
    const withUser = { ...base, updated: now, messages: [...base.messages, user] };
    upsertConversation(withUser, [user]); setCid(withUser.id); setStream('');
    let acc = '';
    try {
      if (__PREVIEW__) {
        const sample = await previewSample();
        if (!sample) throw new Error('En esta vista no está disponible. Funcionará en la app publicada con su clave de IA.');
        const hist = withUser.messages.map(({ role, content }) => ({ role, content }));
        hist[0] = { role: 'user', content: `${SYSTEM_PROMPT}\n\n---\n\n${hist[0].content}` };
        const out = await sample(hist, { cache: false, onText: ({ text }) => { acc = text; setStream(text); } });
        acc = out.text;
      } else {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ messages: withUser.messages.map(({ role, content }) => ({ role, content })) }) });
      if (!res.ok || !res.body) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? 'No se ha podido contactar con el guía. Vuelve a intentarlo.'); }
      const rd = res.body.getReader(), dec = new TextDecoder(); let buf = '';
      for (;;) { const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let k; while ((k = buf.indexOf('\n\n')) >= 0) { const line = buf.slice(0, k).replace(/^data:\s*/, ''); buf = buf.slice(k + 2); if (!line) continue; const j = JSON.parse(line); if (j.t) { acc += j.t; setStream(acc); } if (j.error) throw new Error(j.error); } }
      }
      if (acc) { const a: ChatMessage = { id: uuid(), role: 'assistant', content: acc, at: new Date().toISOString() }; const latest = getState().conversations.find((c) => c.id === withUser.id) ?? withUser; upsertConversation({ ...latest, updated: a.at, messages: [...latest.messages, a] }, [a]); }
    } catch (e) {
      setErr(e instanceof TypeError ? 'Sin conexión. Tu mensaje se ha guardado; vuelve a enviarlo cuando puedas.' : (e as Error).message);
      if (acc) { const a: ChatMessage = { id: uuid(), role: 'assistant', content: acc, at: new Date().toISOString() }; const latest = getState().conversations.find((c) => c.id === withUser.id) ?? withUser; upsertConversation({ ...latest, messages: [...latest.messages, a] }, [a]); }
    } finally { setStream(null); }
  };

  const unavailable = configLoaded() && !cfg.aiEnabled && !__PREVIEW__;
  return <Page title="Habla con tu guía espiritual" back="/oracion" right={<button className="min-h-11 px-2 text-sm font-bold" onClick={() => setShowList(!showList)}>{showList ? 'Cerrar' : 'Historial'}</button>}>
    {showList ? <div>
      <Button kind="ghost" className="mb-2 w-full" onClick={() => { setCid(null); setShowList(false); navigate('/guia', true); }}><Icon name="plus" size={18} />Nueva conversación</Button>
      {conv.map((c) => <div key={c.id} className="flex items-center gap-1 border-b border-line"><button className="min-w-0 flex-1 py-3 text-left" onClick={() => { setCid(c.id); setShowList(false); }}><span className="block truncate font-bold">{c.title}</span><span className="text-sm text-muted">{relativeTime(c.updated)}</span></button><button aria-label={`Borrar ${c.title}`} className="grid size-11 place-items-center text-muted" onClick={() => { deleteConversation(c.id); if (cid === c.id) setCid(null); }}><Icon name="trash" size={18} /></button></div>)}
      {!conv.length && <p className="py-6 text-center text-sm text-muted">Todavía no tienes conversaciones.</p>}
    </div> : <>
      {!cur && <div className="pb-2">
        <p className="text-[1.05rem] leading-snug text-muted">Pregunta lo que quieras sobre la Biblia y la fe, o cuéntame qué llevas hoy dentro.</p>
        {!unavailable && !needLogin && <ul className="mt-5 flex flex-col gap-2">{IDEAS.map((i) => <li key={i}><button onClick={() => void send(i)} className="press w-full rounded-[18px] bg-surface px-4 py-3 text-left font-serif text-[1.04rem] leading-[1.12]">{i}</button></li>)}</ul>}
      </div>}
      {unavailable && <div className="mt-3"><Notice>El guía espiritual funcionará cuando la app publicada tenga configurada su clave de IA, que se guarda solo en el servidor. Mientras tanto no se muestran respuestas simuladas.</Notice></div>}
      {needLogin && <div className="mt-3"><Notice action={<Link to="/perfil/entrar"><Button>Entrar o crear cuenta</Button></Link>}>Necesitas una cuenta para hablar con tu guía. Así tus conversaciones son privadas y te acompañan en tus dispositivos.</Notice></div>}
      <div className="space-y-3" aria-live="polite">
        {cur?.messages.map((m) => <Bubble key={m.id} role={m.role} text={m.content} />)}
        {stream !== null && (stream ? <Bubble role="assistant" text={stream} /> : <p className="pulse-soft px-1 text-sm text-muted">Pensando la respuesta…</p>)}
      </div>
      {err && <div className="mt-3"><Notice tone="error">{err}</Notice></div>}
      <div ref={end} />
      <p className="mt-5 text-xs leading-relaxed text-muted">Soy una inteligencia artificial, no un sacerdote. Puedo equivocarme: contrasta lo importante. No sustituyo la confesión, la dirección espiritual ni la ayuda profesional. Si piensas en hacerte daño, llama al 024 (España) o al 112.</p>
      {!unavailable && !needLogin && <form className="sticky bottom-[4.8rem] z-10 mt-3 flex items-end gap-2 rounded-[24px] bg-surface p-1.5 md:bottom-3" onSubmit={(e) => { e.preventDefault(); void send(draft); }}>
        <textarea rows={1} value={draft} maxLength={4000} aria-label="Tu mensaje" placeholder="Escribe tu pregunta" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && innerWidth > 768) { e.preventDefault(); void send(draft); } }} className="max-h-36 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-[16px] outline-none placeholder:text-muted" />
        <button aria-label="Enviar" disabled={!draft.trim() || stream !== null} className="grid size-10 shrink-0 place-items-center rounded-full bg-pop text-white disabled:opacity-30"><Icon name="send" size={18} /></button>
      </form>}
    </>}
  </Page>;
}
const Bubble = ({ role, text }: { role: string; text: string }) => role === 'user'
  ? <div className="ml-12 rounded-[20px] rounded-br-md bg-pop px-4 py-2.5 text-[16px] leading-snug text-white"><Rich text={text} /></div>
  : <div className="reading"><Rich text={text} /></div>;
