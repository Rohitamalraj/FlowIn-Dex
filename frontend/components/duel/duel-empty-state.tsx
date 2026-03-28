import Link from "next/link"
import { Swords } from "lucide-react"

interface DuelEmptyStateProps {
  title?: string
  description?: string
  cta?: { label: string; href: string }
}

export default function DuelEmptyState({
  title = "No Duels Found",
  description = "There are no duels matching your criteria right now.",
  cta,
}: DuelEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
      <div className="rounded-full bg-muted/40 border border-border p-5">
        <Swords className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="font-mono font-semibold text-foreground text-base">{title}</p>
        <p className="font-mono text-sm text-muted-foreground max-w-xs">{description}</p>
      </div>
      {cta && (
        <Link
          href={cta.href}
          className="mt-2 rounded-full bg-primary text-primary-foreground font-mono text-sm font-semibold px-6 py-2.5 hover:shadow-[0_0_16px_hsl(var(--primary)/0.4)] hover:scale-[1.02] transition-all duration-200"
        >
          {cta.label}
        </Link>
      )}
    </div>
  )
}
