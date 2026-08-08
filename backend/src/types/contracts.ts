export type PriorityLevel = "urgent" | "high" | "medium" | "low" | "conflict";
export type DraftTone = "formal" | "casual";
export type TaskStatus = "pending" | "done" | "overdue";

export interface RawMessage {
  id: string;
  sender: string;
  subject: string;
  body: string;
  date: string;
}

export interface RawThread {
  threadId: string;
  subject: string;
  from: string;
  snippet: string;
  unread: boolean;
  date: string;
  messages: RawMessage[];
}

export interface AnalysisTask {
  id: string;
  description: string;
  deadline: string | null;
  confidence: number;
  status: TaskStatus;
}

export interface ThreadAnalysis {
  threadId: string;
  summary: string[];
  priority: {
    level: PriorityLevel;
    score: number;
    reasons: string[];
  };
  tasks: AnalysisTask[];
  draft: {
    tone: DraftTone;
    body: string;
    requiresApproval: boolean;
  };
  conflicts: {
    withTaskId: string;
    reason: string;
  }[];
}

export interface InboxSession {
  connected: boolean;
  email: string | null;
  displayName: string | null;
  token: string | null;
  unreadCount: number;
  lastSyncedAt: string | null;
  source: "live" | "demo" | "none";
}

export interface AnalyzeInboxResponse {
  session: InboxSession;
  threads: RawThread[];
  analyses: ThreadAnalysis[];
}
