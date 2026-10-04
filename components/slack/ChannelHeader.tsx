"use client";

import { Hash, Play, Pause, Stop, Ticket } from "@phosphor-icons/react";
import type { RunInfo, Participant } from "../chat/types";
import { channelName } from "../chat/types";
import { displayName } from "./types";

export default function ChannelHeader({ goal, run, participants, driving, onStart, onAction, onNewTicket }: {
  goal: string;
  run: RunInfo | null;
  participants: Participant[];
  driving: boolean;
  onStart: (mode: "team" | "single" | "facilitated", autoDraft: boolean) => void;
  onAction: (a: "pause" | "stop" | "resume") => void;
  onNewTicket: () => void;
}) {
  const active = run && (run.state === "running" || run.state === "paused");
  const hasOrchestrator = participants.some((p) => p.role === "orchestrator");
  return (
    <header className="border-b border-[#dddddd] bg-white px-5 py-2.5 flex items-center gap-3 shrink-0">
      <Hash size={20} weight="bold" className="text-[#616061] shrink-0" />
      <div className="min-w-0">
        <h2 className="font-black text-[18px] leading-tight truncate">{channelName(goal)}</h2>
        <p className="text-[13px] text-[#616061] truncate max-w-2xl" title={goal}>{goal}</p>
      </div>
      <div className="ml-auto flex items-center gap-2 shrink-0">
        <div className="hidden lg:flex items-center -space-x-1.5 mr-1">
          <span className="w-7 h-7 rounded bg-[#1d1c1d] text-white text-[11px] font-bold flex items-center justify-center border-2 border-white" title="You (owner)">Y</span>
          {participants.slice(0, 4).map((p) => (
            <span key={p.id} className="w-7 h-7 rounded bg-[#1264a3] text-white text-[11px] font-bold flex items-center justify-center border-2 border-white" title={`${displayName(p)} · ${p.agentId}`}>
              {p.role[0].toUpperCase()}
            </span>
          ))}
        </div>
        {run && run.state === "running" && (
          <span className="text-[12px] font-bold text-[#007a5a] bg-[#e6f4ea] rounded-full px-2.5 py-1">
            ● live · {run.counters.turns}/12
          </span>
        )}
        {run && run.state === "paused" && (
          <span className="text-[12px] font-bold text-[#8a6d00] bg-[#fff4d6] rounded-full px-2.5 py-1">paused</span>
        )}
        {!active && !driving && (
          <>
            <button onClick={() => onStart("team", true)} className="flex items-center gap-1.5 text-[13px] font-bold px-3 h-8 rounded border border-[#dddddd] hover:bg-[#f8f8f8]">
              <Play size={14} weight="fill" /> Start discussion
            </button>
            {hasOrchestrator && (
              <button onClick={() => onStart("facilitated", true)} title="Hosted product discussion: orchestrator leads product + engineer to a PRD" className="flex items-center gap-1.5 text-[13px] font-bold px-3 h-8 rounded bg-[#6b4fbb] text-white hover:bg-[#5b3fa8]">
                <Play size={14} weight="fill" /> Facilitate
              </button>
            )}
          </>
        )}
        {driving && <span className="font-mono text-[12px] text-[#616061]">driving…</span>}
        {run?.state === "running" && (
          <>
            <button onClick={() => onAction("pause")} title="Pause" className="p-2 rounded hover:bg-[#f1f1f1] text-[#616061]"><Pause size={16} weight="fill" /></button>
            <button onClick={() => onAction("stop")} title="Stop" className="p-2 rounded hover:bg-[#f1f1f1] text-[#616061]"><Stop size={16} weight="fill" /></button>
          </>
        )}
        {run?.state === "paused" && (
          <>
            <button onClick={() => onAction("resume")} className="flex items-center gap-1.5 text-[13px] font-bold px-3 h-8 rounded bg-[#007a5a] text-white hover:bg-[#006349]">
              <Play size={14} weight="fill" /> Resume
            </button>
            <button onClick={() => onAction("stop")} title="Stop" className="p-2 rounded hover:bg-[#f1f1f1] text-[#616061]"><Stop size={16} weight="fill" /></button>
          </>
        )}
        <button onClick={onNewTicket} title="Create a ticket" className="flex items-center gap-1.5 text-[13px] font-bold px-3 h-8 rounded border border-[#dddddd] hover:bg-[#f8f8f8]">
          <Ticket size={15} /> Ticket
        </button>
      </div>
    </header>
  );
}
