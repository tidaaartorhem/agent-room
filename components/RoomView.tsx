"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCard, CardMessage } from "./MessageCard";

interface Task {
  id: string; assignedBy: string; assignedTo: string; toRole: string;
  taskType: string; description: string; state: string; contextVersion: number;
  result?: string; createdAt: number;
}
interface Brief { id: string; version: number; text: string; diff: string; authorType: string; authorId: string; createdAt: number }
interface Decision { id: string; text: string; scope?: string; createdAt: number }
interface RunInfo { runId: string; state: string; mode: string; autoDraft: boolean; counters: { turns: number; inputTokens: number; outputTokens: number }; startedAt: number; endedAt?: number }
interface StateData {
  goal: string; contextVersion: number; autoDraftDefault: boolean;
  messages: CardMessage[]; tasks: Task[]; briefs: Brief[]; decisions: Decision[]; run: RunInfo | null;
}

const TASK_TAG: Record<string, string> = {
  queued: "bg-[var(--color-bone)] text-[var(--color-muted)]",
  accepted: "bg-[var(--color-pale-blue-bg)] text-[var(--color-pale-blue-tx)]",
  working: "bg-[var(--color-pale-yellow-bg)] text-[var(--color-pale-yellow-tx)]",
  waiting: "bg-[var(--color-pale-yellow-bg)] text-[var(--color-pale-yellow-tx)]",
  completed: "bg-[var(--color-pale-green-bg)] text-[var(--color-pale-green-tx)]",
  cancelled: "bg-[var(--color-pale-red-bg)] text-[var(--color-pale-red-tx)]",
  error: "bg-[var(--color-pale-red-bg)] text-[var(--color-pale-red-tx)]",
  timed_out: "bg-[var(--color-pale-red-bg)] text-[var(--color-pale-red-tx)]",
};

