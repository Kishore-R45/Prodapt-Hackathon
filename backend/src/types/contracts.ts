export interface DraftResult {
  tone: "formal" | "casual";
  body: string;
  requiresApproval: boolean;
  hasExistingDraftConflict?: boolean;
}

export interface RawThread {
  threadId: string;
  subject: string;
  messages: {
    from: string;
    body: string;
    date: string;
  }[];
  senderDomain: string;
  recipients?: { to: string[]; cc: string[] };
  existingDraft?: string | null;
}
