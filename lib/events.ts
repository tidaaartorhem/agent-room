import { db, C } from "./db";

export interface RoomEvent {
  roomId: string;
  sequence: number;
  type: string;
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: number;
}

/** Append-only event log. Sequence is per-room, assigned transactionally. */
export async function logEvent(
  roomId: string,
  type: string,
  entityId: string,
  payload: Record<string, unknown> = {}
): Promise<number> {
  const seq = await db().runTransaction(async (tx) => {
    const roomRef = db().collection(C.rooms).doc(roomId);
    const snap = await tx.get(roomRef);
    if (!snap.exists) {
      const e = new Error("unknown room") as Error & { status?: number };
      e.status = 404;
      throw e;
    }
    const next = (snap.data()!.eventSeq || 0) + 1;
    tx.update(roomRef, { eventSeq: next });
    tx.set(db().collection(C.events).doc(`${roomId}_${String(next).padStart(8, "0")}`), {
      roomId,
      sequence: next,
      type,
      entityId,
      payload,
      createdAt: Date.now(),
    });
    return next;
  });
  return seq;
}

export async function getEvents(roomId: string, after: number, limit = 100): Promise<RoomEvent[]> {
  const snap = await db()
    .collection(C.events)
    .where("roomId", "==", roomId)
    .where("sequence", ">", after)
    .orderBy("sequence", "asc")
    .limit(Math.min(limit, 200))
    .get();
  return snap.docs.map((d) => d.data() as RoomEvent);
}
