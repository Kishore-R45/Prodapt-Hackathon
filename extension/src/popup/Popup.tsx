import { useEffect, useState } from "react";
import type { InboxSession } from "../shared/contracts";
import { sendBackground } from "../shared/api-client";

export function Popup() {
  const [session, setSession] = useState<InboxSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void sendBackground<InboxSession>({ type: "GET_SESSION" }).then((response) => {
      if (response.ok && response.data) {
        setSession(response.data);
      }
    });
  }, []);

  async function connect(): Promise<void> {
    setError(null);
    const response = await sendBackground<{ session: InboxSession }>({ type: "AUTHENTICATE" });
    if (!response.ok) {
      setError(response.error ?? "Failed to connect Gmail.");
      return;
    }
    setSession(response.data?.session ?? null);
  }

  async function demo(): Promise<void> {
    const response = await sendBackground<{ session: InboxSession }>({ type: "LOAD_DEMO" });
    if (response.ok && response.data) {
      setSession(response.data.session);
    }
  }

  return (
    <main className="popup-shell">
      <div className="popup-header">
        <span className="brand-mark">IP</span>
        <div>
          <h1>InboxPilot</h1>
          <p>Launch Gmail analysis from here.</p>
        </div>
      </div>

      <section className="popup-card">
        <div className="popup-row">
          <span>Status</span>
          <strong>{session?.connected ? "Connected" : "Not connected"}</strong>
        </div>
        <div className="popup-row">
          <span>Source</span>
          <strong>{session?.source ?? "none"}</strong>
        </div>
        <div className="popup-row">
          <span>Unread</span>
          <strong>{session?.unreadCount ?? 0}</strong>
        </div>
      </section>

      {error ? <div className="notice notice-error">{error}</div> : null}

      <div className="popup-actions">
        <button className="btn btn-primary" onClick={connect}>Connect Gmail</button>
        <button className="btn btn-secondary" onClick={demo}>Load Demo</button>
      </div>
    </main>
  );
}