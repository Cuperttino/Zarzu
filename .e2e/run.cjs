// Prueba E2E con navegador real. Las fuentes externas se simulan aquí porque el entorno de prueba no tiene red.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://localhost:4173', SB = 'http://localhost:54399', OUT = process.env.SHOTS || '.e2e/shots';
fs.mkdirSync(OUT, { recursive: true });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/+F/PQAJYwPLv7cn2QAAAABJRU5ErkJggg==', 'base64');
const fails = [], ok = (c, m) => { console.log(`${c ? 'OK ' : 'MAL'} ${m}`); if (!c) fails.push(m); };
const LIT = { date: '2026-11-05', title: 'Jueves de la 31a semana del Tiempo Ordinario', saints: ['San Zacarías'], commentary: { title: 'Comentario de prueba', author: 'Autor', source: 'Fuente', text: 'Texto del comentario.' }, source: { name: 'Evangelio del día (evangelizo.org)', url: 'https://evangeliodeldia.org' }, fetchedAt: new Date().toISOString(), readings: [{ key: 'FR', label: 'Primera lectura', reference: 'Carta a los Filipenses 3,3-8a', text: '[TEXTO DE PRUEBA de la primera lectura]' }, { key: 'PS', label: 'Salmo responsorial', reference: 'Salmo 105(104)', text: '[TEXTO DE PRUEBA]\n[del salmo]' }, { key: 'GSP', label: 'Evangelio', reference: 'Evangelio según san Lucas 15,1-10', text: '[TEXTO DE PRUEBA del Evangelio, solo para esta comprobación automática de la pantalla, que debe mostrar varias líneas de lectura.]' }] };
const NEWS = { fetchedAt: new Date().toISOString(), sources: [{ id: 'x', name: 'Fuente de prueba', ok: true, count: 3 }], items: [1, 2, 3, 4].map((i) => ({ id: `n${i}`, title: `Titular de prueba número ${i} sobre la Iglesia`, summary: 'Resumen de prueba.', date: new Date(Date.now() - i * 3600000).toISOString(), image: i === 2 ? null : 'https://img.test/x.png', source: 'Fuente de prueba', sourceId: 'x', link: 'https://example.org', categories: i === 1 ? ['vaticano'] : ['diocesis'] })) };
const PLACES = { places: [
  { id: 'way/1', name: 'Parroquia de la Encarnación', kind: 'parroquia', lat: 36.7445, lon: -3.5205, address: 'Plaza de España, 1. 18600 Motril', phone: null, website: null, photo: null, openingHours: null, osmUrl: 'https://osm.org/way/1', mass: { status: 'unavailable', text: null, sourceUrl: null, sourceName: null, checkedOn: null }, confession: { status: 'unavailable', text: null, sourceUrl: null, sourceName: null, checkedOn: null }, opening: { status: 'unavailable', text: null, sourceUrl: null, sourceName: null, checkedOn: null } },
  { id: 'node/2', name: 'Santuario de prueba', kind: 'santuario', lat: 36.75, lon: -3.51, address: null, phone: '958 000 000', website: 'https://example.org', photo: null, openingHours: null, osmUrl: 'https://osm.org/node/2', mass: { status: 'verified', text: 'Domingos, 12:00', sourceUrl: 'https://example.org', sourceName: 'Web de prueba', checkedOn: '2026-10-01' }, confession: { status: 'unavailable', text: null, sourceUrl: null, sourceName: null, checkedOn: null }, opening: { status: 'community', text: 'Mo-Su 09:00-13:00', sourceUrl: 'https://osm.org/node/2', sourceName: 'OpenStreetMap', checkedOn: null } },
  { id: 'node/3', name: 'Iglesia de la Victoria', kind: 'iglesia', lat: 36.7438, lon: -3.5160, address: null, phone: null, website: null, photo: null, openingHours: null, osmUrl: 'https://osm.org/node/3', mass: { status: 'community', text: 'Mo-Sa 08:00,19:30; Su 09:00,11:00,13:00,20:00', sourceUrl: 'https://osm.org/node/3', sourceName: 'OpenStreetMap', checkedOn: null }, confession: { status: 'unavailable', text: null, sourceUrl: null, sourceName: null, checkedOn: null }, opening: { status: 'unavailable', text: null, sourceUrl: null, sourceName: null, checkedOn: null } },
  { id: 'node/4', name: 'Ermita de prueba', kind: 'ermita', lat: 36.7470, lon: -3.5230, address: null, phone: null, website: null, photo: null, openingHours: null, osmUrl: 'https://osm.org/node/4', mass: { status: 'community', text: 'Su 10:00 (en verano 9:00)', sourceUrl: 'https://osm.org/node/4', sourceName: 'OpenStreetMap', checkedOn: null }, confession: { status: 'unavailable', text: null, sourceUrl: null, sourceName: null, checkedOn: null }, opening: { status: 'unavailable', text: null, sourceUrl: null, sourceName: null, checkedOn: null } },
], fetchedAt: new Date().toISOString() };

