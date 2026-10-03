"use client";

import { useRef, useState } from "react";
import { Participant, ChatTask, ticketKey, roleMeta } from "./types";

const ROLES = ["product", "engineer", "reviewer", "single"];
const TYPES = ["plan", "critique", "review"] as const;

export default function Composer({ participants, tasks, initialMode, onSend, onAssign, disabled }: {
  participants: Participant[];
  tasks: ChatTask[];
  initialMode?: "message" | "ticket";
  onSend: (text: string) => Promise<void>;
  onAssign: (to: string, taskType: string, description: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [mode, setMode] = useState<"message" | "ticket">(initialMode ?? "message");
  const [text, setText] = useState("");
  const [to, setTo] = useState("engineer");
  const [taskType, setTaskType] = useState<string>("plan");
  const [suggest, setSuggest] = useState<{ kind: "@" | "#"; q: string; index: number } | null>(null);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const openTickets = tasks.filter((t) => !["completed", "cancelled"].includes(t.state));

  const roleMatches = ROLES.filter((r) => r.startsWith((suggest?.kind === "@" ? suggest.q : "").toLowerCase()));
  const ticketMatches = openTickets.filter((t) =>
    ticketKey(t.id).toLowerCase().includes((suggest?.kind === "#" ? suggest.q : "").toLowerCase()) ||
    t.description.toLowerCase().includes((suggest?.q ?? "").toLowerCase())
  ).slice(0, 6);

  const onChange = (v: string) => {
    setText(v);
    const m = v.match(/(^|\s)([@#])([A-Za-z0-9-]*)$/);
    if (m) setSuggest({ kind: m[2] as "@" | "#", q: m[3], index: v.length });
    else setSuggest(null);
  };

  const applySuggestion = (insert: string) => {
    if (!suggest) return;
    const before = text.slice(0, suggest.index - suggest.q.length - 1);
    const after = text.slice(suggest.index);
    const nv = `${before}${suggest.kind}${insert} ${after}`;
    setText(nv);
    setSuggest(null);
    inputRef.current?.focus();
  };

  const submit = async () => {
    if (sending || disabled) return;
    if (mode === "ticket") {
      if (!text.trim()) return;
      setSending(true);
      try { await onAssign(to, taskType, text.trim()); setText(""); setMode("message"); }
      finally { setSending(false); }
      return;
    }
    if (!text.trim()) return;
    setSending(true);
    try { await onSend(text.trim()); setText(""); setSuggest(null); }
    finally { setSending(false); }
  };

  return (
    <div className="border-t border-[var(--color-line)] bg-white px-5 py-3 shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex rounded-md border border-[var(--color-line)] overflow-hidden text-xs">
          {(["message", "ticket"] as const).map((mm) => (
            <button
              key={mm}
              onClick={() => setMode(mm)}
              className={`px-3 py-1.5 font-semibold ${mode === mm ? "bg-[#111111] text-white" : "bg-white text-[var(--color-muted)] hover:bg-[var(--color-card)]"}`}
            >
              {mm === "message" ? "Message" : "Ticket"}
            </button>
          ))}
        </div>
        {mode === "ticket" && (
          <>
            <select value={to} onChange={(e) => setTo(e.target.value)} className="text-xs border border-[var(--color-line)] rounded-md px-2 py-1.5 bg-white">
              {participants.map((p) => <option key={p.id} value={p.role}>@{p.role}</option>)}
            </select>
            <select value={taskType} onChange={(e) => setTaskType(e.target.value)} className="text-xs border border-[var(--color-line)] rounded-md px-2 py-1.5 bg-white">
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </>
        )}
        <span className="font-mono text-[11px] text-[var(--color-muted)] ml-auto hidden sm:block">
          {mode === "message" ? "type @ to mention · # to tag a ticket" : "creates a ticket assigned to the agent"}
        </span>
      </div>

      <div className="relative">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            if (e.key === "Escape") setSuggest(null);
          }}
          rows={2}
          disabled={disabled}
          placeholder={mode === "message" ? "Message the channel as owner…" : "Describe the ticket…"}
          className="w-full border border-[var(--color-line)] rounded-lg px-4 py-3 text-[15px] bg-white resize-none focus:outline-none focus:border-[#999]"
        />
        {suggest && (
          <div className="absolute bottom-full left-0 mb-1 w-72 bg-white border border-[var(--color-line)] rounded-lg shadow-sm overflow-hidden z-10">
            {suggest.kind === "@" && roleMatches.map((r) => {
              const meta = roleMeta(r);
              const p = participants.find((x) => x.role === r);
              return (
                <button key={r} onClick={() => applySuggestion(r)} className="w-full text-left px-3 py-2 hover:bg-[var(--color-card)] flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full ${meta.avatar} flex items-center justify-center text-[11px] font-bold`}>{meta.name}</span>
                  <span className="text-sm font-semibold">@{r}</span>
                  {p && <span className="font-mono text-xs text-[var(--color-muted)] ml-auto">{p.agentId}</span>}
                </button>
              );
            })}
            {suggest.kind === "#" && ticketMatches.map((t) => (
              <button key={t.id} onClick={() => applySuggestion(ticketKey(t.id))} className="w-full text-left px-3 py-2 hover:bg-[var(--color-card)]">
                <span className="font-mono text-xs font-bold text-[var(--color-pale-blue-tx)]">{ticketKey(t.id)}</span>
                <span className="text-sm text-[var(--color-ink-soft)] ml-2 truncate">{t.description.slice(0, 60)}</span>
              </button>
            ))}
            {suggest.kind === "@" && roleMatches.length === 0 && (
              <p className="px-3 py-2 text-xs text-[var(--color-muted)]">No matching roles</p>
            )}
            {suggest.kind === "#" && ticketMatches.length === 0 && (
              <p className="px-3 py-2 text-xs text-[var(--color-muted)]">No open tickets match</p>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end mt-2">
        <button onClick={submit} disabled={sending || disabled || !text.trim()} className="btn-primary px-6 py-2 text-sm">
          {mode === "message" ? "Send" : "Create ticket"}
        </button>
      </div>
    </div>
  );
}
