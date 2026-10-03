'use strict';
/* Provë e vërtetë kundër projektit Supabase: lexim, shkrim, faturë, sinkronizim live. */
const { createClient } = require('@supabase/supabase-js');
const WS = require('ws');
const assert = require('assert');

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_KEY;
const sb = createClient(URL_, KEY, { realtime: { transport: WS, params: { eventsPerSecond: 10 } } });

const out = []; let failed = 0;
const T = async (n, fn) => { const t = Date.now(); try { await fn(); out.push(['✅', n, Date.now() - t + ' ms']); } catch (e) { failed++; out.push(['❌', n, (e.message || String(e)).slice(0, 110)]); } };
const W = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('\n  PROVË E VËRTETË — ' + URL_ + '\n' + '─'.repeat(70));
  let n0 = 0;

  await T('Leximi i të dhënave nga baza', async () => {
    const { data, error } = await sb.from('purchases').select('*');
    if (error) throw error;
    n0 = data.length;
    assert.ok(n0 >= 56, 'u gjetën vetëm ' + n0 + ' blerje');
  });

  await T('Lidhjet produkt–furnitor janë të sakta', async () => {
    const { data, error } = await sb.from('purchases').select('id, date, price, products(name), suppliers(name, phone)').limit(3);
    if (error) throw error;
    assert.ok(data[0].products && data[0].products.name, 'mungon produkti i lidhur');
    assert.ok(data[0].suppliers && data[0].suppliers.phone, 'mungon furnitori i lidhur');
  });

  await T('Shkronjat shqipe ruhen saktë (ë, ç)', async () => {
    const { data } = await sb.from('products').select('name');
    const names = data.map(p => p.name).join(' | ');
    assert.ok(/ë|ç/i.test(names), 'nuk u gjetën shkronja shqipe: ' + names.slice(0, 80));
  });

  await T('Kërkim si në faqe: "Kuzhinetë" me furnitorët e saj', async () => {
    const { data: prods } = await sb.from('products').select('id,name').ilike('name', '%uzhinet%');
    assert.ok(prods.length, 'produkti nuk u gjet');
    const { data: pus } = await sb.from('purchases').select('date, price, buyer, suppliers(name, phone)')
      .eq('productId', prods[0].id).order('date', { ascending: false }).limit(5);
    assert.ok(pus.length >= 1, 'pa blerje për këtë produkt');
    assert.ok(pus[0].suppliers.name && pus[0].buyer, 'mungon furnitori ose personi');
  });

  let liveGot = null;
  await T('Sinkronizimi live (Realtime) — ndryshimi mbërrin te klienti tjetër', async () => {
    let bound = false;
    const ch = sb.channel('prove-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, p => { liveGot = p; })
      .on('system', {}, m => { if (/Subscribed to PostgreSQL/i.test(m.message || '')) bound = true; });
    await new Promise((res, rej) => {
      ch.subscribe(st => { if (st === 'SUBSCRIBED') res(); if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') rej(new Error('kanali: ' + st)); });
      setTimeout(() => rej(new Error('nuk u lidh brenda 15 s')), 15000);
    });
    for (let i = 0; i < 50 && !bound; i++) await W(100);   // prit derisa baza të lidhet me kanalin
    assert.ok(bound, 'kanali nuk u lidh me PostgreSQL');
    const { data: pr } = await sb.from('products').select('id').limit(1);
    const { data: su } = await sb.from('suppliers').select('id').limit(1);
    const { error } = await sb.from('purchases').insert({
      id: 'live-prove-1', productId: pr[0].id, supplierId: su[0].id, date: '2026-10-03',
      qty: 2, unit: 'copë', price: 1234, currency: 'ALL', invoice: 'PROVE-LIVE',
      buyer: 'Prova automatike', note: '', attachments: [], updatedAt: new Date().toISOString()
    });
    if (error) throw error;
    for (let i = 0; i < 60 && !liveGot; i++) await W(100);
    assert.ok(liveGot, 'njoftimi live nuk mbërriti brenda 6 sekondash');
    assert.strictEqual(liveGot.new.invoice, 'PROVE-LIVE');
    await sb.removeChannel(ch);
  });

  await T('Ngarkim/shkarkim fature në Storage', async () => {
    const bytes = Buffer.from(Array.from({ length: 3000 }, (_, i) => i % 251));
    const up = await sb.storage.from('fatura').upload('prove-fatura', bytes, { contentType: 'image/jpeg', upsert: true });
    if (up.error) throw up.error;
    const dl = await sb.storage.from('fatura').download('prove-fatura');
    if (dl.error) throw dl.error;
    const back = Buffer.from(await dl.data.arrayBuffer());
    assert.strictEqual(back.length, 3000, 'madhësia ndryshoi');
    assert.strictEqual(back[9], 9, 'përmbajtja ndryshoi');
    await sb.storage.from('fatura').remove(['prove-fatura']);
  });

  await T('Pastrimi i të dhënave të provës', async () => {
    const { error } = await sb.from('purchases').delete().eq('id', 'live-prove-1');
    if (error) throw error;
    const { data } = await sb.from('purchases').select('id');
    assert.strictEqual(data.length, n0, 'mbetën të dhëna prove');
  });

  const { data: fin } = await sb.from('purchases').select('id');
  const { data: sup } = await sb.from('suppliers').select('id');
  const { data: prd } = await sb.from('products').select('id');
  out.push(['ℹ️', 'Në bazë tani', `${fin.length} blerje · ${sup.length} furnitorë · ${prd.length} artikuj`]);

  console.log('  ' + out.map(r => `${r[0]}  ${r[1].padEnd(52, '.')} ${r[2]}`).join('\n  '));
  console.log('─'.repeat(70));
  console.log(`  ${out.filter(r => r[0] === '✅').length} prova kaluan · ${failed} dështuan\n`);
  process.exit(failed ? 1 : 0);
})();
