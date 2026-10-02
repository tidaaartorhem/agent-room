import crypto from "crypto";
import { db, C } from "./db";
import { CONFIG, AgentRole, RunState } from "./config";
import { assembleContext, bumpContextVersion } from "./context";
import { logEvent } from "./events";
import { canAssign, TEAM_ORDER } from "./roles";
import { generateContent, ModelError } from "./vertex";
import { ROLE_PROMPTS, SYNTHESIZER_PROMPT } from "./prompts";

const rid = (p: string) => `${p}_${crypto.randomBytes(8).toString("hex")}`;

/** Minimal unified diff for brief revisions (line-based). */
export function unifiedDiff(oldText: string, newText: string): string {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: string[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push("- " + a[i++]); }
    else { out.push("+ " + b[j++]); }
  }
  while (i < n) out.push("- " + a[i++]);
  while (j < m) out.push("+ " + b[j++]);
  return out.slice(0, 120).join("\n");
}

interface BlockParse {
  text: string;
  taskProposal?: { to: string; taskType: string; description: string };
  taskResult?: { taskId: string; result: string };
  briefProposal?: { baseVersion: number; newText: string };
}

export function parseBlocks(raw: string): BlockParse {
  const out: BlockParse = { text: raw };
  const grab = (name: string): string | null => {
    const m = raw.match(new RegExp("```" + name + "\\s*\\n([\\s\\S]*?)\\n```"));
    return m ? m[1] : null;
  };
  const strip = (name: string) => {
    out.text = out.text.replace(new RegExp("```" + name + "\\s*\\n[\\s\\S]*?\\n```"), "").trim();
  };
  const safe = (s: string | null): unknown => {
    if (!s) return null;
    try { return JSON.parse(s); } catch { return null; }
  };
  const tp = grab("task-proposal");
  if (tp) { const v = safe(tp) as BlockParse["taskProposal"]; if (v && typeof v === "object") out.taskProposal = v; strip("task-proposal"); }
  const tr = grab("task-result");
  if (tr) { const v = safe(tr) as BlockParse["taskResult"]; if (v && typeof v === "object") out.taskResult = v; strip("task-result"); }
  const bp = grab("brief-proposal");
  if (bp) { const v = safe(bp) as BlockParse["briefProposal"]; if (v && typeof v === "object") out.briefProposal = v; strip("brief-proposal"); }
  return out;
}

async function getAgents(roomId: string) {
  const snap = await db().collection(C.agents).where("roomId", "==", roomId).where("enabled", "==", true).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as { role: AgentRole; providerLabel: string; adapterType: string }) }));
}

/** Start a run. Reclaims a stale driver lease; refuses if a live run exists. */
export async function startRun(roomId: string, opts: { mode: "team" | "single"; autoDraft: boolean; initiatedBy: string }) {
  const roomSnap = await db().collection(C.rooms).doc(roomId).get();
  if (!roomSnap.exists) {
    const e = new Error("unknown room") as Error & { status?: number };
    e.status = 404; throw e;
  }
  const agents = await getAgents(roomId);
  const need = opts.mode === "team" ? ["product", "engineer", "reviewer"] : ["single"];
  for (const r of need) {
    if (!agents.some((a) => a.role === r)) {
      const e = new Error(`room lacks an enabled '${r}' participant`) as Error & { status?: number };
      e.status = 400; throw e;
    }
  }
  const runId = rid("run");
  await db().runTransaction(async (tx) => {
    const active = await tx.get(
      db().collection(C.runs).where("roomId", "==", roomId).where("state", "in", ["running", "paused"]).limit(1)
    );
    if (!active.empty) {
      const r = active.docs[0].data();
      if (r.state === "running" && (r.leaseUntil ?? 0) > Date.now()) {
        const e = new Error("a run is already active for this room") as Error & { status?: number };
        e.status = 409; throw e;
      }
      tx.update(active.docs[0].ref, { state: "error", endedAt: Date.now(), note: "reclaimed: driver lease expired" });
    }
    tx.set(db().collection(C.runs).doc(runId), {
      id: runId, roomId, state: "running", epoch: 1,
      mode: opts.mode, autoDraft: opts.autoDraft,
      counters: { turns: 0, inputTokens: 0, outputTokens: 0 },
      startedAt: Date.now(), endedAt: null,
      deadlineAt: Date.now() + CONFIG.runTimeoutMs,
      leaseUntil: Date.now() + 60000,
      initiatedBy: opts.initiatedBy,
      driver: null,
    });
  });
  await logEvent(roomId, "run_started", runId, { mode: opts.mode, autoDraft: opts.autoDraft });
  return { runId };
}

