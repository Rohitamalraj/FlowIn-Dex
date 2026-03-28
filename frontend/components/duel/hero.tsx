import Link from "next/link"
import { ChevronRight } from "lucide-react"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface HeroProps {
  breadcrumbs?: BreadcrumbItem[]
  title: string
  subtitle?: string
  badge?: string
}

export default function Hero({ breadcrumbs, title, subtitle, badge }: HeroProps) {
  return (
    <div className="border-b border-border bg-card/50 px-6 py-10">
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 mb-4 font-mono text-xs text-muted-foreground">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-foreground transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="space-y-2">
        {badge && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-0.5 font-mono text-xs text-primary mb-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            {badge}
          </span>
        )}
        <h1
          className="text-2xl md:text-3xl font-bold text-foreground"
          style={{ fontFamily: "var(--font-montserrat)" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="font-mono text-sm text-muted-foreground max-w-2xl">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
