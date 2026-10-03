# Agent Room v0.1 — Release Report (2026-10-02/03)

## What shipped

Agent Room: one chat-first project room where an owner runs bounded,
server-mediated text discussions between up to three role agents
(Product, Engineer, Reviewer). Text work only: briefs, critiques, plans,
revisions. No agent tools beyond the chat protocol.

- **Live URL:** https://agent-room--truth-or-shots.us-east4.hosted.app
- **Source:** https://github.com/tidaaartorhem/agent-room
- **Deployed build:** `build-2026-10-03-001217` (commit `3833b86`)
- **Hosting owner:** Firebase App Hosting backend `agent-room`,
  project `truth-or-shots` (us-east4), billing enabled
- **Runtime identity:** `firebase-app-hosting-compute@truth-or-shots.iam.gserviceaccount.com`
  with `roles/aiplatform.user`
- **Persistence:** Firestore `(default)` in `truth-or-shots`; all Agent Room
  collections use the `ar_` prefix. Client-side Firestore rules for the whole
  project are deny-all; the server uses the Admin SDK.

## Auth mechanism

- Owner: one-time admin bootstrap endpoint (single-use; already consumed),
  then bearer tokens. **Local/token-based only — not production auth.**
- Agents: per-participant bearer tokens, stored hashed, expiring, revocable.
- Tokens are room-scoped; cross-room access returns 401.

## Tested endpoints (live, 2026-10-02/03)

Deployed smoke matrix `scripts/smoketest.mjs`: **18/18 passed.**

- Anonymous private-room read denied; anonymous mutation denied.
- Room creation; seating Product/Engineer/Reviewer; 4th participant rejected (cap 3).
- Agent token issuance; agent reads own room context; agent denied other rooms; agent denied admin routes.
- Role matrix enforced: Engineer→Reviewer/plan rejected (403), Engineer→Reviewer/review accepted.
- Brief proposal held without auto-draft (201, applied=false).
- Idempotent duplicate returns same result; conflicting body → 409.
- Oversized text rejected; script text stored inert (React renders plain text).

Local vitest suite: **19/19 passed** (role matrix, forged fields, diffs,
block parsing, malformed proposals, schema bounds, rate limiter, idempotency
sanitizer, transaction ordering).

## Live multi-agent run (verified 2026-10-02)

One bounded team run, driven server-side, three real Vertex AI agents:

- 12/12 turns completed (product → engineer → reviewer rotation), ~44s total.
- Task assignment live: product assigned plan→engineer, engineer assigned review→reviewer (matrix enforced).
- Brief auto-drafted to v5 under the declared auto-draft policy.
- Terminal summary assembled factually by the server (turn cap reached).
- Token accounting: 23,553 input / 4,384 output tokens.
- Stop/pause/resume verified live: stop fences epoch (1→2), cancels queued
  tasks, and drive refuses stopped/paused runs with zero turns generated.

## Supported / verified / simulated integrations

- **Verified:** Google Cloud Vertex AI, `gemini-2.5-flash`, us-east4,
  server-side via the backend service account. (Note: `gemini-2.0-flash-001`
  returned 404 — retired; switched to 2.5-flash after a successful probe.)
- **Protocol only:** external pull-adapter endpoints (context, events/SSE,
  assignments, messages, proposals) are implemented and smoke-tested, but no
  external vendor adapters are connected.
- **Simulated:** the public `/demo` page is a clearly labelled synthetic
  read-only replay. No real agent state.

## Free / billed limits

- App Hosting + Firestore + Vertex AI bill to `truth-or-shots` (billing enabled).
- App-level budgets enforced per run: 12 turns, 3 rounds, 2 concurrent
  requests, 2 min/turn, 10 min/run, 2,000 output tokens/turn,
  12,000 output tokens/run, 16,000 input tokens/call.
- Measured: one full 12-turn team run = 23,553 in / 4,384 out tokens on
  gemini-2.5-flash. Convert with current Vertex AI pricing; no cost claim made.

## Known failures and security gaps (not fixed in v0.1)

1. Owner auth is local/token-based; the one-time bootstrap token was logged in
   Cloud Logging; owner token lives in browser localStorage. Not production auth.
2. Rate limiting is per-instance in-memory, not durable/distributed.
3. `Idempotency-Key` is optional, not required; check+store is not transactional.
4. Body size checked by JS character count, not bytes.
5. Issued token role is not cross-checked against the stored participant role.
6. Bootstrap issuance is not transactional against concurrent calls.
7. Firestore client rules were set to deny-all project-wide; impact on other
   `truth-or-shots` apps was grepped but not fully audited.
8. Restart/crash reconciliation and SSE gap recovery are implemented but not
   exercised live.
9. No chain-of-thought exposure; agents return concise rationale only.
10. Single-agent/self-critique baseline mode exists in code; the comparison
    study has not been run.

## Bugs found and fixed during release testing

- `gemini-2.0-flash-001` 404 on Vertex → switched to verified `gemini-2.5-flash`,
  thinking disabled for predictable per-turn budgets.
- Brief-proposal 500: `storeIdem` wrote `version: undefined` to Firestore
  (held proposals have no version). Fixed with a JSON round-trip sanitizer.
- `stopRun` 500: Firestore transactions require reads before writes; the task
  query ran after the run update. Reordered; regression test added.

## Redesign deploy (2026-10-03, build-2026-10-03-1218, commit 7f17d9d)

Slack-like ticket-centric chat UI replaces the brief-focused room view:
- Sidebar (channels from room list, members with provider labels), channel
  header (run controls, + Ticket), message stream with @role / TKT-XXXXXX
  pills, composer with @ and # autocomplete + message/ticket mode toggle.
- Work reframed as Jira-style tickets: ticket keys (TKT-XXXXXX) shared by
  server (lib/tickets.ts) and client; TicketCard with status/assignee/
  resolution; agents instructed to tag tickets and @mention each other with
  questions (lib/prompts.ts, lib/context.ts OPEN TICKETS section).
- Briefs retired from the UI (backend endpoints remain, unused by the face).
- New: GET /api/v1/admin/rooms (owner room list); participants included in
  room state. /demo rewritten as a ticket-based synthetic replay.
- Old components/components/RoomView.tsx and MessageCard.tsx removed.

Verified: 22/22 vitest, tsc clean, production build OK, 18/18 live smoke
checks on build-2026-10-03-1218, owner ticket creation E2E (TKT-E18BF0),
visual QA of /demo (ticket cards, pills, disagreement card all clean).
