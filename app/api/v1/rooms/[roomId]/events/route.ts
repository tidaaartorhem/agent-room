import { NextRequest } from "next/server";
import { gate, roomOk, handleError } from "@/lib/api";
import { getEvents } from "@/lib/events";
import { unauthorized, badRequest } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/**
 * Event feed. Two modes, both header-authenticated (tokens never in URLs):
 * - JSON poll: GET ?after=N -> {events, latest}
 * - SSE: GET ?stream=1 (or Accept: text/event-stream), honors Last-Event-ID,
 *   replays missed events, then live-polls with heartbeats. Max 5 min per connection.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }): Promise<Response> {
  try {
    const { roomId } = await params;
    const g = await gate(req, "read");
    if ("response" in g) return g.response;
    if (!roomOk(g.principal, roomId)) return unauthorized();

    const url = new URL(req.url);
    const wantsStream = url.searchParams.get("stream") === "1" || (req.headers.get("accept") ?? "").includes("text/event-stream");
    let after = parseInt(url.searchParams.get("after") ?? "0", 10);
    if (Number.isNaN(after) || after < 0) return badRequest("invalid cursor");
    const lastEventId = req.headers.get("Last-Event-ID");
    if (lastEventId && /^\d+$/.test(lastEventId)) after = parseInt(lastEventId, 10);

    if (!wantsStream) {
      const events = await getEvents(roomId, after);
      return Response.json({ events, latest: events.length ? events[events.length - 1].sequence : after });
    }

    const enc = new TextEncoder();
    let closed = false;
    const stream = new ReadableStream({
      async start(controller) {
        const send = (e: { sequence: number; type: string; entityId: string; payload: unknown; createdAt: number }) => {
          if (closed) return;
          controller.enqueue(enc.encode(`id: ${e.sequence}\ndata: ${JSON.stringify(e)}\n\n`));
        };
        let cursor = after;
        const missed = await getEvents(roomId, cursor);
        for (const e of missed) { send(e); cursor = e.sequence; }
        const iv = setInterval(async () => {
          if (closed) return;
          try {
            const fresh = await getEvents(roomId, cursor);
            for (const e of fresh) { send(e); cursor = e.sequence; }
            controller.enqueue(enc.encode(`: heartbeat\n\n`));
          } catch { /* next tick */ }
        }, 1500);
        setTimeout(() => { closed = true; clearInterval(iv); try { controller.close(); } catch { /* noop */ } }, 5 * 60 * 1000);
      },
      cancel() { closed = true; },
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
    return handleError(e);
  }
}