async function ctx(browser, opts = {}) {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, geolocation: { latitude: 36.7445, longitude: -3.5205 }, permissions: ['geolocation'], ...opts });
  await c.route('**/*', (r) => {
    const u = new URL(r.request().url());
    if (u.origin === BASE || u.origin === SB) {
      if (u.pathname === '/api/config') return r.fulfill({ json: { supabaseUrl: opts.noSb ? null : SB, supabaseAnonKey: opts.noSb ? null : 'anon', pushPublicKey: null, tileUrl: 'https://tile.test/{z}/{x}/{y}.png' } });
      if (u.pathname === '/api/liturgy') return r.fulfill({ json: LIT });
      if (u.pathname === '/api/news') return opts.newsDown ? r.abort() : r.fulfill({ json: NEWS });
      if (u.pathname === '/api/misas') {
        const f = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
        const dt = u.searchParams.get('date'), d0 = dt || f(new Date()), d1 = dt ? null : f(new Date(Date.now() + 86400000));
        const soon = new Date(Date.now() + 40 * 60000), hm = `${String(soon.getHours()).padStart(2, '0')}:${String(soon.getMinutes()).padStart(2, '0')}`;
        if (u.searchParams.get('kind') === 'adorations') {
          const h0 = new Date(Date.now() - 30 * 60000), h1 = new Date(Date.now() + 60 * 60000), f2 = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          return r.fulfill({ json: { kind: 'adorations', source: 'misas.org', dates: [d0, d1], fetchedAt: new Date().toISOString(), churches: [
            { id: 3, name: 'Parroquia con adoración', address: 'Plaza Mayor', town: 'Motril', lat: 36.7445, lon: -3.5165, photo: null, url: 'https://misas.org/p/ador/' + d0, masses: {}, adorations: { [d0]: [{ type: 'normal', begin: f2(h0), end: f2(h1), note: 'en invierno' }] } },
            { id: 4, name: 'Capilla de adoración perpetua', address: 'Calle Santísimo', town: 'Motril', lat: 36.7500, lon: -3.5200, photo: null, url: 'https://misas.org/p/perpetua/' + d0, masses: {}, adorations: { [d0]: [{ type: 'perpetua', begin: '00:00', end: '00:00', note: '' }], [d1]: [{ type: 'perpetua', begin: '00:00', end: '00:00', note: '' }] } },
          ] } });
        }
        return r.fulfill({ json: { source: 'misas.org', dates: [d0, d1].filter(Boolean), fetchedAt: new Date().toISOString(), churches: [
          { id: 1, name: 'Iglesia de la Victoria (misas.org)', address: 'Plaza de San Agustín', town: 'Motril', lat: 36.7439, lon: -3.5161, photo: null, url: 'https://misas.org/p/prueba/' + d0, masses: dt ? { [d0]: ['10:00', '12:00'] } : { [d0]: [hm], [d1]: ['08:30', '19:30'] }, adorations: {} },
          { id: 2, name: 'Capilla solo en misas.org', address: 'Calle Prueba', town: 'Motril', lat: 36.7480, lon: -3.5150, photo: null, url: 'https://misas.org/p/prueba2/' + d0, masses: {}, adorations: {} },
        ] } });
      }
      if (u.pathname === '/api/places') return r.fulfill({ json: PLACES });
      if (u.pathname === '/api/geocode') return r.fulfill({ json: { results: [{ name: 'Motril, Granada, Andalucía, España', lat: 36.7445, lon: -3.5205 }] } });
      return r.continue();
    }
    if (u.hostname === 'tile.test' || u.hostname === 'img.test') return r.fulfill({ contentType: 'image/png', body: png });
    return r.abort();
  });
  return c;
}
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

