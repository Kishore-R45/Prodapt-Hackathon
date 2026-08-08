import { RawMessage, RawThread } from "../types/contracts";

/** README 9.3: "Marketing email with fake urgency" -> down-weight regardless of keyword urgency. */
export function isLikelyBulkSender(msg: RawMessage): boolean {
  if (msg.listUnsubscribe) return true;
  const bulkPatterns = [/no-?reply@/i, /newsletter@/i, /marketing@/i, /promotions@/i, /notifications@/i];
  return bulkPatterns.some((p) => p.test(msg.from));
}

/** README 9.3: system/no-reply emails routed to a low-noise bucket, excluded from urgent scoring. */
export function isSystemEmail(msg: RawMessage): boolean {
  const systemPatterns = [
    /no-?reply@/i,
    /^ci@|@buildci|@github|@gitlab|jenkins@|calendar-notification@|invite@/i,
  ];
  return systemPatterns.some((p) => p.test(msg.from));
}

/** README 9.3: user CC'd, not primary recipient -> automatic priority discount. */
export function isUserCCdOnly(thread: RawThread): boolean {
  const latest = thread.messages[thread.messages.length - 1];
  const isTo = latest.to.some((addr) => addr.toLowerCase() === thread.userEmail.toLowerCase());
  const isCc = (latest.cc ?? []).some((addr) => addr.toLowerCase() === thread.userEmail.toLowerCase());
  return isCc && !isTo;
}

/** Cheap keyword check used only to decide whether to ask the LLM for escalation-language scoring at all. */
export function hasUrgencyLanguage(text: string): boolean {
  return /\b(urgent|asap|immediately|deadline|escalat(e|ion)|critical|emergency)\b/i.test(text);
}
