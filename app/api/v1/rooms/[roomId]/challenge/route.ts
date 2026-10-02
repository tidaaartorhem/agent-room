import { NextRequest } from "next/server";
import { gate, roomOk, handleError, idempotentPost } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { runChallenge } from "@/lib/run";
import { ChallengePostSchema, badRequest, unauthorized } from "@/lib/schemas";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** Owner-only: invoke a finite critique round -> disagreement card. Counts toward the turn cap. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }): Promise<Response> {
  try {
    const { roomId } = await params;
    const g = await gate(req, "roomwrite");
    if ("response" in g) return g.response;
    if (!roomOk(g.principal, roomId)) return unauthorized();
    requireAdmin(g.principal);
    return await idempotentPost(req, g.principal, async (raw) => {
      const parsed = ChallengePostSchema.extend({ runId: z.string().min(1).max(128) }).safeParse(raw);
      if (!parsed.success) throw Object.assign(new Error("invalid challenge"), { status: 400 });
      const { cardId } = await runChallenge(roomId, parsed.data.runId, parsed.data.topic);
      return { cardId };
    });
  } catch (e) {
    if ((e as Error & { status?: number }).status === 400) return badRequest((e as Error).message);
    return handleError(e);
  }
}
