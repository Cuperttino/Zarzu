// Servidor local: compila y sirve la app y la API con el mismo código que en producción.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
if (fs.existsSync('.env')) for (const l of fs.readFileSync('.env', 'utf8').split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2]; }
execFileSync('node', ['scripts/build.mjs'], { stdio: 'inherit' });
await build({ entryPoints: ['server/node.ts'], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: '.tmp-server.mjs', logLevel: 'error' });
await import(path.resolve('.tmp-server.mjs'));
