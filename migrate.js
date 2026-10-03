'use strict';
/* =====================================================================
   Çon të dhënat ekzistuese në Supabase.
   Burimi mund të jetë:
     • kopje JSON e shkarkuar nga aplikacioni  → node migrate.js kopja.json
     • baza SQLite e versionit me server       → node migrate.js ../regjistri-online/data/regjistri.db
   Faturat (foto/PDF) nga dosja data/files ngarkohen në bucket-in "fatura".

   Përdorim:
     SUPABASE_URL=https://xxx.supabase.co \
     SUPABASE_KEY=<anon ose service_role key> \
     node migrate.js <burimi> [dosja-e-faturave]
   ===================================================================== */
const fs = require('fs');
const path = require('path');

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_KEY;
const srcPath = process.argv[2];
const filesDir = process.argv[3];

if (!URL_ || !KEY || !srcPath) {
  console.error('Përdorim: SUPABASE_URL=… SUPABASE_KEY=… node migrate.js <burimi.json|.db> [dosja-e-faturave]');
  process.exit(1);
}

const H = { 'apikey': KEY, 'authorization': 'Bearer ' + KEY, 'content-type': 'application/json' };

function readSource(p) {
  if (p.endsWith('.json')) {
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { products: d.products || [], suppliers: d.suppliers || [], purchases: d.purchases || [], meta: d.meta || {} };
  }
  const Database = require('better-sqlite3');
  const db = new Database(p, { readonly: true });
  const rows = t => db.prepare('select * from ' + t).all();
  const meta = (() => { try { return JSON.parse(db.prepare("select v from meta where k='meta'").get().v); } catch (e) { return {}; } })();
  return {
    products: rows('products'),
    suppliers: rows('suppliers'),
    purchases: rows('purchases').map(r => Object.assign({}, r, { attachments: JSON.parse(r.attachments || '[]') })),
    meta
  };
}

async function push(table, rows) {
  if (!rows.length) return 0;
  let n = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const r = await fetch(`${URL_}/rest/v1/${table}`, {
      method: 'POST',
      headers: Object.assign({}, H, { 'prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(chunk)
    });
    if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
    n += chunk.length;
  }
  return n;
}

async function pushFiles(dir) {
  if (!dir || !fs.existsSync(dir)) return 0;
  const bins = fs.readdirSync(dir).filter(f => f.endsWith('.bin'));
  let n = 0;
  for (const f of bins) {
    const id = f.replace(/\.bin$/, '');
    let meta = {};
    try { meta = JSON.parse(fs.readFileSync(path.join(dir, id + '.json'), 'utf8')); } catch (e) {}
    const body = fs.readFileSync(path.join(dir, f));
    const r = await fetch(`${URL_}/storage/v1/object/fatura/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'apikey': KEY, 'authorization': 'Bearer ' + KEY, 'content-type': meta.type || 'application/octet-stream', 'x-upsert': 'true' },
      body
    });
    if (r.ok) n++; else console.warn('  ⚠ fatura', id, r.status, (await r.text()).slice(0, 120));
  }
  return n;
}

(async () => {
  console.log('\n  MIGRIM NË SUPABASE\n  ' + '─'.repeat(50));
  const d = readSource(srcPath);
  console.log(`  Burimi: ${path.basename(srcPath)} → ${d.purchases.length} blerje · ${d.suppliers.length} furnitorë · ${d.products.length} artikuj`);

  // radha ka rëndësi: produktet dhe furnitorët përpara blerjeve (çelësat e huaj)
  console.log('  Artikujt:  ' + await push('products', d.products));
  console.log('  Furnitorët:' + await push('suppliers', d.suppliers));
  console.log('  Blerjet:   ' + await push('purchases', d.purchases));
  await push('meta', [{ id: 'app', value: Object.assign({ demo: false, lastBuyer: '', seeded: true }, d.meta) }]);

  const nf = await pushFiles(filesDir);
  if (filesDir) console.log('  Faturat:   ' + nf + ' skedarë');

  const chk = await fetch(`${URL_}/rest/v1/purchases?select=id`, { headers: Object.assign({}, H, { 'prefer': 'count=exact', 'range': '0-0' }) });
  console.log('  Kontroll në bazë: ' + (chk.headers.get('content-range') || '?').split('/')[1] + ' blerje');
  console.log('  ' + '─'.repeat(50) + '\n  Gati ✔\n');
})().catch(e => { console.error('\n  ❌ Migrimi dështoi:', e.message, '\n'); process.exit(1); });
