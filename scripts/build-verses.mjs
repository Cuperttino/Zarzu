// Resuelve el catálogo de referencias contra el texto bíblico incluido.
// Falla si una referencia no existe: nunca se escribe texto a mano.
import fs from 'node:fs';
import { THEMES } from './verse-refs.mjs';
const { books } = JSON.parse(fs.readFileSync('public/data/books.json', 'utf8'));
const byAbbr = Object.fromEntries(books.map((b) => [b.abbr, b]));
const cache = {};
const load = (code) => (cache[code] ??= JSON.parse(fs.readFileSync(`public/bible/${code}.json`, 'utf8')));
const MAX = 380, MIN = 28;
const seen = new Map(), used = new Map(), out = [], rejected = [];
for (const [theme, raw] of Object.entries(THEMES)) {
  for (const ref of raw.split(';').map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean)) {
    const m = ref.match(/^(.+?) (\d+),(\d+)(?:-(\d+))?$/);
    if (!m) throw new Error(`Referencia mal formada: ${ref}`);
    const book = byAbbr[m[1]];
    if (!book) throw new Error(`Libro desconocido: ${ref}`);
    const [c, a, z] = [m[2], +m[3], +(m[4] ?? m[3])];
    const chap = load(book.code).chapters[c];
    if (!chap) { rejected.push([ref, 'capítulo']); continue; }
    const parts = [];
    for (let v = a; v <= z; v++) if (chap[v]) parts.push(chap[v]);
    if (!chap[a] || !chap[z]) { rejected.push([ref, 'versículo']); continue; }
    let text = parts.join(' ');
    if (book.code === 'PSA') {
      // Los títulos de los salmos y las letras del salmo 118 no forman parte de la frase mostrada.
      const TITLE = /^(Para el [^.:]*[.:]\s*|Inscripci[oó]n de t[ií]tulo:\s*|Salmo y C[aá]ntico[^.]*\.\s*|Salmo de [^.]*\.\s*|Salmo\.\s*|Del mismo David[^.]*\.\s*|Oraci[oó]n del mismo David\.\s*|Alabanza[^.]*David\.\s*|C[aá]ntico gradual[^.]*\.\s*|C[aá]ntico del mismo David[^.]*\.\s*|antes de ser ungido\.\s*|de Aggeo y de Zacharias\.\s*|contra Goliath\.\s*|(Beth|He|Mem|Nun|Heth|Aleph|Lamed|Teth|Zain|Vau|Daleth|Ghimel)\.\s*)+/;
      text = text.replace(TITLE, '').replace(/^¡?Aleluya!?[.:]?\s*/, '');
    }
    const overlaps = used.get(`${book.code}.${c}`) ?? [];
    if (overlaps.some(([x, y]) => a <= y && z >= x)) continue;
    used.set(`${book.code}.${c}`, [...overlaps, [a, z]]);
    if (text.length < MIN) { rejected.push([ref, 'corto']); continue; }
    if (text.length > MAX) { rejected.push([ref, 'largo']); continue; }
    if (/^[a-záéíóúñ]/.test(text)) text = '…' + text;
    if (/[,;:\-—]$/.test(text)) text = text.replace(/[,;:\-—]+$/, '') + '…';
    const id = `${book.code}.${c}.${a}${z !== a ? '-' + z : ''}`;
    if (seen.has(id)) continue;
    seen.set(id, 1);
    const isPsalm = book.code === 'PSA';
    out.push({ id, ref: `${isPsalm ? 'Salmo' : book.name} ${c},${a}${z !== a ? '-' + z : ''}`, text, theme, book: book.code, c: +c, v: a });
  }
}
fs.writeFileSync('public/data/verses.json', JSON.stringify(out));
console.log(`versículos: ${out.length}; descartados: ${rejected.length}`);
if (process.argv.includes('--verbose')) console.log(rejected.map((r) => r.join(':')).join(' | '));
if (process.argv.includes('--psalms')) for (const v of out.filter((x) => x.book === 'PSA')) console.log(`${v.id}[${v.theme.slice(0,3)}] ${v.text.slice(0, 95)}`);
