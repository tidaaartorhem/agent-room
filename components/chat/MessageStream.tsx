"use client";

import { useEffect, useRef } from "react";
import {
  FeedItem, ChatMessage, Participant,
  buildFeed, fmtTime, fmtDay, roleMeta, RoomState, ticketKey,
} from "./types";
import { TicketCard, DecisionCard, DisagreementCard, SystemCard, StaleCard } from "./RichCards";

/** Render @role mentions and TKT-XXXXXX refs as pills. Plain text otherwise (XSS-safe). */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(@(?:product|engineer|reviewer|single|owner)\b|TKT-[0-9A-F]{6}\b)/gi);
  return (
    <>
      {parts.map((p, i) => {
        if (/^@(?:product|engineer|reviewer|single|owner)$/i.test(p)) {
          const meta = roleMeta(p.slice(1).toLowerCase());
          return (
            <span key={i} className={`inline-block rounded px-1.5 py-0.5 text-[13px] font-semibold ${meta.avatar}`}>
              {p}
            </span>
          );
        }
        if (/^TKT-[0-9A-F]{6}$/i.test(p)) {
          return (
            <span key={i} className="inline-block rounded px-1.5 py-0.5 text-[13px] font-mono font-bold bg-[var(--color-pale-blue-bg)] text-[var(--color-pale-blue-tx)]">
              {p.toUpperCase()}
            </span>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function Avatar({ role, size = "w-9 h-9 text-sm" }: { role?: string; size?: string }) {
  const meta = roleMeta(role);
  return (
    <div className={`${size} rounded-full ${meta.avatar} flex items-center justify-center font-semibold shrink-0 select-none`}>
      {meta.name}
    </div>
  );
}

function DisplayName({ m, participants }: { m: ChatMessage; participants: Participant[] }) {
  if (m.role === "owner" || m.agentId === "owner") return <span className="font-bold text-sm">You</span>;
  if (m.role) {
    const meta = roleMeta(m.role);
    const p = participants.find((x) => x.role === m.role);
    return (
      <span className="font-bold text-sm">
        {meta.label}
        {p && <span className="font-mono font-normal text-xs text-[var(--color-muted)] ml-2">{p.agentId} · {p.providerLabel}</span>}
      </span>
    );
  }
  return <span className="font-bold text-sm">{m.agentId ?? "unknown"}</span>;
}

function MessageRow({ m, participants, onChoose }: {
  m: ChatMessage; participants: Participant[]; onChoose?: (cardId: string, optionId: string, title: string) => void;
}) {
  if (m.kind === "disagreement_card" && m.card) {
    return (
      <div className="px-5 py-1">
        <DisagreementCard m={m} onChoose={onChoose ? (oid, title) => onChoose(m.id, oid, title) : undefined} />
      </div>
    );
  }
  if (m.kind === "system") {
    return <div className="px-5 py-1"><SystemCard m={m} /></div>;
  }
  if (m.kind === "stale_proposal") {
    return <div className="px-5 py-1"><StaleCard m={m} /></div>;
  }
  const meta = roleMeta(m.role);
  return (
    <div className="px-5 py-2 flex gap-3 hover:bg-[var(--color-card)] transition-colors">
      <Avatar role={m.role === "owner" || m.agentId === "owner" ? "owner" : m.role} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <DisplayName m={m} participants={participants} />
          <span className="font-mono text-xs text-[var(--color-muted)]">{fmtTime(m.createdAt)}</span>
          {m.kind !== "message" && (
            <span className="tag bg-[var(--color-bone)] text-[var(--color-muted)]">{m.kind.replace(/_/g, " ")}</span>
          )}
          {m.role && m.role !== "owner" && (
            <span className={`tag ${meta.avatar}`}>{meta.label}</span>
          )}
        </div>
        <p className="text-[15px] leading-relaxed text-[var(--color-ink-soft)] whitespace-pre-wrap break-words mt-0.5"><RichText text={m.text} /></p>
      </div>
    </div>
  );
}

export default function MessageStream({ state, onChoose }: {
  state: RoomState; onChoose: (cardId: string, optionId: string, title: string) => void;
}) {
  const feed: FeedItem[] = buildFeed(state);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [feed.length]);

  let lastDay = "";
  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto py-4">
      {feed.length === 0 && (
        <div className="px-5 py-12 text-center">
          <p className="serif text-2xl mb-2">The channel is quiet.</p>
          <p className="text-sm text-[var(--color-muted)] max-w-md mx-auto">
            Start a run to set the agents talking, or send the first message below.
            Agents connected over the API appear here like teammates.
          </p>
        </div>
      )}
      {feed.map((item) => {
        const day = fmtDay(item.at);
        const divider = day !== lastDay ? (
          <div key={`day-${item.at}`} className="flex items-center gap-3 px-5 my-4">
            <div className="flex-1 h-px bg-[var(--color-line)]" />
            <span className="text-xs font-semibold text-[var(--color-muted)] border border-[var(--color-line)] rounded-full px-3 py-1 bg-white">{day}</span>
            <div className="flex-1 h-px bg-[var(--color-line)]" />
          </div>
        ) : null;
        lastDay = day;
        const key = item.t === "message" ? item.m.id : item.t === "ticket" ? item.task.id : item.d.id;
        return (
          <div key={key}>
            {divider}
            {item.t === "message" && (
              <MessageRow m={item.m} participants={state.participants} onChoose={onChoose} />
            )}
            {item.t === "ticket" && (
              <div className="px-5 py-1 pl-[68px]">
                <TicketCard task={item.task} assigneeName={state.participants.find((p) => p.id === item.task.assignedTo)?.agentId} />
              </div>
            )}
            {item.t === "decision" && (
              <div className="px-5 py-1"><DecisionCard d={item.d} /></div>
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
