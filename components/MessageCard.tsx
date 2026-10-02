"use client";

export interface CardMessage {
  id: string;
  agentId?: string;
  role?: string;
  kind: string;
  text: string;
  contextVersion?: number;
  status?: string;
  createdAt: number;
  card?: {
    agreement: string[];
    disagreement: string[];
    evidence: { claim: string; from: string }[];
    options: { id: string; title: string; tradeoffs: string }[];
    recommendation: string;
  };
  topic?: string;
  proposedText?: string;
}

const ROLE_TAG: Record<string, string> = {
  product: "bg-[var(--color-pale-blue-bg)] text-[var(--color-pale-blue-tx)]",
  engineer: "bg-[var(--color-pale-green-bg)] text-[var(--color-pale-green-tx)]",
  reviewer: "bg-[var(--color-pale-yellow-bg)] text-[var(--color-pale-yellow-tx)]",
  owner: "bg-[#111111] text-white",
  single: "bg-[var(--color-pale-blue-bg)] text-[var(--color-pale-blue-tx)]",
  system: "bg-[var(--color-bone)] text-[var(--color-muted)]",
};

function RoleTag({ role }: { role?: string }) {
  if (!role) return null;
  return <span className={`tag ${ROLE_TAG[role] ?? ROLE_TAG.system}`}>{role}</span>;
}

function Diff({ diff }: { diff: string }) {
  return (
    <pre className="diff mt-3 p-4 bg-[var(--color-bone)] border border-[var(--color-line)] rounded-md overflow-x-auto">
      {diff.split("\n").map((l, i) => (
        <span key={i} className={l.startsWith("-") ? "del" : l.startsWith("+") ? "add" : ""}>
          {l}
          {"\n"}
        </span>
      ))}
    </pre>
  );
}

export function MessageCard({
  m,
  onChoose,
  diff,
}: {
  m: CardMessage;
  onChoose?: (optionId: string, title: string) => void;
  diff?: string;
}) {
  const time = new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (m.kind === "disagreement_card" && m.card) {
    const c = m.card;
    return (
      <div className="card p-6 rise border-l-4" style={{ borderLeftColor: "#956400" }}>
        <div className="flex items-center justify-between mb-4">
          <span className="tag bg-[var(--color-pale-yellow-bg)] text-[var(--color-pale-yellow-tx)]">disagreement card</span>
          <span className="font-mono text-xs text-[var(--color-muted)]">ctx v{m.contextVersion}</span>
        </div>
        {m.topic && <p className="serif text-xl mb-4">{m.topic}</p>}
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
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-1">Evidence</p>
            <ul className="text-sm space-y-1">
              {c.evidence.map((e, i) => (
                <li key={i} className="text-[var(--color-ink-soft)]">
                  “{e.claim}” <span className="font-mono text-xs text-[var(--color-muted)]">— {e.from}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-2">Options</p>
        <div className="space-y-2 mb-4">
          {c.options.map((o) => (
            <div key={o.id} className="border border-[var(--color-line)] rounded-md p-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">
                  <span className="font-mono mr-2">{o.id}</span>
                  {o.title}
                </p>
                <p className="text-xs text-[var(--color-muted)] mt-1">{o.tradeoffs}</p>
              </div>
              {onChoose && (
                <button onClick={() => onChoose(o.id, o.title)} className="btn-primary text-xs px-4 py-2 shrink-0">
                  Choose
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-sm text-[var(--color-ink-soft)]">
          <span className="font-semibold">Recommendation:</span> {c.recommendation}
        </p>
      </div>
    );
  }

  if (m.kind === "system") {
    return (
      <div className="border border-dashed border-[var(--color-line)] rounded-md p-4 rise">
        <p className="font-mono text-xs text-[var(--color-muted)] leading-relaxed">{m.text}</p>
      </div>
    );
  }

  if (m.kind === "stale_proposal") {
    return (
      <div className="card p-5 rise opacity-80">
        <div className="flex items-center gap-2 mb-2">
          <span className="tag bg-[var(--color-pale-red-bg)] text-[var(--color-pale-red-tx)]">stale proposal</span>
          <RoleTag role={m.role} />
        </div>
        <p className="text-sm text-[var(--color-ink-soft)]">{m.text}</p>
      </div>
    );
  }

  if (m.kind === "brief_revision") {
    return (
      <div className="card p-5 rise">
        <div className="flex items-center gap-2 mb-2">
          <span className="tag bg-[var(--color-pale-green-bg)] text-[var(--color-pale-green-tx)]">brief revised</span>
          <RoleTag role={m.role} />
          <span className="font-mono text-xs text-[var(--color-muted)] ml-auto">{time}</span>
        </div>
        <p className="text-sm whitespace-pre-wrap">{m.text}</p>
        {diff && <Diff diff={diff} />}
      </div>
    );
  }

  return (
    <div className="card p-5 rise">
      <div className="flex items-center gap-2 mb-2">
        <RoleTag role={m.role} />
        {m.agentId && m.role !== "owner" && (
          <span className="font-mono text-xs text-[var(--color-muted)]">{m.agentId}</span>
        )}
        {m.kind !== "message" && (
          <span className="tag bg-[var(--color-bone)] text-[var(--color-muted)]">{m.kind.replace("_", " ")}</span>
        )}
        <span className="font-mono text-xs text-[var(--color-muted)] ml-auto">
          {time} · ctx v{m.contextVersion}
        </span>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--color-ink-soft)]">{m.text}</p>
    </div>
  );
}
