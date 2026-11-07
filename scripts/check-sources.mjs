// Comprueba las fuentes reales desde tu ordenador o servidor: npm run check:sources
const d = new Date().toISOString().slice(0, 10).replaceAll('-', '');
const ua = { 'user-agent': 'ZarzuApp/1.0 (comprobacion)' };
const checks = {
  'Evangelizo (título)': `https://feed.evangelizo.org/v2/reader.php?date=${d}&type=liturgic_t&lang=SP`,
  'Evangelizo (Evangelio)': `https://feed.evangelizo.org/v2/reader.php?date=${d}&type=reading&content=GSP&lang=SP`,
  'Vatican News': 'https://www.vaticannews.va/es.rss.xml',
  'Conferencia Episcopal': 'https://www.conferenciaepiscopal.es/feed/',
  'Alfa y Omega': 'https://alfayomega.es/feed/',
  'Vida Nueva': 'https://www.vidanuevadigital.com/feed/',
  'Archidiócesis de Sevilla': 'https://www.archisevilla.org/feed/',
  Nominatim: 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=Motril',
  Overpass: 'https://overpass-api.de/api/status',
  Wikipedia: 'https://es.wikipedia.org/api/rest_v1/page/summary/Teresa_de_Jes%C3%BAs',
};
let bad = 0;
for (const [name, url] of Object.entries(checks)) {
  try {
    const r = await fetch(url, { headers: ua, signal: AbortSignal.timeout(12000) });
    const t = await r.text();
    console.log(`${r.ok ? 'OK ' : 'MAL'} ${name}: ${r.status}, ${t.length} bytes. ${t.replace(/\s+/g, ' ').slice(0, 70)}`);
    if (!r.ok) bad++;
  } catch (e) { console.log(`MAL ${name}: ${e.message}`); bad++; }
}
process.exit(bad ? 1 : 0);
