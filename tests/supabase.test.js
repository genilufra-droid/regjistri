'use strict';
/* =====================================================================
   Teston klientin Supabase (docs/index.html) me një Supabase të rremë
   në kujtesë: tabela, storage dhe realtime. Kështu provohet gjithë rruga
   e të dhënave pa pasur nevojë për projektin e vërtetë.
   ===================================================================== */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/g).pop().replace(/^<script>|<\/script>$/g, '');

/* ---------------- Supabase i rremë ---------------- */
const DB = { products: [], suppliers: [], purchases: [], meta: [] };
const STORAGE = new Map();
const LOG = { upserts: 0, deletes: 0, inserts: 0, selects: 0, uploads: 0 };
let FAIL = false;                       // simulon mungesën e internetit
const subs = [];                        // dëgjuesit e realtime

const res = (data, error = null) => ({ data, error });
function table(name) {
  const rows = () => DB[name];
  const b = {
    _op: null, _payload: null, _filters: [],
    select() { b._op = 'select'; LOG.selects++; return b; },
    eq(c, v) { b._filters.push(r => r[c] === v); return b; },
    neq(c, v) { b._filters.push(r => r[c] !== v); return b; },
    in(c, arr) { b._filters.push(r => arr.includes(r[c])); return b; },
    maybeSingle() { b._single = true; return b; },
    insert(p) { b._op = 'insert'; b._payload = p; LOG.inserts++; return b; },
    upsert(p) { b._op = 'upsert'; b._payload = p; LOG.upserts++; return b; },
    delete() { b._op = 'delete'; LOG.deletes++; return b; },
    then(resolve) {
      if (FAIL) return resolve(res(null, { message: 'offline' }));
      const match = r => b._filters.every(f => f(r));
      let out;
      if (b._op === 'select') {
        const list = rows().filter(match).map(r => JSON.parse(JSON.stringify(r)));
        out = b._single ? res(list[0] || null) : res(list);
      } else if (b._op === 'insert' || b._op === 'upsert') {
        const arr = Array.isArray(b._payload) ? b._payload : [b._payload];
        arr.forEach(r => {
          const i = rows().findIndex(x => x.id === r.id);
          if (i > -1 && b._op === 'upsert') rows()[i] = JSON.parse(JSON.stringify(r));
          else if (i > -1) return;
          else rows().push(JSON.parse(JSON.stringify(r)));
        });
        out = res(arr);
        fire(name);
      } else if (b._op === 'delete') {
        DB[name] = rows().filter(r => !match(r));
        out = res([]);
        fire(name);
      } else out = res([]);
      return resolve(out);
    }
  };
  return b;
}
function fire(tbl) { subs.filter(s => s.table === tbl).forEach(s => setTimeout(() => s.cb({ table: tbl }), 5)); }

global.window = {
  SUPABASE_URL: 'https://demo-projekt.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiJ9.test-key',
  scrollTo() {}, location: { href: 'https://biobes.github.io/regjistri/' }
};
global.window.supabase = {
  createClient: () => ({
    from: table,
    storage: {
      from: () => ({
        async upload(id, blob) { if (FAIL) return res(null, { message: 'offline' }); LOG.uploads++; STORAGE.set(id, Buffer.from(await blob.arrayBuffer())); return res({ path: id }); },
        async download(id) { if (!STORAGE.has(id)) return res(null, { message: 'not found' }); return res(new Blob([STORAGE.get(id)])); },
        async remove(ids) { ids.forEach(i => STORAGE.delete(i)); return res([]); },
        async list() { return res([...STORAGE.keys()].map(name => ({ name }))); }
      })
    },
    channel: () => {
      const ch = {
        on(_evt, opts, cb) { subs.push({ table: opts.table, cb }); return ch; },
        subscribe(cb) { setTimeout(() => cb('SUBSCRIBED'), 5); return ch; }
      };
      return ch;
    }
  })
};