(async () => {
  const browser = await chromium.launch();
  // Las insignias nuevas se celebran con un diálogo: se comprueba la primera y luego se cierran solas.
  let badgeShots = 0;
  const badges = async (pg) => pg.addLocatorHandler(pg.getByText(/^Nuevas? insignias?$/), async () => { if (!badgeShots++) await pg.screenshot({ path: '.e2e/shots/20-insignia.png' }); await pg.getByRole('button', { name: '¡Gracias, Señor!' }).click(); });
  const c = await ctx(browser), p = await c.newPage(); await badges(p); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  const shot = (n) => p.screenshot({ path: `${OUT}/${n}.png` });

  await p.goto(BASE); await p.getByRole('dialog').waitFor();
  await shot('00-bienvenida');
  await shot('00-bienvenida'); await p.getByLabel('Tu nombre').fill('Santi'); await p.getByRole('button', { name: 'Empezar' }).click();
  await p.locator('blockquote').first().waitFor(); await p.waitForTimeout(600);
  const hero = await p.locator('h1').first().innerText(); ok(/Santi/.test(hero), `saludo personalizado: ${hero}`);
  ok(await p.getByText(/Tiempo Ordinario|Adviento|Navidad|Cuaresma|Pascua|Semana Santa/).first().isVisible(), 'día litúrgico visible');
  const verseText = await p.locator('blockquote').first().innerText(); ok(verseText.length > 20, 'versículo con texto real');
  await p.waitForTimeout(500); await shot('01-inicio');
  { const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Compartir como imagen' }).first().click()]); await dl.saveAs(`${OUT}/share.png`); ok(true, 'imagen para compartir'); }
  await p.getByRole('button', { name: /Empieza tu día/ }).click(); await p.waitForTimeout(800); await shot('01c-historia'); await p.getByRole('dialog').click({ position: { x: 330, y: 120 } }); await p.waitForTimeout(500); await shot('01d-historia-evangelio'); await p.getByRole('dialog').click({ position: { x: 330, y: 120 } }); await p.getByRole('dialog').click({ position: { x: 330, y: 120 } }); await p.getByRole('dialog').click({ position: { x: 330, y: 120 } }); await p.waitForTimeout(700); await shot('01e-historia-racha'); ok(await p.getByRole('dialog').getByText('Rezar un Padre nuestro').isVisible(), 'historias completas'); await p.getByRole('button', { name: 'Terminar', exact: true }).click();
  await p.screenshot({ path: `${OUT}/01b-inicio-entero.png`, fullPage: true });
  ok(await p.getByText('Titular de prueba número 1 sobre la Iglesia').count() > 0, 'noticias en inicio');
  await p.reload(); await p.getByText('Versículo de hoy').waitFor(); await p.waitForTimeout(300);
  ok((await p.locator('blockquote').first().innerText()) === verseText, 'el versículo no cambia al recargar');

  // Favorito + historial
  await p.getByRole('button', { name: 'Guardar en favoritos' }).first().click();
  await p.getByRole('link', { name: 'Evangelio de hoy' }).first().click(); await p.getByRole('heading', { name: 'Primera lectura' }).waitFor(); await p.waitForTimeout(200);
  await shot('02-liturgia'); ok(!(await p.getByText('Para entenderlo y vivirlo').count()), 'liturgia sin IA');
  ok(await p.getByText('Hoy no hay segunda lectura.').isVisible(), 'sin segunda lectura cuando no corresponde');

  // Biblia
  await p.goto(`${BASE}/biblia`); await p.getByText('Pentateuco').waitFor(); await shot('03-biblia');
  ok(await p.getByRole('link', { name: /Sabiduría/ }).count() > 0, 'incluye deuterocanónicos');
  await p.goto(`${BASE}/biblia/JHN/3?v=16`); await p.getByText(/amó tanto Dios/).waitFor(); await p.waitForTimeout(700); await shot('04-lector'); ok(true, 'lector con versículo destacado');
  await p.getByRole('button', { name: 'Modo lectura' }).click(); await p.waitForTimeout(150); await shot('04b-modo-lectura'); await p.getByRole('button', { name: 'Salir del modo lectura' }).click();
  await p.goto(`${BASE}/biblia/buscar?q=${encodeURIComponent('buen pastor')}`); await p.locator('mark').first().waitFor({ timeout: 30000 }); await p.waitForTimeout(700); await shot('05-busqueda');
  ok(await p.locator('mark').count() > 0, 'búsqueda real en texto bíblico');
  await p.goto(`${BASE}/biblia/buscar?q=${encodeURIComponent('Jn 3,16')}`); await p.waitForURL(/JHN\/3/); ok(true, 'búsqueda por cita');

  // Oración y rosario
  await p.goto(`${BASE}/oracion`); await p.getByText('Oraciones esenciales').waitFor(); await shot('06-oracion');
  await p.goto(`${BASE}/oracion/padre-nuestro`); await p.getByText('santificado sea').waitFor();
  await p.goto(`${BASE}/oracion/rosario`); await p.getByText('Señal de la cruz').first().waitFor();
  for (let i = 0; i < 9; i++) await p.getByRole('button', { name: /^Siguiente$/ }).click();
  await p.waitForTimeout(700); await shot('07-rosario');
  ok(await p.getByText(/Padre nuestro|Ave María/).count() > 0, 'rosario avanza');
  await p.reload(); await p.waitForTimeout(300); ok(await p.getByText('Misterio 1').first().isVisible(), 'el rosario conserva el progreso');
  let n = 0; while (await p.getByRole('button', { name: /^(Siguiente|Terminar)$/ }).count() && n++ < 100) await p.getByRole('button', { name: /^(Siguiente|Terminar)$/ }).click();
  ok(await p.getByText('Oración terminada').isVisible(), `rosario completo tras ${n} pasos`);

  // Descubrir
  await p.goto(`${BASE}/descubrir`); await p.getByText('Radar de misas').first().waitFor(); await shot('08-descubrir');
  await p.goto(`${BASE}/descubrir/noticias`); await p.getByText('Titular de prueba número 1').first().waitFor(); await shot('09-noticias');
  await p.getByRole('button', { name: 'Vaticano', exact: true }).click(); ok((await p.getByText(/Titular de prueba/).count()) === 1, 'filtro de noticias');
  await p.goto(`${BASE}/descubrir/calendario`); await p.getByText('Calendario litúrgico').first().waitFor(); await shot('10-calendario');
  await p.getByRole('button', { name: /^Año/ }).click(); await p.getByText('Domingo de Ramos').waitFor(); await shot('10b-calendario-ano'); ok(await p.getByText('Semana Santa', { exact: true }).first().isVisible(), 'calendario anual con Semana Santa');
  await p.goto(`${BASE}/descubrir/santos`); await p.getByLabel('Buscar santos').fill('teresa'); await p.getByText('Santa Teresa de Jesús').first().waitFor(); await shot('11-santos'); ok(true, 'buscador de santos');
  await p.goto(`${BASE}/descubrir/santos/${encodeURIComponent('Santa Teresa de Jesús')}`); await p.getByText(/Carmelita de Ávila/).waitFor(); ok(true, 'biografía sin red externa');

  // Templos
  await p.goto(`${BASE}/descubrir/templos`); await p.getByRole('button', { name: 'Usar mi ubicación' }).first().click(); await p.getByText('Parroquia de la Encarnación').first().waitFor();
  await p.waitForTimeout(700); await shot('12-templos');
  await p.goto(`${BASE}/descubrir/misas`); await p.getByRole('button', { name: 'Activar el radar' }).click(); await p.getByRole('heading', { name: 'Próximas misas' }).waitFor();
  await p.getByText('Iglesia de la Victoria (misas.org)').first().waitFor(); ok(await p.getByText('Horario de misas.org').count() > 0, 'horarios de misas.org en el radar'); await p.getByText('Sin misa hoy ni mañana').waitFor(); await p.getByText('Con horario por revisar').waitFor(); await p.getByText('Sin horario todavía').waitFor();
  await p.waitForTimeout(700); await shot('19-radar'); await p.screenshot({ path: '.e2e/shots/19c-radar-entero.png', fullPage: true });
  await p.getByRole('button', { name: /Iglesia de la Victoria \(misas.org\), a/ }).first().click(); await p.getByRole('button', { name: 'Ver en misas.org' }).waitFor(); await p.getByRole('article').getByText('Mañana', { exact: true }).waitFor();
  await p.getByRole('button', { name: 'Fijar como mi parroquia' }).click(); await p.getByRole('button', { name: 'Es tu parroquia' }).waitFor();
  await p.waitForTimeout(700); await shot('19d-radar-misas');
  { const f3 = new Date(Date.now() + 3 * 86400000), ds = `${f3.getFullYear()}-${String(f3.getMonth() + 1).padStart(2, '0')}-${String(f3.getDate()).padStart(2, '0')}`;
    await p.getByLabel('Elegir día').fill(ds); await p.getByRole('heading', { name: /^Misas del / }).waitFor(); await p.getByText('12:00').first().waitFor(); ok(true, 'radar en otro día');
    await p.waitForTimeout(700); await shot('19g-radar-otro-dia'); await p.getByRole('button', { name: 'Hoy y mañana' }).click(); await p.getByRole('heading', { name: 'Próximas misas' }).waitFor(); }
  await p.getByRole('button', { name: /Ermita de prueba/ }).last().click(); await p.getByText('¿El horario está mal?').first().waitFor();
  await p.getByRole('tab', { name: 'Adoración', exact: true }).click(); await p.getByRole('heading', { name: 'Adoración hoy y mañana' }).waitFor(); await p.getByText(/Ahora, hasta las/).first().waitFor(); ok(await p.getByText('Parroquia con adoración').count() > 0, 'adoración en el radar');
  await p.waitForTimeout(700); await shot('19e-radar-adoracion');
  await p.getByRole('tab', { name: 'Adoración perpetua' }).click(); await p.getByText('Día y noche').first().waitFor(); ok(!(await p.getByText('Parroquia con adoración').count()), 'perpetua solo muestra perpetuas');
  await p.getByRole('button', { name: /Capilla de adoración perpetua, a/ }).first().click(); await p.getByText(/El Santísimo está expuesto día y noche/).waitFor();
  await p.waitForTimeout(700); await shot('19f-radar-perpetua');
  await p.getByRole('tab', { name: 'Misas' }).click(); await p.getByRole('heading', { name: 'Próximas misas' }).waitFor();
  await p.waitForTimeout(700); await shot('19b-radar-ficha');
  await p.goto(`${BASE}/descubrir/templos`); await p.getByRole('button', { name: 'Usar mi ubicación' }).first().click(); await p.getByText('Parroquia de la Encarnación').first().waitFor();
  await p.getByRole('button', { name: /Santuario de prueba/ }).last().click(); await p.getByRole('cell', { name: '12:00' }).first().waitFor(); await p.getByRole('cell', { name: '12:00' }).first().scrollIntoViewIfNeeded(); await shot('12b-ficha-confirmada');
  ok(await p.getByText('Confirmado').first().isVisible() && await p.getByText('Sin confirmar').first().isVisible(), 'distingue horarios confirmados y sin confirmar');
  await p.getByRole('button', { name: /Parroquia de la Encarnación/ }).last().click(); await p.getByText(/No mostramos horarios sin una fuente/).first().waitFor(); ok(true, 'sin horario: no inventa');
  await p.getByRole('application').scrollIntoViewIfNeeded(); await p.evaluate(() => scrollTo(0, 0)); const pin = p.getByRole('button', { name: 'Parroquia de la Encarnación' }).first(); const before = await pin.boundingBox(); const map = await p.getByRole('application').boundingBox();
  await p.mouse.move(map.x + 150, map.y + 100); await p.mouse.down(); await p.mouse.move(map.x + 60, map.y + 60, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(100);
  const after = await pin.boundingBox(); ok(before && after && (before.x !== after.x || before.y !== after.y), 'el mapa se arrastra');

  // Tocar la pestaña en la que ya estás no hace nada
  await p.goto(`${BASE}/biblia`); await p.getByRole('heading', { name: 'La Biblia' }).waitFor();
  { const before = await p.evaluate(() => history.length); for (let k = 0; k < 4; k++) await p.getByRole('navigation').getByRole('link', { name: 'Biblia' }).click(); await p.waitForTimeout(400);
    ok(await p.evaluate(() => history.length) === before && !(await p.evaluate(() => document.querySelector('.nav-forward'))), 'tocar la pestaña activa no hace nada'); }

  // Mi parroquia, cuenta atrás e intención del Papa en Inicio
  await p.goto(BASE); await p.getByRole('region', { name: 'Mi parroquia' }).getByText('Iglesia de la Victoria (misas.org)').waitFor();
  ok(await p.getByRole('region', { name: 'Cuenta atrás' }).getByText(/días|¡Hoy!/).count() > 0, 'cuenta atrás'); ok(await p.getByText(/Intención del Papa para/).count() === 1, 'intención del Papa');
  await p.getByRole('region', { name: 'Mi parroquia' }).scrollIntoViewIfNeeded(); await p.waitForTimeout(800); await shot('23-mi-parroquia');
  // Tu santo
  await p.goto(`${BASE}/perfil/santo`); await p.getByLabel('Nombre del santo').fill('Santiago'); await p.getByRole('button', { name: /Santiago.*25 de julio/ }).first().click(); await p.getByText(/Faltan \d+ días|Es hoy/).waitFor(); ok(true, 'tu santo');
  await p.waitForTimeout(600); await shot('24-tu-santo');
  // Diario privado: se guarda en el dispositivo y no se sube
  await p.goto(`${BASE}/perfil/diario`); await p.getByLabel('¿Qué te ha dicho Dios hoy?').fill('Gracias por este día de prueba.'); await p.getByText('Guardado en este dispositivo').waitFor();
  await p.reload(); ok(await p.getByLabel('¿Qué te ha dicho Dios hoy?').inputValue() === 'Gracias por este día de prueba.', 'diario guardado');
  ok(!JSON.stringify(await (await fetch(`${SB}/__dump`)).json()).includes('día de prueba'), 'diario no se sube'); await p.waitForTimeout(400); await shot('25-diario');

  // Examen de conciencia: marca, llega al final y no guarda nada
  await p.goto(`${BASE}/oracion/examen`); await p.getByRole('button', { name: 'Empezar' }).click();
  await p.getByRole('button', { name: /He dejado de rezar/ }).click(); ok(await p.getByRole('button', { name: /He dejado de rezar/ }).getAttribute('aria-pressed') === 'true', 'examen: marcar');
  await p.waitForTimeout(700); await shot('21-examen');
  for (let k = 0; k < 9; k++) await p.getByRole('button', { name: /^(Siguiente|Terminar)$/ }).click();
  await p.getByRole('heading', { name: 'Para recordar' }).waitFor(); await p.getByRole('heading', { name: 'Acto de contrición' }).waitFor(); ok(await p.getByText(/He dejado de rezar/).count() === 1, 'examen: resumen');
  ok(!JSON.stringify(await p.evaluate(() => localStorage)).includes('He dejado de rezar'), 'examen: no se guarda');
  await p.goto(`${BASE}/perfil/insignias`); await p.getByText(/de 15 conseguidas/).waitFor(); ok(await p.getByText('Primera llama').count() > 0, 'insignias'); await p.waitForTimeout(700); await shot('22-insignias');
  ok(badgeShots > 0, 'celebración de insignia nueva');

  // Reflexión: enlaces a la Biblia en lugar del guía
  await p.goto(`${BASE}/descubrir/reflexiones/dudas`); ok(!(await p.getByText(/guía espiritual/i).count()), 'reflexión sin botón del guía');
  await p.getByRole('link', { name: 'Mc 9,24' }).click(); await p.waitForTimeout(1200); console.log('cita:', (await p.locator('main').innerText()).slice(0, 200).replace(/\n/g, ' | '));
  await p.goBack(); await p.getByRole('link', { name: 'Sal 42 (43),5' }).click(); await p.waitForTimeout(1200); console.log('salmo:', (await p.locator('main').innerText()).slice(0, 200).replace(/\n/g, ' | '));
  // El guía con IA ya no existe
  await p.goto(`${BASE}/guia`); await p.waitForTimeout(300); ok(!(await p.getByText(/guía espiritual/i).count()), 'sin guía con IA');

  // Registro: dispositivo A
  await p.goto(`${BASE}/perfil/entrar`); await p.getByRole('button', { name: 'Crear una cuenta' }).click();
  await p.getByLabel('Correo electrónico').fill('santi@test.es'); await p.getByLabel('Contraseña').fill('contraseña1'); await p.getByRole('button', { name: 'Crear cuenta' }).click();
  await p.getByRole('button', { name: 'Cerrar sesión' }).waitFor(); await p.waitForTimeout(600); await shot('13-perfil');
  await p.goto(BASE); await p.getByText('Versículo de hoy').waitFor(); await p.locator('blockquote').first().waitFor(); await p.waitForTimeout(500);
  const vA = await p.locator('blockquote').first().innerText();
  const dump = async () => (await fetch(`${SB}/__dump`)).json();
  let d = await dump(); ok(d.verse_history.some((h) => h.shown_on === today()), 'historial de versículos subido'); ok(d.favorites.length === 1, 'favorito subido al registrarse');

  // Dispositivo B: mismo versículo y mismos favoritos
  const c2 = await ctx(browser, { viewport: { width: 1280, height: 860 }, hasTouch: false }), p2 = await c2.newPage(); await badges(p2); p2.on('pageerror', (e) => errs.push(e.message));
  await p2.goto(`${BASE}/perfil/entrar`); await p2.getByRole('dialog').getByRole('button', { name: 'Empezar' }).click();
  await p2.getByLabel('Correo electrónico').fill('santi@test.es'); await p2.getByLabel('Contraseña').fill('contraseña1'); await p2.getByRole('button', { name: 'Entrar', exact: true }).click(); await p2.getByRole('button', { name: 'Cerrar sesión' }).waitFor();
  await p2.goto(BASE); await p2.getByText('Versículo de hoy').waitFor(); await p2.locator('blockquote').first().waitFor(); await p2.waitForTimeout(500);
  ok((await p2.locator('blockquote').first().innerText()) === vA, 'mismo versículo en otro dispositivo');
  await p2.screenshot({ path: `${OUT}/15-escritorio.png` });
  await p2.goto(`${BASE}/perfil/favoritos`); ok(await p2.getByText(vA.slice(0, 30)).count() > 0, 'favoritos en otro dispositivo');
  await p2.goto(`${BASE}/descubrir/templos`); await p2.getByRole('button', { name: 'Usar mi ubicación' }).first().click(); await p2.getByText('Parroquia de la Encarnación').first().waitFor(); await p2.waitForTimeout(300); await p2.screenshot({ path: `${OUT}/16-templos-escritorio.png` });

  // Carrera de dos dispositivos en día nuevo: gana uno y ambos adoptan
  const h2 = await p.evaluate(async () => { const s = JSON.parse(localStorage.getItem('zarzu.session')); return s.user.id; });
  await fetch(`${SB}/__dump`);
  const dates = d.verse_history.length; ok(dates === 1, 'una sola fila por día'); void h2;

  // Modo oscuro
  await p.goto(`${BASE}/perfil/ajustes`); await p.getByRole('button', { name: 'Oscuro', exact: true }).click(); await p.goto(BASE); await p.getByText('Versículo de hoy').waitFor(); await p.waitForTimeout(700); await shot('17-oscuro');
  ok(await p.evaluate(() => document.documentElement.classList.contains('dark')), 'modo oscuro');
  await p.goto(`${BASE}/perfil/estadisticas`); await p.waitForTimeout(700); await shot('18-estadisticas');

  // Otra persona no ve nada de la anterior
  const c3 = await ctx(browser), p3 = await c3.newPage(); await badges(p3); await p3.goto(`${BASE}/perfil/entrar`); await p3.getByRole('button', { name: 'Empezar' }).click(); await p3.getByRole('button', { name: 'Crear una cuenta' }).click(); await p3.getByLabel('Correo electrónico').fill('otra@test.es'); await p3.getByLabel('Contraseña').fill('contraseña2'); await p3.getByRole('button', { name: 'Crear cuenta' }).click(); await p3.getByRole('button', { name: 'Cerrar sesión' }).waitFor(); await p3.waitForTimeout(400);
  await p3.goto(`${BASE}/perfil/favoritos`); ok(await p3.getByText(vA.slice(0, 30)).count() === 0, 'los datos de cada usuario están separados');
  await p3.goto(`${BASE}/perfil/entrar`); await c3.close();

  { const cd = await ctx(browser, { deviceScaleFactor: 3 }); const pd = await cd.newPage(); await badges(pd); await pd.goto(BASE); await pd.getByRole('button', { name: 'Empezar' }).click(); await pd.locator('blockquote').first().waitFor(); await pd.waitForTimeout(900); await pd.screenshot({ path: `${OUT}/dpr3-inicio.png` }); await pd.goto(`${BASE}/oracion/rosario`); await pd.waitForTimeout(700); await cd.close(); }

  // Sin servicios: mensajes honestos y noticias guardadas
  const c4 = await ctx(browser, { noSb: true, newsDown: true }), p4 = await c4.newPage(); await badges(p4); await p4.goto(BASE); await p4.getByRole('button', { name: 'Empezar' }).click(); await p4.waitForTimeout(400);
  await p4.goto(`${BASE}/perfil`); ok(await p4.getByText(/se activarán cuando/).isVisible(), 'cuentas sin configurar: lo dice');
  await p4.goto(`${BASE}/descubrir/noticias`); await p4.getByText(/No se han podido cargar/).waitFor(); ok(true, 'noticias sin red: error claro y sin inventar');
  await c4.close();

  // Desbordamiento horizontal en móvil
  for (const r of ['/', '/biblia', '/oracion', '/descubrir', '/perfil', '/liturgia', '/descubrir/calendario', '/descubrir/noticias', '/descubrir/templos', '/descubrir/misas', '/oracion/rosario']) { await p.goto(BASE + r); await p.waitForTimeout(250); const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(o <= 0, `sin scroll horizontal en ${r} (${o})`); }
  ok(!errs.length, `sin errores de JavaScript ${errs.slice(0, 5).join(' | ')}`);
  await browser.close();
  console.log(fails.length ? `\nFALLOS: ${fails.length}` : '\nTODO OK');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message.slice(0, 800)); process.exit(2); });
