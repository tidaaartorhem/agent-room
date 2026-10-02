import { NextRequest } from "next/server";
import { gate, handleError, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { startRun } from "@/lib/run";
import { RunStartSchema, badRequest } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** Owner-only: start a bounded run. Returns 202; drive it via POST /runs/{id} {action:"drive"}. */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const g = await gate(req, "write");
    if ("response" in g) return g.response;
    requireAdmin(g.principal);
    const body = await readJson(req);
    const parsed = RunStartSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid run spec");
    const { runId } = await startRun(parsed.data.roomId, {
      mode: parsed.data.mode,
      autoDraft: parsed.data.autoDraft,
      initiatedBy: "admin",
    });
    return Response.json(
      {
        runId,
        note: parsed.data.autoDraft
          ? "Run policy: accepted internal brief proposals may auto-update the TEAM DRAFT (never owner decisions). Revocable via stop."
          : "Run policy: brief proposals are held for owner review (auto-draft off).",
      },
      { status: 202 }
    );
  } catch (e) {
    const s = (e as Error & { status?: number }).status;
    if (s === 400 || s === 404 || s === 409) return Response.json({ error: (e as Error).message }, { status: s });
    return handleError(e);
  }
}
