export const env = (k: string, d = ''): string => (process.env[k] ?? d).trim();
export const contactUrl = () => env('CONTACT_URL', 'https://github.com/Cuperttino/Zarzu');
export const userAgent = () => `ZarzuApp/1.0 (+${contactUrl()})`;

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = 'error') { super(message); }
}

export function json(data: unknown, init: { status?: number; cache?: string } = {}): Response {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': init.cache ?? 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

/** Caché pública en CDN. El navegador revalida pronto; la CDN sirve copias frescas. */
export const cdn = (sMaxAge: number, swr = sMaxAge * 4) => `public, max-age=60, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`;

export async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 8000, ...rest } = init;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: rest.signal ?? ctl.signal, headers: { 'user-agent': userAgent(), ...(rest.headers as object) } });
  } finally { clearTimeout(t); }
}

export class TtlCache<T> {
  private m = new Map<string, { at: number; v: T }>();
  constructor(private ttlMs: number, private max = 200) {}
  /** Devuelve el valor aunque haya caducado si `stale` es true. */
  get(k: string, stale = false): T | undefined {
    const e = this.m.get(k);
    if (!e) return undefined;
    if (!stale && Date.now() - e.at > this.ttlMs) return undefined;
    return e.v;
  }
  set(k: string, v: T) {
    if (this.m.size >= this.max) this.m.delete(this.m.keys().next().value as string);
    this.m.set(k, { at: Date.now(), v });
  }
  clear() { this.m.clear(); }
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', laquo: '«', raquo: '»', iexcl: '¡', iquest: '¿', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', uuml: 'ü', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', ordm: 'º', ordf: 'ª', ccedil: 'ç', agrave: 'à', egrave: 'è', ograve: 'ò', acirc: 'â', ecirc: 'ê', ocirc: 'ô' };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, c: string) => {
    if (c[0] === '#') {
      const n = c[1].toLowerCase() === 'x' ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }
    return ENT[c] ?? m;
  });
}

/** HTML a texto plano; conserva saltos de línea y párrafos. Nunca devuelve etiquetas. */
export function htmlToText(html: string): string {
  const t = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(t).replace(/\r/g, '').replace(/[ \t ]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const rate = new Map<string, { day: string; n: number }>();
/** Límite en memoria, por instancia. Solo se usa como barrera adicional. */
export function softRateLimit(key: string, max: number): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const e = rate.get(key);
  if (!e || e.day !== day) { rate.set(key, { day, n: 1 }); return true; }
  if (e.n >= max) return false;
  e.n++;
  return true;
}
export const clientIp = (req: Request) => (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local';

export function assertDate(raw: string | null): string {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) throw new HttpError(400, 'La fecha debe tener el formato AAAA-MM-DD.', 'bad_date');
  return raw;
}
