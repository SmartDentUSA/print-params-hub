import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const REFETCH = 5 * 60 * 1000; // TV: 5 min

export interface PainelKpis {
  mes_ref: string;
  receita_mes: number | null;
  receita_mes_anterior: number | null;
  receita_periodo_comparado?: string | null;
  leads_mes: number | null;
  leads_mes_anterior: number | null;
  leads_periodo_comparado?: string | null;
  funil_atual: number | null;
  leads_perdidos: number | null;
  leads_reativados: number | null;
  /** base da composição: receita dos negócios que têm linhas de proposta */
  receita_produtos_total: number | null;
  receita_equipamentos: number | null;
  receita_insumos: number | null;
  /** licença, software, crédito de IA, curso e serviço — não é insumo nem equipamento */
  receita_software_servico: number | null;
  /** receita de negócios ganhos sem nenhuma linha de proposta — fica fora da composição */
  receita_sem_composicao?: number | null;
  /** itens com proposta que a taxonomia não conseguiu classificar */
  receita_nao_classificada?: number | null;
}

export interface PainelFunilRow {
  etapa: string;
  ordem: number;
  atual: number;
  /** leads que alcançaram a etapa (volume real do funil) */
  volume?: number | null;
  /** funil real: alcançou esta etapa OU qualquer posterior. Monotônico. */
  volume_acumulado?: number | null;
  media_dias: number | null;
  pct_perda: number | null;
  qtd_saidas: number;
}

export interface PainelVendedorRow {
  vendedor: string;
  /** negócios criados no pipeline de vendas no mês (não é contagem de leads) */
  leads_novos: number;
  leads_mes_anterior: number;
  /** leads distintos com negócio aberto, mesmo corte de 12 meses do KPI */
  funil_atual: number;
  pedidos: number;
  pct_abandono: number | null;
  t_medio_qualif: number | null;
  t_medio_negoc: number | null;
  t_medio_fecham: number | null;
  apresentacoes: number;
  conversao_apresent: number | null;
  receita_insumos: number | null;
  receita_insumos_ltv: number | null;
  receita_insumos_novos: number | null;
  receita_equip: number | null;
  receita_upsell: number | null;
  /** licença, software, crédito de IA, curso e serviço — mesma classe do KPI */
  receita_software_servico?: number | null;
  total_vendas: number | null;
}

export interface PainelAtividadeRow {
  vendedor: string;
  fop_whatsapp: number;
  tentativa_ligacao: number;
  ligacao: number;
  atividade: number;
  reuniao: number;
  email: number;
  lembrete: number;
  total: number;
  fechados: number;
  media_interacoes_fechar: number | null;
}

export interface PainelOrigemRow {
  origem: string;
  campanha: string;
  /** classificação da origem (pode não vir se a migration ainda não rodou) */
  tipo?: "Inbound" | "Outbound";
  leads_gerados: number;
  ativos: number;
  perdidos: number;
  pct_perda: number | null;
  etapa_maior_perda: string | null;
  /** negócios fechados NO MÊS (visão de caixa), independentemente de quando o lead entrou */
  ganhos: number;
  /** leads DESTA coorte que já converteram — base da conversão (nunca passa de 100%) */
  ganhos_coorte?: number | null;
  lead_time_dias: number | null;
  pct_conversao: number | null;
  receita: number | null;
}

export interface PainelProdutoRow {
  workflow_stage: string;
  subcategory: string;
  posicao: number;
  produto: string;
  receita: number | null;
}

const rpc = async <T,>(fn: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await (supabase as any).rpc(fn, args ?? {});
  if (error) throw error;
  return data as T;
};

export function usePainelKpis(mes?: string) {
  return useQuery({
    queryKey: ["painel-kpis", mes],
    queryFn: () => rpc<PainelKpis>("painel_comercial_kpis_cache", mes ? { p_mes: mes } : undefined),
    refetchInterval: REFETCH,
  });
}

export function usePainelFunil(mes?: string) {
  return useQuery({
    queryKey: ["painel-funil", mes],
    queryFn: () => rpc<PainelFunilRow[]>("painel_comercial_funil", mes ? { p_mes: mes } : undefined),
    refetchInterval: REFETCH,
  });
}

export function usePainelVendedores(mes?: string) {
  return useQuery({
    queryKey: ["painel-vendedores", mes],
    queryFn: () => rpc<PainelVendedorRow[]>("painel_comercial_vendedores", mes ? { p_mes: mes } : undefined),
    refetchInterval: REFETCH,
  });
}

export function usePainelAtividades(mes?: string) {
  return useQuery({
    queryKey: ["painel-atividades", mes],
    queryFn: () => rpc<PainelAtividadeRow[]>("painel_comercial_atividades", mes ? { p_mes: mes } : undefined),
    refetchInterval: REFETCH,
  });
}

export function usePainelOrigens(mes?: string) {
  return useQuery({
    queryKey: ["painel-origens", mes],
    queryFn: () => rpc<PainelOrigemRow[]>("painel_comercial_origens", mes ? { p_mes: mes } : undefined),
    refetchInterval: REFETCH,
  });
}

export interface PainelMesDisponivel {
  mes: string;
  atualizado_em: string;
}

/** Meses que existem no cache — o seletor não deve oferecer mês que nunca foi calculado. */
export function usePainelMesesDisponiveis() {
  return useQuery({
    queryKey: ["painel-meses"],
    queryFn: () => rpc<PainelMesDisponivel[]>("painel_comercial_meses_disponiveis"),
    staleTime: REFETCH,
  });
}

export function usePainelTopProdutos(mes?: string) {
  return useQuery({
    queryKey: ["painel-top-produtos", mes],
    queryFn: () => rpc<PainelProdutoRow[]>("painel_comercial_top_produtos", mes ? { p_mes: mes } : undefined),
    refetchInterval: REFETCH,
  });
}

export const fmtBRL = (v: number | null | undefined, compact = false) =>
  v === null || v === undefined
    ? "—"
    : v.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        notation: compact && Math.abs(v) >= 1000 ? "compact" : "standard",
        maximumFractionDigits: compact ? 1 : 0,
      });

export const fmtNum = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : v.toLocaleString("pt-BR");

export const fmtPct = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export const fmtDias = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}d`;

export const variacao = (atual?: number | null, anterior?: number | null): number | null => {
  if (atual === null || atual === undefined || !anterior) return null;
  return ((atual - anterior) / anterior) * 100;
};