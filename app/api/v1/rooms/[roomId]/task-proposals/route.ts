import { NextRequest } from "next/server";
import crypto from "crypto";
import { gate, roomOk, handleError, idempotentPost } from "@/lib/api";
import { db, C } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { canAssign } from "@/lib/roles";
import { TaskProposalSchema, badRequest, unauthorized, forbidden } from "@/lib/schemas";
import { CONFIG, AgentRole } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Request role delegation. The SERVER validates against the role matrix;
 * model text can suggest, never authorize. assignedBy comes from auth.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }): Promise<Response> {
  try {
    const { roomId } = await params;
    const g = await gate(req, "roomwrite");
    if ("response" in g) return g.response;
    if (!roomOk(g.principal, roomId)) return unauthorized();
    const p = g.principal;

    return await idempotentPost(req, p, async (raw) => {
      const parsed = TaskProposalSchema.safeParse(raw);
      if (!parsed.success) throw Object.assign(new Error("invalid task proposal"), { status: 400 });
      const { to, taskType, description } = parsed.data;
      const fromRole = p.kind === "agent" ? p.role! : "owner";

      // Owner (admin) may direct any valid target; agents are matrix-bound.
      // canAssign takes AgentRole; "owner" is handled as a bypass with target validation below.
      if (p.kind === "agent" && !canAssign(fromRole as AgentRole, to, taskType)) {
        throw Object.assign(new Error(`role policy forbids ${fromRole} -> ${to}/${taskType}`), { status: 403 });
      }
      const agents = await db().collection(C.agents).where("roomId", "==", roomId).where("enabled", "==", true).get();
      const target = agents.docs.find((d) => d.data().role === to);
      if (!target) throw Object.assign(new Error(`no enabled '${to}' participant`), { status: 400 });
      const active = await db().collection(C.tasks).where("roomId", "==", roomId)
        .where("state", "in", ["queued", "accepted", "working", "waiting"]).get();
      const activeRun = await db().collection(C.runs).where("roomId", "==", roomId)
        .where("state", "in", ["running", "paused"]).limit(1).get();
      if (active.size >= CONFIG.maxQueue) {
        const e = new Error("task queue full") as Error & { status?: number };
        e.status = 429; throw e;
      }
      const id = `task_${crypto.randomBytes(8).toString("hex")}`;
      const room = await db().collection(C.rooms).doc(roomId).get();
      await db().collection(C.tasks).doc(id).set({
        id, roomId, runId: activeRun.empty ? null : activeRun.docs[0].id,
        assignedBy: p.kind === "agent" ? p.agentId! : "owner",
        assignedTo: target.id, toRole: to, taskType, description,
        state: "accepted", contextVersion: room.data()?.contextVersion ?? 0,
        createdAt: Date.now(),
      });
      await logEvent(roomId, "task_assigned", id, {
        assignedBy: p.kind === "agent" ? p.agentId! : "owner",
        assignedTo: target.id, toRole: to, taskType,
      });
      return { taskId: id, state: "accepted", assignedTo: target.id };
    });
  } catch (e) {
    const s = (e as Error & { status?: number }).status;
    if (s === 400) return badRequest((e as Error).message);
    if (s === 403) return forbidden((e as Error).message);
    if (s === 429) return Response.json({ error: "task queue full" }, { status: 429, headers: { "Retry-After": "30" } });
    return handleError(e);
  }
}
