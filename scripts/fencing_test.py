#!/usr/bin/env python3
"""Stop/pause/resume fencing verification against the live deployment."""
import json, os, urllib.request, urllib.error

BASE = "https://agent-room--truth-or-shots.us-east4.hosted.app"
ADMIN = open("/tmp/ar-admin-token").read().strip()

def call(method, path, token=None, body=None, timeout=60):
    H = {"Content-Type": "application/json"}
    if token:
        H["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers=H, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]

def drive_sse(runId, timeout=60):
    req = urllib.request.Request(
        BASE + f"/api/v1/runs/{runId}",
        data=json.dumps({"action": "drive"}).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {ADMIN}"},
        method="POST",
    )
    return urllib.request.urlopen(req, timeout=timeout).read().decode()

def mkroom(extra_agent=None):
    s, room = call("POST", "/api/v1/admin/rooms", ADMIN, {"goal": "fencing test"})
    assert s == 201, room
    roomId = room["roomId"]
    agents = [("p1", "product"), ("e1", "engineer"), ("r1", "reviewer")]
    if extra_agent:
        agents.append(extra_agent)
    for aid, role in agents:
        s, _ = call("POST", "/api/v1/admin/participants", ADMIN,
                    {"roomId": roomId, "agentId": aid, "role": role,
                     "providerLabel": "vertex-ai", "adapterType": "vertex"})
        assert s == 201, (role, s)
    return roomId

# --- T1: stop before drive; drive must refuse; epoch fenced ---
roomId = mkroom()
s, run = call("POST", "/api/v1/runs", ADMIN, {"roomId": roomId, "mode": "team", "autoDraft": True})
runId = run["runId"]
s, st1 = call("GET", f"/api/v1/runs/{runId}", ADMIN)
s, _ = call("POST", f"/api/v1/runs/{runId}", ADMIN, {"action": "stop"})
assert s == 200, s
s, st2 = call("GET", f"/api/v1/runs/{runId}", ADMIN)
print(f"T1 stop: {st1['state']} -> {st2['state']} | epoch {st1['epoch']} -> {st2['epoch']}")
assert st2["state"] == "stopped" and st2["epoch"] == st1["epoch"] + 1
out = drive_sse(runId)
print("T1 drive stopped run:", out[:160].replace("\n", " | "))
s, st3 = call("GET", f"/api/v1/runs/{runId}", ADMIN)
print("T1 turns after drive attempt:", st3["counters"]["turns"], "(expect 0)")
assert st3["counters"]["turns"] == 0
assert "stopped" in out
print("T1 PASS: stopped run refuses drive, epoch fenced\n")

# --- T2: pause -> drive refuses -> resume -> running ---
roomId = mkroom(extra_agent=("s1", "single"))
s, run = call("POST", "/api/v1/runs", ADMIN, {"roomId": roomId, "mode": "single", "autoDraft": False})
runId = run["runId"]
s, _ = call("POST", f"/api/v1/runs/{runId}", ADMIN, {"action": "pause"})
assert s == 200, s
s, st = call("GET", f"/api/v1/runs/{runId}", ADMIN)
print("T2 paused state:", st["state"])
out = drive_sse(runId)
print("T2 drive paused:", out[:160].replace("\n", " | "))
assert "paused" in out
s, st3 = call("GET", f"/api/v1/runs/{runId}", ADMIN)
assert st3["counters"]["turns"] == 0
s, _ = call("POST", f"/api/v1/runs/{runId}", ADMIN, {"action": "resume"})
assert s == 200, s
s, st = call("GET", f"/api/v1/runs/{runId}", ADMIN)
print("T2 resumed state:", st["state"])
assert st["state"] == "running"
print("T2 PASS: pause blocks drive, resume restores running")
print("\nALL FENCING TESTS PASSED")
