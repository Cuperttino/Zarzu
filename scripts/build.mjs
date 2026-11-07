// Compila la app: React + TypeScript con esbuild y Tailwind CSS v4 mediante su API.
import { build, transform } from 'esbuild';
import { compile } from 'tailwindcss';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const preview = process.argv.includes('--preview');
const out = preview ? (process.env.PREVIEW_DIR ?? 'dist-preview') : 'dist';
const SITE = (process.env.PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
const require = createRequire(import.meta.url);
const hash = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 10);
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(`${out}/assets`, { recursive: true });

const js = await build({
  entryPoints: ['src/main.tsx'], bundle: true, minify: true, write: false, format: 'esm', target: 'es2021', jsx: 'automatic',
  define: { __PREVIEW__: String(preview), 'process.env.NODE_ENV': '"production"' }, legalComments: 'none',
});
const jsText = js.outputFiles[0].text;

// Tailwind recibe los candidatos encontrados en el código fuente.
const tailwindDir = path.dirname(require.resolve('tailwindcss/package.json'));
const compiler = await compile(fs.readFileSync('src/styles.css', 'utf8'), {
  base: 'src',
  loadStylesheet: async (id, base) => {
    const file = id === 'tailwindcss' ? path.join(tailwindDir, 'index.css') : id.startsWith('tailwindcss/') ? path.join(tailwindDir, id.slice(12)) : path.resolve(base, id);
    return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
  },
});
const candidates = new Set();
for (const f of walk('src').filter((x) => /\.tsx?$/.test(x))) for (const m of fs.readFileSync(f, 'utf8').matchAll(/[^\s"'`<>=;{}\\]+/g)) candidates.add(m[0]);
let css = (await transform(compiler.build([...candidates]), { loader: 'css', minify: true })).code;
if (preview) css = css.replaceAll('/fonts/', 'fonts/');

const jsName = `app-${hash(jsText)}.js`, cssName = `app-${hash(css)}.css`;
fs.writeFileSync(`${out}/assets/${jsName}`, jsText);
fs.writeFileSync(`${out}/assets/${cssName}`, css);
fs.cpSync('public', out, { recursive: true });

const title = 'Zarzu: tu fe católica, un rato cada día';
const desc = 'Evangelio y lecturas de cada día, versículos que no se repiten, rosario, santos, noticias de la Iglesia y templos cercanos.';
const prefix = preview ? '' : '/';
const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${preview ? 'Zarzu app católica' : title}</title>
<meta name="description" content="${desc}">
<meta name="theme-color" content="#fbf9ff">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Zarzu">
<meta property="og:type" content="website"><meta property="og:locale" content="es_ES"><meta property="og:title" content="${title}"><meta property="og:description" content="${desc}">
${SITE ? `<meta property="og:url" content="${SITE}/"><meta property="og:image" content="${SITE}/og.png"><link rel="canonical" href="${SITE}/">` : ''}
<meta name="twitter:card" content="summary_large_image">
${preview ? '' : `<link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/icons/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icons/icon-180.png">`}
${preview ? `<style>${css}</style>` : `<link rel="stylesheet" href="${prefix}assets/${cssName}">`}
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Zarzu', description: desc, applicationCategory: 'LifestyleApplication', inLanguage: 'es', operatingSystem: 'Web', offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' } })}</script>
<script>(function(){var r=document.documentElement,h=r.dataset.theme,d=false;try{var t=(JSON.parse(localStorage.getItem('zarzu.v2')||'{}').settings||{}).theme;if(t==='dark')d=true;if(t==='auto')d=h?h==='dark':matchMedia('(prefers-color-scheme: dark)').matches}catch(e){}if(d)document.documentElement.classList.add('dark')})()</script>
</head>
<body>
<div id="root"></div>
<noscript><main style="font-family:serif;padding:2rem;max-width:40rem;margin:auto"><h1>Zarzu</h1><p>${desc}</p><p>Activa JavaScript para usar la aplicación.</p></main></noscript>
${preview ? `<script type="module">${jsText.replaceAll('</script', '<\\/script')}</script>` : `<script type="module" src="${prefix}assets/${jsName}"></script>`}
</body>
</html>`;
fs.writeFileSync(`${out}/index.html`, html);

if (!preview) {
  const shell = ['/', `/assets/${jsName}`, `/assets/${cssName}`, '/fonts/Bricolage.woff', '/fonts/CrimsonPro-Regular.woff', '/data/books.json', '/data/verses.json', '/icons/icon.svg', '/manifest.webmanifest'];
  fs.writeFileSync(`${out}/sw.js`, fs.readFileSync('src/sw.js', 'utf8').replace('__VERSION__', hash(jsText + css)).replace('__SHELL__', JSON.stringify(shell)));
  const routes = ['', 'biblia', 'oracion', 'oracion/rosario', 'descubrir', 'descubrir/noticias', 'descubrir/templos', 'descubrir/misas', 'descubrir/calendario', 'descubrir/santos', 'liturgia', 'privacidad'];
  if (SITE) fs.writeFileSync(`${out}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((r) => `<url><loc>${SITE}/${r}</loc></url>`).join('')}</urlset>`);
  fs.writeFileSync(`${out}/robots.txt`, `User-agent: *\nAllow: /\nDisallow: /api/\n${SITE ? `Sitemap: ${SITE}/sitemap.xml\n` : ''}`);
}
if (preview) {
  // Vista previa publicable en claude.ai: un solo archivo con fuentes incrustadas y sin envoltura HTML.
  const font = (f) => `data:font/woff;base64,${fs.readFileSync(`public/fonts/${f}`).toString('base64')}`;
  const inlineCss = ['Bricolage', 'CrimsonPro-Regular'].reduce((c, n) => c.replaceAll(`fonts/${n}.woff`, font(`${n}.woff`)), css);
  const body = `<title>Zarzu app católica</title>\n<meta name="description" content="${desc}">\n<style>${inlineCss}</style>\n<script>(function(){var r=document.documentElement,h=r.dataset.theme,d=false;try{var t=(JSON.parse(localStorage.getItem('zarzu.v2')||'{}').settings||{}).theme;if(t==='dark')d=true;if(t==='auto')d=h?h==='dark':matchMedia('(prefers-color-scheme: dark)').matches}catch(e){}if(d)document.documentElement.classList.add('dark')})()</script>\n<div id="root"></div>\n<script type="module">${jsText.replaceAll('</script', '<\\/script')}</script>\n`;
  fs.writeFileSync(`${out}/zarzu.html`, body);
}
console.log(`Compilado en ${out}: JS ${(jsText.length / 1024).toFixed(0)} KB, CSS ${(css.length / 1024).toFixed(0)} KB`);
