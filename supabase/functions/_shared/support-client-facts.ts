const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

export function isEdgeMini(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const name = normalize(value)
  return name.includes('rayshape') && name.includes('edgemini')
}

export function ownsPriorityPrinter(lead: Record<string, unknown>): boolean {
  if ([lead.equip_impressora, lead.impressora_modelo].some(isEdgeMini)) return true
  const portfolio = lead.portfolio_json
  if (!portfolio || typeof portfolio !== 'object') return false
  // Only ownership layers of printer cells, never SDR/interesse layers.
  for (const [stage, cells] of Object.entries(portfolio)) {
    if (!/impress/i.test(stage) || !cells || typeof cells !== 'object') continue
    for (const [cell, layers] of Object.entries(cells)) {
      if (!/impressora|printer/i.test(cell) || !layers || typeof layers !== 'object') continue
      for (const [layer, evidence] of Object.entries(layers)) {
        if (!['ativo', 'conc', 'mapeamento'].includes(layer) || !evidence || typeof evidence !== 'object') continue
        const item = evidence as Record<string, unknown>
        if (layer === 'mapeamento' && !['possui', 'adquirido', 'ativo'].includes(String(item.status).toLowerCase())) continue
        if (isEdgeMini(item.valor) || isEdgeMini(item.modelo)) return true
      }
    }
  }
  return false
}

export function ticketCounts(tickets: { kanban_status: string | null }[]) {
  return tickets.reduce((counts, ticket) => {
    if (['resolvido', 'encerrado'].includes(ticket.kanban_status ?? '')) counts.resolved++
    else counts.open++
    return counts
  }, { open: 0, resolved: 0 })
}