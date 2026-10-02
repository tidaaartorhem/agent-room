import { NextRequest } from "next/server";
import { z } from "zod";
import { gate, roomOk, handleError, idempotentPost } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { recordDecision } from "@/lib/run";
import { DecisionPostSchema, badRequest, unauthorized } from "@/lib/schemas";
import { db, C } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Owner-only: record a decision. Owner-authored; agents cannot change it. May carry a brief update. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }): Promise<Response> {
  try {
    const { roomId } = await params;
    const g = await gate(req, "roomwrite");
    if ("response" in g) return g.response;
    if (!roomOk(g.principal, roomId)) return unauthorized();
    requireAdmin(g.principal);
    return await idempotentPost(req, g.principal, async (raw) => {
      const parsed = DecisionPostSchema.extend({ briefText: z.string().max(16000).optional() }).safeParse(raw);
      if (!parsed.success) throw Object.assign(new Error("invalid decision"), { status: 400 });
      const { decisionId } = await recordDecision(roomId, {
        text: parsed.data.text,
        scope: parsed.data.scope,
        cardId: parsed.data.cardId,
        chosenOption: parsed.data.chosenOption,
        briefText: (parsed.data as { briefText?: string }).briefText,
      });
      const v = (await db().collection(C.rooms).doc(roomId).get()).data()?.contextVersion ?? 0;
      return { decisionId, contextVersion: v };
    });
  } catch (e) {
    if ((e as Error & { status?: number }).status === 400) return badRequest((e as Error).message);
    return handleError(e);
  }
}

/** List active owner decisions (admin or room agent). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }): Promise<Response> {
  try {
    const { roomId } = await params;
    const g = await gate(req, "read");
    if ("response" in g) return g.response;
    if (!roomOk(g.principal, roomId)) return unauthorized();
    const snap = await db().collection(C.decisions)
      .where("roomId", "==", roomId).where("status", "==", "active")
      .orderBy("createdAt", "asc").get();
    return Response.json({
      decisions: snap.docs.map((d) => {
        const x = d.data();
        return { id: x.id, text: x.text, scope: x.scope, createdAt: x.createdAt };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}
