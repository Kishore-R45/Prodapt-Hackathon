import { RawThread, RawMessage, SummaryResult } from "../types/contracts";
import { stripQuotedAndSignature, isEffectivelyEmpty } from "../utils/emailCleaner";
import { summarizeWithGemini } from "../ai/gemini.client";

// Rough char budget per chunk before we hand it to Gemini Flash.
// Flash's context window is huge, but we chunk well before that to keep
// latency/cost predictable per thread — see README 9.2 edge case #1.
const MAX_CHARS_PER_CHUNK = 12000;

/**
 * Formats a single cleaned message for the prompt.
 */
function formatMessage(msg: RawMessage): string {
  const cleanedBody = stripQuotedAndSignature(msg.body);
  return `From: ${msg.from}\nDate: ${msg.date}\nSubject: ${msg.subject}\n\n${cleanedBody}`;
}

/**
 * Splits a long list of formatted messages into chunks under MAX_CHARS_PER_CHUNK,
 * keeping whole messages together (never split a message mid-way).
 */
function chunkMessages(formatted: string[]): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let currentLen = 0;

  for (const msg of formatted) {
    if (currentLen + msg.length > MAX_CHARS_PER_CHUNK && current.length > 0) {
      chunks.push(current);
      current = [];
      currentLen = 0;
    }
    current.push(msg);
    currentLen += msg.length;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * Summarizes a single email thread.
 * Implements every edge case listed in README 9.2:
 *  - single-message thread -> skip, show as-is
 *  - attachment-only thread -> fallback to subject + filename note
 *  - oversized thread -> chunk, summarize each chunk, then summarize the summaries
 *  - quoted/forwarded-heavy thread -> stripped before sending to the model
 *  - multi-language -> left to Gemini natively, no special handling needed
 */
export async function summarizeThread(thread: RawThread): Promise<SummaryResult> {
  const { threadId, messages, hasAttachmentsOnly } = thread;

  // Edge case: attachment-only thread, no text content to summarize.
  if (hasAttachmentsOnly || messages.every((m) => isEffectivelyEmpty(m.body))) {
    const subject = messages[0]?.subject || "(no subject)";
    return {
      threadId,
      summary: [`No text content to summarize — subject only: "${subject}"`],
      meta: { messageCount: messages.length, wasChunked: false, skippedReason: "attachments_only" },
    };
  }

  // Edge case: single-message thread — summarizing one email adds no value.
  if (messages.length === 1) {
    const cleaned = stripQuotedAndSignature(messages[0].body);
    return {
      threadId,
      summary: [cleaned.length > 280 ? cleaned.slice(0, 277) + "..." : cleaned],
      meta: { messageCount: 1, wasChunked: false, skippedReason: "single_message" },
    };
  }

  const formatted = messages.map(formatMessage);
  const chunks = chunkMessages(formatted);

  // Simple case: whole thread fits in one chunk.
  if (chunks.length === 1) {
    const bullets = await summarizeWithGemini(chunks[0].join("\n\n---\n\n"));
    return {
      threadId,
      summary: bullets,
      meta: { messageCount: messages.length, wasChunked: false },
    };
  }

  // Edge case: thread exceeds context budget — hierarchical summarize.
  // Summarize each chunk, then summarize the summaries into the final bullets.
  const chunkSummaries = await Promise.all(
    chunks.map((chunk) => summarizeWithGemini(chunk.join("\n\n---\n\n")))
  );
  const combined = chunkSummaries
    .map((bullets, i) => `Part ${i + 1}:\n${bullets.map((b) => `- ${b}`).join("\n")}`)
    .join("\n\n");
  const finalBullets = await summarizeWithGemini(
    `The following are summaries of consecutive parts of one long email thread. ` +
      `Merge them into a single coherent set of 3-5 bullet points for the whole thread:\n\n${combined}`
  );

  return {
    threadId,
    summary: finalBullets,
    meta: { messageCount: messages.length, wasChunked: true },
  };
}

/** Batch helper — used by the orchestrator to summarize multiple threads at once. */
export async function summarizeThreads(threads: RawThread[]): Promise<SummaryResult[]> {
  return Promise.all(threads.map(summarizeThread));
}
