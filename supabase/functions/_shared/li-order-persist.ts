/**
 * Persistência normalizada de pedidos da Loja Integrada.
 *
 * Escopo: exclusivamente Loja Integrada. Grava em `loja_integrada_orders` e
 * `loja_integrada_order_items` — nenhuma outra tabela é tocada aqui.
 *
 * Motivo de existir: até agora o webhook só guardava os itens dentro de
 * `lia_attendances.lojaintegrada_itens_json`, e a tabela normalizada de itens
 * ficava vazia. Como `v_sku_mapping_inbox` lê essa tabela, o braço e-commerce
 * da fila de mapeamento nunca recebia nada. Este módulo é a ponte que faltava.
 *
 * A gravação é idempotente: reprocessar o mesmo pedido (reconciler, replay de
 * webhook, backfill) substitui os itens daquele pedido em vez de duplicá-los.
 */

import {
  buildLiCatalogIndex,
  emptyCatalogIndex,
  getLiCatalogIndex,
  matchLiItem,
  type LiCatalogIndex,
} from "./li-sku-match.ts";

/**
 * Situações da loja que contam como venda concretizada.
 *
 * Definição única: o webhook e o sync de clientes importam daqui. Enquanto
 * cada um mantinha a sua regra ("aprovado && !cancelado" de um lado, esta
 * lista do outro), os dois caminhos calculavam LTVs diferentes para o mesmo
 * cliente.
 */
export const PAID_SITUACAO_CODIGOS = new Set([
  "pago", "pagamento_confirmado", "pagamento_aprovado",
  "em_producao", "pronto_envio", "enviado", "entregue",
  "pedido_pago", "pedido_enviado", "pedido_entregue",
  "pedido_em_producao", "pedido_em_separacao", "pronto_para_envio",
]);

/** Um pedido conta para LTV? Usa o código da situação, nunca flags soltas. */
export function isPedidoPago(situacao: Record<string, unknown> | null | undefined): boolean {
  if (!situacao) return false;
  if (situacao.cancelado === true) return false;
  const codigo = String(situacao.codigo ?? "").toLowerCase();
  return PAID_SITUACAO_CODIGOS.has(codigo);
}

/**
 * Merge append-only do histórico de pedidos, deduplicado por `numero`,
 * mais recente primeiro. O snapshot novo vence quando o mesmo pedido já
 * existia — é ele que traz a situação atualizada.
 */
export function mergeHistoricoPedidos(
  existente: unknown,
  novos: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const anterior = Array.isArray(existente) ? existente as Array<Record<string, unknown>> : [];
  const porNumero = new Map<string, Record<string, unknown>>();
  for (const p of anterior) {
    const k = String(p?.numero ?? p?.id ?? "");
    if (k) porNumero.set(k, p);
  }
  for (const p of novos) {
    const k = String(p?.numero ?? p?.id ?? "");
    if (k) porNumero.set(k, p);
  }
  return [...porNumero.values()].sort((a, b) =>
    String(b?.data_criacao ?? "").localeCompare(String(a?.data_criacao ?? ""))
  );
}

export interface LiItemNormalizado {
  sku: string | null;
  produto_id: string | null;
  nome_produto: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  url_imagem: string | null;
}

function num(v: unknown, padrao = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : padrao;
}

