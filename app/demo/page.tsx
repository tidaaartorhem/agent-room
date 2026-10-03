"use client";

import { useState } from "react";
import Link from "next/link";
import { RichText } from "@/components/chat/MessageStream";
import { TicketCard, DisagreementCard, SystemCard } from "@/components/chat/RichCards";
import { ChatTask, ChatMessage, fmtTime, roleMeta } from "@/components/chat/types";

const now = Date.now();
const T = (id: string, task: Partial<ChatTask>): ChatTask => ({
  id, assignedBy: "owner", assignedTo: "p1", toRole: "product",
  taskType: "plan", description: "", state: "queued",
  contextVersion: 0, createdAt: now,
  ...task,
} as ChatTask);

const M = (id: string, m: Partial<ChatMessage> & { text: string }): ChatMessage => ({
  id, kind: "message", createdAt: now, ...m,
} as ChatMessage);

type Item =
  | { k: "msg"; m: ChatMessage }
  | { k: "ticket"; t: ChatTask }
  | { k: "disagreement"; m: ChatMessage }
  | { k: "system"; m: ChatMessage };

const SCRIPT: Item[] = [
  { k: "msg", m: M("d1", { role: "owner", agentId: "owner", text: "Goal: plan the Q3 launch post for the analytics dashboard. One post, one channel, ships Thursday." }) },
  {
    k: "ticket", t: T("task_1a2b3c0000000001", {
      toRole: "product", assignedTo: "p1", taskType: "plan", state: "completed",
      description: "Draft the launch post for Maya, a solo consultant who skims for one usable idea. Acceptance: she can restate the one idea in a sentence; the post names who it is for in the first two lines; no feature list longer than three items.",
      result: "Draft delivered: one idea = the before/after. Acceptance updated per review (three colleagues restate after one read).",
    }),
  },
  { k: "msg", m: M("d2", { role: "product", agentId: "room_demo_product", text: "TKT-1A2B3C is drafted. Named reader: Maya. The post's one idea is 'dashboards that explain themselves' — but the only drawable visual is the before/after, so the draft leads with that." }) },
  {
    k: "ticket", t: T("task_4d5e6f0000000002", {
      toRole: "engineer", assignedTo: "p2", taskType: "plan", state: "working",
      description: "Visual plan for the launch post: one hero visual (dashboard before/after), 180-word body, CTA to the interactive demo.",
    }),
  },
  { k: "msg", m: M("d3", { role: "engineer", agentId: "room_demo_engineer", text: "TKT-4D5E6F @reviewer — the before/after needs a real customer screenshot we may not have by Wednesday. Is the plan dead without it, or do we ship a mock?" }) },
  { k: "msg", m: M("d4", { role: "reviewer", agentId: "room_demo_reviewer", text: "TKT-1A2B3C weakest claim: 'she can restate the one idea in a sentence' — untestable before Thursday. Fix: 'three colleagues unfamiliar with the project can restate the one idea after one read.' That we can check Wednesday. On TKT-4D5E6F: a mock is fine if labeled, but the real shot is worth one chase." }) },
  {
    k: "disagreement", m: M("d5", {
      role: "reviewer", agentId: "room_demo_reviewer", kind: "disagreement_card", topic: "What is the post's one idea?",
      text: "Disagreement card",
      card: {
        agreement: ["The post needs exactly one idea, stated early.", "The screenshot permission is the schedule risk."],
        disagreement: ["Product: the one idea is 'dashboards that explain themselves.' Engineer: that is not drawable — the one idea should be 'the before/after'."],
        evidence: [
          { claim: "Maya skims for one usable idea", from: "room_demo_product" },
          { claim: "before/after needs a screenshot we may not have", from: "room_demo_engineer" },
        ],
        options: [
          { id: "A", title: "Lead with the concept", tradeoffs: "Stronger hook; harder visual; copy carries the weight." },
          { id: "B", title: "Lead with the before/after", tradeoffs: "Instantly legible; blocked on screenshot permission." },
        ],
        recommendation: "B, but only if the permission lands by Wednesday noon; otherwise A.",
      },
    }),
  },
  { k: "msg", m: M("d6", { role: "owner", agentId: "owner", kind: "decision", text: "Decision: go with B. I will confirm the screenshot permission by Wednesday noon; if it falls through we switch to A with no new meeting." }) },
  { k: "system", m: M("d7", { kind: "system", text: "Run demo-run completed (turn cap reached). Turns: 9/12. Tokens: 8,410 in / 3,205 out. Tickets: 1/2 resolved. Unresolved disagreements: 0. Suggested next: Owner: confirm screenshot permission by Wednesday noon." }) },
];

function DemoRow({ m }: { m: ChatMessage }) {
  const meta = roleMeta(m.role);
  const isOwner = m.role === "owner" || m.agentId === "owner";
  return (
    <div className="flex gap-3">
      <div className={`w-9 h-9 rounded-full ${meta.avatar} flex items-center justify-center text-sm font-bold shrink-0`}>
        {meta.name}
      </div>
      <div className="min-w-0">
        <p className="text-sm">
          <span className="font-bold">{isOwner ? "You" : meta.label}</span>
          <span className="font-mono text-xs text-[var(--color-muted)] ml-2">{fmtTime(m.createdAt)}</span>
        </p>
        <p className="text-[15px] leading-relaxed text-[var(--color-ink-soft)] whitespace-pre-wrap break-words mt-0.5">
          <RichText text={m.text} />
        </p>
      </div>
    </div>
  );
}

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
          no model was called, and nothing here is a live integration. In a live room, agents
          discuss Jira-style tickets: they get assigned, tag tickets and each other with
          questions, and resolutions land as ticket updates.
        </p>

        <div className="space-y-4 mb-8">
          {SCRIPT.slice(0, shown).map((it, i) => {
            if (it.k === "msg") return <DemoRow key={i} m={it.m} />;
            if (it.k === "ticket") return <div key={i} className="pl-12"><TicketCard task={it.t} /></div>;
            if (it.k === "disagreement") return <DisagreementCard key={i} m={it.m} onChoose={() => {}} />;
            return <SystemCard key={i} m={it.m} />;
          })}
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
