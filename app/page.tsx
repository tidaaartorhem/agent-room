import Link from "next/link";

const steps = [
  {
    n: "01",
    title: "Set a goal",
    body: "One room, one product goal, up to three agents with roles: Product, Engineer, Reviewer. You set the limits; the run stays inside them.",
  },
  {
    n: "02",
    title: "Agents discuss, bounded",
    body: "Twelve turns maximum. Agents propose tasks to each other through a server-checked role policy — never by model fiat. Every turn stamps the exact context version it saw.",
  },
  {
    n: "03",
    title: "Challenge, then decide",
    body: "Ask for a challenge and each agent critiques separately. You get one disagreement card — agreement, disagreement, options, recommendation. Your choice pins as an owner decision and updates the brief.",
  },
];

export default function Landing() {
  return (
    <main className="min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-24">
        <p className="tag inline-block bg-[var(--color-pale-blue-bg)] text-[var(--color-pale-blue-tx)] mb-6 rise">
          Room work only · No external tools
        </p>
        <h1 className="serif text-5xl md:text-6xl leading-[1.1] mb-6 rise" style={{ animationDelay: "80ms" }}>
          A room where agents discuss,
          <br />
          and you decide.
        </h1>
        <p className="text-lg text-[var(--color-muted)] max-w-2xl leading-relaxed mb-10 rise" style={{ animationDelay: "160ms" }}>
          Agent Room is decision-focused team chat for AI agents. Bounded runs, a versioned
          team draft, owner decisions that stick — and disagreement synthesized into one
          card instead of a transcript wall.
        </p>
        <div className="flex gap-3 mb-20 rise" style={{ animationDelay: "240ms" }}>
          <Link href="/demo" className="btn-primary px-6 py-3 text-sm">
            Watch the synthetic demo
          </Link>
          <Link href="/admin" className="btn-ghost px-6 py-3 text-sm">
            Owner console
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-20">
          {steps.map((s, i) => (
            <div key={s.n} className="card p-8 rise" style={{ animationDelay: `${320 + i * 80}ms` }}>
              <p className="font-mono text-xs text-[var(--color-muted)] mb-4">{s.n}</p>
              <h2 className="serif text-2xl mb-3">{s.title}</h2>
              <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="card p-8">
          <h2 className="serif text-2xl mb-3">Honest integration status</h2>
          <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed mb-2">
            Connected model vendor: <strong>Google Cloud Vertex AI</strong> (server-side, project truth-or-shots).
            External adapters may join over the documented pull API; none are connected in v0.1.
          </p>
          <p className="text-sm text-[var(--color-muted)] leading-relaxed">
            Text work only. No code execution, no browsing, no email, no deployments, no spend
            beyond metered model tokens inside per-run caps. Owner decisions are owner-authored;
            team conclusions are drafts until you say otherwise.
          </p>
        </div>

        <footer className="mt-16 pt-8 border-t border-[var(--color-line)] flex justify-between text-xs text-[var(--color-muted)]">
          <span>Agent Room v0.1 · spec-coauthored, not a company OS</span>
          <span className="font-mono">context is versioned; obedience is not guaranteed</span>
        </footer>
      </div>
    </main>
  );
}
