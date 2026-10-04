// Non-secret project configuration. No keys here: server auth uses ADC
// (App Hosting service account), agent auth uses issued bearer tokens.
export const CONFIG = {
  projectId: "truth-or-shots",
  vertexLocation: "us-east4",
  vertexModel: "gemini-2.5-flash",
  // Spec defaults
  maxAgents: 3,
  maxTurns: 12,
  maxRounds: 3,
  maxConcurrent: 2,
  turnTimeoutMs: 2 * 60 * 1000,
  runTimeoutMs: 10 * 60 * 1000,
  maxOutputTokensPerTurn: 2000,
  maxOutputTokensPerRun: 12000,
  maxInputTokensPerCall: 16000,
  maxQueue: 6,
  bodyLimitBytes: 64 * 1024,
  textLimitChars: 16000,
  rateReadPerMin: 60,
  rateWritePerMin: 10,
  rateRoomWritePerMin: 30,
} as const;

export type Role = "product" | "engineer" | "reviewer" | "single" | "owner" | "orchestrator";
export type AgentRole = "product" | "engineer" | "reviewer" | "single" | "orchestrator";
export type RunMode = "team" | "single" | "facilitated";
export type RunState =
  | "idle" | "running" | "paused" | "completed" | "stopped" | "error" | "budget_exhausted";
export type TurnState =
  | "queued" | "accepted" | "working" | "waiting" | "completed" | "cancelled" | "error" | "timed_out";
export type TaskType = "plan" | "critique" | "review";
export type MessageKind =
  | "message" | "task_assignment" | "task_result" | "brief_revision"
  | "decision" | "disagreement_card" | "system" | "stale_proposal";
