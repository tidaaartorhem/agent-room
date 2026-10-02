import { NextRequest } from "next/server";
import { gate, roomOk, handleError, idempotentPost } from "@/lib/api";
import { applyBriefProposal } from "@/lib/run";
import { BriefProposalSchema, badRequest, unauthorized, conflict } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** Propose a brief change. Compare-and-swap on baseVersion; stale -> 409 + visible stale proposal. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }): Promise<Response> {
  try {
    const { roomId } = await params;
    const g = await gate(req, "roomwrite");
    if ("response" in g) return g.response;
    if (!roomOk(g.principal, roomId)) return unauthorized();
    const p = g.principal;

    return await idempotentPost(req, p, async (raw) => {
      const parsed = BriefProposalSchema.safeParse(raw);
      if (!parsed.success) throw Object.assign(new Error("invalid brief proposal"), { status: 400 });
      // External endpoint proposals are always owner-visible; auto-apply only
      // for owner, or team under the room's declared auto-draft default.
      const { db, C } = await import("@/lib/db");
      const room = (await db().collection(C.rooms).doc(roomId).get()).data()!;
      const r = await applyBriefProposal(roomId, null, {
        baseVersion: parsed.data.baseVersion,
        newText: parsed.data.newText,
        authorType: p.kind === "agent" ? "team" : "owner",
        authorId: p.kind === "agent" ? p.agentId! : "owner",
        sourceMessageIds: [],
        autoDraft: p.kind === "admin" ? true : (room.autoDraftDefault ?? false),
      });
      if (!r.applied && r.reason === "stale") throw Object.assign(new Error("stale base version; recorded as visible stale proposal"), { status: 409 });
      return { applied: r.applied, held: r.reason === "held", version: r.version };
    });
  } catch (e) {
    const s = (e as Error & { status?: number }).status;
    if (s === 400) return badRequest((e as Error).message);
    if (s === 409) return conflict((e as Error).message);
    return handleError(e);
  }
}
