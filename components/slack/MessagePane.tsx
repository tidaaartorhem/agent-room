"use client";

import { useEffect, useRef, useState } from "react";
import { Smiley, ChatCircleDots, Link as LinkIcon, Check } from "@phosphor-icons/react";
import type { ChatMessage } from "../chat/types";
import { fmtTime, fmtDay, channelName } from "../chat/types";
import { RichText } from "../chat/MessageStream";
import { avatarFor, topLevel, threadReplies, replyCount, dayKey } from "./types";
import { TicketCard, DecisionCard, DisagreementCard, SystemCard, ChannelHero } from "./Cards";
import type { FeedItem } from "../chat/types";

const QUICK_EMOJI = ["👍", "❤️", "🎉", "👀", "✅"];

function DayDivider({ ts }: { ts: number }) {
  return (
    <div className="flex items-center gap-3 px-5 my-3">
      <div className="flex-1 h-px bg-[#dddddd]" />
      <span className="text-[12px] font-bold text-[#616061] border border-[#dddddd] rounded-full px-3 py-0.5 bg-white">{fmtDay(ts)}</span>
      <div className="flex-1 h-px bg-[#dddddd]" />
    </div>
  );
}

function NewDivider() {
  return (
    <div className="flex items-center gap-2 px-5 my-2">
      <div className="flex-1 h-px bg-[#e01e5a]" />
      <span className="text-[11px] font-bold text-white bg-[#e01e5a] rounded px-2 py-0.5">New</span>
      <div className="flex-1 h-px bg-[#e01e5a]" />
    </div>
  );
}

function Reactions({ m, onReact }: { m: ChatMessage; onReact: (id: string, emoji: string) => void }) {
  const r = m.reactions ?? {};
  const keys = Object.keys(r).filter((k) => r[k]?.length);
  if (!keys.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {keys.map((e) => {
        const mine = r[e].includes("owner");
        return (
          <button
            key={e}
            onClick={() => onReact(m.id, e)}
            className={`flex items-center gap-1 h-6 px-2 rounded-full border text-[13px] ${
              mine ? "bg-[#e8f0fe] border-[#1264a3]" : "bg-[#f8f8f8] border-[#dddddd] hover:border-[#616061]"
            }`}
          >
            <span>{e}</span>
            <span className={`text-[12px] font-bold ${mine ? "text-[#1264a3]" : "text-[#616061]"}`}>{r[e].length}</span>
          </button>
        );
      })}
    </div>
  );
}

