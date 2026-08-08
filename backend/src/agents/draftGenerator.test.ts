import { generateDraft } from "./draftGenerator.agent";
import { RawThread } from "../types/contracts";
import { GoogleGenerativeAI } from "@google/generative-ai";

jest.mock("@google/generative-ai");

describe("draftGenerator.agent", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, GEMINI_API_KEY: "mock-gemini-key" };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it("should set requiresApproval to true when thread contains legal/dispute language", async () => {
    const mockGenerateContent = jest.fn().mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            tone: "formal",
            body: "We have received your email regarding the dispute.",
            requiresApproval: false,
          }),
      },
    });

    (GoogleGenerativeAI as unknown as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: mockGenerateContent,
      }),
    }));

    const legalThread: RawThread = {
      threadId: "thread-legal-01",
      subject: "Urgent: Breach of contract & lawsuit threat",
      messages: [
        {
          from: "attorney@partner.com",
          body: "We are considering legal action regarding this refund dispute.",
          date: "2026-08-08T09:00:00Z",
        },
      ],
      senderDomain: "partner.com",
    };

    const result = await generateDraft(legalThread, "company.com");

    expect(result.requiresApproval).toBe(true);
    expect(result.tone).toBe("formal");
  });

  it("should infer tone as casual when sender domain matches user domain", async () => {
    const mockGenerateContent = jest.fn().mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            tone: "casual",
            body: "Hey, thanks for reaching out! I will check the docs.",
            requiresApproval: false,
          }),
      },
    });

    (GoogleGenerativeAI as unknown as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: mockGenerateContent,
      }),
    }));

    const sameDomainThread: RawThread = {
      threadId: "thread-internal-02",
      subject: "Team sync today?",
      messages: [
        {
          from: "colleague@company.com",
          body: "Hey, do you have time to chat about the new sprint goals?",
          date: "2026-08-08T09:30:00Z",
        },
      ],
      senderDomain: "company.com",
    };

    const result = await generateDraft(sameDomainThread, "company.com");

    expect(result.tone).toBe("casual");
    expect(result.requiresApproval).toBe(false);
  });
});
