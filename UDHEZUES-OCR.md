# Udhëzues: leximi i fortë i faturave me Google Vision

> **Gjendja: çelësi është i vendosur në faqe.** Leximi i fortë punon automatikisht në çdo
> pajisje; hapat 1–6 poshtë i ke bërë tashmë. **Të mbetura për ty: Hapi 5 (kufizimi i
> çelësit) nëse s’e ke bërë, dhe Hapi 7 (prova me një faturë).** Hapat 1–4 mbeten këtu si
> referencë (p.sh. kur krijohet çelës i re).

Skaneri ka dy motorë leximi: leximin e fortë (Google Vision) dhe Tesseract brenda pajisjes.

| Motori | Kur përdoret | Saktësia |
|---|---|---|
| **PDF me tekst** | gjithmonë i pari për PDF-të me tekst (bills.al, E-Fiskal…) | shumë e lartë — teksti origjinal, pa OCR |
| **Google Vision** | foto dhe PDF të skanuara, kur ka çelës | shumë e lartë, edhe për tabela të shtrembra e kode QR |
| **Tesseract** (në pajisje) | pa çelës, ose kur leximi i fortë dështon | e mirë për fatura të qarta |

Kohë: **10–12 minuta**. Kosto: **0 €** për deri në **1.000 faqe në muaj** (kuota falas
përsëritet çdo muaj). Duhet një llogari Google dhe një kartë (vetëm për verifikim — nuk
faturohesh brenda kuotës).

> **Rendi ka rëndësi:** pa **faturimin e aktivizuar**, Google e kthen çelësin me gabim
> 403 edhe pse API-ja duket “e aktivizuar”. Prandaj Hapi 3 nuk anashkalohet.

---

## Hapi 1 — Krijo projektin (2 minuta)

1. Hap <https://console.cloud.google.com/> me llogarinë Google të punës.
2. Në shiritin e sipërm shtyp kutinë e projektit (**Select a project**) → **New project**.
3. **Project name:** `regjistri-blerjeve` → **Create** → prit 20 sekonda → zgjidhe nga e
   njëjta listë (lart duhet të shkruajë `regjistri-blerjeve`).

## Hapi 2 — Aktivizo Cloud Vision API (1 minutë)

1. Menyja ☰ → **APIs & Services → Library**.
2. Kërko `Cloud Vision` → zgjidh **Cloud Vision API** (jo “Vision AI” / jo “Document AI”).
3. **Enable** → prit derisa butoni të bëhet **Manage**.

## Hapi 3 — Aktivizo faturimin (2 minuta, i detyrueshëm)

1. Menyja ☰ → **Billing** → **Link a billing account** / **Create billing account**.
2. Plotëso: shtet (Shqipëri), emër, kartë (Visa/Mastercard). Ndryshimi i kartës bëhet vetëm
   një herë; faqja e Google-it nuk e ruan nga ana e regjistrit.
3. **Kthehu te projekti** dhe sigurohu që në krye shkruan emrin e projektit, jo të llogarisë.

### Kufi sigurie (30 sekonda — bëje patjetër)

1. ☰ → **Billing → Budgets & alerts → Create budget**.
2. **Name:** `kufi-vision` · **Budget amount:** `1` EUR · **Next**.
3. Tek alerts vendos 50% / 90% / 100% → **Finish**.

Kështu, edhe sikur diçka shkoj keq, nuk shpenzon më shumë se 1 € pa të ardhur njoftimi.
(Për 100 fatura në muaj, shpenzimi real është **0 €** — brenda kuotës falas.)

## Hapi 4 — Krijo çelësin (1 minutë)

1. ☰ → **APIs & Services → Credentials**.
2. Lart: **+ Create credentials → API key**.
3. Kopjo çelësin që shfaqet (fillon me `AIza…`, ~39 shkronja) → **Close**.

> Mos zgjidh “Service account”, “OAuth client ID” apo “API key (legacy)” — vetëm **API key**.

## Hapi 5 — Kufizo çelësin (1 minutë, i rëndësishëm)

Shtyp **Edit** mbi çelësin e krijuar:

1. **Application restrictions** → zgjidh **Websites (HTTP referrers)** → **Add**:
   ```
   https://genilufra-droid.github.io/*
   ```
   *(opsionale, për prova në kompjuter: `http://localhost/*`)*
2. **API restrictions** → **Restrict key** → shëno vetëm **Cloud Vision API**.
3. **Save** → prit 1–2 minuta që kufizimi të hyjë në fuqi.

Pa këtë hap, çelësi punon edhe po ta marrë dikush tjetër; me këtë hap, punon **vetëm** nga
faqja jote.

## Hapi 6 — Vendose në faqe (✅ kryer: çelësi është në faqe)

Çelësi është në `docs/index.html` si `window.GOOGLE_VISION_KEY`, prandaj çdo pajisje e përdor
pa konfigurim. Hapat poshtë janë për rastin kur do një çelës **tëndin** në një pajisje të
veçantë, ose do ta fikësh leximin e fortë atje.

1. Hap <https://genilufra-droid.github.io/regjistri/> → **Blerjet** → **📷 Skano faturën**.
2. Hap kutinë **“Lexim i fortë në internet (Google Vision)”**.
3. Ngjit çelësin → **Ruaj çelësin** → shfaqet *“✓ Leximi i fortë është gati për këtë pajisje.”*
4. Shtyp **Provo çelësin** ← **prova më e shpejtë**:
   - **✓ Çelësi punon: Google Vision lexoi testin (“REGJISTRI 12345”).** → gati.
   - **✗ …** → shih tabelën e gabimeve më poshtë; mesazhi e thotë shkakun në shqip.
   *(Prova harxhon 1 njësi nga kuota — mjafton ta bësh një herë.)*
