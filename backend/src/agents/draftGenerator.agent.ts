import type { RawThread } from "../types/contracts.js";

export function generateDraft(thread: RawThread, tone: "formal" | "casual") {
  const name = thread.from.split(" <")[0] || "there";
  const formal = tone === "formal";

  return {
    tone,
    body: formal
      ? `Hi ${name},\n\nThanks for the note. I reviewed the thread and will confirm the requested next steps shortly. If there is a deadline or attachment you want us to prioritize first, send it over and I will incorporate it.\n\nBest regards,\nInboxPilot`
      : `Hi ${name},\n\nThanks for reaching out. I saw the request and I am checking the details now. I will reply with the next step soon.\n\nBest,\nInboxPilot`,
    requiresApproval: /legal|payment|invoice|contract|sensitive/i.test(thread.subject + " " + thread.snippet)
  };
}