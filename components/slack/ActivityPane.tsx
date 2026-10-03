"use client";

import { At, WarningCircle, Ticket } from "@phosphor-icons/react";
import { buildActivity, avatarFor } from "./types";
import type { RoomState } from "../chat/types";
import { fmtTime } from "../chat/types";

const ICON = {
  mention: <At size={18} className="text-[#e01e5a]" />,
  disagreement: <WarningCircle size={18} className="text-[#e01e5a]" />,
  ticket: <Ticket size={18} className="text-[#007a5a]" />,
};

export default function ActivityPane({ state, onJump }: {
  state: RoomState | null;
  onJump: (messageId: string) => void;
}) {
  const items = state ? buildActivity(state) : [];
  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-white">
      <div className="border-b border-[#dddddd] px-5 py-3">
        <h2 className="font-black text-[18px]">Activity</h2>
        <p className="text-[13px] text-[#616061]">Mentions, calls for decisions, resolved tickets.</p>
      </div>
      <div className="flex-1 overflow-y-auto sl-scroll">
        {items.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="font-bold text-[15px]">All caught up</p>
            <p className="text-[13px] text-[#616061] mt-1">Mentions and decision requests will land here.</p>
          </div>
        )}
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => it.messageId && onJump(it.messageId)}
            className="w-full text-left px-5 py-3 border-b border-[#f1f1f1] hover:bg-[#f8f8f8] flex gap-3"
          >
            <span className="mt-0.5 shrink-0">{ICON[it.kind]}</span>
            <span className="min-w-0">
              <span className="text-[14px] font-bold block">{it.title}</span>
              <span className="text-[13px] text-[#616061] block truncate">{it.subtitle}</span>
              <span className="text-[12px] text-[#616061]">{fmtTime(it.at)}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export { avatarFor };