/** Claim exclusive driver rights for one turn. Throws if lost/expired. */
async function claimDriver(runId: string, driverId: string): Promise<void> {
  await db().runTransaction(async (tx) => {
    const ref = db().collection(C.runs).doc(runId);
    const snap = await tx.get(ref);
    const r = snap.data()!;
    if (r.state !== "running") {
      const e = new Error("run not running") as Error & { status?: number };
      e.status = 409; throw e;
    }
    const d = r.driver;
    if (d && d.id !== driverId && (d.until ?? 0) > Date.now()) {
      const e = new Error("another driver holds the lease") as Error & { status?: number };
      e.status = 409; throw e;
    }
    tx.update(ref, {
      driver: { id: driverId, until: Date.now() + 45000 },
      leaseUntil: Date.now() + 60000,
    });
  });
}

/**
 * Drive a run to a terminal state. Called from the drive endpoint, which
 * streams progress as SSE. The loop is server-side: it continues if the
 * browser disconnects (writes go to Firestore regardless).
 */
export async function driveRun(runId: string, onProgress?: (msg: string) => void): Promise<void> {
  const driverId = rid("drv");
  const emit = (s: string) => { try { onProgress?.(s); } catch { /* client gone: continue */ } };
  // Internal deadline: finish gracefully before platform request timeout.
  const hardDeadline = Date.now() + 280_000;
  for (;;) {
    let run: Record<string, unknown>;
    try {
      await claimDriver(runId, driverId);
    } catch {
      emit("driver lost; exiting");
      return;
    }
    const snap = await db().collection(C.runs).doc(runId).get();
    run = snap.data() as Record<string, unknown>;
    const roomId = run.roomId as string;
    const epoch = run.epoch as number;
    const counters = run.counters as { turns: number; inputTokens: number; outputTokens: number };

    if (run.state !== "running") { emit(`run ${run.state}; exiting`); return; }
    if (Date.now() > Math.min(run.deadlineAt as number, hardDeadline)) {
      await finishRun(runId, "completed", "time cap reached"); emit("time cap"); return;
    }
    if (counters.turns >= CONFIG.maxTurns) {
      await finishRun(runId, "completed", "turn cap reached"); emit("turn cap"); return;
    }
    if (counters.outputTokens >= CONFIG.maxOutputTokensPerRun) {
      await finishRun(runId, "budget_exhausted", "token budget exhausted"); emit("budget exhausted"); return;
    }

    const order: AgentRole[] = run.mode === "team" ? [...TEAM_ORDER] : ["single"];
    const role = order[counters.turns % order.length];
    try {
      await doTurn(runId, roomId, epoch, role, emit);
    } catch (e) {
      // claimDriver-style terminal check: stop driving on terminal state
      const s2 = (await db().collection(C.runs).doc(runId).get()).data()!;
      if (s2.state !== "running") { emit(`run ${s2.state}; exiting`); return; }
      await logEvent(roomId, "advisory", runId, { note: `turn failed: ${(e as Error).message}`.slice(0, 200) });
    }
  }
}