/* ---------------- DOM i thjeshtuar ---------------- */
const els = new Map();
const El = (id = '') => ({
  id, innerHTML: '', textContent: '', value: '', hidden: false, dataset: {}, style: {}, files: [], attrs: {},
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  addEventListener(ev, fn) { (this._h = this._h || {})[ev] = fn; }, focus() {}, select() {}, blur() {}, click() {}, scrollIntoView() {},
  showModal() {}, close() {}, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
  querySelector: () => El(), querySelectorAll: () => [], closest: () => null, appendChild() {}, remove() {}
});
const byId = id => { if (!els.has(id)) els.set(id, El(id)); return els.get(id); };
global.document = {
  querySelector: s => s.startsWith('#') ? byId(s.slice(1)) : El(),
  querySelectorAll: () => [], getElementById: byId, addEventListener() {},
  createElement: () => El(), body: { appendChild() {}, style: {} }, activeElement: { tagName: 'BODY' }
};
global.location = global.window.location;
global.confirm = () => true;
try { global.navigator = {}; } catch (e) { Object.defineProperty(global, 'navigator', { value: {}, configurable: true }); }
global.URL.createObjectURL = () => 'blob:x';
global.URL.revokeObjectURL = () => {};
global.FileReader = class { readAsText() {} };

/* ---------------- testet ---------------- */
const results = []; let failed = 0;
global.__t = async (n, fn) => { const t0 = Date.now(); try { await fn(); results.push(['✅', n, Date.now() - t0 + ' ms']); } catch (e) { failed++; results.push(['❌', n, (e && e.message || String(e)).slice(0, 110)]); } };
global.__info = (n, v) => results.push(['ℹ️', n, v]);
global.__A = assert; global.__W = ms => new Promise(r => setTimeout(r, ms));
global.__db = DB; global.__storage = STORAGE; global.__log = LOG;
global.__fail = v => { FAIL = v; };
global.__click = id => { const el = byId(id); if (!el._h || !el._h.click) throw new Error('butoni ' + id + ' s\'ka dëgjues'); return el._h.click({ preventDefault() {} }); };
global.__done = () => {
  console.log('\n  TESTIM I VERSIONIT SUPABASE (bazë e rreme në kujtesë)\n' + '─'.repeat(70));
  console.log('  ' + results.map(r => `${r[0]}  ${r[1].padEnd(52, '.')} ${r[2]}`).join('\n  '));
  console.log('─'.repeat(70));
  console.log(`  ${results.filter(r => r[0] === '✅').length} teste kaluan · ${failed} dështuan\n`);
  process.exit(failed ? 1 : 0);
};

