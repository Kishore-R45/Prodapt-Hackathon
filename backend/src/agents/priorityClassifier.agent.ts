export function classifyPriority(text: string) {
  let score = 22;

  if (/(urgent|asap|immediately|escalat)/i.test(text)) score += 36;
  if (/(deadline|due|tomorrow|today|friday|monday|eod)/i.test(text)) score += 28;
  if (/\?/.test(text)) score += 10;
  if (/(invoice|client|launch|release|payment|blocked)/i.test(text)) score += 12;
  if (/(conflict|mismatch|contradict)/i.test(text)) score += 20;

  const level = score >= 90 ? "urgent" : score >= 70 ? "high" : score >= 45 ? "medium" : "low";
  const reasons = [
    /(urgent|asap|immediately|escalat)/i.test(text) ? "Contains urgent or escalation language" : null,
    /(deadline|due|tomorrow|today|friday|monday|eod)/i.test(text) ? "Has a deadline or near-term ask" : null,
    /\?/.test(text) ? "Requests a response or decision" : null,
    /(invoice|client|launch|release|payment|blocked)/i.test(text) ? "Touches a sensitive or work-critical topic" : null,
    /(conflict|mismatch|contradict)/i.test(text) ? "Signals a conflict or mismatch" : null
  ].filter((reason): reason is string => Boolean(reason));

  return {
    level,
    score: Math.min(score, 100),
    reasons: reasons.length > 0 ? reasons : ["Looks routine and low risk"]
  };
}