import { describe, it, expect } from "vitest";
import { canAssign, allowedTargets, TEAM_ORDER } from "@/lib/roles";
import { unifiedDiff, parseBlocks } from "@/lib/run";
import { checkRate } from "@/lib/ratelimit";
import {
  TaskProposalSchema,
  BriefProposalSchema,
  MessagePostSchema,
} from "@/lib/schemas";

describe("role matrix (server-owned)", () => {
  it("product can assign plan/critique to engineer", () => {
    expect(canAssign("product", "engineer", "plan")).toBe(true);
    expect(canAssign("product", "engineer", "critique")).toBe(true);
  });
  it("product can assign critique to reviewer, not review", () => {
    expect(canAssign("product", "reviewer", "critique")).toBe(true);
    expect(canAssign("product", "reviewer", "review")).toBe(false);
  });
  it("engineer can only request review from reviewer", () => {
    expect(canAssign("engineer", "reviewer", "review")).toBe(true);
    expect(canAssign("engineer", "product", "plan")).toBe(false);
    expect(canAssign("engineer", "engineer", "plan")).toBe(false);
  });
  it("reviewer cannot assign anything", () => {
    expect(allowedTargets("reviewer")).toEqual([]);
    expect(canAssign("reviewer", "engineer", "plan")).toBe(false);
  });
  it("forged roles get nothing", () => {
    expect(canAssign("owner" as never, "engineer", "plan")).toBe(false);
    expect(canAssign("admin" as never, "reviewer", "review")).toBe(false);
  });
  it("team order is product, engineer, reviewer", () => {
    expect(TEAM_ORDER).toEqual(["product", "engineer", "reviewer"]);
  });
});

describe("unifiedDiff", () => {
  it("marks added and removed lines", () => {
    const d = unifiedDiff("a\nb\nc", "a\nB\nc\nd");
    expect(d).toContain("- b");
    expect(d).toContain("+ B");
    expect(d).toContain("+ d");
  });
  it("empty diff for identical text", () => {
    expect(unifiedDiff("x", "x")).toBe("");
  });
});

describe("parseBlocks", () => {
  it("extracts and strips a task-proposal block", () => {
    const raw = 'Some prose.\n```task-proposal\n{"to":"engineer","taskType":"plan","description":"do it"}\n```\nMore prose.';
    const p = parseBlocks(raw);
    expect(p.taskProposal).toEqual({ to: "engineer", taskType: "plan", description: "do it" });
    expect(p.text).not.toContain("task-proposal");
    expect(p.text).toContain("Some prose.");
  });
  it("extracts brief-proposal with baseVersion", () => {
    const raw = '```brief-proposal\n{"baseVersion": 2, "newText": "hello"}\n```';
    const p = parseBlocks(raw);
    expect(p.briefProposal).toEqual({ baseVersion: 2, newText: "hello" });
  });
  it("ignores malformed JSON blocks (no crash, no proposal)", () => {
    const p = parseBlocks('```task-proposal\n{not json\n```');
    expect(p.taskProposal).toBeUndefined();
  });
  it("a forged assignedBy inside the block is not honored (schema has no such field)", () => {
    const raw = '```task-proposal\n{"to":"engineer","taskType":"plan","description":"x","assignedBy":"mallory"}\n```';
    const parsed = TaskProposalSchema.safeParse(JSON.parse('{"to":"engineer","taskType":"plan","description":"x","assignedBy":"mallory"}'));
    expect(parsed.success).toBe(true); // zod strips unknown keys
    expect((parsed.data as Record<string, unknown>).assignedBy).toBeUndefined();
    void raw;
  });
});

describe("schemas enforce limits", () => {
  it("rejects oversized message text", () => {
    const r = MessagePostSchema.safeParse({ text: "x".repeat(16001) });
    expect(r.success).toBe(false);
  });
  it("rejects oversized brief", () => {
    const r = BriefProposalSchema.safeParse({ baseVersion: 0, newText: "x".repeat(16001) });
    expect(r.success).toBe(false);
  });
  it("rejects negative baseVersion", () => {
    const r = BriefProposalSchema.safeParse({ baseVersion: -1, newText: "x" });
    expect(r.success).toBe(false);
  });
});

describe("rate limiter", () => {
  it("allows up to the write limit then throttles", () => {
    const id = `test-${Date.now()}`;
    for (let i = 0; i < 10; i++) expect(checkRate(id, "write").ok).toBe(true);
    // burst of 5 allowed, then hard stop
    for (let i = 0; i < 5; i++) checkRate(id, "write");
    expect(checkRate(id, "write").ok).toBe(false);
  });
});

describe("idempotency result sanitizer", () => {
  it("strips undefined fields so Firestore .set() never throws", async () => {
    const { cleanForFirestore } = await import("@/lib/idempotency");
    const cleaned = cleanForFirestore({ applied: false, held: true, version: undefined });
    expect(cleaned).toEqual({ applied: false, held: true });
    expect("version" in (cleaned as object)).toBe(false);
  });
  it("strips nested undefined and maps top-level undefined to null", async () => {
    const { cleanForFirestore } = await import("@/lib/idempotency");
    expect(cleanForFirestore({ a: { b: undefined, c: 1 } })).toEqual({ a: { c: 1 } });
    expect(cleanForFirestore(undefined)).toBe(null);
  });
});

