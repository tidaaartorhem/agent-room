#!/usr/bin/env python3
"""First bounded LIVE run: 3 real Vertex agents discuss, driven server-side.
Usage: BASE=... ADMIN=$(cat /tmp/ar-admin-token) python3 scripts/live_run.py
"""
import json, os, sys, urllib.request, urllib.error, time

BASE = os.environ["BASE"]
ADMIN = os.environ["ADMIN"]

def call(method, path, token=None, body=None, timeout=60, raw=False):
    H = {"Content-Type": "application/json"}
    if token:
        H["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers=H, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        txt = r.read().decode()
        return r.status, (txt if raw else json.loads(txt))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:500]

# 1. room
s, room = call("POST", "/api/v1/admin/rooms", ADMIN, {
    "goal": "Draft a one-paragraph product brief for a simple habit-tracking web app for solo founders. Keep scope tiny.",
    "autoDraftDefault": True,
})
assert s == 201, room
roomId = room["roomId"]
print("room", roomId)

# 2. seat 3 vertex agents
for aid, role in [("p1", "product"), ("e1", "engineer"), ("r1", "reviewer")]:
    s, _ = call("POST", "/api/v1/admin/participants", ADMIN,
                {"roomId": roomId, "agentId": aid, "role": role,
                 "providerLabel": "vertex-ai", "adapterType": "vertex"})
    assert s == 201, (role, s)
print("seated product/engineer/reviewer (vertex)")

# 3. start team run, auto-draft on
s, run = call("POST", "/api/v1/runs", ADMIN,
              {"roomId": roomId, "mode": "team", "autoDraft": True})
assert s == 202, run
runId = run["runId"]
print("run", runId)

# 4. drive it (SSE; server continues if we disconnect)
print("driving (SSE)...")
req = urllib.request.Request(
    BASE + f"/api/v1/runs/{runId}",
    data=json.dumps({"action": "drive"}).encode(),
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {ADMIN}"},
    method="POST",
)
try:
    r = urllib.request.urlopen(req, timeout=290)
    buf = b""
    deadline = time.time() + 285
    while time.time() < deadline:
        chunk = r.read(4096)
        if not chunk:
            break
        buf += chunk
        while b"\n\n" in buf:
            evt, buf = buf.split(b"\n\n", 1)
            for line in evt.decode(errors="replace").splitlines():
                if line.startswith("data: "):
                    try:
                        d = json.loads(line[6:])
                    except Exception:
                        continue
                    if "progress" in d:
                        print("  >", d["progress"][:160])
                    if d.get("done"):
                        print("drive done")
                        raise StopIteration
                    if "error" in d:
                        print("DRIVE ERROR:", d["error"][:300])
                        raise StopIteration
except StopIteration:
    pass
except Exception as e:
    print("drive stream ended:", type(e).__name__, str(e)[:120])

# 5. final state + terminal summary
time.sleep(3)
s, st = call("GET", f"/api/v1/runs/{runId}", ADMIN)
print("final run state:", json.dumps(st)[:400])
s, state = call("GET", f"/api/v1/rooms/{roomId}/state", ADMIN)
msgs = state.get("messages", [])
print(f"messages: {len(msgs)}")
for m in msgs[-6:]:
    who = m.get("role") or m.get("agentId")
    print(f"  [{who}/{m.get('kind')}] {m.get('text','')[:150]}")
brief = state.get("brief")
if brief:
    print("brief v%s:" % brief.get("version"), brief.get("text", "")[:400])
