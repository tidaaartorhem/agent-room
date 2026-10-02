"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminConsole() {
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [err, setErr] = useState("");
  const [goal, setGoal] = useState("");
  const [createdRoom, setCreatedRoom] = useState("");
  const [pRoom, setPRoom] = useState("");
  const [pAgent, setPAgent] = useState("");
  const [pRole, setPRole] = useState("product");
  const [pProvider, setPProvider] = useState("vertex-ai");
  const [pAdapter, setPAdapter] = useState("vertex");
  const [tRoom, setTRoom] = useState("");
  const [tAgent, setTAgent] = useState("");
  const [tRole, setTRole] = useState("product");
  const [issued, setIssued] = useState<{ token: string; for: string } | null>(null);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    setToken(localStorage.getItem("ar_admin_token") ?? "");
  }, []);

  const say = (s: string) => setLog((x) => [...x.slice(-19), s]);

  const adminFetch = async (path: string, opts: RequestInit = {}) => {
    const res = await fetch(path, {
      ...opts,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
    return body;
  };

  const bootstrap = async () => {
    try {
      const r = await fetch("/api/v1/admin/bootstrap", { method: "POST" }).then((x) => x.json());
      if (r.token) {
        localStorage.setItem("ar_admin_token", r.token);
        setToken(r.token);
        say("Admin token issued (shown once). Store it somewhere safe.");
      } else {
        say("Already initialized — use your existing admin token.");
      }
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const createRoom = async () => {
    try {
      const r = await adminFetch("/api/v1/admin/rooms", { method: "POST", body: JSON.stringify({ goal }) });
      setCreatedRoom(r.roomId);
      setPRoom(r.roomId);
      setTRoom(r.roomId);
      setGoal("");
      say(`Room created: ${r.roomId}`);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const addParticipant = async () => {
    try {
      const r = await adminFetch("/api/v1/admin/participants", {
        method: "POST",
        body: JSON.stringify({ roomId: pRoom, agentId: pAgent, role: pRole, providerLabel: pProvider, adapterType: pAdapter }),
      });
      say(`Participant added: ${r.agentId} (${r.role})`);
      setPAgent("");
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const issueToken = async () => {
    try {
      const r = await adminFetch("/api/v1/admin/tokens", {
        method: "POST",
        body: JSON.stringify({ roomId: tRoom, agentId: tAgent, role: tRole, expiresInDays: 30 }),
      });
      setIssued({ token: r.token, for: `${tAgent} (${tRole})` });
      say(`Token issued for ${tAgent}. Shown once below.`);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const quickSetup = async (roomId: string) => {
    // One-click: product+engineer+reviewer (vertex) + tokens. Convenience only.
    try {
      for (const [aid, role] of [["product-1", "product"], ["engineer-1", "engineer"], ["reviewer-1", "reviewer"]] as const) {
        await adminFetch("/api/v1/admin/participants", {
          method: "POST",
          body: JSON.stringify({ roomId, agentId: aid, role, providerLabel: "vertex-ai", adapterType: "vertex" }),
        });
        say(`Participant added: ${aid} (${role})`);
      }
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="card p-8 max-w-md w-full">
          <h1 className="serif text-3xl mb-2">Owner console</h1>
          <p className="text-sm text-[var(--color-muted)] mb-6">
            First run? Bootstrap the admin token. Returning? Paste it below.
          </p>
          <button onClick={bootstrap} className="btn-ghost w-full py-3 text-sm mb-4">
            Bootstrap admin token (first run only)
          </button>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="ar_admin_…"
            className="w-full border border-[var(--color-line)] rounded-md px-4 py-3 text-sm mb-4 bg-white"
            onKeyDown={(e) => {
              if (e.key === "Enter" && tokenInput.trim()) {
                localStorage.setItem("ar_admin_token", tokenInput.trim());
                setToken(tokenInput.trim());
              }
            }}
          />
          <button
            onClick={() => {
              if (!tokenInput.trim()) return;
              localStorage.setItem("ar_admin_token", tokenInput.trim());
              setToken(tokenInput.trim());
            }}
            className="btn-primary w-full py-3 text-sm"
          >
            Enter console
          </button>
          {err && <p className="text-xs text-[var(--color-pale-red-tx)] font-mono mt-4">{err}</p>}
        </div>
      </main>
    );
  }

  const field = "w-full border border-[var(--color-line)] rounded-md px-3 py-2 text-sm bg-white";

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="serif text-4xl mb-2">Owner console</h1>
        <p className="text-sm text-[var(--color-muted)] mb-10">
          Create rooms, seat participants, issue scoped tokens. Every token is shown once and stored as a hash.
        </p>

        {err && <p className="text-xs text-[var(--color-pale-red-tx)] font-mono mb-6">{err}</p>}

        <div className="space-y-4">
          <section className="card p-6">
            <h2 className="serif text-2xl mb-4">1 · Create a room</h2>
            <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} placeholder="Product goal in one or two sentences…" className={field} />
            <button onClick={createRoom} disabled={!goal.trim()} className="btn-primary text-sm px-6 py-3 mt-3">
              Create room
            </button>
            {createdRoom && (
              <div className="mt-4 p-4 bg-[var(--color-bone)] border border-[var(--color-line)] rounded-md">
                <p className="font-mono text-xs mb-2">{createdRoom}</p>
                <div className="flex gap-2">
                  <button onClick={() => quickSetup(createdRoom)} className="btn-ghost text-xs px-3 py-2">
                    Seat Product + Engineer + Reviewer (vertex)
                  </button>
                  <Link href={`/room/${createdRoom}`} className="btn-primary text-xs px-4 py-2">
                    Open room
                  </Link>
                </div>
              </div>
            )}
          </section>

          <section className="card p-6">
            <h2 className="serif text-2xl mb-4">2 · Seat a participant</h2>
            <div className="grid grid-cols-2 gap-3">
              <input value={pRoom} onChange={(e) => setPRoom(e.target.value)} placeholder="room id" className={field} />
              <input value={pAgent} onChange={(e) => setPAgent(e.target.value)} placeholder="agent id (e.g. product-1)" className={field} />
              <select value={pRole} onChange={(e) => setPRole(e.target.value)} className={field}>
                <option value="product">product</option>
                <option value="engineer">engineer</option>
                <option value="reviewer">reviewer</option>
                <option value="single">single</option>
              </select>
              <select value={pAdapter} onChange={(e) => setPAdapter(e.target.value)} className={field}>
                <option value="vertex">vertex (server-driven)</option>
                <option value="external">external (pull adapter)</option>
                <option value="synthetic">synthetic</option>
              </select>
              <input value={pProvider} onChange={(e) => setPProvider(e.target.value)} placeholder="provider label (self-reported)" className={`${field} col-span-2`} />
            </div>
            <button onClick={addParticipant} className="btn-primary text-sm px-6 py-3 mt-3">
              Seat participant
            </button>
          </section>

          <section className="card p-6">
            <h2 className="serif text-2xl mb-4">3 · Issue an agent token</h2>
            <div className="grid grid-cols-3 gap-3">
              <input value={tRoom} onChange={(e) => setTRoom(e.target.value)} placeholder="room id" className={field} />
              <input value={tAgent} onChange={(e) => setTAgent(e.target.value)} placeholder="agent id" className={field} />
              <select value={tRole} onChange={(e) => setTRole(e.target.value)} className={field}>
                <option value="product">product</option>
                <option value="engineer">engineer</option>
                <option value="reviewer">reviewer</option>
                <option value="single">single</option>
              </select>
            </div>
            <button onClick={issueToken} className="btn-primary text-sm px-6 py-3 mt-3">
              Issue token (30 days)
            </button>
            {issued && (
              <div className="mt-4 p-4 bg-[var(--color-pale-yellow-bg)] border border-[var(--color-line)] rounded-md">
                <p className="text-xs font-semibold mb-1">Token for {issued.for} — shown once:</p>
                <p className="font-mono text-xs break-all select-all">{issued.token}</p>
              </div>
            )}
          </section>

          <section className="card p-6">
            <h2 className="serif text-2xl mb-4">Activity</h2>
            <ul className="font-mono text-xs space-y-1 text-[var(--color-ink-soft)]">
              {log.map((l, i) => <li key={i}>· {l}</li>)}
              {log.length === 0 && <li className="text-[var(--color-muted)]">Nothing yet.</li>}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
