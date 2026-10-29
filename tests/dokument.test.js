'use strict';
/* =====================================================================
   PROVË E FATURËS ME RRESHTA (dokument, si Odoo)
   Ngarkon të njëjtin kod si faqja (docs/index.html) mbi një Supabase të
   rremë në kujtesë dhe provon modelin e ri:
     1. një faturë me 3 rreshta → 3 rreshta me të njëjtin documentId
     2. totali i faturës (#fpTotal) = shuma qty*price
     3. editimi ndryshon vetëm rreshtin e prekur, pa dublime
     4. fshirja e faturës heq të gjitha rreshtat + skedarin
     5. rresht i vjetër (pa documentId) shfaqet dhe editohet normalisht
     6. pa internet: fatura ruhet vendore dhe dërgohet e plotë kur kthehet
     7. skedari i faturës ngarkohet NJË herë për dokument
   Përdorim: node tests/dokument.test.js
   ===================================================================== */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/g).pop().replace(/^<script>|<\/script>$/g, '');

/* ---------------- Supabase i rremë ---------------- */
const DB = { products: [], suppliers: [], purchases: [], meta: [] };
const STORAGE = new Map();
const LOG = { upserts: 0, deletes: 0, inserts: 0, selects: 0, uploads: 0 };
let FAIL = false;
const subs = [];

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
global.__t = async (n, fn) => { const t0 = Date.now(); try { await fn(); results.push(['✅', n, Date.now() - t0 + ' ms']); } catch (e) { failed++; results.push(['❌', n, (e && e.message || String(e)).slice(0, 130)]); } };
global.__info = (n, v) => results.push(['ℹ️', n, v]);
global.__A = assert; global.__W = ms => new Promise(r => setTimeout(r, ms));
global.__db = DB; global.__storage = STORAGE; global.__log = LOG;
global.__fail = v => { FAIL = v; };
global.__done = () => {
  console.log('\n  PROVË E FATURËS ME RRESHTA (bazë e rreme në kujtesë)\n' + '─'.repeat(74));
  console.log('  ' + results.map(r => `${r[0]}  ${r[1].padEnd(58, '.')} ${r[2]}`).join('\n  '));
  console.log('─'.repeat(74));
  console.log(`  ${results.filter(r => r[0] === '✅').length} prova kaluan · ${failed} dështuan\n`);
  process.exit(failed ? 1 : 0);
};

