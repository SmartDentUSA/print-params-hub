// _shared/wa-provider-router.ts
// REGRA GLOBAL DOS PROVEDORES WHATSAPP (estrutural, vale para TODO team_member).
//
//   Evolution API normal (:8080) → mensagens individuais / alertas / @s.whatsapp.net
//   EvolutionGO        (:8081)   → grupos @g.us, mídias de grupo, sync e administração
//
// Regras invioláveis:
//  - ativação é por flag + status, NUNCA pela mera existência de credencial;
//  - no modo dual não existe fallback automático entre provedores;
//  - a falha de um provedor bloqueia apenas as operações dele.

export type WaOperation =
  | 'direct_message'
  | 'group_message'
  | 'group_sync'
  | 'group_management'

export type WaProviderId = 'evolution' | 'evolution_go'

export const DEFAULT_EVOLUTION_BASE_URL = 'http://82.25.75.61:8080'
export const DEFAULT_EVO_GO_BASE_URL = 'http://82.25.75.61:8081'

/** Colunas mínimas de team_members exigidas pelo router. */
export const WA_PROVIDER_COLUMNS = [
  'id',
  'nome_completo',
  'evolution_instance_name',
  'evolution_api_key',
  'evolution_base_url',
  'evolution_enabled',
  'evolution_status',
  'evolution_group_key_broken_at',
  'evo_go_instance_id',
  'evo_go_instance_token',
  'evo_go_base_url',
  'evo_go_enabled',
  'evo_go_status',
].join(', ')

export interface WaTeamMember {
  id?: string | null
  nome_completo?: string | null
  evolution_instance_name?: string | null
  evolution_api_key?: string | null
  evolution_base_url?: string | null
  evolution_enabled?: boolean | null
  evolution_status?: string | null
  evolution_group_key_broken_at?: string | null
  evo_go_instance_id?: string | null
  evo_go_instance_name?: string | null
  evo_go_instance_token?: string | null
  evo_go_base_url?: string | null
  evo_go_enabled?: boolean | null
  evo_go_status?: string | null
}

export interface ResolvedProvider {
  provider: WaProviderId
  baseUrl: string
  instance: string
  /** apikey (Evolution) ou instance token (EvolutionGO). Nunca logar. */
  credential: string
  teamMemberId: string | null
  operation: WaOperation
  /** true quando os dois provedores estão habilitados e conectados. */
  dualMode: boolean
}

export class WaProviderBlockedError extends Error {
  readonly blockedProvider: WaProviderId
  readonly operation: WaOperation
  readonly reason: string
  constructor(provider: WaProviderId, operation: WaOperation, reason: string) {
    super(
      `[wa-router] operação "${operation}" bloqueada: ${labelOf(provider)} ${reason}. ` +
        `Reconecte ${labelOf(provider)} — não há fallback automático entre provedores.`,
    )
    this.name = 'WaProviderBlockedError'
    this.blockedProvider = provider
    this.operation = operation
    this.reason = reason
  }
}

export function labelOf(p: WaProviderId): string {
  return p === 'evolution_go' ? 'EvolutionGO' : 'Evolution API'
}

const isConnected = (status?: string | null) => {
  const s = (status ?? '').toLowerCase()
  return s === 'connected' || s === 'open'
}

const clean = (v?: string | null) => (v ?? '').trim()
const stripSlash = (u: string) => u.replace(/\/+$/, '')

/** Evolution API: habilitada + credenciais mínimas preenchidas. */
export function hasEvolutionConfig(tm?: WaTeamMember | null): boolean {
  return !!tm && tm.evolution_enabled === true && !!clean(tm.evolution_instance_name) && !!clean(tm.evolution_api_key)
}

/** EvolutionGO: habilitada + token preenchido. */
export function hasEvoGoConfig(tm?: WaTeamMember | null): boolean {
  return !!tm && tm.evo_go_enabled === true && !!clean(tm.evo_go_instance_token)
}

export function isEvolutionUsable(tm?: WaTeamMember | null): boolean {
  return hasEvolutionConfig(tm) && isConnected(tm?.evolution_status)
}

export function isEvoGoUsable(tm?: WaTeamMember | null): boolean {
  return hasEvoGoConfig(tm) && isConnected(tm?.evo_go_status)
}

/**
 * Modo dual: as DUAS integrações habilitadas e conectadas.
 * EvolutionGO configurada porém desconectada NÃO ativa o modo dual.
 */
export function isDualMode(tm?: WaTeamMember | null): boolean {
  return isEvolutionUsable(tm) && isEvoGoUsable(tm)
}

