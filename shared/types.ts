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

export type BackgroundRequest =
  | { type: "GET_SESSION" }
  | { type: "AUTHENTICATE" }
  | { type: "REFRESH_INBOX" }
  | { type: "LOAD_DEMO" }
  | { type: "MARK_TASK_DONE"; payload: { threadId: string; taskId: string } }
  | { type: "OPEN_THREAD"; payload: { threadId: string } };

export interface BackgroundResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}