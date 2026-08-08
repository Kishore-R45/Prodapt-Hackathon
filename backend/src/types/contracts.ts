// Mirrors extension/shared/types.ts (Section 7 of the README API contract).
// Only the pieces the summarizer agent needs to know about live here.

export interface RawMessage {
  id: string;
  from: string;
  to: string[];
  date: string;          // ISO 8601 — the email's Date header
  subject: string;
  body: string;           // raw text/plain or text/html-stripped body
}

export interface RawThread {
  threadId: string;
  gmailThreadId: string;
  messages: RawMessage[];
  hasAttachmentsOnly?: boolean; // true if thread has no text body, only attachments
}

export interface SummaryResult {
  threadId: string;
  summary: string[];      // 3–5 bullet points (decisions, commitments, open questions)
  meta: {
    messageCount: number;
    wasChunked: boolean;      // true if hierarchical summarization was used
    skippedReason?: string;   // set when we didn't call the LLM at all
  };
}