async function doTurn(
  runId: string, roomId: string, epoch: number, role: AgentRole, emit: (s: string) => void
): Promise<void> {
  const d = db();
  const agents = await getAgents(roomId);
  const agent = agents.find((a) => a.role === role && a.adapterType === "vertex");
  if (!agent) {
    await logEvent(roomId, "advisory", runId, { note: `no vertex agent for role ${role}; turn skipped` });
    await d.collection(C.runs).doc(runId).update({ "counters.turns": (await turnCount(runId)) + 1 });
    return;
  }

  const ctx = await assembleContext(roomId);
  const turnId = rid("turn");
  await d.collection(C.turns).doc(turnId).set({
    id: turnId, runId, agentId: agent.id, role,
    contextVersion: ctx.contextVersion, briefRevisionId: ctx.briefRevisionId,
    state: "working", attempt: 1, leaseUntil: Date.now() + CONFIG.turnTimeoutMs,
    inputTokens: 0, outputTokens: 0, createdAt: Date.now(),
  });
  await logEvent(roomId, "turn_started", turnId, { role, agentId: agent.id, contextVersion: ctx.contextVersion });

  // Mark this agent's accepted tasks as working.
  const accepted = await d.collection(C.tasks)
    .where("runId", "==", runId).where("assignedTo", "==", agent.id)
    .where("state", "in", ["accepted", "queued"]).get();
  for (const t of accepted.docs) await t.ref.update({ state: "working" });

  const prompt =
    ctx.text +
    `\n\n[YOUR TURN]\nIt is your turn as ${role} (context v${ctx.contextVersion}, draft v${ctx.briefVersion}). Reply concisely.`;

  let result;
  try {
    result = await generateContent({
      systemPrompt: ROLE_PROMPTS[role],
      prompt,
      maxOutputTokens: CONFIG.maxOutputTokensPerTurn,
    });
  } catch (e) {
    const me = e as ModelError;
    if (me.transient) {
      await logEvent(roomId, "advisory", turnId, { note: `transient model error, one retry: ${me.message.slice(0, 120)}` });
      try {
        result = await generateContent({ systemPrompt: ROLE_PROMPTS[role], prompt, maxOutputTokens: CONFIG.maxOutputTokensPerTurn });
      } catch (e2) {
        await d.collection(C.turns).doc(turnId).update({ state: (e2 as ModelError).message.includes("timed out") ? "timed_out" : "error" });
        await d.collection(C.runs).doc(runId).update({ "counters.turns": (await turnCount(runId)) + 1 });
        await logEvent(roomId, "turn_completed", turnId, { state: "error" });
        return;
      }
    } else {
      await d.collection(C.turns).doc(turnId).update({ state: "error" });
      await d.collection(C.runs).doc(runId).update({ "counters.turns": (await turnCount(runId)) + 1 });
      await logEvent(roomId, "turn_completed", turnId, { state: "error", note: me.message.slice(0, 160) });
      return;
    }
  }

  // Fencing: if the run was stopped/paused while we were generating, discard.
  const fresh = (await d.collection(C.runs).doc(runId).get()).data()!;
  if (fresh.epoch !== epoch || fresh.state === "stopped") {
    await logEvent(roomId, "discarded", turnId, { note: "late result for stopped/expired run; discarded, never revives it" });
    return;
  }

  const parsed = parseBlocks(result!.text);
  const messageId = rid("msg");
  await d.collection(C.messages).doc(messageId).set({
    id: messageId, roomId, runId, agentId: agent.id, role,
    kind: "message", text: parsed.text.slice(0, CONFIG.textLimitChars),
    contextVersion: ctx.contextVersion, status: "complete", createdAt: Date.now(),
  });
  await logEvent(roomId, "message", messageId, { role, agentId: agent.id, turnId });

  // Task result blocks: complete the assignee's task.
  if (parsed.taskResult) {
    const tref = d.collection(C.tasks).doc(parsed.taskResult.taskId);
    await d.runTransaction(async (tx) => {
      const ts = await tx.get(tref);
      if (ts.exists && ts.data()!.assignedTo === agent.id && ts.data()!.runId === runId) {
        tx.update(tref, { state: "completed", result: parsed.taskResult!.result.slice(0, 4000), completedAt: Date.now() });
      }
    }).catch(() => undefined);
    await logEvent(roomId, "task_state", parsed.taskResult.taskId, { state: "completed", by: agent.id });
  }

  // Task proposal blocks: server validates against the role matrix.
  if (parsed.taskProposal) {
    const p = parsed.taskProposal;
    const target = agents.find((a) => a.role === p.to);
    const queueCount = (await d.collection(C.tasks).where("runId", "==", runId)
      .where("state", "in", ["queued", "accepted", "working", "waiting"]).get()).size;
    if (!canAssign(role, p.to, p.taskType) || !target) {
      await logEvent(roomId, "advisory", turnId, {
        note: `task proposal rejected by role policy: ${role} -> ${p.to}/${p.taskType}`,
      });
    } else if (queueCount >= CONFIG.maxQueue) {
      await logEvent(roomId, "advisory", turnId, { note: "task queue full; proposal rejected with 429-equivalent" });
    } else {
      const taskId = rid("task");
      await d.collection(C.tasks).doc(taskId).set({
        id: taskId, roomId, runId,
        assignedBy: agent.id, // from AUTHENTICATED principal, never from model text
        assignedTo: target.id, toRole: p.to, taskType: p.taskType,
        description: p.description, state: "accepted",
        contextVersion: ctx.contextVersion, createdAt: Date.now(),
      });
      await logEvent(roomId, "task_assigned", taskId, {
        assignedBy: agent.id, assignedTo: target.id, toRole: p.to, taskType: p.taskType,
      });
      emit(`task ${p.taskType} -> ${p.to}`);
    }
  }

  // Brief proposal blocks: compare-and-swap on baseVersion.
  if (parsed.briefProposal) {
    await applyBriefProposal(roomId, runId, {
      baseVersion: parsed.briefProposal.baseVersion,
      newText: parsed.briefProposal.newText,
      authorType: "team", authorId: agent.id, sourceMessageIds: [messageId],
      autoDraft: (fresh.autoDraft as boolean) ?? false,
    });
  }

  await d.collection(C.turns).doc(turnId).update({
    state: "completed", inputTokens: result!.inputTokens, outputTokens: result!.outputTokens,
  });
  const c = fresh.counters as { turns: number; inputTokens: number; outputTokens: number };
  await d.collection(C.runs).doc(runId).update({
    "counters.turns": c.turns + 1,
    "counters.inputTokens": c.inputTokens + result!.inputTokens,
    "counters.outputTokens": c.outputTokens + result!.outputTokens,
  });
  await logEvent(roomId, "turn_completed", turnId, {
    state: "completed", inputTokens: result!.inputTokens, outputTokens: result!.outputTokens,
  });
  emit(`turn ${role} done`);
}

