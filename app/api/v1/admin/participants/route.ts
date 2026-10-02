import { NextRequest } from "next/server";
import { gate, readJson, handleError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db, C } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { ParticipantSchema, badRequest, forbidden } from "@/lib/schemas";
import { CONFIG } from "@/lib/config";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const g = await gate(req, "write");
    if ("response" in g) return g.response;
    requireAdmin(g.principal);
    const body = await readJson(req);
    const parsed = ParticipantSchema.extend({ roomId: z.string().min(1).max(128) }).safeParse(body);
    if (!parsed.success) return badRequest("invalid participant spec");
    const { roomId, agentId, role, providerLabel, adapterType } = parsed.data;
    const room = await db().collection(C.rooms).doc(roomId).get();
    if (!room.exists) return badRequest("unknown room");
    const existing = await db().collection(C.agents).where("roomId", "==", roomId).where("enabled", "==", true).get();
    if (existing.size >= CONFIG.maxAgents) return forbidden(`room agent cap reached (${CONFIG.maxAgents})`);
    if (existing.docs.some((d) => d.data().agentId === agentId || d.data().role === role)) {
      return badRequest("agentId or role already present in room");
    }
    await db().collection(C.agents).doc(`${roomId}_${agentId}`).set({
      id: `${roomId}_${agentId}`, roomId, agentId, role, providerLabel, adapterType,
      enabled: true, createdAt: Date.now(),
    });
    await logEvent(roomId, "participant_added", agentId, { role, providerLabel, adapterType });
    return Response.json({ agentId: `${roomId}_${agentId}`, role }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
