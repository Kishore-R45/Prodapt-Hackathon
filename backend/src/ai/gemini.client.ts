import "dotenv/config";

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  console.warn("[gemini.client] GROQ_API_KEY is not set. Set it in backend/.env");
}

const SYSTEM_INSTRUCTION = `You are an email thread summarizer inside an inbox assistant.
Summarize the given email thread into 3 to 5 concise bullet points.
Focus on decisions made, commitments given ("I will...", "we agreed to..."),
and open questions still needing an answer. Do NOT just restate what was said —
extract what actually matters for someone who has not read the thread.
Never invent a commitment that was not explicitly stated or clearly implied.
Respond ONLY with valid JSON in this exact shape, nothing else:
{"bullets": ["point 1", "point 2", "point 3"]}`;

/**
 * Calls Groq's OpenAI-compatible chat completions endpoint and returns the bullet list.
 * Same function name/signature as before so summarizer.agent.ts doesn't need to change.
 */
export async function summarizeWithGemini(threadText: string): Promise<string[]> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: `EMAIL THREAD:\n${threadText}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content ?? "";

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.bullets)) {
      throw new Error("Response missing 'bullets' array");
    }
    return parsed.bullets.slice(0, 5);
  } catch (err) {
    throw new Error(`Failed to parse Groq response as structured JSON: ${raw}`);
  }
}