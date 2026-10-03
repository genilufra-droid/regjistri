# Provë me dy punonjës — përgjigje pyetjeve të tua

**Data:** 3 tetor 2026 · **Baza:** `vikcvnioouxnchwrnahk.supabase.co` · **Faqja:** https://genilufra-droid.github.io/regjistri/

Testi hap **të njëjtin kod që ndodhet në faqen publike** dy herë — si dy pajisje të ndryshme (Stafi A dhe Stafi B) — dhe i lidh me bazën e vërtetë. Një lidhje e tretë, e pavarur, shërben si dëshmitar: ajo kontrollon se çfarë ka **vërtet** në server, pa besuar atë që tregon ekrani.

Komanda: `SUPABASE_URL=… SUPABASE_KEY=… node tests/staf.test.js`

---

## 1. A ruhen të dhënat në server?

**Po.** Asgjë nuk mbetet në shfletues.

| Prova | Rezultati |
|---|---|
| Stafi A regjistron blerjen nga formulari (me faturë) | ✅ 611 ms |
| Blerja gjendet në server nga lidhja e tretë e pavarur | ✅ pas 1,65 s |
| Çmimi, data, sasia, personi që bleu — të ruajtura saktë | ✅ |
| Furnitori i ri: telefon, qytet, adresë, lokacion | ✅ të katërta |
| **Pajisje e tretë, link i hapur rishtas, e sheh blerjen** | ✅ 302 ms |

Prova e fundit është dëshmia kryesore: një pajisje që **nuk ka qenë kurrë e hapur më parë** i sheh të dhënat — pra ato rrinë në server, jo në kujtesën e shfletuesit. Fshirja e historisë, ndërrimi i telefonit ose i kompjuterit nuk ndryshon asgjë.

### Si ruhen konkretisht kur regjistrohen

1. Shtyp **Ruaj** te formulari i blerjes.
2. Faqja llogarit *vetëm atë që ndryshoi* (blerja e re + furnitori i ri nëse s'ekziston) — nuk rishkruan gjithë regjistrin.
3. Fatura (foto/PDF) ngarkohet veçmas te depoja e skedarëve dhe te blerja ruhet vetëm lidhja me të.
4. Shkrimi shkon në tabelat `purchases`, `suppliers`, `products` në Postgres. Çdo rresht ka `id` unike dhe `updatedAt`.
5. Serveri njofton **menjëherë** çdo pajisje tjetër të hapur.
6. Shenja lart djathtas tregon gjendjen: *Po ruhet… → Online · live*.

Nëse interneti bie në mes: shenja bëhet e kuqe, ndryshimi **nuk humbet** — rri në radhë dhe ruhet vetë sapo kthehet lidhja (e provuar te `tests/supabase.test.js`).

---

## 2. A sinkronizohet në kohë reale mes stafit që ka linkun?

**Po, në të dy drejtimet, rreth 1 sekondë.**

| Prova | Rezultati |
|---|---|
| Stafi A regjistron → Stafi B e sheh pa prekur asgjë | ✅ **1,10 s** |
| Stafi B regjistron → Stafi A e sheh pa prekur asgjë | ✅ **1,10 s** |
| Kërkimi te B e gjen me furnitor, datë, çmim, personin që bleu | ✅ |
| Fshirja te A → ekrani i B pastrohet vetvetiu | ✅ 0,51 s |
| Rikthimi nga kopja rezervë → B i sheh të rikthyera | ✅ 0,60 s |

Askush nuk ka nevojë të shtypë F5. Plus, si rrjetë sigurie, çdo pajisje kontrollon heshturazi një herë në minutë (nuk ndërhyn kur ke një formë të hapur).

---

## 3. A punon reset-i?

**Po — dhe tani edhe gabimi që raportove është zhdukur.**

| Prova | Rezultati |
|---|---|
| “Fshi gjithçka” nga A e zbraz serverin | ✅ 0,84 s |
| Ekrani i B zbrazet live | ✅ 0,51 s |
| **Pajisje e re nuk i rikthen shembujt** | ✅ (më parë ❌) |

> Kujdes: reset-i fshin për **të gjithë stafin**, menjëherë. Bëj kopje rezervë para se ta përdorësh.

---

## 4. A punon kopja rezervë (backup)?

**Po, në të dy drejtimet.**

| Prova | Rezultati |
|---|---|
| **Shkarko JSON** nxjerr gjithçka (blerje, furnitorë, artikuj) | ✅ kopje e plotë |
| **Ngarko JSON** e rikthen gjithçka në server | ✅ 1,44 s |
| Pas rikthimit, edhe pajisjet e tjera i shohin | ✅ 0,60 s |

Testi e provoi ciklin e plotë: kopje → fshij gjithçka → rikthe kopjen → numrat përputhen.

**E vetmja gjë që JSON-i nuk e përmban: skedarët e faturave** (foto/PDF). Ato rrinë në depon e skedarëve të Supabase dhe nuk fshihen me “Fshi gjithçka”… por fshihen nëse e përdor butonin që pastron edhe skedarët. Për një kopje të plotë të faturave, shkarkimi bëhet nga paneli i Supabase → Storage → `fatura`.

**Këshillë:** shkarko JSON një herë në javë dhe ruaje në Drive ose në kompjuter. Zgjat 5 sekonda.

---

## Përmbledhje

**17 prova · 17 ✅ · 0 ❌**

Gjendja e bazës tani: **bosh** — e ke fshirë ti dhe ka mbetur e fshirë (shembujt nuk u rikthyen, pikërisht siç duhet). Regjistro blerjen e parë të vërtetë kur të duash.

| Pyetja jote | Përgjigjja |
|---|---|
| Ruan në server? | Po — Postgres + depo skedarësh, asgjë në shfletues |
| Bën reset? | Po — dhe tani pa rikthimin e shembujve |
| Bën backup? | Po — shkarkim dhe rikthim, të dyja të provuara |
| Sinkronizon në kohë reale mes stafit? | Po — ~1 sekondë, në të dy drejtimet |
| Si ruhen kur regjistrohen? | Vetëm ndryshimi shkon në server, fatura veçmas, të tjerët njoftohen menjëherë |
