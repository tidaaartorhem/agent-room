import { NextRequest } from "next/server";
import { gate, roomOk, handleError } from "@/lib/api";
import { db, C } from "@/lib/db";
import { ReactionToggleSchema, badRequest, unauthorized } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/**
 * Toggle the caller's emoji reaction on a message.
 * Identity comes from the Bearer <redacted>, never the body.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string; messageId: string }> }
): Promise<Response> {
  try {
    const { roomId, messageId } = await params;
    const g = await gate(req, "roomwrite");
    if ("response" in g) return g.response;
    if (!roomOk(g.principal, roomId)) return unauthorized();
    const p = g.principal;

    const raw = await req.json().catch(() => ({}));
    const parsed = ReactionToggleSchema.safeParse(raw);
    if (!parsed.success) return badRequest("invalid reaction");
    const { emoji } = parsed.data;

    const who = p.kind === "agent" ? p.agentId! : "owner";
    const mref = db().collection(C.messages).doc(messageId);
    const result = await db().runTransaction(async (tx) => {
      const snap = await mref.get();
      if (!snap.exists) return null;
      const m = snap.data()!;
      if (m.roomId !== roomId) return null;
      const reactions: Record<string, string[]> = { ...(m.reactions ?? {}) };
      const list = reactions[emoji] ?? [];
      if (list.includes(who)) {
        reactions[emoji] = list.filter((x) => x !== who);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji] = [...list, who].slice(0, 50);
      }
      tx.update(mref, { reactions });
      return reactions;
    });
    if (!result) return badRequest("unknown message");
    return Response.json({ ok: true, reactions: result });
  } catch (e) {
    return handleError(e);
  }
}
