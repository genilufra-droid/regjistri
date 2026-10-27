#!/usr/bin/env node
'use strict';
/* =====================================================================
   Vendos lidhjen me Supabase te faqja (docs/index.html) — pa i kërkuar
   askujt të hapë e të gjejë dy rreshtat me dorë.

   Përdorim:
     node cakto-lidhjen.js https://abcdefgh.supabase.co sb_publishable_xxx
                                    ose eyJhbGciOi…

   Pasi ekzekutohet: git add docs/index.html && git commit -m "Lidhja e re" && git push
   (GitHub Pages e përditëson vetë për ~1 minutë.)

   Shënim: po atë çift URL+çelës mund ta vendosësh edhe nga faqja, te
   “Të dhënat → Ndrysho lidhjen”; ai ruhet vetëm në atë pajisje. Ky skript
   e ndryshon për të gjithë stafin.
   ===================================================================== */
const fs = require('fs');
const path = require('path');

const [, , rawUrl, rawKey] = process.argv;
const usage = () =>
  'Përdorim: node cakto-lidhjen.js https://abcdefgh.supabase.co <anon ose sb_publishable_…>';

if (!rawUrl || !rawKey) { console.error(usage()); process.exit(1); }

const url = String(rawUrl).trim().replace(/\/+$/, '');
const key = String(rawKey).trim();

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
  console.error('❌ URL-ja duhet të jetë e formës https://<projekti>.supabase.co (pa / në fund).');
  process.exit(1);
}
if (/[\s'"]/.test(key) || key.length < 20) {
  console.error('❌ Çelësi duket i pavlefshëm: duhet i plotë, pa hapësira dhe pa thonjëza.');
  process.exit(1);
}

const file = path.join(__dirname, 'docs', 'index.html');
let html = fs.readFileSync(file, 'utf8');
const RE_URL = /window\.SUPABASE_URL\s*=\s*'[^']*';/;
const RE_KEY = /window\.SUPABASE_ANON_KEY\s*=\s*'[^']*';/;

if (!RE_URL.test(html) || !RE_KEY.test(html)) {
  console.error('❌ Nuk u gjet vendi i konfigurimit te docs/index.html (window.SUPABASE_URL / SUPABASE_ANON_KEY).');
  process.exit(1);
}

html = html
  .replace(RE_URL, `window.SUPABASE_URL      = '${url}';`)
  .replace(RE_KEY, `window.SUPABASE_ANON_KEY = '${key}';`);

fs.writeFileSync(file, html);
console.log('\n  ✔ Lidhja u vendos te docs/index.html');
console.log('    URL:    ' + url);
console.log('    Çelësi: ' + key.slice(0, 12) + '…' + key.slice(-4));
console.log('\n  Hapi tjetër:');
console.log('    git add docs/index.html && git commit -m "Lidhja e re me Supabase" && git push\n');
