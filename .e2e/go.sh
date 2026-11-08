#!/bin/bash
cd "$(dirname "$0")/.."
node scripts/build.mjs >/dev/null && npx esbuild server/node.ts --bundle --platform=node --format=esm --outfile=.tmp-server.mjs --log-level=error
node .e2e/mock-supabase.cjs >/dev/null 2>&1 & A=$!
PORT=4173 node .tmp-server.mjs >/dev/null 2>&1 & B=$!
sleep 1.5
NODE_PATH=$(npm root -g) timeout 170 node .e2e/run.cjs 2>&1 | grep -vE '^OK ' | tail -30
kill $A $B 2>/dev/null
