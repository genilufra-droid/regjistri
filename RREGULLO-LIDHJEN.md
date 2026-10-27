# “Baza nuk u arrit” — çfarë do të thotë dhe si rregullohet

Kjo shenjë e kuqe lart djathtas do të thotë vetëm një gjë: **faqja nuk po arrin
dot bazën në Supabase**. Faqja vetë punon; ajo që mungon është lidhja me bazën.

Nga 27 tetor 2026 faqja e shpjegon vetë shkakun: nën krye shfaqet një shirit i
kuq me titullin e problemit, dhe te **Të dhënat → Lidhja me bazën** ka hapat e
rregullimit, butonin *Provo lidhjen*, butonin *Ndrysho lidhjen* dhe një lidhje
drejt e te paneli i Supabase.

---

## 1. Shkaku më i shpeshtë: projekti falas është *i pezulluar*

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

---

## 3. Çelësi u ndryshua ose u hoq

Shenja: *401*, *403*, *Invalid API key*, *JWT*.

Supabase → **Settings → API** → kopjo çelësin `anon` / `publishable` → te faqja
**Të dhënat → Ndrysho lidhjen** → *Ruaj dhe lidhu sërish*. Për stafin, përditësoje
edhe me `node cakto-lidhjen.js …` (si më sipër).

## 4. Baza është aty, por tabelat / lejet mungojnë

Shenja: *relation does not exist*, *permission denied*, *row-level security*.

Hap Supabase → **SQL Editor** → ekzekuto [`schema.sql`](schema.sql) → *Provo lidhjen*.

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
