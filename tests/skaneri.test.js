'use strict';
/* =====================================================================
   PROVË E SKANUESIT TË FATURËS
   Teston “trurin” e skanerit pa kamerë e pa internet:
     • tekst fature (shqip) → furnitor, numër, datë, monedhë, rreshta;
     • numra europianë (1.234,56) dhe formatet e ndryshme të datës;
     • tekst i prishur nga OCR-i → nuk rrëzohet, nxjerr çfarë mundet;
     • plotësimi i formularit dhe ruajtja si faturë me rreshta.
   Kodi që provohet është i njëjti që rri në faqen publike (docs/index.html).
   ===================================================================== */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/g).pop().replace(/^<script>|<\/script>$/g, '');

/* ---------------- Supabase i rremë (vetëm aq sa duhet) ---------------- */
const DB = { products: [], suppliers: [], purchases: [], meta: [] };
const STORAGE = new Map();
let UPLOADS = 0;
const res = (data, error = null) => ({ data, error });
function table(name) {
  const b = { _op: null, _payload: null, _filters: [] };
  b.select = () => { b._op = 'select'; return b; };
  b.eq = (c, v) => { b._filters.push(r => r[c] === v); return b; };
  b.neq = () => b; b.in = () => b;
  b.maybeSingle = () => { b._single = true; return b; };
  b.insert = p => { b._op = 'insert'; b._payload = p; return b; };
  b.upsert = p => { b._op = 'upsert'; b._payload = p; return b; };
  b.delete = () => { b._op = 'delete'; return b; };
  b.then = (resolve) => {
    const rows = DB[name], match = r => b._filters.every(f => f(r));
    if (b._op === 'select') return resolve(res(b._single ? (rows.filter(match)[0] || null) : rows.filter(match)));
    if (b._op === 'insert' || b._op === 'upsert') {
      const arr = Array.isArray(b._payload) ? b._payload : [b._payload];
      arr.forEach(r => { const i = rows.findIndex(x => x.id === r.id); if (i > -1) rows[i] = r; else rows.push(r); });
      return resolve(res(arr));
    }
    DB[name] = rows.filter(r => !match(r));
    return resolve(res([]));
  };
  return b;
}

global.window = {
  SUPABASE_URL: 'https://demo.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_demo1234567890abcdef',
  scrollTo() {}, addEventListener() {}
};
global.window.supabase = {
  createClient: () => ({
    from: table,
    storage: {
      from: () => ({
        async upload(id, blob) { UPLOADS++; STORAGE.set(id, blob); return res({ path: id }); },
        async download() { return res(null, { message: 'x' }); },
        async remove() { return res([]); },
        async list() { return res([]); }
      })
    },
    channel: () => { const ch = { on() { return ch; }, subscribe(cb) { setTimeout(() => cb('SUBSCRIBED'), 5); return ch; } }; return ch; }
  })
};

/* ---------------- DOM minimal ---------------- */
const els = new Map();
const El = (id = '') => ({
  id, innerHTML: '', textContent: '', className: '', value: '', hidden: false, open: false, dataset: {}, style: {}, files: [], attrs: {},
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  addEventListener(ev, fn) { (this._h = this._h || {})[ev] = fn; },
  focus() {}, select() {}, blur() {}, click() {}, scrollIntoView() {}, appendChild() {}, remove() {},
  showModal() { this.open = true; }, close() { this.open = false; },
  insertAdjacentHTML() {}, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
  querySelector: () => El(), querySelectorAll: () => [], closest: () => null
});
const byId = id => { if (!els.has(id)) els.set(id, El(id)); return els.get(id); };
global.document = {
  querySelector: s => (s.startsWith('#') && !s.includes(' ') ? byId(s.slice(1)) : El()),
  querySelectorAll: () => [], getElementById: byId,
  addEventListener() {}, createElement: () => El(),
  head: { appendChild() {} }, body: { appendChild() {}, style: {} }, activeElement: { tagName: 'BODY' }
};
try { global.navigator = {}; } catch (e) { Object.defineProperty(global, 'navigator', { value: {}, configurable: true }); }
global.confirm = () => true;
global.URL.createObjectURL = () => 'blob:x';
global.URL.revokeObjectURL = () => {};
global.FileReader = class { readAsText() {} };

