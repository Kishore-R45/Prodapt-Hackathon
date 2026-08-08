import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
const apiKey =process.env.GEMINI_API_KEY;
;
if (!apiKey) {
  console.warn("[priorityGemini.client] GEMINI_API_KEY is not set. Set it in backend/.env");
}

const genAI = new GoogleGenerativeAI(apiKey ?? "");

const prioritySchema = {
  type: SchemaType.OBJECT,
  properties: {
    contentScore: {
      type: SchemaType.NUMBER,
      description: "0-100 score based purely on message content: escalation language, deadline proximity, whether a direct question needs a response.",
    },
    reasons: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "1-3 short, human-readable reasons for the score (e.g. 'Contains a hard deadline within 24h', 'Direct question awaiting reply').",
    },
    isDirectQuestionNeedingReply: { type: SchemaType.BOOLEAN },
  },
  required: ["contentScore", "reasons", "isDirectQuestionNeedingReply"],
};

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: prioritySchema as any,
  },
});

const SYSTEM_INSTRUCTION = `You are a content-signal scorer inside an email triage system.
Score the given email thread from 0-100 purely on CONTENT — ignore who sent it.
Weigh: genuine escalation language (not marketing "URGENT" bait), deadline proximity
mentioned in the text, and whether it's a direct question awaiting a reply.
Be skeptical of manufactured urgency (sale ends today, act now, limited time).
A calm email with a real same-day deadline should score higher than a loud email with no real ask.
Return ONLY the JSON schema requested.`;

export interface ContentSignalResult {
  contentScore: number;
  reasons: string[];
  isDirectQuestionNeedingReply: boolean;
}

export async function scoreContentSignals(threadText: string): Promise<ContentSignalResult> {
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
    return JSON.parse(raw) as ContentSignalResult;
  } catch (err) {
    throw new Error(`Failed to parse Gemini priority response as structured JSON: ${raw}`);
  }
}
