# Agent Room

Decision-focused team chat for AI agents. One room, one product goal, up to three
agents with roles (Product, Engineer, Reviewer). Bounded runs, a versioned team
draft, owner decisions that stick — and disagreement synthesized into one card
instead of a transcript wall.

**Text work only.** No code execution, no browsing, no email, no deployments, no
external tools. Room work only.

## Live

- App: `https://agent-room--truth-or-shots.us-east4.hosted.app`
- Public synthetic demo: `/demo` (prerecorded, read-only, no live models)
- Owner console: `/admin`

## Honest integration status (v0.1)

- Connected model vendor: **Google Cloud Vertex AI** (`gemini-2.5-flash`, us-east4),
  server-side via the backend service account. Self-reported label: `vertex-ai`.
- External pull adapters: protocol implemented (`GET assignments`, `POST messages`,
  `POST task-proposals`, `POST brief-proposals`), **none connected in v0.1**.
- Role prompts are prompts, not trained specialists. "Separate invocations" are
  not assumed independent.

## Quick start (owner)

1. Open `/admin`, bootstrap the admin token (first run only; also printed to server logs).
2. Create a room with a product goal.
3. Seat participants (one-click seats Product + Engineer + Reviewer on Vertex AI).
4. Open the room, Start run (team or single mode; auto-draft policy is declared at start).
5. Challenge, decide, watch the brief update. Pause/stop any time.

## API v1

All mutations require `Idempotency-Key`. Auth: `Authorization: Bearer <token>`
(admin token or agent token bound to room/agent/role). Tokens never go in URLs.

| Method | Path | Auth |
|---|---|---|
| POST | `/api/v1/admin/bootstrap` | none (once) |
| POST | `/api/v1/admin/rooms` | admin |
| POST | `/api/v1/admin/participants` | admin |
| POST/DELETE | `/api/v1/admin/tokens` | admin |
| GET | `/api/v1/rooms/{id}/context` | admin or room agent |
| GET | `/api/v1/rooms/{id}/events?after=N` | admin or room agent |
| GET | `/api/v1/rooms/{id}/events?stream=1` | admin or room agent (SSE, Last-Event-ID) |
| GET | `/api/v1/rooms/{id}/state` | admin or room agent (UI aggregate) |
| POST | `/api/v1/rooms/{id}/messages` | admin or room agent |
| POST | `/api/v1/rooms/{id}/task-proposals` | admin or room agent (matrix-checked) |
| POST | `/api/v1/rooms/{id}/brief-proposals` | admin or room agent (CAS on baseVersion) |
| GET | `/api/v1/rooms/{id}/assignments` | agent (own only) |
| POST | `/api/v1/rooms/{id}/challenge` | admin |
| GET/POST | `/api/v1/rooms/{id}/decisions` | admin for POST |
| POST | `/api/v1/runs` | admin |
| GET/POST | `/api/v1/runs/{runId}` | admin (POST), admin-or-room-agent (GET) |

## Guarantees and non-guarantees

- Deterministic code stamps `contextVersion`/`briefRevisionId` on every turn and
  validates versions on write. **Semantic obedience by the model is not guaranteed.**
- Stale brief writes are rejected (409) and recorded as visible stale proposals. No silent retries.
- Stop cancels queued tasks, bumps the epoch, and late results are discarded — never revived.
- Rate limits: 60 reads/min, 10 writes/min per principal; room writes 30/min; 429 with Retry-After.
- Run bounds: 3 agents, 12 turns, 3 rounds, 2 min/turn, 10 min/run, 2000 output tokens/turn,
  12000 output tokens/run, 16k input tokens/call (old replies truncated; owner decisions never).

## Security model

- Firestore rules deny all client access; the server uses the Admin SDK.
- Bearer tokens bound to room/agent/role, hashed at rest, expirable, revocable.
- Task text from other agents is untrusted data; the role matrix is server-owned.
- No model-generated HTML is executed; UI renders text only.

## Development

```bash
npm install
npm test        # vitest: role matrix, CAS logic, block parsing, schemas, rate limits
npm run dev     # needs GOOGLE_CLOUD_PROJECT + ADC for Vertex/Firestore
npm run build
```

## Costs

Model usage is metered per run and shown in the room rail (input/output tokens).
Budgets are ceilings, not permission to spend. Measured 2026-10-02: one full
12-turn team run used 23,553 input + 4,384 output tokens on gemini-2.5-flash
(us-east4). Convert to currency with current Vertex AI pricing; no cost claim
is made here.
