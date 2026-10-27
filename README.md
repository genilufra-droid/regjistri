# Regjistri i blerjeve — Supabase + GitHub Pages

Pa server timin, pa mirëmbajtje: **faqja** rri në GitHub Pages, **databaza, faturat dhe sinkronizimi live** te Supabase. Të dyja falas për një përdorim si i yti.

```
Stafi  →  https://biobes.github.io/regjistri   (GitHub Pages — vetëm index.html)
                     │
                     ▼
            Supabase  ├── Postgres: products, suppliers, purchases, meta
                      ├── Storage:  bucket "fatura" (foto/PDF)
                      └── Realtime: ndryshimi i njërit shfaqet te të gjithë
```

> **Shfaqet “Baza nuk u arrit”?** Hap
> [panelin e Supabase](https://supabase.com/dashboard) dhe shiko nëse projekti
> `regjistri-blerjeve` është në listë:
> * me shenjën **Paused** → **Restore project**, prit 1 minutë, te faqja **Provo lidhjen**;
> * **nuk është në listë** → projekti u fshi; krijo një të ri (10 minuta, hap pas hapi)
>   dhe vendos lidhjen — shih [`RREGULLO-LIDHJEN.md`](RREGULLO-LIDHJEN.md) §2.
>
> Faqja tani e shpjegon vetë shkakun, ruan punën në pajisje derisa lidhja të
> kthehet dhe e ndryshon lidhjen pa prekur kodin (*Të dhënat → Ndrysho lidhjen*).

---

## Hapi 1 — Supabase (10 minuta)

1. Hap [supabase.com](https://supabase.com) → **New project**.
   Emri: `regjistri-blerjeve` · Rajoni: **Frankfurt (eu-central-1)** — më afër Shqipërisë.
   Ruaj fjalëkalimin e databazës diku; nuk të duhet për faqen, por të duhet nëse hyn me psql.
2. Në menynë majtas: **SQL Editor → New query** → ngjit gjithë përmbajtjen e `schema.sql` → **Run**.
   Kjo krijon tabelat, indekset, lejet, sinkronizimin live dhe bucket-in e faturave.
3. **Settings → API**: kopjo dy vlera:
   - `Project URL` → p.sh. `https://abcdxyz.supabase.co`
   - `anon public` key → varg i gjatë që nis me `eyJ…`

## Hapi 2 — çelësat (✅ KRYER)

Te `docs/index.html` janë vendosur tashmë vlerat e projektit tuaj:

```html
<script>
  window.SUPABASE_URL      = 'https://vikcvnioouxnchwrnahk.supabase.co';
  window.SUPABASE_ANON_KEY = 'sb_publishable_WY0dvvMh-ZBdpSwEXMN8JQ_I5iyTZmN';
</script>
```

Skema është ekzekutuar dhe baza është mbushur me 56 blerje · 8 furnitorë · 12 artikuj.

## Hapi 3 — GitHub Pages (5 minuta)

```bash
cd regjistri-supabase
git init
git add .
git commit -m "Regjistri i blerjeve"
git branch -M main
git remote add origin https://github.com/<llogaria>/regjistri.git
git push -u origin main
```

Pastaj në GitHub: **Settings → Pages** →
*Source:* `Deploy from a branch` · *Branch:* `main` · *Folder:* **`/docs`** → **Save**.

Pas ~1 minute faqja është në `https://<llogaria>.github.io/regjistri/`.
Dërgoja linkun stafit; në telefon shtohet në ekranin kryesor si aplikacion (*Add to Home Screen*).

> Domen i yti: te **Pages → Custom domain** shkruaj `blerjet.biobes.al` dhe te DNS-i i `biobes.al` shto një CNAME që tregon te `<llogaria>.github.io`.

## Hapi 4 — fut të dhënat ekzistuese (opsionale)

```bash
SUPABASE_URL=https://abcdxyz.supabase.co \
SUPABASE_KEY=eyJ… \
node migrate.js ../regjistri-online/data/regjistri.db ../regjistri-online/data/files
```
ose nga një kopje JSON e shkarkuar me butonin *Shkarko JSON*:
```bash
SUPABASE_URL=… SUPABASE_KEY=… node migrate.js kopja.json
```

Nëse e lë bosh, faqja në hapjen e parë e mbush vetë bazën me të dhënat shembull;
pastaj shtyp *“Fshiji dhe fillo me të dhënat e tua”*.

---

## Si punon pas kësaj

- Dikush ruan një blerje → shkruhet në Postgres → **Realtime** ua çon të tjerëve brenda ~1 sekonde, pa rifreskim.
- Fotoja e faturës shkon në bucket-in `fatura`; e hap kushdo, nga çdo pajisje.
- Pa internet faqja shkruan *“Jashtë linje — do ruhet vetë”* dhe dërgon ndryshimet kur kthehet lidhja.
- Ndryshon diçka në faqe? `git push` → GitHub Pages e përditëson vetë.

## Çmimi

| | Falas deri në | Mjafton për ju? |
|---|---|---|
| Supabase | 500 MB bazë · 1 GB skedarë · 2 projekte | po — 50.000 blerje zënë ~30 MB; 1 GB ≈ 2.000 foto faturash |
| GitHub Pages | 1 GB faqe · 100 GB trafik/muaj | po, me tepri |

Kujdes i vetëm: projekti Supabase **falas pezullohet pas 7 ditësh pa asnjë përdorim** (rindizet me një klik). Me stafin që e përdor çdo ditë, nuk ndodh.

## Siguria — lexoje një herë

Çelësi `anon` është publik: **kushdo që ka linkun mund të shohë dhe të shkruajë** — pikërisht siç e kërkove (pa usera, pa admin). Rreziku real është vetëm nëse linku bie në duar të gabuara.

Nëse më vonë do diçka më të mbyllur, pa e komplikuar:
1. **Fjalëkalim i përbashkët** — një ekran i vogël para faqes, i njëjti fjalëkalim për gjithë stafin.
2. **Hyrje me email** (Supabase Auth) dhe lejet lidhen me `authenticated` në vend të `anon` — ndryshim prej 4 rreshtash te `schema.sql`.
3. **Vetëm leximi publik**, shkrimi me fjalëkalim.

## Kur baza nuk përgjigjet (e re)

Faqja nuk mbetet më te “Baza nuk u arrit” pa shpjegim:

- nën krye del një shirit i kuq me **shkakun** (projekt i pezulluar · çelës i
  ndryshuar · tabela që mungojnë · pa internet) dhe me butonat *Provo lidhjen*,
  *Ndrysho lidhjen*, *Shkarko kopje rezervë*;
- te **Të dhënat → Lidhja me bazën** ka hapat e rregullimit dhe detajin teknik;
- faqja hapet me **kopjen e fundit vendore** dhe blerjet e reja **ruhen në
  pajisje**, pastaj dërgohen vetë kur kthehet lidhja;
- URL-në dhe çelësin e ri mund t’i vendosësh **pa prekur kodin**, te
  *Të dhënat → Ndrysho lidhjen* (vetëm për atë pajisje) ose për të gjithë stafin me
  `node cakto-lidhjen.js <url> <çelës>`.

## Kopje rezervë

- Supabase mban backup automatik ditor (7 ditë në planin falas).
- Butoni *Shkarko JSON* te skeda “Të dhënat” nxjerr gjithçka kurdo.
- Për siguri shtesë: një herë në javë, `Database → Backups → Download`.

---

## Skedarët

| Skedari | Roli |
|---|---|
| `docs/index.html` | faqja e plotë — e vetmja gjë që sheh GitHub Pages |
| `schema.sql` | tabelat, indekset, lejet, realtime, bucket-i |
| `migrate.js` | çon të dhënat ekzistuese në Supabase |
| `patch-supabase.py` | rikrijon `docs/index.html` nga prototipi, nëse ndryshon ndërfaqja |
| `cakto-lidhjen.js` | ndryshon URL-në dhe çelësin te `docs/index.html` me një komandë |
| `RREGULLO-LIDHJEN.md` | çdo shkak i “Baza nuk u arrit” + hapat e rregullimit |
| `tests/supabase.test.js` | teston klientin me një Supabase të rremë (12 teste) |
| `tests/lidhja.test.js` | provon sjelljen kur baza s’përgjigjet ose është e pezulluar (7 prova) |
| `tests/live.test.js` | provë e vërtetë kundër projektit (7 prova) — `SUPABASE_URL=… SUPABASE_KEY=… node tests/live.test.js` |
| `tests/staf.test.js` | provë me dy “pajisje” kundër bazës reale (17 prova) |
