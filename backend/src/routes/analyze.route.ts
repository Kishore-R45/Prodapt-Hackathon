import { Router } from "express";
import { z } from "zod";
import type { RawThread } from "../types/contracts.js";
import { orchestrateAnalysis } from "../orchestrator/orchestrator.service.js";

const messageSchema = z.object({
  id: z.string(),
  sender: z.string(),
  subject: z.string(),
  body: z.string(),
  date: z.string()
});

const threadSchema = z.object({
  threadId: z.string(),
  subject: z.string(),
  from: z.string(),
  snippet: z.string(),
  unread: z.boolean(),
  date: z.string(),
  messages: z.array(messageSchema)
});

const requestSchema = z.object({
  threads: z.array(threadSchema)
});

export const analyzeRouter = Router();

function log(message: string, details?: unknown): void {
  if (details === undefined) {
    console.log(`[analyze] ${message}`);
    return;
  }

  console.log(`[analyze] ${message}`, details);
}

function logError(message: string, error: unknown): void {
  console.error(`[analyze] ${message}`);
  if (error instanceof Error) {
    console.error(error.stack ?? error.message);
    return;
  }

  console.error(error);
}

analyzeRouter.post("/analyze", (request, response) => {
  log("Analyze request received", {
    threadCount: Array.isArray(request.body?.threads) ? request.body.threads.length : 0
  });

  const parsed = requestSchema.safeParse(request.body);
  if (!parsed.success) {
    logError("Invalid analyze payload", parsed.error.flatten());
    return response.status(400).json({ ok: false, error: "Invalid thread payload." });
  }

  const threads = parsed.data.threads as RawThread[];
  try {
    const analyses = threads.map((thread) => orchestrateAnalysis(thread));
    log("Analyze request completed", {
      analyzedThreads: analyses.length,
      threadIds: analyses.map((analysis) => analysis.threadId)
    });
    return response.json({ analyses });
  } catch (error) {
    logError("Analyze request crashed", error);
    return response.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Analyze failed" });
  }
});