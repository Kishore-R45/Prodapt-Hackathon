import type { RawThread } from "../types/contracts.js";

export function summarizeThread(thread: RawThread): string[] {
  const sentences = thread.messages
    .flatMap((message: RawThread["messages"][number]) => message.body.split(/(?<=[.!?])\s+/))
    .map((sentence: string) => sentence.trim())
    .filter(Boolean);

  return sentences.slice(0, 4).length > 0 ? sentences.slice(0, 4) : [thread.snippet];
}