import { cn } from "@/lib/utils"

interface FinanceiroBadgeProps {
  parcelasVencidas:  number
  parcelasPendentes: number
  proximoVencimento: string | null
  omieScore?:        number
  omieScoreLabel?:   string | null
}

const SCORE_CONFIG: Record<string, { className: string; dot: string }> = {
  PREMIUM:      { className: "bg-green-50 text-green-700 border-green-200",   dot: "bg-green-500" },
  ATIVO:        { className: "bg-blue-50 text-blue-700 border-blue-200",      dot: "bg-blue-500" },
  OPORTUNIDADE: { className: "bg-yellow-50 text-yellow-700 border-yellow-200",dot: "bg-yellow-500" },
  RISCO:        { className: "bg-red-50 text-red-700 border-red-200",         dot: "bg-red-500" },
}

export function FinanceiroBadge({
  parcelasVencidas, parcelasPendentes, proximoVencimento,
  omieScore, omieScoreLabel
}: FinanceiroBadgeProps) {
  const sc = SCORE_CONFIG[omieScoreLabel ?? ""]
  const showScore = sc && (omieScore ?? 0) > 0

  const statusBadge = (() => {
    if (parcelasVencidas > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border bg-red-50 text-red-700 border-red-200">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
          {parcelasVencidas} vencida{parcelasVencidas !== 1 ? "s" : ""}
        </span>
      )
    }
    if (proximoVencimento) {
      const dias = Math.floor(
        (new Date(proximoVencimento + "T12:00:00").getTime() - Date.now()) / 86_400_000
      )
      const urgente = dias <= 7
      return (
        <span className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border",
          urgente ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-gray-50 text-gray-500 border-gray-200"
        )}>
          <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0",
            urgente ? "bg-yellow-500" : "bg-gray-400")} />
          {dias <= 0 ? "hoje" : `${dias}d`}
        </span>
      )
    }
    return null
  })()

  const scoreBadge = showScore ? (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border",
      sc.className
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", sc.dot)} />
      {omieScoreLabel} {omieScore}
    </span>
  ) : null

  if (!statusBadge && !scoreBadge) return null

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {statusBadge}
      {scoreBadge}
    </div>
  )
}
