"use client";

import { Hash } from "@phosphor-icons/react";
import type { ChatTask, ChatDecision, ChatMessage } from "../chat/types";
import { ticketKey, fmtTime } from "../chat/types";

const STATE_STYLE: Record<string, string> = {
  queued: "bg-[#f1f1f1] text-[#616061]",
  accepted: "bg-[#e8f0fe] text-[#1264a3]",
  working: "bg-[#fff4d6] text-[#8a6d00]",
  waiting: "bg-[#fff4d6] text-[#8a6d00]",
  completed: "bg-[#e6f4ea] text-[#007a5a]",
  cancelled: "bg-[#f1f1f1] text-[#616061]",
};

export function TicketCard({ task, assigneeLabel }: { task: ChatTask; assigneeLabel?: string }) {
  const done = task.state === "completed";
  return (
    <div className={`mt-1 max-w-[560px] rounded-lg border border-[#dddddd] bg-white overflow-hidden ${done ? "opacity-80" : ""}`}>
      <div className={`h-1 ${done ? "bg-[#007a5a]" : "bg-[#1264a3]"}`} />
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[12px] font-bold text-[#1d1c1d]">{ticketKey(task.id)}</span>
          <span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATE_STYLE[task.state] ?? STATE_STYLE.queued}`}>
            {task.state}
          </span>
          <span className="text-[12px] text-[#616061]">{task.taskType} · → {assigneeLabel ?? task.toRole}</span>
        </div>
        <p className="text-[14px] text-[#1d1c1d] mt-1.5 leading-snug">{task.description}</p>
        {task.result && (
          <p className="text-[13px] text-[#616061] mt-1.5 border-l-2 border-[#007a5a] pl-2">
            <span className="font-bold text-[#007a5a]">Resolved: </span>{task.result}
          </p>
        )}
      </div>
    </div>
  );
}

export function DecisionCard({ d }: { d: ChatDecision }) {
  return (
    <div className="mt-1 max-w-[560px] rounded-lg bg-[#f6f4f7] border border-[#e2dfe6] px-3 py-2.5">
      <p className="text-[13px] font-bold text-[#4a154b] uppercase tracking-wide text-[11px] mb-1">Decision</p>
      <p className="text-[14px]">{d.text}</p>
      <p className="text-[12px] text-[#616061] mt-1">{fmtTime(d.createdAt)}</p>
    </div>
  );
}

export function DisagreementCard({ m, onChoose }: { m: ChatMessage; onChoose?: (optionId: string, title: string) => void }) {
  const c = m.card!;
  return (
    <div className="mt-1 max-w-[600px] rounded-lg border border-[#dddddd] bg-white overflow-hidden">
      <div className="h-1 bg-[#e01e5a]" />
      <div className="px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#e01e5a] mb-1">Needs your call</p>
        <p className="font-bold text-[15px] mb-2">{m.topic}</p>
        <div className="grid sm:grid-cols-2 gap-3 text-[13px] mb-3">
          <div>
            <p className="font-bold text-[#007a5a] mb-1">Agreement</p>
            <ul className="list-disc pl-4 space-y-0.5 text-[#3a383a]">{c.agreement.map((a, i) => <li key={i}>{a}</li>)}</ul>
          </div>
          <div>
            <p className="font-bold text-[#e01e5a] mb-1">Disagreement</p>
            <ul className="list-disc pl-4 space-y-0.5 text-[#3a383a]">{c.disagreement.map((a, i) => <li key={i}>{a}</li>)}</ul>
          </div>
        </div>
        <div className="space-y-2">
          {c.options.map((o) => (
            <div key={o.id} className="flex items-center gap-3 border border-[#e9e9e9] rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-[14px]"><span className="font-mono font-bold mr-2">{o.id}</span><span className="font-bold">{o.title}</span></p>
                <p className="text-[13px] text-[#616061]">{o.tradeoffs}</p>
              </div>
              {onChoose && (
                <button
                  onClick={() => onChoose(o.id, o.title)}
                  className="shrink-0 px-4 h-8 rounded text-[13px] font-bold bg-[#1d1c1d] text-white hover:bg-[#3a383a] active:scale-[0.98]"
                >
                  Choose
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-[13px] mt-2"><span className="font-bold">Recommendation: </span>{c.recommendation}</p>
      </div>
    </div>
  );
}

export function SystemCard({ text }: { text: string }) {
  return (
    <div className="flex justify-center my-2">
      <p className="font-mono text-[12px] text-[#616061] bg-[#f1f1f1] rounded-full px-4 py-1.5 max-w-[90%] text-center">{text}</p>
    </div>
  );
}

export function ChannelHero({ channel, goal }: { channel: string; goal: string }) {
  return (
    <div className="px-5 pt-6 pb-4">
      <div className="w-12 h-12 rounded-lg bg-[#f6f4f7] border border-[#e2dfe6] flex items-center justify-center mb-3">
        <Hash size={24} className="text-[#4a154b]" weight="bold" />
      </div>
      <h3 className="font-black text-[20px]">This is the very beginning of the #{channel} channel</h3>
      <p className="text-[14px] text-[#616061] mt-1 max-w-[640px]">{goal}</p>
    </div>
  );
}
