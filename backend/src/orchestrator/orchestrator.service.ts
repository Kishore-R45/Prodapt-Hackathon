import type { RawThread, ThreadAnalysis } from "../types/contracts.js";

function log(message: string, details?: unknown): void {
  if (details === undefined) {
    console.log(`[orchestrator] ${message}`);
    return;
  }

  console.log(`[orchestrator] ${message}`, details);
}

export function orchestrateAnalysis(thread: RawThread): ThreadAnalysis {
  log(`Analyzing thread ${thread.threadId}`, {
    subject: thread.subject,
    from: thread.from,
    messageCount: thread.messages.length,
    unread: thread.unread
  });

  const mergedText = thread.messages.map((message: RawThread["messages"][number]) => `${message.subject} ${message.body}`).join(" ").toLowerCase();
  const summary = summarize(thread);
  const priority = classifyPriority(mergedText);
  const tasks = extractTasks(thread);
  const draft = generateDraft(thread, priority.level);
  const conflicts = mergedText.includes("conflict") || mergedText.includes("mismatch")
    ? [{ withTaskId: `${thread.threadId}-conflict`, reason: "Detected a conflicting commitment or mismatch in the thread." }]
    : [];

  const analysis: ThreadAnalysis = {
    threadId: thread.threadId,
    summary,
    priority,
    tasks,
    draft,
    conflicts
  };

  log(`Thread ${thread.threadId} analyzed`, {
    priority: analysis.priority.level,
    score: analysis.priority.score,
    taskCount: analysis.tasks.length,
    conflictCount: analysis.conflicts.length
  });

  return analysis;
}

function summarize(thread: RawThread): string[] {
  const messages = thread.messages.map((message: RawThread["messages"][number]) => message.body.trim()).filter(Boolean);
  const sentences = messages.flatMap((message: string) => message.split(/(?<=[.!?])\s+/));
  const condensed = sentences
    .map((sentence: string) => sentence.trim())
    .filter(Boolean)
    .slice(0, 4);

  log(`Summarized thread ${thread.threadId}`, {
    summaryLines: condensed.length,
    fallbackUsed: condensed.length === 0
  });

  return condensed.length > 0 ? condensed : [thread.snippet];
}

function classifyPriority(text: string): ThreadAnalysis["priority"] {
  let score = 22;
  const reasons: string[] = [];

  if (/(urgent|asap|immediately|escalat)/.test(text)) {
    score += 36;
    reasons.push("Contains urgent or escalation language");
  }

  if (/(deadline|due|tomorrow|today|friday|monday|eod)/.test(text)) {
    score += 28;
    reasons.push("Has a deadline or near-term ask");
  }

  if (/\?/.test(text)) {
    score += 10;
    reasons.push("Requests a response or decision");
  }

  if (/(invoice|client|launch|release|payment|blocked)/.test(text)) {
    score += 12;
    reasons.push("Touches a sensitive or work-critical topic");
  }

  if (/(conflict|mismatch|contradict)/.test(text)) {
    score += 20;
    reasons.push("Signals a conflict or mismatch");
  }

  const level = score >= 90 ? "urgent" : score >= 70 ? "high" : score >= 45 ? "medium" : "low";
  const priorityLevel: ThreadAnalysis["priority"]["level"] = level;
  log("Priority classified", {
    level: priorityLevel,
    score: Math.min(score, 100),
    reasonCount: reasons.length
  });

  return {
    level: priorityLevel,
    score: Math.min(score, 100),
    reasons: reasons.length > 0 ? reasons : ["Looks routine and low risk"]
  };
}

function extractTasks(thread: RawThread) {
  const tasks = thread.messages.flatMap((message: RawThread["messages"][number], messageIndex: number) => {
    const sentences = message.body.split(/(?<=[.!?])\s+/);
    return sentences
      .filter((sentence: string) => /(please|need|review|confirm|share|send|update|respond|prepare)/i.test(sentence))
      .map((sentence: string, index: number) => ({
        id: `${thread.threadId}-task-${messageIndex + 1}-${index + 1}`,
        description: sentence.trim(),
        deadline: inferDeadline(sentence, message.date),
        confidence: sentence.length > 55 ? 0.86 : 0.73,
        status: "pending" as const
      }));
  });

  log(`Extracted tasks for ${thread.threadId}`, {
    extracted: tasks.length,
    fallbackUsed: tasks.length === 0
  });

  return tasks.length > 0
    ? tasks
    : [
        {
          id: `${thread.threadId}-task-1`,
          description: `Review ${thread.subject}`,
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

function generateDraft(thread: RawThread, level: string) {
  const formal = /client|invoice|finance|contract|proposal/i.test(thread.subject) || level === "urgent";
  const name = thread.from.split(" <")[0] || "there";
  log(`Generated draft for ${thread.threadId}`, {
    tone: formal ? "formal" : "casual",
    requiresApproval: /legal|payment|invoice|contract|sensitive/i.test(thread.subject + " " + thread.snippet)
  });

  return {
    tone: formal ? "formal" as const : "casual" as const,
    body: formal
      ? `Hi ${name},\n\nThanks for the note. I reviewed the thread and will confirm the requested next steps shortly. If there is a deadline or attachment you want us to prioritize first, send it over and I will incorporate it.\n\nBest regards,\nInboxPilot`
      : `Hi ${name},\n\nThanks for reaching out. I saw the request and I am checking the details now. I will reply with the next step soon.\n\nBest,\nInboxPilot`,
    requiresApproval: /legal|payment|invoice|contract|sensitive/i.test(thread.subject + " " + thread.snippet)
  };
}