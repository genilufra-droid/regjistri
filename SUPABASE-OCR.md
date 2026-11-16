# Leximi i faturave në server (çelësi nuk shkruhet më në asnjë pajisje)

## Pse ky udhëzues

Në pamjen e skanerit u shfaq:

> **Leximi i fortë s’u krye:** Projekti i Google-it kërkon faturimin e aktivizuar (edhe për kuotën falas).

Domethënë çelësi i Google Vision është i saktë, por **projekti i Google-it s’ka faturim
(Billing)**. Google nuk e lejon Vision-in pa të — edhe për 1.000 faqet falas. Ka dy rrugë:

| Rruga | Çfarë duhet | Kosto |
|---|---|---|
| **A. Aktivizo faturimin te Google** | kartë te Google Cloud → Billing | 0 € brenda 1.000 faqeve/muaj |
| **B. Lexim në server me Gemini** (ky udhëzues) | çelës **falas** nga AI Studio, pa kartë | 0 € |

Dhe në të dyja rastet vlen kërkesa jote: **çelësi rri në server, jo në telefon.** Për rrugën B
kjo bëhet me një *Edge Function* në Supabase — pikërisht ajo që është përgatitur në
[`supabase/functions/ocr/index.ts`](supabase/functions/ocr/index.ts).

---

## Rruga B — 6 minuta, pa kartë

### 1. Merr çelësin falas të Gemini

1. Hap <https://aistudio.google.com/apikey> me llogarinë Google.
2. **Create API key** → zgjidh një projekt (ose **Create project**) → kopjo çelësin
   (`AIza…` ose `AQ.…`).
3. Nuk kërkohet kartë dhe nuk kërkohet faturim. Kuota falas mbulon me dhjetëra fatura në ditë.

### 2. Vendose si *secret* në Supabase

1. Supabase → projekti `vikcvnioouxnchwrnahk` → **Edge Functions** → **Secrets**
   (ose *Project Settings → Edge Functions → Secrets*).
2. **Add new secret**:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** çelësi që kopjove
3. **Save**. *(Opsionale: `OCR_MODEL` = `gemini-2.5-pro` për saktësi më të lartë.)*

### 3. Deploy funksionin `ocr`

**Me panelin (më e thjeshta):**

1. Supabase → **Edge Functions** → **Deploy a new function** → **Via editor**.
2. **Name:** `ocr` (saktësisht `ocr`).
3. Fshi përmbajtjen shembull dhe ngjit **gjithë** skedarin
   [`supabase/functions/ocr/index.ts`](supabase/functions/ocr/index.ts) → **Deploy**.

**Me CLI (nëse e ke të instaluar):**

```bash
supabase functions deploy ocr --project-ref vikcvnioouxnchwrnahk
```

> Mos e shëno si *private* me verifikim JWT të çaktivizuar: faqja dërgon çelësin publik
> (`apikey`), i cili mjafton për verifikim. Nëse e lë `--no-verify-jwt`, funksioni hapet
> për këdo — jo i rekomanduar.

### 3b. Lëre funksionin të pranojë kërkesat e faqes (1 minutë)

Funksioni i ri vjen me **“Verify JWT” të ndezur**, dhe faqja dërgon çelësin **publik**
(`sb_publishable_…`), që nuk është JWT — prandaj përgjigjja do të ishte
`401 Unauthorized`. Kontrolluar më 16.11.2026: `GET /functions/v1/ocr` kthen
`{"code":"UNAUTHORIZED_NO_AUTH_HEADER"}`, pra funksioni ekziston, por kërkon autorizim.

**Zgjidhja:** Supabase → **Edge Functions → ocr → Settings** → kalo **Verify JWT** në
**OFF** (ose, me CLI, deploy me `--no-verify-jwt`) → **Save**.

> Funksioni bëhet i hapur për këdo që e ka URL-në. Rreziku i vetëm është harxhimi i kuotës
> falas të Gemini-t (jo faturë). Nëse do ta mbyllim, thuamë dhe i shtoj një kontroll
> `apikey` + kufi kërkesash brenda funksionit.

### 3c. Vetëkontroll me një link (pa harxhuar kuotë)

Hap në shfletues (edhe në telefon):

```
https://vikcvnioouxnchwrnahk.supabase.co/functions/v1/ocr
```

Duhet të shfaqet diçka si:

```json
{"ok":true,"gati":true,"secret":"GEMINI_API_KEY ✓","model":"gemini-2.5-flash","perdor":"POST me …"}
```

- `gati: true` → funksioni është vendosur, është i hapur dhe çelësi ekziston. Gati për skanim.
- `gati: false` → mungon sekreti → hapi 2.
- `UNAUTHORIZED_NO_AUTH_HEADER` → **Verify JWT** ende i ndezur → hapi 3b.
- `Requested function was not found` → funksioni nuk u vendos / emri ndryshe → hapi 3.
- `{"error":"Përdor POST."}` → **funksioni punon**, por është versioni i vjetër (pa vetëkontrollin
  me GET). Nuk pengon skanimin; për të marrë edhe vetëkontrollin, ribëj deploy-in me kodin e ri:
  Edge Functions → `ocr` → fshi përmbajtjen → ngjit `supabase/functions/ocr/index.ts` → **Deploy**.

