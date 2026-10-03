"use client";

import { RoomSummary, Participant, channelName, roleMeta } from "./types";

export default function Sidebar({ rooms, roomId, goal, participants, onSelect }: {
  rooms: RoomSummary[];
  roomId: string;
  goal: string;
  participants: Participant[];
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="w-64 shrink-0 bg-[#f4f3f0] border-r border-[var(--color-line)] flex flex-col h-full">
      <div className="px-4 pt-5 pb-4 border-b border-[var(--color-line)]">
        <h1 className="serif text-xl leading-tight">Agent Room</h1>
        <p className="font-mono text-xs text-[var(--color-muted)] mt-1">
          {rooms.length} channel{rooms.length === 1 ? "" : "s"} · {participants.length} member{participants.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        <p className="px-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">Channels</p>
        <ul>
          {rooms.map((r) => {
            const active = r.roomId === roomId;
            return (
              <li key={r.roomId}>
                <button
                  onClick={() => onSelect(r.roomId)}
                  className={`w-full text-left px-4 py-1.5 flex items-center gap-2 text-[15px] transition-colors ${
                    active ? "bg-white font-semibold" : "hover:bg-white/60 text-[var(--color-ink-soft)]"
                  }`}
                  title={r.goal}
                >
                  <span className="text-[var(--color-muted)] font-mono">#</span>
                  <span className="truncate">{channelName(r.goal)}</span>
                  {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#111111]" />}
                </button>
              </li>
            );
          })}
          {rooms.length === 0 && (
            <li className="px-4 py-2 text-sm text-[var(--color-muted)]">No channels yet.</li>
          )}
        </ul>

        <p className="px-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mt-5 mb-1">Members</p>
        <ul>
          <li className="px-4 py-1.5 flex items-center gap-2.5">
            <span className="relative">
              <span className="w-7 h-7 rounded-full bg-[#111111] text-white flex items-center justify-center text-xs font-semibold">Y</span>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[#f4f3f0]" />
            </span>
            <span className="text-[15px]"><span className="font-semibold">You</span> <span className="text-[var(--color-muted)] text-sm">· owner</span></span>
          </li>
          {participants.map((p) => {
            const meta = roleMeta(p.role);
            return (
              <li key={p.id} className="px-4 py-1.5 flex items-center gap-2.5" title={`${p.providerLabel} · ${p.adapterType} API`}>
                <span className="relative">
                  <span className={`w-7 h-7 rounded-full ${meta.avatar} flex items-center justify-center text-xs font-semibold`}>{meta.name}</span>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[#f4f3f0]" />
                </span>
                <span className="text-[15px] min-w-0">
                  <span className="font-semibold">{meta.label}</span>
                  <span className="font-mono text-xs text-[var(--color-muted)] ml-2">{p.agentId}</span>
                  <span className="block font-mono text-[11px] text-[var(--color-muted)] truncate">via API · {p.providerLabel}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="px-4 py-3 border-t border-[var(--color-line)]">
        <p className="font-mono text-[11px] text-[var(--color-muted)] leading-relaxed">
          Agents join over the API with bearer tokens. Text only — no external tools.
        </p>
      </div>
    </aside>
  );
}
