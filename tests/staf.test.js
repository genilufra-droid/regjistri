'use strict';
/* =====================================================================
   PROVË ME DY PUNONJËS TË VËRTETË
   Ngarkon të njëjtin kod që ndodhet në faqen publike (docs/index.html)
   dy herë — si dy pajisje të ndryshme — dhe i lidh me bazën e vërtetë.
   Përgjigjet: a ruhet në server · a sinkronizohet live · a punon reset-i
   · a punon kopja rezervë · si ruhen të dhënat kur regjistrohen.
   ===================================================================== */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const { createClient } = require('@supabase/supabase-js');
const WS = require('ws');

const SUPA_URL = process.env.SUPABASE_URL, SUPA_KEY = process.env.SUPABASE_KEY;
if (!SUPA_URL || !SUPA_KEY) { console.error('Mungojnë SUPABASE_URL / SUPABASE_KEY'); process.exit(1); }

const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/g).pop().replace(/^<script>|<\/script>$/g, '');

const W = ms => new Promise(r => setTimeout(r, ms));
const admin = createClient(SUPA_URL, SUPA_KEY, { realtime: { transport: WS } });   // "dëshmitar" i pavarur

/* ---------- një "pajisje" = një kopje e plotë e faqes ---------- */
function pajisje(emri) {
  const els = new Map(); const docH = {};
  const El = (id = '') => ({
    id, innerHTML: '', textContent: '', value: '', hidden: false, open: false, dataset: {}, style: {}, files: [], attrs: {}, _h: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener(ev, fn) { this._h[ev] = fn; },
    focus() {}, select() {}, blur() {}, scrollIntoView() {}, appendChild() {}, remove() {},
    click() { if (this._h.click) this._h.click({ preventDefault() {} }); },
    showModal() { this.open = true; }, close() { this.open = false; if (this._h.close) this._h.close({}); },
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
    querySelector: () => El(), querySelectorAll: () => [], closest: () => null
  });
  const byId = id => { if (!els.has(id)) els.set(id, El(id)); return els.get(id); };

  class FR {
    readAsText(b) { Promise.resolve(b.text ? b.text() : String(b)).then(t => { this.result = t; this.onload && this.onload(); }); }
  }
  const U = class extends URL {}; U.createObjectURL = () => 'blob:x'; U.revokeObjectURL = () => {};

  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
    crypto, Blob, File, fetch, URL: U, FileReader: FR, TextEncoder, TextDecoder,
    navigator: {}, alert() {}, confirm: () => true, scrollTo() {},
    document: {
      querySelector: s => s.startsWith('#') ? byId(s.slice(1)) : El(),
      querySelectorAll: () => [], getElementById: byId,
      addEventListener(ev, fn) { docH[ev] = fn; },
      createElement: () => El(), body: { appendChild() {}, style: {} }, activeElement: { tagName: 'BODY' }
    },
    __emri: emri,
    __klikButon: act => { const t = { dataset: { act }, closest() { return this; } }; return docH.click && docH.click({ target: t, preventDefault() {} }); }
  };
  ctx.window = ctx; ctx.global = ctx;
  ctx.window.scrollTo = () => {};
  ctx.window.SUPABASE_URL = SUPA_URL;
  ctx.window.SUPABASE_ANON_KEY = SUPA_KEY;
  ctx.window.supabase = {
    createClient: (u, k, o) => createClient(u, k, Object.assign({}, o, { realtime: Object.assign({}, o && o.realtime, { transport: WS }) }))
  };

  const DRIVER = `
  globalThis.__ = {
    shenja: () => document.getElementById('netChip').textContent,
    numrat: () => [Store.data.purchases.length, Store.data.suppliers.length, Store.data.products.length],
    meta: () => JSON.parse(JSON.stringify(Store.data.meta)),
    gjejFature: inv => Store.data.purchases.find(p => (p.invoice || '') === inv) || null,
    rezultatet: () => document.getElementById('results').innerHTML.replace(/<[^>]+>/g, ' '),
    kerko: q => { state.q = q; renderSearch(); return document.getElementById('results').innerHTML.replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' '); },
    async regjistro(f) {
      const V = (id, v) => { document.getElementById(id).value = v; };
      V('fpProduct', f.produkt); V('fpSupplier', f.furnitor); V('fpBuyer', f.bleu);
      V('fpQty', f.sasi); V('fpPrice', f.cmim); V('fpDate', f.data); V('fpUnit', f.njesi || 'copë');
      V('fpCur', 'ALL'); V('fpInvoice', f.fature || ''); V('fpNote', f.shenim || '');
      V('fpSupPhone', f.tel || ''); V('fpSupCity', f.qytet || ''); V('fpSupAddr', f.adresa || ''); V('fpSupLoc', f.lokacioni || '');
      editingPurchase = null; origAtts = []; keptAtts = []; pendingFiles.length = 0;
      if (f.skedar) pendingFiles.push(f.skedar);
      await savePurchase({ preventDefault() {} });
      return document.getElementById('fpErr').textContent;
    },
    async shkarkoFature(id) { const b = await Files.get(id); return b ? new Uint8Array(await b.arrayBuffer()) : null; },
    eksporto() {
      let kap = null; const orig = download;
      download = (name, text) => { kap = { name, text }; };
      __klikButon('export-json'); download = orig; return kap;
    },
    importo(tekst) { importJSON(new Blob([tekst], { type: 'application/json' })); },
    fshiGjithcka() { return __klikButon('clear-all'); },
    fshiShembujt() { const b = document.getElementById('demoClear'); return b._h.click({ preventDefault() {} }); }
  };`;
  vm.createContext(ctx);
  vm.runInContext(src + '\n' + DRIVER, ctx, { filename: emri + '.js' });
  return ctx;
}

