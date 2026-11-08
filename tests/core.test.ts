import test from 'node:test';
import assert from 'node:assert/strict';
import { easter, keys, litDay, upcoming } from '../src/lib/calendar.ts';
import { pickVerse, type Verse } from '../src/lib/verses.ts';
import { parseReference, type BookMeta } from '../src/lib/bible.ts';
import { MARTYROLOGY, QUOTES } from '../src/data/saints.ts';
import { rosarySteps, chapletSteps, mysteriesOfDay } from '../src/data/prayers.ts';
import { parseFeed } from '../server/rss.ts';
import { classify } from '../server/news.ts';
import { toPlace, classifyPlace } from '../server/places.ts';
import { parseSaints } from '../server/liturgy.ts';
import { encryptPayload, generateVapid, isDue, vapidHeader } from '../server/push.ts';
import crypto from 'node:crypto';
import fs from 'node:fs';

test('Pascua en fechas conocidas', () => {
  assert.equal(easter(2024), '2024-03-31'); assert.equal(easter(2025), '2025-04-20'); assert.equal(easter(2026), '2026-04-05'); assert.equal(easter(2027), '2027-03-28'); assert.equal(easter(2030), '2030-04-21');
});
test('fechas clave de 2026 y 2027', () => {
  const k = keys(2026); assert.equal(k.ash, '2026-02-18'); assert.equal(k.pentecost, '2026-05-24'); assert.equal(k.advent1, '2026-11-29'); assert.equal(k.christKing, '2026-11-22'); assert.equal(k.baptism, '2026-01-11');
  assert.equal(keys(2027).ash, '2027-02-10');
});
test('coincide con lo publicado por la fuente litúrgica para hoy', () => {
  const l = litDay('2026-11-05');
  assert.equal(l.title, 'Jueves de la XXXI semana del Tiempo Ordinario'); assert.equal(l.color, 'verde'); assert.equal(l.season, 'ordinario');
});
test('tiempos y colores', () => {
  assert.equal(litDay('2026-12-13').color, 'rosa'); assert.match(litDay('2026-12-13').title, /III Domingo de Adviento/);
  assert.equal(litDay('2026-03-15').color, 'rosa');
  assert.equal(litDay('2026-04-03').title, 'Viernes Santo de la Pasión del Señor'); assert.equal(litDay('2026-04-03').color, 'rojo');
  assert.equal(litDay('2026-04-05').season, 'pascua'); assert.equal(litDay('2026-03-30').season, 'semana-santa');
  assert.equal(litDay('2026-12-25').title, 'La Natividad del Señor'); assert.equal(litDay('2026-01-06').title, 'La Epifanía del Señor');
  assert.equal(litDay('2026-11-22').rank, 1);
  assert.equal(litDay('2026-05-17').title, 'La Ascensión del Señor');
  assert.equal(litDay('2026-06-07').title, 'El Santísimo Cuerpo y Sangre de Cristo');
});
test('ciclos', () => { assert.equal(litDay('2026-11-05').cycle, 'A'); assert.equal(litDay('2026-11-29').cycle, 'B'); assert.equal(litDay('2026-11-05').weekdayCycle, 'II'); assert.equal(litDay('2026-11-29').weekdayCycle, 'I'); });
test('santoral y precedencias', () => {
  assert.equal(litDay('2026-07-25').rank, 1); assert.match(litDay('2026-07-25').title, /Santiago/);
  assert.equal(litDay('2026-10-15').rank, 2);
  assert.equal(litDay('2026-10-04').rank, 'domingo'); // san Francisco cede al domingo en 2026
  assert.match(litDay('2026-09-14').title, /Exaltación/);
  assert.match(litDay('2026-08-09').title, /Domingo/); // fiesta de santo cede al domingo ordinario
  assert.match(litDay('2026-08-06').title, /Transfiguración/);
  assert.match(litDay('2026-11-02').title, /fieles difuntos/);
  assert.equal(litDay('2026-11-01').rank, 1); // Todos los Santos prevalece sobre el domingo
});
test('traslados de solemnidades', () => {
  // 2027: 19 de marzo es viernes de la V semana de Cuaresma; 25 de marzo es Jueves Santo.
  assert.match(litDay('2027-03-19').title, /San José/);
  assert.equal(litDay('2027-03-25').title, 'Jueves Santo');
  assert.match(litDay('2027-04-05').title, /Anunciación/);
  // 2028: 8 de diciembre es viernes; 2030: domingo de Adviento → lunes 9.
  assert.match(litDay('2030-12-09').title, /Inmaculada/); assert.match(litDay('2030-12-08').title, /II Domingo de Adviento/);
  // 2024: san José no se movió; 2035: 19 de marzo es Lunes Santo → sábado anterior.
  assert.match(litDay('2035-03-17').title, /San José/);
});
test('todos los días de varios años tienen título y semana coherente', () => {
  for (let y = 2025; y <= 2040; y++) for (let d = new Date(y, 0, 1, 12); d.getFullYear() === y; d.setDate(d.getDate() + 1)) {
    const s = `${y}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, l = litDay(s);
    assert.ok(l.title && !/undefined/.test(l.title), s); if (l.season === 'ordinario' && l.week !== null) assert.ok(l.week >= 1 && l.week <= 34, `${s} ${l.week}`);
  }
  assert.equal(upcoming('2026-11-05', 3).length, 3);
});
test('santoral con todos los días', () => { assert.deepEqual(MARTYROLOGY.map((m) => m.length), [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]); assert.ok(QUOTES.every((q) => q.source)); });

const catalog: Verse[] = JSON.parse(fs.readFileSync('public/data/verses.json', 'utf8'));
test('catálogo amplio y único', () => { assert.ok(catalog.length > 1000); assert.equal(new Set(catalog.map((v) => v.id)).size, catalog.length); });
test('el texto de cada versículo procede de la Biblia incluida', () => {
  for (const v of catalog.slice(0, 200)) { const b = JSON.parse(fs.readFileSync(`public/bible/${v.book}.json`, 'utf8')); assert.ok(b.chapters[v.c]?.[v.v], v.id); }
});
test('antirrepetición: no repite hasta agotar y luego recupera los más antiguos', () => {
  const hist: { day: string; id: string }[] = []; const start = Date.UTC(2026, 0, 1);
  const day = (i: number) => new Date(start + i * 86400000).toISOString().slice(0, 10);
  for (let i = 0; i < catalog.length; i++) { const v = pickVerse(catalog, hist, day(i), 'user-a'); assert.ok(!hist.some((h) => h.id === v.id), `repetido en ${i}`); hist.push({ day: day(i), id: v.id }); }
  const oldest = new Set(hist.slice(0, Math.ceil(catalog.length * 0.05)).map((h) => h.id));
  const next = pickVerse(catalog, hist, day(catalog.length), 'user-a');
  assert.ok(oldest.has(next.id), 'debe volver uno de los más antiguos');
});
test('misma elección en dos dispositivos; distinta para otra persona', () => {
  const h = [{ day: '2026-11-04', id: catalog[3].id }];
  assert.equal(pickVerse(catalog, h, '2026-11-05', 'u1').id, pickVerse(catalog, [...h], '2026-11-05', 'u1').id);
  const diff = Array.from({ length: 20 }, (_, i) => pickVerse(catalog, [], `2026-11-${String(i + 1).padStart(2, '0')}`, 'u1').id !== pickVerse(catalog, [], `2026-11-${String(i + 1).padStart(2, '0')}`, 'u2').id);
  assert.ok(diff.some(Boolean));
});
test('evita el mismo libro reciente y favorece el tiempo litúrgico', () => {
  const v = pickVerse(catalog, [], '2026-03-01', 's', 'cuaresma'); assert.ok(['conversion', 'misericordia', 'caridad', 'humildad'].includes(v.theme));
});

test('citas bíblicas', () => {
  const { books } = JSON.parse(fs.readFileSync('public/data/books.json', 'utf8')) as { books: BookMeta[] };
  const r = (q: string) => { const x = parseReference(q, books); return x && `${x.book.code} ${x.c} ${x.v ?? ''}`.trim(); };
  assert.equal(r('Jn 3,16'), 'JHN 3 16'); assert.equal(r('1 Cor 13'), '1CO 13'); assert.equal(r('Salmo 22:1'), 'PSA 22 1'); assert.equal(r('juan 3'), 'JHN 3'); assert.equal(r('Eclo 2,1'), 'SIR 2 1'); assert.equal(r('Hch 2,1'), 'ACT 2 1'); assert.equal(r('misericordia'), null);
});
test('rosario: 53 avemarías y 6 padrenuestros', () => {
  const s = rosarySteps('gozosos'); assert.equal(s.filter((x) => x.id.startsWith('am')).length, 53); assert.equal(s.filter((x) => x.id.startsWith('pn')).length, 6); assert.equal(s.filter((x) => x.id.startsWith('mi-')).length, 5);
  assert.equal(chapletSteps().filter((x) => x.id.startsWith('do-')).length, 50);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(mysteriesOfDay), ['gloriosos', 'gozosos', 'dolorosos', 'gloriosos', 'luminosos', 'dolorosos', 'gozosos']);
});

const RSS = `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>X</title>
<item><title><![CDATA[El Papa recibe a los obispos de España &amp; más]]></title><link>https://a.es/1</link><pubDate>Thu, 05 Nov 2026 08:00:00 +0100</pubDate><description><![CDATA[<p>Resumen <b>real</b></p>]]></description><media:content url="https://a.es/1.jpg" medium="image"/></item>
<item><title>Sin fecha</title><link>https://a.es/2</link></item>
<item><title>Con foto en contenido</title><link>https://a.es/3</link><pubDate>Wed, 04 Nov 2026 08:00:00 GMT</pubDate><content:encoded><![CDATA[<img src="https://a.es/3.png"> texto]]></content:encoded><category>Cofradías</category></item></channel></rss>`;
test('RSS: conserva fecha real, imagen y resumen sin HTML', () => {
  const items = parseFeed(RSS);
  const a = items.find((i) => i.link === 'https://a.es/1')!; assert.equal(a.title, 'El Papa recibe a los obispos de España & más'); assert.equal(a.image, 'https://a.es/1.jpg'); assert.match(a.summary, /Resumen real/); assert.ok(a.date);
  assert.equal(items.find((i) => i.link === 'https://a.es/2')?.date ?? null, null);
  assert.equal(items.find((i) => i.link === 'https://a.es/3')!.image, 'https://a.es/3.png');
  const c = classify(a, []); assert.ok(c.includes('papa') && c.includes('espana'));
});
test('clasificación de noticias: «Santa Sede» no es de santos', () => {
  assert.ok(!classify({ title: 'La Santa Sede publica un documento', categories: [], link: '', summary: '', date: null, image: null }, []).includes('santos'));
  assert.ok(classify({ title: 'Hermandad del Gran Poder y su capataz', categories: [], link: '', summary: '', date: null, image: null }, []).includes('cofradias'));
});
test('templos: excluye otras confesiones y nunca inventa horarios', () => {
  assert.equal(toPlace({ type: 'node', id: 1, lat: 1, lon: 1, tags: { name: 'Iglesia Evangélica', religion: 'christian' } }), null);
  assert.equal(toPlace({ type: 'node', id: 1, lat: 1, lon: 1, tags: { name: 'St', religion: 'christian', denomination: 'orthodox' } }), null);
  const p = toPlace({ type: 'way', id: 2, center: { lat: 36.7, lon: -3.5 }, tags: { name: 'Parroquia de la Encarnación', amenity: 'place_of_worship', religion: 'christian', denomination: 'catholic' } })!;
  assert.equal(p.kind, 'parroquia'); assert.equal(p.mass.status, 'unavailable'); assert.equal(p.mass.text, null);
  const q = toPlace({ type: 'node', id: 3, lat: 1, lon: 1, tags: { name: 'Catedral', service_times: 'Su 10:00', check_date: '2025-01-01' } })!;
  assert.equal(q.mass.status, 'community'); assert.equal(q.kind, 'catedral'); assert.equal(q.mass.checkedOn, '2025-01-01');
  assert.equal(classifyPlace({ name: 'Monasterio de San Jerónimo' }), 'monasterio'); assert.equal(classifyPlace({ name: 'Convento de Santa Clara' }), 'convento'); assert.equal(classifyPlace({ name: 'Basílica del Gran Poder' }), 'basilica');
});
test('saneado de lecturas y chat', () => {
  assert.deepEqual(parseSaints('<a href="#">San Carlos</a><a href="#">Santa Inés</a>'), ['San Carlos', 'Santa Inés']);
});
test('Web Push: cifrado RFC 8291 descifrable y VAPID verificable', () => {
  const ua = crypto.createECDH('prime256v1'); ua.generateKeys(); const auth = crypto.randomBytes(16);
  const body = encryptPayload(Buffer.from('{"title":"hola"}'), ua.getPublicKey().toString('base64url'), auth.toString('base64url'));
  const salt = body.subarray(0, 16), idlen = body[20], as = body.subarray(21, 21 + idlen), enc = body.subarray(21 + idlen);
  const hk = (s: Buffer, i: Buffer, info: Buffer, n: number) => Buffer.from(crypto.hkdfSync('sha256', i, s, info, n));
  const ikm = hk(auth, ua.computeSecret(as), Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), as]), 32);
  const d = crypto.createDecipheriv('aes-128-gcm', hk(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16), hk(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12));
  d.setAuthTag(enc.subarray(enc.length - 16));
  const out = Buffer.concat([d.update(enc.subarray(0, enc.length - 16)), d.final()]);
  assert.equal(out.subarray(0, out.length - 1).toString(), '{"title":"hola"}');
  const v = generateVapid(), h = vapidHeader('https://push.example/x', v.publicKey, v.privateKey, 'mailto:a@b.c');
  assert.match(h, /^vapid t=.+, k=/);
  assert.equal(isDue({ id: 'g', time: '08:30', enabled: true }, 'Europe/Madrid', new Date('2026-11-05T07:40:00Z')).due, true);
  assert.equal(isDue({ id: 'g', time: '08:30', enabled: true }, 'Europe/Madrid', new Date('2026-11-05T12:00:00Z')).due, false);
});

