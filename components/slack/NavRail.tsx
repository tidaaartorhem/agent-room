"use client";

import { House, ChatCircleDots, Bell, Plus, MagnifyingGlass } from "@phosphor-icons/react";

export type RailView = "home" | "dms" | "activity";

const BTN = "w-11 h-11 rounded-lg flex items-center justify-center transition-colors";

export default function NavRail({ view, setView, activityCount, onNewChannel, onSearch }: {
  view: RailView;
  setView: (v: RailView) => void;
  activityCount: number;
  onNewChannel: () => void;
  onSearch: () => void;
}) {
  const item = (v: RailView, Icon: typeof House, label: string, badge?: number) => (
    <button
      key={v}
      onClick={() => setView(v)}
      title={label}
      className={`${BTN} relative ${view === v ? "bg-[#e8e4ec] text-[#1d1c1d]" : "text-[#616061] hover:bg-[#f1f1f1] hover:text-[#1d1c1d]"}`}
    >
      <Icon size={22} weight={view === v ? "fill" : "regular"} />
      {badge != null && badge > 0 && (
        <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#e01e5a] text-white text-[10px] font-bold flex items-center justify-center">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      <span className="sr-only">{label}</span>
    </button>
  );

  return (
    <nav className="w-16 shrink-0 border-r border-[#dddddd] bg-white flex flex-col items-center py-3 gap-1">
      <div
        className="w-11 h-11 rounded-lg bg-[#4a154b] text-white flex items-center justify-center font-black text-lg mb-2"
        title="Agent Room"
      >
        A
      </div>
      {item("home", House, "Home")}
      {item("dms", ChatCircleDots, "Direct messages")}
      {item("activity", Bell, "Activity", activityCount)}
      <div className="flex-1" />
      <button onClick={onSearch} title="Search (Cmd+K)" className={`${BTN} text-[#616061] hover:bg-[#f1f1f1] hover:text-[#1d1c1d]`}>
        <MagnifyingGlass size={22} />
      </button>
      <button onClick={onNewChannel} title="New channel" className={`${BTN} text-[#616061] hover:bg-[#f1f1f1] hover:text-[#1d1c1d]`}>
        <Plus size={22} />
      </button>
      <div className="w-9 h-9 rounded bg-[#1d1c1d] text-white flex items-center justify-center text-sm font-bold mt-2" title="You (owner)">
        Y
      </div>
    </nav>
  );
}
