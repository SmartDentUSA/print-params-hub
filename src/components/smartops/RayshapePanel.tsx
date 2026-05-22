// RayshapePanel.tsx
// Aba "Rayshape" no SmartOps — abaixo do Copilot
// Mostra status de recompra em tempo real via Supabase Realtime
//
// INTEGRAÇÃO:
//   1. Aplique a migration SQL no Supabase (migration_rayshape_status.sql)
//   2. Cole este arquivo em src/components/smartops/ (ou onde estão os outros painéis)
//   3. No LeadDetailPanel.tsx, adicione a aba:
//        import { RayshapePanel } from './RayshapePanel'
//        // Na lista de tabs, após o copilot:
//        { id: 'rayshape', label: '🖨 Rayshape', icon: PrinterIcon }
//        // No conteúdo da tab:
//        case 'rayshape': return <RayshapePanel leadId={lead.id} />

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'

// ── Tipos ─────────────────────────────────────────────────────────────────

interface PostPurchase {
  deal_id: string
  date: string          // 'DD/MM/YYYY'
  date_iso: string      // 'YYYY-MM-DD'
  days_after: number
  value: number
  vendor: string
  items: { name: string; qty: number; value: number }[] | null
}

interface RayshapeStatus {
  has_printer: false
} | {
  has_printer: true
  printer_date: string
  printer_date_iso: string
  printer_price: number
  printer_qty: number
  printer_deal_id: string
  vendor: string
  days_since: number
  n_post: number
  total_post: number
  first_repurchase_days: number | null
  category: 'recomprou' | 'critico' | 'atencao' | 'cedo'
  post_purchases: PostPurchase[]
}

// ── Helpers ───────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const CATEGORY_CONFIG = {
  recomprou: {
    color: '#00e5c3',
    bg: 'rgba(0,229,195,0.08)',
    border: 'rgba(0,229,195,0.25)',
    label: 'Recomprou ✅',
    icon: '✅',
  },
  critico: {
    color: '#f87171',
    bg: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.25)',
    label: '🔴 Crítico — sem recompra',
    icon: '🔴',
  },
  atencao: {
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.25)',
    label: '🟡 Atenção — monitorar',
    icon: '🟡',
  },
  cedo: {
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.06)',
    border: 'rgba(148,163,184,0.15)',
    label: '⚪ Cedo demais',
    icon: '⚪',
  },
} as const

