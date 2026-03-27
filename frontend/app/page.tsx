import SplineScene from "@/components/spline-scene"
import Header from "@/components/header"
import RotatingTextAccent from "@/components/rotating-text-accent"
import Footer from "@/components/footer"
import HeroTextOverlay from "@/components/hero-text-overlay"

export default function Home() {
  return (
    <div className="w-full min-h-screen py-0 bg-background">
      <div className="max-w-[1200px] mx-auto">
        <main className="w-full relative h-[600px]">
          <Header />
          <SplineScene />
          <HeroTextOverlay />
          <RotatingTextAccent />
        </main>

        <section
          className="relative rounded-4xl py-7 mx-4 md:mx-0 w-[calc(100%-2rem)] md:w-full bg-card border border-solid border-border pb-20"
          style={{
            backgroundImage: `
              linear-gradient(var(--border) 1px, transparent 1px),
              linear-gradient(90deg, var(--border) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        >
          {/* Decorative plus signs in corners */}
          <div className="absolute top-8 left-8 text-foreground opacity-50 text-5xl font-extralight font-sans leading-[0rem]">
            +
          </div>
          <div className="absolute top-8 right-8 text-foreground opacity-50 text-5xl font-sans leading-[0] font-extralight">
            +
          </div>
          <div className="absolute bottom-8 left-8 text-foreground opacity-50 text-5xl font-sans font-extralight">
            +
          </div>
          <div className="absolute bottom-8 right-8 text-foreground opacity-50 text-5xl font-sans font-extralight">
            +
          </div>

          <div className="px-6 md:px-40">
            <div className="mb-3.5">
              <div className="text-center">
                <svg className="w-48 h-48 md:w-56 md:h-56 mx-auto text-accent opacity-80" fill="none" viewBox="0 0 200 200" stroke="currentColor"><rect x="40" y="40" width="120" height="120" strokeWidth="2"/><circle cx="100" cy="100" r="30" strokeWidth="1.5" opacity="0.5"/></svg>
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
