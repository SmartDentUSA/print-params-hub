/**
 * Data real de cada evento de pedido da Loja Integrada.
 *
 * Escopo: exclusivamente Loja Integrada.
 *
 * Problema que resolve: a timeline carimbava todo evento com `data_criacao`
 * do pedido. Um pedido que foi criado, pago e enviado em dias diferentes
 * aparecia com os três eventos no mesmo instante — o da criação. E quando
 * `data_criacao` faltava no payload, caía em `new Date()`, gravando a data
 * da ingestão como se fosse a data do fato.
 *
 * Ordem de preferência para cada evento:
 *   1. a data específica do fato, quando a loja manda (envio, pagamento);
 *   2. `data_modificacao` — o instante em que a situação mudou, que para um
 *      webhook de mudança de status é exatamente a data do evento;
 *   3. `data_criacao` — só para o evento de criação, ou como último recurso;
 *   4. agora — apenas se o payload não trouxer nenhuma data.
 *
 * A API da loja não documenta um nome único para as datas de envio e
 * pagamento entre versões e integrações, então cada uma é procurada por uma
 * lista de candidatos. `fonte` no retorno registra de onde a data veio, para
 * que a qualidade do dado seja auditável depois.
 */

function primeiraData(
  obj: Record<string, unknown> | null | undefined,
  chaves: string[],
): { iso: string; chave: string } | null {
  if (!obj || typeof obj !== "object") return null;
  for (const k of chaves) {
    const v = obj[k];
    if (v === null || v === undefined || v === "") continue;
    const s = String(v);
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return { iso: new Date(t).toISOString(), chave: k };
  }
  return null;
}

/** Varre um array (envios/pagamentos) procurando a primeira data válida. */
function primeiraDataEmLista(
  lista: unknown,
  chaves: string[],
  prefixo: string,
): { iso: string; chave: string } | null {
  if (!Array.isArray(lista)) return null;
  for (const item of lista) {
    const achou = primeiraData(item as Record<string, unknown>, chaves);
    if (achou) return { iso: achou.iso, chave: `${prefixo}.${achou.chave}` };
  }
  return null;
}

const CHAVES_ENVIO = [
  "data_envio", "data_postagem", "data_despacho", "enviado_em",
  "data_alteracao", "data_criacao", "data",
];
const CHAVES_ENTREGA = ["data_entrega", "entregue_em", "data_recebimento"];
const CHAVES_PAGAMENTO = [
  "data_aprovacao", "data_pagamento", "data_confirmacao", "aprovado_em",
  "data_alteracao", "data_criacao", "data",
];

export interface LiEventDate {
  iso: string;
  /** De onde a data veio — ex.: "envios.data_envio", "data_modificacao". */
  fonte: string;
  /** false quando caiu no relógio do servidor por falta de data no payload. */
  confiavel: boolean;
}

/**
 * Resolve a data real de um evento a partir do payload do pedido.
 * Nunca lança: na ausência de qualquer data devolve o instante atual,
 * marcado como não confiável.
 */
export function resolveLiEventDate(
  order: Record<string, unknown>,
  eventType: string,
): LiEventDate {
  const criacao = primeiraData(order, ["data_criacao"]);
  const modificacao = primeiraData(order, ["data_modificacao"]);
  const expiracao = primeiraData(order, ["data_expiracao"]);
  const envios = order.envios;
  const pagamentos = order.pagamentos;

  // Candidatos em ordem de preferência, por tipo de evento.
  let candidatos: Array<{ iso: string; chave: string } | null>;

  switch (eventType) {
    case "order_created":
      // A criação é o único evento cuja data correta é mesmo data_criacao.
      candidatos = [criacao, modificacao];
      break;

    case "order_paid":
      candidatos = [
        primeiraDataEmLista(pagamentos, CHAVES_PAGAMENTO, "pagamentos"),
        modificacao,
        criacao,
      ];
      break;

    case "order_invoiced":
      candidatos = [
        primeiraDataEmLista(envios, CHAVES_ENVIO, "envios"),
        modificacao,
        criacao,
      ];
      break;

    case "order_delivered":
      candidatos = [
        primeiraDataEmLista(envios, CHAVES_ENTREGA, "envios"),
        modificacao,
        criacao,
      ];
      break;

    case "boleto_generated":
      candidatos = [
        primeiraDataEmLista(pagamentos, CHAVES_PAGAMENTO, "pagamentos"),
        modificacao,
        criacao,
      ];
      break;

    case "boleto_expired":
      candidatos = [expiracao, modificacao, criacao];
      break;

    // order_cancelled, cart_abandoned e qualquer evento futuro: a mudança de
    // situação é o próprio fato, então data_modificacao é a data correta.
    default:
      candidatos = [modificacao, criacao];
      break;
  }

  for (const c of candidatos) {
    if (c) return { iso: c.iso, fonte: c.chave, confiavel: true };
  }

  return { iso: new Date().toISOString(), fonte: "relogio_do_servidor", confiavel: false };
}

/**
 * Datas do carrinho: criação sempre pela criação do pedido; o abandono é a
 * mudança de situação que o marcou como abandonado.
 */
export function resolveLiCartDates(
  order: Record<string, unknown>,
  eventType: string,
): { criadoEm: string; abandonadoEm: string | null } {
  const criacao = primeiraData(order, ["data_criacao"]);
  const abandono = eventType === "boleto_expired" || eventType === "cart_abandoned"
    ? resolveLiEventDate(order, eventType)
    : null;
  return {
    criadoEm: criacao?.iso ?? new Date().toISOString(),
    abandonadoEm: abandono?.iso ?? null,
  };
}
