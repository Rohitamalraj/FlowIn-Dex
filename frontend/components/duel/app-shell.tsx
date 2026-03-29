"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { Home, PlusCircle, Swords, LayoutDashboard, HelpCircle } from "lucide-react"

const NAV_ITEMS = [
  { href: "/",             label: "Home",         icon: Home         },
  { href: "/create-duel", label: "Create Duel",  icon: PlusCircle   },
  { href: "/join-duel",   label: "Browse Duels", icon: Swords       },
  { href: "/my-duels",    label: "My Duels",     icon: LayoutDashboard },
  { href: "/how-it-works",label: "How It Works", icon: HelpCircle   },
]

interface AppShellProps {
  children: React.ReactNode
}

/** SSR-safe wallet connect button that avoids hydration mismatch */
function WalletButton() {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => { setMounted(true) }, [])
  if (!mounted) return <div className="h-8 w-28 rounded-full border border-border bg-muted/30 animate-pulse" />
  return (
    <ConnectButton
      chainStatus="icon"
      showBalance={false}
      accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
    />
  )
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between px-6 h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-mono font-bold text-foreground hover:text-primary transition-colors">
            <span className="text-primary text-lg">⬡</span>
            <span className="text-sm">ShieldVault</span>
          </Link>

          {/* Nav links – hidden on mobile */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.slice(1).map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/")
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-xs transition-all duration-200 ${
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              )
            })}
          </div>

          {/* Right: Wallet connect + New Duel */}
          <div className="flex items-center gap-2">
            <WalletButton />
            <Link
              href="/create-duel"
              className="hidden sm:flex rounded-full bg-primary text-primary-foreground font-mono text-xs font-semibold px-4 py-2 hover:shadow-[0_0_12px_hsl(var(--primary)/0.4)] transition-all duration-200"
            >
              + New Duel
            </Link>
          </div>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-background/90 backdrop-blur-sm">
        <div className="flex items-center justify-around px-2 py-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/")
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-mono text-[9px]">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Page content */}
      <main className="pt-14 pb-20 md:pb-0">
        {children}
      </main>
    </div>
  )
}
