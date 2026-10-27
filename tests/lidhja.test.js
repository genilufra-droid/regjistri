'use strict';
/* =====================================================================
   PROVË E LIDHJES — çfarë ndodh kur baza nuk përgjigjet
   Pretendon tri gjendje të Supabase: “down” (s’ka rrjet), “paused”
   (projekti i pezulluar) dhe “ok”. Kontrollon që faqja:
     • hapet me kopjen e fundit vendore kur baza s’arrihet,
     • e shpjegon shkakun dhe të drejtën e rregullimit (jo vetëm “nuk u arrit”),
     • nuk i humb blerjet e regjistruara pa lidhje — i dërgon kur kthehet,
     • ruan lidhjen e re (URL + çelës) në pajisje.
   Përdorim: node tests/lidhja.test.js
   ===================================================================== */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/g).pop().replace(/^<script>|<\/script>$/g, '');

/* ---------------- Supabase i rremë, me “çelës” gjendjeje ---------------- */
const DB = { products: [], suppliers: [], purchases: [], meta: [] };
let MODE = 'down';                     // down | paused | ok
let CLIENT_ARGS = null;
const LOG = { writes: 0, reads: 0 };

const res = (data, error = null) => ({ data, error });
const offline = () => new TypeError('Failed to fetch');

function table(name) {
  const b = { _op: null, _payload: null, _filters: [] };
  b.select = () => { b._op = 'select'; LOG.reads++; return b; };
  b.eq = (c, v) => { b._filters.push(r => r[c] === v); return b; };
  b.neq = () => b;
  b.in = () => b;
  b.maybeSingle = () => { b._single = true; return b; };
  b.insert = p => { b._op = 'insert'; b._payload = p; LOG.writes++; return b; };
  b.upsert = p => { b._op = 'upsert'; b._payload = p; LOG.writes++; return b; };
  b.delete = () => { b._op = 'delete'; LOG.writes++; return b; };
  b.then = (resolve, reject) => {
    if (MODE === 'down') return reject(offline());
    if (MODE === 'paused') return resolve(res(null, { message: 'Project is paused', code: '540' }));
    const rows = DB[name], match = r => b._filters.every(f => f(r));
    if (b._op === 'select') return resolve(res(b._single ? (rows.filter(match)[0] || null) : rows.filter(match)));
    if (b._op === 'insert' || b._op === 'upsert') {
      const arr = Array.isArray(b._payload) ? b._payload : [b._payload];
      arr.forEach(r => {
        const i = rows.findIndex(x => x.id === r.id);
        if (i > -1) { if (b._op === 'upsert') rows[i] = r; } else rows.push(r);
      });
      return resolve(res(arr));
    }
    DB[name] = rows.filter(r => !match(r));
    return resolve(res([]));
  };
  return b;
}

/* localStorage i rremë (kujtesa e pajisjes) */
const LS_DATA = new Map();
const fakeLS = {
  getItem: k => (LS_DATA.has(k) ? LS_DATA.get(k) : null),
  setItem: (k, v) => LS_DATA.set(k, String(v)),
  removeItem: k => LS_DATA.delete(k),
  clear: () => LS_DATA.clear()
};

global.window = {
  SUPABASE_URL: 'https://demo-projekt.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_demo_1234567890abcdef',
  localStorage: fakeLS, scrollTo() {},
  addEventListener() {}
};
global.localStorage = fakeLS;
global.window.supabase = {
  createClient: (...a) => {
    CLIENT_ARGS = a;
    return {
      from: table,
      storage: {
        from: () => ({
          async upload(id) { if (MODE !== 'ok') throw offline(); return res({ path: id }); },
          async download() { return res(null, { message: 'not found' }); },
          async remove() { return res([]); },
          async list() { return res([]); }
        })
      },
      channel: () => {
        const ch = { on() { return ch; }, subscribe(cb) { setTimeout(() => cb('SUBSCRIBED'), 5); return ch; } };
        return ch;
      }
    };
  }
};

