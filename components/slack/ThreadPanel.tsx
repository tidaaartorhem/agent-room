"use client";

import { X } from "@phosphor-icons/react";
import type { ChatMessage } from "../chat/types";
import { fmtTime, channelName } from "../chat/types";
import { RichText } from "../chat/MessageStream";
import { avatarFor, threadReplies } from "./types";

export default function ThreadPanel({ parent, messages, channel, goal, onClose, onReact, composer }: {
  parent: ChatMessage;
  messages: ChatMessage[];
  channel: string;
  goal: string;
  onClose: () => void;
  onReact: (id: string, emoji: string) => void;
  composer: React.ReactNode;
}) {
  const a = avatarFor(parent);
  const replies = threadReplies(messages, parent.id);
  return (
    <aside className="w-[380px] shrink-0 border-l border-[#dddddd] bg-white flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[#dddddd] flex items-center gap-2">
        <div className="min-w-0">
          <h3 className="font-bold text-[15px] leading-tight">Thread</h3>
          <p className="text-[12px] text-[#616061] truncate"># {channelName(goal)}</p>
        </div>
        <button onClick={onClose} className="ml-auto p-1.5 rounded hover:bg-[#f1f1f1] text-[#616061]" title="Close thread">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto sl-scroll py-2">
        <div className="px-4 py-2 border-b border-[#e9e9e9] mb-2">
          <div className="flex gap-3">
            <div className={`w-9 h-9 rounded ${a.bg} flex items-center justify-center text-[15px] font-black shrink-0`}>{a.letter}</div>
            <div className="min-w-0">
              <p className="text-[15px]"><span className="font-bold">{a.name}</span><span className="text-[12px] text-[#616061] ml-2">{fmtTime(parent.createdAt)}</span></p>
              <div className="text-[15px] break-words"><RichText text={parent.text} /></div>
            </div>
          </div>
          <p className="text-[12px] text-[#616061] mt-2">{replies.length} {replies.length === 1 ? "reply" : "replies"}</p>
        </div>
        {replies.map((r) => {
          const ra = avatarFor(r);
          return (
            <div key={r.id} className="sl-msg px-4 py-1.5">
              <div className="flex gap-3">
                <div className={`w-9 h-9 rounded ${ra.bg} flex items-center justify-center text-[15px] font-black shrink-0`}>{ra.letter}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px]"><span className="font-bold">{ra.name}</span><span className="text-[12px] text-[#616061] ml-2">{fmtTime(r.createdAt)}</span></p>
                  <div className="text-[15px] break-words"><RichText text={r.text} /></div>
                </div>
              </div>
            </div>
          );
        })}
        {replies.length === 0 && (
          <p className="px-4 py-6 text-[13px] text-[#616061] text-center">No replies yet. Start the thread below.</p>
        )}
      </div>
      <div className="border-t border-[#dddddd]">{composer}</div>
    </aside>
  );
}
