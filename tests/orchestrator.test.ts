import { describe, it, expect } from "vitest";
import { canAssign, allowedTargets, TEAM_ORDER } from "@/lib/roles";
import { facilitatedRole, parseBlocks } from "@/lib/run";
import { ROLE_PROMPTS } from "@/lib/prompts";
import {
  ParticipantSchema,
  TokenIssueSchema,
  RunStartSchema,
  TaskProposalSchema,
} from "@/lib/schemas";

describe("facilitatedRole turn mapping", () => {
  it("orchestrator hosts every even turn", () => {
    expect(facilitatedRole(0)).toBe("orchestrator");
    expect(facilitatedRole(2)).toBe("orchestrator");
    expect(facilitatedRole(4)).toBe("orchestrator");
    expect(facilitatedRole(10)).toBe("orchestrator");
  });
  it("product and engineer interleave on odd turns", () => {
    expect(facilitatedRole(1)).toBe("product");
    expect(facilitatedRole(5)).toBe("product");
    expect(facilitatedRole(9)).toBe("product");
    expect(facilitatedRole(3)).toBe("engineer");
    expect(facilitatedRole(7)).toBe("engineer");
    expect(facilitatedRole(11)).toBe("engineer");
  });
});

describe("parseBlocks orchestrator-state", () => {
  it("extracts and strips a valid orchestrator-state block", () => {
    const raw =
      '@product, you said onboarding takes weeks. Which user told you that?\n' +
      '```orchestrator-state\n' +
      '{"phase": "USER_RESEARCH", "confidence": "LOW", "openQuestions": ["evidence?"], "keyDecisions": []}\n' +
      '```';
    const p = parseBlocks(raw);
    expect(p.orchestratorState).toEqual({
      phase: "USER_RESEARCH",
      confidence: "LOW",
      openQuestions: ["evidence?"],
      keyDecisions: [],
    });
    expect(p.text).not.toContain("orchestrator-state");
    expect(p.text).toContain("@product");
  });
  it("ignores malformed orchestrator-state JSON gracefully", () => {
    const p = parseBlocks('```orchestrator-state\n{not json\n```');
    expect(p.orchestratorState).toBeUndefined();
    expect(p.text).not.toContain("orchestrator-state");
  });
  it("leaves other blocks untouched when no state block present", () => {
    const raw = '```brief-proposal\n{"baseVersion": 1, "newText": "x"}\n```';
    const p = parseBlocks(raw);
    expect(p.orchestratorState).toBeUndefined();
    expect(p.briefProposal).toEqual({ baseVersion: 1, newText: "x" });
  });
});

describe("orchestrator role matrix", () => {
  it("orchestrator can assign plan/critique to product and engineer", () => {
    expect(canAssign("orchestrator", "product", "plan")).toBe(true);
    expect(canAssign("orchestrator", "product", "critique")).toBe(true);
    expect(canAssign("orchestrator", "engineer", "plan")).toBe(true);
    expect(canAssign("orchestrator", "engineer", "critique")).toBe(true);
  });
  it("nobody can assign TO the orchestrator", () => {
    expect(canAssign("product", "orchestrator", "plan")).toBe(false);
    expect(canAssign("engineer", "orchestrator", "critique")).toBe(false);
    expect(canAssign("reviewer", "orchestrator", "review")).toBe(false);
    expect(canAssign("orchestrator", "orchestrator", "plan")).toBe(false);
  });
  it("reviewer cannot assign to orchestrator; orchestrator is not a task target", () => {
    expect(allowedTargets("reviewer")).toEqual([]);
    const r = TaskProposalSchema.safeParse({ to: "orchestrator", taskType: "plan", description: "x" });
    expect(r.success).toBe(false);
  });
  it("allowedTargets lists orchestrator delegations", () => {
    expect(allowedTargets("orchestrator")).toEqual([
      { to: "product", types: ["plan", "critique"] },
      { to: "engineer", types: ["plan", "critique"] },
    ]);
  });
  it("team order is unchanged", () => {
    expect(TEAM_ORDER).toEqual(["product", "engineer", "reviewer"]);
  });
});

describe("orchestrator prompt", () => {
  it("ROLE_PROMPTS.orchestrator exists with state block and PRD instructions", () => {
    const p = ROLE_PROMPTS.orchestrator;
    expect(p).toContain("orchestrator-state");
    expect(p).toContain("PRD");
    expect(p).toContain("NEVER answer product or engineering questions yourself");
    expect(p).toContain("USER_RESEARCH");
  });
});

describe("schemas accept orchestrator role and facilitated mode", () => {
  it("ParticipantSchema accepts orchestrator", () => {
    const r = ParticipantSchema.safeParse({
      agentId: "orchestrator-1", role: "orchestrator",
      providerLabel: "vertex-ai", adapterType: "vertex",
    });
    expect(r.success).toBe(true);
  });
  it("TokenIssueSchema accepts orchestrator", () => {
    const r = TokenIssueSchema.safeParse({
      roomId: "r1", agentId: "orchestrator-1", role: "orchestrator", expiresInDays: 30,
    });
    expect(r.success).toBe(true);
  });
  it("RunStartSchema accepts facilitated mode", () => {
    const r = RunStartSchema.safeParse({ roomId: "r1", mode: "facilitated", autoDraft: true });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.mode).toBe("facilitated");
  });
  it("RunStartSchema still accepts team and single", () => {
    expect(RunStartSchema.safeParse({ roomId: "r1", mode: "team", autoDraft: false }).success).toBe(true);
    expect(RunStartSchema.safeParse({ roomId: "r1", mode: "single", autoDraft: false }).success).toBe(true);
  });
});
