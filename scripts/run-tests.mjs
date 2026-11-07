import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import fs from 'node:fs';
const files = fs.readdirSync('tests').filter((f) => f.endsWith('.test.ts'));
await build({ entryPoints: files.map((f) => `tests/${f}`), bundle: true, platform: 'node', format: 'esm', outdir: '.tmp-tests', outExtension: { '.js': '.mjs' }, external: ['node:*'], define: { __PREVIEW__: 'false' }, logLevel: 'error' });
const r = spawnSync('node', ['--test', ...files.map((f) => `.tmp-tests/${f.replace('.ts', '.mjs')}`)], { stdio: 'inherit' });
fs.rmSync('.tmp-tests', { recursive: true, force: true });
process.exit(r.status ?? 1);
