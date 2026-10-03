import { db, C } from "./db";

/**
 * Idempotency-Key handling for POST mutations.
 * Same principal + key + body -> same stored result.
 * Same principal + key + DIFFERENT body -> 409 (client must use a new key).
 */
export async function checkIdem(
  principalId: string,
  key: string,
  bodyHash: string
): Promise<{ hit: boolean; conflict?: boolean; result?: unknown }> {
  if (!key || key.length > 128) return { hit: false };
  const id = `${principalId}::${key}`;
  const snap = await db().collection(C.idem).doc(id).get();
  if (!snap.exists) return { hit: false };
  const rec = snap.data()!;
  if (rec.expiresAt < Date.now()) return { hit: false };
  if (rec.bodyHash !== bodyHash) return { hit: true, conflict: true };
  return { hit: true, result: rec.result };
}

/**
 * Strip undefined values (incl. nested) so Firestore .set() never throws
 * "Cannot use undefined as a Firestore value" on sparse result objects.
 */
export function cleanForFirestore<T>(value: T): T {
  if (value === undefined) return null as T;
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function storeIdem(
  principalId: string,
  key: string,
  bodyHash: string,
  result: unknown
): Promise<void> {
  if (!key || key.length > 128) return;
  const id = `${principalId}::${key}`;
  await db()
    .collection(C.idem)
    .doc(id)
    .set({
      principalId,
      key,
      bodyHash,
      result: cleanForFirestore(result),
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 3600 * 1000,
    });
}
