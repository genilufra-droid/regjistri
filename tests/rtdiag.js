const { createClient } = require('@supabase/supabase-js');
const WS = require('ws');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, { realtime: { transport: WS, params: { eventsPerSecond: 10 }, log_level: 'info' } });
const seen = [];
(async () => {
  const ch = sb.channel('diag')
    .on('postgres_changes', { event: '*', schema: 'public' }, p => seen.push(['schema:*', p.table, p.eventType]))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'purchases' }, p => seen.push(['purchases INSERT', p.new && p.new.invoice]))
    .on('system', {}, m => seen.push(['system', JSON.stringify(m).slice(0, 200)]));
  const status = await new Promise(res => { ch.subscribe((st, err) => { console.log('  status:', st, err ? ('· ' + (err.message || err)) : ''); if (st !== 'SUBSCRIBED') return; res(st); }); setTimeout(() => res('timeout'), 12000); });
  console.log('  lidhja:', status, '· socket:', sb.realtime.isConnected());
  const { data: pr } = await sb.from('products').select('id').limit(1);
  const { data: su } = await sb.from('suppliers').select('id').limit(1);
  const r = await sb.from('purchases').insert({ id:'diag-1', productId:pr[0].id, supplierId:su[0].id, date:'2026-10-03', qty:1, unit:'copë', price:1, currency:'ALL', invoice:'DIAG', buyer:'diag', note:'', attachments:[], updatedAt:new Date().toISOString() });
  console.log('  insert:', r.error ? r.error.message : 'ok');
  await new Promise(r => setTimeout(r, 6000));
  console.log('  ngjarje të marra:', seen.length ? JSON.stringify(seen) : 'ASNJË');
  await sb.from('purchases').delete().eq('id','diag-1');
  process.exit(0);
})();
