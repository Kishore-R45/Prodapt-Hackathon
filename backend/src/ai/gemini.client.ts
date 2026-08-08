import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  // Fail loud at import time in dev — better than a confusing 500 mid-demo.
  console.warn("[gemini.client] GEMINI_API_KEY is not set. Set it in backend/.env");
}

const genAI = new GoogleGenerativeAI(apiKey ?? "");

const summarySchema = {
  type: SchemaType.OBJECT,
  properties: {
    bullets: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "3 to 5 bullet points capturing decisions, commitments, and open questions.",
    },
  },
  required: ["bullets"],
};

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: summarySchema as any,
  },
});

const SYSTEM_INSTRUCTION = `You are an email thread summarizer inside an inbox assistant.
Summarize the given email thread into 3 to 5 concise bullet points.
Focus on decisions made, commitments given ("I will...", "we agreed to..."),
and open questions still needing an answer. Do NOT just restate what was said —
extract what actually matters for someone who has not read the thread.
Never invent a commitment that was not explicitly stated or clearly implied.
Return ONLY the JSON schema requested, nothing else.`;

/**
 * Calls Gemini Flash with structured output mode and returns the raw bullet list.
 * Throws on API failure — caller (summarizer.agent.ts) decides fallback behavior.
 */
export async function summarizeWithGemini(threadText: string): Promise<string[]> {
  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: `${SYSTEM_INSTRUCTION}\n\n---\n\nEMAIL THREAD:\n${threadText}` }],
      },
    ],
  });

  const raw = result.response.text();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.bullets)) {
      throw new Error("Response missing 'bullets' array");
    }
    return parsed.bullets.slice(0, 5);
  } catch (err) {
    throw new Error(`Failed to parse Gemini response as structured JSON: ${raw}`);
  }
}
