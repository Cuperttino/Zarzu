import { decodeEntities, htmlToText } from './http.js';

export interface RawItem { title: string; link: string; summary: string; date: string | null; image: string | null; categories: string[]; }

const cdata = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
function tag(block: string, name: string): string | null {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i');
  const m = block.match(re);
  return m ? cdata(m[1]).trim() : null;
}
const attr = (s: string, a: string) => s.match(new RegExp(`\\b${a}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1] ?? null;

export function firstImage(html: string | null | undefined): string | null {
  if (!html) return null;
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const src = attr(m[0], 'src') ?? attr(m[0], 'data-src');
    if (src && /^https?:/i.test(src) && !/(pixel|feedburner|emoji|gravatar|1x1|spacer)/i.test(src)) return decodeEntities(src);
  }
  return null;
}

function itemImage(b: string): string | null {
  for (const m of b.matchAll(/<media:(content|thumbnail)\b[^>]*>/gi)) {
    const url = attr(m[0], 'url');
    const medium = attr(m[0], 'medium'); const type = attr(m[0], 'type');
    if (url && (!medium || medium === 'image') && (!type || type.startsWith('image'))) return decodeEntities(url);
  }
  for (const m of b.matchAll(/<enclosure\b[^>]*>/gi)) {
    const url = attr(m[0], 'url'); const type = attr(m[0], 'type') ?? '';
    if (url && (type.startsWith('image') || /\.(jpe?g|png|webp)(\?|$)/i.test(url))) return decodeEntities(url);
  }
  return firstImage(tag(b, 'content:encoded')) ?? firstImage(tag(b, 'content')) ?? firstImage(tag(b, 'description')) ?? firstImage(tag(b, 'summary'));
}

export function cleanSummary(html: string): string {
  let t = htmlToText(html)
    .replace(/La noticia .{0,300}? se publicó primero en [^\n]*\n?/i, '')
    .replace(/La entrada .{0,300}? se publicó primero en [^\n]*\n?/i, '')
    .replace(/(Leer todo|Seguir leyendo|Leer más|Continuar leyendo)[.…\s]*$/i, '')
    .replace(/\[(…|\.\.\.)\]\s*$/, '…')
    .replace(/\s+/g, ' ').trim();
  if (t.length > 320) t = t.slice(0, 320).replace(/\s+\S*$/, '') + '…';
  return t;
}

export function parseFeed(xml: string): RawItem[] {
  const out: RawItem[] = [];
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  for (const b of blocks) {
    const title = htmlToText(tag(b, 'title') ?? '');
    let link = tag(b, 'link') ?? '';
    if (!link) link = (b.match(/<link\b[^>]*rel=["']alternate["'][^>]*>/i)?.[0] ?? b.match(/<link\b[^>]*>/i)?.[0] ?? '').match(/href=["']([^"']+)/)?.[1] ?? '';
    link = decodeEntities(link).trim();
    const raw = tag(b, 'pubDate') ?? tag(b, 'published') ?? tag(b, 'updated') ?? tag(b, 'dc:date');
    const ms = raw ? Date.parse(raw) : NaN;
    if (!title || !/^https?:\/\//.test(link)) continue;
    const categories = [...b.matchAll(/<category\b[^>]*?(?:term=["']([^"']+)["'][^>]*?\/?>|>([\s\S]*?)<\/category>)/gi)]
      .map((m) => htmlToText(cdata(m[1] ?? m[2] ?? ''))).filter(Boolean);
    out.push({
      title, link,
      summary: cleanSummary(tag(b, 'description') ?? tag(b, 'summary') ?? tag(b, 'content:encoded') ?? ''),
      date: Number.isNaN(ms) ? null : new Date(ms).toISOString(),
      image: itemImage(b),
      categories,
    });
  }
  return out;
}

/** og:image de la página original, para feeds que no incluyen foto. */
export function ogImage(html: string): string | null {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (/(property|name)=["'](og:image|twitter:image)(:secure_url)?["']/i.test(m[0])) {
      const c = attr(m[0], 'content');
      if (c && /^https?:/i.test(c)) return decodeEntities(c);
    }
  }
  return null;
}
