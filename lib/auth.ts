import crypto from "crypto";
import { db, C } from "./db";
import type { AgentRole } from "./config";

export interface Principal {
  kind: "admin" | "agent";
  credentialId: string;
  roomId?: string;
  agentId?: string;
  role?: AgentRole;
}

function tokenId(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function newToken(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(24).toString("base64url")}`;
}

/** One-time admin bootstrap. Returns the plaintext token exactly once. */
export async function bootstrapAdmin(): Promise<{ token: string } | { already: true }> {
  const ref = db().collection(C.credentials);
  const existing = await ref.where("kind", "==", "admin").where("revokedAt", "==", null).limit(1).get();
  if (!existing.empty) return { already: true };
  const token = newToken("ar_admin");
  await ref.doc(tokenId(token)).set({
    kind: "admin",
    tokenHash: tokenId(token),
    createdAt: Date.now(),
    expiresAt: null,
    revokedAt: null,
  });
  // Visible in Cloud Logging for the project owner to retrieve and then rotate.
  console.log(`[agent-room] ADMIN BOOTSTRAP TOKEN (show once, rotate via /admin): ${token}`);
  return { token };
}

export async function issueAgentToken(args: {
  roomId: string; agentId: string; role: AgentRole; expiresInDays: number;
}): Promise<{ token: string }> {
  const token = newToken("ar_agent");
  await db().collection(C.credentials).doc(tokenId(token)).set({
    kind: "agent",
    tokenHash: tokenId(token),
    roomId: args.roomId,
    agentId: args.agentId,
    role: args.role,
    createdAt: Date.now(),
    expiresAt: Date.now() + args.expiresInDays * 86400 * 1000,
    revokedAt: null,
  });
  return { token };
}

export async function revokeCredential(credentialId: string): Promise<void> {
  await db().collection(C.credentials).doc(credentialId).update({ revokedAt: Date.now() });
}

/** Verify a bearer token. Returns the principal or null. Never throws on bad input. */
export async function verifyToken(authHeader: string | null): Promise<Principal | null> {
  if (!authHeader) return null;
  const m = /^Bearer\s+(\S{8,200})$/i.exec(authHeader.trim());
  if (!m) return null;
  const id = tokenId(m[1]);
  // Token IDs are hex; reject anything else before lookup (no room-existence leak).
  if (!/^[0-9a-f]{64}$/.test(id)) return null;
  const snap = await db().collection(C.credentials).doc(id).get();
  if (!snap.exists) return null;
  const c = snap.data()!;
  if (c.revokedAt) return null;
  if (c.expiresAt && c.expiresAt < Date.now()) return null;
  if (c.kind === "admin") return { kind: "admin", credentialId: id };
  if (c.kind === "agent") {
    return { kind: "agent", credentialId: id, roomId: c.roomId, agentId: c.agentId, role: c.role };
  }
  return null;
}

export function requireAdmin(p: Principal | null): asserts p is Principal & { kind: "admin" } {
  if (!p || p.kind !== "admin") {
    const e = new Error("admin required") as Error & { status?: number };
    e.status = 401;
    throw e;
  }
}