/* ---------------- DOM i thjeshtuar ---------------- */
const els = new Map();
const El = (id = '') => ({
  id, innerHTML: '', textContent: '', className: '', value: '', hidden: false, dataset: {}, style: {}, files: [], attrs: {},
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  addEventListener(ev, fn) { (this._h = this._h || {})[ev] = fn; },
  focus() {}, select() {}, blur() {}, click() { if (this._h && this._h.click) this._h.click({ preventDefault() {} }); },
  scrollIntoView() {}, showModal() {}, close() {}, appendChild() {}, remove() {},
  setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
  querySelector: () => El(), querySelectorAll: () => [], closest: () => null
});
const byId = id => { if (!els.has(id)) els.set(id, El(id)); return els.get(id); };
const docHandlers = {};
global.document = {
  querySelector: s => (s.startsWith('#') ? byId(s.slice(1)) : El()),
  querySelectorAll: () => [], getElementById: byId,
  addEventListener(ev, fn) { docHandlers[ev] = fn; },
  createElement: () => El(), head: { appendChild() {} }, body: { appendChild() {}, style: {} },
  activeElement: { tagName: 'BODY' }
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
  catch (e) { failed++; results.push(['❌', n, (e && e.message || String(e)).slice(0, 120)]); }
};
global.__info = (n, v) => results.push(['ℹ️', n, v]);
global.__A = assert; global.__W = W; global.__db = DB;
global.__mode = m => { MODE = m; };
global.__ls = LS_DATA;
global.__clientArgs = () => CLIENT_ARGS;
global.__clickAct = act => {                    // shtyp një buton me data-act
  const target = { dataset: { act }, closest() { return this; } };
  docHandlers.click({ target, preventDefault() {} });
};
global.__submitConn = (url, key) => {
  byId('connUrlIn').value = url; byId('connKeyIn').value = key;
  byId('connForm')._h.submit({ preventDefault() {} });
};
global.__done = () => {
  console.log('\n  PROVË E LIDHJES — kur baza nuk përgjigjet\n' + '─'.repeat(74));
  console.log('  ' + results.map(r => `${r[0]}  ${r[1].padEnd(56, '.')} ${r[2]}`).join('\n  '));
  console.log('─'.repeat(74));
  console.log(`  ${results.filter(r => r[0] === '✅').length} prova kaluan · ${failed} dështuan\n`);
  process.exit(failed ? 1 : 0);
};

/* ---------------- “pajisja” nis me një kopje të vjetër vendore ---------------- */
LS_DATA.set('regjistri.kopja', JSON.stringify({
  at: '2026-10-20T08:00:00.000Z',
  data: {
    products: [{ id: 'pr1', name: 'Kuzhinetë', unit: 'copë', updatedAt: 'x' }],
    suppliers: [{ id: 'su1', name: 'Furnitori i Vjetër', city: 'Lushnjë', updatedAt: 'x' }],
    purchases: [{
      id: 'pu1', productId: 'pr1', supplierId: 'su1', date: '2026-10-19', qty: 2, unit: 'copë',
      price: 1500, currency: 'ALL', invoice: 'F-OLD', buyer: 'Arbeni', attachments: [], updatedAt: 'x'
    }],
    meta: { demo: false, lastBuyer: 'Arbeni', seeded: true }
  }
}));

