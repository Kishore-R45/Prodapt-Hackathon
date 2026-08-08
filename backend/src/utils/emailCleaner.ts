/**
 * Strips quoted/forwarded reply chains and common signature blocks from an
 * email body so the summarizer only sees "new" content.
 * README 9.2 edge case: "Thread is mostly quoted/forwarded text".
 */
export function stripQuotedAndSignature(body: string): string {
  if (!body) return "";

  let text = body.replace(/\r\n/g, "\n");

  // Drop classic ">" quoted blocks (plain-text quoting)
  text = text
    .split("\n")
    .filter((line) => !line.trim().startsWith(">"))
    .join("\n");

  // Cut everything from the first "On ... wrote:" / "-----Original Message-----"
  // style quote header onward — these mark the start of a forwarded/quoted chain.
  const quoteHeaderPatterns = [
    /On .{5,80} wrote:\s*$/im,
    /-{2,}\s*Original Message\s*-{2,}/i,
    /From:\s?.+\nSent:\s?.+\nTo:\s?.+\nSubject:\s?.+/i,
    /_{5,}\nFrom:/i,
  ];
  for (const pattern of quoteHeaderPatterns) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      text = text.slice(0, match.index);
    }
  }

  // Trim common signature delimiters ("-- ", "Sent from my iPhone", "Regards,")
  const sigPatterns = [
    /\n--\s*\n[\s\S]*$/,
    /\nSent from my (iPhone|iPad|Android|Galaxy)[\s\S]*$/i,
    /\n(Regards|Best regards|Best|Thanks|Thank you|Cheers|Sincerely),?\s*\n[\s\S]{0,200}$/i,
  ];
  for (const pattern of sigPatterns) {
    text = text.replace(pattern, "");
  }

  return text.trim();
}

/** True if a cleaned body has no meaningful text left (attachment-only case). */
export function isEffectivelyEmpty(body: string): boolean {
  return body.replace(/\s/g, "").length < 3;
}
