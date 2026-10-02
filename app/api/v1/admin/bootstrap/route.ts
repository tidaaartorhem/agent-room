import { bootstrapAdmin } from "@/lib/auth";
import { handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * One-time admin bootstrap. No auth — succeeds exactly once, then 403.
 * The token is also printed to server logs for the project owner.
 */
export async function POST(): Promise<Response> {
  try {
    const r = await bootstrapAdmin();
    if ("already" in r) return Response.json({ error: "already initialized" }, { status: 403 });
    return Response.json({ token: r.token, note: "shown once; store it and rotate via /admin" });
  } catch (e) {
    return handleError(e);
  }
}