import { parseSchedule, nextMasses, weeklyRows } from '../src/lib/massTimes.ts';
test('horarios de misa: formato OpenStreetMap', () => {
  const w = parseSchedule('Mo-Sa 19:00; Su 10:00,12:00')!;
  assert.deepEqual(w[0], [600, 720]); assert.deepEqual(w[3], [1140]);
  assert.deepEqual(weeklyRows(w), [{ days: 'Lunes a sábado', times: '19:00' }, { days: 'Domingo', times: '10:00, 12:00' }]);
});
test('horarios de misa: castellano', () => {
  const w = parseSchedule('De lunes a viernes 19:30\nSábados 20:00; Domingos 11:00 y 13:00')!;
  assert.deepEqual(w[1], [1170]); assert.deepEqual(w[6], [1200]); assert.deepEqual(w[0], [660, 780]);
  assert.deepEqual(parseSchedule('L-V 8.30')![5], [510]);
});
test('horarios de misa: lo dudoso no se calcula', () => {
  assert.equal(parseSchedule('Jul-Aug Su 10:00'), null);
  assert.equal(parseSchedule('Consultar en la parroquia'), null);
  assert.equal(parseSchedule('Su 10:00; Sa 19:00 (en verano 20:00)'), null);
  assert.equal(parseSchedule(''), null);
});
test('próximas misas', () => {
  const w = parseSchedule('Mo-Sa 19:00; Su 10:00,12:00')!;
  const sat = new Date(2026, 10, 7, 18, 30); // sábado
  const n = nextMasses(w, sat);
  assert.equal(n[0].at.getHours(), 19); assert.equal(n[0].dayOffset, 0);
  assert.equal(n[1].at.getDay(), 0); assert.equal(n[1].at.getHours(), 10);
  assert.equal(nextMasses(w, new Date(2026, 10, 7, 19, 3))[0].at.getHours(), 19); // empezó hace 3 min
});
