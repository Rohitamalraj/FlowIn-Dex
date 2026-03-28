import { DuelStatus } from "@/lib/duel-types"
import { getStatusLabel } from "@/lib/duel-utils"

interface StatusBadgeProps {
  status: DuelStatus
  size?: "sm" | "md"
}

const statusConfig: Record<DuelStatus, { dot: string; text: string; bg: string; border: string }> = {
  [DuelStatus.OPEN]:       { dot: "bg-emerald-400", text: "text-emerald-300", bg: "bg-emerald-400/10", border: "border-emerald-400/30" },
  [DuelStatus.JOINED]:     { dot: "bg-sky-400",     text: "text-sky-300",     bg: "bg-sky-400/10",     border: "border-sky-400/30"     },
  [DuelStatus.LOCKED]:     { dot: "bg-amber-400",   text: "text-amber-300",   bg: "bg-amber-400/10",   border: "border-amber-400/30"   },
  [DuelStatus.SETTLING]:   { dot: "bg-violet-400",  text: "text-violet-300",  bg: "bg-violet-400/10",  border: "border-violet-400/30"  },
  [DuelStatus.SETTLED]:    { dot: "bg-slate-400",   text: "text-slate-300",   bg: "bg-slate-400/10",   border: "border-slate-400/30"   },
  [DuelStatus.CANCELLED]:  { dot: "bg-red-400",     text: "text-red-300",     bg: "bg-red-400/10",     border: "border-red-400/30"     },
}

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const cfg = statusConfig[status]
  const isAnimated = status === DuelStatus.OPEN || status === DuelStatus.SETTLING

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-mono font-medium ${cfg.bg} ${cfg.border} ${cfg.text} ${
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
      }`}
    >
      <span className={`rounded-full ${cfg.dot} ${size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2"} ${isAnimated ? "animate-pulse" : ""}`} />
      {getStatusLabel(status)}
    </span>
  )
}
