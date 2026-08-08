import type { AnalyzeInboxResponse, BackgroundRequest, BackgroundResponse, InboxSession, RawThread, ThreadAnalysis } from "../shared/contracts";

declare const __BACKEND_URL__: string;

const SESSION_KEY = "inboxpilot.session";
const DEMO_THREADS: RawThread[] = [
  {
    threadId: "demo-thread-1",
    subject: "Client escalation: revised timeline for landing page rollout",
    from: "Avery Chen <avery@northstar.io>",
    snippet: "We need the updated landing page assets by Friday EOD so we can launch on Monday.",
    unread: true,
    date: "2026-08-08T09:20:00.000Z",
    messages: [
      {
        id: "msg-1",
        sender: "Avery Chen <avery@northstar.io>",
        subject: "Client escalation: revised timeline for landing page rollout",
        body: "Hi team, we need the updated landing page assets by Friday EOD so we can launch on Monday. Please send the final copy and hero artwork before 4 PM.",
        date: "2026-08-08T09:20:00.000Z"
      }
    ]
  },
  {
    threadId: "demo-thread-2",
    subject: "Quick sync next week?",
    from: "Jordan Lee <jordan@prodapt.com>",
    snippet: "Would you be free Tuesday or Wednesday for a short review of the proposal?",
    unread: true,
    date: "2026-08-07T16:10:00.000Z",
    messages: [
      {
        id: "msg-2",
        sender: "Jordan Lee <jordan@prodapt.com>",
        subject: "Quick sync next week?",
        body: "Would you be free Tuesday or Wednesday for a short review of the proposal? Also, please share any blockers before then.",
        date: "2026-08-07T16:10:00.000Z"
      }
    ]
  },
  {
    threadId: "demo-thread-3",
    subject: "Invoice and deliverable mismatch",
    from: "Finance Team <finance@northstar.io>",
    snippet: "The invoice mentions scope A, but the latest deliverable references scope B.",
    unread: true,
    date: "2026-08-06T11:30:00.000Z",
    messages: [
      {
        id: "msg-3",
        sender: "Finance Team <finance@northstar.io>",
        subject: "Invoice and deliverable mismatch",
        body: "The invoice mentions scope A, but the latest deliverable references scope B. Please confirm which timeline should be used and whether we should pause billing until the conflict is resolved.",
        date: "2026-08-06T11:30:00.000Z"
      }
    ]
  }
];

chrome.runtime.onMessage.addListener((request: BackgroundRequest, _sender: chrome.runtime.MessageSender, sendResponse: (response: BackgroundResponse) => void) => {
  void handleRequest(request)
    .then((response) => sendResponse(response))
    .catch((error: Error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

async function handleRequest(request: BackgroundRequest): Promise<BackgroundResponse> {
  switch (request.type) {
    case "GET_SESSION":
      return { ok: true, data: await getSession() };
    case "AUTHENTICATE":
      return { ok: true, data: await authorizeAndSync() };
    case "REFRESH_INBOX":
      return { ok: true, data: await refreshInbox() };
    case "LOAD_DEMO":
      return { ok: true, data: await syncWithThreads(DEMO_THREADS, "demo") };
    case "MARK_TASK_DONE":
      return { ok: true, data: await markTaskDone(request.payload.threadId, request.payload.taskId) };
    case "OPEN_THREAD":
      await chrome.tabs.create({ url: `https://mail.google.com/mail/u/0/#inbox/${request.payload.threadId}` });
      return { ok: true };
    default:
      return { ok: false, error: "Unsupported request" };
  }
}

async function authorizeAndSync(): Promise<AnalyzeInboxResponse> {
  assertValidOAuthClientId();
  const token = await withTimeout(getAuthToken(true), 20000, "Google OAuth authorization timed out. Check that the extension OAuth client ID matches the extension ID registered in Google Cloud Console.");
  const profile = await getProfileInfo();
  const session: InboxSession = {
    connected: true,
    email: profile.email || null,
    displayName: profile.email || null,
    token,
    unreadCount: 0,
    lastSyncedAt: new Date().toISOString(),
    source: "live"
  };

  await saveSession(session);
  return refreshInbox(session);
}

async function refreshInbox(existingSession?: InboxSession): Promise<AnalyzeInboxResponse> {
  const session = existingSession ?? (await getSession());
  if (!session.connected || !session.token) {
    throw new Error("Connect Gmail first.");
  }

  try {
    const threads = await fetchUnreadThreads(session.token);
    return syncWithThreads(threads, "live", session);
  } catch (_error) {
    const demoSession = { ...session, source: "demo" as const };
    return syncWithThreads(DEMO_THREADS, "demo", demoSession);
  }
}

async function syncWithThreads(threads: RawThread[], source: "live" | "demo", sessionOverride?: InboxSession): Promise<AnalyzeInboxResponse> {
  const response = await analyzeThreads(threads);
  const session = sessionOverride ?? (await getSession());
  const updatedSession: InboxSession = {
    ...session,
    unreadCount: threads.filter((thread) => thread.unread).length,
    lastSyncedAt: new Date().toISOString(),
    source
  };

  await saveSession(updatedSession);
  return {
    session: updatedSession,
    threads,
    analyses: response
  };
}

async function markTaskDone(threadId: string, taskId: string): Promise<{ threadId: string; taskId: string; unreadCleared: boolean }> {
  const session = await getSession();
  if (session.token) {
    await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ removeLabelIds: ["UNREAD"] })
    });
  }

  return { threadId, taskId, unreadCleared: true };
}

