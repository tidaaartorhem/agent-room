import { z } from "zod";
import { CONFIG } from "./config";

const textField = z.string().min(1).max(CONFIG.textLimitChars);

export const RoomCreateSchema = z.object({
  goal: z.string().min(1).max(2000),
  autoDraftDefault: z.boolean().optional().default(false),
});

export const ParticipantSchema = z.object({
  agentId: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  role: z.enum(["product", "engineer", "reviewer", "single", "orchestrator"]),
  providerLabel: z.string().min(1).max(80),
  adapterType: z.enum(["vertex", "external", "synthetic"]),
});

export const MessagePostSchema = z.object({
  text: textField,
  replyTo: z.string().max(128).optional(),
  taskId: z.string().max(128).optional(),
  kind: z.enum(["message", "task_result"]).optional().default("message"),
});

export const ReactionToggleSchema = z.object({
  emoji: z.string().min(1).max(16),
});

export const TaskProposalSchema = z.object({
  to: z.enum(["product", "engineer", "reviewer"]),
  taskType: z.enum(["plan", "critique", "review"]),
  description: z.string().min(1).max(4000),
});

export const BriefProposalSchema = z.object({
  baseVersion: z.number().int().min(0),
  newText: z.string().min(1).max(CONFIG.textLimitChars),
});

export const RunStartSchema = z.object({
  roomId: z.string().min(1).max(128),
  mode: z.enum(["team", "single", "facilitated"]).default("team"),
  // Declared, revocable run policy: accepted internal brief proposals may
  // auto-update the TEAM DRAFT (never owner decisions). Shown at Start.
  autoDraft: z.boolean().default(false),
});

export const DecisionPostSchema = z.object({
  text: z.string().min(1).max(4000),
  scope: z.string().max(200).optional(),
  cardId: z.string().max(128).optional(),
  chosenOption: z.string().max(200).optional(),
});

export const ChallengePostSchema = z.object({
  topic: z.string().min(1).max(2000),
});

export const TokenIssueSchema = z.object({
  roomId: z.string().min(1).max(128),
  agentId: z.string().min(1).max(64),
  role: z.enum(["product", "engineer", "reviewer", "single", "orchestrator"]),
  expiresInDays: z.number().int().min(1).max(90).default(30),
});

export function badRequest(msg: string): Response {
  return Response.json({ error: msg }, { status: 400 });
}
export function unauthorized(msg = "unauthorized"): Response {
  // Generic: never leak whether a room/token exists.
  return Response.json({ error: msg }, { status: 401 });
}
export function forbidden(msg = "forbidden"): Response {
  return Response.json({ error: msg }, { status: 403 });
}
export function conflict(msg: string): Response {
  return Response.json({ error: msg }, { status: 409 });
}
export function tooLarge(): Response {
  return Response.json({ error: "payload too large" }, { status: 413 });
}
export function throttled(retryAfterSec: number): Response {
  return Response.json(
    { error: "rate limited" },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}
