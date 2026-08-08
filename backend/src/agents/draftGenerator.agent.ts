import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { DraftResult, RawThread } from "../types/contracts";

const DraftResultSchema = z.object({
  tone: z.enum(["formal", "casual"]),
  body: z.string(),
  requiresApproval: z.boolean(),
});

const BACKUP_KEYWORDS = [
  "legal",
  "lawsuit",
  "complaint",
  "terminate",
  "layoff",
  "refund dispute",
  "breach",
  "escalate to management",
];

function checkBackupKeywords(thread: RawThread): boolean {
  const textToScan = [
    thread.subject,
    ...thread.messages.map((m) => `${m.from} ${m.body}`),
  ]
    .join(" ")
    .toLowerCase();

  return BACKUP_KEYWORDS.some((keyword) => textToScan.includes(keyword.toLowerCase()));
}

export async function generateDraft(
  thread: RawThread,
  userDomain: string
): Promise<DraftResult> {
  const tone: "formal" | "casual" =
    thread.senderDomain === userDomain ? "casual" : "formal";

  if (thread.existingDraft != null && thread.existingDraft.trim() !== "") {
    return {
      tone,
      body: thread.existingDraft,
      requiresApproval: true,
      hasExistingDraftConflict: true,
    };
  }

  const isKeywordFlagged = checkBackupKeywords(thread);

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not defined");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const threadMessages = thread.messages
      .map((m) => `From: ${m.from}\nDate: ${m.date}\nBody:\n${m.body}`)
      .join("\n\n---\n\n");

    const prompt = `You are an AI email assistant drafting a reply for an inbox assistant module.
Thread Subject: ${thread.subject}
Desired Tone: ${tone}

Thread Messages:
${threadMessages}

Instructions for reply generation:
1. Address every question asked in the thread, not just the first one.
2. Never fabricate an attachment. If an attachment is referenced or required, insert "⚠️ Remember to attach: [file]" into the draft body text.
3. Keep the reply to between 3 and 6 sentences.
4. Do NOT use markdown formatting in the response body.
5. Return ONLY valid JSON matching this schema:
{
  "tone": "${tone}",
  "body": "string",
  "requiresApproval": boolean
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const rawJson = JSON.parse(text);
    const validated = DraftResultSchema.parse(rawJson);

    return {
      tone: validated.tone || tone,
      body: validated.body,
      requiresApproval: validated.requiresApproval || isKeywordFlagged,
    };
  } catch (error) {
    console.error("Error in draftGenerator agent:", error);
    return {
      tone,
      body: "",
      requiresApproval: true,
    };
  }
}
