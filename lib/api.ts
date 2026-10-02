import crypto from "crypto";
import { NextRequest } from "next/server";
import { verifyToken, Principal } from "./auth";
import { checkRate } from "./ratelimit";
import { checkIdem, storeIdem } from "./idempotency";
import { CONFIG } from "./config";
import { unauthorized, throttled, tooLarge, conflict } from "./schemas";

/** Read JSON body with the 64KiB cap. */
export async function readJson(req: NextRequest): Promise<unknown> {
  const text = await req.text();
  if (text.length > CONFIG.bodyLimitBytes) {
    const e = new Error("too large") as Error & { status?: number };
    e.status = 413;
    throw e;
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const e = new Error("invalid JSON") as Error & { status?: number };
    e.status = 400;
    throw e;
  }
}

export function bodyHash(body: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

export function handleError(e: unknown): Response {
  const err = e as Error & { status?: number };
  const status = err.status ?? 500;
  const msg =
    status >= 500 ? "internal error" : err.message || "error";
  return Response.json({ error: msg }, { status });
}

/** Authenticate + rate-limit. Returns principal or a rejection Response. */
export async function gate(
  req: NextRequest,
  kind: "read" | "write" | "roomwrite" = "read"
): Promise<{ principal: Principal } | { response: Response }> {
  const principal = await verifyToken(req.headers.get("authorization"));
  if (!principal) return { response: unauthorized() };
  const key = principal.kind === "admin" ? `admin:${principal.credentialId}` : `agent:${principal.credentialId}`;
  const r = checkRate(key, kind);
  if (!r.ok) return { response: throttled(r.retryAfterSec) };
  return { principal };
}

/** Authorize room access: admin, or agent bound to this room. */
export function roomOk(principal: Principal, roomId: string): boolean {
  if (principal.kind === "admin") return true;
  return principal.kind === "agent" && principal.roomId === roomId;
}

/**
 * Idempotent POST wrapper. Handler receives (principal, body) and returns
 * a serializable result; the wrapper stores/returns it under Idempotency-Key.
 */
export async function idempotentPost(
  req: NextRequest,
  principal: Principal,
  handler: (body: unknown) => Promise<unknown>
): Promise<Response> {
  const body = await readJson(req);
  const key = req.headers.get("Idempotency-Key") ?? "";
  const pid = `${principal.kind}:${principal.credentialId}`;
  const hash = bodyHash(body);
  if (key) {
    const prior = await checkIdem(pid, key, hash);
    if (prior.hit && prior.conflict) return conflict("idempotency key reused with different body");
    if (prior.hit) return Response.json({ ...(prior.result as object), idempotentReplay: true });
  }
  const result = await handler(body);
  if (key) await storeIdem(pid, key, hash, result);
  return Response.json(result, { status: 201 });
}
