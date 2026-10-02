import { NextRequest } from "next/server";
import { gate, roomOk, handleError, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db, C } from "@/lib/db";
import { driveRun, pauseRun, stopRun, resumeRun } from "@/lib/run";
import { unauthorized, badRequest } from "@/lib/schemas";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Run status (admin, or agent bound to the run's room). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ runId: string }> }): Promise<Response> {
  try {
    const { runId } = await params;
    const g = await gate(req, "read");
    if ("response" in g) return g.response;
    const snap = await db().collection(C.runs).doc(runId).get();
    if (!snap.exists) return unauthorized();
    const r = snap.data()!;
    if (!roomOk(g.principal, r.roomId)) return unauthorized();
    return Response.json({
      runId, state: r.state, epoch: r.epoch, mode: r.mode, autoDraft: r.autoDraft,
      counters: r.counters, startedAt: r.startedAt, endedAt: r.endedAt,
    });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Owner-only run control.
 * - drive: run the bounded loop to a terminal state, streaming progress as SSE.
 *   Server-side: continues if the browser disconnects (writes go to Firestore).
 * - pause | stop | resume
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ runId: string }> }): Promise<Response> {
  try {
    const { runId } = await params;
    const g = await gate(req, "write");
    if ("response" in g) return g.response;
    requireAdmin(g.principal);
    const body = await readJson(req);
    const parsed = z.object({ action: z.enum(["drive", "pause", "stop", "resume"]) }).safeParse(body);
    if (!parsed.success) return badRequest("invalid action");

    if (parsed.data.action === "pause") { await pauseRun(runId); return Response.json({ runId, state: "paused" }); }
    if (parsed.data.action === "stop") { await stopRun(runId); return Response.json({ runId, state: "stopped" }); }
    if (parsed.data.action === "resume") {
      await resumeRun(runId);
      return Response.json({ runId, state: "running", note: "resumed; drive it with action=drive" });
    }

    // drive: SSE progress stream; closes at terminal state.
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (o: unknown) => {
          try { controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`)); } catch { /* client gone */ }
        };
        try {
          await driveRun(runId, (msg) => send({ progress: msg }));
          send({ done: true, runId });
        } catch (e) {
          send({ error: (e as Error).message });
        }
        try { controller.close(); } catch { /* noop */ }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    const s = (e as Error & { status?: number }).status;
    if (s === 400) return badRequest((e as Error).message);
    return handleError(e);
  }
}