/* ---------------- ndihmës ---------------- */
const results = []; let failed = 0;
const W = ms => new Promise(r => setTimeout(r, ms));
global.__t = async (n, fn) => {
  const t0 = Date.now();
  try { await fn(); results.push(['✅', n, Date.now() - t0 + ' ms']); }
  catch (e) { failed++; results.push(['❌', n, (e && e.message || String(e)).slice(0, 140)]); }
};
global.__A = assert;
global.__W = W;
global.__File = File;
global.__Uint8Array = Uint8Array;
global.__db = DB;
global.__uploads = () => UPLOADS;
global.__done = () => {
  console.log('\n  PROVË E SKANUESIT TË FATURËS\n' + '─'.repeat(76));
  console.log('  ' + results.map(r => `${r[0]}  ${r[1].padEnd(58, '.')} ${r[2]}`).join('\n  '));
  console.log('─'.repeat(76));
  console.log(`  ${results.filter(r => r[0] === '✅').length} prova kaluan · ${failed} dështuan\n`);
  process.exit(failed ? 1 : 0);
};

/* Fatura “reale” shqiptare, siç del nga një PDF me tekst. */
const FATURA = `
AGRO TREJD SHPK
NIPT L12345678A · Rr. Industriale 12, Lushnjë
Tel: +355 69 123 4567

FATURË TATIMORE  Nr. F-2026-0412
Data: 27.10.2026    Klienti: BioBes shpk

Nr  Përshkrimi                      Sasia   Njësia   Çmimi      Totali
1   Kuzhinetë inox 60x60              4      copë     1.500,00    6.000,00
2   Vidë 4x40                         2      kg         900,00    1.800,00
3   Silikon sanitare                  6      copë       250,50    1.503,00

Nëntotali:        9.303,00
TVSH 20%:         1.860,60
TOTALI:          11.163,60
Pagesa: bankë · IBAN AL47 2121 1009 0000 0000 0000
`;