async function turnCount(runId: string): Promise<number> {
  const s = await db().collection(C.runs).doc(runId).get();
  return (s.data()?.counters?.turns ?? 0) as number;
}

/** Compare-and-swap brief update. Stale base -> visible stale proposal, no retry. */
export async function applyBriefProposal(
  roomId: string, runId: string | null,
  opts: {
    baseVersion: number; newText: string; authorType: "team" | "owner";
    authorId: string; sourceMessageIds: string[]; autoDraft: boolean;
  }
): Promise<{ applied: boolean; version?: number; reason?: "stale" | "held" }> {
  const d = db();
  const latest = await d.collection(C.briefs).where("roomId", "==", roomId).orderBy("version", "desc").limit(1).get();
  const cur = latest.docs[0]?.data();
  const curVersion = cur?.version ?? 0;

  const recordStale = async () => {
    const messageId = rid("msg");
    await d.collection(C.messages).doc(messageId).set({
      id: messageId, roomId, runId, agentId: opts.authorId,
      kind: "stale_proposal", text: `Stale brief proposal (base v${opts.baseVersion}, current v${curVersion}). Not applied, not retried.`,
      contextVersion: (await d.collection(C.rooms).doc(roomId).get()).data()?.contextVersion ?? 0,
      status: "complete", createdAt: Date.now(),
      proposedText: opts.newText.slice(0, CONFIG.textLimitChars),
    });
    await logEvent(roomId, "brief_proposal_stale", messageId, { baseVersion: opts.baseVersion, curVersion });
  };

  if (opts.baseVersion !== curVersion) {
    await recordStale();
    return { applied: false, reason: "stale" };
  }
  // Owner writes always apply. Team writes apply only under declared auto-draft policy.
  if (opts.authorType === "team" && !opts.autoDraft) {
    const messageId = rid("msg");
    await d.collection(C.messages).doc(messageId).set({
      id: messageId, roomId, runId, agentId: opts.authorId,
      kind: "stale_proposal", text: `Brief proposal held for owner (auto-draft off). Base v${opts.baseVersion}.`,
      contextVersion: (await d.collection(C.rooms).doc(roomId).get()).data()?.contextVersion ?? 0,
      status: "complete", createdAt: Date.now(),
      proposedText: opts.newText.slice(0, CONFIG.textLimitChars),
    });
    await logEvent(roomId, "brief_proposal_held", messageId, { baseVersion: opts.baseVersion });
    return { applied: false, reason: "held" };
  }
  const version = curVersion + 1;
  const diff = unifiedDiff(cur?.text ?? "", opts.newText);
  const briefId = rid("brief");
  await d.collection(C.briefs).doc(briefId).set({
    id: briefId, roomId, version, baseVersion: curVersion,
    text: opts.newText.slice(0, CONFIG.textLimitChars), diff,
    authorType: opts.authorType, authorId: opts.authorId,
    sourceMessageIds: opts.sourceMessageIds, createdAt: Date.now(),
  });
  await logEvent(roomId, "brief_revised", briefId, { version, authorType: opts.authorType, diffPreview: diff.slice(0, 300) });
  return { applied: true, version };
}

