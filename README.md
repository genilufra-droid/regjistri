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

> **Gjendja e bazës (16 nëntor 2026):** projekti `vikcvnioouxnchwrnahk` **u rikthye dhe
> punon** — URL-ja dhe çelësi publik te `docs/index.html` janë të vlefshme; tabelat
> (`products`, `suppliers`, `purchases` me `documentId`/`lineNo`, `meta`) përgjigjen dhe
> bucket-i **`fatura`** i skedarëve u krijua e u verifikua (publik, `NoSuchKey` për objekt
> që s’ekziston). *Provo lidhjen* e kontrollon vetë bucket-in dhe, po të mungojë, jep
> bllokun SQL për ta krijuar.
>
> **Shfaqet “Baza nuk u arrit”?** Hap
> [panelin e Supabase](https://supabase.com/dashboard) dhe shiko nëse projekti
> është në listë:
> * me shenjën **Paused** → **Restore project**, prit 1 minutë, te faqja **Provo lidhjen**;
> * **nuk është në listë** → krijo një të ri dhe vendos lidhjen —
>   shih [`UDHEZUES-SUPABASE.md`](UDHEZUES-SUPABASE.md).
>
> Faqja e shpjegon vetë shkakun, ruan punën në pajisje derisa lidhja të kthehet dhe
> e ndryshon lidhjen pa prekur kodin (*Të dhënat → Ndrysho lidhjen*).

---

## Hapi 1 — Supabase (10 minuta)

> Udhëzim i plotë, hap pas hapi, me kontrolle dhe zgjidhje gabimesh:
> [`UDHEZUES-SUPABASE.md`](UDHEZUES-SUPABASE.md). Shkurt:

1. Hap [supabase.com](https://supabase.com) → **New project**.
   Emri: `regjistri-blerjeve` · Rajoni: **Frankfurt (eu-central-1)** — më afër Shqipërisë.
   Ruaj fjalëkalimin e databazës diku; nuk të duhet për faqen, por të duhet nëse hyn me psql.
2. Në menynë majtas: **SQL Editor → New query** → ngjit gjithë përmbajtjen e `schema.sql` → **Run**.
   Kjo krijon tabelat, indekset, lejet, sinkronizimin live dhe bucket-in e faturave.
3. **Settings → API**: kopjo dy vlera:
   - `Project URL` → p.sh. `https://abcdxyz.supabase.co`
   - çelësin **publishable** / **anon public** → `sb_publishable_…` ose `eyJ…`
     (**jo** `service_role`/secret)

## Hapi 2 — lidhja me bazën

Te `docs/index.html` (rreshtat 17–18) vendosen URL-ja dhe çelësi publik i projektit:

```html
<script>
  window.SUPABASE_URL      = 'https://PROJEKTI.supabase.co';
  window.SUPABASE_ANON_KEY = 'sb_publishable_…';
</script>
```

Mënyrat për t’i vendosur:

- **për të gjithë stafin:** `node cakto-lidhjen.js https://PROJEKTI.supabase.co ÇELËSI` → commit → push;
- **vetëm për një pajisje (provë):** faqja → **Të dhënat → Ndrysho lidhjen**.

> Projekti i vjetër (`vikcvnioouxnchwrnahk`) është fshirë; derisa të vendoset lidhja e re,
> faqja shfaq shenjën e kuqe dhe punon me kopjen vendore.

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

## Skanimi i faturës (foto ose PDF → faturë e plotësuar)

Te skeda **Blerjet** (butoni **📷 Skano faturën**) ose brenda formularit të faturës:

1. **Zgjidh foto ose PDF** — në telefon hapet direkt kamera; mund edhe ta tërheqësh skedarin.
2. Faqja e lexon tekstin **brenda pajisjes** dhe të nxjerr: **furnitorin, numrin e faturës,
   datën, monedhën** dhe **rreshtat** (artikull · sasi · njësi · çmim).
3. Kontrollon te kutia e skanerit (mund t’i ndryshosh të gjitha), shtyp **Plotëso faturën**
   dhe pastaj **Ruaj faturën**. Skedari i faturës lidhet me dokumentin, një herë.

| Rruga | Kur | Saktësia |
|---|---|---|
| **PDF me tekst** (bills.al, E-Fiskal, fatura nga sistemi i furnitorit) | provohet e para | shumë e lartë — lexohet teksti origjinal, pa OCR |
| **Google Vision** — *lexim i fortë në internet* | foto ose PDF i skanuar, kur ka çelës | shumë e lartë, edhe për tabela të shtrembra; ~1.000 faqe/muaj falas |
| **Tesseract.js** — brenda pajisjes | pa çelës, ose kur leximi i fortë dështon | e mirë për fatura të qarta |
| **Ngjit tekstin** | kur CDN-ja nuk hapet ose OCR-i ngatërron | e njëjta logjikë, tekst i sigurt |

### Leximi i fortë (Google Vision) — i gatshëm, pa konfigurim

**Çelësi është vendosur tashmë në faqe** (`window.GOOGLE_VISION_KEY`), prandaj çdo pajisje e
përdor automatikisht: hap *Skano faturën* dhe skano një foto — nën rezultat shkruan
“U lexua me **Google Vision**”. Për ta kontrolluar me një klik: **Provo çelësin**.

- Kufizoje çelësin te faqja (**HTTP referrers** + vetëm *Cloud Vision API*) — hapi 5 te
  [`UDHEZUES-OCR.md`](UDHEZUES-OCR.md). Pa kufizim, kush e hap faqen mund ta përdorë çelësin.
- Një pajisje mund të vendosë **çelësin e vet** (Ruaj çelësin) ose ta **fikë** fare
  (Fshi çelësin → ajo pajisje lexon vetëm brenda saj, me Tesseract).

Fotoja shkon te Google Vision, i cili kthen **çdo fjalë me koordinatat e saj**; faqja i
grumbullon fjalët sipas rreshtit (y) dhe kolonës (x), prandaj tabela e skanuar del si
tabelë e vërtetë — jo si tekst i përzier. Çelësi vendoset **një herë për pajisje** te
*Skano faturën → Lexim i fortë në internet → Ruaj çelësin* dhe ruhet vetëm në atë browser.

- **Hapat hap pas hapi, kufizimi i çelësit, kuota, privatësia dhe gabimet:** [`UDHEZUES-OCR.md`](UDHEZUES-OCR.md)
- **Provo çelësin** te kutiza e leximit të fortë — dërgon një imazh të vogël prove
  (“REGJISTRI 12345”) dhe të thotë menjëherë në shqip nëse çelësi punon, ose çfarë mungon
  (API e paaktivizuar, faturim, referrer, kuotë).
- Pa çelës (ose me kutizën e fikur) **asgjë nuk del nga pajisja**: lexon Tesseract-i.
- Nëse leximi i fortë dështon (internet, çelës, kuotë), faqja e thotë shkakun në shqip dhe
  kalon vetë te leximi brenda pajisjes — skanimi nuk mbetet bosh.

### Çfarë kupton lexuesi te faturat shqipe

- **Kolonat e PDF-së** rindërtohen sipas koordinatave (x, y): teksti i mbështjellë bashkohet,
  numri i prerë në dy rreshta (`141.666` + `667`) ribashkohet — prandaj rreshtat e
  `NJESIA · SASIA · CMIMI · VLERA PA TVSH · TVSH · VLERA ME TVSH` dalin si tabelë e vërtetë.
- **Rreshtat** njihen me aritmetikë: provohen `sasi × çmim = total`, `sasi × çmim = neto`
  dhe `neto + TVSH = bruto`. Kështu edhe një rresht me 5 numra (sasi, çmim, neto, TVSH, bruto)
  lexohet saktë; çmimi mbetet `0.375` e nuk bëhet `375`.
- **Data** merret nga “Data:” e faturës — **jo** nga “Afati i pagesës” (16.11 ≠ 06.11).
- **Numri i faturës**: `Nr i Fatures: 2683/2026`, `FATURË TATIMORE Nr. F-2026-0412`, `AO-99`…
- **Furnitori**: “Emri i Shitesit / Furnitori / Shitësi” ose emri i njohur nga lista jote.
- **Monedha**: “Monedha: EUR” (edhe kur fatura shfaq edhe totalin në Lekë).
- **Dy faturat e skanuara reale** janë provat kryesore (`tests/fixtures/ark-hotel.txt`,
  `gba-2000.txt`): `ARK HOTEL` → nr. 110514, 31.10.2026, 80 EUR; `GBA … Bioanalytik mbH` →
  nr. 89612026, 11.11.2026, 2.000 EUR (jo 181.800 Lekë nga kursi). `AFRIM DEDEJ`
  (`afrim-dedej.txt`) → nr. 144, 04.11.2026, 83.991,60 Lekë, 2.100 copë × 33,33.
- **Mbeturinat e QR-së / OCR-it** (`1:7051 “Dhome Hotel/Euro “DITE:`) pastrohen: hiqet kodi
  numerik përpara emrit dhe thonjëzat; nëse tabela s'lexohet fare, bëhet **një rresht me
  totalin**, i shënuar qartë si i hamendësuar — ti e ndryshon ose e shton rreshtin.
- **Kontroll totali**: nëse shuma e rreshtave nuk përputhet me totalin e faturës (>1%),
  skaneri të paralajmëron — shenjë se mungon një rresht ose një çmim. Kur fatura ka
  `PA TVSH:` + `TVSH:`, krahasimi bëhet me totalin **pa TVSH**, sepse çmimet e rreshtave
  janë pa TVSH.

- **Pa server:** lexuesi i PDF-së dhe Tesseract-i shkarkohen vetëm herën e parë (~5–8 MB)
  nga CDN-ja dhe punojnë në pajisje; ka edhe CDN rezervë. Leximi i fortë (Google Vision)
  është zgjedhje: pa çelës s’ka kosto dhe s’ka dërgim jashtë pajisjes.
- **Gjithmonë konfirmon njeriu** — asnjë faturë nuk ruhet vetë.
- **Ndryshim fature ekzistuese:** nëse fatura ka rreshta, faqja kërkon konfirmim para se t’i
  zëvendësojë.

## Kur baza nuk përgjigjet (e re)

Faqja nuk mbetet më te “Baza nuk u arrit” pa shpjegim:

- nën krye del një shirit i kuq me **shkakun** (projekt i pezulluar · çelës i
  ndryshuar · tabela që mungojnë · pa internet) dhe me butonat *Provo lidhjen*,
  *Ndrysho lidhjen*, *Shkarko kopje rezervë*;
- te **Të dhënat → Lidhja me bazën** ka hapat e rregullimit dhe detajin teknik;
- *Provo lidhjen* kontrollon edhe bucket-in e faturave: nëse mungon, tabelat mbeten
  “Online” por del paralajmërimi “skedarët e faturave nuk ruhen” me bllokun SQL;
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
| `UDHEZUES-SUPABASE.md` | bazë e re në Supabase: hap pas hapi, kontrolle, gabimet dhe zgjidhjet |
| `UDHEZUES-OCR.md` | leximi i fortë i faturave (Google Vision): çelësi, kuota, privatësia |
| `RREGULLO-LIDHJEN.md` | çdo shkak i “Baza nuk u arrit” + hapat e rregullimit |
| `tests/supabase.test.js` | teston klientin me një Supabase të rremë (12 teste) |
| `tests/lidhja.test.js` | provon sjelljen kur baza s’përgjigjet ose është e pezulluar (7 prova) |
| `tests/skaneri.test.js` | lexuesi i faturës: tekst → fusha → faturë e ruajtur, plus leximi i fortë me Google Vision, prova e çelësit dhe çelësi i faqes (28 prova, me 4 fatura reale — dy prej tyre skanime) |
| `tests/fixtures/fature-bills.txt` | tekst i një PDF-je të vërtetë fiskale (identifikuesit e zëvendësuar) |
| `tests/live.test.js` | provë e vërtetë kundër projektit (7 prova) — `SUPABASE_URL=… SUPABASE_KEY=… node tests/live.test.js` |
| `tests/staf.test.js` | provë me dy “pajisje” kundër bazës reale (17 prova) |
