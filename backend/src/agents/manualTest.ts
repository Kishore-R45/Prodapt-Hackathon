import dotenv from "dotenv";
dotenv.config();

import { generateDraft } from "./draftGenerator.agent";
import { RawThread } from "../types/contracts";

async function runManualTests() {
  const test1: RawThread = {
    threadId: "t1",
    subject: "Quick question about the deploy",
    messages: [
      {
        from: "raj@mycompany.com",
        body: "Hey, did you push the latest changes to staging yet? Also, are we still meeting at 3pm?",
        date: "2026-08-08",
      },
    ],
    senderDomain: "mycompany.com",
    recipients: { to: ["me@mycompany.com"], cc: [] },
    existingDraft: null,
  };

  const test2: RawThread = {
    threadId: "t2",
    subject: "Regarding invoice dispute",
    messages: [
      {
        from: "client@externalco.com",
        body: "We believe this invoice is incorrect and are considering escalating this to our legal team if not resolved by Friday.",
        date: "2026-08-08",
      },
    ],
    senderDomain: "externalco.com",
    recipients: { to: ["me@mycompany.com"], cc: ["manager@mycompany.com"] },
    existingDraft: null,
  };

  const test3: RawThread = {
    threadId: "t3",
    subject: "Follow up on proposal",
    messages: [
      {
        from: "client@externalco.com",
        body: "Can you send the updated proposal by tomorrow?",
        date: "2026-08-08",
      },
    ],
    senderDomain: "externalco.com",
    recipients: { to: ["me@mycompany.com"], cc: [] },
    existingDraft: "Hi, I'll send it over shortly.",
  };

  const userDomain = "mycompany.com";

  console.log("Starting manual draftGenerator tests...");

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const res1 = await generateDraft(test1, userDomain);
  console.log("\n--- TEST 1: Internal casual email ---");
  console.log(JSON.stringify(res1, null, 2));

  await sleep(2000);

  const res2 = await generateDraft(test2, userDomain);
  console.log("\n--- TEST 2: External formal, sensitive content ---");
  console.log(JSON.stringify(res2, null, 2));

  await sleep(2000);

  const res3 = await generateDraft(test3, userDomain);
  console.log("\n--- TEST 3: Existing draft conflict ---");
  console.log(JSON.stringify(res3, null, 2));
}

runManualTests().catch((err) => {
  console.error("Error running manual tests:", err);
});
