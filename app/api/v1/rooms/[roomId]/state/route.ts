import { NextRequest } from "next/server";
import { gate, roomOk, handleError } from "@/lib/api";
import { db, C } from "@/lib/db";
import { unauthorized } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** Aggregated room state for the UI (adapters use the granular endpoints). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }): Promise<Response> {
  try {
    const { roomId } = await params;
    const g = await gate(req, "read");
    if ("response" in g) return g.response;
    if (!roomOk(g.principal, roomId)) return unauthorized();
    const d = db();
    const [roomSnap, msgSnap, taskSnap, briefSnap, decSnap, runSnap, agentSnap] = await Promise.all([
      d.collection(C.rooms).doc(roomId).get(),
      d.collection(C.messages).where("roomId", "==", roomId).orderBy("createdAt", "desc").limit(60).get(),
      d.collection(C.tasks).where("roomId", "==", roomId).orderBy("createdAt", "desc").limit(30).get(),
      d.collection(C.briefs).where("roomId", "==", roomId).orderBy("version", "desc").limit(5).get(),
      d.collection(C.decisions).where("roomId", "==", roomId).where("status", "==", "active").orderBy("createdAt", "asc").get(),
      d.collection(C.runs).where("roomId", "==", roomId).orderBy("startedAt", "desc").limit(1).get(),
      d.collection(C.agents).where("roomId", "==", roomId).where("enabled", "==", true).get(),
    ]);
    if (!roomSnap.exists) return unauthorized();
    const room = roomSnap.data()!;
    const pick = (s: FirebaseFirestore.QuerySnapshot, fields: string[]) =>
      s.docs.map((x) => {
        const d2 = x.data() as Record<string, unknown>;
        const o: Record<string, unknown> = {};
        for (const f of fields) o[f] = d2[f];
        return o;
      });
    return Response.json({
      goal: room.goal,
      contextVersion: room.contextVersion ?? 0,
      autoDraftDefault: room.autoDraftDefault ?? false,
      messages: pick(msgSnap, ["id", "agentId", "role", "kind", "text", "contextVersion", "status", "createdAt", "card", "topic", "proposedText", "replyTo", "reactions"]).reverse(),
      tasks: pick(taskSnap, ["id", "assignedBy", "assignedTo", "toRole", "taskType", "description", "state", "contextVersion", "result", "createdAt"]),
      briefs: pick(briefSnap, ["id", "version", "text", "diff", "authorType", "authorId", "createdAt"]),
      decisions: pick(decSnap, ["id", "text", "scope", "createdAt"]),
      participants: pick(agentSnap, ["id", "agentId", "role", "providerLabel", "adapterType", "createdAt"]),
      run: runSnap.empty ? null : (() => {
        const r = runSnap.docs[0].data();
        return { runId: r.id, state: r.state, mode: r.mode, autoDraft: r.autoDraft, counters: r.counters, startedAt: r.startedAt, endedAt: r.endedAt };
      })(),
    });
  } catch (e) {
    return handleError(e);
  }
}