/** Challenge control: one critique turn per agent, then a synthesis card. Counts toward the turn cap. */
export async function runChallenge(roomId: string, runId: string, topic: string): Promise<{ cardId: string }> {
  const d = db();
  const run = (await d.collection(C.runs).doc(runId).get()).data()!;
  if (!run || run.state !== "running") {
    const e = new Error("challenge requires an active run") as Error & { status?: number };
    e.status = 400; throw e;
  }
  const agents = await getAgents(roomId);
  const order: AgentRole[] = run.mode === "team" ? [...TEAM_ORDER] : ["single"];
  const critiques: { role: string; agentId: string; text: string }[] = [];

  for (const role of order) {
    const agent = agents.find((a) => a.role === role && a.adapterType === "vertex");
    if (!agent) continue;
    const c0 = (await d.collection(C.runs).doc(runId).get()).data()!;
    if ((c0.counters.turns as number) >= CONFIG.maxTurns) break;
    const ctx = await assembleContext(roomId);
    const r = await generateContent({
      systemPrompt: ROLE_PROMPTS[role],
      prompt: ctx.text + `\n\n[CHALLENGE]\nCritique this, specifically and briefly: ${topic}`,
      maxOutputTokens: 1200,
    });
    critiques.push({ role, agentId: agent.id, text: r.text.slice(0, 2000) });
    const cc = c0.counters as { turns: number; inputTokens: number; outputTokens: number };
    await d.collection(C.runs).doc(runId).update({
      "counters.turns": cc.turns + 1,
      "counters.inputTokens": cc.inputTokens + r.inputTokens,
      "counters.outputTokens": cc.outputTokens + r.outputTokens,
    });
  }

  // Synthesis: separate invocation, JSON card. Never claims consensus falsely.
  let card: Record<string, unknown>;
  try {
    const s = await generateContent({
      systemPrompt: SYNTHESIZER_PROMPT,
      prompt: "CRITIQUES:\n" + critiques.map((c) => `[${c.role}] ${c.text}`).join("\n\n"),
      maxOutputTokens: 1200,
      temperature: 0.3,
    });
    const cleaned = s.text.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
    card = JSON.parse(cleaned);
    if (!card.options || !Array.isArray(card.options)) throw new Error("bad card shape");
  } catch {
    card = {
      agreement: [], disagreement: ["synthesis failed to parse; see raw critiques"],
      evidence: critiques.map((c) => ({ claim: c.text.slice(0, 200), from: c.agentId })),
      options: [], recommendation: "none - owner review required",
    };
  }
  const cardId = rid("card");
  await d.collection(C.messages).doc(cardId).set({
    id: cardId, roomId, runId, kind: "disagreement_card",
    text: "Disagreement card (separate invocations; not assumed independent).",
    card, topic,
    contextVersion: (await d.collection(C.rooms).doc(roomId).get()).data()?.contextVersion ?? 0,
    status: "complete", createdAt: Date.now(),
  });
  await logEvent(roomId, "challenge_card", cardId, { topic: topic.slice(0, 120) });
  return { cardId };
}

/** Owner decision: owner-authored, agents cannot change. Applies optional brief update. */
export async function recordDecision(
  roomId: string,
  opts: { text: string; scope?: string; cardId?: string; chosenOption?: string; briefText?: string }
): Promise<{ decisionId: string }> {
  const d = db();
  const decisionId = rid("dec");
  await d.collection(C.decisions).doc(decisionId).set({
    id: decisionId, roomId, authorType: "owner", text: opts.text,
    scope: opts.scope ?? null, status: "active",
    sourceMessageIds: opts.cardId ? [opts.cardId] : [], createdAt: Date.now(),
  });
  if (opts.briefText) {
    const latest = await d.collection(C.briefs).where("roomId", "==", roomId).orderBy("version", "desc").limit(1).get();
    await applyBriefProposal(roomId, null, {
      baseVersion: latest.docs[0]?.data()?.version ?? 0,
      newText: opts.briefText, authorType: "owner", authorId: "owner",
      sourceMessageIds: [decisionId], autoDraft: true,
    });
  }
  const v = await bumpContextVersion(roomId);
  // Mark pending team proposals stale (visible, not silent).
  await logEvent(roomId, "decision", decisionId, {
    text: opts.text.slice(0, 200), contextVersion: v,
    note: "context version bumped; pending proposals based on older versions are stale",
  });
  return { decisionId };
}

