export interface DraftResult {
  tone: "formal" | "casual";
  body: string;
  requiresApproval: boolean;
  hasExistingDraftConflict?: boolean;
}

export interface ThreadAnalysis {
  threadId: string;
  draft: DraftResult;
}
