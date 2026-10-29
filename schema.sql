-- =====================================================================
--  REGJISTRI I BLERJEVE — skema për Supabase
--  Hape Supabase → SQL Editor → ngjit gjithë këtë → RUN
--  Pa përdorues, pa admin: kushdo me linkun lexon dhe shkruan.
-- =====================================================================

create extension if not exists pg_trgm;

-- ---------------------------------------------------------- tabelat
create table if not exists public.products (
  id          text primary key,
  name        text not null,
  unit        text,
  "updatedAt" text
);

create table if not exists public.suppliers (
  id          text primary key,
  name        text not null,
  city        text,
  address     text,
  phone       text,
  location    text,
  note        text,
  "updatedAt" text
);

create table if not exists public.purchases (
  id            text primary key,
  "productId"   text references public.products(id) on delete set null,
  "supplierId"  text references public.suppliers(id) on delete set null,
  date          date,
  qty           numeric,
  unit          text,
  price         numeric,
  currency      text,
  invoice       text,
  buyer         text,
  note          text,
  attachments   jsonb default '[]'::jsonb,
  "updatedAt"   text
);

-- ------------------------------------------- MIGRIM: dokument + rreshta
-- Një faturë = një dokument (documentId) me N rreshta artikujsh (lineNo 1..N).
-- Tabela mbetet listë rreshtash; `documentId` i rreshtave të vjetër = id-ja e
-- vetë rreshtit, pra asnjë migrim i dhënave në kod dhe asnjë humbje.
-- Hape SQL Editor-in dhe ekzekuto vetëm këtë bllok edhe nëse skema ekziston.
alter table public.purchases add column if not exists "documentId" text;
alter table public.purchases add column if not exists "lineNo" int default 1;
update public.purchases set "documentId" = id, "lineNo" = 1 where "documentId" is null;
create index if not exists i_pu_doc on public.purchases ("documentId");

-- rresht i vetëm me cilësimet e aplikacionit (demo, personi i fundit që bleu)
create table if not exists public.meta (
  id    text primary key,
  value jsonb
);
insert into public.meta (id, value)
values ('app', '{"demo": false, "lastBuyer": ""}'::jsonb)
on conflict (id) do nothing;

-- ---------------------------------------------------------- indeksat
create index if not exists i_pu_date  on public.purchases (date desc);
create index if not exists i_pu_prod  on public.purchases ("productId");
create index if not exists i_pu_sup   on public.purchases ("supplierId");
create index if not exists i_pu_inv   on public.purchases (invoice);
-- kërkim i shpejtë edhe me gabime shkrimi (kuzhinete → Kuzhinetë)
create index if not exists i_pr_trgm  on public.products using gin (name gin_trgm_ops);
create index if not exists i_su_trgm  on public.suppliers using gin (name gin_trgm_ops);

-- ---------------------------------------------------------- aksesi
-- Të gjitha tabelat hapen për çelësin publik (anon) — kështu stafi punon pa llogari.
alter table public.products  enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchases enable row level security;
alter table public.meta      enable row level security;

drop policy if exists "akses i plote products"  on public.products;
drop policy if exists "akses i plote suppliers" on public.suppliers;
drop policy if exists "akses i plote purchases" on public.purchases;
drop policy if exists "akses i plote meta"      on public.meta;

create policy "akses i plote products"  on public.products  for all to anon, authenticated using (true) with check (true);
create policy "akses i plote suppliers" on public.suppliers for all to anon, authenticated using (true) with check (true);
create policy "akses i plote purchases" on public.purchases for all to anon, authenticated using (true) with check (true);
create policy "akses i plote meta"      on public.meta      for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------- sinkronizimi live
-- Çdo ndryshim u shkon menjëherë të gjithëve që e kanë faqen hapur.
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.products';  exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.suppliers'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.purchases'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.meta';      exception when duplicate_object then null; end;
end $$;

-- ---------------------------------------------------------- faturat (foto/PDF)
insert into storage.buckets (id, name, public)
values ('fatura', 'fatura', true)
on conflict (id) do nothing;

drop policy if exists "fatura lexim"      on storage.objects;
drop policy if exists "fatura ngarkim"    on storage.objects;
drop policy if exists "fatura zevendesim" on storage.objects;
drop policy if exists "fatura fshirje"    on storage.objects;

create policy "fatura lexim"      on storage.objects for select to anon, authenticated using (bucket_id = 'fatura');
create policy "fatura ngarkim"    on storage.objects for insert to anon, authenticated with check (bucket_id = 'fatura');
create policy "fatura zevendesim" on storage.objects for update to anon, authenticated using (bucket_id = 'fatura') with check (bucket_id = 'fatura');
create policy "fatura fshirje"    on storage.objects for delete to anon, authenticated using (bucket_id = 'fatura');

-- ---------------------------------------------------------- pyetje të dobishme
-- 5 furnitorët e fundit për një produkt:
--   select distinct on (p."supplierId") s.name, s.phone, p.price, p.date, p.buyer
--   from purchases p join suppliers s on s.id = p."supplierId"
--   where p."productId" = '…' order by p."supplierId", p.date desc limit 5;
-- Shpenzimet sipas furnitorit:
--   select s.name, sum(p.qty*p.price) total from purchases p join suppliers s on s.id=p."supplierId" group by 1 order by 2 desc;
