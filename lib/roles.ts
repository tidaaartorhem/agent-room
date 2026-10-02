import type { AgentRole, TaskType } from "./config";

export type AssignableRole = "product" | "engineer" | "reviewer";

/**
 * Server-owned role permission matrix. Model text NEVER grants authority;
 * every delegation is validated here before dispatch.
 */
const MATRIX: Record<AssignableRole, { to: AssignableRole; types: TaskType[] }[]> = {
  product: [
    { to: "engineer", types: ["plan", "critique"] },
    { to: "reviewer", types: ["critique"] },
  ],
  engineer: [{ to: "reviewer", types: ["review"] }],
  reviewer: [],
};

export function canAssign(from: AgentRole, to: string, type: string): boolean {
  if (from !== "product" && from !== "engineer" && from !== "reviewer") return false;
  const rows = MATRIX[from as AssignableRole];
  return rows.some((r) => r.to === to && (r.types as string[]).includes(type));
}

export function allowedTargets(from: AgentRole): { to: AssignableRole; types: TaskType[] }[] {
  if (from !== "product" && from !== "engineer" && from !== "reviewer") return [];
  return MATRIX[from as AssignableRole];
}

/** Roles in canonical turn order for team mode. */
export const TEAM_ORDER: AssignableRole[] = ["product", "engineer", "reviewer"];
