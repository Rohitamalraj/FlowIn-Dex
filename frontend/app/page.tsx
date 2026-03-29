import SplineScene from "@/components/spline-scene"
import Header from "@/components/header"
import RotatingTextAccent from "@/components/rotating-text-accent"
import Footer from "@/components/footer"
import HeroTextOverlay from "@/components/hero-text-overlay"
import Link from "next/link"
import { ArrowUpRight, Lock, Shield, Eye, Zap, Users, TrendingUp } from "lucide-react"

const STATS = [
  { label: "Total Duels",    value: "1,284",     icon: "⬡" },
  { label: "Total Volume",   value: "348 ETH",   icon: "◈" },
  { label: "Strategies",     value: "100% Encrypted", icon: "🔒" },
  { label: "Active Duels",   value: "47",        icon: "⚔" },
]

const HOW_IT_WORKS = [
  { step: "01", title: "Create Duel",           desc: "Set duration, entry amount, and allowed asset universe." },
  { step: "02", title: "Build Your Index",       desc: "Allocate weights across assets using our slider builder." },
  { step: "03", title: "Encrypt & Submit",       desc: "Your strategy is encrypted client-side. Zero plaintext leakage." },
  { step: "04", title: "Evaluation Window",      desc: "Oracle snapshots measure real market movements." },
  { step: "05", title: "Encrypted Settlement",   desc: "fhEVM computes winner on ciphertext — no strategy revealed." },
  { step: "06", title: "Winner Reveal",          desc: "Only the final result is disclosed. Alpha stays yours." },
]

const FEATURES = [
  {
    icon: Lock,
    title: "Encrypted Strategies",
    desc: "Portfolio weights are stored as encrypted integers (euint) on Zama fhEVM. Never visible on-chain in plaintext.",
  },
  {
    icon: Eye,
    title: "Selective Reveal",
    desc: "At settlement, only the winner flag is decrypted via KMS. Your full allocation remains confidential forever.",
  },
  {
    icon: Shield,
    title: "Compliance-Aware Privacy",
    desc: "ACL-governed decryption allows auditor roles without exposing strategy details. Privacy with accountability.",
  },
]

