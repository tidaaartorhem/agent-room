"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NavRail, { RailView } from "./NavRail";
import Sidebar from "./Sidebar";
import ChannelHeader from "./ChannelHeader";
import MessagePane from "./MessagePane";
import ThreadPanel from "./ThreadPanel";
import Composer from "./Composer";
import ActivityPane from "./ActivityPane";
import { buildFeed, channelName } from "../chat/types";
import type { RoomState, RoomSummary, ChatMessage } from "../chat/types";
import { mentionsOwner } from "./types";

const seenKey = (r: string) => `ar_seen_${r}`;
const draftKey = (r: string) => `ar_draft_${r}`;

interface Meta { lastMsgAt: number; mentions: number; unread: number }

export default function WorkspaceShell({ initialRoomId }: { initialRoomId?: string }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [roomId, setRoomId] = useState<string | null>(initialRoomId ?? null);
  const [state, setState] = useState<RoomState | null>(null);
  const [meta, setMeta] = useState<Record<string, Meta>>({});
  const [view, setView] = useState<RailView>("home");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [memberFilter, setMemberFilter] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [driving, setDriving] = useState(false);
  const [progress, setProgress] = useState("");
  const [ticketNonce, setTicketNonce] = useState(0);
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [newGoal, setNewGoal] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [draftRooms, setDraftRooms] = useState<Set<string>>(new Set());

  useEffect(() => {
    setToken(localStorage.getItem("ar_token"));
    const drafts = new Set<string>();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("ar_draft_") && localStorage.getItem(k)?.trim()) drafts.add(k.slice(9));
    }
    setDraftRooms(drafts);
  }, []);

  const api = useCallback(
    async (path: string, opts: RequestInit = {}) => {
      const res = await fetch(path, {
        ...opts,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      return body;
    },
    [token]
  );

  const computeMeta = useCallback((rid: string, s: RoomState): Meta => {
    const seen = Number(localStorage.getItem(seenKey(rid)) ?? 0);
    let unread = 0, mentions = 0, last = 0;
    for (const m of s.messages) {
      if (m.replyTo || m.agentId === "owner") continue;
      if (m.createdAt > last) last = m.createdAt;
      if (m.createdAt > seen) {
        unread++;
        if (mentionsOwner(m)) mentions++;
      }
    }
    return { lastMsgAt: last, mentions, unread };
  }, []);

  const refreshRooms = useCallback(async (withMeta: boolean) => {
    if (!token) return;
    try {
      const r = await api(`/api/v1/admin/rooms`).catch(() => ({ rooms: [] }));
      const list: RoomSummary[] = r.rooms ?? [];
      setRooms(list);
      if (withMeta) {
        // one-time meta fetch for badges
        const m: Record<string, Meta> = {};
        await Promise.all(
          list.slice(0, 12).map(async (rm) => {
            try {
              const s: RoomState = await api(`/api/v1/rooms/${rm.roomId}/state`);
              m[rm.roomId] = computeMeta(rm.roomId, s);
            } catch { /* noop */ }
          })
        );
        setMeta((prev) => ({ ...prev, ...m }));
      }
      setRoomId((cur) => cur ?? (list.length > 0 ? list[0].roomId : null));
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [api, token, computeMeta]);

  const refreshState = useCallback(async () => {
    if (!token || !roomId) return;
    try {
      const s: RoomState = await api(`/api/v1/rooms/${roomId}/state`);
      setState(s);
      setMeta((prev) => ({ ...prev, [roomId]: computeMeta(roomId, s) }));
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [api, token, roomId, computeMeta]);

  useEffect(() => {
    if (!token) return;
    refreshRooms(true);
    const iv = setInterval(() => refreshRooms(false), 15000);
    const onFocus = () => refreshRooms(false);
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(iv); window.removeEventListener("focus", onFocus); };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token || !roomId) return;
    setState(null);
    setThreadId(null);
    setMemberFilter(null);
    refreshState();
    const iv = setInterval(refreshState, 4000);
    return () => clearInterval(iv);
  }, [token, roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // mark seen as you view
  useEffect(() => {
    if (!roomId || !state) return;
    const max = state.messages.reduce((n, m) => Math.max(n, m.createdAt), 0);
    localStorage.setItem(seenKey(roomId), String(max));
  }, [roomId, state?.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cmd+K search
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const saveToken = () => {
    const t = tokenInput.trim();
    if (!t) return;
    localStorage.setItem("ar_token", t);
    setToken(t);
  };

  const selectRoom = (id: string) => {
    setRoomId(id);
    setView("home");
    setMemberFilter(null);
    router.push(`/room/${id}`);
  };

  const startAndDrive = async (mode: "team" | "single", autoDraft: boolean) => {
    if (!roomId) return;
    setDriving(true);
    setProgress("starting…");
    try {
      const { runId } = await api(`/api/v1/runs`, { method: "POST", body: JSON.stringify({ roomId, mode, autoDraft }) });
      const res = await fetch(`/api/v1/runs/${runId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "drive" }),
      });
      const reader = res.body?.getReader();
      const dec = new TextDecoder();
      let buf = "";
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const p of parts) {
            const line = p.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            try {
              const o = JSON.parse(line.slice(5));
              if (o.progress) setProgress(o.progress);
              if (o.done || o.error) {
                if (o.error) setErr(o.error);
                setDriving(false); setProgress("");
                refreshState();
                return;
              }
            } catch { /* noop */ }
          }
        }
      }
    } catch (e) {
      setErr((e as Error).message);
    }
    setDriving(false); setProgress("");
    refreshState();
  };

  const runAction = async (a: "pause" | "stop" | "resume") => {
    if (!state?.run) return;
    try {
      await api(`/api/v1/runs/${state.run.runId}`, { method: "POST", body: JSON.stringify({ action: a }) });
      refreshState();
    } catch (e) { setErr((e as Error).message); }
  };

  const sendMessage = async (text: string, tp?: string | null) => {
    if (!roomId) return;
    await api(`/api/v1/rooms/${roomId}/messages`, { method: "POST", body: JSON.stringify({ text, replyTo: tp ?? undefined }) });
    localStorage.removeItem(draftKey(roomId));
    setDraftRooms((d) => { const n = new Set(d); n.delete(roomId); return n; });
    refreshState();
  };

  const assignTicket = async (to: string, taskType: string, description: string) => {
    if (!roomId) return;
    await api(`/api/v1/rooms/${roomId}/task-proposals`, { method: "POST", body: JSON.stringify({ to, taskType, description }) });
    refreshState();
  };

  const react = async (messageId: string, emoji: string) => {
    if (!roomId) return;
    try {
      await api(`/api/v1/rooms/${roomId}/messages/${messageId}/reactions`, { method: "POST", body: JSON.stringify({ emoji }) });
      refreshState();
    } catch (e) { setErr((e as Error).message); }
  };

  const choose = async (cardId: string, optionId: string, title: string) => {
    if (!roomId) return;
    try {
      await api(`/api/v1/rooms/${roomId}/decisions`, {
        method: "POST",
        body: JSON.stringify({ text: `Owner decision: ${title}`, cardId, chosenOption: optionId }),
      });
      refreshState();
    } catch (e) { setErr((e as Error).message); }
  };

  const createChannel = async () => {
    const goal = newGoal.trim();
    if (!goal) return;
    try {
      const r = await api(`/api/v1/admin/rooms`, { method: "POST", body: JSON.stringify({ goal }) });
      setNewChannelOpen(false);
      setNewGoal("");
      await refreshRooms(false);
      selectRoom(r.roomId);
    } catch (e) { setErr((e as Error).message); }
  };

  const jumpTo = (messageId: string) => {
    setView("home");
    setHighlightId(messageId);
    setTimeout(() => setHighlightId(null), 4000);
    document.getElementById(`msg-anchor-${messageId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const onDraftText = (text: string) => {
    if (!roomId) return;
    if (text.trim()) {
      localStorage.setItem(draftKey(roomId), text);
      setDraftRooms((d) => new Set(d).add(roomId));
    } else {
      localStorage.removeItem(draftKey(roomId));
      setDraftRooms((d) => { const n = new Set(d); n.delete(roomId); return n; });
    }
  };

  if (!token) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="w-12 h-12 rounded-xl bg-[#4a154b] text-white flex items-center justify-center font-black text-xl mb-6">A</div>
          <h1 className="font-black text-[28px] mb-1">Sign in to Agent Room</h1>
          <p className="text-[14px] text-[#616061] mb-6">agent-room · enter your owner token to continue.</p>
          <label className="text-[13px] font-bold block mb-1.5">Owner token</label>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveToken()}
            placeholder="ar_admin_…"
            className="w-full border border-[#616061] rounded-lg px-3.5 py-2.5 text-[15px] mb-4 focus:outline-none focus:border-[#1d1c1d] focus:shadow-[0_0_0_1px_#1d1c1d]"
          />
          <button onClick={saveToken} className="w-full h-11 rounded-lg bg-[#4a154b] text-white font-bold text-[15px] hover:bg-[#5a1c5c] active:scale-[0.99]">
            Sign in
          </button>
        </div>
      </main>
    );
  }

  const feed = state ? buildFeed(state) : [];
  const activityCount = state ? meta[roomId ?? ""]?.mentions ?? 0 : 0;
  const threadParent: ChatMessage | null = threadId && state ? state.messages.find((m) => m.id === threadId) ?? null : null;
  const searchResults = searchQ.trim() && state
    ? state.messages.filter((m) => m.text.toLowerCase().includes(searchQ.toLowerCase())).slice(-20).reverse()
    : [];

  return (
    <main className="h-screen flex overflow-hidden bg-white">
      <NavRail
        view={view}
        setView={setView}
        activityCount={activityCount}
        onNewChannel={() => setNewChannelOpen(true)}
        onSearch={() => setSearchOpen(true)}
      />
      <div className="hidden md:block h-full">
        <Sidebar
          view={view}
          rooms={rooms}
          roomId={roomId}
          participants={state?.participants ?? []}
          unread={Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, v.unread]))}
          mentionCounts={Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, v.mentions]))}
          draftRooms={draftRooms}
          onSelectRoom={selectRoom}
          onSelectMember={(r) => { setMemberFilter(r); setView("dms"); }}
          memberFilter={memberFilter}
          onNewChannel={() => setNewChannelOpen(true)}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        {view === "activity" ? (
          <ActivityPane state={state} onJump={jumpTo} />
        ) : !roomId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-sm px-6">
              <p className="font-black text-[20px] mb-2">No channels yet</p>
              <p className="text-[14px] text-[#616061] mb-4">Create a channel to start a discussion room with your agents.</p>
              <button onClick={() => setNewChannelOpen(true)} className="px-5 h-10 rounded-lg bg-[#4a154b] text-white font-bold text-[14px] hover:bg-[#5a1c5c]">
                Create a channel
              </button>
            </div>
          </div>
        ) : (
          <>
            <ChannelHeader
              goal={state?.goal ?? "Loading…"}
              run={state?.run ?? null}
              participants={state?.participants ?? []}
              driving={driving}
              onStart={startAndDrive}
              onAction={runAction}
              onNewTicket={() => setTicketNonce((n) => n + 1)}
            />
            {err && (
              <div className="border-b border-[#dddddd] px-5 py-2 bg-[#fdebec]">
                <p className="text-[12px] text-[#9f2f2d] font-mono">{err}</p>
              </div>
            )}
            {driving && progress && (
              <div className="border-b border-[#dddddd] px-5 py-2">
                <p className="font-mono text-[12px] text-[#616061]">{progress}…</p>
              </div>
            )}
            {state ? (
              <MessagePane
                feed={feed}
                messages={state.messages}
                channel={channelName(state.goal)}
                goal={state.goal}
                participants={state.participants}
                newAfter={Number(localStorage.getItem(seenKey(roomId)) ?? 0) || null}
                highlightId={highlightId}
                memberFilter={memberFilter}
                onReact={react}
                onThread={(id) => setThreadId(id)}
                onChoose={choose}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="font-mono text-[13px] text-[#616061]">loading channel…</p>
              </div>
            )}
            <Composer
              key={`composer-${ticketNonce}`}
              participants={state?.participants ?? []}
              tasks={state?.tasks ?? []}
              initialMode={ticketNonce > 0 ? "ticket" : "message"}
              onSend={sendMessage}
              onAssign={assignTicket}
              onDraftText={onDraftText}
            />
          </>
        )}
      </div>

      {threadParent && (
        <ThreadPanel
          parent={threadParent}
          messages={state?.messages ?? []}
          channel={channelName(state?.goal ?? "")}
          goal={state?.goal ?? ""}
          onClose={() => setThreadId(null)}
          onReact={react}
          composer={
            <Composer
              compact
              participants={state?.participants ?? []}
              tasks={state?.tasks ?? []}
              threadParent={threadParent.id}
              onSend={sendMessage}
              onAssign={assignTicket}
            />
          }
        />
      )}

      {newChannelOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setNewChannelOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-[440px] max-w-[92vw] p-6">
            <h3 className="font-black text-[20px] mb-1">Create a channel</h3>
            <p className="text-[13px] text-[#616061] mb-4">Channels are discussion rooms. Name it by its goal.</p>
            <label className="text-[13px] font-bold block mb-1.5">Channel goal</label>
            <input
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createChannel()}
              placeholder="e.g. Plan the Q3 launch post"
              autoFocus
              className="w-full border border-[#616061] rounded-lg px-3.5 py-2.5 text-[15px] mb-4 focus:outline-none focus:border-[#1d1c1d]"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setNewChannelOpen(false)} className="px-4 h-10 rounded-lg border border-[#dddddd] font-bold text-[14px] hover:bg-[#f8f8f8]">Cancel</button>
              <button onClick={createChannel} className="px-5 h-10 rounded-lg bg-[#007a5a] text-white font-bold text-[14px] hover:bg-[#006349]">Create</button>
            </div>
          </div>
        </div>
      )}

      {searchOpen && (
        <div className="fixed inset-0 z-30 flex justify-center pt-[12vh]">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSearchOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-[560px] max-w-[92vw] max-h-[60vh] flex flex-col overflow-hidden">
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search messages in this channel…"
              autoFocus
              className="px-4 py-3.5 text-[15px] border-b border-[#dddddd] focus:outline-none"
            />
            <div className="overflow-y-auto sl-scroll">
              {searchResults.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setSearchOpen(false); jumpTo(m.id); setSearchQ(""); }}
                  className="w-full text-left px-4 py-2.5 border-b border-[#f1f1f1] hover:bg-[#f8f8f8]"
                >
                  <p className="text-[13px] font-bold">{m.agentId === "owner" ? "You" : m.role} <span className="font-normal text-[#616061]">{new Date(m.createdAt).toLocaleString()}</span></p>
                  <p className="text-[14px] truncate">{m.text}</p>
                </button>
              ))}
              {searchQ.trim() && searchResults.length === 0 && (
                <p className="px-4 py-6 text-[13px] text-[#616061] text-center">No messages match.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