export async function pauseRun(runId: string): Promise<void> {
  await db().collection(C.runs).doc(runId).update({ state: "paused" });
  const r = (await db().collection(C.runs).doc(runId).get()).data()!;
  await logEvent(r.roomId, "run_paused", runId, {});
}

export async function stopRun(runId: string): Promise<void> {
  const d = db();
  await d.runTransaction(async (tx) => {
    const ref = d.collection(C.runs).doc(runId);
    const snap = await tx.get(ref);
    const r = snap.data()!;
    tx.update(ref, { state: "stopped", endedAt: Date.now(), epoch: (r.epoch ?? 1) + 1, driver: null });
    const tasks = await tx.get(d.collection(C.tasks).where("runId", "==", runId)
      .where("state", "in", ["queued", "accepted", "working", "waiting"]));
    for (const t of tasks.docs) tx.update(t.ref, { state: "cancelled", cancelledAt: Date.now() });
  });
  const r = (await d.collection(C.runs).doc(runId).get()).data()!;
  await logEvent(r.roomId, "run_stopped", runId, { note: "queued tasks cancelled; epoch fenced; late results will be discarded" });
}

export async function resumeRun(runId: string): Promise<void> {
  const d = db();
  await d.runTransaction(async (tx) => {
    const ref = d.collection(C.runs).doc(runId);
    const snap = await tx.get(ref);
    const r = snap.data()!;
    if (r.state !== "paused") {
      const e = new Error("only paused runs can resume") as Error & { status?: number };
      e.status = 400; throw e;
    }
    tx.update(ref, { state: "running", leaseUntil: Date.now() + 60000, driver: null });
  });
  const r = (await d.collection(C.runs).doc(runId).get()).data()!;
  await logEvent(r.roomId, "run_resumed", runId, {});
}

/** Server-assembled terminal summary: factual state, not model prose. */
async function finishRun(runId: string, state: RunState, note: string): Promise<void> {
  const d = db();
  const r = (await d.collection(C.runs).doc(runId).get()).data()!;
  const roomId = r.roomId as string;
  const [taskSnap, briefSnap, chalSnap] = await Promise.all([
    d.collection(C.tasks).where("runId", "==", runId).get(),
    d.collection(C.briefs).where("roomId", "==", roomId).orderBy("version", "desc").limit(1).get(),
    d.collection(C.messages).where("roomId", "==", roomId).where("kind", "==", "disagreement_card").get(),
  ]);
  const tasks = taskSnap.docs.map((x) => x.data());
  const open = tasks.filter((t) => !["completed", "cancelled"].includes(t.state));
  const cards = chalSnap.docs.map((x) => x.data());
  const decSnap = await d.collection(C.decisions).where("roomId", "==", roomId).get();
  const decidedCards = new Set(decSnap.docs.flatMap((x) => (x.data().sourceMessageIds ?? []) as string[]));
  const unresolved = cards.filter((c) => !decidedCards.has(c.id));
  const c = r.counters as { turns: number; inputTokens: number; outputTokens: number };
  const briefV = briefSnap.docs[0]?.data()?.version ?? 0;
  const next = open.length
    ? `Complete ${open.length} open task(s): ${open.slice(0, 3).map((t) => t.id).join(", ")}`
    : unresolved.length
      ? `Owner: decide on ${unresolved.length} open disagreement card(s)`
      : `Owner: review team draft v${briefV}`;
  const summary =
    `Run ${runId} ${state} (${note}). Turns: ${c.turns}/${CONFIG.maxTurns}. ` +
    `Tokens: ${c.inputTokens} in / ${c.outputTokens} out. Brief: v${briefV}. ` +
    `Tasks: ${tasks.length - open.length}/${tasks.length} completed. ` +
    `Unresolved disagreements: ${unresolved.length}. Suggested next: ${next}.`;
  const messageId = rid("msg");
  await d.collection(C.messages).doc(messageId).set({
    id: messageId, roomId, runId, kind: "system", text: summary,
    contextVersion: (await d.collection(C.rooms).doc(roomId).get()).data()?.contextVersion ?? 0,
    status: "complete", createdAt: Date.now(),
  });
  await d.collection(C.runs).doc(runId).update({ state, endedAt: Date.now(), driver: null });
  await logEvent(roomId, state === "completed" ? "run_completed" : "run_budget_exhausted", runId, { note });
}
