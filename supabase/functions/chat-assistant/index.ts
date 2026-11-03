const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-120b";

const SYSTEM_PROMPT = `You are the FemCare+ Assistant inside a menstrual and women's health app. Every question is about that context unless clearly not.

UNDERSTANDING THE QUESTION
- Users write in English, Kannada (ಕನ್ನಡ) or mixed Kannada-English. First work out the real health topic and intent, then answer only that.
- Kannada terms: ಮುಟ್ಟು, ಮುಟ್ಟಿನ, ಮುಟ್ಟಾಗು, ಋತುಸ್ರಾವ, ಮಾಸಿಕ ಧರ್ಮ, ಪಿರಿಯಡ್ಸ್ = menstruation (period). ಋತುಚಕ್ರ = menstrual cycle. ಹೊಟ್ಟೆ ನೋವು = abdominal pain. ರಕ್ತಸ್ರಾವ = bleeding. ಮುಟ್ಟಿನ ನೋವು = menstrual cramps. ಮುಟ್ಟು can also mean "touch", but in this app it means menstruation unless the sentence is clearly about touching something.
- Menstrual cramps are NEVER pain during sex. Discuss intercourse-related pain only if the user explicitly mentions it (ಸಂಭೋಗ, ಲೈಂಗಿಕ, sex, intercourse).
- If the question is genuinely ambiguous, ask ONE short clarifying question in the user's language and nothing else.
- For topics unrelated to health, politely say you help with period and women's health topics.

ANSWER STYLE
- Direct, concise (under about 150 words), simple everyday words. Answer the question first.
- Use short headings and "- " bullets only when they help. No tables, no # headers, no code blocks, no bold markers.
- Reply in the language of the user's latest message. For Kannada script or Kannada written in English letters, reply in simple Kannada script, keeping common English words (heating pad, ibuprofen) as they are.
- Add a one-line "general information, not a diagnosis" note only when giving health advice, and never repeat it.

MEDICAL RULES
- Follow mainstream guidance (NHS, ACOG, WHO). If unsure, say so. Never invent remedies, statistics, sources or links. Never cite a source you cannot verify.
- Menstrual cramps: heat on the lower belly (heating pad or hot water bottle wrapped in cloth, warm bath), gentle movement (walking, stretching, yoga), rest, light lower-belly massage. Over-the-counter pain relief (for example ibuprofen or paracetamol) only as written on the packet; people with asthma, stomach ulcers, kidney problems, pregnancy or other medicines should ask a pharmacist or doctor first. Do not give dose numbers.
- Never recommend herbal mixtures, vaginal applications, douching or unverified treatments. If asked about a specific home remedy, say honestly when evidence is limited.
- Never diagnose (for example PCOS or endometriosis). You may say a doctor can check.
- Advise seeing a doctor for: pain not relieved by heat or pain relief, pain that stops daily activities, pain that is new or getting worse, very heavy bleeding (soaking a pad or tampon every 1-2 hours for several hours, large clots), fever, fainting, possible pregnancy, pain outside periods, or pain with sex.
- Emergencies (severe sudden pain, heavy bleeding with dizziness or fainting, severe pain or bleeding with possible pregnancy, chest pain, trouble breathing, thoughts of self-harm): tell the user to call 112 or get immediate help.
- You are not a replacement for a doctor.
- Do not ask for names, phone numbers or other personal details.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function isSignedIn(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!auth || !url || !anon) return false;
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: auth, apikey: anon } });
    return r.ok;
  } catch {
    return false;
  }
}

async function callGroq(apiKey: string, payload: unknown) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25000),
      });
      if (res.ok || (res.status !== 429 && res.status < 500)) return res;
      console.error("groq status", res.status);
    } catch {
      console.error("groq request failed or timed out");
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!(await isSignedIn(req))) return json({ error: "unauthorized" }, 401);

    const apiKey = Deno.env.get("GROQ_API_KEY");
    if (!apiKey) return json({ error: "not_configured" }, 500);

    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const history = messages
      .filter((m: any) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-12)
      .map((m: any) => ({ role: m.role, content: m.content.slice(0, 4000) }));

    if (history.length === 0) return json({ error: "no_messages" }, 400);

    const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
    const hints: string[] = [];
    if (/[\u0C80-\u0CFF]/.test(lastUser)) hints.push("The latest user message is in Kannada script. Reply in Kannada.");
    if (/ಮುಟ್ಟ|ಋತುಸ್ರಾವ|ಋತುಚಕ್ರ|ಮಾಸಿಕ ಧರ್ಮ|ಪಿರಿಯ|ಪೀರಿಯ/.test(lastUser)) {
      hints.push("Topic hint: the user is most likely asking about menstruation (periods); ಮುಟ್ಟು here means period, not touch. Any pain mentioned is menstrual cramps unless intercourse is explicitly mentioned.");
    }

    const res = await callGroq(apiKey, {
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...(hints.length ? [{ role: "system", content: hints.join(" ") }] : []),
        ...history,
      ],
      temperature: 0.3,
      max_tokens: 2048,
      reasoning_effort: "medium",
    });

    if (!res || !res.ok) return json({ error: "ai_unavailable" }, 502);

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return json({ error: "empty_reply" }, 502);
    return json({ reply });
  } catch {
    return json({ error: "server_error" }, 500);
  }
});