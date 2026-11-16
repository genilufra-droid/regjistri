/* =====================================================================
   SKANIMI I FATURËS — Edge Function `ocr` (Supabase / Deno)

   Pranon:  POST { image: "<base64 JPEG/PNG>", mime?: "image/jpeg" }
   Kthen:   { text: "<fatura si tekst, rresht për rresht>" }

   Çelësi i leximit rri këtu, si *secret* në Supabase (GEMINI_API_KEY), nuk
   shkon kurrë te telefoni. Prandaj:
     · asnjë pajisje nuk pyetet për çelës,
     · faqja mund të hapet publikisht pa e zbuluar çelësin,
     · ndryshimi i çelësit bëhet vetëm një herë, në server.

   Modeli: Gemini (AI Studio — kuota falas, pa faturim/kartë).
   Ndryshoje me secretin OCR_MODEL (p.sh. gemini-2.5-pro për saktësi më të lartë).
   ===================================================================== */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8'
};

const PROMPT = `Transkripto këtë faturë shqiptare SAKTËSISHT si tekst, rresht për rresht,
nga lart poshtë, duke ruajtur rendin e kolonave majtas→djathtas në secilin rresht
(p.sh. emri i artikullit, njësia, sasia, çmimi, vlera pa TVSH, TVSH, vlera me TVSH).
Rregulla:
- Mos shpik asgjë dhe mos përmbledh. Nëse një fjalë nuk lexohet, shkruaj "?".
- Numrat siç janë shtypur (pika/presja dhjetore si në faturë).
- Mos përfshi tekstin e kodit QR dhe as përshkrimin e tij.
- Kthe vetëm tekstin e faturës, pa komente e pa markdown.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  /* Vetëkontroll me GET (pa harxhuar kuotë): a është vendosur çelësi në server? */
  if (req.method === 'GET') {
    const hasKey = !!Deno.env.get('GEMINI_API_KEY');
    return json({
      ok: true,
      gati: hasKey,
      secret: hasKey ? 'GEMINI_API_KEY ✓' : 'Mungon GEMINI_API_KEY (Secrets)',
      model: Deno.env.get('OCR_MODEL') || 'gemini-2.5-flash',
      perdor: 'POST me { "image": "<base64>", "mime": "image/jpeg" }'
    });
  }
  if (req.method !== 'POST') return json({ error: 'Përdor POST.' }, 405);

  let image = '', mime = 'image/jpeg';
  try {
    const body = await req.json();
    image = String(body?.image || '');
    mime = String(body?.mime || 'image/jpeg');
  } catch (_e) {
    return json({ error: 'Trupi i kërkesës nuk është JSON.' }, 400);
  }
  if (!image) return json({ error: 'Mungon imazhi (image).' }, 400);
  if (image.length > 12_000_000) return json({ error: 'Imazhi është shumë i madh.' }, 413);

  const key = Deno.env.get('GEMINI_API_KEY') || '';
  if (!key) return json({ error: 'Mungon GEMINI_API_KEY (Supabase → Edge Functions → Secrets).' }, 500);
  const model = Deno.env.get('OCR_MODEL') || 'gemini-2.5-flash';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  let r: Response;
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mime, data: image } }
          ]
        }],
        generationConfig: { temperature: 0, maxOutputTokens: 4096 }
      })
    });
  } catch (e) {
    return json({ error: 'Nuk u arrit shërbimi i leximit: ' + String(e) }, 502);
  }

  const raw = await r.text();
  if (!r.ok) {
    let msg = raw;
    try { msg = JSON.parse(raw)?.error?.message || raw; } catch (_e) { /* si është */ }
    const friendly = /API key not valid|API_KEY_INVALID/i.test(msg)
      ? 'Çelësi GEMINI_API_KEY nuk është i vlefshëm.'
      : /quota|RESOURCE_EXHAUSTED/i.test(msg)
        ? 'Kuota e leximit u tejkalua për këtë moment.'
        : msg;
    return json({ error: friendly }, r.status >= 400 && r.status < 600 ? r.status : 502);
  }

  let text = '';
  try {
    const j = JSON.parse(raw);
    const parts = j?.candidates?.[0]?.content?.parts || [];
    text = parts.map((p: { text?: string }) => p?.text || '').join('\n').trim();
  } catch (_e) {
    return json({ error: 'Përgjigje e palexueshme nga Gemini.' }, 502);
  }
  if (!text) return json({ error: 'Gemini nuk lexoi asnjë tekst në këtë foto.' }, 422);
  return json({ text, model });
});

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: CORS });
}
