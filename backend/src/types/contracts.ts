// Mirrors extension/shared/types.ts (Section 7 of the README API contract).
// This extends the summarizer's contracts.ts with what the priority module needs.
// When the real shared/types.ts lands, replace this file with it.

export type PriorityLevel = "urgent" | "high" | "medium" | "low" | "conflict";

export interface RawMessage {
  id: string;
  from: string;
  to: string[];
  cc?: string[];
  date: string;                 // ISO 8601 — the email's Date header
  subject: string;
  body: string;
  listUnsubscribe?: string;     // presence of List-Unsubscribe header = bulk-sender signal
}

export interface RawThread {
  threadId: string;
  gmailThreadId: string;
  userEmail: string;            // whoever is running the assistant — needed for To/CC check
  messages: RawMessage[];
  hasAttachmentsOnly?: boolean;
  senderHistory?: SenderHistory;
}

export interface SenderHistory {
  avgReplyTimeHours?: number;   // how fast the user has historically replied to this sender
  isActiveProjectSender?: boolean;
}

/** An already-tracked commitment/deadline, used for conflict detection. */
export interface ExistingTask {
  id: string;
  description: string;
  deadline: string | null;      // ISO 8601
  relatedParty?: string;        // sender/domain this commitment was made to
}

export interface PriorityResult {
  threadId: string;
  priority: {
    level: PriorityLevel;
    score: number;              // 0–100
    reasons: string[];          // explainability — always shown in UI
  };
  conflicts: {
    withTaskId: string;
    reason: string;
  }[];
}
