import { useEffect, useMemo, useState } from "react";
import type { AnalyzeInboxResponse, BackgroundResponse, InboxSession, PriorityLevel, RawThread, ThreadAnalysis } from "../shared/contracts";
import { openThread, sendBackground } from "../shared/api-client";

type ViewTab = "overview" | "priority" | "calendar" | "tasks" | "draft";

const tabOrder: { key: ViewTab; label: string; helper: string }[] = [
  { key: "overview", label: "Overview", helper: "Summary + signals" },
  { key: "priority", label: "Priority", helper: "What matters now" },
  { key: "calendar", label: "Calendar", helper: "Deadlines" },
  { key: "tasks", label: "To-do", helper: "Action items" },
  { key: "draft", label: "Draft", helper: "Reply ready" }
];

export function App() {
  const [session, setSession] = useState<InboxSession | null>(null);
  const [threads, setThreads] = useState<RawThread[]>([]);
  const [analyses, setAnalyses] = useState<ThreadAnalysis[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>("overview");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Connect Gmail to analyze unread mail.");
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);

  useEffect(() => {
    void loadSession();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("inboxpilot.theme", theme);
  }, [theme]);

  const selectedAnalysis = useMemo(
    () => analyses.find((analysis) => analysis.threadId === selectedThreadId) ?? analyses[0] ?? null,
    [analyses, selectedThreadId]
  );
  const selectedThread = useMemo(
    () => threads.find((thread) => thread.threadId === (selectedAnalysis?.threadId ?? selectedThreadId)) ?? threads[0] ?? null,
    [selectedAnalysis, selectedThreadId, threads]
  );
  const dashboardStats = useMemo(() => summarizeDashboard(analyses, threads), [analyses, threads]);

  async function loadSession(): Promise<void> {
    const response = await sendBackground<InboxSession>({ type: "GET_SESSION" });
    if (response.ok && response.data) {
      setSession(response.data);
      if (response.data.connected) {
        setMessage(response.data.source === "demo" ? "Demo inbox is ready." : "Gmail account connected.");
      }
    }
  }

  async function connectInbox(): Promise<void> {
    setError(null);
    setLoading(true);
    setMessage("Authorizing Gmail and loading unread mail...");
    const response = await sendBackground<AnalyzeInboxResponse>({ type: "AUTHENTICATE" });
    handleResponse(response, "Inbox connected and analyzed.");
    setLoading(false);
  }

  async function refreshInbox(): Promise<void> {
    setError(null);
    setLoading(true);
    setMessage("Refreshing unread mail...");
    const response = await sendBackground<AnalyzeInboxResponse>({ type: "REFRESH_INBOX" });
    handleResponse(response, "Inbox refreshed.");
    setLoading(false);
  }

  async function loadDemo(): Promise<void> {
    setError(null);
    setLoading(true);
    setMessage("Loading demo inbox...");
    const response = await sendBackground<AnalyzeInboxResponse>({ type: "LOAD_DEMO" });
    handleResponse(response, "Demo data loaded.");
    setLoading(false);
  }

  function handleResponse(response: BackgroundResponse<AnalyzeInboxResponse>, successMessage: string): void {
    if (!response.ok || !response.data) {
      setError(response.error ?? "Something went wrong.");
      setMessage("Action failed.");
      return;
    }

    setSession(response.data.session);
    setThreads(response.data.threads);
    setAnalyses(response.data.analyses);
    setSelectedThreadId(response.data.analyses[0]?.threadId ?? null);
    setMessage(successMessage);
  }

  async function completeTask(threadId: string, taskId: string): Promise<void> {
    const response = await sendBackground<{ unreadCleared: boolean }>({ type: "MARK_TASK_DONE", payload: { threadId, taskId } });
    if (!response.ok) {
      setError(response.error ?? "Could not mark task complete.");
      return;
    }

    setAnalyses((current) =>
      current.map((analysis) =>
        analysis.threadId !== threadId
          ? analysis
          : {
              ...analysis,
              tasks: analysis.tasks.map((task) => (task.id === taskId ? { ...task, status: "done" } : task))
            }
      )
    );
    setMessage("Task completed and Gmail thread marked read.");
  }

  const prioritySummary = summarizePriority(analyses);
  const deadlineSummary = dashboardStats.deadlineCount;
  const taskCount = dashboardStats.openTaskCount;

  return (
    <div className="sidebar-shell">
      <div className="shell-frame">
        <header className="app-topbar">
          <div className="brand-block">
            <div className="brand-mark brand-mark-large">IP</div>
            <div className="brand-copy">
              <p className="eyebrow">InboxPilot</p>
              <h1>Enterprise inbox copilot</h1>
              <p className="subtle-copy">Analyze unread mail, prioritize what matters, and draft responses with a clean workbench.</p>
            </div>
          </div>

          <div className="topbar-actions">
            <button className="theme-toggle" onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}>
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            <button className="ghost-link" onClick={() => void loadDemo()} disabled={loading}>Load demo</button>
          </div>
        </header>

        <main className="app-scroll">
          <section className="hero-card hero-slim">
            <div className="hero-row">
              <div>
                <p className="hero-kicker">Session status</p>
                <h2>{session?.connected ? "Connected and analyzing" : "Ready to connect"}</h2>
              </div>
              <div className={`status-chip ${session?.connected ? "status-chip-live" : "status-chip-offline"}`}>
                {session?.connected ? session.source : "offline"}
              </div>
            </div>

            <p className="hero-copy">Authorize once, then the extension syncs unread threads and organizes them in a structured sidebar similar to a browser copilot panel.</p>

            <div className="action-row">
              <button className="btn btn-primary" onClick={connectInbox} disabled={loading}>{session?.connected ? "Reconnect Gmail" : "Authorize Gmail"}</button>
              <button className="btn btn-secondary" onClick={refreshInbox} disabled={loading || !session?.connected}>Refresh Inbox</button>
            </div>

            <div className="status-strip">
              <span>{dashboardStats.totalUnread} unread</span>
              <span>{dashboardStats.openTaskCount} open tasks</span>
              <span>{dashboardStats.deadlineCount} deadlines</span>
              <span>{prioritySummary.highestLabel} priority</span>
            </div>

            <div className="status-banner">{message}</div>
            {error ? <div className="status-banner status-banner-error">{error}</div> : null}
          </section>

          <section className="stats-grid">
            <StatCard label="Unread" value={String(dashboardStats.totalUnread)} hint="Ready to triage" />
            <StatCard label="Priority" value={prioritySummary.highestLabel} hint={`${prioritySummary.urgentCount} urgent threads`} />
            <StatCard label="Tasks" value={String(taskCount)} hint="Open follow-ups" />
            <StatCard label="Deadlines" value={String(deadlineSummary)} hint="Detected dates" />
          </section>

          <section className="workspace-grid">
            <aside className="panel-card thread-column">
              <div className="panel-heading panel-heading-sticky">
                <div>
                  <p className="panel-kicker">Priority inbox</p>
                  <h2>Unread threads</h2>
                </div>
                <span className="count-pill">{threads.length}</span>
              </div>

              <div className="thread-list">
                {threads.map((thread) => {
                  const analysis = analyses.find((item) => item.threadId === thread.threadId);
                  const isSelected = selectedThreadId === thread.threadId;
                  return (
                    <button key={thread.threadId} className={`thread-card ${isSelected ? "thread-card-selected" : ""}`} onClick={() => setSelectedThreadId(thread.threadId)}>
                      <div className="thread-card-top">
                        <div className="thread-copy">
                          <h3>{thread.subject}</h3>
                          <p>{thread.from}</p>
                        </div>
                        <span className={`priority-badge priority-${analysis?.priority.level ?? "low"}`}>{analysis?.priority.level ?? "low"}</span>
                      </div>
                      <p className="thread-snippet">{thread.snippet}</p>
                      <div className="thread-card-meta">
                        <span>{analysis?.tasks.length ?? 0} tasks</span>
                        <span>{analysis?.priority.score ?? 0}/100</span>
                      </div>
                    </button>
                  );
                })}

                {threads.length === 0 ? (
                  <div className="empty-state empty-state-compact">
                    <strong>No threads loaded yet</strong>
                    <p>Authorize Gmail or load the demo inbox to populate the sidebar.</p>
                  </div>
                ) : null}
              </div>
            </aside>

            <section className="panel-card detail-column">
              <div className="panel-heading panel-heading-sticky">
                <div>
                  <p className="panel-kicker">Thread detail</p>
                  <h2>{selectedThread?.subject ?? "Select a thread"}</h2>
                </div>
                <button className="ghost-link" onClick={() => selectedAnalysis && openThread(selectedAnalysis.threadId)}>Open Gmail</button>
              </div>

              <div className="workspace-surface">
                <div className="tab-strip">
                  {tabOrder.map((tab) => (
                    <button key={tab.key} className={`tab-button ${activeTab === tab.key ? "tab-button-active" : ""}`} onClick={() => setActiveTab(tab.key)}>
                      <span>{tab.label}</span>
                      <small>{tab.helper}</small>
                    </button>
                  ))}
                </div>

                {selectedAnalysis ? (
                  <div className="detail-stack">
                    {activeTab === "overview" ? <OverviewPanel analysis={selectedAnalysis} thread={selectedThread} /> : null}
                    {activeTab === "priority" ? <PriorityPanel analysis={selectedAnalysis} /> : null}
                    {activeTab === "calendar" ? <CalendarPanel analyses={analyses} /> : null}
                    {activeTab === "tasks" ? <TaskPanel analysis={selectedAnalysis} onComplete={completeTask} /> : null}
                    {activeTab === "draft" ? <DraftPanel analysis={selectedAnalysis} /> : null}
                  </div>
                ) : (
                  <EmptyDetail />
                )}
              </div>
            </section>
          </section>
        </main>
      </div>
    </div>
  );
}

