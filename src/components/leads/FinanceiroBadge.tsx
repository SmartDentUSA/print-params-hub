import { cn } from "@/lib/utils"

interface FinanceiroBadgeProps {
  parcelasVencidas:  number
  parcelasPendentes: number
  proximoVencimento: string | null
}

export function FinanceiroBadge({ parcelasVencidas, parcelasPendentes, proximoVencimento }: FinanceiroBadgeProps) {
  if (parcelasVencidas === 0 && parcelasPendentes === 0 && !proximoVencimento) return null

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
}