const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-120b";

const SYSTEM_PROMPT = `You are FemCare+ Assistant, a helpful and friendly AI assistant inside a women's health app.
Answer any question the user asks, clearly and accurately, like a general-purpose assistant.
Keep answers concise and well organised. Use short paragraphs or simple bullet points when helpful.

Health guidance:
- For menstrual, reproductive, and general health questions, give accurate general information and practical self-care tips.
- Do not diagnose. For symptoms that are severe, sudden, persistent, or unusual (for example heavy bleeding, fainting, fever, pain that stops daily life, pain that keeps getting worse, or possible pregnancy complications), advise seeing a qualified doctor.
- For emergencies (chest pain, trouble breathing, heavy bleeding with dizziness, or thoughts of self-harm), tell the user to call 112 right away or get immediate help.
- Never recommend specific prescription doses. Over-the-counter pain relief should follow the instructions on the packet.
- Mention that you are not a substitute for a doctor when it is relevant, not in every reply.

Always reply in the same language the user writes in.

Formatting rules (the app shows plain text, not Markdown):
- Do not use Markdown: no tables, no headers (#), no bold (**), no code fences.
- Use short paragraphs. For lists, start each item on its own line with "- ".
- Keep replies under about 200 words unless the user asks for more detail.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("GROQ_API_KEY");
    if (!apiKey) return json({ error: "GROQ_API_KEY is not set" }, 500);

    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const history = messages
      .filter((m: any) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-12)
      .map((m: any) => ({ role: m.role, content: m.content.slice(0, 4000) }));

    if (history.length === 0) return json({ error: "No messages provided" }, 400);

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
        temperature: 0.6,
        max_tokens: 2048,
        reasoning_effort: "low",
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: "AI service error", detail }, 502);
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    return json({ reply: reply || "Sorry, I could not generate a reply. Please try again." });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});