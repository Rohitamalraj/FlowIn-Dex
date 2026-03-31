"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { ArrowUpRight, PlusCircle, Swords, LayoutDashboard, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

const NAV_LINKS = [
  { href: "/how-it-works", label: "How It Works" },
  { href: "/join-duel",   label: "Browse Duels"  },
  { href: "/my-duels",    label: "My Duels"       },
]

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/0 backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary text-xl">⬡</span>
            <span className="font-mono font-bold text-foreground text-sm hidden sm:block">FlowIn-Dex</span>
          </Link>
        </div>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="font-mono text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full hover:bg-muted/30 transition-all duration-200"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/create-duel">
            <Button
              className="bg-primary text-primary-foreground rounded-full px-5 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_hsl(var(--primary)/0.5)] font-mono text-xs"
              style={{ paddingLeft: "20px", paddingRight: "14px" }}
            >
              Launch App <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
}
