// Web Push (RFC 8291 + RFC 8292) con node:crypto, sin dependencias.
import crypto from 'node:crypto';
import { HttpError, env, fetchWithTimeout, json } from './http.js';
import { getLiturgy } from './liturgy.js';

const b64u = (b: Buffer | Uint8Array) => Buffer.from(b).toString('base64url');
const fromB64u = (s: string) => Buffer.from(s, 'base64url');
const hkdf = (salt: Buffer, ikm: Buffer, info: Buffer, len: number) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len));

export function generateVapid() {
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  return { publicKey: b64u(ecdh.getPublicKey()), privateKey: b64u(ecdh.getPrivateKey()) };
}

export function encryptPayload(payload: Buffer, p256dh: string, auth: string, opts: { salt?: Buffer; ecdh?: crypto.ECDH } = {}): Buffer {
  const ua = fromB64u(p256dh); const authSecret = fromB64u(auth);
  const ecdh = opts.ecdh ?? crypto.createECDH('prime256v1');
  if (!opts.ecdh) ecdh.generateKeys();
  const asPub = ecdh.getPublicKey(); const shared = ecdh.computeSecret(ua);
  const salt = opts.salt ?? crypto.randomBytes(16);
  const ikm = hkdf(authSecret, shared, Buffer.concat([Buffer.from('WebPush: info\0'), ua, asPub]), 32);
  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const enc = Buffer.concat([c.update(Buffer.concat([payload, Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, enc]);
}

export function vapidHeader(endpoint: string, pub: string, priv: string, subject: string, now = Date.now()) {
  const header = b64u(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const p = fromB64u(pub);
  const key = crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: priv, x: b64u(p.subarray(1, 33)), y: b64u(p.subarray(33, 65)) }, format: 'jwk' });
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${body}`), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${header}.${body}.${b64u(sig)}, k=${pub}`;
}

export interface PushSub { endpoint: string; p256dh: string; auth: string; }
export async function sendPush(sub: PushSub, data: object): Promise<number> {
  const body = encryptPayload(Buffer.from(JSON.stringify(data)), sub.p256dh, sub.auth);
  const res = await fetchWithTimeout(sub.endpoint, {
    method: 'POST', timeoutMs: 8000, body: new Uint8Array(body),
    headers: {
      'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: '3600', urgency: 'normal',
      authorization: vapidHeader(sub.endpoint, env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'), env('VAPID_SUBJECT', 'mailto:admin@example.com')),
    },
  });
  return res.status;
}

export interface Reminder { id: string; time: string; enabled: boolean; }
/** ¿Toca este recordatorio en esta ventana? La ventana tolera retrasos del cron; push_log evita duplicados. */
export function isDue(reminder: Reminder, timeZone: string, now: Date, windowMin = 45): { due: boolean; day: string } {
  let parts: Record<string, string>;
  try {
    parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((p) => [p.type, p.value]));
  } catch { return isDue(reminder, 'Europe/Madrid', now, windowMin); }
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const cur = +parts.hour * 60 + +parts.minute;
  const [h, m] = reminder.time.split(':').map(Number);
  const target = h * 60 + m;
  return { due: reminder.enabled && cur >= target && cur - target < windowMin, day };
}

export async function cronRoute(req: Request): Promise<Response> {
  const secret = env('CRON_SECRET');
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) throw new HttpError(401, 'No autorizado.', 'unauthorized');
  const url = env('SUPABASE_URL'); const svc = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !svc || !env('VAPID_PRIVATE_KEY')) throw new HttpError(503, 'Faltan variables de Supabase o VAPID.', 'not_configured');
  const h = { apikey: svc, authorization: `Bearer ${svc}`, 'content-type': 'application/json' };
  const profiles = await (await fetchWithTimeout(`${url}/rest/v1/profiles?select=id,timezone,notifications&notifications->>enabled=eq.true`, { headers: h })).json() as { id: string; timezone: string | null; notifications: { reminders?: Reminder[] } }[];
  const now = new Date(); let sent = 0, removed = 0;
  for (const p of profiles) {
    for (const r of p.notifications?.reminders ?? []) {
      const { due, day } = isDue(r, p.timezone || 'Europe/Madrid', now);
      if (!due) continue;
      const log = await fetchWithTimeout(`${url}/rest/v1/push_log`, { method: 'POST', headers: { ...h, prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify({ user_id: p.id, reminder_id: r.id, day }) });
      const inserted = log.ok ? await log.json() as unknown[] : [];
      if (!inserted.length) continue; // ya enviado hoy
      const subs = await (await fetchWithTimeout(`${url}/rest/v1/push_subscriptions?select=endpoint,p256dh,auth&user_id=eq.${p.id}`, { headers: h })).json() as PushSub[];
      let msg = { title: 'Un momento de oración', body: 'Haz una pausa y ponte en presencia de Dios.', url: '/oracion' };
      if (r.id === 'gospel') {
        const lit = await getLiturgy(day).catch(() => null);
        const g = lit?.readings.find((x) => x.key === 'GSP');
        msg = { title: 'El Evangelio de hoy', body: g?.reference || 'Las lecturas de hoy ya están disponibles.', url: '/liturgia' };
      }
      if (r.id === 'evening') msg = { title: 'Antes de descansar', body: 'Da gracias por el día y encomienda la noche al Señor.', url: '/oracion' };
      for (const s of subs) {
        const st = await sendPush(s, msg).catch(() => 0);
        if (st >= 200 && st < 300) sent++;
        if (st === 404 || st === 410) { removed++; await fetchWithTimeout(`${url}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE', headers: h }); }
      }
    }
  }
  return json({ ok: true, users: profiles.length, sent, removed });
}
