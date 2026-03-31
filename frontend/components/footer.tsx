import Image from "next/image"

export default function Footer() {
  return (
    <footer className="w-full px-6 relative py-[0] mt-28 h-auto mb-0 bg-card">
      {/* Decorative elements - replaced text-green-400 with semantic accent token */}
      <div className="absolute top-8 right-6 text-accent text-2xl">+</div>
      <div className="absolute top-1/2 right-12 text-accent text-lg transform -translate-y-1/2">✦</div>
      <div className="absolute bottom-12 right-20 text-accent text-xl">+</div>
      <div className="absolute top-16 right-32 text-accent text-sm">✦</div>
      <div className="absolute bottom-8 right-8 text-accent text-lg">✦</div>

      <div className="max-w-[1200px] mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between">
          {/* Left content */}
          <div className="flex-1 max-w-lg mt-8">
            <h2
              className="text-foreground text-4xl md:text-5xl mb-8 leading-[3.5rem] md:leading-[4rem] font-semibold text-center md:text-left mt-0"
              style={{ fontFamily: "var(--font-montserrat)" }}
            >
              Privacy by Default.
            </h2>

            <div className="space-y-4 text-foreground">
              <div className="flex items-start gap-3">
                <span className="text-accent mt-1">•</span>
                <p className="text-sm">FlowIn-Dex keeps your portfolio strategies encrypted at all times—before, during, and after settlement.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-accent mt-1">•</span>
                <p className="text-sm">Compete with confidence. Only the winner is revealed. Your alpha stays yours.</p>
              </div>
            </div>
          </div>

          <div className="hidden md:flex flex-1 justify-end items-center relative">
            <div className="relative">
              <svg className="w-96 h-72 text-accent opacity-40" fill="currentColor" viewBox="0 0 200 200">
                <circle cx="100" cy="80" r="30" opacity="0.8"/>
                <rect x="60" y="130" width="80" height="60" rx="10" opacity="0.6"/>
                <circle cx="80" cy="160" r="8"/>
                <circle cx="120" cy="160" r="8"/>
              </svg>
            </div>
          </div>
        </div>

        <div className="md:hidden flex justify-center mt-12">
          <div className="relative">
            <svg className="w-80 h-64 text-accent opacity-40" fill="currentColor" viewBox="0 0 200 200">
              <circle cx="100" cy="80" r="30" opacity="0.8"/>
              <rect x="60" y="130" width="80" height="60" rx="10" opacity="0.6"/>
              <circle cx="80" cy="160" r="8"/>
              <circle cx="120" cy="160" r="8"/>
            </svg>
          </div>
        </div>

        <div className="w-full px-6 py-16 flex flex-col md:flex-row items-center justify-center md:justify-between gap-6 md:gap-0 border-t border-border mt-16">
          <div className="flex flex-col md:flex-row gap-2 text-center md:text-left">
            <h2 className="text-foreground font-mono text-xl font-bold">Ready to Compete?</h2>
            <p className="text-foreground font-mono font-normal text-base">Keep Your Strategies Private</p>
          </div>

          <a href="https://github.com/flowin-dex" target="_blank" rel="noopener noreferrer">
            <button className="bg-primary text-primary-foreground px-8 py-4 rounded-full font-semibold text-lg whitespace-nowrap hover:scale-105 hover:shadow-[0_0_20px_hsl(var(--primary)/0.5)] transition-all duration-300 font-mono flex items-center gap-2">
              Build on FlowIn-Dex
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 7h10v10M7 17L17 7" />
              </svg>
            </button>
          </a>
        </div>

        <div className="w-full px-6 py-4 border-t border-border flex md:flex-row items-center justify-between gap-2 flex-row">
          <p className="text-muted-foreground text-sm font-mono">© 2026 FlowIn-Dex | PL_Genesis Hackathon</p>
          <p className="text-muted-foreground text-sm font-mono">Confidential Finance on fhEVM</p>
        </div>
      </div>
    </footer>
  )
}