async function analyzeThreads(threads: RawThread[]): Promise<ThreadAnalysis[]> {
  const payload = await fetch(`${__BACKEND_URL__.replace(/\/$/, "")}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threads })
  });

  if (!payload.ok) {
    return threads.map(analyzeThreadLocally);
  }

  const body = (await payload.json()) as { analyses: ThreadAnalysis[] };
  return body.analyses;
}

function analyzeThreadLocally(thread: RawThread): ThreadAnalysis {
  const text = thread.messages.map((message) => message.body).join(" ").toLowerCase();
  const score = calculatePriorityScore(text);
  return {
    threadId: thread.threadId,
    summary: summarizeThread(thread),
    priority: {
      level: score >= 90 ? "urgent" : score >= 70 ? "high" : score >= 45 ? "medium" : "low",
      score,
      reasons: buildReasons(text)
    },
    tasks: extractTasks(thread),
    draft: {
      tone: text.includes("client") || text.includes("invoice") ? "formal" : "casual",
      body: `Hi ${thread.from.split(" <")[0]},\n\nThanks for the update. I reviewed the thread and will follow up on the requested items shortly.\n\nBest,\nInboxPilot`,
      requiresApproval: text.includes("invoice") || text.includes("legal") || text.includes("payment")
    },
    conflicts: text.includes("conflict")
      ? [{ withTaskId: `${thread.threadId}-conflict`, reason: "The thread mentions a conflicting commitment or mismatch." }]
      : []
  };
}

function summarizeThread(thread: RawThread): string[] {
  const sentences = thread.messages
    .flatMap((message) => message.body.split(/(?<=[.!?])\s+/))
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const selected = sentences.slice(0, 4);
  return selected.length > 0 ? selected : [thread.snippet];
}

function buildReasons(text: string): string[] {
  const reasons = [
    text.includes("by friday") || text.includes("eod") ? "Has a near-term deadline" : null,
    text.includes("urgent") || text.includes("escalat") ? "Contains escalation language" : null,
    text.includes("please") || text.includes("can you") ? "Requests an explicit response" : null,
    text.includes("conflict") ? "References a conflicting commitment" : null
  ].filter((reason): reason is string => Boolean(reason));

  return reasons.length > 0 ? reasons : ["Requires human review"];
}

function calculatePriorityScore(text: string): number {
  let score = 20;
  if (/(urgent|asap|immediately|escalat)/.test(text)) score += 35;
  if (/(deadline|due|by friday|eod|tomorrow|today)/.test(text)) score += 30;
  if (/\?/.test(text)) score += 10;
  if (/(invoice|payment|client|launch|release)/.test(text)) score += 10;
  if (/(conflict|mismatch|blocked)/.test(text)) score += 20;
  return Math.min(100, score);
}

function extractTasks(thread: RawThread) {
  const taskBodies = thread.messages.flatMap((message) => {
    const sentences = message.body.split(/(?<=[.!?])\s+/);
    return sentences
      .filter((sentence) => /(please|need|should|action|confirm|share|send|review|update)/i.test(sentence))
      .map((sentence, index) => ({
        id: `${thread.threadId}-task-${index + 1}`,
        description: sentence.trim(),
        deadline: inferDeadline(sentence, message.date),
        confidence: sentence.includes("please") || sentence.includes("need") ? 0.9 : 0.65,
        status: "pending" as const
      }));
  });

  return taskBodies.length > 0
    ? taskBodies
    : [
        {
          id: `${thread.threadId}-task-1`,
          description: thread.subject,
          deadline: null,
          confidence: 0.45,
          status: "pending" as const
        }
      ];
}

function inferDeadline(sentence: string, fallbackDate: string): string | null {
  const explicit = sentence.match(/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/);
  if (explicit) {
    const parsed = new Date(explicit[0]);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString();
    }
  }

  const base = new Date(fallbackDate);
  if (/friday/i.test(sentence)) {
    base.setDate(base.getDate() + 4);
    return base.toISOString();
  }

  if (/monday/i.test(sentence) || /tomorrow/i.test(sentence)) {
    base.setDate(base.getDate() + 1);
    return base.toISOString();
  }

  if (/next week/i.test(sentence)) {
    base.setDate(base.getDate() + 7);
    return base.toISOString();
  }

  return null;
}

function shiftDays(baseDate: string, days: number): string {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

async function getAuthToken(interactive: boolean): Promise<string> {
  try {
    return await chrome.identity.getAuthToken({ interactive });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`OAuth2 request failed: ${message}`);
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function assertValidOAuthClientId(): void {
  const clientId = chrome.runtime.getManifest().oauth2?.client_id;
  if (!clientId || clientId.includes("REPLACE_WITH_GOOGLE_OAUTH_CLIENT_ID")) {
    throw new Error(
      "Google OAuth client ID is not configured. Replace the placeholder in extension/manifest.json with a real Chrome extension OAuth client ID from Google Cloud Console."
    );
  }
}

async function getProfileInfo(): Promise<{ email?: string }> {
  return await chrome.identity.getProfileUserInfo();
}

async function fetchUnreadThreads(token: string): Promise<RawThread[]> {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/threads?labelIds=UNREAD&maxResults=12&q=is%3Aunread", {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(`Gmail thread list failed: ${response.status}`);
  }

  const body = (await response.json()) as { threads?: { id: string }[] };
  const threads = body.threads ?? [];
  const detailedThreads = await Promise.all(threads.map((entry) => fetchThread(token, entry.id)));
  return detailedThreads.filter((thread): thread is RawThread => Boolean(thread));
}

async function fetchThread(token: string, threadId: string): Promise<RawThread | null> {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    return null;
  }

  const thread = await response.json();
  const messages = (thread.messages ?? []).map((message: any) => ({
    id: message.id,
    sender: headerValue(message.payload?.headers, "From") ?? "Unknown sender",
    subject: headerValue(message.payload?.headers, "Subject") ?? thread.snippet ?? "InboxPilot thread",
    body: extractBody(message.payload),
    date: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : new Date().toISOString()
  }));

  const firstMessage = messages[0];
  return {
    threadId,
    subject: firstMessage?.subject ?? thread.snippet ?? "InboxPilot thread",
    from: firstMessage?.sender ?? "Unknown sender",
    snippet: thread.snippet ?? firstMessage?.body.slice(0, 120) ?? "",
    unread: true,
    date: firstMessage?.date ?? new Date().toISOString(),
    messages
  };
}

function headerValue(headers: any[] | undefined, key: string): string | undefined {
  return headers?.find((header) => header.name?.toLowerCase() === key.toLowerCase())?.value;
}

function extractBody(payload: any): string {
  if (!payload) {
    return "";
  }

  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const extracted = extractBody(part);
      if (extracted) {
        return extracted;
      }
    }
  }

  return "";
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return decodeURIComponent(
    atob(normalized)
      .split("")
      .map((character) => `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .join("")
  );
}

async function getSession(): Promise<InboxSession> {
  const stored = await chrome.storage.local.get(SESSION_KEY);
  return stored[SESSION_KEY] ?? {
    connected: false,
    email: null,
    displayName: null,
    token: null,
    unreadCount: 0,
    lastSyncedAt: null,
    source: "none"
  };
}

async function saveSession(session: InboxSession): Promise<void> {
  await chrome.storage.local.set({ [SESSION_KEY]: session });
}