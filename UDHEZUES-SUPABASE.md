# Udhëzues: baza e re në Supabase (10 minuta, hap pas hapi)

Ky udhëzues e çon faqen nga “Baza nuk u arrit” te **Online · live**, me duart e tua.

> **Para se të krijosh projekt të re, lexo §“Projekti i vjetër u rikthye”.**
> Më 16 nëntor 2026 projekti `vikcvnioouxnchwrnahk` **punon përsëri**, prandaj
> shumicën e rasteve nuk duhet projekt i re — vetëm një bllok SQL për bucket-in
> `fatura` dhe sinkronizimin live.

> **Çfarë të mos ngjitësh askund:** çelësin `service_role` / `secret` dhe fjalëkalimin e
> databazës. Faqja përdor vetëm çelësin **publik** (`sb_publishable_…` ose `anon` `eyJ…`),
> i cili është i sigurt të qëndrojë në faqe.

---

## Projekti i vjetër u rikthye (kontroll 2-minutësh)

Nëse URL-ja është `https://vikcvnioouxnchwrnahk.supabase.co`, provo këtë radhë — pa
krijuar asgjë të re:

| # | Prova | Si bëhet | Pritshmëria |
|---|---|---|---|
| 1 | URL-ja përgjigjet | hap `https://vikcvnioouxnchwrnahk.supabase.co/rest/v1/meta?select=id&apikey=ÇELËSI` | `[{"id":"app"}]` |
| 2 | tabelat | `…/rest/v1/purchases?select=id&limit=1&apikey=ÇELËSI` | listë (edhe bosh) — **jo** `relation … does not exist` |
| 3 | faqja | hap faqen → **Provo lidhjen** | **Online · live** |
| 4 | skedari i faturës | faqja → **Provo lidhjen** | asnjë paralajmërim për bucket-in; nëse mungon, faqja e thotë vetë dhe jep bllokun SQL |

> Më 16 nëntor 2026 u verifikua: pikat 1–4 **kalojnë** (bucket-i `fatura` ekziston, publik).

