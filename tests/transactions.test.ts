import { describe, it, expect, vi } from "vitest";

/**
 * Faithful Firestore mock: like the real backend, tx.get() after any
 * tx write throws. Regression test for stopRun's read-after-write 500.
 */
const writes: Array<{ ref: string; data: any }> = [];

const mkTx = () => {
  let sawWrite = false;
  return {
    get: async (target: any) => {
      if (sawWrite) throw new Error("Firestore transactions require all reads before writes");
      if (target.__kind === "query") return { docs: target.__docs, empty: target.__docs.length === 0 };
      return target.__snap;
    },
    update: (ref: any, data: any) => { sawWrite = true; writes.push({ ref: ref.__id, data }); },
    set: (ref: any, data: any) => { sawWrite = true; writes.push({ ref: ref.__id, data }); },
  };
};

const queryObj: any = { __kind: "query", __docs: [{ ref: { __id: "ar_tasks/task_1" } }] };
queryObj.where = () => queryObj;

const docOf = (coll: string, id: string) => {
  const ref = { __kind: "doc", __id: `${coll}/${id}` } as any;
  const snap = { exists: true, data: () => ({ epoch: 1, roomId: "room_x", eventSeq: 41 }) };
  return { ...ref, __snap: snap, ref, get: async () => snap };
};

vi.mock("@/lib/db", () => ({
  C: {
    rooms: "ar_rooms", agents: "ar_agents", credentials: "ar_credentials",
    runs: "ar_runs", turns: "ar_turns", tasks: "ar_tasks", messages: "ar_messages",
    briefs: "ar_briefs", decisions: "ar_decisions", events: "ar_events", idem: "ar_idem",
  },
  db: () => ({
    collection: (name: string) => ({ doc: (id: string) => docOf(name, id), where: () => queryObj }),
    runTransaction: async (fn: any) => fn(mkTx()),
  }),
}));

import { stopRun } from "@/lib/run";

describe("firestore transaction ordering (reads before writes)", () => {
  it("stopRun performs all transaction reads before writes", async () => {
    writes.length = 0;
    await stopRun("run_1"); // must not throw the reads-before-writes error
    const runWrite = writes.find((w) => w.ref === "ar_runs/run_1");
    expect(runWrite?.data.state).toBe("stopped");
    expect(runWrite?.data.epoch).toBe(2); // epoch fenced
    const taskWrite = writes.find((w) => w.ref === "ar_tasks/task_1");
    expect(taskWrite?.data.state).toBe("cancelled");
  });
});
