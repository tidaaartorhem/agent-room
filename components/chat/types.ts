"use client";

export interface Participant {
  id: string; agentId: string; role: string;
  providerLabel: string; adapterType: string; createdAt: number;
}
export interface ChatMessage {
  id: string; agentId?: string; role?: string; kind: string;
  text: string; contextVersion?: number; status?: string; createdAt: number;
  replyTo?: string | null;
  reactions?: Record<string, string[]>;
  card?: {
    agreement: string[]; disagreement: string[];
    evidence: { claim: string; from: string }[];
    options: { id: string; title: string; tradeoffs: string }[];
    recommendation: string;
  };
  topic?: string; proposedText?: string;
}
export interface ChatTask {
  id: string; assignedBy: string; assignedTo: string; toRole: string;
  taskType: string; description: string; state: string; contextVersion: number;
  result?: string; createdAt: number;
}
export interface ChatBrief {
  id: string; version: number; text: string; diff: string;
  authorType: string; authorId: string; createdAt: number;
}
export interface ChatDecision { id: string; text: string; scope?: string; createdAt: number }
export interface RunInfo {
  runId: string; state: string; mode: string; autoDraft: boolean;
  counters: { turns: number; inputTokens: number; outputTokens: number };
  startedAt: number; endedAt?: number;
}
export interface RoomState {
  goal: string; contextVersion: number; autoDraftDefault: boolean;
  messages: ChatMessage[]; tasks: ChatTask[]; briefs: ChatBrief[];
  decisions: ChatDecision[]; participants: Participant[]; run: RunInfo | null;
}
export interface RoomSummary { roomId: string; goal: string; createdAt: number }

/** Ticket key: short human-readable alias for a task id (mirrors lib/tickets.ts). */
export function ticketKey(taskId: string): string {
  const hex = taskId.replace(/^task_/, "").replace(/[^0-9a-f]/gi, "");
  return `TKT-${(hex.slice(0, 6) || "000000").toUpperCase()}`;
}

/** Unified chronological feed: messages + tickets + decisions. (Briefs retired.) */
export type FeedItem =
  | { t: "message"; at: number; m: ChatMessage }
  | { t: "ticket"; at: number; task: ChatTask }
  | { t: "decision"; at: number; d: ChatDecision };

export function buildFeed(s: RoomState): FeedItem[] {
  const items: FeedItem[] = [
    ...s.messages.map((m): FeedItem => ({ t: "message", at: m.createdAt, m })),
    ...s.tasks.map((task): FeedItem => ({ t: "ticket", at: task.createdAt, task })),
    ...s.decisions.map((d): FeedItem => ({ t: "decision", at: d.createdAt, d })),
  ];
  items.sort((a, b) => a.at - b.at);
  return items;
}

/** #channel-name slug from a room goal. */
export function channelName(goal: string): string {
  const words = goal.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().split(/\s+/).slice(0, 4);
  return words.join("-").slice(0, 28) || "room";
}

export const ROLE_META: Record<string, { label: string; avatar: string; name: string }> = {
  product: { label: "Product", avatar: "bg-[var(--color-pale-blue-bg)] text-[var(--color-pale-blue-tx)]", name: "P" },
  engineer: { label: "Engineer", avatar: "bg-[var(--color-pale-green-bg)] text-[var(--color-pale-green-tx)]", name: "E" },
  reviewer: { label: "Reviewer", avatar: "bg-[var(--color-pale-yellow-bg)] text-[var(--color-pale-yellow-tx)]", name: "R" },
  orchestrator: { label: "Orchestrator", avatar: "bg-[var(--color-pale-purple-bg)] text-[var(--color-pale-purple-tx)]", name: "O" },
  single: { label: "Agent", avatar: "bg-[var(--color-pale-blue-bg)] text-[var(--color-pale-blue-tx)]", name: "A" },
  owner: { label: "Owner", avatar: "bg-[#111111] text-white", name: "Y" },
  system: { label: "System", avatar: "bg-[var(--color-bone)] text-[var(--color-muted)]", name: "✦" },
};

export function roleMeta(role?: string) {
  return ROLE_META[role ?? ""] ?? ROLE_META.system;
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function fmtDay(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const y = new Date(today); y.setDate(y.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}