const TESTS = `
;(async function () {
  const A = __A, T = __t, W = __W;

  await W(700);   // boot(): baza “down”, duhet të bjerë te kopja vendore

  await T('Baza jashtë: faqja hapet me kopjen e fundit, jo bosh', async () => {
    A.strictEqual(Store.data.purchases.length, 1, 'u humb kopja vendore');
    A.ok(document.querySelector('#results').innerHTML.includes('Furnitori i Vjetër'), 'kërkimi nuk shfaq të dhënat vendore');
  });

  await T('Shenja dhe shiriti e shpjegojnë shkakun, jo vetëm “nuk u arrit”', async () => {
    A.strictEqual(document.querySelector('#netChip').textContent, 'Baza nuk u arrit');
    const b = document.querySelector('#netBanner');
    A.strictEqual(b.hidden, false, 'shiriti i lidhjes nuk u shfaq');
    A.ok(document.querySelector('#netBannerText').innerHTML.includes('nuk arrihet'), 'shiriti nuk e shpjegon shkakun');
    const d = document.querySelector('#connDiag');
    A.strictEqual(d.hidden, false, 'detajet nuk u shfaqën');
    A.ok(d.innerHTML.includes('Failed to fetch'), 'mungon detaji teknik');
    A.ok(d.innerHTML.includes('Ndrysho lidhjen'), 'nuk ofron zgjidhje');
  });

  await T('Blerja e regjistruar pa lidhje ruhet në pajisje dhe nuk shkon te serveri', async () => {
    Store.data.purchases.push({
      id: 'pu-offline', productId: 'pr1', supplierId: 'su1', date: '2026-10-27', qty: 3, unit: 'copë',
      price: 800, currency: 'ALL', invoice: 'F-OFF', buyer: 'Arbeni', attachments: [], updatedAt: 'y'
    });
    Store.save();
    await W(600);
    A.strictEqual(__db.purchases.length, 0, 'shkoi te serveri pa lidhje?!');
    const c = JSON.parse(__ls.get('regjistri.kopja'));
    A.ok(c.data.purchases.some(p => p.id === 'pu-offline'), 'nuk u ruajt kopja vendore');
  });

  await T('Kur kthehet lidhja, “Provo lidhjen” e dërgon blerjen e pritur', async () => {
    __mode('ok');
    __clickAct('conn-test');
    await W(800);
    A.ok(__db.purchases.some(p => p.id === 'pu-offline'), 'blerja e pritur nuk shkoi në bazë');
    A.strictEqual(document.querySelector('#netBanner').hidden, true, 'shiriti mbeti i hapur');
    A.strictEqual(document.querySelector('#netChip').textContent, 'Online · live');
  });

  await T('Projekti i pezulluar: faqja e thotë qartë “i pezulluar”, me hapat', async () => {
    __mode('paused');
    __clickAct('conn-test');
    await W(600);
    const d = document.querySelector('#connDiag');
    A.strictEqual(document.querySelector('#netChip').textContent, 'Baza nuk u arrit');
    A.ok(d.innerHTML.includes('pezulluar'), 'nuk u dallua pezullimi: ' + d.innerHTML.slice(0, 80));
    A.ok(d.innerHTML.includes('Restore project'), 'mungojnë hapat e rregullimit');
  });

  await T('“Ndrysho lidhjen” ruan URL-në e re vetëm në këtë pajisje', async () => {
    __mode('ok');
    __submitConn('https://projekt-iri.supabase.co', 'sb_publishable_ABCDEFGHIJKLMNOP1234567890');
    await W(500);
    const saved = JSON.parse(__ls.get('regjistri.lidhja'));
    A.strictEqual(saved.url, 'https://projekt-iri.supabase.co');
    A.ok(__clientArgs()[0] === 'https://projekt-iri.supabase.co', 'klienti nuk u krijua me URL-në e re');
    A.strictEqual(document.querySelector('#netChip').textContent, 'Online · live');
  });

  await T('URL e pavlefshme refuzohet me mesazh, pa prishur lidhjen', async () => {
    __submitConn('jo-nje-url', 'sb_publishable_ABCDEFGHIJKLMNOP1234567890');
    await W(100);
    A.ok(document.querySelector('#connErr').textContent.includes('https://'), 'nuk u refuzua URL-ja');
  });

  __info('Shkrime drejt serverit gjatë provës', __db.purchases.length + ' blerje në bazë');
  __done();
})();
`;

vm.runInThisContext(src + '\n' + TESTS, { filename: 'lidhja-klient.js' });
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 60000);
