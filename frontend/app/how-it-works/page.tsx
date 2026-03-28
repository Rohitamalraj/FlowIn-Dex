import AppShell from "@/components/duel/app-shell"
import Hero from "@/components/duel/hero"
import Link from "next/link"
import { Lock, Eye, Shield, Database, Cpu, Key, ArrowRight, ChevronDown } from "lucide-react"

const LIFECYCLE_STEPS = [
  {
    icon: "📤",
    title: "Create the Duel",
    detail: "The duel creator picks a duration, entry amount, and an asset universe (e.g. BTC, ETH, SOL). These parameters are public — only strategy details stay private.",
  },
  {
    icon: "🔒",
    title: "Build & Encrypt Strategy",
    detail: "Both players construct their portfolio allocation using sliders. Weights are converted to basis points and encrypted client-side using the fhEVM Relayer SDK before any network call.",
  },
  {
    icon: "⛓️",
    title: "Submit Encrypted Weights",
    detail: "Encrypted weight ciphertexts are submitted to the ShieldVault smart contract on Zama's fhEVM. The contract stores euint32 values — no plaintext ever touches the chain.",
  },
  {
    icon: "📈",
    title: "Evaluation Window",
    detail: "A price oracle snapshots the start and end prices for all assets in the universe. These values feed into the encrypted PnL computation.",
  },
  {
    icon: "⚙️",
    title: "Encrypted Settlement",
    detail: "The contract computes weighted returns and compares PnL values entirely on ciphertext using FHE arithmetic. The winner flag is generated without revealing underlying allocations.",
  },
  {
    icon: "🏆",
    title: "Selective Reveal",
    detail: "The Zama KMS service decrypts only the final winner output. Individual strategy traces, per-asset weights, and raw returns are never decrypted. Only what must be known is disclosed.",
  },
]

const TECH_ITEMS = [
  { icon: Lock,     label: "euint32 Weight Storage",  desc: "All on-chain portfolio state stored as encrypted integers." },
  { icon: Cpu,      label: "fhEVM Coprocessor",        desc: "Complex FHE computations delegated off-chain and verified on return." },
  { icon: Key,      label: "KMS Threshold MPC",        desc: "Decryption keys shared across nodes; no single point of failure." },
  { icon: Shield,   label: "ACL Permissions",          desc: "Granular access controls govern which outputs can be decrypted." },
  { icon: Database, label: "Relayer SDK",               desc: "Client-side encryption so sensitive data never leaves the browser in plaintext." },
  { icon: Eye,      label: "Minimal Reveal Surface",   desc: "Settlement reveals only winner flag, not allocations or partial results." },
]

const FAQ = [
  {
    q: "Can the smart contract see my portfolio weights?",
    a: "No. Weights are stored as euint ciphertexts. The contract can perform arithmetic on them using FHE operators, but readable values are never written to chain.",
  },
  {
    q: "What exactly gets revealed at settlement?",
    a: "Only the winner's wallet address and an optional aggregate score delta are decrypted. The per-asset allocations, individual returns, and any intermediate computation remain encrypted.",
  },
  {
    q: "How is the winner determined if everything is encrypted?",
    a: "The fhEVM contract computes an encrypted comparison of the two players' weighted PnL. The result is a single encrypted boolean that the KMS then decrypts under the settlement ACL.",
  },
  {
    q: "Can I verify that computation was done correctly?",
    a: "Yes. The coprocessor returns a cryptographic proof along with its result, which the contract verifies on-chain before accepting the settlement outcome.",
  },
  {
    q: "Is the current frontend connected to a live contract?",
    a: "Not yet — the contract integration is in progress. All data shown is mock data structured to match the expected API shape.",
  },
]

