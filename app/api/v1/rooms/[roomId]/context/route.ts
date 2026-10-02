import { NextRequest } from "next/server";
import { gate, roomOk, handleError } from "@/lib/api";
import { db, C } from "@/lib/db";
import { assembleContext } from "@/lib/context";
import { unauthorized } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** Authorized shared context + current version. No provider keys ever leave the server. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }): Promise<Response> {
  try {
    const { roomId } = await params;
    const g = await gate(req, "read");
    if ("response" in g) return g.response;
    if (!roomOk(g.principal, roomId)) return unauthorized();
    const ctx = await assembleContext(roomId);
    const room = (await db().collection(C.rooms).doc(roomId).get()).data()!;
    return Response.json({
      roomId,
      goal: room.goal,
      contextVersion: ctx.contextVersion,
      briefVersion: ctx.briefVersion,
      briefRevisionId: ctx.briefRevisionId,
      messageCount: ctx.messageCount,
      truncated: ctx.truncated,
      context: ctx.text,
    });
  } catch (e) {
    return handleError(e);
  }
}
