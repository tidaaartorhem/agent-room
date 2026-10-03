"use client";

import { RunInfo, channelName, Participant } from "./types";

export default function ChannelHeader({ goal, run, participants, driving, onStart, onAction, onNewTicket }: {
  goal: string;
  run: RunInfo | null;
  participants: Participant[];
  driving: boolean;
  onStart: (mode: "team" | "single", autoDraft: boolean) => void;
  onAction: (a: "pause" | "stop" | "resume") => void;
  onNewTicket: () => void;
}) {
  const active = run && (run.state === "running" || run.state === "paused");
  return (
    <header className="border-b border-[var(--color-line)] bg-white px-5 py-3 flex items-center gap-3 shrink-0">
      <div className="min-w-0">
        <h2 className="font-bold text-[17px] leading-tight truncate">
          <span className="text-[var(--color-muted)] font-mono font-normal">#</span> {channelName(goal)}
        </h2>
        <p className="text-[13px] text-[var(--color-muted)] truncate max-w-xl" title={goal}>{goal}</p>
      </div>
      <div className="ml-auto flex items-center gap-2 shrink-0">
        {run && (
          <span className={`tag ${run.state === "running" ? "bg-[var(--color-pale-green-bg)] text-[var(--color-pale-green-tx)]" : run.state === "paused" ? "bg-[var(--color-pale-yellow-bg)] text-[var(--color-pale-yellow-tx)]" : "bg-[var(--color-bone)] text-[var(--color-muted)]"}`}>
            {run.state}{run.state !== "completed" && run.state !== "stopped" ? ` · ${run.counters.turns}/12` : ""}
          </span>
        )}
        {!active && !driving && (
          <button onClick={() => onStart("team", true)} className="btn-primary text-xs px-4 py-2">
            Start discussion
          </button>
        )}
        {driving && <span className="font-mono text-xs text-[var(--color-muted)]">driving…</span>}
        {run?.state === "running" && (
          <>
            <button onClick={() => onAction("pause")} className="btn-ghost text-xs px-3 py-2">Pause</button>
            <button onClick={() => onAction("stop")} className="btn-ghost text-xs px-3 py-2">Stop</button>
          </>
        )}
        {run?.state === "paused" && (
          <>
            <button onClick={() => onAction("resume")} className="btn-primary text-xs px-4 py-2">Resume</button>
            <button onClick={() => onAction("stop")} className="btn-ghost text-xs px-3 py-2">Stop</button>
          </>
        )}
        <button onClick={onNewTicket} className="btn-ghost text-xs px-3 py-2" title="Create a ticket and assign an agent">
          + Ticket
        </button>
      </div>
    </header>
  );
}
