import { NextRequest } from "next/server";
import crypto from "crypto";
import { gate, readJson, handleError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db, C } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { RoomCreateSchema, badRequest } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** Owner-only: list rooms for the channel switcher. */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const g = await gate(req, "read");
    if ("response" in g) return g.response;
    requireAdmin(g.principal);
    const snap = await db().collection(C.rooms).orderBy("createdAt", "desc").limit(50).get();
    return Response.json({
      rooms: snap.docs.map((x) => {
        const r = x.data();
        return { roomId: r.id, goal: r.goal, createdAt: r.createdAt };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}

/** Owner-only: delete a room and its data (archive channel). */
export async function DELETE(req: NextRequest): Promise<Response> {
  try {
    const g = await gate(req, "write");
    if ("response" in g) return g.response;
    requireAdmin(g.principal);
    const roomId = new URL(req.url).searchParams.get("roomId");
    if (!roomId || !/^room_[0-9a-f]{16}$/.test(roomId)) return badRequest("invalid roomId");
    const d = db();
    const collections = [C.messages, C.tasks, C.briefs, C.decisions, C.events, C.runs, C.turns, C.agents, C.credentials, C.idem];
    for (const c of collections) {
      const snap = await d.collection(c).where("roomId", "==", roomId).get();
      // Firestore batch limit is 500; rooms are small, chunk defensively.
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = d.batch();
        for (const doc of snap.docs.slice(i, i + 400)) batch.delete(doc.ref);
        await batch.commit();
      }
    }
    await d.collection(C.rooms).doc(roomId).delete();
    return Response.json({ ok: true, roomId });
  } catch (e) {
    return handleError(e);
  }
}

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
