# Zarzu

App católica diaria: Evangelio y lecturas, versículo que no se repite, rosario, oraciones, santos, noticias de la Iglesia, radar de misas y templos cercanos. Funciona en móvil, tablet y ordenador, y se instala como app (PWA).

El nombre viene de la zarza ardiente (Éxodo 3): el fuego que arde sin consumirse. La racha diaria se muestra como una llama. En una búsqueda web no apareció ninguna app ni marca con ese nombre, aunque sí existe como apellido y como nombre artístico. Antes de lanzarla, consulta las marcas en [OEPM](https://consultas2.oepm.es/LocalizadorWeb/) y [EUIPO](https://euipo.europa.eu/eSearch/), y si el dominio está libre.

## Qué funciona y qué necesita configuración

| Función | Sin configurar nada | Necesita |
| --- | --- | --- |
| Biblia completa (73 libros), lector, búsqueda, modo lectura, descarga sin conexión | Sí | |
| Versículo diario con antirrepetición (1264 pasajes), historial, compartir como imagen | Sí, en el dispositivo | Supabase para sincronizar |
| Calendario litúrgico con el propio de España, santoral, oraciones, rosario, coronilla, estadísticas | Sí | |
| Lecturas del día, noticias y templos | Sí, al publicar en Vercel | Nada: son fuentes públicas |
| Cuentas, sincronización y panel de administración | | Supabase |
| Recordatorios push | | Supabase, claves VAPID y GitHub Actions |

Si falta un servicio, la pantalla lo dice. La app no muestra datos simulados.

## Publicar en internet

### 1. Subir el código a GitHub
Crea un repositorio vacío llamado `Zarzu` y sube esta carpeta.

### 2. Supabase (gratis)
1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En SQL Editor, pega y ejecuta `supabase/schema.sql`.
3. En Authentication > URL Configuration, pon la dirección de tu app como Site URL y añádela a Redirect URLs.
4. Copia de Project Settings > API: `Project URL`, clave `anon` y clave `service_role`.

### 3. Vercel (gratis)
1. Importa el repositorio en [vercel.com](https://vercel.com). `vercel.json` ya indica cómo compilar.
2. En Settings > Environment Variables, añade las de `.env.example`:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `CONTACT_URL` (la dirección de tu repositorio; lo piden las normas de OpenStreetMap)
   - `PUBLIC_SITE_URL` (la dirección de la app, para SEO)
3. Vuelve a desplegar.
4. Comprueba las fuentes reales en `https://tu-dominio/api/health?live=1`.

### 4. Hacerte administrador
Crea tu cuenta en la app y ejecuta en Supabase, con tu correo:
```sql
insert into public.app_admins (user_id) select id from auth.users where email = 'tu-correo@ejemplo.com';
```
Aparecerá «Administración» en Perfil.

### 5. Recordatorios (opcional)
1. Ejecuta `npm run vapid` y añade `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` en Vercel.
2. Inventa un `CRON_SECRET` largo y añádelo también en Vercel.
3. En GitHub > Settings > Secrets and variables > Actions, crea `APP_URL` y `CRON_SECRET`. El archivo `.github/workflows/reminders.yml` hará el resto.

En iPhone, las notificaciones solo funcionan tras añadir la app a la pantalla de inicio desde Safari.

## Desarrollo

```sh
npm install
npm run dev        # http://localhost:3000
npm test
npm run typecheck
npm run check:sources   # comprueba desde tu ordenador que responden las fuentes reales
```

## Arquitectura

- `src/`: React 19, TypeScript y Tailwind CSS 4, compilados con esbuild (`scripts/build.mjs`).
- `src/lib/calendar.ts`: motor del calendario litúrgico, sin red.
- `src/lib/verses.ts`: selección del versículo. Prioriza los nunca vistos, recupera primero los más antiguos y evita libro, capítulo y tema recientes.
- `src/lib/store.ts`: datos locales, cola de sincronización y reparto del versículo entre dispositivos. La clave única (usuario, día) en Supabase resuelve el caso de dos dispositivos a la vez.
- `server/`: API sin dependencias (noticias, lecturas, templos, push). `api/index.ts` la expone en Vercel y `server/node.ts` en cualquier servidor Node.
- `supabase/schema.sql`: tablas con Row Level Security. Cada persona solo accede a sus datos.
- `.e2e/`: prueba de navegador con Playwright (fuentes externas y Supabase simulados).

## Fuentes y licencias: revisar antes de un lanzamiento público

- **Biblia:** traducción de Félix Torres Amat (siglo XIX), de dominio público. Texto del proyecto [Iter Catholicum](https://github.com/danloi2/itercatholicum); Ester 11-16 y Daniel 13-14 proceden de la transcripción de Wikisource reunida en [iguridi/bible](https://github.com/iguridi/bible), y algunos capítulos son parciales (la app lo avisa). Los salmos usan la numeración de la Vulgata.
- **Lecturas del día:** [Evangelizo](https://evangeliodeldia.org). Su web indica copyright y no publica condiciones de reutilización ni la traducción que usa. **Pide permiso a Evangelizo antes de abrir la app al público o monetizarla.** El uso del texto litúrgico oficial de la Conferencia Episcopal Española también requeriría autorización.
- **Noticias:** se muestran titular, resumen breve y enlace al medio. Conviene confirmarlo con los medios si la app crece.
- **Mapas:** © colaboradores de OpenStreetMap (ODbL). Los servidores públicos de teselas, Overpass y Nominatim tienen límites de uso: para mucho tráfico hay que usar un proveedor propio (`MAP_TILE_URL`).
- **Horarios de misas de [misas.org](https://misas.org) (Asociación Eucharistia):** el radar consulta su búsqueda pública de misas y de adoración del Santísimo (normal, prolongada y perpetua) para hoy y mañana, con permiso de la asociación según el titular del proyecto. Guarda ese permiso por escrito. La app cita la fuente y enlaza a la ficha de cada templo. Si cambian su web, el radar seguirá funcionando con las demás fuentes.
- **Horarios de misas:** solo se muestran si están en OpenStreetMap (marcados «Sin confirmar») o los introduce un administrador con enlace a la fuente y fecha («Confirmado»). En OpenStreetMap suele haber pocos, así que al principio la mayoría de templos dirán «No disponible».
- **Calendario:** calculado con el calendario general y el de España. No incluye propios diocesanos. Conviene que lo revise alguien con el Ordo en la mano.
- **Fuentes Bricolage Grotesque y Crimson Pro:** licencia SIL OFL, incluidas en la app sin depender de Google Fonts.
- **Intenciones del Papa (`src/data/popeIntentions.ts`):** tema de cada mes de 2026 y títulos de 2027, con enlace a [popesprayer.va](https://www.popesprayer.va/es/) para el texto completo. Hay que añadir las de 2028 cuando se publiquen.
- **Diario espiritual:** se guarda solo en el dispositivo; no se sincroniza ni se sube.
- **Revisión pastoral:** el examen de conciencia (`src/data/examen.ts`), las oraciones, frases, biografías y reflexiones propias se han escrito sin revisión eclesiástica. Conviene que las revise un sacerdote antes del lanzamiento.