function HoverBar({ onReact, onThread, onCopy }: {
  onReact: (emoji: string) => void;
  onThread: () => void;
  onCopy: () => void;
}) {
  const [pick, setPick] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="absolute -top-3 right-4 hidden group-hover:flex items-center bg-white border border-[#dddddd] rounded-lg shadow-sm z-10">
      <div className="relative">
        <button title="Add reaction" className="p-1.5 hover:bg-[#f1f1f1] rounded-l-lg text-[#616061] hover:text-[#1d1c1d]" onClick={() => setPick((p) => !p)}>
          <Smiley size={18} />
        </button>
        {pick && (
          <div className="absolute bottom-full right-0 mb-1 bg-white border border-[#dddddd] rounded-lg shadow-md p-1.5 flex gap-1">
            {QUICK_EMOJI.map((e) => (
              <button key={e} className="text-[18px] hover:bg-[#f1f1f1] rounded p-1" onClick={() => { onReact(e); setPick(false); }}>{e}</button>
            ))}
          </div>
        )}
      </div>
      <button title="Reply in thread" className="p-1.5 hover:bg-[#f1f1f1] text-[#616061] hover:text-[#1d1c1d]" onClick={onThread}>
        <ChatCircleDots size={18} />
      </button>
      <button
        title="Copy text"
        className="p-1.5 hover:bg-[#f1f1f1] rounded-r-lg text-[#616061] hover:text-[#1d1c1d]"
        onClick={() => { onCopy(); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
      >
        {copied ? <Check size={18} className="text-[#007a5a]" /> : <LinkIcon size={18} />}
      </button>
    </div>
  );
}

function MessageRow({ m, all, onReact, onThread, highlight }: {
  m: ChatMessage;
  all: ChatMessage[];
  onReact: (id: string, emoji: string) => void;
  onThread: (id: string) => void;
  highlight: boolean;
}) {
  const a = avatarFor(m);
  const replies = replyCount(all, m.id);
  const mentioned = /@owner\b/i.test(m.text) && m.agentId !== "owner";
  return (
    <div id={`msg-anchor-${m.id}`} className={`sl-msg group relative px-5 py-1.5 ${highlight ? "bg-[#fdf3d7]" : ""} ${mentioned && !highlight ? "bg-[#fffdf4]" : ""}`}>
      <HoverBar
        onReact={(e) => onReact(m.id, e)}
        onThread={() => onThread(m.id)}
        onCopy={() => navigator.clipboard?.writeText(m.text).catch(() => {})}
      />
      <div className="flex gap-3">
        <div className={`w-9 h-9 rounded ${a.bg} flex items-center justify-center text-[15px] font-black shrink-0`}>
          {a.letter}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-tight">
            <span className="font-bold">{a.name}</span>
            {m.agentId && m.agentId !== "owner" && (
              <span className="font-mono text-[11px] text-[#616061] ml-2">{m.agentId}</span>
            )}
            <span className="text-[12px] text-[#616061] ml-2">{fmtTime(m.createdAt)}</span>
            {m.kind === "task_result" && (
              <span className="text-[11px] font-bold uppercase text-[#007a5a] ml-2">ticket update</span>
            )}
          </p>
          <div className="text-[15px] text-[#1d1c1d] break-words">
            <RichText text={m.text} />
          </div>
          {m.kind === "disagreement_card" && m.card && <DisagreementCard m={m} />}
          <Reactions m={m} onReact={onReact} />
          {replies > 0 && (
            <button onClick={() => onThread(m.id)} className="mt-1 flex items-center gap-2 text-[13px] font-bold text-[#1264a3] hover:underline">
              <span className="flex -space-x-1">
                {threadReplies(all, m.id).slice(0, 3).map((r) => {
                  const ra = avatarFor(r);
                  return <span key={r.id} className={`w-5 h-5 rounded ${ra.bg} text-white text-[10px] font-bold flex items-center justify-center border border-white`}>{ra.letter}</span>;
                })}
              </span>
              {replies} {replies === 1 ? "reply" : "replies"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessagePane({ feed, messages, channel, goal, participants, newAfter, highlightId, memberFilter, onReact, onThread, onChoose }: {
  feed: FeedItem[];
  messages: ChatMessage[];
  channel: string;
  goal: string;
  participants: { id: string; role: string; agentId: string }[];
  newAfter: number | null;
  highlightId: string | null;
  memberFilter: string | null;
  onReact: (id: string, emoji: string) => void;
  onThread: (id: string) => void;
  onChoose: (cardId: string, optionId: string, title: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  const items = feed.filter((it) => {
    if (it.t === "message") {
      if (it.m.replyTo) return false;
      if (memberFilter) {
        const role = it.m.agentId === "owner" ? "owner" : it.m.role;
        if (role !== memberFilter) return false;
      }
    }
    return true;
  });

  useEffect(() => {
    if (atBottom) bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [feed.length, atBottom]);

  let lastDay = "";
  let newShown = false;

  return (
    <div
      className="flex-1 overflow-y-auto sl-scroll"
      onScroll={(e) => {
        const el = e.currentTarget;
        setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
      }}
    >
      {memberFilter && (
        <div className="mx-5 mt-3 flex items-center gap-2 bg-[#e8f0fe] border border-[#b9d4f5] rounded-lg px-3 py-2 text-[13px]">
          <span>Showing messages from <b>@{memberFilter}</b></span>
        </div>
      )}
      <ChannelHero channel={channelName(goal)} goal={goal} />
      {items.map((it) => {
        const at = it.at;
        const day = dayKey(at);
        const divider = day !== lastDay ? <DayDivider key={`d-${at}`} ts={at} /> : null;
        lastDay = day;
        const showNew = newAfter != null && !newShown && at > newAfter;
        if (showNew) newShown = true;
        const key = it.t === "message" ? it.m.id : it.t === "ticket" ? it.task.id : it.d.id;
        return (
          <div key={key}>
            {divider}
            {showNew && <NewDivider />}
            {it.t === "message" && it.m.kind === "system" ? (
              <SystemCard text={it.m.text} />
            ) : it.t === "message" ? (
              <MessageRow m={it.m} all={messages} onReact={onReact} onThread={onThread} highlight={highlightId === it.m.id} />
            ) : it.t === "ticket" ? (
              <div className="sl-msg group relative px-5 py-1.5 pl-[68px]">
                <TicketCard task={it.task} assigneeLabel={participants.find((p) => p.id === it.task.assignedTo)?.agentId} />
              </div>
            ) : (
              <div className="px-5 py-1.5">
                <DecisionCard d={it.d} />
              </div>
            )}
          </div>
        );
      })}
      <div ref={bottomRef} className="h-4" />
    </div>
  );
}