5. Lëre të shtypur **“Përdor leximin e fortë kur ka çelës e internet”**.

Çelësi i futur kështu ruan **vetëm në atë pajisje/browser** (localStorage) dhe zëvendëson
çelësin e faqes. **Fshi çelësin** e fik leximin e fortë vetëm për atë pajisje (kthehet te
Tesseract); për t’u kthyer te çelësi i faqes, fshij edhe një herë të dhënat e faqes ose
vendos çelësin e faqes me “Ruaj çelësin”.

## Hapi 7 — Prova me faturë të vërtetë (2 minuta)

1. **Skano faturën** → zgjidh `BIOBES OCT.pdf` (ose një foto të faturës).
2. Nën “U lexua — kontrollo dhe plotëso” duhet të shkruajë:
   > U lexua me **Google Vision** (lexim i fortë në internet).
3. Kontrollo: furnitori `ARK HOTEL`, nr. `110514`, data `31.10.2026`, monedha Euro, totali `80`.
4. **Plotëso faturën** → **Ruaj faturën**.

Nëse del “brenda pajisjes (Tesseract)” ose një shirit “Leximi i fortë s’u krye: …”, shkaku
është në tabelën e gabimeve — faqja nuk mbetet pa lexim, thjesht përdor motorin rezervë.

---

## Kuota dhe kostoja

| Zëri | Vlera |
|---|---|
| Falas çdo muaj | **1.000 njësi** (faqe) për *Document Text Detection*; përsëritet çdo muaj |
| Mbi kuotën | rreth **1,5 $ / 1.000 faqe** |
| Sa harxhon një faturë | **1 njësi** (një kërkesë, një veçori) |
| 100 fatura në muaj | **0 €** |
| Kufi i rekomanduar | budget alert 1 € (Hapi 3) ose *Quotas → Requests per day = 40* |

## Privatësia

- Fotografia i dërgohet Google-it **vetëm** kur përdoret leximi i fortë.
- Pa çelës, ose me kutizën e fikur, gjithçka lexohet **brenda pajisjes** — nuk del asnjë bajt.
- Skedari i faturës ruhet te Supabase (bucket-i `fatura`) vetëm kur ti shtyp *Ruaj faturën*.
- Faqja nuk ruan tekstin e faturës askund tjetër; çelësi rri vetëm në pajisje.

## Kur diçka nuk shkon

| Mesazhi në faqe | Shkaku i vërtetë | Zgjidhja |
|---|---|---|
| “Çelësi i Google Vision nuk është i vlefshëm…” (`API key not valid`) | çelës i gabuar, i fshirë ose i kopjuar pjesërisht | Credentials → kopjo sërish çelësin e plotë (`AIza…`) → Ruaj → Provo |
| “API-ja Cloud Vision s’është aktivizuar…” (`SERVICE_DISABLED`) | projekti s’e ka API-në të aktivizuar | Library → Cloud Vision API → **Enable** |
| “Projekti i Google-it kërkon faturimin e aktivizuar…” | **pa faturim** — gabimi më i shpeshtë | Billing → link a billing account (Hapi 3) |
| “Google-i e refuzoi çelësin (403)…” | kufizimi me referrer nuk e njeh faqen | Credentials → Edit → HTTP referrers → shto `https://genilufra-droid.github.io/*` (prit 1–2 min) |
| “Kuota mujore e leximit u tejkalua…” (429) | 1.000 faqe u harxhuan ose *Requests per day* i ulët | prit muajin tjetër ose rrit kuotën te **Quotas** |
| “Fotografia nuk u pranua nga Google-i (400)…” | skedar i dëmtuar / shumë i madh / format i panjohur | bëj një foto të re JPG ose PNG |
| “Nuk u arrit shërbimi i leximit (internet?)” | internet i dobët ose bllokues | provo sërish; faqja kalon vetë te Tesseract |
| “Ky nuk duket çelës i Google-it…” (kur ruaj) | u ngjit diçka tjetër | çelësat e Google-it fillojnë me `AIza`; kopjo nga *Credentials* |
| Asnjë gabim, por gjithmonë “brenda pajisjes” | kutiza *Përdor leximin e fortë* e fikur ose çelësi i fshirë | hap kutizën dhe **Ruaj çelësin** sërish |

**Nëse nuk je i sigurt ku je:** në krye të console.cloud.google.com duhet të shkruajë
`regjistri-blerjeve`. Shumica e gabimeve vijnë nga projekti tjetër i zgjedhur.

## Si punon (për kureshtarë)

Google Vision kthen **çdo fjalë me koordinatat e saj**. Faqja i grumbullon fjalët sipas
y-së (i njëjti rresht) dhe i radhit sipas x-së, kështu kolonat e një tabele të skanuar
(artikull · sasi · çmim · total) mbeten në **një rresht** edhe pse shërbimi i kthen si
blloqe të veçanta. Nga aty, i njëjti lexues që përdoret për PDF-të provon aritmetikën
`sasi × çmim = total` dhe nxjerr totalin në monedhën e faturës (jo në Lekë nga kursi).

## Alternativa: çelësi të mos jetë fare në faqe

Sot çelësi rri në browserin e pajisjes. Nëse do që as ai të mos shihet (dhe të mos
përsëritet për çdo telefon), mund të vendoset një **Edge Function** në Supabase që e mban
çelësin si *secret* në server dhe i shërben faqes si përfaqësues (proxy). Kërkoje kur të duash
dhe e ndërtoj: ndryshimi për ty bëhet vetëm një herë te *Supabase → Edge Functions → Secrets*
(`GOOGLE_VISION_KEY`), pa ngjitur çelës në asnjë pajisje.