Nëse pikat 1–3 kalojnë e pika 4 jo, ekzekuto **vetëm** bllokun “Bucket-i i faturave”
dhe “Sinkronizimi live” te [Shtojca A](#shtojca-a--blloqe-sql-për-atë-që-mungon):
20 sekonda në **SQL Editor → New query → Run**. Pa të, *Ruaj faturën* me skedar
shfaq `bucket not found` dhe skedari nuk ruhet.

> **Që nga 16 nëntori 2026** faqja e kontrollon vetë këtë: *Provo lidhjen* bën një GET të
> vogël mbi një objekt që s’ekziston. `NoSuchKey` = bucket-i është aty; `NoSuchBucket` =
> mungon, dhe faqja shfaq paralajmërimin “Blerjet ruhen, por skedarët e faturave jo —
> mungon bucket-i “fatura””, me hapat. Tabelat mbeten “Online · live” (blerjet ruhen),
> prandaj mos u shqetëso për shenjën.

> **Të dhënat:** më 16 nëntor 2026 baza kishte 1 blerje, 1 furnitor dhe 1 artikull
> (rreshti i provës “Permistop / Fatos Sadiku”). Nëse ke kopje JSON të vjetër, ktheje me
> **Të dhënat → Ngarko JSON**. Skedarët e faturave nuk janë brenda JSON-it.

---

## Hapi 1 — Krijo projektin (2 minuta)

1. Hap <https://supabase.com/dashboard> → **New project**.
2. Plotëso:
   - **Name:** `regjistri-blerjeve`
   - **Database Password:** shtyp *Generate a password* dhe **ruaje** diku (nuk të duhet për
     faqen, por të duhet nëse hyn me `psql` ose rikthen nga backup-i).
   - **Region:** **Frankfurt (eu-central-1)** — më afër Shqipërisë, më shpejt në telefon.
   - **Plan:** Free (1.000 faqe OCR nuk ka të bëjë me këtë; ky është plani i bazës).
3. **Create new project** → prit 1–2 minuta derisa të gjelbërohet.

## Hapi 2 — Krijo tabelat (2 minuta)

1. Në menynë majtas: **SQL Editor** → **New query**.
2. Hap [`schema.sql`](https://github.com/genilufra-droid/regjistri/blob/main/schema.sql) →
   butoni **Raw** → `Ctrl+A`, `Ctrl+C` (kopjo **gjithçka**).
3. Ngjite në kuadratin e SQL Editor-it → **Run** (ose `Ctrl+Enter`).

Duhet të dalë **“Success. No rows returned”**. Ky skript krijon:

| Çfarë | Emri |
|---|---|
| tabelat | `products`, `suppliers`, `purchases`, `meta` |
| kolonat e faturave me rreshta | `purchases.documentId`, `purchases.lineNo` |
| indekset (edhe kërkim me gabime shkrimi) | `i_pu_*`, `i_pr_trgm`, `i_su_trgm` |
| lejet për çelësin publik (RLS) | policies `akses i plote …` |
| sinkronizimi live | `supabase_realtime` (4 tabelat) |
| ruajtja e skedarëve | bucket **`fatura`** (foto/PDF) |

> Nëse e ekzekuton dy herë, s’prishet gjë — skripti është i shkruar me `if not exists` /
> `on conflict do nothing`.

## Hapi 3 — Kontrollo se gjithçka u krijua (1 minutë)

Në **SQL Editor → New query** ngjit këtë dhe shtyp **Run**:

```sql
select table_name from information_schema.tables
where table_schema = 'public' order by 1;

select id, name, public from storage.buckets;

select tablename from pg_publication_tables
where pubname = 'supabase_realtime' order by 1;
```

Pritshmëria:

- tabelat: `meta`, `products`, `purchases`, `suppliers`
- bucket: `fatura` me `public = true`
- realtime: `meta`, `products`, `purchases`, `suppliers`

Nëse mungon ndonjëra, shih [Shtojcën A](#shtojca-a--blloqe-sql-për-atë-që-mungon).

## Hapi 4 — Kopjo dy vlerat (1 minutë)

**Settings** (dhëmbëza) → **API** / **API Keys**:

| Çfarë merr | Ku duket | Shembull |
|---|---|---|
| **Project URL** | lart, te *Project URL* / *API Settings* | `https://abcdefghijkl.supabase.co` |
| **Çelësi publik** | *Publishable key* **ose** *anon public* | `sb_publishable_…` ose `eyJhbGciOi…` |

- `Project URL` duhet të mbarojë te `.supabase.co`, **pa** `/` në fund.
- Nëse sheh edhe *Secret keys* / `service_role` — **atë nuk e marrim.**
- Nëse ka buton **“Reveal”**, shtypeni që ta kopjosh çelësin e plotë.

## Hapi 5 — Lidhe faqen (2 minuta)

Faqja ende tregon projektin e vjetër (të fshirë), prandaj shenja e kuqe është e pritur.

### 5a. Prova e shpejtë, vetëm në këtë pajisje

1. Hap faqen → skeda **Të dhënat** → **Ndrysho lidhjen**.
2. Ngjit `Project URL` dhe çelësin publik → **Ruaj dhe lidhu sërish**.
3. Rifresko faqen: lart djathtas duhet **Online · live**.

(Ky çift ruhet vetëm në atë browser — i mirë për provë, jo për stafin.)

### 5b. Për të gjithë stafin, përgjithmonë

Në kompjuterin me kodin:

```bash
node cakto-lidhjen.js https://PROJEKTI.supabase.co ÇELËSI_PUBLIK
git add docs/index.html && git commit -m "Lidhja e re me Supabase" && git push
```

Prit ~1 minutë (GitHub Pages) dhe rifresko faqen. **Ose** ma dërgo vetëm këto dy vlera
(të dyja publike) dhe e bëj unë commit-in.

> Te `docs/index.html` rreshtat 17–18 duhet të jenë:
> ```html
> window.SUPABASE_URL      = 'https://PROJEKTI.supabase.co';
> window.SUPABASE_ANON_KEY = 'ÇELËSI_PUBLIK';
> ```

## Hapi 6 — Kthe të dhënat (nëse ke kopje)

1. Faqja → **Të dhënat** → **Ngarko JSON** → zgjidh `regjistri-blerjeve-….json`.
2. Konfirmo zëvendësimin. Blerjet, furnitorët dhe artikujt kthehen.
3. **Skedarët e faturave** (foto/PDF) nuk janë brenda JSON-it. Nëse i ke ende te projekti i
   vjetër, shkarko dosjen `fatura` nga **Storage** përpara se ta fshish; nëse jo, faturat e
   reja do të ruhen normalisht nga tani e tutje.

Pa kopje? Baza nis bosh dhe faqja shfaq butonën *“Fshiji dhe fillo me të dhënat e tua”*.

## Hapi 7 — Prova se gjithçka punon (2 minuta)

| # | Prova | Pritshmëria |
|---|---|---|
| 1 | Rifresko faqen | lart djathtas **Online · live** |
| 2 | Regjistro një blerje provë | shfaqet menjëherë në *Blerjet e fundit* |
| 3 | Rifresko (F5) | blerja është ende aty |
| 4 | Hape faqen në telefon | e njëjta blerje duket edhe aty |
| 5 | Ndrysho diçka në telefon me faqen hapur në kompjuter | kompjuteri përditësohet vetë (realtime) |
| 6 | **Skano faturën** → zgjidh një PDF → **Ruaj faturën** | faturë me rreshta + skedari te *fatura* |
| 7 | Supabase → **Storage → fatura** | skedari i faturës është aty |
| 8 | Supabase → **Table Editor → purchases** | rreshtat me `documentId` të njëjtë |
| 9 | Fshij blerjen e provës | zhduket edhe nga tabela edhe skedari |
| 10 | **Të dhënat → Shkarko JSON** | skedari shkarkohet (kopje rezervë) |

## Hapi 8 — Mbaje gjallë dhe të sigurt

- **Projekti falas flihet pas 7 ditësh pa përdorur** → thjesht hape faqen një herë në javë
  (çdo hapje bën një lexesë). Nëse pezullohet: **Restore project**, prit 1 minutë.
- **Kopje rezervë:** një herë në javë *Shkarko JSON*; një herë në muaj
  Supabase → **Database → Backups**.
- **Siguria:** lejet janë të hapura për çelësin publik (stafi punon pa llogari). Kush e ka
  linkun e faqes **lexon dhe shkruan** — prandaj mos e shpërndaj publikisht. Nëse një ditë do
  llogari për stafin, kjo bëhet me *Supabase Auth* + politika sipas përdoruesit; thuamë dhe e
  shtoj.
- **Çelësi `service_role`** nuk futet kurrë në faqe: ai anashkalon të gjitha lejet.

## Hapi 9 — Nëse diçka nuk shkon

| Çfarë shfaqet | Shkaku | Zgjidhja |
|---|---|---|
| *“Çelësi i Supabase nuk pranohet”* (401/403) | çelës i gabuar ose i fshirë | Settings → API Keys → kopjo **publishable/anon** sërish |
| *“tabela që mungon”* / `relation "purchases" does not exist` | `schema.sql` s’u ekzekutua | Hapi 2 |
| `bucket not found` gjatë ruajtjes | bucket-i `fatura` mungon | [Shtojca A](#shtojca-a--blloqe-sql-për-atë-që-mungon) |
| `new row violates row-level security policy` | policy-t mungojnë | [Shtojca A](#shtojca-a--blloqe-sql-për-atë-që-mungon) |
| Ndryshimet s’shfaqen te pajisja tjetër | realtime i paaktivizuar | [Shtojca A](#shtojca-a--blloqe-sql-për-atë-që-mungon) |
| *“projekti është i pezulluar”* | 7 ditë pa përdorim | Supabase → **Restore project**, prit 1 minutë |
| *“Serveri i bazës nuk arrihet”* | URL e gabuar (p.sh. e projektit të vjetër) | Hapi 5 |
| Faqja punon, por pa internet | — | puna ruhet në pajisje dhe dërgohet vetë kur kthehet lidhja |

---

## Shtojca A — blloqe SQL për atë që mungon

**Bucket-i i faturave:**

```sql
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
```

**Sinkronizimi live:**

```sql
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.products';  exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.suppliers'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.purchases'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.meta';      exception when duplicate_object then null; end;
end $$;
```

**Lejet (RLS) për tabelat:**

```sql
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
```

## Shtojca B — çfarë të më dërgosh

Nëse do që unë t’i bëj hapat e kodit (commit-i i lidhjes, verifikimi, rikthimi i të
dhënave), më duhen vetëm:

1. **Project URL** — `https://………….supabase.co`
2. **Çelësi publik** — `sb_publishable_…` ose `eyJ…` (anon)

Të dyja janë publike (qëndrojnë në faqen e hapur). **Nuk** më duhet fjalëkalimi i databazës
dhe **nuk** më duhet çelësi `service_role`.

Për leximin e fortë të faturave (Google Vision) udhëzimi është më vete:
[`UDHEZUES-OCR.md`](UDHEZUES-OCR.md).