function texto(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** Extrai o id numérico de uma URI da API da loja ("/api/v1/produto/91705004"). */
export function idDeUri(uri: unknown): string | null {
  const s = String(uri ?? "");
  const m = s.match(/(\d+)\/?$/);
  return m ? m[1] : null;
}

/**
 * Normaliza o array `itens` de um pedido da loja.
 * Aceita as variações de nome de campo que a API e os webhooks usam.
 */
export function extractLiItems(
  order: Record<string, unknown>,
): LiItemNormalizado[] {
  const brutos = (order.itens || order.items || []) as Array<Record<string, unknown>>;
  if (!Array.isArray(brutos)) return [];

  const out: LiItemNormalizado[] = [];
  for (const it of brutos) {
    if (!it || typeof it !== "object") continue;

    const nome = texto(it.nome ?? it.name ?? it.nome_produto);
    const sku = texto(it.sku ?? it.sku_produto);
    if (!nome && !sku) continue;

    const quantidade = num(it.quantidade ?? it.quantity, 1) || 1;
    const unitario = num(
      it.preco_venda ?? it.preco_unitario ?? it.price ?? it.preco_cheio,
    );
    // `preco_subtotal` é o total da linha na API da loja; quando ausente,
    // reconstruímos a partir do unitário.
    const total = num(it.preco_subtotal ?? it.valor_total, unitario * quantidade);

    out.push({
      sku,
      produto_id: idDeUri(it.produto) ?? texto(it.produto_id) ?? texto(it.id),
      nome_produto: nome,
      quantidade,
      valor_unitario: unitario,
      valor_total: total,
      url_imagem: texto(it.imagem ?? it.url_imagem),
    });
  }
  return out;
}

export interface PersistLiOrderInput {
  order: Record<string, unknown>;
  rawPayload?: Record<string, unknown> | null;
  leadId: string | null;
  /** Índice de catálogo reaproveitado entre pedidos (lote/backfill). */
  catalogIndex?: LiCatalogIndex;
}

export interface PersistLiOrderResult {
  ok: boolean;
  order_id: string | null;
  pedido_id: string | null;
  itens: number;
  resolvidos: number;
  erro?: string;
}

/**
 * Grava (ou regrava) um pedido da loja e seus itens.
 *
 * Falhas aqui nunca devem derrubar a ingestão do lead — o chamador recebe
 * `ok: false` e segue. O pedido continua registrado no CRM de qualquer forma.
 */
export async function persistLiOrder(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  input: PersistLiOrderInput,
): Promise<PersistLiOrderResult> {
  const { order, rawPayload, leadId } = input;

  const pedidoId = texto(order.id) ?? texto(order.numero);
  if (!pedidoId) {
    return { ok: false, order_id: null, pedido_id: null, itens: 0, resolvidos: 0, erro: "pedido sem id" };
  }

  const situacao = order.situacao as Record<string, unknown> | undefined;
  const pagamentos = (order.pagamentos || []) as Array<Record<string, unknown>>;
  const envios = (order.envios || []) as Array<Record<string, unknown>>;
  const cupom = (order.cupom_desconto && typeof order.cupom_desconto === "object")
    ? order.cupom_desconto as Record<string, unknown>
    : null;

  const clienteId = typeof order.cliente === "object" && order.cliente !== null
    ? texto((order.cliente as Record<string, unknown>).id)
    : idDeUri(order.cliente);

  const itens = extractLiItems(order);

  const linhaPedido: Record<string, unknown> = {
    pedido_id: pedidoId,
    numero_pedido: texto(order.numero),
    cliente_id: clienteId,
    status: situacao?.nome ? String(situacao.nome) : null,
    data_pedido: texto(order.data_criacao),
    data_modificacao: texto(order.data_modificacao),
    valor_subtotal: order.valor_subtotal != null ? num(order.valor_subtotal) : null,
    valor_desconto: order.valor_desconto != null ? num(order.valor_desconto) : null,
    valor_envio: order.valor_envio != null ? num(order.valor_envio) : null,
    valor_total: order.valor_total != null ? num(order.valor_total) : null,
    forma_pagamento: pagamentos.length > 0
      ? texto((pagamentos[0].forma_pagamento as Record<string, unknown> | undefined)?.nome ?? pagamentos[0].pagamento_tipo)
      : null,
    parcelas: pagamentos.length > 0 && pagamentos[0].numero_parcelas != null
      ? num(pagamentos[0].numero_parcelas)
      : null,
    bandeira_cartao: pagamentos.length > 0 ? texto(pagamentos[0].bandeira) : null,
    forma_envio: envios.length > 0
      ? texto((envios[0].forma_envio as Record<string, unknown> | undefined)?.nome)
      : null,
    tracking_code: envios.length > 0 ? texto(envios[0].objeto) : null,
    cupom_codigo: cupom ? texto(cupom.codigo ?? cupom.nome) : texto(order.cupom_desconto),
    cupom_json: cupom,
    itens_json: itens.length > 0 ? (order.itens ?? order.items ?? null) : null,
    utm_campaign: texto(order.utm_campaign),
    marketplace: order.marketplace_info && typeof order.marketplace_info === "object"
      ? texto((order.marketplace_info as Record<string, unknown>).nome)
      : null,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (leadId) linhaPedido.attendance_id = leadId;
  if (rawPayload) linhaPedido.raw_payload = rawPayload;

  // Remove chaves nulas para não sobrescrever dados já gravados com null
  // quando o payload atual vier mais pobre que o anterior.
  for (const k of Object.keys(linhaPedido)) {
    if (linhaPedido[k] === null) delete linhaPedido[k];
  }

  const { data: pedidoRow, error: erroPedido } = await supabase
    .from("loja_integrada_orders")
    .upsert(linhaPedido, { onConflict: "pedido_id" })
    .select("id")
    .maybeSingle();

  if (erroPedido || !pedidoRow) {
    console.warn(`[li-persist] falha ao gravar pedido ${pedidoId}:`, erroPedido?.message);
    return {
      ok: false,
      order_id: null,
      pedido_id: pedidoId,
      itens: 0,
      resolvidos: 0,
      erro: erroPedido?.message ?? "upsert do pedido não retornou linha",
    };
  }

  const orderId = pedidoRow.id as string;
  if (itens.length === 0) {
    return { ok: true, order_id: orderId, pedido_id: pedidoId, itens: 0, resolvidos: 0 };
  }

  // Idempotência: a tabela de itens não tem chave natural única, então o
  // conjunto de itens do pedido é substituído a cada reprocessamento.
  const { error: erroDelete } = await supabase
    .from("loja_integrada_order_items")
    .delete()
    .eq("order_id", orderId);
  if (erroDelete) {
    console.warn(`[li-persist] falha ao limpar itens de ${pedidoId}:`, erroDelete.message);
  }

  const idx = input.catalogIndex ?? emptyCatalogIndex();
  let resolvidos = 0;

  const linhas = itens.map((it) => {
    const base: Record<string, unknown> = {
      order_id: orderId,
      pedido_id: pedidoId,
      sku: it.sku,
      produto_id: it.produto_id,
      nome_produto: it.nome_produto,
      quantidade: it.quantidade,
      valor_unitario: it.valor_unitario,
      valor_total: it.valor_total,
      url_imagem: it.url_imagem,
    };
    const m = matchLiItem(idx, { sku: it.sku, nome: it.nome_produto });
    if (m.matched_by) resolvidos++;
    return { base, match: m };
  });

  const { error: erroItens } = await supabase
    .from("loja_integrada_order_items")
    .insert(linhas.map((l) => ({ ...l.base, ...matchColumns(l.match) })));

  if (erroItens) {
    // As colunas de resolução só existem depois da migration desta etapa.
    // Sem elas, gravamos os itens mesmo assim — popular a tabela é o que
    // desbloqueia a fila de mapeamento; a resolução é um ganho adicional.
    console.warn(
      `[li-persist] insert com colunas de resolução falhou (${erroItens.message}); regravando sem elas`,
    );
    const { error: erroSimples } = await supabase
      .from("loja_integrada_order_items")
      .insert(linhas.map((l) => l.base));
    if (erroSimples) {
      console.warn(`[li-persist] falha ao gravar itens de ${pedidoId}:`, erroSimples.message);
      return {
        ok: false,
        order_id: orderId,
        pedido_id: pedidoId,
        itens: 0,
        resolvidos: 0,
        erro: erroSimples.message,
      };
    }
    resolvidos = 0;
  }

  return { ok: true, order_id: orderId, pedido_id: pedidoId, itens: itens.length, resolvidos };
}

/** Colunas de resolução — presentes só após a migration da etapa 2. */
function matchColumns(m: ReturnType<typeof matchLiItem>): Record<string, unknown> {
  return {
    sku_interno: m.sku_interno,
    nome_canonico: m.nome_canonico,
    catalog_variation_id: m.catalog_variation_id,
    catalog_product_id: m.catalog_product_id,
    matched_by: m.matched_by,
    match_confidence: m.confidence,
  };
}

export { buildLiCatalogIndex, getLiCatalogIndex };
