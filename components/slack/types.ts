"use client";

import type { ChatMessage, ChatTask, Participant, RoomState } from "../chat/types";

/** Avatar background per role — solid Slack-style rounded squares. */
export const AVATAR_BG: Record<string, string> = {
  owner: "bg-[#1d1c1d] text-white",
  product: "bg-[#1264a3] text-white",
  engineer: "bg-[#007a5a] text-white",
  reviewer: "bg-[#9a6a00] text-white",
  orchestrator: "bg-[#6b4fbb] text-white",
  single: "bg-[#1264a3] text-white",
  system: "bg-[#e8e8e8] text-[#616061]",
};

export const AVATAR_LETTER: Record<string, string> = {
  owner: "Y",
  product: "P",
  engineer: "E",
  reviewer: "R",
  orchestrator: "O",
  single: "A",
  system: "✦",
};

export function avatarFor(m: ChatMessage): { bg: string; letter: string; name: string } {
  const isOwner = m.role === "owner" || m.agentId === "owner";
  const role = isOwner ? "owner" : m.role ?? "system";
  return {
    bg: AVATAR_BG[role] ?? AVATAR_BG.system,
    letter: AVATAR_LETTER[role] ?? "?",
    name: isOwner ? "You" : role === "system" ? "System" : role[0].toUpperCase() + role.slice(1),
  };
}

export function displayName(p: Participant): string {
  return p.role[0].toUpperCase() + p.role.slice(1);
}

/** Top-level messages (not thread replies), oldest first. */
export function topLevel(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((m) => !m.replyTo);
}

export function threadReplies(messages: ChatMessage[], parentId: string): ChatMessage[] {
  return messages.filter((m) => m.replyTo === parentId);
}

export function replyCount(messages: ChatMessage[], parentId: string): number {
  return messages.reduce((n, m) => n + (m.replyTo === parentId ? 1 : 0), 0);
}

/** Group top-level items by day for dividers. */
export function dayKey(ts: number): string {
  return new Date(ts).toDateString();
}

/** Does this message mention the owner? */
export function mentionsOwner(m: ChatMessage): boolean {
  return /@owner\b/i.test(m.text);
}

export interface ActivityItem {
  id: string;
  kind: "mention" | "disagreement" | "ticket";
  at: number;
  title: string;
  subtitle: string;
  messageId?: string;
}

export function buildActivity(s: RoomState): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const m of s.messages) {
    if (mentionsOwner(m) && m.agentId !== "owner") {
      items.push({
        id: `m-${m.id}`, kind: "mention", at: m.createdAt,
        title: `${m.role ?? "agent"} mentioned you`,
        subtitle: m.text.slice(0, 120), messageId: m.id,
      });
    }
    if (m.kind === "disagreement_card" && m.card) {
      items.push({
        id: `d-${m.id}`, kind: "disagreement", at: m.createdAt,
        title: m.topic ?? "Disagreement needs your call",
        subtitle: `${m.card.options.length} options · ${m.card.recommendation}`,
        messageId: m.id,
      });
    }
  }
  for (const t of s.tasks) {
    if (t.state === "completed" && t.result) {
      items.push({
        id: `t-${t.id}`, kind: "ticket", at: t.createdAt,
        title: `Ticket resolved → ${t.toRole}`,
        subtitle: t.description.slice(0, 120),
      });
    }
  }
  return items.sort((a, b) => b.at - a.at).slice(0, 30);
}

export type { ChatMessage, ChatTask, Participant, RoomState };
