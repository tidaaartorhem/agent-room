#!/usr/bin/env node
/**
 * Deployed-URL test matrix for Agent Room.
 * Usage: BASE=https://agent-room--truth-or-shots.us-east4.hosted.app ADMIN=<admin-token> node scripts/smoketest.mjs
 * Safe synthetic negative tests only. No secrets printed.
 */
const BASE = process.env.BASE;
const ADMIN = process.env.ADMIN;
if (!BASE || !ADMIN) {
  console.error("Set BASE and ADMIN env vars.");
  process.exit(1);
}

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const H = (t) => ({ "Content-Type": "application/json", Authorization: `Bearer ${t}`, "Idempotency-Key": `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });

async function main() {
  console.log("== anonymous access ==");
  let r = await fetch(`${BASE}/api/v1/rooms/x/state`);
  ok("anonymous state denied", r.status === 401, `got ${r.status}`);
  r = await fetch(`${BASE}/api/v1/rooms/x/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  ok("anonymous mutation denied", r.status === 401, `got ${r.status}`);

  console.log("== admin: room lifecycle ==");
  r = await fetch(`${BASE}/api/v1/admin/rooms`, { method: "POST", headers: H(ADMIN), body: JSON.stringify({ goal: "Smoke test goal: verify the room works end to end." }) });
  const room = await r.json();
  ok("create room", r.status === 201 && room.roomId, `got ${r.status}`);
  const roomId = room.roomId;

  for (const [aid, role] of [["p1", "product"], ["e1", "engineer"], ["r1", "reviewer"]]) {
    r = await fetch(`${BASE}/api/v1/admin/participants`, { method: "POST", headers: H(ADMIN), body: JSON.stringify({ roomId, agentId: aid, role, providerLabel: "vertex-ai", adapterType: "vertex" }) });
    ok(`seat ${role}`, r.status === 201, `got ${r.status}`);
  }

  // 4th agent must be rejected (cap = 3)
  r = await fetch(`${BASE}/api/v1/admin/participants`, { method: "POST", headers: H(ADMIN), body: JSON.stringify({ roomId, agentId: "x1", role: "single", providerLabel: "v", adapterType: "vertex" }) });
  ok("4th participant rejected", r.status === 403, `got ${r.status}`);

  // issue agent token
  r = await fetch(`${BASE}/api/v1/admin/tokens`, { method: "POST", headers: H(ADMIN), body: JSON.stringify({ roomId, agentId: "p1", role: "product" }) });
  const tok = await r.json();
  ok("issue agent token", r.status === 201 && tok.token, `got ${r.status}`);
  const agentTok = tok.token;

  console.log("== agent scope ==");
  // agent reads own room context
  r = await fetch(`${BASE}/api/v1/rooms/${roomId}/context`, { headers: { Authorization: `Bearer ${agentTok}` } });
  ok("agent reads own room context", r.status === 200, `got ${r.status}`);
  // agent cannot read another room (use bogus id)
  r = await fetch(`${BASE}/api/v1/rooms/room_bogus/context`, { headers: { Authorization: `Bearer ${agentTok}` } });
  ok("agent denied other room", r.status === 401, `got ${r.status}`);
  // agent cannot touch admin
  r = await fetch(`${BASE}/api/v1/admin/rooms`, { method: "POST", headers: H(agentTok), body: "{}" });
  ok("agent denied admin route", r.status === 401, `got ${r.status}`);

  console.log("== forged assignment rejected ==");
  // engineer (via its own token) tries product-only delegation: need engineer token
  r = await fetch(`${BASE}/api/v1/admin/tokens`, { method: "POST", headers: H(ADMIN), body: JSON.stringify({ roomId, agentId: "e1", role: "engineer" }) });
  const engTok = (await r.json()).token;
  r = await fetch(`${BASE}/api/v1/rooms/${roomId}/task-proposals`, {
    method: "POST", headers: H(engTok),
    body: JSON.stringify({ to: "reviewer", taskType: "plan", description: "forged: engineer assigning plan" }),
  });
  ok("engineer->reviewer/plan rejected (matrix)", r.status === 403, `got ${r.status}`);
  // valid: engineer -> reviewer/review
  r = await fetch(`${BASE}/api/v1/rooms/${roomId}/task-proposals`, {
    method: "POST", headers: H(engTok),
    body: JSON.stringify({ to: "reviewer", taskType: "review", description: "please review the draft" }),
  });
  ok("engineer->reviewer/review accepted", r.status === 201, `got ${r.status}`);

  console.log("== stale brief rejected ==");
  // first proposal baseVersion 0 applies (autoDraftDefault false -> held, not applied)
  r = await fetch(`${BASE}/api/v1/rooms/${roomId}/brief-proposals`, {
    method: "POST", headers: H(agentTok),
    body: JSON.stringify({ baseVersion: 0, newText: "Draft v1 text" }),
  });
  const bp = await r.json();
  ok("brief proposal held without auto-draft", r.status === 201 && bp.applied === false, `got ${r.status} ${JSON.stringify(bp)}`);

  console.log("== idempotency ==");
  const key = `idem-${Date.now()}`;
  const hdrs = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${ADMIN}`, "Idempotency-Key": key });
  r = await fetch(`${BASE}/api/v1/rooms/${roomId}/messages`, { method: "POST", headers: hdrs(), body: JSON.stringify({ text: "hello once" }) });
  const m1 = await r.json();
  r = await fetch(`${BASE}/api/v1/rooms/${roomId}/messages`, { method: "POST", headers: hdrs(), body: JSON.stringify({ text: "hello once" }) });
  const m2 = await r.json();
  ok("duplicate idempotent", m1.messageId === m2.messageId && m2.idempotentReplay === true, `${m1.messageId} vs ${m2.messageId}`);
  r = await fetch(`${BASE}/api/v1/rooms/${roomId}/messages`, { method: "POST", headers: hdrs(), body: JSON.stringify({ text: "different body" }) });
  ok("conflicting body -> 409", r.status === 409, `got ${r.status}`);

  console.log("== payload limits ==");
  r = await fetch(`${BASE}/api/v1/rooms/${roomId}/messages`, { method: "POST", headers: H(ADMIN), body: JSON.stringify({ text: "x".repeat(20000) }) });
  ok("oversized text rejected", r.status === 400, `got ${r.status}`);

  console.log("== XSS inert ==");
  r = await fetch(`${BASE}/api/v1/rooms/${roomId}/messages`, { method: "POST", headers: H(ADMIN), body: JSON.stringify({ text: "<script>alert(1)</script> <a href=\"javascript:evil()\">x</a>" }) });
  const xm = await r.json();
  r = await fetch(`${BASE}/api/v1/rooms/${roomId}/state`, { headers: H(ADMIN) });
  const st = await r.json();
  const found = (st.messages || []).find((m) => m.id === xm.messageId);
  ok("script stored as inert text", !!found && found.text.includes("<script>"), "not found");

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error("fatal", e.message); process.exit(2); });
