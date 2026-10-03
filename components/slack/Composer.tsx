"use client";

import { useRef, useState } from "react";
import { PaperPlaneTilt, Smiley, TextB, TextItalic, CodeSimple, LinkSimple, ListBullets } from "@phosphor-icons/react";
import type { Participant, ChatTask } from "../chat/types";
import { ticketKey, roleMeta } from "../chat/types";

const ROLES = ["product", "engineer", "reviewer", "single"];
const TYPES = ["plan", "critique", "review"] as const;
const EMOJI = ["👍", "❤️", "🎉", "👀", "✅", "🚀", "💡", "🙏"];

function wrap(text: string, setText: (v: string) => void, before: string, after = before) {
  setText(`${text}${before}text${after}`);
}

export default function Composer({ participants, tasks, threadParent, initialMode, onSend, onAssign, onDraftText, compact }: {
  participants: Participant[];
  tasks: ChatTask[];
  threadParent?: string | null;
  initialMode?: "message" | "ticket";
  onSend: (text: string, threadParent?: string | null) => Promise<void>;
  onAssign: (to: string, taskType: string, description: string) => Promise<void>;
  onDraftText?: (text: string) => void;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<"message" | "ticket">(initialMode ?? "message");
  const [text, setText] = useState("");
  const [to, setTo] = useState("engineer");
  const [taskType, setTaskType] = useState<string>("plan");
  const [suggest, setSuggest] = useState<{ kind: "@" | "#"; q: string; index: number } | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
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
    onDraftText?.(v);
    const m = v.match(/(^|\s)([@#:])([A-Za-z0-9_-]*)$/);
    if (m && m[2] !== ":") setSuggest({ kind: m[2] as "@" | "#", q: m[3], index: v.length });
    else setSuggest(null);
  };

  const applySuggestion = (insert: string) => {
    if (!suggest) return;
    const before = text.slice(0, suggest.index - suggest.q.length - 1);
    const nv = `${before}${suggest.kind}${insert} ${text.slice(suggest.index)}`;
    setText(nv);
    setSuggest(null);
    inputRef.current?.focus();
  };

  const submit = async () => {
    if (sending || !text.trim()) return;
    setSending(true);
    try {
      if (mode === "ticket") {
        await onAssign(to, taskType, text.trim());
        setMode("message");
      } else {
        await onSend(text.trim(), threadParent ?? null);
      }
      setText("");
      setSuggest(null);
    } finally {
      setSending(false);
    }
  };

  const canSend = text.trim().length > 0 && !sending;

  return (
    <div className={compact ? "p-3" : "px-5 pb-4 pt-1"}>
      {!compact && (
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex rounded-md border border-[#dddddd] overflow-hidden text-[12px]">
            {(["message", "ticket"] as const).map((mm) => (
              <button
                key={mm}
                onClick={() => setMode(mm)}
                className={`px-2.5 py-1 font-bold ${mode === mm ? "bg-[#1d1c1d] text-white" : "bg-white text-[#616061] hover:bg-[#f8f8f8]"}`}
              >
                {mm === "message" ? "Message" : "Ticket"}
              </button>
            ))}
          </div>
          {mode === "ticket" && (
            <>
              <select value={to} onChange={(e) => setTo(e.target.value)} className="text-[12px] border border-[#dddddd] rounded-md px-1.5 py-1 bg-white">
                {participants.map((p) => <option key={p.id} value={p.role}>@{p.role}</option>)}
              </select>
              <select value={taskType} onChange={(e) => setTaskType(e.target.value)} className="text-[12px] border border-[#dddddd] rounded-md px-1.5 py-1 bg-white">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </>
          )}
        </div>
      )}
      <div className="relative border border-[#616061] rounded-lg bg-white focus-within:border-[#1d1c1d] focus-within:shadow-[0_0_0_1px_#1d1c1d]">
        {!compact && (
          <div className="flex items-center gap-0.5 px-2 pt-1.5 text-[#616061]">
            <button title="Bold" className="p-1.5 rounded hover:bg-[#f1f1f1] hover:text-[#1d1c1d]" onClick={() => wrap(text, setText, "**")}><TextB size={16} /></button>
            <button title="Italic" className="p-1.5 rounded hover:bg-[#f1f1f1] hover:text-[#1d1c1d]" onClick={() => wrap(text, setText, "_")}><TextItalic size={16} /></button>
            <button title="Code" className="p-1.5 rounded hover:bg-[#f1f1f1] hover:text-[#1d1c1d]" onClick={() => wrap(text, setText, "`")}><CodeSimple size={16} /></button>
            <button title="Link" className="p-1.5 rounded hover:bg-[#f1f1f1] hover:text-[#1d1c1d]" onClick={() => wrap(text, setText, "[", "](url)")}><LinkSimple size={16} /></button>
            <button title="List" className="p-1.5 rounded hover:bg-[#f1f1f1] hover:text-[#1d1c1d]" onClick={() => setText(`${text}\n- `)}><ListBullets size={16} /></button>
            <div className="relative">
              <button title="Emoji" className="p-1.5 rounded hover:bg-[#f1f1f1] hover:text-[#1d1c1d]" onClick={() => setEmojiOpen((o) => !o)}><Smiley size={16} /></button>
              {emojiOpen && (
                <div className="absolute bottom-full left-0 mb-1 bg-white border border-[#dddddd] rounded-lg shadow-md p-2 grid grid-cols-4 gap-1 z-20">
                  {EMOJI.map((e) => (
                    <button key={e} className="text-[20px] hover:bg-[#f1f1f1] rounded p-1" onClick={() => { setText(`${text}${e}`); setEmojiOpen(false); inputRef.current?.focus(); }}>{e}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            if (e.key === "Escape") { setSuggest(null); setEmojiOpen(false); }
          }}
          rows={compact ? 2 : 3}
          placeholder={mode === "ticket" ? "Describe the ticket…" : threadParent ? "Reply in thread…" : "Message the channel…"}
          className="w-full px-3.5 py-2 text-[15px] bg-transparent resize-none focus:outline-none placeholder:text-[#616061]"
        />
        {suggest && (
          <div className="absolute bottom-full left-0 mb-1 w-80 max-h-64 overflow-y-auto bg-white border border-[#dddddd] rounded-lg shadow-lg z-20">
            {suggest.kind === "@" && roleMatches.map((r) => {
              const meta = roleMeta(r);
              const p = participants.find((x) => x.role === r);
              return (
                <button key={r} onClick={() => applySuggestion(r)} className="w-full text-left px-3 py-2 hover:bg-[#f1f1f1] flex items-center gap-2">
                  <span className={`w-6 h-6 rounded ${meta.avatar} flex items-center justify-center text-[11px] font-bold`}>{meta.name}</span>
                  <span className="text-[14px] font-bold">@{r}</span>
                  {p && <span className="font-mono text-[11px] text-[#616061] ml-auto">{p.agentId}</span>}
                </button>
              );
            })}
            {suggest.kind === "@" && (
              <button onClick={() => applySuggestion("owner")} className="w-full text-left px-3 py-2 hover:bg-[#f1f1f1] flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-[#1d1c1d] text-white flex items-center justify-center text-[11px] font-bold">Y</span>
                <span className="text-[14px] font-bold">@owner</span>
                <span className="font-mono text-[11px] text-[#616061] ml-auto">you</span>
              </button>
            )}
            {suggest.kind === "#" && ticketMatches.map((t) => (
              <button key={t.id} onClick={() => applySuggestion(ticketKey(t.id))} className="w-full text-left px-3 py-2 hover:bg-[#f1f1f1]">
                <span className="font-mono text-[12px] font-bold text-[#1264a3]">{ticketKey(t.id)}</span>
                <span className="text-[14px] text-[#1d1c1d] ml-2">{t.description.slice(0, 60)}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-end px-2 pb-1.5">
          <button
            onClick={submit}
            disabled={!canSend}
            title="Send (Enter)"
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${canSend ? "bg-[#007a5a] text-white hover:bg-[#006349]" : "bg-transparent text-[#868686]"}`}
          >
            <PaperPlaneTilt size={18} weight="fill" />
          </button>
        </div>
      </div>
      {!compact && (
        <p className="text-[12px] text-[#616061] mt-1.5 px-1">
          <b>Enter</b> to send · <b>@</b> mention agent · <b>#</b> tag ticket
        </p>
      )}
    </div>
  );
}
