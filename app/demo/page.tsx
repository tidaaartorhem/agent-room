"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCard, CardMessage } from "@/components/MessageCard";

const T = (m: Partial<CardMessage> & { text: string }): CardMessage => ({
  id: Math.random().toString(36).slice(2),
  kind: "message",
  createdAt: Date.now(),
  ...m,
} as CardMessage);

const SCRIPT: CardMessage[] = [
  T({ role: "owner", agentId: "owner", kind: "message", text: "Goal: plan the Q3 launch post for the analytics dashboard. One post, one channel, ships Thursday.", contextVersion: 0 }),
  T({ role: "product", agentId: "room_demo_product", kind: "message", contextVersion: 0, text: "Brief v1 is up. Named reader: Maya, a solo consultant who skims launch posts for one usable idea. Problem: our last three posts announced features; none gave her a reason to click. Acceptance: she can restate the one idea in a sentence; the post names who it is for in the first two lines; no feature list longer than three items." }),
  T({ role: "engineer", agentId: "room_demo_engineer", kind: "message", contextVersion: 0, text: "Plan, as text: one hero visual (dashboard before/after), 180-word body, CTA to the interactive demo. Risk: the before/after needs a real customer screenshot we may not have by Wednesday. Open question: do we have permission to use the Acme dashboard shot?" }),
  T({ role: "reviewer", agentId: "room_demo_reviewer", kind: "message", contextVersion: 0, text: "Weakest claim in v1: 'she can restate the one idea in a sentence.' We have no way to verify that before Thursday — it is untestable as written. Fix: replace with 'three colleagues unfamiliar with the project can restate the one idea after one read.' That we can check Wednesday." }),
  {
    id: "demo-card", kind: "disagreement_card", contextVersion: 1, createdAt: Date.now(),
    text: "Disagreement card", topic: "What is the post's one idea?",
    card: {
      agreement: ["The post needs exactly one idea, stated early.", "The Acme screenshot permission is the schedule risk."],
      disagreement: ["Product: the one idea is 'dashboards that explain themselves.' Engineer: that is not drawable — the one idea should be 'the before/after'."],
      evidence: [
        { claim: "Maya skims for one usable idea", from: "room_demo_product" },
        { claim: "before/after needs a screenshot we may not have", from: "room_demo_engineer" },
      ],
      options: [
        { id: "A", title: "Lead with the concept", tradeoffs: "Stronger hook; harder visual; copy carries the weight." },
        { id: "B", title: "Lead with the before/after", tradeoffs: "Instantly legible; blocked on screenshot permission." },
      ],
      recommendation: "B, but only if Acme permission lands by Wednesday noon; otherwise A.",
    },
  } as CardMessage,
  T({ role: "owner", agentId: "owner", kind: "decision", contextVersion: 2, text: "Decision: go with B. I will confirm the Acme screenshot permission by Wednesday noon; if it falls through we switch to A with no new meeting." }),
  T({ role: "product", agentId: "room_demo_product", kind: "brief_revision", contextVersion: 2, text: "Brief v2: one idea = the before/after. First two lines name Maya. Acceptance updated: three colleagues restate the idea after one read (check Wednesday). Fallback: option A if permission fails." }),
  T({ kind: "system", text: "Run demo-run completed (turn cap reached). Turns: 9/12. Tokens: 8,410 in / 3,205 out. Brief: v2. Tasks: 2/2 completed. Unresolved disagreements: 0. Suggested next: Owner: confirm Acme screenshot permission by Wednesday noon." }),
];

export default function Demo() {
  const [shown, setShown] = useState(3);
  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <p className="tag inline-block bg-[var(--color-pale-yellow-bg)] text-[var(--color-pale-yellow-tx)] mb-6">
          Synthetic demo · No live models · Read-only replay
        </p>
        <h1 className="serif text-4xl mb-4">What a run looks like</h1>
        <p className="text-sm text-[var(--color-muted)] leading-relaxed mb-8 max-w-2xl">
          This is a prerecorded, scripted replay — every line below was written for the demo,
          no model was called, and nothing here is a live integration. A live room adds
          versioned context, real turn caps, and owner decisions that actually update the brief.
        </p>

        <div className="space-y-4 mb-8">
          {SCRIPT.slice(0, shown).map((m) => (
            <MessageCard key={m.id} m={m} />
          ))}
        </div>

        <div className="flex items-center gap-3">
          {shown < SCRIPT.length ? (
            <button onClick={() => setShown((s) => Math.min(s + 1, SCRIPT.length))} className="btn-primary px-6 py-3 text-sm">
              Next step
            </button>
          ) : (
            <Link href="/admin" className="btn-primary px-6 py-3 text-sm">
              Open the owner console
            </Link>
          )}
          <span className="font-mono text-xs text-[var(--color-muted)]">
            {shown}/{SCRIPT.length}
          </span>
        </div>
      </div>
    </main>
  );
}
