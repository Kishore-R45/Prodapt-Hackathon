import { RawThread, PriorityResult, PriorityLevel, ExistingTask } from "../types/contracts";
import { isLikelyBulkSender, isSystemEmail, isUserCCdOnly, hasUrgencyLanguage } from "../utils/senderSignals";
import { scoreContentSignals } from "../ai/priorityGemini.client";
import { stripQuotedAndSignature } from "../utils/emailCleaner";

/** A task mentioned/implied in THIS thread — normally comes from the task extractor agent,
 *  but the priority module only needs the shape below to do conflict detection. */
export interface ThreadTaskCandidate {
  description: string;
  deadline: string | null; // ISO 8601
  relatedParty?: string;   // who the commitment is to
}

// --- In-memory feedback store (hackathon scope; swap for a DB table in production) ---
// README 9.3 edge case: "User disagrees with a priority label -> one-click 'not urgent'
// feedback stored, nudges future scoring for that sender."
const feedbackStore = new Map<string, number>(); // sender -> cumulative down-weight

export function recordNotUrgentFeedback(senderEmail: string) {
  const current = feedbackStore.get(senderEmail.toLowerCase()) ?? 0;
  feedbackStore.set(senderEmail.toLowerCase(), Math.min(current + 15, 40)); // cap the nudge
}

function getFeedbackDownweight(senderEmail: string): number {
  return feedbackStore.get(senderEmail.toLowerCase()) ?? 0;
}

/** README 9.3 edge case: score -> bucket mapping. */
function scoreToLevel(score: number): PriorityLevel {
  if (score >= 80) return "urgent";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

/**
 * README 9.3 edge case: two threads promise contradictory things to the same/related party
 * with overlapping deadlines -> Conflict bucket, overrides normal scoring.
 */
function detectConflicts(
  newTasks: ThreadTaskCandidate[],
  existingTasks: ExistingTask[]
): { withTaskId: string; reason: string }[] {
  const conflicts: { withTaskId: string; reason: string }[] = [];

  for (const newTask of newTasks) {
    if (!newTask.deadline) continue;
    const newDay = newTask.deadline.slice(0, 10); // compare by date, not exact timestamp

    for (const existing of existingTasks) {
      if (!existing.deadline) continue;
      const existingDay = existing.deadline.slice(0, 10);

      const sameDay = newDay === existingDay;
      const differentParty =
        newTask.relatedParty &&
        existing.relatedParty &&
        newTask.relatedParty.toLowerCase() !== existing.relatedParty.toLowerCase();

      if (sameDay && differentParty) {
        conflicts.push({
          withTaskId: existing.id,
          reason: `New commitment to ${newTask.relatedParty} on ${newDay} overlaps an existing commitment to ${existing.relatedParty} on the same day ("${existing.description}").`,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Classifies a thread's priority combining content signals (LLM), behavioral signals
 * (sender history), sender-type overrides (bulk/system), and conflict detection.
 *
 * @param thread            the thread to classify
 * @param existingTasks     tasks already tracked in the DB (for conflict detection)
 * @param newTasksInThread  tasks extracted from THIS thread (from the task extractor agent)
 */
export async function classifyPriority(
  thread: RawThread,
  existingTasks: ExistingTask[] = [],
  newTasksInThread: ThreadTaskCandidate[] = []
): Promise<PriorityResult> {
  const latest = thread.messages[thread.messages.length - 1];
  const reasons: string[] = [];

  // Edge case: system/no-reply emails (CI alerts, calendar invites) — separate low-noise
  // bucket, excluded from urgent scoring entirely.
  if (isSystemEmail(latest)) {
    return {
      threadId: thread.threadId,
      priority: { level: "low", score: 5, reasons: ["Automated/system sender — routed to low-noise bucket"] },
      conflicts: [],
    };
  }

  // Conflict check runs first — a conflict is a hard override, not just a scoring input.
  const conflicts = detectConflicts(newTasksInThread, existingTasks);
  if (conflicts.length > 0) {
    return {
      threadId: thread.threadId,
      priority: {
        level: "conflict",
        score: 90,
        reasons: ["This thread's commitment conflicts with an already-tracked deadline", ...conflicts.map((c) => c.reason)],
      },
      conflicts,
    };
  }

  const cleanedText = thread.messages.map((m) => stripQuotedAndSignature(m.body)).join("\n\n");
  const bulk = isLikelyBulkSender(latest);

  // Content score: only bother calling the LLM if there's some urgency language OR
  // it's a short/simple case worth checking — keeps LLM calls down for high-volume inboxes.
  let contentScore = 20;
  if (hasUrgencyLanguage(cleanedText) || cleanedText.length < 2000) {
    const contentSignals = await scoreContentSignals(cleanedText);
    contentScore = contentSignals.contentScore;
    reasons.push(...contentSignals.reasons);
  }

  // Edge case: marketing email with fake urgency -> down-weight regardless of keyword urgency.
  if (bulk) {
    contentScore = Math.min(contentScore, 15);
    reasons.push("Bulk/marketing sender detected (List-Unsubscribe header or known pattern) — de-prioritized despite urgent-sounding language");
  }

  // Behavioral signal: sender history (VIP-ish signal), but content re-ranking wins per 9.3
  // edge case "VIP sender but trivial content" — so this only nudges, never dominates.
  let behavioralAdjustment = 0;
  if (thread.senderHistory?.isActiveProjectSender) {
    behavioralAdjustment += 10;
    reasons.push("Sender is part of an active tracked project");
  }
  if (thread.senderHistory?.avgReplyTimeHours !== undefined && thread.senderHistory.avgReplyTimeHours < 4) {
    behavioralAdjustment += 5;
    reasons.push("You typically reply to this sender quickly — historically high-priority relationship");
  }

  // Edge case: user CC'd, not primary recipient -> automatic priority discount.
  let ccDiscount = 0;
  if (isUserCCdOnly(thread)) {
    ccDiscount = 20;
    reasons.push("You're CC'd, not a primary recipient — discounted");
  }

  // Feedback loop nudge.
  const feedbackDownweight = getFeedbackDownweight(latest.from);
  if (feedbackDownweight > 0) {
    reasons.push(`Downweighted from your past "not urgent" feedback on this sender`);
  }

  const finalScore = Math.max(
    0,
    Math.min(100, contentScore + behavioralAdjustment - ccDiscount - feedbackDownweight)
  );

  return {
    threadId: thread.threadId,
    priority: {
      level: scoreToLevel(finalScore),
      score: Math.round(finalScore),
      reasons: reasons.length > 0 ? reasons : ["No strong urgency signals detected"],
    },
    conflicts: [],
  };
}

/** Batch helper — used by the orchestrator to classify multiple threads at once. */
export async function classifyThreads(
  threads: RawThread[],
  existingTasks: ExistingTask[] = [],
  newTasksByThreadId: Record<string, ThreadTaskCandidate[]> = {}
): Promise<PriorityResult[]> {
  return Promise.all(
    threads.map((t) => classifyPriority(t, existingTasks, newTasksByThreadId[t.threadId] ?? []))
  );
}