/** Inferência de operação a partir do destino (@g.us → grupo; @lid/@s.whatsapp.net → individual). */
export function operationForJid(jid: string): WaOperation {
  return (jid ?? '').endsWith('@g.us') ? 'group_message' : 'direct_message'
}

function buildEvolution(tm: WaTeamMember, operation: WaOperation, dualMode: boolean): ResolvedProvider {
  return {
    provider: 'evolution',
    baseUrl: stripSlash(clean(tm.evolution_base_url) || DEFAULT_EVOLUTION_BASE_URL),
    instance: clean(tm.evolution_instance_name),
    credential: clean(tm.evolution_api_key),
    teamMemberId: tm.id ?? null,
    operation,
    dualMode,
  }
}

function buildEvoGo(tm: WaTeamMember, operation: WaOperation, dualMode: boolean): ResolvedProvider {
  return {
    provider: 'evolution_go',
    baseUrl: stripSlash(clean(tm.evo_go_base_url) || DEFAULT_EVO_GO_BASE_URL),
    // Prioridade: nome EvoGo explícito > id/nome da instância EvoGo > nome Evolution.
    // O nome Evolution só serve de último recurso: quando a instância EvoGo tem
    // sufixo próprio (ex.: smartdent_marketing_evogo), usar o nome Evolution
    // aponta para uma instância inexistente e o envio falha com "no active session".
    instance: clean(tm.evo_go_instance_name) || clean(tm.evo_go_instance_id) || clean(tm.evolution_instance_name),
    credential: clean(tm.evo_go_instance_token),
    teamMemberId: tm.id ?? null,
    operation,
    dualMode,
  }
}

export function requireConnectedEvolution(tm: WaTeamMember | null | undefined, operation: WaOperation): ResolvedProvider {
  if (!hasEvolutionConfig(tm)) throw new WaProviderBlockedError('evolution', operation, 'não está habilitada ou está sem credenciais')
  if (!isConnected(tm!.evolution_status)) throw new WaProviderBlockedError('evolution', operation, 'está desconectada')
  return buildEvolution(tm!, operation, isDualMode(tm))
}

export function requireConnectedEvolutionGo(tm: WaTeamMember | null | undefined, operation: WaOperation): ResolvedProvider {
  if (!hasEvoGoConfig(tm)) throw new WaProviderBlockedError('evolution_go', operation, 'não está habilitada ou está sem token')
  if (!isConnected(tm!.evo_go_status)) throw new WaProviderBlockedError('evolution_go', operation, 'está desconectada')
  return buildEvoGo(tm!, operation, isDualMode(tm))
}

/**
 * Router obrigatório.
 *
 * Modo dual (as duas conectadas): separação estrita por função, sem fallback.
 * Modo legado (apenas uma integração habilitada): preserva o comportamento atual
 * do membro — a única integração habilitada atende todas as operações.
 */
export function resolveProvider(
  teamMember: WaTeamMember | null | undefined,
  operation: WaOperation,
): ResolvedProvider {
  const tm = teamMember ?? null
  const dual = isDualMode(tm)

  if (dual) {
    if (operation === 'direct_message') return requireConnectedEvolution(tm, operation)
    if (operation === 'group_message' || operation === 'group_sync' || operation === 'group_management') {
      return requireConnectedEvolutionGo(tm, operation)
    }
    throw new Error(`Operação sem provedor definido: ${operation}`)
  }

  if (operation !== 'direct_message' && operation !== 'group_message' && operation !== 'group_sync' && operation !== 'group_management') {
    throw new Error(`Operação sem provedor definido: ${operation}`)
  }

  // Legado: só EvolutionGO habilitada.
  if (!hasEvolutionConfig(tm) && hasEvoGoConfig(tm)) return buildEvoGo(tm!, operation, false)
  // Legado: só Evolution API habilitada (ou nenhuma → Evolution continua sendo o caminho padrão/global).
  if (hasEvolutionConfig(tm)) return buildEvolution(tm!, operation, false)

  return {
    provider: 'evolution',
    baseUrl: stripSlash(clean(tm?.evolution_base_url) || DEFAULT_EVOLUTION_BASE_URL),
    instance: clean(tm?.evolution_instance_name),
    credential: clean(tm?.evolution_api_key),
    teamMemberId: tm?.id ?? null,
    operation,
    dualMode: false,
  }
}

/** Log seguro (nunca inclui credenciais). Critério de aceite 6. */
export function describeProvider(r: ResolvedProvider): Record<string, unknown> {
  return {
    team_member_id: r.teamMemberId,
    provider: r.provider,
    instance: r.instance,
    operation: r.operation,
    dual_mode: r.dualMode,
  }
}

export function logProvider(tag: string, r: ResolvedProvider) {
  console.log(`[${tag}] ${JSON.stringify(describeProvider(r))}`)
}