import { NextRequest } from "next/server";
import { gate, handleError } from "@/lib/api";
import { db, C } from "@/lib/db";
import { unauthorized } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** Pull adapter: returns ONLY the caller's own open assignments. Same scope as the token. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }): Promise<Response> {
  try {
    const { roomId } = await params;
    const g = await gate(req, "read");
    if ("response" in g) return g.response;
    const p = g.principal;
    if (p.kind !== "agent" || p.roomId !== roomId) return unauthorized();
    const snap = await db().collection(C.tasks)
      .where("roomId", "==", roomId)
      .where("assignedTo", "==", p.agentId)
      .where("state", "in", ["queued", "accepted", "working", "waiting"])
      .orderBy("createdAt", "asc")
      .get();
    return Response.json({
      assignments: snap.docs.map((d) => {
        const t = d.data();
        return {
          taskId: t.id, runId: t.runId, taskType: t.taskType,
          description: t.description, state: t.state,
          assignedBy: t.assignedBy, contextVersion: t.contextVersion,
        };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}
