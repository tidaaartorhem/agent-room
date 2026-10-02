import { NextRequest } from "next/server";
import crypto from "crypto";
import { gate, readJson, handleError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db, C } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { RoomCreateSchema, badRequest } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const g = await gate(req, "write");
    if ("response" in g) return g.response;
    requireAdmin(g.principal);
    const body = await readJson(req);
    const parsed = RoomCreateSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid room spec");
    const id = `room_${crypto.randomBytes(8).toString("hex")}`;
    await db().collection(C.rooms).doc(id).set({
      id,
      goal: parsed.data.goal,
      ownerId: "admin",
      contextVersion: 0,
      policyVersion: 1,
      eventSeq: 0,
      autoDraftDefault: parsed.data.autoDraftDefault ?? false,
      createdAt: Date.now(),
    });
    await logEvent(id, "room_created", id, { goal: parsed.data.goal.slice(0, 200) });
    return Response.json({ roomId: id }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
