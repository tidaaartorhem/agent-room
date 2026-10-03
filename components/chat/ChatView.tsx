"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import ChannelHeader from "./ChannelHeader";
import MessageStream from "./MessageStream";
import Composer from "./Composer";
import { RoomState, RoomSummary } from "./types";

export default function ChatView({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [data, setData] = useState<RoomState | null>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [err, setErr] = useState("");
  const [driving, setDriving] = useState(false);
  const [progress, setProgress] = useState("");
  const [ticketMode, setTicketMode] = useState(false);
  const [composerNonce, setComposerNonce] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem("ar_token") ?? "");
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

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const [s, r] = await Promise.all([
        api(`/api/v1/rooms/${roomId}/state`),
        api(`/api/v1/admin/rooms`).catch(() => ({ rooms: [] })),
      ]);
      setData(s);
      setRooms(r.rooms ?? []);
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [api, roomId, token]);

  useEffect(() => {
    if (!token) return;
    refresh();
    const iv = setInterval(refresh, 4000);
    return () => clearInterval(iv);
  }, [refresh, token]);

  const saveToken = () => {
    localStorage.setItem("ar_token", tokenInput.trim());
    setToken(tokenInput.trim());
  };

  const startAndDrive = async (mode: "team" | "single", autoDraft: boolean) => {
    setDriving(true);
    setProgress("starting…");
    try {
      const { runId } = await api(`/api/v1/runs`, {
        method: "POST",
        body: JSON.stringify({ roomId, mode, autoDraft }),
      });
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
                setDriving(false);
                setProgress("");
                refresh();
                return;
              }
            } catch { /* noop */ }
          }
        }
      }
    } catch (e) {
      setErr((e as Error).message);
    }
    setDriving(false);
    setProgress("");
    refresh();
  };

  const runAction = async (action: "pause" | "stop" | "resume") => {
    if (!data?.run) return;
    try {
      await api(`/api/v1/runs/${data.run.runId}`, { method: "POST", body: JSON.stringify({ action }) });
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const sendMessage = async (text: string) => {
    await api(`/api/v1/rooms/${roomId}/messages`, { method: "POST", body: JSON.stringify({ text }) });
    refresh();
  };

  const assignTicket = async (to: string, taskType: string, description: string) => {
    await api(`/api/v1/rooms/${roomId}/task-proposals`, {
      method: "POST",
      body: JSON.stringify({ to, taskType, description }),
    });
    refresh();
  };

  const choose = async (cardId: string, optionId: string, title: string) => {
    try {
      await api(`/api/v1/rooms/${roomId}/decisions`, {
        method: "POST",
        body: JSON.stringify({ text: `Owner decision: ${title}`, cardId, chosenOption: optionId }),
      });
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="card p-8 max-w-md w-full">
          <h1 className="serif text-3xl mb-2">Agent Room</h1>
          <p className="text-sm text-[var(--color-muted)] mb-6">
            Private workspace. Enter your owner token to continue.
          </p>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="ar_admin_…"
            className="w-full border border-[var(--color-line)] rounded-md px-4 py-3 text-sm mb-4 bg-white"
            onKeyDown={(e) => e.key === "Enter" && saveToken()}
          />
          <button onClick={saveToken} className="btn-primary w-full py-3 text-sm">
            Enter workspace
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen flex overflow-hidden">
      <div className="hidden md:block h-full">
        <Sidebar
          rooms={rooms}
          roomId={roomId}
          goal={data?.goal ?? "…"}
          participants={data?.participants ?? []}
          onSelect={(id) => router.push(`/room/${id}`)}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-full bg-white">
        <div className="md:hidden border-b border-[var(--color-line)] px-4 py-2 flex items-center gap-2">
          <button onClick={() => setSidebarOpen(true)} className="btn-ghost text-xs px-3 py-1.5">☰ Channels</button>
          <span className="serif font-semibold">Agent Room</span>
        </div>
        <ChannelHeader
          goal={data?.goal ?? "Loading…"}
          run={data?.run ?? null}
          participants={data?.participants ?? []}
          driving={driving}
          onStart={startAndDrive}
          onAction={runAction}
          onNewTicket={() => { setTicketMode(true); setComposerNonce((n) => n + 1); }}
        />
        {err && (
          <div className="border-b border-[var(--color-line)] px-5 py-2 bg-[var(--color-pale-red-bg)]">
            <p className="text-xs text-[var(--color-pale-red-tx)] font-mono">{err}</p>
          </div>
        )}
        {driving && progress && (
          <div className="border-b border-[var(--color-line)] px-5 py-2">
            <p className="font-mono text-xs text-[var(--color-muted)]">{progress}…</p>
          </div>
        )}
        {data ? (
          <MessageStream state={data} onChoose={choose} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="font-mono text-sm text-[var(--color-muted)]">loading channel…</p>
          </div>
        )}
        <Composer
          key={`composer-${composerNonce}`}
          initialMode={ticketMode ? "ticket" : "message"}
          participants={data?.participants ?? []}
          tasks={data?.tasks ?? []}
          onSend={sendMessage}
          onAssign={assignTicket}
          disabled={!data}
        />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-20 md:hidden">
          <div className="absolute inset-0 bg-black/20" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[80%] max-w-xs h-full" onClick={() => setSidebarOpen(false)}>
            <Sidebar
              rooms={rooms}
              roomId={roomId}
              goal={data?.goal ?? "…"}
              participants={data?.participants ?? []}
              onSelect={(id) => router.push(`/room/${id}`)}
            />
          </div>
        </div>
      )}
    </main>
  );
}
