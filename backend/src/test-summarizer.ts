import "dotenv/config";
import fs from "fs";
import path from "path";
import { summarizeThreads } from "./agents/summarizer.agent";
import { RawThread } from "./types/contracts";

async function main() {
  const fixturePath = path.join(__dirname, "../../fixtures/sample-threads.json");
  const threads: RawThread[] = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));

  console.log(`Summarizing ${threads.length} thread(s)...\n`);
  const results = await summarizeThreads(threads);

  for (const r of results) {
    console.log(`--- Thread: ${r.threadId} ---`);
    console.log(`messages: ${r.meta.messageCount} | chunked: ${r.meta.wasChunked}` +
      (r.meta.skippedReason ? ` | skipped: ${r.meta.skippedReason}` : ""));
    r.summary.forEach((b) => console.log(`  • ${b}`));
    console.log();
  }
}

main().catch((err) => {
  console.error("Test run failed:", err);
  process.exit(1);
});