export default function RoomView({ roomId }: { roomId: string }) {
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [data, setData] = useState<StateData | null>(null);
  const [err, setErr] = useState("");
  const [composer, setComposer] = useState("");
  const [mode, setMode] = useState<"team" | "single">("team");
  const [autoDraft, setAutoDraft] = useState(false);
  const [driving, setDriving] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [challengeTopic, setChallengeTopic] = useState("");
  const [showChallenge, setShowChallenge] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [briefEdit, setBriefEdit] = useState("");
  const [showBriefEdit, setShowBriefEdit] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

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
      const s = await api(`/api/v1/rooms/${roomId}/state`);
      setData(s);
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [api, roomId, token]);

  useEffect(() => {
    if (!token) return;
    refresh();
    const iv = setInterval(refresh, 3000);
    return () => clearInterval(iv);
  }, [refresh, token]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [data?.messages.length]);

  const saveToken = () => {
    localStorage.setItem("ar_token", tokenInput.trim());
    setToken(tokenInput.trim());
  };

  const startAndDrive = async () => {
    setDriving(true);
    setProgress([]);
    try {
      const { runId } = await api(`/api/v1/runs`, {
        method: "POST",
        body: JSON.stringify({ roomId, mode, autoDraft }),
      });
      // Drive: SSE progress stream; server loop continues if we disconnect.
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
              if (o.progress) setProgress((x) => [...x.slice(-19), o.progress]);
              if (o.done || o.error) {
                setDriving(false);
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

  const sendMessage = async () => {
    if (!composer.trim()) return;
    try {
      await api(`/api/v1/rooms/${roomId}/messages`, { method: "POST", body: JSON.stringify({ text: composer.trim() }) });
      setComposer("");
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const sendChallenge = async () => {
    if (!data?.run || !challengeTopic.trim()) return;
    try {
      await api(`/api/v1/rooms/${roomId}/challenge`, {
        method: "POST",
        body: JSON.stringify({ runId: data.run.runId, topic: challengeTopic.trim() }),
      });
      setChallengeTopic("");
      setShowChallenge(false);
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
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

  const submitBrief = async () => {
    const cur = data?.briefs[0];
    if (!briefEdit.trim()) return;
    try {
      await api(`/api/v1/rooms/${roomId}/brief-proposals`, {
        method: "POST",
        body: JSON.stringify({ baseVersion: cur?.version ?? 0, newText: briefEdit.trim() }),
      });
      setBriefEdit("");
      setShowBriefEdit(false);
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
            Private room. Enter your owner token to continue. Tokens are never in URLs.
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
            Enter room
          </button>
        </div>
      </main>
    );
  }

  const run = data?.run;
  const brief = data?.briefs[0];
  const runActive = run && (run.state === "running" || run.state === "paused");

  const rail = (
    <div className="space-y-4">
      <div className="card p-5">
        <p className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-2">Pinned goal</p>
        <p className="serif text-lg leading-snug">{data?.goal ?? "…"}</p>
        <p className="font-mono text-xs text-[var(--color-muted)] mt-2">context v{data?.contextVersion ?? 0}</p>
      </div>

      <div className="card p-5">
        <p className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-2">
          Owner decisions <span className="normal-case">({data?.decisions.length ?? 0})</span>
        </p>
        {(data?.decisions.length ?? 0) === 0 && (
          <p className="text-xs text-[var(--color-muted)]">None yet. Decisions you make are immutable to agents.</p>
        )}
        <ul className="space-y-2">
          {data?.decisions.map((d) => (
            <li key={d.id} className="text-sm border-l-2 border-[#111111] pl-3">
              {d.text}
              {d.scope && <span className="text-xs text-[var(--color-muted)]"> ({d.scope})</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
            Team draft {brief ? <span className="normal-case">v{brief.version}</span> : ""}
          </p>
          {brief && (
            <span className={`tag ${brief.authorType === "owner" ? "bg-[#111111] text-white" : "bg-[var(--color-pale-blue-bg)] text-[var(--color-pale-blue-tx)]"}`}>
              {brief.authorType === "owner" ? "owner" : "team draft"}
            </span>
          )}
        </div>
        <p className="text-sm whitespace-pre-wrap text-[var(--color-ink-soft)] max-h-64 overflow-y-auto">
          {brief?.text ?? "No draft yet."}
        </p>
        <button onClick={() => { setBriefEdit(brief?.text ?? ""); setShowBriefEdit((s) => !s); }} className="btn-ghost text-xs px-3 py-2 mt-3">
          {showBriefEdit ? "Cancel" : "Revise brief as owner"}
        </button>
        {showBriefEdit && (
          <div className="mt-3">
            <textarea
              value={briefEdit}
              onChange={(e) => setBriefEdit(e.target.value)}
              rows={8}
              className="w-full border border-[var(--color-line)] rounded-md p-3 text-sm bg-white"
            />
            <button onClick={submitBrief} className="btn-primary text-xs px-4 py-2 mt-2">
              Save as owner revision (base v{brief?.version ?? 0})
            </button>
          </div>
        )}
      </div>

      <div className="card p-5">
        <p className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-2">
          Tasks <span className="normal-case">({data?.tasks.length ?? 0})</span>
        </p>
        {(data?.tasks.length ?? 0) === 0 && <p className="text-xs text-[var(--color-muted)]">No tasks assigned yet.</p>}
        <ul className="space-y-2">
          {data?.tasks.map((t) => (
            <li key={t.id} className="text-xs border border-[var(--color-line)] rounded-md p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className={`tag ${TASK_TAG[t.state] ?? TASK_TAG.queued}`}>{t.state}</span>
                <span className="font-mono text-[var(--color-muted)]">{t.taskType} → {t.toRole}</span>
              </div>
              <p className="text-[var(--color-ink-soft)] mb-1">{t.description}</p>
              <p className="font-mono text-[var(--color-muted)]">by {t.assignedBy} · ctx v{t.contextVersion}</p>
            </li>
          ))}
        </ul>
      </div>

      {run && (
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-2">Run</p>
          <p className="font-mono text-xs">
            {run.runId.slice(0, 14)}… · {run.state} · {run.mode}
          </p>
          <p className="font-mono text-xs text-[var(--color-muted)] mt-1">
            turns {run.counters.turns}/12 · {run.counters.inputTokens} in / {run.counters.outputTokens} out
          </p>
        </div>
      )}
    </div>
  );

  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--color-line)] bg-[var(--color-paper)] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <h1 className="serif text-xl">Agent Room</h1>
          <span className="tag bg-[var(--color-pale-green-bg)] text-[var(--color-pale-green-tx)] hidden sm:inline-block">
            Room work only · No external tools
          </span>
          <div className="ml-auto flex items-center gap-2">
            {!runActive && !driving && (
              <>
                <select value={mode} onChange={(e) => setMode(e.target.value as "team" | "single")} className="btn-ghost text-xs px-3 py-2">
                  <option value="team">team</option>
                  <option value="single">single</option>
                </select>
                <label className="text-xs flex items-center gap-1 text-[var(--color-muted)]" title="Accepted internal brief proposals may auto-update the TEAM DRAFT (never owner decisions). Revocable via stop.">
                  <input type="checkbox" checked={autoDraft} onChange={(e) => setAutoDraft(e.target.checked)} />
                  auto-draft
                </label>
                <button onClick={startAndDrive} className="btn-primary text-xs px-4 py-2">
                  Start run
                </button>
              </>
            )}
            {run?.state === "running" && (
              <>
                <button onClick={() => setShowChallenge((s) => !s)} className="btn-ghost text-xs px-3 py-2">Challenge</button>
                <button onClick={() => runAction("pause")} className="btn-ghost text-xs px-3 py-2">Pause</button>
                <button onClick={() => runAction("stop")} className="btn-ghost text-xs px-3 py-2">Stop</button>
              </>
            )}
            {run?.state === "paused" && (
              <>
                <button onClick={() => runAction("resume")} className="btn-primary text-xs px-4 py-2">Resume</button>
                <button onClick={() => runAction("stop")} className="btn-ghost text-xs px-3 py-2">Stop</button>
              </>
            )}
            <button onClick={() => setRailOpen((s) => !s)} className="btn-ghost text-xs px-3 py-2 lg:hidden">
              Context
            </button>
          </div>
        </div>
        {showChallenge && (
          <div className="border-t border-[var(--color-line)] px-4 py-3 flex gap-2 max-w-7xl mx-auto">
            <input
              value={challengeTopic}
              onChange={(e) => setChallengeTopic(e.target.value)}
              placeholder="What should the agents challenge? e.g. the draft's weakest claim"
              className="flex-1 border border-[var(--color-line)] rounded-md px-3 py-2 text-sm bg-white"
            />
            <button onClick={sendChallenge} className="btn-primary text-xs px-4 py-2">Run challenge</button>
          </div>
        )}
        {err && (
          <div className="border-t border-[var(--color-line)] px-4 py-2 max-w-7xl mx-auto">
            <p className="text-xs text-[var(--color-pale-red-tx)] font-mono">{err}</p>
          </div>
        )}
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-[1fr_340px] gap-6">
        <div>
          <div ref={feedRef} className="space-y-4 max-h-[62vh] overflow-y-auto pr-1 mb-4">
            {(data?.messages.length ?? 0) === 0 && (
              <div className="card p-8 text-center">
                <p className="serif text-2xl mb-2">The room is quiet.</p>
                <p className="text-sm text-[var(--color-muted)]">Start a run, or send the first message below.</p>
              </div>
            )}
            {data?.messages.map((m) => (
              <MessageCard
                key={m.id}
                m={m}
                onChoose={m.kind === "disagreement_card" ? (oid, title) => choose(m.id, oid, title) : undefined}
              />
            ))}
            {driving && progress.length > 0 && (
              <div className="card p-4">
                <p className="font-mono text-xs text-[var(--color-muted)]">{progress[progress.length - 1]}…</p>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              placeholder="Message the room as owner…"
              className="flex-1 border border-[var(--color-line)] rounded-md px-4 py-3 text-sm bg-white"
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button onClick={sendMessage} className="btn-primary px-6 text-sm">Send</button>
          </div>
          <p className="text-xs text-[var(--color-muted)] mt-3 font-mono">
            Agents speak when addressed or assigned · silence is the default · brief rationale only, never raw reasoning
          </p>
        </div>
        <aside className="hidden lg:block">{rail}</aside>
      </div>

      {railOpen && (
        <div className="fixed inset-0 z-20 lg:hidden">
          <div className="absolute inset-0 bg-black/20" onClick={() => setRailOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-[85%] max-w-sm bg-[var(--color-bone)] p-4 overflow-y-auto">
            <button onClick={() => setRailOpen(false)} className="btn-ghost text-xs px-3 py-2 mb-4">Close</button>
            {rail}
          </div>
        </div>
      )}
    </main>
  );
}