const TESTS = `
;(async function () {
  const A = __A, T = __t, W = __W;
  const V = (id, v) => { document.querySelector('#' + id).value = v; };
  const el = id => document.querySelector('#' + id);
  const ev = { preventDefault() {} };
  const tell = () => el('fpErr').textContent;
  const byInvoice = inv => __db.purchases.filter(p => p.invoice === inv);

  await W(600);            // boot(): tërheqje + mbushja e parë me shembuj

  const art = n => 'Artikull prova ' + n;
  const sup = 'Furnitor Dokument ' + Date.now().toString(36);

  /* 1 — një dokument, N rreshta */
  await T('Fatura me 3 rreshta ruhet si 3 rreshta me të njëjtin documentId', async () => {
    openPurchase({});
    V('fpSupplier', sup); V('fpInvoice', 'DOC-3'); V('fpDate', '2026-10-05'); V('fpBuyer', 'Tester');
    setLine(0, 'product', art('A')); setLine(0, 'qty', '2'); setLine(0, 'unit', 'copë'); setLine(0, 'price', '100');
    addLine({ product: art('B'), qty: 3, unit: 'kg', price: 50 });
    addLine({ product: art('C'), qty: 1, unit: 'set', price: 1000 });
    await savePurchase(ev); await W(500);
    A.strictEqual(tell(), '', 'formulari ktheu gabim: ' + tell());
    const rows = byInvoice('DOC-3');
    A.strictEqual(rows.length, 3, 'u ruajtën ' + rows.length + ' rreshta, jo 3');
    A.strictEqual(new Set(rows.map(r => r.documentId)).size, 1, 'documentId i ndryshëm mes rreshtave');
    A.strictEqual(rows.map(r => r.lineNo).sort((a, b) => a - b).join(','), '1,2,3', 'lineNo nuk është 1..3');
    A.ok(rows.every(r => r.currency === 'ALL'), 'monedha nuk është e njëjtë për të gjithë');
    A.ok(rows.every(r => r.buyer === 'Tester'), 'personi nuk u ruajt te të gjitha rreshtat');
    A.strictEqual(Store.linesOf(rows[0].documentId).length, 3, 'Store.linesOf nuk i gjen 3 rreshtat');
    A.strictEqual(Store.docTotals(rows[0].documentId).total, 1350, 'totali i dokumentit nuk përputhet');
  });

  /* 2 — totali i faturës në DOM */
  await T('Totali i faturës (#fpTotal) = shuma e qty*price e rreshtave', async () => {
    openPurchase({});
    setLine(0, 'product', art('D')); setLine(0, 'qty', '2'); setLine(0, 'price', '1450,25'.replace(',', '.'));
    addLine({ product: art('E'), qty: '3', price: '100' });
    const txt = el('fpTotal').textContent;
    A.match(txt, /3\\.?200,5/, 'totali në formë nuk përputhet: ' + txt);
    setCur('EUR');
    A.match(el('fpTotal').textContent, /€/, 'monedha e dokumentit nuk kaloi te totali');
  });

  /* 3 — editimi prek vetëm rreshtin e ndryshuar */
  await T('Editimi i rreshtit 2 ndryshon vetëm atë rresht, pa dublime', async () => {
    const para = byInvoice('DOC-3').slice().sort((a, b) => a.lineNo - b.lineNo);
    const idet = para.map(r => r.id).join(',');
    openPurchase({ id: para[0].id });
    A.strictEqual(Store.linesOf(Store.docKey(para[0])).length, 3, 'dokumenti nuk u ringarkua me 3 rreshta');
    A.strictEqual(el('fpInvoice').value, 'DOC-3', 'numri i faturës nuk u ringarkua');
    setLine(1, 'qty', '7');
    await savePurchase(ev); await W(500);
    const pas = byInvoice('DOC-3').slice().sort((a, b) => a.lineNo - b.lineNo);
    A.strictEqual(pas.length, 3, 'rreshtat u dubluan: ' + pas.length);
    A.strictEqual(pas.map(r => r.id).join(','), idet, 'ID-të e rreshtave ndryshuan');
    A.strictEqual(pas[1].qty, 7, 'sasia e rreshtit 2 nuk u ruajt');
    A.strictEqual(pas[0].qty, para[0].qty, 'rreshti 1 ndryshoi pa dashur');
    A.strictEqual(pas[2].price, para[2].price, 'rreshti 3 ndryshoi pa dashur');
    A.strictEqual(Store.linesOf(pas[0].documentId).length, 3, 'Store.docOf sheh numër tjetër rreshtash');
  });

  /* 4 — fshirja e dokumentit */
  await T('Fshirja e faturës heq të gjitha rreshtat + skedarin e faturës', async () => {
    openPurchase({});
    V('fpSupplier', sup); V('fpInvoice', 'DOC-DEL'); V('fpDate', '2026-10-06'); V('fpBuyer', 'Tester');
    setLine(0, 'product', art('F')); setLine(0, 'qty', '1'); setLine(0, 'price', '10');
    addLine({ product: art('G'), qty: '2', price: '20' });
    addFormFiles([new File([new Uint8Array(300)], 'fatura-del.pdf', { type: 'application/pdf' })]);
    await savePurchase(ev); await W(500);
    const rows = byInvoice('DOC-DEL');
    A.strictEqual(rows.length, 2, 'nuk u ruajtën 2 rreshta');
    const attId = rows[0].attachments[0].id;
    A.ok(__storage.has(attId), 'skedari nuk shkoi në bucket');
    deleteDocument(Store.docKey(rows[0]));
    await W(500);
    A.strictEqual(byInvoice('DOC-DEL').length, 0, 'mbetën rreshta në bazë');
    A.ok(!__storage.has(attId), 'skedari i faturës mbeti në bucket');
    A.strictEqual(Store.data.purchases.filter(p => p.invoice === 'DOC-DEL').length, 0, 'mbetën rreshta vendorë');
  });

  /* 5 — rresht i vjetër, pa documentId */
  await T('Rresht i vjetër (pa documentId) shfaqet dhe editohet normalisht', async () => {
    const prod = __db.products[0], supRow = __db.suppliers[0];
    __db.purchases.push({
      id: 'vjeter-1', productId: prod.id, supplierId: supRow.id, date: '2026-01-02', qty: 5, unit: 'copë',
      price: 200, currency: 'ALL', invoice: 'VJETER-1', buyer: 'Dikush i Vjetër', note: '', attachments: [], updatedAt: '2026-01-02T00:00:00.000Z'
    });
    await Net.pull();
    const row = Store.data.purchases.find(p => p.id === 'vjeter-1');
    A.ok(row, 'rreshti i vjetër nuk u tërhoq');
    A.ok(!row.documentId, 'rreshti i vjetër mori documentId pa migrim');
    A.strictEqual(Store.linesOf(Store.docKey(row)).length, 1, 'dokumenti i rreshtit të vjetër nuk njihet');
    openPurchase({ id: 'vjeter-1' });
    A.strictEqual(el('fpInvoice').value, 'VJETER-1', 'numri i faturës nuk u ringarkua');
    A.strictEqual(el('fpProduct').value, prod.name, 'artikulli nuk u ringarkua');
    A.strictEqual(el('fpQty').value, '5', 'sasia nuk u ringarkua');
    setLine(0, 'price', '250');
    await savePurchase(ev); await W(500);
    const pas = __db.purchases.filter(p => p.invoice === 'VJETER-1');
    A.strictEqual(pas.length, 1, 'rreshti i vjetër u dublua');
    A.strictEqual(pas[0].id, 'vjeter-1', 'ID-ja e vjetër u humb');
    A.strictEqual(Number(pas[0].price), 250, 'ndryshimi nuk u ruajt');
    A.strictEqual(Store.docKey(pas[0]), 'vjeter-1', 'dokumenti i rreshtit të vjetër ndryshoi');
  });

  /* 6 — pa internet */
  await T('Offline: fatura me 2 rreshta ruhet vendore dhe dërgohet e plotë më pas', async () => {
    __fail(true);
    openPurchase({});
    V('fpSupplier', sup); V('fpInvoice', 'DOC-OFF'); V('fpDate', '2026-10-07'); V('fpBuyer', 'Tester');
    setLine(0, 'product', art('H')); setLine(0, 'qty', '4'); setLine(0, 'price', '75');
    addLine({ product: art('I'), qty: '1', price: '900' });
    await savePurchase(ev); await W(500);
    const lokal = Store.data.purchases.filter(p => p.invoice === 'DOC-OFF');
    A.strictEqual(lokal.length, 2, 'fatura offline nuk ka 2 rreshta vendorë');
    A.strictEqual(new Set(lokal.map(r => r.documentId)).size, 1, 'documentId ndryshon pa internet');
    A.strictEqual(byInvoice('DOC-OFF').length, 0, 'shkoi te serveri pa lidhje?!');
    __fail(false); Net.kick();
    for (let i = 0; i < 50; i++) {
      await W(150);
      const tani = byInvoice('DOC-OFF');
      if (tani.length === 2) {
        A.strictEqual(new Set(tani.map(r => r.documentId)).size, 1, 'documentId ndryshon në bazë');
        A.strictEqual(tani.map(r => r.lineNo).sort((a, b) => a - b).join(','), '1,2', 'lineNo nuk u dërgua');
        return;
      }
      if (tani.length > 2) throw new Error('u dërguan rreshta të dubluar: ' + tani.length);
    }
    throw new Error('rreshtat e pritur nuk u dërguan pas kthimit të lidhjes');
  });

  /* 7 — skedari ngarkohet një herë */
  await T('Skedari i faturës ngarkohet një herë për dokument (jo për rresht)', async () => {
    const para = __log.uploads;
    openPurchase({});
    V('fpSupplier', sup); V('fpInvoice', 'DOC-UPL'); V('fpDate', '2026-10-08'); V('fpBuyer', 'Tester');
    setLine(0, 'product', art('J')); setLine(0, 'qty', '1'); setLine(0, 'price', '300');
    addLine({ product: art('K'), qty: '2', price: '400' });
    addLine({ product: art('L'), qty: '3', price: '500' });
    addFormFiles([new File([new Uint8Array(1200)], 'fatura-upl.jpg', { type: 'image/jpeg' })]);
    await savePurchase(ev); await W(500);
    A.strictEqual(__log.uploads - para, 1, 'u ngarkua ' + (__log.uploads - para) + ' herë, jo 1');
    const rows = byInvoice('DOC-UPL');
    A.strictEqual(rows.length, 3, 'nuk u ruajtën 3 rreshta');
    const ids = new Set(rows.map(r => (r.attachments[0] || {}).id));
    A.strictEqual(ids.size, 1, 'rreshtat kanë skedarë të ndryshëm');
    A.ok(__storage.has([...ids][0]), 'skedari mungon në bucket');
    A.strictEqual(__storage.size, 1, 'në bucket ka skedarë shtesë: ' + __storage.size);
  });

  /* pastrimi */
  await T('Pastrimi: rreshtat e provës u hoqën', async () => {
    const hiq = __db.purchases.filter(p => /DOC-|VJETER-1/.test(p.invoice || ''));
    for (const r of hiq) (r.attachments || []).forEach(a => __storage.delete(a.id));
    __db.purchases = __db.purchases.filter(p => !/DOC-|VJETER-1/.test(p.invoice || ''));
    __db.products = __db.products.filter(p => !/^Artikull prova /.test(p.name));
    __db.suppliers = __db.suppliers.filter(s => !/^Furnitor Dokument /.test(s.name));
    Store.data.purchases = Store.data.purchases.filter(p => !/DOC-|VJETER-1/.test(p.invoice || ''));
    Store.data.products = Store.data.products.filter(p => !/^Artikull prova /.test(p.name));
    Store.data.suppliers = Store.data.suppliers.filter(s => !/^Furnitor Dokument /.test(s.name));
    Store.save(); await W(700);
    A.strictEqual(__db.purchases.filter(p => /DOC-|VJETER-1/.test(p.invoice || '')).length, 0, 'mbetën rreshta prove');
    A.strictEqual(__db.products.filter(p => /^Artikull prova /.test(p.name)).length, 0, 'mbetën artikuj prove');
    A.strictEqual(__db.suppliers.filter(s => /^Furnitor Dokument /.test(s.name)).length, 0, 'mbetën furnitorë prove');
  });

  __info('Trafiku', __log.selects + ' lexime · ' + __log.upserts + ' shkrime · ' + __log.deletes + ' fshirje · ' + __log.uploads + ' ngarkime');
  __done();
})();
`;

vm.runInThisContext(src + '\n' + TESTS, { filename: 'dokument-klient.js' });
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 60000);
