import { cn } from "@/lib/utils"

const FRETE_CONFIG: Record<string, { label: string; className: string; dot: string }> = {
  NONE:                { label: "Sem frete",        className: "bg-gray-50 text-gray-400 border-gray-200",        dot: "bg-gray-300" },
  AGUARDANDO_DESPACHO: { label: "Aguard. despacho", className: "bg-yellow-50 text-yellow-700 border-yellow-200",  dot: "bg-yellow-400" },
  DESPACHADO:          { label: "Despachado",        className: "bg-blue-50 text-blue-700 border-blue-200",        dot: "bg-blue-500" },
  EM_TRANSITO:         { label: "Em trânsito",       className: "bg-purple-50 text-purple-700 border-purple-200",  dot: "bg-purple-500" },
  ENTREGUE:            { label: "Entregue",          className: "bg-green-50 text-green-700 border-green-200",     dot: "bg-green-500" },
  DEVOLVIDO:           { label: "Devolvido",         className: "bg-red-50 text-red-700 border-red-200",           dot: "bg-red-500" },
  EXTRAVIADO:          { label: "Extraviado",        className: "bg-red-100 text-red-800 border-red-300",          dot: "bg-red-600" },
}

interface FreteStatusBadgeProps {
  freteStatus:      string | null
  rastreio?:        string | null
  link?:            string | null
  transportadora?:  string | null
  previsaoEntrega?: string | null
  compact?:         boolean
}

export function FreteStatusBadge({
  freteStatus, rastreio, link, transportadora, previsaoEntrega, compact = false
}: FreteStatusBadgeProps) {
  const config = FRETE_CONFIG[freteStatus ?? "NONE"] ?? FRETE_CONFIG["NONE"]

  if (compact) {
    if (!freteStatus || freteStatus === "NONE") return null
    return (
      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border", config.className)}>
        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", config.dot)} />
        {config.label}
      </span>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Frete</p>
        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium border", config.className)}>
          <span className={cn("w-2 h-2 rounded-full flex-shrink-0", config.dot)} />
          {config.label}
        </span>
      </div>
      {(transportadora || rastreio || link || previsaoEntrega) && (
        <div className="space-y-1 pl-1">
          {transportadora && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Transportadora:</span> {transportadora}
            </p>
          )}
          {rastreio && (
            <p className="text-xs font-mono text-muted-foreground">
              <span className="font-sans font-medium">Rastreio:</span> {rastreio}
            </p>
          )}
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer"
               className="text-xs text-blue-600 underline">
              Rastrear envio
            </a>
          )}
          {previsaoEntrega && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Previsão:</span>{" "}
              {new Date(previsaoEntrega + "T12:00:00").toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
      )}
    </div>
  )
}