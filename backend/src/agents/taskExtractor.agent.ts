import type { RawThread } from "../types/contracts.js";

export function extractTasks(thread: RawThread) {
  const tasks = thread.messages.flatMap((message: RawThread["messages"][number], messageIndex: number) => {
    const sentences = message.body.split(/(?<=[.!?])\s+/);
    return sentences
      .filter((sentence: string) => /(please|need|review|confirm|share|send|update|respond|prepare)/i.test(sentence))
      .map((sentence: string, index: number) => ({
        id: `${thread.threadId}-task-${messageIndex + 1}-${index + 1}`,
        description: sentence.trim(),
        deadline: null,
        confidence: sentence.length > 55 ? 0.86 : 0.73,
        status: "pending" as const
      }));
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