function DaysBadge({ days }: { days: number }) {
  const [color, bg, border] =
    days <= 14
      ? ['#00e5c3', 'rgba(0,229,195,0.1)', 'rgba(0,229,195,0.3)']
      : days <= 60
      ? ['#f59e0b', 'rgba(245,158,11,0.1)', 'rgba(245,158,11,0.3)']
      : ['#f87171', 'rgba(248,113,113,0.1)', 'rgba(248,113,113,0.3)']

  return (
    <span style={{
      fontFamily: 'monospace',
      fontSize: 11,
      padding: '2px 8px',
      borderRadius: 4,
      color,
      background: bg,
      border: `1px solid ${border}`,
      whiteSpace: 'nowrap',
    }}>
      +{days}d
    </span>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────

function useRayshapeStatus(leadId: string) {
  const [status, setStatus] = useState<RayshapeStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase
        .rpc('fn_rayshape_status', { p_lead_id: leadId })

      if (rpcError) throw rpcError
      setStatus(data as RayshapeStatus)
      setLastUpdated(new Date())
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar status Rayshape')
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    fetch()
  }, [fetch])

  // ── Realtime: recarrega quando deals do lead mudam ────────
  useEffect(() => {
    const channel = supabase
      .channel(`rayshape:${leadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deals',
          filter: `lead_id=eq.${leadId}`,
        },
        () => {
          // Pequeno delay para o Postgres processar
          setTimeout(fetch, 800)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [leadId, fetch])

  return { status, loading, error, refetch: fetch, lastUpdated }
}

// ── Componente principal ──────────────────────────────────────────────────

interface RayshapePanelProps {
  leadId: string
}

export function RayshapePanel({ leadId }: RayshapePanelProps) {
  const { status, loading, error, refetch, lastUpdated } = useRayshapeStatus(leadId)
  const [expandedDeal, setExpandedDeal] = useState<string | null>(null)

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingWrap}>
          <div style={styles.spinner} />
          <span style={{ color: '#4a5578', fontSize: 12 }}>Verificando histórico Rayshape...</span>
        </div>
      </div>
    )
  }

  // ── Erro ──────────────────────────────────────────────────
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorBox}>
          <span>⚠️ {error}</span>
          <button onClick={refetch} style={styles.retryBtn}>Tentar novamente</button>
        </div>
      </div>
    )
  }

  // ── Sem impressora ────────────────────────────────────────
  if (!status || !status.has_printer) {
    return (
      <div style={styles.container}>
        <div style={styles.noPrinterBox}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🖨️</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>
            Sem Rayshape Edge Mini
          </div>
          <div style={{ fontSize: 12, color: '#475569' }}>
            Este lead não possui uma compra de impressora Rayshape registrada no CRM.
          </div>
        </div>
      </div>
    )
  }

  const cfg = CATEGORY_CONFIG[status.category]
  const hasPosts = status.n_post > 0

  return (
    <div style={styles.container}>

      {/* ── Header card ── */}
      <div style={{ ...styles.card, borderColor: cfg.border, background: cfg.bg }}>
        <div style={styles.headerRow}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>🖨️</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>
                Rayshape Edge Mini
              </span>
              <span style={{
                ...styles.catBadge,
                color: cfg.color,
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
              }}>
                {cfg.label}
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
              Compra: {status.printer_date}
              {status.printer_qty > 1 && ` · ${status.printer_qty}x impressoras`}
              {' · '}{status.days_since}d atrás
              {' · '}{status.vendor}
            </div>
          </div>

          <button
            onClick={refetch}
            style={styles.refreshBtn}
            title={`Atualizado: ${lastUpdated?.toLocaleTimeString('pt-BR')}`}
          >
            ↻
          </button>
        </div>

        {/* Métricas */}
        <div style={styles.metricsRow}>
          <Metric
            label="Preço Impressora"
            value={fmt(status.printer_price)}
            color="#94a3b8"
          />
          <Metric
            label="Recompras"
            value={`${status.n_post} compra${status.n_post !== 1 ? 's' : ''}`}
            color={hasPosts ? '#00e5c3' : '#475569'}
          />
          <Metric
            label="Total Pós"
            value={fmt(status.total_post)}
            color={hasPosts ? '#22d3a0' : '#475569'}
          />
          <Metric
            label="1ª Recompra"
            value={status.first_repurchase_days != null
              ? `+${status.first_repurchase_days} dias`
              : '—'}
            color={status.first_repurchase_days != null ? '#00e5c3' : '#475569'}
          />
        </div>

        {/* Barra de progresso (dias) */}
        {status.category !== 'recomprou' && (
          <DaysProgress daysSince={status.days_since} />
        )}
      </div>

      {/* ── Alerta crítico / atenção ── */}
      {status.category === 'critico' && (
        <AlertBanner
          color="#f87171"
          bg="rgba(248,113,113,0.06)"
          border="rgba(248,113,113,0.2)"
          icon="🔴"
          title={`${status.days_since} dias com impressora sem nenhuma compra de resina`}
          message="Cliente pode estar com problemas operacionais ou usando resina de outro fornecedor. Contato urgente do CS."
        />
      )}
      {status.category === 'atencao' && (
        <AlertBanner
          color="#f59e0b"
          bg="rgba(245,158,11,0.06)"
          border="rgba(245,158,11,0.2)"
          icon="🟡"
          title={`${status.days_since} dias sem recompra — janela de reativação aberta`}
          message="Mediana do mercado é 54 dias para primeira recompra. Este cliente está acima do padrão."
        />
      )}

      {/* ── Timeline de compras ── */}
      {hasPosts ? (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            📦 Histórico de Compras Pós-Impressora
            <span style={styles.sectionCount}>{status.n_post} transações · {fmt(status.total_post)}</span>
          </div>

          <div style={styles.timeline}>
            {/* Ponto inicial: Impressora */}
            <TimelineNode
              date={status.printer_date}
              daysAfter={null}
              isFirst
              label="🖨️ Rayshape Edge Mini"
              value={status.printer_price}
              vendor={status.vendor}
              color="#00e5c3"
            />

            {/* Compras subsequentes */}
            {status.post_purchases.map((p, i) => {
              const isExpanded = expandedDeal === p.deal_id
              return (
                <div key={p.deal_id}>
                  <TimelineNode
                    date={p.date}
                    daysAfter={p.days_after}
                    isFirst={false}
                    label={p.items
                      ? p.items.map(it => `${it.name} ×${it.qty}`).join(', ').substring(0, 60) +
                        (p.items.length > 1 ? '...' : '')
                      : `Compra CS Onboarding`}
                    value={p.value}
                    vendor={p.vendor}
                    color={i === 0 ? '#00e5c3' : '#3b82f6'}
                    onClick={() => setExpandedDeal(isExpanded ? null : p.deal_id)}
                    expandable={!!p.items && p.items.length > 0}
                    expanded={isExpanded}
                  />

                  {/* Itens expandidos */}
                  {isExpanded && p.items && (
                    <div style={styles.expandedItems}>
                      {p.items.map((item, j) => (
                        <div key={j} style={styles.itemRow}>
                          <span style={styles.itemName}>{item.name}</span>
                          <span style={styles.itemQty}>×{item.qty}</span>
                          <span style={styles.itemVal}>{fmt(item.value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>📦 Histórico de Recompras</div>
          <div style={styles.emptyHistory}>
            <span style={{ fontSize: 28, marginBottom: 8 }}>📭</span>
            <span style={{ color: '#64748b', fontSize: 12 }}>
              Nenhuma compra registrada após a impressora.
            </span>
            {status.category === 'cedo' && (
              <span style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>
                Padrão normal — mediana é 54 dias para 1ª recompra.
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Realtime indicator ── */}
      <div style={styles.realtimeBar}>
        <span style={styles.rtDot} />
        <span>Atualização em tempo real · última sync {lastUpdated?.toLocaleTimeString('pt-BR') ?? '—'}</span>
      </div>

    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={styles.metric}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={{ ...styles.metricValue, color }}>{value}</div>
    </div>
  )
}

function DaysProgress({ daysSince }: { daysSince: number }) {
  const pct = Math.min((daysSince / 180) * 100, 100)
  const color = daysSince >= 180 ? '#f87171' : daysSince >= 90 ? '#f59e0b' : '#00e5c3'

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#4a5578', marginBottom: 4 }}>
        <span>Dias desde a impressora: {daysSince}d</span>
        <span style={{ color: '#64748b' }}>180d = crítico</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 2,
          transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  )
}

function AlertBanner({ color, bg, border, icon, title, message }: {
  color: string; bg: string; border: string
  icon: string; title: string; message: string
}) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color, marginBottom: 3 }}>
        {icon} {title}
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>{message}</div>
    </div>
  )
}

function TimelineNode({
  date, daysAfter, isFirst, label, value, vendor, color,
  onClick, expandable, expanded,
}: {
  date: string
  daysAfter: number | null
  isFirst: boolean
  label: string
  value: number
  vendor: string
  color: string
  onClick?: () => void
  expandable?: boolean
  expanded?: boolean
}) {
  return (
    <div
      style={{ ...styles.tlNode, cursor: expandable ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: color, boxShadow: `0 0 6px ${color}80`,
          flexShrink: 0,
        }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label}
            {expandable && <span style={{ color: '#4a5578', marginLeft: 4 }}>{expanded ? '▲' : '▼'}</span>}
          </div>
          <div style={{ fontSize: 10, color: '#4a5578', fontFamily: 'monospace', marginTop: 2 }}>
            {date} · {vendor}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {daysAfter !== null && <DaysBadge days={daysAfter} />}
        <span style={{ fontSize: 12, fontWeight: 600, color: '#22d3a0', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
          {fmt(value)}
        </span>
      </div>
    </div>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────

const styles = {
  container: {
    padding: '16px 16px 8px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
    minHeight: 200,
  },
  card: {
    border: '1px solid',
    borderRadius: 10,
    padding: '14px 16px',
    background: 'rgba(0,229,195,0.04)',
    transition: 'border-color 0.2s',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  catBadge: {
    fontFamily: 'monospace',
    fontSize: 10,
    padding: '2px 8px',
    borderRadius: 4,
    border: '1px solid',
    fontWeight: 600,
  },
  refreshBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#4a5578',
    borderRadius: 6,
    width: 28,
    height: 28,
    cursor: 'pointer',
    fontSize: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as React.CSSProperties,
  metricsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 10,
    marginBottom: 4,
  },
  metric: {
    background: 'rgba(0,0,0,0.2)',
    borderRadius: 7,
    padding: '9px 10px',
  },
  metricLabel: {
    fontSize: 9,
    color: '#4a5578',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: 700,
    fontFamily: 'monospace',
  },
  section: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 9,
    padding: '12px 14px',
  },
  sectionTitle: {
    fontSize: 11,
    color: '#00e5c3',
    fontFamily: 'monospace',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionCount: {
    fontSize: 10,
    color: '#4a5578',
    textTransform: 'none' as const,
    letterSpacing: 0,
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 0,
    paddingLeft: 4,
    borderLeft: '1px solid rgba(255,255,255,0.06)',
    marginLeft: 5,
  },
  tlNode: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '8px 0 8px 10px',
    marginLeft: -5,
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  expandedItems: {
    marginLeft: 28,
    marginBottom: 4,
    background: 'rgba(0,0,0,0.2)',
    borderRadius: 6,
    padding: '8px 10px',
  },
  itemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '3px 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  itemName: { flex: 1, fontSize: 11, color: '#94a3b8' },
  itemQty: { fontSize: 10, color: '#4a5578', fontFamily: 'monospace', minWidth: 24 },
  itemVal: { fontSize: 11, color: '#22d3a0', fontFamily: 'monospace', minWidth: 70, textAlign: 'right' as const },
  emptyHistory: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '20px 0',
    gap: 4,
  },
  loadingWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 40,
  },
  spinner: {
    width: 18,
    height: 18,
    border: '2px solid rgba(0,229,195,0.2)',
    borderTop: '2px solid #00e5c3',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorBox: {
    background: 'rgba(248,113,113,0.08)',
    border: '1px solid rgba(248,113,113,0.25)',
    borderRadius: 8,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 12,
    color: '#fca5a5',
  },
  retryBtn: {
    background: 'transparent',
    border: '1px solid rgba(248,113,113,0.4)',
    color: '#f87171',
    borderRadius: 5,
    padding: '4px 10px',
    cursor: 'pointer',
    fontSize: 11,
  } as React.CSSProperties,
  noPrinterBox: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '30px 20px',
    gap: 4,
    textAlign: 'center' as const,
  },
  realtimeBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 9,
    color: '#334155',
    fontFamily: 'monospace',
    paddingTop: 2,
    paddingLeft: 4,
  },
  rtDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#00e5c3',
    boxShadow: '0 0 4px #00e5c3',
    animation: 'pulse 2s infinite',
    display: 'inline-block',
  },
} as const
