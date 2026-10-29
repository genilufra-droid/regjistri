# “Baza nuk u arrit” — çfarë do të thotë dhe si rregullohet

Kjo shenjë e kuqe lart djathtas do të thotë vetëm një gjë: **faqja nuk po arrin
dot bazën në Supabase**. Faqja vetë punon; ajo që mungon është lidhja me bazën.

Nga 27 tetor 2026 faqja e shpjegon vetë shkakun: nën krye shfaqet një shirit i
kuq me titullin e problemit, dhe te **Të dhënat → Lidhja me bazën** ka hapat e
rregullimit, butonin *Provo lidhjen*, butonin *Ndrysho lidhjen* dhe një lidhje
drejt e te paneli i Supabase.

---

## 0. Kontrolli i parë: a ekziston ende projekti?

Hap <https://supabase.com/dashboard> dhe shiko listën e projekteve.

| Çfarë shihni | Çfarë do të thotë | Ku shkoni |
|---|---|---|
| Projekti `regjistri-blerjeve` me shenjën **Paused** | Vetëm i pezulluar — të dhënat janë aty | [§1](#1-shkaku-më-i-shpeshtë-projekti-falas-është-i-pezulluar) |
| Projekti nuk është në listë (as te organizatat e tjera) | Projekti është **fshirë** | [§2](#2-projekti-u-fshi-ose-u-krijua-i-ri-url-tjetër) |
| Nuk hyni dot në llogari | Llogaria/emaili ka ndryshuar | Rikthe llogarinë, pastaj shiko sërish |

> **27 tetor 2026:** emri `vikcvnioouxnchwrnahk.supabase.co` **nuk zgjidhet më në
> DNS** (NXDOMAIN) — projekt i pezulluar normalisht vazhdon të zgjidhet. Pra me
> shumë gjasa projekti është **fshirë**, jo thjesht i pezulluar. Nëse nuk e shihni
> në panel, shkruaji **Supabase Support** brenda pak ditësh (mund të rikthejnë
> backup-in) dhe ndërkohë vazhdo me §2.

---

## 1. Shkaku i dytë më i shpeshtë: projekti falas është *i pezulluar*

Supabase e pezullon **vetvetiu** projektin e planit falas pas **7 ditësh pa
asnjë përdorim**. Të dhënat **nuk humbin** — projekti thjesht fiket.

**Rregullimi (1 minutë):**

1. Hap <https://supabase.com/dashboard/project/vikcvnioouxnchwrnahk>
   (ose rrënjën <https://supabase.com/dashboard> dhe zgjidh projektin).
2. Shtyp **Restore project** / **Resume project** dhe prit rreth 1 minutë.
3. Kthehu te faqja dhe shtyp **Provo lidhjen** (ose rifresko faqen).

> Për të mos u përsëritur: mjafton që faqja të hapet një herë në javë —
> çdo hapje bën një lexesë në bazë dhe projekti nuk konsiderohet i papërdorur.

**Automatikisht (opsionale, 2 minuta):** krijo te GitHub skedarin
`.github/workflows/zgjo-bazen.yml` me përmbajtjen më poshtë (butoni *Add file →
Create new file*). Çdo të hënë bën një lexesë të vogël — projekti rri zgjuar,
dhe po të jetë pezulluar merr një paralajmërim te *Actions*.

```yaml
name: Zgjo bazën
on:
  schedule:
    - cron: '0 6 * * 1'
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - id: cfg
        run: |
          echo "url=$(grep -oP \"SUPABASE_URL\s*=\s*'\K[^']+\" docs/index.html)" >> "$GITHUB_OUTPUT"
          KEY=$(grep -oP "SUPABASE_ANON_KEY\s*=\s*'\K[^']+" docs/index.html)
          echo "::add-mask::$KEY"
          echo "key=$KEY" >> "$GITHUB_OUTPUT"
      - run: |
          CODE=$(curl -sS -o /tmp/p -w '%{http_code}' "${{ steps.cfg.outputs.url }}/rest/v1/meta?select=id&limit=1" -H "apikey: ${{ steps.cfg.outputs.key }}") || CODE=000
          echo "Përgjigjja: $CODE"; head -c 300 /tmp/p || true
          [ "$CODE" = "200" ] || { echo "::warning::Baza nuk përgjigjet ($CODE) — Restore project te Supabase"; exit 1; }
```

---

## 2. Projekti u fshi ose u krijua i ri (URL tjetër)

Shenja: gabimi përmban *Failed to fetch* / *not found*, ose URL-ja e vjetër nuk
hapet më.

1. Krijo projekt të ri: <https://supabase.com> → **New project** →
   rajon **Frankfurt (eu-central-1)**.
2. **SQL Editor → New query** → ngjit gjithë skedarin [`schema.sql`](schema.sql) → **Run**.
   (Krijon tabelat, lejet, sinkronizimin live dhe bucket-in `fatura`.)
3. **Settings → API**: kopjo `Project URL` dhe çelësin `anon` / `publishable`.
4. Vendos lidhjen në njërën nga dy mënyrat:
   - **për të gjithë stafin** (e përhershme):
     ```bash
     node cakto-lidhjen.js https://projekt-iri.supabase.co sb_publishable_xxx
     git add docs/index.html && git commit -m "Lidhja e re" && git push
     ```
   - **vetëm për këtë pajisje** (e shpejtë): te faqja → **Të dhënat →
     Ndrysho lidhjen** → ngjit URL-në e çelësin → *Ruaj dhe lidhu sërish*.
5. Kthe të dhënat: **Të dhënat → Ngarko JSON** (kopja rezervë e shkarkuar më parë).

> Skedarët e faturave (foto/PDF) nuk janë brenda JSON-it. Nëse projekti i vjetër
> ende hapet, shkarko dosjen `fatura` nga **Storage** para se ta fshish.

### Hap pas hapi për bazë krejt të re (10 minuta)

1. <https://supabase.com> → **New project** · emri `regjistri-blerjeve` ·
   rajon **Frankfurt (eu-central-1)** · ruaj fjalëkalimin e databazës.
2. **SQL Editor → New query** → ngjit gjithë [`schema.sql`](schema.sql) → **Run**.
   Duhet të përfundojë pa gabime; krijon tabelat, lejet, realtime dhe bucket-in
   `fatura`.
3. **Settings → API**: kopjo **Project URL** dhe çelësin **anon / publishable**.
4. Nga dosja e projektit:
   ```bash
   node cakto-lidhjen.js https://projekti-i-ri.supabase.co sb_publishable_xxx
   git add docs/index.html && git commit -m "Lidhja e re me Supabase" && git push
   ```
   (Për ta provuar vetëm në telefonin tënd: te faqja **Të dhënat → Ndrysho
   lidhjen**.)
5. Prit ~1 minutë që GitHub Pages të përditësohet, hap faqen → **Provo lidhjen**
   → duhet të shkruajë *Online · live*.
6. Kthe të dhënat: **Të dhënat → Ngarko JSON** (kopja e fundit rezervë). Nëse
   s’ka kopje, baza nis bosh dhe shembujt dalin vetëm herën e parë (butoni
   *“Fshiji dhe fillo me të dhënat e tua”*).

> **Kopje rezervë më tej:** një herë në javë shtyp *Shkarko JSON* te skeda
> “Të dhënat” (ose *Shkarko kopje rezervë* te shiriti i kuq). Një skedar 20 KB
> të shpëton nga çdo fshirje a pezullim.

---

## 3. Çelësi u ndryshua ose u hoq

Shenja: *401*, *403*, *Invalid API key*, *JWT*.

Supabase → **Settings → API** → kopjo çelësin `anon` / `publishable` → te faqja
**Të dhënat → Ndrysho lidhjen** → *Ruaj dhe lidhu sërish*. Për stafin, përditësoje
edhe me `node cakto-lidhjen.js …` (si më sipër).

## 4. Baza është aty, por tabelat / lejet mungojnë

Shenja: *relation does not exist*, *permission denied*, *row-level security*.

Hap Supabase → **SQL Editor** → ekzekuto [`schema.sql`](schema.sql) → *Provo lidhjen*.

### 4a. Skemë e vjetër: faturat nuk grupohen në rreshta

Shenja: te **Të dhënat → Lidhja me bazën** del një kuti e verdhë *“Baza ka skemë
të vjetër — mungon migrimi i faturës”*, ose një faturë me shumë artikuj shfaqet
si fatura të veçanta.

Kjo ndodh kur tabela `purchases` s’i ka ende kolonat `documentId` dhe `lineNo`
(një faturë = dokument me N rreshta). Të dhënat **nuk humbin** dhe faqja punon:

1. Supabase → **SQL Editor** → **New query**.
2. Ngjit bllokun **“MIGRIM: dokument + rreshta”** nga [`schema.sql`](schema.sql)
   (katër rreshta: `alter table … "documentId"`, `… "lineNo"`, `update …`,
   `create index … i_pu_doc`) → **Run**.
3. Te faqja: **Të dhënat → Provo lidhjen**. Kutia e verdhë zhduket.

Rreshtat e vjetër marrin `documentId = id` (secila faturë e vjetër mbetet
dokument më vete), pra nuk humbet asnjë blerje dhe nuk duhet migrim në kod.

## 5. Faqja nuk ngarkon dot as bibliotekën

Shenja: *Biblioteka e faqes nuk u ngarkua*. Zakonisht fajin e ka interneti ose
një bllokues reklamash. Faqja provon vetë një CDN të dytë; nëse s’ia del,
rifresko faqen ose provo me rrjet tjetër.

---

## Çfarë bën faqja tani, kur baza s’përgjigjet

| | |
|---|---|
| **Të dhënat nuk humbin** | Faqja hapet me kopjen e fundit vendore dhe blerjet e reja ruhen në pajisje. |
| **Dërgohen vetë** | Sapo kthehet lidhja (ose shtyp *Provo lidhjen*), ato shkojnë në bazë — një provë çdo 4 sekonda, pa e mbingarkuar serverin. |
| **Shkaku shpjegohet** | Titull + hapa konkretë, jo vetëm “nuk u arrit”. |
| **Lidhja ndryshohet pa kod** | *Të dhënat → Ndrysho lidhjen* (ruhet në atë shfletues). |
| **Kopje rezervë** | Butoni *Shkarko kopje rezervë* te shiriti i kuq nxjerr gjithçka si JSON. |

**Kujdes:** kopja vendore është vetëm për këtë pajisje. Nëse baza mbetet jashtë
për ditë të tëra dhe stafi shkruan në disa pajisje, të dhënat nuk bashkohen
vetvetiu — prandaj rregullo lidhjen sa më parë.

---

## Prova pa internet (për zhvillues)

```bash
npm install --no-audit --no-fund
npm test                     # 12 + 7 prova me bazë të rreme
```
