# Udhëzues: leximi i fortë i faturave (Google Vision)

Skaneri i faqes tani ka dy motorë leximi:

| Motori | Kur përdoret | Saktësia |
|---|---|---|
| **PDF me tekst** | gjithmonë i pari për PDF-të me tekst (bills.al, E-Fiskal…) | shumë e lartë — lexohet teksti origjinal |
| **Google Vision** (lexim i fortë, në internet) | foto dhe PDF të skanuara, kur ka çelës | shumë e lartë, edhe për tabela të shtrembra |
| **Tesseract** (brenda pajisjes) | pa çelës, ose kur leximi i fortë dështon | e mirë për fatura të qarta |

Të gjitha rrugët e kalojnë tekstin te i njëjti lexues faturash: furnitori, numri, data,
monedha, rreshtat (sasi × çmim) dhe totali. **Asgjë nuk ruhet vetë** — ti kontrollon dhe
shtyp *Ruaj faturën*.

---

## 1. Merr çelësin (5 minuta, falas)

1. Hap <https://console.cloud.google.com/> dhe hyr me llogarinë e Google-it të punës.
2. Në krye, **Select a project → New project** → emri `regjistri-blerjeve` → **Create**.
3. **APIs & Services → Library** → kërko **Cloud Vision API** → **Enable**.
   *(Nëse Google të kërkon faturimin: kartela lidhet vetëm një herë; kuota falas prej
   1.000 faqesh në muaj nuk faturohet.)*
4. **APIs & Services → Credentials → + Create credentials → API key**.
   Kopjo çelësin që fillon me `AIza…`.

## 2. Kufizoje çelësin (mos e anashkalo)

Në **Credentials → (çelësi yt) → Edit**:

- **Application restrictions** → **HTTP referrers (web sites)** → shto:
  - `https://genilufra-droid.github.io/*`
  - `http://localhost/*` *(vetëm nëse e provon faqen në kompjuter)*
- **API restrictions** → **Restrict key** → zgjidh vetëm **Cloud Vision API** → **Save**.

Kështu, edhe pse çelësi shihet në faqe, askush tjetër nuk mund ta përdorë nga një sajt tjetër.
Nëse ndonjëherë dyshon, krijo çelës të re dhe fshij të vjetrin (**Delete**).

## 3. Vendose në faqe

1. Hap faqen → **Blerjet** → **📷 Skano faturën**.
2. Hap kutinë **“Lexim i fortë në internet (Google Vision)”**.
3. Ngjit çelësin → **Ruaj çelësin**.
   Shfaqet “✓ Leximi i fortë është gati për këtë pajisje.”
4. Lëre të shtypur **“Përdor leximin e fortë kur ka çelës e internet”**.

Çelësi ruhet **vetëm në këtë pajisje/browser** (localStorage), jo në bazë. Për ta hequr:
**Fshi çelësin**. Për çdo pajisje tjetër (telefon, kompjuter i zyrës) bëje të njëjtën gjë një herë.

## 4. Provo

Skano një faturë foto. Nën “U lexua — kontrollo dhe plotëso” duhet të shohësh:

> U lexua me **Google Vision** (lexim i fortë në internet).

Nëse shfaqet “Leximi i fortë s’u krye: …” dhe pastaj “brenda pajisjes (Tesseract)”,
shih tabelën më poshtë — faqja nuk mbetet pa lexim, thjesht përdor motorin rezervë.

## 5. Kuota dhe kostoja

| Zëri | Vlera |
|---|---|
| Falas çdo muaj | **1.000 faqe** (njësi) për *Document Text Detection* |
| Mbi kuotën | rreth **1,5 $ / 1.000 faqe** (Google mund ta ndryshojë çmimin) |
| Faturime të papritura | kufizo kuotën: **APIs & Services → Cloud Vision API → Quotas** → *Requests per day* = 40 |

Për një dyqan me 50–100 fatura në muaj, kuota falas mbulon gjithçka.

## 6. Privatësia

- Fotografia i dërgohet Google-it **vetëm** kur përdoret leximi i fortë.
- Pa çelës ose me kutizën e fikur, gjithçka lexohet **brenda pajisjes** — nuk del asnjë bajt.
- Skedari i faturës ruhet te faturat (Supabase Storage) vetëm kur ti shtyp *Ruaj faturën*.
- Nëse nuk do që çelësi të jetë fare në faqe, alternativa është një *Edge Function* në Supabase
  që e mban çelësin në sekret dhe i shërben faqes si përfaqësues (proxies). Kërkoje kur ta
  vendosim bazën e re.

## 7. Kur diçka nuk shkon

| Mesazhi në faqe | Shkaku | Zgjidhja |
|---|---|---|
| “Çelësi i Google Vision nuk është i vlefshëm…” | çelës i gabuar / i fshirë | krijo çelës të re te Credentials dhe ruaje sërish |
| “API-ja Cloud Vision s’është aktivizuar…” | projekti s’e ka të aktivizuar API-në | Library → Cloud Vision API → Enable |
| “Google-i e refuzoi çelësin (403)…” | kufizimi me referrer nuk e përfshin këtë adresë | shto `https://genilufra-droid.github.io/*` te HTTP referrers |
| “Kuota mujore e leximit u tejkalua…” | mbi 1.000 faqe në muaj | prit muajin tjetër ose hiq kufizimin e kuotës |
| “Fotografia nuk u pranua nga Google-i (400)…” | skedar i dëmtuar / shumë i madh | bëj një foto tjetër (JPG/PNG) |
| “Nuk u arrit shërbimi i leximit (internet?)” | internet i dobët | provo sërish; faqja kalon vetë te Tesseract |
| “Ky nuk duket çelës i Google-it…” | u ngjit diçka tjetër | çelësat e Google-it fillojnë me `AIza` |

## 8. Si punon (për kureshtarë)

Google Vision kthen **çdo fjalë me koordinatat e saj**. Faqja i grumbullon fjalët sipas
y-së (i njëjti rresht) dhe i radhit sipas x-së — kështu kolonat e një tabele të skanuar
(artikull · sasi · çmim · total) mbeten në **një rresht** edhe pse shërbimi i kthen si
blloqe të veçanta. Nga aty, i njëjti lexues që përdoret për PDF-të provon aritmetikën
`sasi × çmim = total`, `neto + TVSH = bruto` dhe nxjerr totalin e faturës në monedhën e saj.
