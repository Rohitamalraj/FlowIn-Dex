import { CheckCircle2, Circle, Loader2 } from "lucide-react"
import { DuelStatus } from "@/lib/duel-types"

const STEPS: { status: DuelStatus; label: string; desc: string }[] = [
  { status: DuelStatus.OPEN,      label: "Duel Created",     desc: "Creator set parameters & submitted encrypted allocation" },
  { status: DuelStatus.JOINED,    label: "Opponent Joined",  desc: "Challenger joined & submitted encrypted allocation"       },
  { status: DuelStatus.LOCKED,    label: "Locked",           desc: "Strategies immutable; evaluation window started"          },
  { status: DuelStatus.SETTLING,  label: "Settling",         desc: "Encrypted PnL computation running on fhEVM"               },
  { status: DuelStatus.SETTLED,   label: "Settled",          desc: "Winner revealed; individual strategies remain private"    },
]

const statusOrder: Record<DuelStatus, number> = {
  [DuelStatus.OPEN]:      0,
  [DuelStatus.JOINED]:    1,
  [DuelStatus.LOCKED]:    2,
  [DuelStatus.SETTLING]:  3,
  [DuelStatus.SETTLED]:   4,
  [DuelStatus.CANCELLED]: -1,
}

interface TimelineProps {
  currentStatus: DuelStatus
}

export default function Timeline({ currentStatus }: TimelineProps) {
  const currentIndex = statusOrder[currentStatus] ?? -1

  if (currentStatus === DuelStatus.CANCELLED) {
    return (
      <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-center">
        <p className="font-mono text-sm text-red-400">Duel Cancelled</p>
        <p className="font-mono text-xs text-muted-foreground mt-1">No opponent joined before timeout.</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-4 bottom-4 w-px bg-border" />

      <div className="space-y-6">
        {STEPS.map((step, i) => {
          const isDone    = i < currentIndex
          const isCurrent = i === currentIndex
          const isPending = i > currentIndex

          return (
            <div key={step.status} className="relative flex items-start gap-4 pl-2">
              {/* Icon */}
              <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
                isDone    ? "border-primary bg-primary/20 text-primary" :
                isCurrent ? "border-primary/60 bg-primary/10 text-primary" :
                            "border-border bg-card text-muted-foreground"
              }`}>
                {isDone    ? <CheckCircle2 className="h-4 w-4" /> :
                 isCurrent ? <Loader2 className="h-4 w-4 animate-spin" /> :
                             <Circle className="h-4 w-4" />}
              </div>

              {/* Content */}
              <div className={`pt-1 ${isPending ? "opacity-40" : ""}`}>
                <p className={`font-mono text-sm font-semibold ${isCurrent ? "text-primary" : isDone ? "text-foreground" : "text-muted-foreground"}`}>
                  {step.label}
                </p>
                <p className="font-mono text-xs text-muted-foreground mt-0.5">{step.desc}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
