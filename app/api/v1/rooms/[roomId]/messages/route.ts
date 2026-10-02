import { NextRequest } from "next/server";
import crypto from "crypto";
import { gate, roomOk, handleError, idempotentPost } from "@/lib/api";
import { db, C } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { MessagePostSchema, badRequest, unauthorized, forbidden } from "@/lib/schemas";
import { CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Submit text or a task result. Identity comes from the bearer token, never the body. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }): Promise<Response> {
  try {
    const { roomId } = await params;
    const g = await gate(req, "roomwrite");
    if ("response" in g) return g.response;
    if (!roomOk(g.principal, roomId)) return unauthorized();
    const p = g.principal;

    return await idempotentPost(req, p, async (raw) => {
      const parsed = MessagePostSchema.safeParse(raw);
      if (!parsed.success) throw Object.assign(new Error("invalid message"), { status: 400 });
      const { text, replyTo, taskId, kind } = parsed.data;
      const room = await db().collection(C.rooms).doc(roomId).get();
      if (!room.exists) throw Object.assign(new Error("unknown room"), { status: 404 });

      const agentId = p.kind === "agent" ? p.agentId! : "owner";
      const role = p.kind === "agent" ? p.role! : "owner";

      if (kind === "task_result") {
        if (!taskId) throw Object.assign(new Error("task_result requires taskId"), { status: 400 });
        if (p.kind !== "agent") throw Object.assign(new Error("only agents complete tasks"), { status: 403 });
        const tref = db().collection(C.tasks).doc(taskId);
        const ok = await db().runTransaction(async (tx) => {
          const ts = await tx.get(tref);
          if (!ts.exists) return false;
          const t = ts.data()!;
          if (t.assignedTo !== p.agentId || t.roomId !== roomId) return false;
          if (!["queued", "accepted", "working", "waiting"].includes(t.state)) return false;
          tx.update(tref, { state: "completed", result: text.slice(0, 4000), completedAt: Date.now() });
          return true;
        });
        if (!ok) throw Object.assign(new Error("task not found, not yours, or already closed"), { status: 403 });
        await logEvent(roomId, "task_state", taskId, { state: "completed", by: agentId });
      }

      const id = `msg_${crypto.randomBytes(8).toString("hex")}`;
      await db().collection(C.messages).doc(id).set({
        id, roomId, runId: null, agentId, role, replyTo: replyTo ?? null, taskId: taskId ?? null,
        kind, text: text.slice(0, CONFIG.textLimitChars),
        contextVersion: room.data()!.contextVersion ?? 0,
        status: "complete", createdAt: Date.now(),
      });
      const seq = await logEvent(roomId, "message", id, { agentId, role, kind });
      return { messageId: id, sequence: seq };
    });
  } catch (e) {
    if ((e as Error & { status?: number }).status === 400) return badRequest((e as Error).message);
    if ((e as Error & { status?: number }).status === 403) return forbidden((e as Error).message);
    return handleError(e);
  }
}