export default function HowItWorksPage() {
  return (
    <AppShell>
      <Hero
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "How It Works" }]}
        title="How ShieldVault Works"
        subtitle="A step-by-step guide to confidential portfolio competition on Zama fhEVM."
        badge="Architecture"
      />

      <div className="max-w-[900px] mx-auto px-6 py-12 space-y-16">

        {/* Lifecycle Steps */}
        <section>
          <h2 className="font-bold text-foreground text-xl mb-8" style={{ fontFamily: "var(--font-montserrat)" }}>
            The Duel Lifecycle
          </h2>
          <div className="relative">
            {/* Vertical connector */}
            <div className="absolute left-7 top-8 bottom-8 w-px bg-border hidden sm:block" />
            <div className="space-y-4">
              {LIFECYCLE_STEPS.map((step, i) => (
                <div key={i} className="relative flex gap-5">
                  <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-2xl">
                    {step.icon}
                  </div>
                  <div className="flex-1 pb-2 pt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] text-primary font-semibold">Step {String(i + 1).padStart(2, "0")}</span>
                    </div>
                    <h3 className="font-mono font-semibold text-foreground text-sm mb-1">{step.title}</h3>
                    <p className="font-mono text-xs text-muted-foreground leading-relaxed">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tech Stack */}
        <section>
          <h2 className="font-bold text-foreground text-xl mb-2" style={{ fontFamily: "var(--font-montserrat)" }}>
            Technical Components
          </h2>
          <p className="font-mono text-sm text-muted-foreground mb-8">
            The privacy guarantees are built across multiple layers of the stack.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {TECH_ITEMS.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="rounded-2xl border border-border bg-card p-5 flex gap-4 hover:border-primary/30 transition-all duration-200 group"
              >
                <div className="h-9 w-9 shrink-0 rounded-xl border border-primary/20 bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-mono text-sm font-semibold text-foreground mb-1">{label}</p>
                  <p className="font-mono text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Privacy Guarantees */}
        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-8">
          <h2 className="font-bold text-foreground text-xl mb-6" style={{ fontFamily: "var(--font-montserrat)" }}>
            Privacy Guarantees
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { label: "Strategy weights",             encrypted: true  },
              { label: "Per-asset allocations",        encrypted: true  },
              { label: "Intermediate PnL values",      encrypted: true  },
              { label: "Winner wallet address",        encrypted: false },
              { label: "Aggregate score delta",        encrypted: false },
              { label: "Duel parameters (duration etc.)", encrypted: false },
            ].map(({ label, encrypted }) => (
              <div key={label} className="flex items-center justify-between border-b border-border/50 pb-3">
                <span className="font-mono text-xs text-muted-foreground">{label}</span>
                <span className={`font-mono text-xs rounded-full px-2 py-0.5 border ${
                  encrypted
                    ? "border-amber-400/30 bg-amber-400/10 text-amber-400"
                    : "border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
                }`}>
                  {encrypted ? "🔒 Private" : "👁 Public"}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="font-bold text-foreground text-xl mb-8" style={{ fontFamily: "var(--font-montserrat)" }}>
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {FAQ.map(({ q, a }, i) => (
              <details key={i} className="group rounded-2xl border border-border bg-card overflow-hidden">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-mono text-sm text-foreground font-medium list-none">
                  {q}
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180 shrink-0 ml-4" />
                </summary>
                <div className="px-5 pb-4 pt-0">
                  <p className="font-mono text-xs text-muted-foreground leading-relaxed">{a}</p>
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <h2 className="font-bold text-foreground text-xl mb-3" style={{ fontFamily: "var(--font-montserrat)" }}>
            Ready to Compete?
          </h2>
          <p className="font-mono text-sm text-muted-foreground mb-6">Your strategy. Your privacy. Your win.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/create-duel"
              className="rounded-full bg-primary text-primary-foreground font-mono font-semibold px-8 py-3 hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)] hover:scale-105 transition-all duration-200 flex items-center justify-center gap-2"
            >
              Create a Duel <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/join-duel"
              className="rounded-full border border-border text-foreground font-mono font-semibold px-8 py-3 hover:border-primary/40 transition-all duration-200"
            >
              Browse Duels
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