const prit = async (fn, ms = 15000, hap = 100) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return Date.now() - t0; await W(hap); }
  return -1;
};

/* ---------- raporti ---------- */
const rows = []; let failed = 0;
const T = async (n, fn) => { const t = Date.now(); try { const extra = await fn(); rows.push(['✅', n, extra || (Date.now() - t) + ' ms']); } catch (e) { failed++; rows.push(['❌', n, (e.message || String(e)).slice(0, 120)]); } };
const INFO = (n, v) => rows.push(['ℹ️', n, v]);

(async () => {
  console.log('\n  PROVË ME DY PUNONJËS — ' + SUPA_URL + '\n' + '═'.repeat(78));

  /* 0 — kopje rezervë e gjendjes para testit */
  const burim = {};
  for (const t of ['products', 'suppliers', 'purchases']) {
    const { data } = await admin.from(t).select('*');
    burim[t] = data.map(r => { const o = Object.assign({}, r); delete o.created_at; return o; });
  }
  const { data: m0 } = await admin.from('meta').select('value').eq('id', 'app').maybeSingle();
  burim.meta = (m0 && m0.value) || { demo: false, lastBuyer: '', seeded: true };
  fs.mkdirSync(path.join(__dirname, '..', 'kopje'), { recursive: true });
  const ruajtje = path.join(__dirname, '..', 'kopje', 'para-testit.json');
  fs.writeFileSync(ruajtje, JSON.stringify(burim, null, 2));
  INFO('Kopje rezervë para testit', burim.purchases.length + ' blerje → kopje/para-testit.json');

  const A = pajisje('Stafi-A'), B = pajisje('Stafi-B');
  const FATURA = 'PROVA-STAF-' + Date.now().toString(36).toUpperCase();

  await T('Të dy punonjësit hapin linkun dhe lidhen me bazën', async () => {
    const a = await prit(() => A.__.shenja() === 'Online · live');
    const b = await prit(() => B.__.shenja() === 'Online · live');
    assert.ok(a >= 0 && b >= 0, 'nuk u lidh: A=' + A.__.shenja() + ' B=' + B.__.shenja());
    return 'A ' + a + ' ms · B ' + b + ' ms';
  });

  await T('Të dy shohin të njëjtat të dhëna (vijnë nga serveri, jo nga shfletuesi)', async () => {
    assert.strictEqual(JSON.stringify(A.__.numrat()), JSON.stringify(B.__.numrat()), 'pajisjet shohin numra të ndryshëm');
    assert.strictEqual(A.__.numrat()[0], burim.purchases.length, 'nuk përputhet me bazën');
    return A.__.numrat()[0] + ' blerje te të dyja pajisjet';
  });

  /* 1 — regjistrim i vërtetë nga formulari i Stafit A, me faturë bashkëngjitur */
  const bajt = Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 7) % 251));
  const skedar = new File([bajt], 'fatura-provë.jpg', { type: 'image/jpeg' });
  let t_shkrim = 0, oraB = null;
  await T('Stafi A regjistron një blerje nga formulari (me faturë)', async () => {
    const t0 = Date.now();
    const err = await A.__.regjistro({
      produkt: 'Kuzhinetë provë', furnitor: 'Furnitor Provë ' + FATURA.slice(-4), bleu: 'Agimi (prova)',
      sasi: '3', cmim: '2500', data: '2026-10-03', njesi: 'copë', fature: FATURA, skedar,
      tel: '0691234567', qytet: 'Tiranë', adresa: 'Rr. e Durrësit 120', lokacioni: '41.33,19.80', shenim: 'regjistrim prove'
    });
    assert.strictEqual(err, '', 'formulari ktheu gabim: ' + err);
    t_shkrim = Date.now() - t0;
    oraB = prit(() => !!B.__.gjejFature(FATURA), 20000, 50);   // nis matjen menjëherë
    assert.ok(A.__.gjejFature(FATURA), 'blerja nuk hyri as te vetë pajisja A');
  });

  await T('Blerja ruhet në server (verifikuar nga një lidhje e tretë, e pavarur)', async () => {
    const ms = await prit(async () => {
      const { data } = await admin.from('purchases').select('id,buyer,price,qty,invoice,attachments').eq('invoice', FATURA);
      return data && data.length ? data : false;
    });
    assert.ok(ms >= 0, 'blerja nuk arriti në bazë brenda 15 s');
    const { data } = await admin.from('purchases').select('*').eq('invoice', FATURA).single();
    assert.strictEqual(data.buyer, 'Agimi (prova)', 'personi që bleu nuk u ruajt');
    assert.strictEqual(Number(data.price), 2500, 'çmimi nuk u ruajt');
    assert.strictEqual(data.date, '2026-10-03', 'data nuk u ruajt');
    assert.ok(data.attachments && data.attachments.length === 1, 'fatura nuk u lidh me blerjen');
    return 'në bazë pas ' + (t_shkrim + ms) + ' ms';
  });

  await T('Furnitori i ri (telefon, qytet, adresë, lokacion) ruhet i plotë', async () => {
    const { data } = await admin.from('suppliers').select('*').ilike('name', 'Furnitor Provë%').single();
    assert.strictEqual(data.phone, '0691234567');
    assert.strictEqual(data.city, 'Tiranë');
    assert.strictEqual(data.address, 'Rr. e Durrësit 120');
    assert.strictEqual(data.location, '41.33,19.80');
  });

  let msLive = -1;
  await T('Stafi B e sheh blerjen LIVE, pa e rifreskuar faqen', async () => {
    msLive = await oraB;
    assert.ok(msLive >= 0, 'ndryshimi nuk mbërriti te pajisja B brenda 20 s');
    return 'u shfaq për ' + msLive + ' ms';
  });

  await T('Kërkimi te Stafi B e gjen me furnitor, datë, çmim dhe personin që bleu', async () => {
    const txt = B.__.kerko('kuzhinete provë');
    assert.ok(/Furnitor Provë/.test(txt), 'mungon furnitori te rezultatet');
    assert.ok(/Agimi/.test(txt), 'mungon personi që bleu');
    assert.ok(/2\.?500|2500/.test(txt.replace(/\s/g, '')), 'mungon çmimi');
  });

  await T('Pajisje e tretë (link i hapur rishtas) e sheh blerjen — pra rri në server', async () => {
    const C = pajisje('Stafi-C');
    const ok = await prit(() => C.__.shenja() === 'Online · live' && !!C.__.gjejFature(FATURA));
    assert.ok(ok >= 0, 'pajisja e re nuk e gjeti blerjen');
    return 'u ngarkua për ' + ok + ' ms';
  });

  await T('Fatura: Stafi B e shkarkon dhe del bajt për bajt identike', async () => {
    const att = B.__.gjejFature(FATURA).attachments[0];
    const got = await B.__.shkarkoFature(att.id);
    assert.ok(got, 'fatura nuk u shkarkua');
    assert.strictEqual(got.length, bajt.length, 'madhësia ndryshoi: ' + got.length);
    assert.ok(Buffer.from(got).equals(bajt), 'përmbajtja ndryshoi');
    return att.name + ' · ' + got.length + ' bajt';
  });

  await T('Edhe anasjelltas: Stafi B regjistron, Stafi A e sheh live', async () => {
    const inv = FATURA + '-B';
    const err = await B.__.regjistro({
      produkt: 'Gomë transporti provë', furnitor: 'Furnitor Provë ' + FATURA.slice(-4), bleu: 'Besa (prova)',
      sasi: '10', cmim: '900', data: '2026-10-02', njesi: 'copë', fature: inv, shenim: 'nga pajisja B'
    });
    assert.strictEqual(err, '', 'formulari i B ktheu gabim: ' + err);
    const ms = await prit(() => !!A.__.gjejFature(inv), 20000, 50);
    assert.ok(ms >= 0, 'pajisja A nuk e mori ndryshimin e B');
    const { data } = await admin.from('purchases').select('buyer').eq('invoice', inv).single();
    assert.strictEqual(data.buyer, 'Besa (prova)', 'nuk u ruajt në server');
    return 'A e pa për ' + ms + ' ms';
  });

  /* 2 — kopje rezervë */
  let kopja = null;
  await T('Butoni "Shkarko JSON" nxjerr kopje të plotë rezervë', async () => {
    kopja = A.__.eksporto();
    assert.ok(kopja && kopja.text, 'eksporti nuk u krijua');
    const d = JSON.parse(kopja.text);
    assert.ok(d.purchases.some(p => p.invoice === FATURA), 'kopja nuk e përmban blerjen e re');
    assert.strictEqual(d.purchases.length, A.__.numrat()[0], 'kopja është e paplotë');
    fs.writeFileSync(path.join(__dirname, '..', 'kopje', 'eksport-prove.json'), kopja.text);
    return kopja.name + ' · ' + d.purchases.length + ' blerje · ' + Math.round(kopja.text.length / 1024) + ' KB';
  });

  /* 3 — reset */
  await T('RESET: "Fshi gjithçka" nga Stafi A e zbraz bazën në server', async () => {
    A.__.fshiGjithcka();
    const ms = await prit(async () => {
      const { data } = await admin.from('purchases').select('id');
      const { data: p } = await admin.from('products').select('id');
      return data.length === 0 && p.length === 0;
    }, 20000);
    assert.ok(ms >= 0, 'baza nuk u zbraz');
    return 'serveri u zbraz për ' + ms + ' ms';
  });

  await T('RESET: Stafi B e sheh zbrazjen live (pa rifreskim)', async () => {
    const ms = await prit(() => B.__.numrat()[0] === 0, 20000);
    assert.ok(ms >= 0, 'pajisja B ende shfaq ' + B.__.numrat()[0] + ' blerje');
    return 'u pastrua për ' + ms + ' ms';
  });

  await T('RESET: pajisje e re NUK i rikthen shembujt (gabimi i raportuar)', async () => {
    const D = pajisje('Stafi-D');
    await prit(() => D.__.shenja() === 'Online · live');
    await W(2500);
    assert.strictEqual(D.__.numrat()[0], 0, 'u rikthyen ' + D.__.numrat()[0] + ' blerje');
    const { data } = await admin.from('purchases').select('id');
    assert.strictEqual(data.length, 0, 'serveri u rimbush vetvetiu');
  });

  /* 4 — rikthim nga kopja rezervë */
  await T('KOPJA REZERVË: "Ngarko JSON" e rikthen gjithçka në server', async () => {
    A.__.importo(kopja.text);
    const pritur = JSON.parse(kopja.text).purchases.length;
    const ms = await prit(async () => {
      const { data } = await admin.from('purchases').select('id');
      return data.length === pritur;
    }, 25000);
    assert.ok(ms >= 0, 'rikthimi nuk përfundoi');
    return pritur + ' blerje u rikthyen për ' + ms + ' ms';
  });

  await T('KOPJA REZERVË: edhe Stafi B i sheh të rikthyera, live', async () => {
    const pritur = JSON.parse(kopja.text).purchases.length;
    const ms = await prit(() => B.__.numrat()[0] === pritur, 25000);
    assert.ok(ms >= 0, 'pajisja B ka ' + B.__.numrat()[0] + ' nga ' + pritur);
    return 'u rikthyen te B për ' + ms + ' ms';
  });

  /* 5 — pastrim: hiq blerjen e provës dhe kthe gjendjen fillestare */
  await T('Pastrim: blerja, furnitori dhe fatura e provës u hoqën', async () => {
    const p = B.__.gjejFature(FATURA);
    if (p && p.attachments && p.attachments[0]) await admin.storage.from('fatura').remove([p.attachments[0].id]);
    await admin.from('purchases').delete().in('invoice', [FATURA, FATURA + '-B']);
    await admin.from('suppliers').delete().ilike('name', 'Furnitor Provë%');
    await admin.from('products').delete().ilike('name', 'Kuzhinetë provë');
    await admin.from('products').delete().ilike('name', 'Gomë transporti provë');
    await admin.from('meta').upsert({ id: 'app', value: burim.meta });
    const { data } = await admin.from('purchases').select('id');
    assert.strictEqual(data.length, burim.purchases.length, 'numri nuk u kthye në fillestarin');
  });

  const { data: fp } = await admin.from('purchases').select('id');
  const { data: fs_ } = await admin.from('suppliers').select('id');
  const { data: fpr } = await admin.from('products').select('id');
  INFO('Gjendja përfundimtare', fp.length + ' blerje · ' + fs_.length + ' furnitorë · ' + fpr.length + ' artikuj');
  INFO('Shpejtësia e sinkronizimit', msLive >= 0 ? msLive + ' ms nga shkrimi te pajisja tjetër' : 'n/a');

  console.log('  ' + rows.map(r => `${r[0]}  ${r[1].padEnd(58, '.')} ${r[2]}`).join('\n  '));
  console.log('═'.repeat(78));
  console.log(`  ${rows.filter(r => r[0] === '✅').length} prova kaluan · ${failed} dështuan\n`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('GABIM I PAPRITUR:', e); process.exit(1); });