export default function Home() {

  return (
    <div className="w-full min-h-screen py-0 bg-background">
      <div className="max-w-[1200px] mx-auto">
        {/* Hero with Spline */}
        <main className="w-full relative h-[600px]">
          <Header />
          <SplineScene />
          <HeroTextOverlay />
          <RotatingTextAccent />
        </main>

        {/* CTA Buttons */}
        <section className="flex flex-col sm:flex-row items-center justify-center gap-3 py-10 px-6">
          <Link
            href="/create-duel"
            className="rounded-full bg-primary text-primary-foreground font-mono font-semibold px-8 py-3.5 text-sm hover:shadow-[0_0_24px_hsl(var(--primary)/0.5)] hover:scale-105 transition-all duration-300 flex items-center gap-2"
          >
            Create a Duel <ArrowUpRight className="h-4 w-4" />
          </Link>
          <Link
            href="/join-duel"
            className="rounded-full border border-border text-foreground font-mono font-semibold px-8 py-3.5 text-sm hover:border-primary/50 hover:bg-muted/30 transition-all duration-300"
          >
            Browse Open Duels
          </Link>
        </section>

        {/* Stats Bar */}
        <section className="mx-4 md:mx-0 mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-border bg-card px-5 py-4 flex flex-col gap-1"
              >
                <span className="text-2xl">{stat.icon}</span>
                <span className="font-mono text-xl font-bold text-foreground">{stat.value}</span>
                <span className="font-mono text-xs text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section
          className="relative rounded-4xl py-12 mx-4 md:mx-0 mb-8 bg-card border border-border"
          style={{
            backgroundImage: `
              linear-gradient(var(--border) 1px, transparent 1px),
              linear-gradient(90deg, var(--border) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        >
          <div className="absolute top-8 left-8 text-foreground opacity-30 text-5xl font-extralight leading-[0]">+</div>
          <div className="absolute top-8 right-8 text-foreground opacity-30 text-5xl font-extralight leading-[0]">+</div>
          <div className="absolute bottom-8 left-8 text-foreground opacity-30 text-5xl font-extralight">+</div>
          <div className="absolute bottom-8 right-8 text-foreground opacity-30 text-5xl font-extralight">+</div>

          <div className="px-8 md:px-16">
            <div className="text-center mb-10">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs text-primary mb-4">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Duel Lifecycle
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground" style={{ fontFamily: "var(--font-montserrat)" }}>
                How ShieldVault Works
              </h2>
              <p className="font-mono text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
                Six steps from strategy creation to winner reveal — all encrypted by default.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {HOW_IT_WORKS.map((item) => (
                <div
                  key={item.step}
                  className="rounded-2xl bg-background/70 border border-border p-5 hover:border-primary/30 transition-all duration-200"
                >
                  <div className="font-mono text-3xl font-bold text-primary/30 mb-3 leading-none">{item.step}</div>
                  <h3 className="font-mono font-semibold text-foreground text-sm mb-1">{item.title}</h3>
                  <p className="font-mono text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-4 md:mx-0 mb-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground" style={{ fontFamily: "var(--font-montserrat)" }}>
              Privacy by Architecture
            </h2>
            <p className="font-mono text-sm text-muted-foreground mt-2">
              Not bolted on — built into every layer of the protocol.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FEATURES.map((feat) => (
              <div
                key={feat.title}
                className="rounded-2xl border border-border bg-card p-6 hover:border-primary/30 hover:shadow-[0_0_24px_hsl(var(--primary)/0.05)] transition-all duration-300 group"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feat.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-mono font-semibold text-foreground text-sm mb-2">{feat.title}</h3>
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* About Section */}
        <section
          className="relative rounded-4xl py-7 mx-4 md:mx-0 mb-8 w-[calc(100%-2rem)] md:w-full bg-card border border-solid border-border pb-20"
          style={{
            backgroundImage: `
              linear-gradient(var(--border) 1px, transparent 1px),
              linear-gradient(90deg, var(--border) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        >
          <div className="absolute top-8 left-8 text-foreground opacity-50 text-5xl font-extralight font-sans leading-[0rem]">+</div>
          <div className="absolute top-8 right-8 text-foreground opacity-50 text-5xl font-sans leading-[0] font-extralight">+</div>
          <div className="absolute bottom-8 left-8 text-foreground opacity-50 text-5xl font-sans font-extralight">+</div>
          <div className="absolute bottom-8 right-8 text-foreground opacity-50 text-5xl font-sans font-extralight">+</div>

          <div className="px-6 md:px-40">
            <div className="mb-3.5">
              <div className="text-center">
                <svg className="w-48 h-48 md:w-56 md:h-56 mx-auto text-accent opacity-80" fill="none" viewBox="0 0 200 200" stroke="currentColor">
                  <rect x="40" y="40" width="120" height="120" strokeWidth="2"/>
                  <circle cx="100" cy="100" r="30" strokeWidth="1.5" opacity="0.5"/>
                </svg>
              </div>
            </div>
            <div className="flex flex-col gap-4 max-w-5xl">
              <div className="flex items-center gap-4">
                <span className="text-accent font-mono text-sm">Platform</span>
                <span className="text-foreground font-mono text-sm">ShieldVault</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-accent font-mono text-sm">Purpose</span>
                <span className="text-foreground font-mono text-sm">Confidential Portfolio Competition on fhEVM</span>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-accent font-mono text-sm">Core Features</span>
                <span className="text-foreground font-mono text-sm">
                  Encrypted weight storage • Confidential P&L computation • Selective winner reveal • Zero strategy leakage
                </span>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-accent font-mono text-sm">Tech Stack</span>
                <span className="text-foreground font-mono text-sm">
                  Zama fhEVM • Fully Homomorphic Encryption • Solidity • Next.js Frontend
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  )
}
