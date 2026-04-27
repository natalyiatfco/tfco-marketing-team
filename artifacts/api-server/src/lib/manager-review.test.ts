import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@workspace/db", () => {
  const agentsTable = { role: "role_col" };
  const tasksTable = { id: "id_col" };
  const reviewsTable = {};

  const mockDb = {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  };

  return { db: mockDb, agentsTable, tasksTable, reviewsTable, fetchMemoryContext: vi.fn().mockResolvedValue("") };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
  buildSystemPrompt: vi.fn((base: string) => base),
}));

vi.mock("./logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { db } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { runManagerReview } from "./manager-review";

const mockDb = db as unknown as {
  select: Mock;
  update: Mock;
  insert: Mock;
};

const mockCreate = openai.chat.completions.create as Mock;

function makeSelectChain(result: unknown[]) {
  const limitFn = vi.fn().mockResolvedValue(result);
  const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
  const fromFn = vi.fn().mockReturnValue({ where: whereFn });
  mockDb.select.mockReturnValue({ from: fromFn });
  return { fromFn, whereFn, limitFn };
}

function makeUpdateChain() {
  const whereFn = vi.fn().mockResolvedValue(undefined);
  const setFn = vi.fn().mockReturnValue({ where: whereFn });
  mockDb.update.mockReturnValue({ set: setFn });
  return { setFn, whereFn };
}

function makeInsertChain() {
  const valuesFn = vi.fn().mockResolvedValue(undefined);
  mockDb.insert.mockReturnValue({ values: valuesFn });
  return { valuesFn };
}

const MANAGER_AGENT = {
  id: 1,
  role: "manager",
  name: "Manager",
  systemPrompt: "You are a manager.",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runManagerReview", () => {
  describe("happy path", () => {
    it("inserts a review row and sets task status to completed", async () => {
      makeSelectChain([MANAGER_AGENT]);
      const { setFn: updateSetFn } = makeUpdateChain();
      const { valuesFn: insertValuesFn } = makeInsertChain();

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "Score: 8\nGreat work overall." } }],
      });

      await runManagerReview(42, 1, "Agent output", "Blog Agent", "writer", "Write a blog post");

      expect(insertValuesFn).toHaveBeenCalledOnce();
      const insertCall = insertValuesFn.mock.calls[0][0];
      expect(insertCall).toMatchObject({
        taskId: 42,
        managerFeedback: "Score: 8\nGreat work overall.",
        managerScore: 8,
      });

      expect(updateSetFn).toHaveBeenCalledWith(
        expect.objectContaining({ status: "completed" })
      );
    });

    it("passes feedback text to the review row", async () => {
      makeSelectChain([MANAGER_AGENT]);
      makeUpdateChain();
      const { valuesFn } = makeInsertChain();

      const feedbackText = "Rating: 7\nSolid effort with some areas to improve.";
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: feedbackText } }],
      });

      await runManagerReview(1, 1, "output", "Agent", "role", "task");

      expect(valuesFn).toHaveBeenCalledWith(
        expect.objectContaining({ managerFeedback: feedbackText })
      );
    });
  });

  describe("score extraction edge cases", () => {
    async function reviewWithFeedback(feedback: string) {
      makeSelectChain([MANAGER_AGENT]);
      makeUpdateChain();
      const { valuesFn } = makeInsertChain();

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: feedback } }],
      });

      await runManagerReview(1, 1, "output", "Agent", "role", "task");
      return valuesFn.mock.calls[0][0];
    }

    it("extracts score from 'Score: N' pattern", async () => {
      const row = await reviewWithFeedback("Score: 9\nExcellent.");
      expect(row.managerScore).toBe(9);
    });

    it("extracts score from 'Rating: N' pattern", async () => {
      const row = await reviewWithFeedback("Rating: 5\nOkay.");
      expect(row.managerScore).toBe(5);
    });

    it("sets managerScore to null when no score pattern is found", async () => {
      const row = await reviewWithFeedback("No numeric score here at all.");
      expect(row.managerScore).toBeNull();
    });

    it("sets managerScore to null when score is below 1", async () => {
      const row = await reviewWithFeedback("Score: 0\nInvalid.");
      expect(row.managerScore).toBeNull();
    });

    it("sets managerScore to null when score is above 10", async () => {
      const row = await reviewWithFeedback("Score: 11\nOut of range.");
      expect(row.managerScore).toBeNull();
    });

    it("sets managerScore to null when LLM returns empty content", async () => {
      const row = await reviewWithFeedback("");
      expect(row.managerScore).toBeNull();
    });
  });

  describe("missing manager agent", () => {
    it("does not insert a review row", async () => {
      makeSelectChain([]);
      makeUpdateChain();

      await runManagerReview(99, 1, "output", "Agent", "role", "task");

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("sets task status to failed", async () => {
      makeSelectChain([]);
      const { setFn } = makeUpdateChain();

      await runManagerReview(99, 1, "output", "Agent", "role", "task");

      expect(setFn).toHaveBeenCalledWith(
        expect.objectContaining({ status: "failed" })
      );
    });

    it("does not call the LLM", async () => {
      makeSelectChain([]);
      makeUpdateChain();

      await runManagerReview(99, 1, "output", "Agent", "role", "task");

      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe("LLM call throws", () => {
    it("sets task status to failed", async () => {
      makeSelectChain([MANAGER_AGENT]);
      const { setFn } = makeUpdateChain();

      mockCreate.mockRejectedValue(new Error("OpenAI timeout"));

      await runManagerReview(7, 1, "output", "Agent", "role", "task");

      expect(setFn).toHaveBeenCalledWith(
        expect.objectContaining({ status: "failed" })
      );
    });

    it("does not insert a review row when LLM throws", async () => {
      makeSelectChain([MANAGER_AGENT]);
      makeUpdateChain();

      mockCreate.mockRejectedValue(new Error("OpenAI timeout"));

      await runManagerReview(7, 1, "output", "Agent", "role", "task");

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("does not throw — error is caught internally", async () => {
      makeSelectChain([MANAGER_AGENT]);
      makeUpdateChain();

      mockCreate.mockRejectedValue(new Error("Network error"));

      await expect(
        runManagerReview(7, 1, "output", "Agent", "role", "task")
      ).resolves.toBeUndefined();
    });
  });
});
