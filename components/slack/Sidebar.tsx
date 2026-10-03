"use client";

import { Hash, Plus, CaretDown } from "@phosphor-icons/react";
import { useState } from "react";
import type { RoomSummary, Participant } from "../chat/types";
import { channelName } from "../chat/types";
import { displayName } from "./types";
import type { RailView } from "./NavRail";

export default function Sidebar({ view, rooms, roomId, participants, unread, mentionCounts, draftRooms, onSelectRoom, onSelectMember, memberFilter, onNewChannel }: {
  view: RailView;
  rooms: RoomSummary[];
  roomId: string | null;
  participants: Participant[];
  unread: Record<string, number>;
  mentionCounts: Record<string, number>;
  draftRooms: Set<string>;
  onSelectRoom: (id: string) => void;
  onSelectMember: (role: string | null) => void;
  memberFilter: string | null;
  onNewChannel: () => void;
}) {
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);

  const sectionBtn = "flex items-center gap-1 px-4 pt-4 pb-1 w-full text-left text-[13px] font-bold text-[#616061] hover:text-[#1d1c1d]";

  return (
    <aside className="w-[260px] shrink-0 bg-[#f6f4f7] border-r border-[#dddddd] flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-[#e5e2e8]">
        <h1 className="font-black text-[17px] leading-tight">Agent Room</h1>
        <p className="text-[12px] text-[#616061] flex items-center gap-1.5 mt-0.5">
          <span className="w-2 h-2 rounded-full bg-[#007a5a] inline-block" />
          You · owner
        </p>
      </div>

      <div className="flex-1 overflow-y-auto sl-scroll pb-4">
        {(view === "home" || view === "activity") && (
          <>
            <button className={sectionBtn} onClick={() => setChannelsOpen((o) => !o)}>
              <CaretDown size={12} weight="bold" className={`transition-transform ${channelsOpen ? "" : "-rotate-90"}`} />
              Channels
            </button>
            {channelsOpen && (
              <div className="px-2">
                {rooms.map((r) => {
                  const active = r.roomId === roomId;
                  const u = unread[r.roomId] ?? 0;
                  const mc = mentionCounts[r.roomId] ?? 0;
                  return (
                    <button
                      key={r.roomId}
                      onClick={() => onSelectRoom(r.roomId)}
                      className={`w-full flex items-center gap-2 px-2 h-7 rounded-md text-[15px] ${
                        active ? "bg-white font-bold text-[#1d1c1d] shadow-[inset_0_0_0_1px_#e2dfe6]" : "text-[#3a383a] hover:bg-[#edeaf0]"
                      } ${u > 0 && !active ? "font-bold text-[#1d1c1d]" : ""}`}
                      title={r.goal}
                    >
                      <Hash size={15} className="shrink-0 text-[#616061]" />
                      <span className="truncate flex-1 text-left">{channelName(r.goal)}</span>
                      {draftRooms.has(r.roomId) && <span className="text-[12px] italic text-[#616061]">Draft</span>}
                      {mc > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#e01e5a] text-white text-[11px] font-bold flex items-center justify-center">
                          {mc}
                        </span>
                      )}
                    </button>
                  );
                })}
                <button
                  onClick={onNewChannel}
                  className="w-full flex items-center gap-2 px-2 h-7 rounded-md text-[15px] text-[#616061] hover:bg-[#edeaf0] hover:text-[#1d1c1d]"
                >
                  <Plus size={15} className="shrink-0" />
                  <span>Add channel</span>
                </button>
              </div>
            )}
          </>
        )}

        {(view === "dms" || view === "home") && (
          <>
            <button className={sectionBtn} onClick={() => setDmsOpen((o) => !o)}>
              <CaretDown size={12} weight="bold" className={`transition-transform ${dmsOpen ? "" : "-rotate-90"}`} />
              Direct messages
            </button>
            {dmsOpen && (
              <div className="px-2">
                <button
                  onClick={() => onSelectMember(null)}
                  className={`w-full flex items-center gap-2 px-2 h-8 rounded-md text-[15px] ${memberFilter === null ? "bg-white font-bold shadow-[inset_0_0_0_1px_#e2dfe6]" : "hover:bg-[#edeaf0]"}`}
                >
                  <span className="w-5 h-5 rounded bg-[#1d1c1d] text-white flex items-center justify-center text-[11px] font-bold">Y</span>
                  <span className="flex-1 text-left">You <span className="text-[#616061] font-normal text-[13px]">· owner</span></span>
                </button>
                {participants.map((p) => {
                  const active = memberFilter === p.role;
                  return (
                    <button
                      key={p.id}
                      onClick={() => onSelectMember(active ? null : p.role)}
                      className={`w-full flex items-center gap-2 px-2 h-8 rounded-md text-[15px] ${active ? "bg-white font-bold shadow-[inset_0_0_0_1px_#e2dfe6]" : "hover:bg-[#edeaf0]"}`}
                      title={`${p.agentId} · ${p.providerLabel}`}
                    >
                      <span className="relative">
                        <span className="w-5 h-5 rounded bg-[#1264a3] text-white flex items-center justify-center text-[11px] font-bold">
                          {p.role[0].toUpperCase()}
                        </span>
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#007a5a] border-2 border-[#f6f4f7]" />
                      </span>
                      <span className="flex-1 text-left truncate">
                        {displayName(p)} <span className="text-[#616061] font-normal text-[13px] font-mono">· {p.agentId}</span>
                      </span>
                    </button>
                  );
                })}
                {participants.length === 0 && (
                  <p className="px-2 py-2 text-[13px] text-[#616061]">No agents seated yet.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
