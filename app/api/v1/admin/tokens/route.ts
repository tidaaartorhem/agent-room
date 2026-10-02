import { NextRequest } from "next/server";
import { gate, readJson, handleError } from "@/lib/api";
import { requireAdmin, issueAgentToken, revokeCredential } from "@/lib/auth";
import { db, C } from "@/lib/db";
import { TokenIssueSchema, badRequest } from "@/lib/schemas";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** Issue an agent bearer token. Plaintext shown exactly once. */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const g = await gate(req, "write");
    if ("response" in g) return g.response;
    requireAdmin(g.principal);
    const body = await readJson(req);
    const parsed = TokenIssueSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid token spec");
    const { roomId, agentId, role, expiresInDays } = parsed.data;
    const agent = await db().collection(C.agents).doc(`${roomId}_${agentId}`).get();
    if (!agent.exists || !agent.data()!.enabled) return badRequest("unknown or disabled participant");
    const { token } = await issueAgentToken({ roomId, agentId: `${roomId}_${agentId}`, role, expiresInDays });
    return Response.json(
      { token, note: "shown once; store securely. Binds room/agent/role; revoke via DELETE." },
      { status: 201 }
    );
  } catch (e) {
    return handleError(e);
  }
}

/** Revoke a credential by its ID (sha256 of the token). */
export async function DELETE(req: NextRequest): Promise<Response> {
  try {
    const g = await gate(req, "write");
    if ("response" in g) return g.response;
    requireAdmin(g.principal);
    const body = await readJson(req);
    const parsed = z.object({ credentialId: z.string().regex(/^[0-9a-f]{64}$/) }).safeParse(body);
    if (!parsed.success) return badRequest("invalid credential id");
    await revokeCredential(parsed.data.credentialId);
    return Response.json({ revoked: true });
  } catch (e) {
    return handleError(e);
  }
}
