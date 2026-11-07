// Función única de Vercel: todas las rutas /api/* llegan aquí mediante la reescritura de vercel.json.
import { route } from '../server/router.js';
async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const sub = url.searchParams.get('__path');
  if (sub !== null) { url.searchParams.delete('__path'); url.pathname = `/api/${sub}`; }
  return route(new Request(url, req));
}
export const GET = handle;
export const POST = handle;