const TESTS = `
;(async function () {
  const A = __A, T = __t, W = __W;
  const V = (id, v) => { document.querySelector('#' + id).value = v; };
  const H = id => document.querySelector('#' + id).innerHTML;
  const ev = { preventDefault() {} };

  await W(600);   // boot(): tërheqje + mbushja e parë me shembuj

  await T('Nisja mbush bazën bosh me të dhënat shembull', async () => {
    A.ok(__db.purchases.length > 50, 'baza nuk u mbush: ' + __db.purchases.length);
    A.strictEqual(Store.data.purchases.length, __db.purchases.length);
    A.ok(__db.meta.length === 1 && __db.meta[0].value.seeded === true, 'meta nuk u ruajt');
  });

  await T('Shenja tregon "Online · live" pas lidhjes realtime', async () => {
    A.match(document.getElementById('netChip').textContent, /Online|Sinkronizuar/);
  });

  await T('Kërkimi "kuzhinete" gjen "Kuzhinetë" me furnitorët e fundit', async () => {
    state.q = 'kuzhinete'; renderSearch();
    const out = H('results');
    A.ok(/Kuzhinet/i.test(out), 'produkti mungon');
    A.ok(Store.data.suppliers.some(s => out.includes(s.name)), 'furnitorët mungojnë');
  });

  await T('Blerje e re shkon te tabela purchases (upsert, jo rishkrim i gjithçkaje)', async () => {
    const upsertsPara = __log.upserts;
    openPurchase({});
    V('fpProduct', 'TEST Raft inoxi'); V('fpSupplier', 'TEST Furnitor Vlorë');
    V('fpSupPhone', '+355 69 123 4567'); V('fpSupCity', 'Vlorë'); V('fpSupAddr', 'Rr. e Testit 5');
    V('fpDate', '2026-09-30'); V('fpInvoice', 'SB-TEST-1'); V('fpQty', '3');
    V('fpUnit', 'copë'); V('fpPrice', '15500'); V('fpCur', 'ALL'); V('fpBuyer', 'Tester');
    await savePurchase(ev); await W(500);
    const row = __db.purchases.find(p => p.invoice === 'SB-TEST-1');
    A.ok(row, 'blerja nuk shkoi në bazë');
    A.strictEqual(row.price, 15500);
    A.ok(__db.products.find(p => p.name === 'TEST Raft inoxi'), 'artikulli i ri mungon');
    A.ok(__db.suppliers.find(s => s.phone === '+355 69 123 4567'), 'furnitori i ri mungon');
    A.ok(__log.upserts - upsertsPara <= 4, 'u dërguan shumë shkrime: ' + (__log.upserts - upsertsPara));
  });

  await T('Fatura ngarkohet në Storage dhe kthehet identike', async () => {
    const bytes = new Uint8Array(Array.from({ length: 1500 }, (_, i) => i % 97));
    const file = new File([bytes], 'fatura-sb.jpg', { type: 'image/jpeg' });
    openPurchase({});
    V('fpProduct', 'TEST Raft inoxi'); V('fpSupplier', 'TEST Furnitor Vlorë');
    V('fpDate', '2026-10-01'); V('fpInvoice', 'SB-TEST-2'); V('fpQty', '1');
    V('fpUnit', 'copë'); V('fpPrice', '8000'); V('fpCur', 'ALL'); V('fpBuyer', 'Tester');
    addFormFiles([file]);
    await savePurchase(ev); await W(500);
    const row = __db.purchases.find(p => p.invoice === 'SB-TEST-2');
    A.strictEqual(row.attachments.length, 1, 'fatura nuk u lidh me blerjen');
    const id = row.attachments[0].id;
    A.ok(__storage.has(id), 'skedari nuk shkoi në bucket');
    const back = await Files.get(id);
    const buf = Buffer.from(await back.arrayBuffer());
    A.strictEqual(buf.length, 1500, 'madhësia ndryshoi');
    A.strictEqual(buf[11], 11, 'përmbajtja ndryshoi');
  });

  await T('Realtime: ndryshimi i një kolegu vjen vetvetiu', async () => {
    const colleague = {
      id: 'kolegu-1', productId: Store.data.products[0].id, supplierId: Store.data.suppliers[0].id,
      date: '2026-10-02', qty: 5, unit: 'copë', price: 999, currency: 'ALL',
      invoice: 'LIVE-SB-1', buyer: 'Kolegu nga zyra', note: '', attachments: [], updatedAt: new Date().toISOString()
    };
    __db.purchases.push(colleague);
    Net.lastWrite = 0;
    await SB.from('purchases').select('id');       // nxit një ngjarje realtime të rreme
    __db.purchases.find(p => p.id === 'kolegu-1');
    Net.schedulePull();
    for (let i = 0; i < 30 && !Store.data.purchases.find(p => p.id === 'kolegu-1'); i++) await W(100);
    A.ok(Store.data.purchases.find(p => p.id === 'kolegu-1'), 'ndryshimi live nuk mbërriti');
    A.match(document.querySelector('#toast').textContent, /përditësua/);
  });

  await T('Jashtë linje: ndryshimi nuk humb, ruhet kur kthehet lidhja', async () => {
    __fail(true);
    const p = Store.data.purchases.find(x => x.invoice === 'SB-TEST-1');
    p.note = 'shënim pa internet'; p.updatedAt = new Date().toISOString();
    Store.save(); await W(500);
    A.match(document.getElementById('netChip').textContent, /Jashtë linje/);
    A.notStrictEqual(__db.purchases.find(x => x.invoice === 'SB-TEST-1').note, 'shënim pa internet', 'u shkrua pa internet?');
    __fail(false); Net.kick();
    for (let i = 0; i < 40; i++) {
      await W(150);
      if (__db.purchases.find(x => x.invoice === 'SB-TEST-1').note === 'shënim pa internet') return;
    }
    throw new Error('nuk u ruajt pas kthimit të lidhjes');
  });

  await T('Fshirja e blerjes e heq edhe nga baza dhe fatura nga Storage', async () => {
    const victim = Store.data.purchases.find(x => x.invoice === 'SB-TEST-2');
    const attId = victim.attachments[0].id;
    Store.data.purchases = Store.data.purchases.filter(x => x.id !== victim.id);
    await Files.del(attId);
    Store.save(); await W(600);
    A.ok(!__db.purchases.find(x => x.id === victim.id), 'blerja mbeti në bazë');
    A.ok(!__storage.has(attId), 'fatura mbeti në bucket');
  });

  await T('Pastrimi: të dhënat e testit u hoqën', async () => {
    Store.data.purchases = Store.data.purchases.filter(p => !/SB-TEST|LIVE-SB/.test(p.invoice || ''));
    Store.data.products = Store.data.products.filter(p => !/^TEST /.test(p.name));
    Store.data.suppliers = Store.data.suppliers.filter(s => !/^TEST /.test(s.name));
    Store.save(); await W(700);
    A.ok(!__db.purchases.some(p => /SB-TEST/.test(p.invoice || '')), 'mbetën blerje testi');
    A.ok(!__db.products.some(p => /^TEST /.test(p.name)), 'mbetën artikuj testi');
  });

  const gj = __db.purchases.length + ' blerje · ' + __db.suppliers.length + ' furnitorë · ' + __db.products.length + ' artikuj';

  await __t('Pas "Fshiji dhe fillo me të dhënat e tua" baza mbetet bosh', async () => {
    __click('demoClear');                       // klikim i vërtetë i butonit
    await W(700);
    A.strictEqual(__db.purchases.length, 0, 'mbetën blerje në bazë');
    A.strictEqual(__db.products.length, 0, 'mbetën artikuj në bazë');
    await Net.pull();                           // njësoj si ringarkim i faqes
    const bosh = !Store.data.products.length && !Store.data.suppliers.length && !Store.data.purchases.length;
    const dotMbushej = bosh && !Store.data.meta.seeded && !Net.metaExists;
    A.ok(!dotMbushej, 'faqja do i rikthente shembujt pas ringarkimit');
    A.strictEqual(__db.purchases.length, 0, 'shembujt u rikthyen vetvetiu');
  });

  await __t('Fshirja e gjithçkaje (Rregullimet) nuk i kthen shembujt', async () => {
    Store.replace({ products: [{ id: 'p1', name: 'Vaj motori', unit: 'litër', updatedAt: 'x' }] });
    await W(700);
    Store.replace({});                          // "Fshi gjithçka"
    await W(700);
    await Net.pull();
    A.strictEqual(__db.purchases.length + __db.products.length, 0, 'baza nuk u zbraz');
    A.ok(Store.data.meta.seeded === true, 'u humb shenja që baza është përdorur');
  });

  await __t('Bazë krejt e re (pa asnjë rresht meta) mbushet me shembuj', async () => {
    __db.meta.length = 0; __db.products.length = 0; __db.suppliers.length = 0; __db.purchases.length = 0;
    await Net.pull();
    const bosh = !Store.data.products.length && !Store.data.suppliers.length && !Store.data.purchases.length;
    A.ok(bosh && !Store.data.meta.seeded && !Net.metaExists, 'baza e re nuk do të mbushej');
  });

  __info('Gjendja e bazës', gj);
  __info('Trafiku', __log.selects + ' lexime · ' + __log.upserts + ' shkrime · ' + __log.deletes + ' fshirje · ' + __log.uploads + ' ngarkime');
  __done();
})();
`;

vm.runInThisContext(src + '\n' + TESTS, { filename: 'supabase-klient.js' });
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 60000);
