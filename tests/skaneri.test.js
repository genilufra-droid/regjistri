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

/* localStorage i vogël në kujtesë (çelësi i leximit të fortë ruhet aty). */
const MEM = new Map();
const memStore = {
  getItem: k => (MEM.has(k) ? MEM.get(k) : null),
  setItem: (k, v) => { MEM.set(k, String(v)); },
  removeItem: k => { MEM.delete(k); }
};
global.__mem = memStore;         // TESTS ekzekutohet në kontekst global (vm)
global.window = {
  __skipBucketProbe: true,      // provat nuk shkojnë në rrjet
  localStorage: memStore,
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
global.__REAL = fs.readFileSync(path.join(__dirname, 'fixtures', 'fature-bills.txt'), 'utf8').replace(/^#.*$/gm, '');
global.__FIX = n => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8').replace(/^#.*$/gm, '');
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

  /* ---------------- fatura e vërtetë (bills.al / E-Fiskal) ---------------- */
  const REAL = __REAL;

  /* ---------------- leximi në server (Edge Function ocr) ---------------- */
  await T('Leximi në server: fotoja shkon te funksioni me çelësin e faqes', async () => {
    const realFetch = global.fetch;
    let called = null;
    global.fetch = async (url, opt) => {
      called = { url, opt };
      return { ok: true, status: 200, async text() {
        return JSON.stringify({ text: 'FURNITOR ABC\\nNr. Fature 77\\nTotali 25.00 EUR' });
      } };
    };
    let txt = '';
    try {
      window.OCR_SERVER = true;
      txt = await ocrReadServer(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }));
      A.ok(called.url.indexOf('/functions/v1/ocr') > 0, 'URL: ' + called.url);
      A.strictEqual(called.opt.method, 'POST');
      A.ok(/^sb_publishable_/.test(called.opt.headers.apikey), 'mungon apikey');
      A.strictEqual(called.opt.headers.Authorization, 'Bearer ' + called.opt.headers.apikey);
      const body = JSON.parse(called.opt.body);
      A.ok(body.image.length > 0, 'imazhi shkoi bosh');
      A.strictEqual(body.mime, 'image/jpeg');
      A.ok(/FURNITOR ABC/.test(txt), 'teksti: ' + txt);
    } finally { global.fetch = realFetch; window.OCR_SERVER = false; }
  });

  await T('Leximi në server: gabimet kthehen në shqip', async () => {
    const realFetch = global.fetch;
    const msgOf = async (status, body) => {
      global.fetch = async () => ({ ok: false, status, async text() { return body; } });
      try {
        await ocrReadServer(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
        return '';
      } catch (e) { return e.message; }
    };
    try {
      window.OCR_SERVER = true;
      A.ok(/nuk u gjet në server/.test(await msgOf(404, 'not found')), '404');
      A.ok(/GEMINI_API_KEY/.test(await msgOf(500, '{"error":"Mungon GEMINI_API_KEY …"}')), 'sekreti');
      A.ok(/Kuota/.test(await msgOf(429, 'quota')), 'kuota');
    } finally { global.fetch = realFetch; window.OCR_SERVER = false; }
  });

  await T('Rënia në radhë: server -> Vision -> pajisja', async () => {
    const realFetch = global.fetch, realT = global.window.Tesseract;
    let used = [];
    global.fetch = async (url) => {
      if (url.indexOf('/functions/v1/') > -1) { used.push('server'); return { ok: false, status: 404, async text() { return '{}'; } }; }
      used.push('vision');
      return { ok: true, status: 200, async text() { return JSON.stringify({ responses: [{ fullTextAnnotation: { text: 'VISION TEKST 12345' } }] }); } };
    };
    try {
      window.OCR_SERVER = true;
      setVisionKey('AIzaSySERVER1234567890abcdefghijklmnopqr'); setVisionOn(true);
      const txt = await scanReadImage(new Blob([new Uint8Array([7])], { type: 'image/jpeg' }));
      A.ok(used.indexOf('vision') > -1, 'nuk kalohet te Vision pas serverit: ' + used.join(','));
      A.strictEqual(SCAN.reader, 'vision');
      A.ok(/nuk u gjet në server/.test(SCAN.serverErr || ''), 'gabimi i serverit: ' + SCAN.serverErr);
      A.ok(/VISION TEKST/.test(txt), txt);
    } finally {
      global.fetch = realFetch;
      global.window.Tesseract = realT;
      setVisionKey(''); setVisionOn(false); window.OCR_SERVER = false;
    }
  });

  await T('Emri i funksionit zbulohet vetë: ocr -> ocr-invoice, dhe mbahet mend', async () => {
    const realFetch = global.fetch;
    const posts = [];
    global.fetch = async (url, opt) => {
      if (!opt || opt.method !== 'POST') return { ok: false, status: 404, async text() { return 'x'; } };
      posts.push(url);
      if (url.indexOf('ocr-invoice') > -1) {
        return { ok: true, status: 200, async text() { return JSON.stringify({ text: 'FURNITOR QR 9 12345' }); } };
      }
      return { ok: false, status: 404, async text() { return '{"message":"Requested function was not found"}'; } };
    };
    try {
      __mem.removeItem('regjistri.ocr.slug');
      window.OCR_SERVER = true;
      const txt = await ocrReadServer(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
      A.ok(txt.indexOf('FURNITOR QR') === 0, 'teksti: ' + txt);
      A.strictEqual(posts.length, 2, 'u provuan ' + posts.length + ' emra');
      A.ok(posts[0].indexOf('/ocr') > -1, 'i pari duhet ocr: ' + posts[0]);
      A.strictEqual(__mem.getItem('regjistri.ocr.slug'), 'ocr-invoice', 'emri nuk u mbajt mend');

      /* Herën tjetër shkon drejt te emri i mbajtur mend. */
      posts.length = 0;
      await ocrReadServer(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
      A.strictEqual(posts.length, 1, 'nuk u përdor emri i mbajtur mend');
    } finally {
      global.fetch = realFetch;
      window.OCR_SERVER = false;
      __mem.removeItem('regjistri.ocr.slug');
    }
  });

  await T('Gabimi i serverit shfaqet me tekstin e vet (shqip), jo vetëm kodin', async () => {
    const realFetch = global.fetch;
    global.fetch = async () => ({ ok: false, status: 500, async text() {
      return JSON.stringify({ error: 'Mungon GEMINI_API_KEY (Supabase → Edge Functions → Secrets).' });
    } });
    let msg = '';
    try {
      window.OCR_SERVER = true;
      await ocrReadServer(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
    } catch (e) { msg = e.message; } finally { global.fetch = realFetch; window.OCR_SERVER = false; }
    A.ok(msg.indexOf('Mungon GEMINI_API_KEY') === 0, 'mesazhi: ' + msg);
  });

  await T('Faturë e vërtetë fiskale: furnitori, numri, data, monedha', async () => {
    const p = parseInvoice(REAL, []);
    A.strictEqual(p.supplier, 'FURNITOR SHEMBULL', 'furnitori: ' + p.supplier);
    A.strictEqual(p.invoice, '2683/2026', 'numri: ' + p.invoice);
    A.strictEqual(p.date, '2026-11-06', 'data: ' + p.date + ' (jo afati i pagesës 16.11.2026)');
    A.strictEqual(p.currency, 'EUR');
    A.strictEqual(p.total, 12817.62, 'totali për t’u paguar: ' + p.total);
    A.strictEqual(p.netTotal, 10681.34, 'totali pa TVSH: ' + p.netTotal);
  });

  await T('Faturë e vërtetë: 4 rreshta me sasi, njësi e çmim të saktë', async () => {
    const p = parseInvoice(REAL, []);
    A.strictEqual(p.rows.length, 4, 'rreshtat: ' + JSON.stringify(p.rows));
    A.strictEqual(p.rows[0].product, 'PALETA PLASTIKE TE REJA TE ZEZA');
    A.strictEqual(+p.rows[0].qty, 403);
    A.strictEqual(+p.rows[0].price, 21.56);
    A.strictEqual(p.rows[0].unit, 'copë');
    A.strictEqual(+p.rows[1].qty, 4000);
    A.strictEqual(+p.rows[1].price, 0.375, 'çmimi 0.375 nuk duhet bërë 375');
    A.strictEqual(+p.rows[2].price, 141.67);
    A.strictEqual(p.rows[3].unit, 'kg');
    A.strictEqual(+p.rows[3].price, 4.1866);
  });

  await T('Kolonat e PDF-së rindërtohen sipas koordinatave (x,y)', async () => {
    /* copa teksti siç i jep pdf.js: y njësoj = i njëjti rresht; x = kolona */
    const items = [
      { str: 'Nr', width: 12, transform: [1, 0, 0, 1, 18, 555] },
      { str: 'PERSHKRIMI', width: 55, transform: [1, 0, 0, 1, 135, 555] },
      { str: 'SASIA', width: 30, transform: [1, 0, 0, 1, 286, 555] },
      { str: 'CMIMI', width: 30, transform: [1, 0, 0, 1, 341, 555] },
      { str: '1', width: 5, transform: [1, 0, 0, 1, 21, 533] },
      { str: 'PALETA PLASTIKE TE REJA', width: 66, transform: [1, 0, 0, 1, 113, 533] },
      { str: 'TE ZEZA', width: 42, transform: [1, 0, 0, 1, 150, 525] },
      { str: 'cope', width: 20, transform: [1, 0, 0, 1, 241, 533] },
      { str: '403', width: 14, transform: [1, 0, 0, 1, 294, 533] },
      { str: '141.666666', width: 40, transform: [1, 0, 0, 1, 332, 533] },
      { str: '667', width: 14, transform: [1, 0, 0, 1, 349, 525] }
    ];
    const lines = pdfLinesFromItems(items);
    A.ok(lines.some(l => /PALETA PLASTIKE TE REJA TE ZEZA/.test(l)), 'teksti i mbështjellë: ' + JSON.stringify(lines));
    A.ok(lines.some(l => /141\.666666667/.test(l)), 'numri i prerë: ' + JSON.stringify(lines));
    const p = parseInvoice(lines.join('\\n'), []);
    A.strictEqual(p.rows.length, 1, 'rreshta: ' + JSON.stringify(p.rows));
    A.strictEqual(+p.rows[0].qty, 403);
  });

  await T('Fatura e vërtetë plotëson formularin dhe ruhet me 4 rreshta', async () => {
    const p = parseInvoice(REAL, []);
    applyScanned(Object.assign({}, p, { lines: p.rows }));
    A.strictEqual(document.getElementById('fpSupplier').value, 'FURNITOR SHEMBULL');
    A.strictEqual(document.getElementById('fpInvoice').value, '2683/2026');
    A.strictEqual(document.getElementById('fpDate').value, '2026-11-06');
    A.strictEqual(document.getElementById('fpCur').value, 'EUR');
    A.strictEqual(FORM.lines.length, 4);
    const before = __db.purchases.length;
    document.getElementById('fpBuyer').value = 'Arbeni';
    await savePurchase({ preventDefault() {} });
    await __W(700);
    const ours = __db.purchases.filter(x => x.invoice === '2683/2026');
    A.strictEqual(ours.length, 4, 'në bazë: ' + ours.length);
    A.strictEqual(new Set(ours.map(x => x.documentId)).size, 1);
    A.strictEqual(__db.purchases.length, before + 4);
  });

  /* ---------------- skanime të vërteta (imazh → OCR) ---------------- */

  await T('Skanim ARK HOTEL: furnitori, numri, data, monedha, totali', async () => {
    const p = parseInvoice(__FIX('ark-hotel.txt'), []);
    A.strictEqual(p.supplier, 'ARK HOTEL', 'furnitori: ' + p.supplier);
    A.strictEqual(p.invoice, '110514', 'numri: ' + p.invoice);
    A.strictEqual(p.date, '2026-10-31', 'data: ' + p.date);
    A.strictEqual(p.currency, 'EUR');
    A.strictEqual(p.total, 80, 'totali: ' + p.total);
  });

  await T('Skanim ARK HOTEL: një rresht i vetëm, pa emrin e mbeturinave të QR-së', async () => {
    const p = parseInvoice(__FIX('ark-hotel.txt'), []);
    A.strictEqual(p.rows.length, 1, 'rreshtat: ' + JSON.stringify(p.rows));
    A.strictEqual(+p.rows[0].qty, 1);
    A.strictEqual(+p.rows[0].price, 80);
    A.ok(p.rowsGuessed, 'rreshti duhet shënuar si i hamendësuar');
    A.ok(!/^\s*\d{1,4}[:.)]/.test(p.rows[0].product || ''), 'kodi i QR-së mbeti në emër: ' + p.rows[0].product);
  });

  await T('Skanim GBA: furnitori, numri, data, totali 2000 EUR', async () => {
    const p = parseInvoice(__FIX('gba-2000.txt'), []);
    A.ok(p.supplier.indexOf('GBA ') === 0, 'furnitori: ' + p.supplier);
    A.ok(p.supplier.indexOf('Bioanalytik') > 0, 'emri i plotë i furnitorit: ' + p.supplier);
    A.strictEqual(p.invoice, '89612026', 'numri: ' + p.invoice);
    A.strictEqual(p.date, '2026-11-11', 'data: ' + p.date);
    A.strictEqual(p.currency, 'EUR');
    A.strictEqual(p.total, 2000, 'totali: ' + p.total);
    A.strictEqual(p.netTotal, 2000, 'pa TVSH: ' + p.netTotal);
  });

  await T('Skanim GBA: rreshti unik 1 × 2000 (totali nuk bëhet 181800 ALL)', async () => {
    const p = parseInvoice(__FIX('gba-2000.txt'), []);
    A.strictEqual(p.rows.length, 1, 'rreshtat: ' + JSON.stringify(p.rows));
    A.strictEqual(+p.rows[0].qty, 1);
    A.strictEqual(+p.rows[0].price, 2000);
    A.ok(/MOSTRAVE/i.test(p.rows[0].product || ''), 'emri: ' + p.rows[0].product);
  });

  await T('Faturë e vërtetë AFRIM DEDEJ (PDF me tekst): 144 / ALL / 83991.60', async () => {
    const p = parseInvoice(__FIX('afrim-dedej.txt'), []);
    A.strictEqual(p.supplier, 'Afrim Dedej', 'furnitori: ' + p.supplier);
    A.strictEqual(p.invoice, '144', 'numri: ' + p.invoice);
    A.strictEqual(p.date, '2026-11-04', 'data: ' + p.date);
    A.strictEqual(p.currency, 'ALL');
    A.strictEqual(p.total, 83991.6, 'totali: ' + p.total);
    A.strictEqual(p.rows.length, 1, 'rreshtat: ' + JSON.stringify(p.rows));
    A.strictEqual(+p.rows[0].qty, 2100);
    A.strictEqual(+p.rows[0].price, 33.33);
    A.ok(/KENDE/i.test(p.rows[0].product || ''), 'emri: ' + p.rows[0].product);
  });

  await T('Të tria skanimet plotësojnë formularin pa e prishur njëra-tjetrën', async () => {
    for (const f of ['ark-hotel.txt', 'gba-2000.txt', 'afrim-dedej.txt']) {
      const p = parseInvoice(__FIX(f), []);
      applyScanned(Object.assign({}, p, { lines: p.rows }));
      A.strictEqual(document.getElementById('fpSupplier').value, p.supplier, f + ': furnitori në formular');
      A.strictEqual(document.getElementById('fpInvoice').value, p.invoice, f + ': numri në formular');
      A.strictEqual(document.getElementById('fpCur').value, p.currency, f + ': monedha në formular');
      A.strictEqual(FORM.lines.length, p.rows.length, f + ': rreshtat në formular');
      A.ok(FORM.lines.every(l => +l.qty > 0 && +l.price > 0), f + ': sasi/çmim bosh');
    }
  });

  /* ---------------- leximi i fortë në internet (Google Vision) ---------------- */
  const KEY = 'AIzaSyTESTKEY1234567890abcdefghijklmnop';

  /* Fjalë siç i kthen Vision: tekst + koordinata (x, y). */
  const word = (txt, x, y, w) => ({
    symbols: String(txt).split('').map(ch => ({ text: ch })),
    boundingBox: { vertices: [{ x, y: y - 9 }, { x: x + (w || txt.length * 9), y: y - 9 },
      { x: x + (w || txt.length * 9), y: y + 9 }, { x, y: y + 9 }] }
  });
  /* Fatura e skanuar: çdo kolonë vjen si bllok më vete (siç bën Vision në tabela). */
  const blk = words => ({ paragraphs: [{ words }] });
  const VISION_ANN = {
    text: 'ARK HOTEL\\nNr. Fature 110514\\nData 31/10/2026\\nDhome Hotel 2 40 80\\nTOTALI 80 EUR',
    pages: [{
      blocks: [
        blk([word('ARK', 60, 60, 40), word('HOTEL', 105, 60, 60)]),
        blk([word('Nr.', 60, 100, 25), word('Fature', 90, 100, 55), word('110514', 150, 100, 55)]),
        blk([word('Data', 60, 140, 35), word('31/10/2026', 100, 140, 90)]),
        blk([word('Dhome', 60, 400, 50), word('Hotel', 115, 400, 45)]),
        blk([word('2', 380, 400, 10)]),
        blk([word('40', 430, 400, 20)]),
        blk([word('80', 520, 400, 20)]),
        blk([word('TOTALI', 60, 520, 60), word('80', 430, 520, 20), word('EUR', 470, 520, 35)])
      ]
    }]
  };

  await T('Leximi i fortë: çelësi ruhet vetëm në këtë pajisje', async () => {
    setVisionOn(true);
    A.strictEqual(visionKey(), '');
    A.strictEqual(visionOn(), false, 'pa çelës nuk aktivizohet');
    A.ok(setVisionKey(KEY));
    A.strictEqual(visionKey(), KEY);
    A.strictEqual(visionOn(), true);
    setVisionOn(false);
    A.strictEqual(visionOn(), false, 'kutiza e fikur respektohet');
    setVisionOn(true);
    setVisionKey('');
    A.strictEqual(visionKey(), '');
    A.strictEqual(visionOn(), false);
  });

  await T('Çelësi i faqes: punon pa konfigurim, pajisja mund ta ndryshojë ose ta fikë', async () => {
    const SAVED = 'regjistri.vision';
    const ON = 'regjistri.vision.on';
    __mem.removeItem(SAVED); __mem.removeItem(ON);
    const had = window.GOOGLE_VISION_KEY;
    window.GOOGLE_VISION_KEY = KEY;
    try {
      A.strictEqual(visionKeySource(), 'default');
      A.strictEqual(visionKey(), KEY, 'çelësi i faqes nuk u mor');
      A.strictEqual(visionOn(), true, 'me çelës të faqes leximi i fortë duhet aktiv');

      const MINE = 'AIzaSyPAJISJA1234567890abcdefghijklmnopq';
      setVisionKey(MINE);
      A.strictEqual(visionKeySource(), 'saved');
      A.strictEqual(visionKey(), MINE, 'çelësi i pajisjes nuk mbizotëroi');

      setVisionKey('');                       /* “Fshi çelësin” = fikje për këtë pajisje */
      A.strictEqual(visionKeySource(), 'off');
      A.strictEqual(visionKey(), '', 'fikja nuk u respektua');
      A.strictEqual(visionOn(), false);

      __mem.removeItem(SAVED); __mem.setItem(ON, '1');
      A.strictEqual(visionKey(), KEY, 'pas rivendosjes nuk u kthye çelësi i faqes');
    } finally {
      window.GOOGLE_VISION_KEY = had;
      __mem.removeItem(SAVED); __mem.removeItem(ON);
    }
  });

  await T('PDF i skanuar: faqet kthehen në foto (deri 3), jo vetëm e para', async () => {
    const pages = [];
    const doc = {
      numPages: 4,                       // 4 faqe, por lexohen më së shumti 3
      async getPage(i) {
        pages.push(i);
        return {
          getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }),
          render: () => ({ promise: Promise.resolve() })
        };
      }
    };
    const realCreate = document.createElement;
    let blobs = 0;
    document.createElement = (tag) => {
      if (String(tag).toLowerCase() !== 'canvas') return realCreate(tag);
      return {
        width: 0, height: 0, style: {},
        getContext: () => ({}),
        toBlob(cb) { blobs++; cb(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })); }
      };
    };
    try {
      const imgs = await scanPdfPagesForOcr(doc, 3);
      A.deepStrictEqual(pages, [1, 2, 3], 'faqet e lexuara: ' + JSON.stringify(pages));
      A.strictEqual(imgs.length, 3, 'fotot: ' + imgs.length);
      A.strictEqual(blobs, 3);
      const one = await scanPdfPagesForOcr({ numPages: 1, getPage: doc.getPage }, 3);
      A.strictEqual(one.length, 1, 'një faqe duhet të japë një foto');
    } finally { document.createElement = realCreate; }
  });

  await T('Leximi i fortë: kolonat e tabelës ribashkohen në një rresht', async () => {
    const lines = ocrLinesFromAnnotation(VISION_ANN);
    A.strictEqual(lines.length, 5, 'rreshtat: ' + JSON.stringify(lines));
    A.strictEqual(lines[3], 'Dhome Hotel 2 40 80');
  });

  await T('Leximi i fortë: teksti i Vision-it e plotëson faturën', async () => {
    const p = parseInvoice(visionText({ fullTextAnnotation: VISION_ANN }), []);
    A.strictEqual(p.supplier, 'ARK HOTEL');
    A.strictEqual(p.invoice, '110514');
    A.strictEqual(p.date, '2026-10-31');
    A.strictEqual(p.currency, 'EUR');
    A.strictEqual(p.total, 80);
    A.strictEqual(p.rows.length, 1, 'rreshtat: ' + JSON.stringify(p.rows));
    A.strictEqual(+p.rows[0].qty, 2);
    A.strictEqual(+p.rows[0].price, 40);
  });

  await T('Leximi i fortë: kërkesa shkon te Vision me çelësin e me shqip+anglisht', async () => {
    let called = null;
    const realFetch = global.fetch;
    global.fetch = async (url, opt) => {
      called = { url, opt };
      return { ok: true, status: 200, async text() { return JSON.stringify({ responses: [{ fullTextAnnotation: VISION_ANN }] }); } };
    };
    try {
      setVisionKey(KEY); setVisionOn(true);
      const txt = await visionRead(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));
      A.ok(/images:annotate\\?key=AIza/.test(called.url), 'URL: ' + called.url);
      A.strictEqual(called.opt.method, 'POST');
      const body = JSON.parse(called.opt.body);
      A.strictEqual(body.requests[0].features[0].type, 'DOCUMENT_TEXT_DETECTION');
      A.deepStrictEqual(body.requests[0].imageContext.languageHints, ['sq', 'en']);
      A.ok(body.requests[0].image.content.length > 0, 'fotoja shkoi bosh');
      A.ok(/Dhome Hotel 2 40 80/.test(txt), 'teksti: ' + txt);
    } finally { global.fetch = realFetch; setVisionKey(''); }
  });

  await T('Leximi i fortë: çelësi i gabuar → shpjegim shqip, jo “error 403”', async () => {
    const realFetch = global.fetch;
    global.fetch = async () => ({ ok: false, status: 403, async text() {
      return JSON.stringify({ error: { code: 403, message: 'API key not valid. Please pass a valid API key.' } }); } });
    let msg = '';
    try {
      setVisionKey(KEY); setVisionOn(true);
      await visionRead(new Blob([new Uint8Array([1])], { type: 'image/png' }));
    } catch (e) { msg = e.message; } finally { global.fetch = realFetch; setVisionKey(''); }
    A.ok(/nuk është i vlefshëm|e refuzoi çelësin/i.test(msg), msg);
    A.ok(/Credentials|Cloud Vision/i.test(msg), 'duhet të thotë ku rregullohet: ' + msg);
  });

  await T('Leximi i fortë dështon → skaneri vazhdon brenda pajisjes', async () => {
    const realFetch = global.fetch, realT = global.window.Tesseract;
    global.fetch = async () => ({ ok: false, status: 500, async text() { return 'boom'; } });
    global.window.Tesseract = { recognize: async () => ({ data: { text: 'FURNITOR XYZ\\nNr. Fature 7\\nTotali 10.00 EUR' } }) };
    let txt = '';
    try {
      setVisionKey(KEY); setVisionOn(true);
      txt = await scanReadImage(new Blob([new Uint8Array([9])], { type: 'image/png' }));
      A.strictEqual(SCAN.reader, 'device', 'burimi: ' + SCAN.reader);
      A.ok(/HTTP 500/.test(SCAN.strongErr || ''), 'gabimi: ' + SCAN.strongErr);
      A.ok(/FURNITOR XYZ/.test(txt), 'teksti i paisjes: ' + txt);
    } finally { global.fetch = realFetch; global.window.Tesseract = realT; setVisionKey(''); }
  });

  __done();
})();
`;

vm.runInThisContext(src + '\n' + TESTS, { filename: 'skaneri-klient.js' });
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 60000);