function getInitialTheme(): "light" | "dark" {
  const storedTheme = localStorage.getItem("inboxpilot.theme");
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

function OverviewPanel({ analysis, thread }: { analysis: ThreadAnalysis; thread: RawThread | null }) {
  return (
    <div className="section-grid">
      <section className="info-card">
        <h3>Summary</h3>
        <ul className="bullet-list">
          {analysis.summary.map((item, index) => <li key={`${analysis.threadId}-summary-${index}`}>{item}</li>)}
        </ul>
      </section>

      <section className="info-card">
        <h3>Explainability</h3>
        <div className="reason-list">
          {analysis.priority.reasons.map((reason, index) => <span key={`${analysis.threadId}-reason-${index}`} className="reason-pill">{reason}</span>)}
        </div>
      </section>

      <section className="info-card">
        <h3>Source</h3>
        <p className="muted-copy">{thread?.from ?? "Unknown sender"}</p>
        <p className="muted-copy">{thread?.date ? new Date(thread.date).toLocaleString() : "No date"}</p>
      </section>
    </div>
  );
}

function PriorityPanel({ analysis }: { analysis: ThreadAnalysis }) {
  return (
    <div className="section-grid">
      <section className="info-card">
        <h3>Priority score</h3>
        <div className="score-ring">
          <strong>{analysis.priority.score}</strong>
          <span>/ 100</span>
        </div>
        <p className="muted-copy">Bucket: {analysis.priority.level}</p>
      </section>

      <section className="info-card">
        <h3>Rules used</h3>
        <ul className="bullet-list">
          {analysis.priority.reasons.map((reason, index) => <li key={`${analysis.threadId}-priority-${index}`}>{reason}</li>)}
        </ul>
      </section>
    </div>
  );
}

function CalendarPanel({ analyses }: { analyses: ThreadAnalysis[] }) {
  const deadlines = analyses.flatMap((analysis) => analysis.tasks.filter((task) => task.deadline).map((task) => ({ threadId: analysis.threadId, title: task.description, deadline: task.deadline as string }))).slice(0, 8);
  return (
    <div className="section-grid">
      <section className="info-card">
        <h3>Upcoming deadlines</h3>
        <div className="deadline-list">
          {deadlines.length === 0 ? <p className="muted-copy">No deadlines extracted yet.</p> : deadlines.map((item, index) => (
            <div key={`${item.threadId}-${index}`} className="deadline-row">
              <strong>{new Date(item.deadline).toLocaleDateString()}</strong>
              <span>{item.title}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TaskPanel({ analysis, onComplete }: { analysis: ThreadAnalysis; onComplete: (threadId: string, taskId: string) => Promise<void> }) {
  return (
    <div className="section-grid">
      <section className="info-card">
        <h3>Task queue</h3>
        <div className="task-list">
          {analysis.tasks.map((task) => (
            <label key={task.id} className={`task-row ${task.status === "done" ? "task-row-done" : ""}`}>
              <input type="checkbox" checked={task.status === "done"} onChange={() => void onComplete(analysis.threadId, task.id)} />
              <div>
                <strong>{task.description}</strong>
                <p>{task.deadline ? new Date(task.deadline).toLocaleString() : "No deadline detected"}</p>
              </div>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

function DraftPanel({ analysis }: { analysis: ThreadAnalysis }) {
  return (
    <div className="section-grid">
      <section className="info-card">
        <h3>Generated draft</h3>
        <p className="muted-copy">Tone: {analysis.draft.tone} {analysis.draft.requiresApproval ? "· approval required" : ""}</p>
        <textarea className="draft-editor" value={analysis.draft.body} readOnly />
      </section>
    </div>
  );
}

function EmptyDetail() {
  return (
    <div className="empty-state empty-state-large">
      <strong>No analysis selected</strong>
      <p>Load unread mail or demo data, then choose a thread to inspect summary, priority, deadlines, tasks, and draft response.</p>
    </div>
  );
}

function summarizePriority(analyses: ThreadAnalysis[]) {
  const urgentCount = analyses.filter((analysis) => analysis.priority.level === "urgent").length;
  const highest = analyses.reduce<PriorityLevel>((current, analysis) => {
    const order: PriorityLevel[] = ["low", "medium", "high", "urgent", "conflict"];
    return order.indexOf(analysis.priority.level) > order.indexOf(current) ? analysis.priority.level : current;
  }, "low");

  return {
    urgentCount,
    highestLabel: highest === "low" ? "Calm" : highest
  };
}

function summarizeDashboard(analyses: ThreadAnalysis[], threads: RawThread[]) {
  return {
    totalUnread: threads.length,
    openTaskCount: analyses.reduce((count, analysis) => count + analysis.tasks.filter((task) => task.status !== "done").length, 0),
    deadlineCount: analyses.reduce((count, analysis) => count + analysis.tasks.filter((task) => Boolean(task.deadline)).length, 0)
  };
}