### 4. Provoje funksionin (pa faqe)

Supabase → **Edge Functions → ocr → Test** ose me `curl`:

```bash
curl -sS "https://vikcvnioouxnchwrnahk.supabase.co/functions/v1/ocr" \
  -H "apikey: sb_publishable_WY0dvvMh-ZBdpSwEXMN8JQ_I5iyTZmN" \
  -H "Authorization: Bearer sb_publishable_WY0dvvMh-ZBdpSwEXMN8JQ_I5iyTZmN" \
  -H "Content-Type: application/json" \
  -d '{"image":"<base64 i një fotoje>","mime":"image/jpeg"}'
```

Pritshmëria: `{"text":"…fatura si tekst…"}`. Nëse del gabim, mesazhi është në shqip
(p.sh. *“Mungon GEMINI_API_KEY …”*).

### 5. Ndez në faqe (✅ kryer: `window.OCR_SERVER = true`)

Te `docs/index.html` rreshti është ndezur. Nga ai moment faqja:

1. **PDF me tekst** → lexohet drejt (si më parë);
2. **foto / PDF i skanuar** → shkon te funksioni `ocr` (Gemini në server);
3. nëse serveri nuk përgjigjet → Google Vision me çelësin e faqes;
4. nëse edhe ai dështon → Tesseract **brenda pajisjes** (gjithmonë rezervë).

Nën rezultat shfaqet vetëm një rresht: *“U lexua me shërbimin e leximit në server.”*

### 6. Prova

Skano `BIOBES OCT.pdf` → prit `ARK HOTEL` / `110514` / `31.10.2026` / `80 EUR`.
Skano `GBA PARAPAGES…pdf` → prit `GBA … Bioanalytik mbH` / `89612026` / `2.000 EUR`.

---

## Çfarë hoqëm nga faqja

Sipas kërkesës “hiqi shënimet, lëre vetëm skano faturën”:

- kutiza e çelësit (Ruaj / Provo / Fshi çelësin) **u hoq** — nuk shkruhet më çelës në 20 pajisje;
- shënimet e gjata nën rezultat **u hoqën**; mbeti vetëm një rresht me burimin e leximit;
- paralajmërimi i gjatë për rreshtat e pahamendshëm u hoq (rreshti shihet vetë te tabela).

## Siguria

- Çelësi i Gemini-t **nuk shkon kurrë te telefoni**: rri te Supabase Secrets dhe përdoret
  vetëm brenda funksionit.
- Funksioni pranon vetëm `POST` me imazh; nuk ruan asgjë (pa storage, pa log të përmbajtjes).
- Nëse do kufizim më të rreptë, mund të kontrollohet `apikey` i faqes brenda funksionit ose të
  vendoset një *rate limit*; thuamë nëse e do.

## Kostoja

| Shërbimi | Falas | Mbi kuotën |
|---|---|---|
| Gemini (AI Studio, `gemini-2.5-flash`) | kuotë falas ditore/mujore, pa kartë | shumë e ulët për fatura (centat) |
| Google Vision (nëse aktivizon faturimin) | 1.000 faqe/muaj | ~1,5 $ / 1.000 |
| Tesseract në pajisje | pa kufi | 0 € |

## Nëse nuk shkon

| Çfarë shfaqet | Shkaku | Zgjidhja |
|---|---|---|
| *“Shërbimi i leximit nuk u gjet në server”* (404) | funksioni s’është deployuar, ose emri nuk përputhet | hapi 3 — emri saktësisht `ocr`. Faqja provon vetë edhe `scan-ocr`, `ocr-invoice`, `invoice-ocr`, `skaner`, `scan` dhe mban mend atë që përgjigjet; mund ta fiksosh edhe me `window.OCR_SLUG = 'emri-yt'` |
| *“Serveri s’ka çelësin e leximit (GEMINI_API_KEY …)”* | sekreti mungon | hapi 2 |
| *“Çelësi GEMINI_API_KEY nuk është i vlefshëm”* | çelës i gabuar/i fshirë | krijo çelës të re te AI Studio dhe përditëso sekretin |
| *“Kuota e leximit u tejkalua për këtë moment”* | shumë kërkesa brenda minutës/ditës | prit pak ose përdor `gemini-2.5-flash` (më i lirë) |
| *“Serveri nuk e pranoi kërkesën (401/403)”* | funksioni ka **Verify JWT** të ndezur | Edge Functions → ocr → Settings → Verify JWT = **OFF** → Save (hapi 3b) |
| “brenda pajisjes” + arsyeja | serveri dështoi; arsyeja shkruhet shkurt në vetë rreshtin e rezultatit | shih tabelën më sipër |
| Funksioni kthen tekst, por fushat dalin keq | modeli lexoi, por formati i tabelës ndryshon | dërgo një foto të faturës dhe e rregulloj parserin |