const TESTS = `
;(async function () {
  const A = __A, T = __t;

  await __W(400);      // boot() — bazë bosh

  await T('Teksti i faturës → numër, datë, monedhë, 3 artikuj', async () => {
    const p = parseInvoice(${JSON.stringify(FATURA)});
    A.strictEqual(p.invoice, 'F-2026-0412', 'numri i faturës: ' + p.invoice);
    A.strictEqual(p.date, '2026-10-27', 'data: ' + p.date);
    A.strictEqual(p.currency, '', 'monedha (pa shenjë në faturë): ' + p.currency);
    A.strictEqual(parseInvoice('Faturë 7 · Data 27.10.2026 · Vidë 2 copë 150 Lekë').currency, 'ALL');
    A.strictEqual(p.rows.length, 3, 'rreshtat: ' + JSON.stringify(p.rows));
    A.strictEqual(p.rows[0].product, 'Kuzhinetë inox 60x60');
    A.strictEqual(+p.rows[0].qty, 4);
    A.strictEqual(+p.rows[0].price, 1500);
    A.strictEqual(p.rows[0].unit, 'copë');
    A.strictEqual(+p.rows[1].price, 900);
    A.strictEqual(+p.rows[2].price, 250.5);
  });

  await T('Furnitori merret nga lista e njohur, jo nga rreshti i parë', async () => {
    Store.data.suppliers.push({ id: 's1', name: 'Agro Trejd', updatedAt: 'x' });
    const p = parseInvoice(${JSON.stringify(FATURA)}, ['Agro Trejd']);
    A.strictEqual(p.supplier, 'Agro Trejd');
    const q = parseInvoice('FATURË NR. 55\\nShitësi: Hidro Fan\\nData 03/02/2026\\n1 Tub PVC 3 m 2 copë 1.200');
    A.strictEqual(q.supplier, 'Hidro Fan', 'shitësi: ' + q.supplier);
  });

  await T('Numra europianë, datë me ISO dhe euro', async () => {
    const p = parseInvoice('Invoice AO-99\\n2026-09-15\\n1 Kuti vidash 10 copë 1.234,56 EUR\\n2 Ngjitës 1 kg 45\\nTotal 12.390,60');
    A.strictEqual(p.invoice, 'AO-99');
    A.strictEqual(p.date, '2026-09-15');
    A.strictEqual(p.currency, 'EUR');
    A.strictEqual(+p.rows[0].price, 1234.56, 'çmimi: ' + p.rows[0].price);
    A.strictEqual(+p.rows[0].qty, 10);
    A.strictEqual(+p.rows[1].price, 45);
    A.ok(p.rows.length >= 2);
  });

  await T('Tekst i prishur nga OCR-i nuk rrëzon skanerin', async () => {
    const messy = 'FATUR  N r  F 2026 88\\n2 7 . 1 0 . 2 0 2 6\\nKuzhinete inox  4  1500\\nVide 4x40 2 kg 900';
    const p = parseInvoice(messy);
    A.strictEqual(p.date, '2026-10-27', 'data: ' + p.date);
    A.ok(p.rows.length >= 1, 'pa rreshta');
    A.ok(p.rows.every(r => r.product && r.product.length > 1));
  });

  await T('Skaneri plotëson formularin: kokë + 3 rreshta + skedari', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'fatura.jpg', { type: 'image/jpeg' });
    const p = parseInvoice(${JSON.stringify(FATURA)}, ['Agro Trejd']);
    const n = applyScanned(Object.assign({}, p, { lines: p.rows, file }));
    A.strictEqual(n, 3, 'rreshtat e formës: ' + n);
    A.strictEqual(document.getElementById('fpSupplier').value, 'Agro Trejd');
    A.strictEqual(document.getElementById('fpInvoice').value, 'F-2026-0412');
    A.strictEqual(document.getElementById('fpDate').value, '2026-10-27');
    A.strictEqual(FORM.lines.length, 3);
    A.strictEqual(FORM.lines[1].product, 'Vidë 4x40');
    A.strictEqual(pendingFiles.length, 1, 'skedari nuk u lidh me faturën');
  });

  await T('Skaneri nuk i fshin të dhënat që ka shkruar njeriu', async () => {
    document.getElementById('fpSupplier').value = 'Furnitor i shkruar me dorë';
    applyScanned({ supplier: '', invoice: '', date: '', currency: '', lines: [] });
    A.strictEqual(document.getElementById('fpSupplier').value, 'Furnitor i shkruar me dorë');
  });

  await T('Ruajtja e faturës së skanuar → 3 rreshta, një dokument, një skedar', async () => {
    document.getElementById('fpSupplier').value = 'Agro Trejd';
    document.getElementById('fpBuyer').value = 'Arbeni';
    await savePurchase({ preventDefault() {} });
    await __W(700);
    const ours = __db.purchases.filter(p => p.invoice === 'F-2026-0412');
    A.strictEqual(ours.length, 3, 'në bazë: ' + ours.length);
    const ids = new Set(ours.map(p => p.documentId));
    A.strictEqual(ids.size, 1, 'documentId të ndryshme');
    A.deepStrictEqual(ours.map(p => p.lineNo).sort(), [1, 2, 3]);
    A.ok(ours.every(p => p.buyer === 'Arbeni' && p.currency === 'ALL'));
    A.strictEqual(__uploads(), 1, 'skedari u ngarkua ' + __uploads() + ' herë');
    A.strictEqual((ours[0].attachments || []).length, 1);
  });

  __done();
})();
`;

vm.runInThisContext(src + '\n' + TESTS, { filename: 'skaneri-klient.js' });
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 60000);
