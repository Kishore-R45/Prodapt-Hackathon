import "dotenv/config";
import fs from "fs";
import path from "path";
import { classifyPriority, ThreadTaskCandidate } from "./agents/priorityClassifier.agent";
import { RawThread, ExistingTask } from "./types/contracts";

interface FixtureFile {
  userEmail: string;
  existingTasks: ExistingTask[];
  threads: (RawThread & { newTasksInThread?: ThreadTaskCandidate[] })[];
}

async function main() {
  const fixturePath = path.join(__dirname, "../../fixtures/sample-priority-threads.json");
  const data: FixtureFile = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));

  console.log(`Classifying ${data.threads.length} thread(s)...\n`);

  for (const thread of data.threads) {
    const result = await classifyPriority(thread, data.existingTasks, thread.newTasksInThread ?? []);
    console.log(`--- Thread: ${result.threadId} ---`);
    console.log(`level: ${result.priority.level.toUpperCase()} | score: ${result.priority.score}`);
    result.priority.reasons.forEach((r) => console.log(`  • ${r}`));
    if (result.conflicts.length > 0) {
      console.log(`  conflicts:`);
      result.conflicts.forEach((c) => console.log(`    ↳ vs ${c.withTaskId}: ${c.reason}`));
    }
    console.log();
  }
}

main().catch((err) => {
  console.error("Test run failed:", err);
  process.exit(1);
});
