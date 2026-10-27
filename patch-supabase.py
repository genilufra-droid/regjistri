#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VËREJTJE (27 tetor 2026): ky skript e rikrijon docs/index.html nga prototipi dhe
NUK përmban shtresën e re të lidhjes (diagnostikim i shkaqeve, “Ndrysho lidhjen”,
kopje vendore, riprovë e kontrolluar). Mos e ekzekuto mbi versionin aktual pa i
ribërë ato ndryshime; për ndërfaqen puno drejtpërdrejt te docs/index.html dhe
provo me `npm test`.

Kthen ndërfaqen single-file (prototipi i miratuar) në klient Supabase.
Pamja dhe logjika mbeten 1:1 — ndryshon vetëm shtresa e ruajtjes:
  Store  -> tabelat products / suppliers / purchases / meta në Supabase
  Files  -> bucket-i "fatura" në Supabase Storage
  nisja  -> tërheqje nga baza + dëgjim live (Realtime)
Përdorim: python3 patch-supabase.py <burimi.html> <docs/index.html>
"""
import io, re, sys

src_path = sys.argv[1] if len(sys.argv) > 1 else '../uploads/Rregjistri furnir.html'
out_path = sys.argv[2] if len(sys.argv) > 2 else 'docs/index.html'
html = io.open(src_path, encoding='utf-8').read()

def cut(start, end, text):
    i = text.index(start); j = text.index(end, i) + len(end)
    return text[i:j]

# ------------------------------------------------- 1. biblioteka + konfigurimi
head_anchor = '<link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">'
config = head_anchor + '''

<!-- ====================== KONFIGURIMI I SUPABASE ======================
     Këtu ngjit dy vlerat nga Supabase → Settings → API.
     Çelësi "anon" është publik me qëllim: stafi punon pa llogari.
     ================================================================== -->
<script>
  window.SUPABASE_URL      = 'https://vikcvnioouxnchwrnahk.supabase.co';
  window.SUPABASE_ANON_KEY = 'sb_publishable_WY0dvvMh-ZBdpSwEXMN8JQ_I5iyTZmN';
</script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>'''
html = html.replace(head_anchor, config)

# ------------------------------------------------- 2. shenja e lidhjes
old_chip = re.search(r'<span class="chip"[^>]*>Prototip · vetëm në këtë pajisje</span>', html).group(0)
html = html.replace(old_chip, '<span class="chip" id="netChip" title="Të dhënat rrinë në Supabase dhe i sheh i gjithë stafi. '
                              'Çdo ndryshim shfaqet menjëherë te të tjerët.">Po lidhet…</span>')

# ------------------------------------------------- 3. Store -> Supabase
old_store = cut('/* ---------- Store ---------- */', '\n};\n', html)
new_store = r'''/* ---------- Store (Supabase: databazë e përbashkët) ----------
   Ndërfaqja mbetet e njëjtë (Store.data / save / replace). Ndryshimet
   shkojnë te tabelat në Supabase dhe kthehen live te gjithë stafi. */
const SB = (() => {
  try { return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, { realtime: { params: { eventsPerSecond: 10 } } }); }
  catch (e) { console.error('Supabase nuk u konfigurua:', e); return null; }
})();
const TABLES = ['products', 'suppliers', 'purchases'];

const Store = {
  data: { products: [], suppliers: [], purchases: [], meta: { demo: false, lastBuyer: '' } },
  memoryOnly: false,
  load() { return true; },                    // të dhënat vijnë nga Supabase te boot()
  save() { Net.queue(); },
  replace(d) {
    this.data = {
      products: d.products || [], suppliers: d.suppliers || [], purchases: d.purchases || [],
      meta: Object.assign({ demo: false, lastBuyer: '', seeded: (this.data.meta || {}).seeded === true }, d.meta || {})
    };
    Net.queueFull();
  }
};

const Net = {
  shadow: { products: {}, suppliers: {}, purchases: {} }, metaShadow: '',
  busy: false, dirty: false, full: false, timer: null, pullTimer: null, lastWrite: 0,
  chip(text, cls) {
    const el = document.getElementById('netChip'); if (!el) return;
    el.textContent = text;
    el.style.borderColor = cls === 'bad' ? 'var(--danger)' : cls === 'ok' ? 'var(--accent)' : 'var(--line)';
    el.style.color = cls === 'bad' ? 'var(--danger)' : cls === 'ok' ? 'var(--accent)' : 'var(--muted)';
  },
  clean(row) { const o = Object.assign({}, row); delete o.created_at; return o; },
  index(arr) { const o = {}; (arr || []).forEach(x => { if (x && x.id) o[x.id] = JSON.stringify(x); }); return o; },
  snapshot() {
    TABLES.forEach(k => this.shadow[k] = this.index(Store.data[k]));
    this.metaShadow = JSON.stringify(Store.data.meta);
  },
  async pull() {
    if (!SB) throw new Error('pa konfigurim');
    const [pr, su, pu, mt] = await Promise.all([
      SB.from('products').select('*'),
      SB.from('suppliers').select('*'),
      SB.from('purchases').select('*'),
      SB.from('meta').select('value').eq('id', 'app').maybeSingle()
    ]);
    const err = pr.error || su.error || pu.error;
    if (err) throw err;
    Store.data = {
      products: (pr.data || []).map(r => this.clean(r)),
      suppliers: (su.data || []).map(r => this.clean(r)),
      purchases: (pu.data || []).map(r => Object.assign(this.clean(r), { attachments: r.attachments || [] })),
      meta: Object.assign({ demo: false, lastBuyer: '' }, (mt && mt.data && mt.data.value) || {})
    };
    this.metaExists = !!(mt && mt.data);     // a është përdorur ndonjëherë kjo bazë?
    this.snapshot();
  },
  queue() { this.dirty = true; this.kick(); },
  queueFull() { this.dirty = true; this.full = true; this.kick(); },
  kick() { clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 150); },
  async flush() {
    if (this.busy || !this.dirty || !SB) return;
    this.busy = true;
    const wasFull = this.full;
    this.dirty = false; this.full = false;
    this.lastWrite = Date.now();
    this.chip('Po ruhet…', '');
    try {
      if (wasFull) {
        // zëvendësim i plotë: fshi gjithçka, pastaj shkruaj të renë
        for (const t of ['purchases', 'products', 'suppliers']) {
          const { error } = await SB.from(t).delete().neq('id', '___asnje___');
          if (error) throw error;
        }
        for (const t of ['products', 'suppliers', 'purchases']) {
          const rows = Store.data[t];
          for (let i = 0; i < rows.length; i += 500) {
            const { error } = await SB.from(t).insert(rows.slice(i, i + 500));
            if (error) throw error;
          }
        }
      } else {
        for (const t of TABLES) {
          const now = this.index(Store.data[t]), prev = this.shadow[t];
          const up = [], del = [];
          for (const id in now) if (now[id] !== prev[id]) up.push(JSON.parse(now[id]));
          for (const id in prev) if (!(id in now)) del.push(id);
          if (up.length) { const { error } = await SB.from(t).upsert(up); if (error) throw error; }
          if (del.length) { const { error } = await SB.from(t).delete().in('id', del); if (error) throw error; }
        }
      }
      if (JSON.stringify(Store.data.meta) !== this.metaShadow || wasFull) {
        const { error } = await SB.from('meta').upsert({ id: 'app', value: Store.data.meta });
        if (error) throw error;
      }
      this.snapshot();
      this.lastWrite = Date.now();
      this.chip('Sinkronizuar ✓', 'ok');
    } catch (e) {
      console.warn('Ruajtja dështoi:', e && e.message);
      this.dirty = true; if (wasFull) this.full = true;
      this.chip('Jashtë linje — do ruhet vetë', 'bad');
      clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 4000);
    } finally {
      this.busy = false;
      if (this.dirty) this.kick();
    }
  },
  /* Ndryshimet e kolegëve vijnë nga Realtime; i marrim të gjitha me një tërheqje të vetme. */
  schedulePull() {
    clearTimeout(this.pullTimer);
    this.pullTimer = setTimeout(async () => {
      if (this.busy || this.dirty || Date.now() - this.lastWrite < 1200) return;
      try { await this.pull(); renderAll(); toast('U përditësua nga një përdorues tjetër'); this.chip('Online · live', 'ok'); }
      catch (e) {}
    }, 400);
  },
  listen() {
    if (!SB) return;
    SB.channel('regjistri-blerjeve')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => this.schedulePull())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, () => this.schedulePull())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, () => this.schedulePull())
      .subscribe(st => {
        if (st === 'SUBSCRIBED') this.chip('Online · live', 'ok');
        if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') this.chip('Lidhja live u ndërpre', 'bad');
      });
    /* Rrjetë sigurie: edhe nëse humbet ndonjë njoftim live, çdo minutë
       kontrollohet heshturazi nëse dikush ka ndryshuar diçka. */
    setInterval(async () => {
      if (this.busy || this.dirty || document.querySelector('dialog[open]')) return;
      try {
        const before = JSON.stringify([Store.data.purchases.length, Store.data.suppliers.length, Store.data.products.length]);
        await this.pull();
        if (JSON.stringify([Store.data.purchases.length, Store.data.suppliers.length, Store.data.products.length]) !== before) renderAll();
      } catch (e) {}
    }, 60000);
  }
};
'''
html = html.replace(old_store, new_store)

# ------------------------------------------------- 4. Files -> Supabase Storage
old_files = cut('/* ---------- Skedarët e faturave (IndexedDB) ----------', '\n};\n', html)
new_files = r'''/* ---------- Skedarët e faturave (Supabase Storage) ----------
   Metadata (emri, tipi, madhësia) rri te blerja; vetë skedari në bucket-in
   "fatura", që ta hapë kushdo në staf nga çdo pajisje. */
const BUCKET = 'fatura';
const Files = {
  async put(id, blob) {
    const { error } = await SB.storage.from(BUCKET).upload(id, blob, {
      contentType: blob.type || 'application/octet-stream', upsert: true
    });
    if (error) throw error;
    return true;
  },
  async get(id) {
    const { data, error } = await SB.storage.from(BUCKET).download(id);
    if (error) return null;
    return data;
  },
  async del(id) { try { await SB.storage.from(BUCKET).remove([id]); } catch (e) {} },
  async clear() {
    try {
      const { data } = await SB.storage.from(BUCKET).list('', { limit: 1000 });
      if (data && data.length) await SB.storage.from(BUCKET).remove(data.map(f => f.name));
    } catch (e) {}
  }
};
'''
html = html.replace(old_files, new_files)

# ------------------------------------------------- 5. nisja
old_init = cut('/* ---------- Nisja ---------- */', "$('#q').focus({ preventScroll: true });", html)
new_init = r'''/* ---------- Nisja (Supabase) ---------- */
(async function boot() {
  if (!SB || /PROJEKTI-YT|VENDOS-CELESIN/.test(String(window.SUPABASE_URL) + window.SUPABASE_ANON_KEY)) {
    Net.chip('Pa konfigurim', 'bad');
    document.querySelector('#results').innerHTML =
      '<div class="empty"><strong>Mungon konfigurimi i Supabase</strong>' +
      'Hap skedarin index.html dhe vendos SUPABASE_URL dhe SUPABASE_ANON_KEY nga Supabase → Settings → API.</div>';
    return;
  }
  try {
    await Net.pull();
    const empty = !Store.data.products.length && !Store.data.suppliers.length && !Store.data.purchases.length;
    if (empty && !Store.data.meta.seeded && !Net.metaExists) {
      const d = demoData(); d.meta.seeded = true; Store.replace(d);   // vetëm në bazë krejt të re
    }
    renderAll();
    Net.chip('Online · live', 'ok');
    Net.listen();
  } catch (e) {
    Net.chip('Baza nuk u arrit', 'bad');
    renderAll();
    toast('Baza nuk u arrit. Kontrollo lidhjen — faqja do riprovojë vetë.');
    setTimeout(boot, 5000);
  }
  $('#q').focus({ preventScroll: true });
})();'''
html = html.replace(old_init, new_init)

# ------------------------------------------------- 6. tekstet
html = html.replace(
    'Shkarko gjithçka si skedar ose rikthe një kopje të mëparshme. Në prototip, të dhënat ruhen vetëm në këtë shfletues. '
    'Skedarët e faturave (foto, PDF, ZIP) nuk futen në JSON apo CSV dhe mbeten vetëm këtu.',
    'Shkarko gjithçka si skedar ose rikthe një kopje të mëparshme. Të dhënat rrinë në bazën e përbashkët (Supabase) dhe i sheh i gjithë stafi; '
    'çdo ndryshim shfaqet menjëherë te të tjerët. Skedarët e faturave (foto, PDF, ZIP) ruhen në Supabase Storage dhe nuk futen brenda JSON-it apo CSV-së.')
html = html.replace('Heq të gjitha blerjet, furnitorët dhe produktet nga ky shfletues.',
                    'Heq të gjitha blerjet, furnitorët dhe produktet nga baza — për të gjithë stafin.')

# butoni "Fshiji dhe fillo me të dhënat e tua" + fshirja e plotë duhet ta shënojnë
# bazën si të përdorur, që shembujt të mos rikthehen në ringarkimin tjetër.
_old_clear = "Files.clear().catch(() => {}); Store.replace({}); renderAll(); toast('Gati. Regjistro blerjen e parë.');"
_new_clear = "Files.clear().catch(() => {}); Store.replace({ meta: { demo: false, lastBuyer: '', seeded: true } }); renderAll(); toast('Gati. Regjistro blerjen e parë.');"
assert html.count(_old_clear) == 1, 'nuk u gjet butoni i pastrimit'
html = html.replace(_old_clear, _new_clear)

_old_wipe = "if (confirm('Të gjitha të dhënat do të fshihen. Je i sigurt?'))"
if _old_wipe in html:
    html = html.replace("Store.replace({}); closeSupplier(); renderAll(); toast('Të dhënat u fshinë');",
                        "Store.replace({ meta: { demo: false, lastBuyer: '', seeded: true } }); closeSupplier(); renderAll(); toast('Të dhënat u fshinë');")

for needle in ['supabase-js@2', 'const SB =', "SB.storage.from(BUCKET)", 'id="netChip"', 'async function boot()']:
    assert needle in html, 'Patch dështoi te: ' + needle
assert 'indexedDB' not in html and 'localStorage.getItem(this.key)' not in html, 'Mbeti ruajtje lokale'

io.open(out_path, 'w', encoding='utf-8').write(html)
print('OK →', out_path, len(html), 'bajte')
