"use client";

import { ChatTask, ChatDecision, ChatMessage, roleMeta, ticketKey } from "./types";

function CardShell({ accent, children, label, labelClass }: {
  accent: string; children: React.ReactNode; label: string; labelClass: string;
}) {
  return (
    <div className="bg-white border border-[var(--color-line)] rounded-lg overflow-hidden my-1">
      <div className="h-[3px]" style={{ background: accent }} />
      <div className="p-4">
        <span className={`tag ${labelClass}`}>{label}</span>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

const TASK_STATE: Record<string, string> = {
  queued: "bg-[var(--color-bone)] text-[var(--color-muted)]",
  accepted: "bg-[var(--color-pale-blue-bg)] text-[var(--color-pale-blue-tx)]",
  working: "bg-[var(--color-pale-yellow-bg)] text-[var(--color-pale-yellow-tx)]",
  waiting: "bg-[var(--color-pale-yellow-bg)] text-[var(--color-pale-yellow-tx)]",
  completed: "bg-[var(--color-pale-green-bg)] text-[var(--color-pale-green-tx)]",
  cancelled: "bg-[var(--color-pale-red-bg)] text-[var(--color-pale-red-tx)]",
  error: "bg-[var(--color-pale-red-bg)] text-[var(--color-pale-red-tx)]",
  timed_out: "bg-[var(--color-pale-red-bg)] text-[var(--color-pale-red-tx)]",
};

export function TicketCard({ task, assigneeName }: { task: ChatTask; assigneeName?: string }) {
  const meta = roleMeta(task.toRole);
  const done = task.state === "completed";
  return (
    <CardShell accent={done ? "#346538" : "#1f6c9f"} label={`ticket · ${task.taskType}`} labelClass="bg-[var(--color-pale-blue-bg)] text-[var(--color-pale-blue-tx)]">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className="font-mono text-xs font-bold text-[var(--color-ink)]">{ticketKey(task.id)}</span>
        <span className={`tag ${TASK_STATE[task.state] ?? TASK_STATE.queued}`}>{task.state.replace("_", " ")}</span>
        <span className="font-mono text-xs text-[var(--color-muted)]">
          → {meta.label}{assigneeName ? ` (${assigneeName})` : ""} · by {task.assignedBy}
        </span>
      </div>
      <p className="text-sm text-[var(--color-ink-soft)]">{task.description}</p>
      {task.result && (
        <div className="mt-2 text-sm border-t border-[var(--color-line)] pt-2">
          <p className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-1">Resolution</p>
          <p className="whitespace-pre-wrap text-[var(--color-ink-soft)]">{task.result}</p>
        </div>
      )}
    </CardShell>
  );
}

export function DecisionCard({ d }: { d: ChatDecision }) {
  return (
    <CardShell accent="#111111" label="owner decision · immutable" labelClass="bg-[#111111] text-white">
      <p className="serif text-lg leading-snug">{d.text}</p>
      {d.scope && <p className="font-mono text-xs text-[var(--color-muted)] mt-1">scope: {d.scope}</p>}
    </CardShell>
  );
}

export function DisagreementCard({ m, onChoose }: {
  m: ChatMessage; onChoose?: (optionId: string, title: string) => void;
}) {
  const c = m.card!;
  return (
    <CardShell accent="#956400" label="disagreement card" labelClass="bg-[var(--color-pale-yellow-bg)] text-[var(--color-pale-yellow-tx)]">
      {m.topic && <p className="serif text-xl mb-3">{m.topic}</p>}
      {c.agreement.length > 0 && (
        <div className="mb-3">
          <p className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-1">Agreement</p>
          <ul className="text-sm list-disc pl-5 space-y-1">{c.agreement.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </div>
      )}
      {c.disagreement.length > 0 && (
        <div className="mb-3">
          <p className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-1">Disagreement</p>
          <ul className="text-sm list-disc pl-5 space-y-1">{c.disagreement.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </div>
      )}
      {c.evidence.length > 0 && (
        <div className="mb-3">
          <p className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-1">Evidence</p>
          <ul className="text-sm space-y-1">
            {c.evidence.map((e, i) => (
              <li key={i} className="text-[var(--color-ink-soft)]">“{e.claim}” <span className="font-mono text-xs text-[var(--color-muted)]">— {e.from}</span></li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-2">Options</p>
      <div className="space-y-2 mb-3">
        {c.options.map((o) => (
          <div key={o.id} className="border border-[var(--color-line)] rounded-md p-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold"><span className="font-mono mr-2">{o.id}</span>{o.title}</p>
              <p className="text-xs text-[var(--color-muted)] mt-1">{o.tradeoffs}</p>
            </div>
            {onChoose && (
              <button onClick={() => onChoose(o.id, o.title)} className="btn-primary text-xs px-4 py-2 shrink-0">Choose</button>
            )}
          </div>
        ))}
      </div>
      <p className="text-sm text-[var(--color-ink-soft)]"><span className="font-semibold">Recommendation:</span> {c.recommendation}</p>
    </CardShell>
  );
}

export function SystemCard({ m }: { m: ChatMessage }) {
  return (
    <div className="my-2 border border-dashed border-[var(--color-line)] rounded-lg px-4 py-3 bg-[var(--color-bone)]">
      <p className="font-mono text-xs text-[var(--color-muted)] leading-relaxed whitespace-pre-wrap">{m.text}</p>
    </div>
  );
}

export function StaleCard({ m }: { m: ChatMessage }) {
  const meta = roleMeta(m.role);
  return (
    <CardShell accent="#9f2f2d" label="proposal not applied" labelClass="bg-[var(--color-pale-red-bg)] text-[var(--color-pale-red-tx)]">
      <p className="text-sm text-[var(--color-ink-soft)]">{m.text}</p>
      {m.proposedText && (
        <p className="text-xs font-mono text-[var(--color-muted)] mt-2 whitespace-pre-wrap">“{m.proposedText.slice(0, 300)}”</p>
      )}
      <p className="font-mono text-xs text-[var(--color-muted)] mt-1">{meta.label} · ctx v{m.contextVersion}</p>
    </CardShell>
  );
}
