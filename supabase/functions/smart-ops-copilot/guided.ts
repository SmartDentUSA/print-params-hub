// Criação guiada pelo Copilot (tabela promocional e campanha de grupos WhatsApp).
// O LLM só PREPARA: valida, monta um resumo e grava uma ação pendente.
// A gravação real acontece apenas quando o usuário clica em "Confirmar" na tela
// (requisição separada, sem LLM), via executePendingAction.

export const ACTION_MARKER = "copilot-action";
const COMMERCIAL_TYPES = ["product", "resin", "Resinas", "consumables", "Serviços"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type GuidedCtx = {
  sb: any;
  userId: string;
  supabaseUrl: string;
  serviceKey: string;
  /** Mesma regra das telas: tabelas promocionais só para administradores. */
  isAdmin: boolean;
};

const PROMO_ADMIN_ONLY = "Tabelas promocionais só podem ser criadas ou editadas por administradores (mesma regra da tela).";

export type PendingRef = { id: string; type: string; title: string; summary: string };

// ───────────────────────── Sequências lógicas ─────────────────────────
export const GUIDED_SEQUENCES: Record<string, { titulo: string; passos: string[]; regras: string[] }> = {
  campanha_completa: {
    titulo: "Campanha completa (ex.: Black Friday)",
    passos: [
      "Perguntar: 'Como quer iniciar?' → 1) Tabela promocional  2) Campanha de grupos WhatsApp",
      "Executar a sequência da peça escolhida até o cartão de confirmação",
      "Após a confirmação, oferecer a próxima peça ainda não criada (ex.: grupos WhatsApp divulgando a tabela)",
      "Ao final, listar o que foi criado com os IDs reais retornados",
    ],
    regras: ["Cada peça tem seu próprio resumo e confirmação", "Nunca reutilizar preços de outra peça sem o usuário confirmar"],
  },
  tabela_promocional: {
    titulo: "Tabela promocional",
    passos: [
      "1. Nome da tabela (ex.: Black Friday 2026) e título do PDF (padrão TABELA PROMOCIONAL)",
      "2. Vigência: data de início e data de fim",
      "3. Moeda (BRL padrão) e vínculo opcional a evento ou distribuidor (use list_promo_reference_data)",
      "4. Combos/seções: título de cada combo",
      "5. Itens de cada combo: buscar com find_catalog_items, confirmar o produto exato, quantidade e PREÇO PROMOCIONAL informado pelo usuário (preço de mercado vem do catálogo)",
      "6. Cupom (opcional): tipo (percent/fixed), valor, prefixo, validade, limite de uso, vendedores",
      "7. Chamar prepare_promotional_table e pedir para o usuário conferir o resumo e clicar em Confirmar",
    ],
    regras: [
      "Nunca inventar produto, SKU ou preço promocional",
      "Se o produto não estiver no catálogo, só usar item personalizado com nome e preços ditos pelo usuário",
      "Os cupons em si são gerados na tela da tabela (sincronização Loja Integrada)",
    ],
  },
  campanha_grupos_whatsapp: {
    titulo: "Campanha de grupos WhatsApp",
    passos: [
      "1. Nome da campanha",
      "2. Grupos de destino (use list_wa_groups; mostre nome e instância e confirme a seleção)",
      "3. Início: agora ou data/hora futura",
      "4. Sequência de mensagens, uma por vez: texto, imagem (URL https), link (título + URL) e esperas entre elas (dias/horas/minutos e horário)",
      "5. Limites: intervalo entre grupos (padrão 30 s), limite diário (padrão 20) e janela anti-repetição (padrão 30 dias)",
      "6. Chamar prepare_wa_group_campaign e pedir para o usuário conferir e clicar em Confirmar",
    ],
    regras: ["Após Confirmar a campanha é ativada", "Nunca inventar link, preço ou cupom no texto"],
  },
};

// ───────────────────────── Tool definitions ─────────────────────────
const stepSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["msg", "wait", "image", "link"] },
    text: { type: "string", description: "msg: texto da mensagem" },
    mention_all: { type: "boolean" },
    days: { type: "number" }, hours: { type: "number" }, minutes: { type: "number" },
    time: { type: "string", description: "wait: horário HH:MM" },
    weekdays_only: { type: "boolean" },
    absolute_at: { type: "string", description: "wait: data/hora ISO exata (opcional)" },
    media_url: { type: "string", description: "image: URL https" },
    caption: { type: "string" },
    title: { type: "string" }, url: { type: "string" }, description: { type: "string" },
  },
  required: ["type"],
};

const itemSchema = {
  type: "object",
  properties: {
    catalog_product_id: { type: "string", description: "ID vindo de find_catalog_items" },
    catalog_variation_id: { type: "string", description: "ID da apresentação vindo de find_catalog_items" },
    name: { type: "string", description: "Obrigatório só para item personalizado" },
    quantity: { type: "number" },
    market_unit_price: { type: "number", description: "Opcional p/ catálogo (usa preço do catálogo); obrigatório p/ personalizado" },
    promotional_unit_price: { type: "number", description: "Preço promocional informado pelo usuário" },
    group_label: { type: "string" },
  },
  required: ["promotional_unit_price"],
};

export const guidedTools = [
  {
    type: "function",
    function: {
      name: "guided_creation_menu",
      description: "Retorna a sequência lógica de perguntas para CRIAR ou EDITAR algo no sistema. Chame SEMPRE que o usuário pedir para criar/montar/editar tabela promocional, tabela de preços de Black Friday, campanha de grupos WhatsApp ou 'campanha completa'.",
      parameters: { type: "object", properties: { kind: { type: "string", enum: Object.keys(GUIDED_SEQUENCES) } }, required: ["kind"] },
    },
  },
  {
    type: "function",
    function: {
      name: "find_catalog_items",
      description: "Busca produtos comerciais do catálogo (com apresentações/variações, SKU, preço e foto) para montar tabela promocional. Use os IDs retornados em prepare_promotional_table.",
      parameters: { type: "object", properties: { search: { type: "string" }, currency: { type: "string", enum: ["BRL", "USD", "EUR"] } }, required: ["search"] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_promo_reference_data",
      description: "Lista eventos próximos, distribuidores e vendedores ativos (para vincular tabela promocional e cupons).",
      parameters: { type: "object", properties: { search: { type: "string" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "list_promotional_tables",
      description: "Lista tabelas promocionais existentes (para editar ou consultar).",
      parameters: { type: "object", properties: { search: { type: "string" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "get_promotional_table",
      description: "Detalha uma tabela promocional: cabeçalho, combos e itens com IDs (para editar).",
      parameters: { type: "object", properties: { table_id: { type: "string" } }, required: ["table_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_promotional_table",
      description: "PREPARA criação (sem table_id) ou edição (com table_id) de tabela promocional. Não grava nada: devolve resumo e o cartão Confirmar/Cancelar para o usuário. Na edição, 'sections' são combos NOVOS acrescentados e 'item_updates' alteram itens existentes.",
      parameters: {
        type: "object",
        properties: {
          table_id: { type: "string" },
          name: { type: "string" }, pdf_title: { type: "string" },
          currency: { type: "string", enum: ["BRL", "USD", "EUR"] },
          valid_from: { type: "string", description: "YYYY-MM-DD" }, valid_until: { type: "string", description: "YYYY-MM-DD" },
          notes: { type: "string" }, event_id: { type: "string" }, distributor_id: { type: "string" },
          include_official_price_table: { type: "boolean" },
          coupon: {
            type: "object",
            properties: {
              discount_type: { type: "string", enum: ["percent", "fixed"] }, discount_value: { type: "number" },
              prefix: { type: "string" }, valid_from: { type: "string" }, valid_until: { type: "string" },
              usage_limit: { type: "number" }, usage_per_customer: { type: "number" },
              seller_ids: { type: "array", items: { type: "string" } },
            },
          },
          sections: {
            type: "array",
            items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, items: { type: "array", items: itemSchema } }, required: ["title", "items"] },
          },
          item_updates: {
            type: "array",
            items: { type: "object", properties: { item_id: { type: "string" }, quantity: { type: "number" }, market_unit_price: { type: "number" }, promotional_unit_price: { type: "number" } }, required: ["item_id"] },
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_wa_groups",
      description: "Lista grupos de WhatsApp disponíveis (nome, instância, membros, campanha ativa).",
      parameters: { type: "object", properties: { search: { type: "string" }, instance: { type: "string" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "list_wa_group_campaigns",
      description: "Lista campanhas de grupos WhatsApp existentes (para editar rascunhos).",
      parameters: { type: "object", properties: { search: { type: "string" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_wa_group_campaign",
      description: "PREPARA criação (sem campaign_id) ou edição de rascunho (com campaign_id) de campanha de grupos WhatsApp. Não grava: devolve resumo e cartão Confirmar/Cancelar. Após Confirmar a campanha é ativada.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string" },
          name: { type: "string" },
          group_ids: { type: "array", items: { type: "string" } },
          start_at: { type: "string", description: "ISO futura; vazio = começar agora" },
          daily_limit: { type: "number" }, delay_seconds: { type: "number" }, dedupe_window_days: { type: "number" },
          steps: { type: "array", items: stepSchema },
        },
        required: ["name", "steps"],
      },
    },
  },
];

export const GUIDED_TOOL_NAMES = new Set(guidedTools.map((t) => t.function.name));

// ───────────────────────── Validação (pura, testada) ─────────────────────────
const num = (v: any) => (v === null || v === undefined || v === "" ? null : Number(v));
const str = (v: any) => (typeof v === "string" ? v.trim() : "");

export function validatePromoInput(input: any, todayIso: string, isEdit: boolean) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const name = str(input?.name);
  if (!isEdit && !name) errors.push("Informe o nome da tabela.");
  if (name.length > 120) errors.push("Nome da tabela muito longo (máx. 120).");
  const currency = str(input?.currency) || (isEdit ? "" : "BRL");
  if (currency && !["BRL", "USD", "EUR"].includes(currency)) errors.push("Moeda inválida (use BRL, USD ou EUR).");
  const vf = str(input?.valid_from), vu = str(input?.valid_until);
  if (!isEdit && (!vf || !vu)) errors.push("Informe a vigência (início e fim).");
  if (vf && !DATE_RE.test(vf)) errors.push("Data de início inválida (use AAAA-MM-DD).");
  if (vu && !DATE_RE.test(vu)) errors.push("Data de fim inválida (use AAAA-MM-DD).");
  if (vf && vu && DATE_RE.test(vf) && DATE_RE.test(vu) && vu < vf) errors.push("A data de fim é anterior à de início.");
  if (!isEdit && vu && DATE_RE.test(vu) && vu < todayIso) errors.push("A vigência já terminou.");
  for (const k of ["event_id", "distributor_id"]) {
    if (input?.[k] && !UUID_RE.test(String(input[k]))) errors.push(`${k} inválido.`);
  }

  const sections = Array.isArray(input?.sections) ? input.sections : [];
  if (!isEdit && sections.length === 0) errors.push("Adicione pelo menos um combo com itens.");
  sections.forEach((s: any, si: number) => {
    const tag = `Combo ${si + 1}`;
    if (!str(s?.title)) errors.push(`${tag}: informe o título.`);
    const items = Array.isArray(s?.items) ? s.items : [];
    if (items.length === 0) errors.push(`${tag}: adicione pelo menos um item.`);
    items.forEach((it: any, ii: number) => {
      const itag = `${tag}, item ${ii + 1}`;
      const isCatalog = Boolean(it?.catalog_product_id || it?.catalog_variation_id);
      if (it?.catalog_product_id && !UUID_RE.test(String(it.catalog_product_id))) errors.push(`${itag}: produto inválido.`);
      if (it?.catalog_variation_id && !UUID_RE.test(String(it.catalog_variation_id))) errors.push(`${itag}: apresentação inválida.`);
      if (!isCatalog && !str(it?.name)) errors.push(`${itag}: item personalizado precisa de nome.`);
      const qty = num(it?.quantity) ?? 1;
      if (!(qty > 0)) errors.push(`${itag}: quantidade deve ser maior que zero.`);
      const promo = num(it?.promotional_unit_price);
      if (promo === null || Number.isNaN(promo)) errors.push(`${itag}: informe o preço promocional.`);
      else if (promo < 0) errors.push(`${itag}: preço promocional negativo.`);
      const market = num(it?.market_unit_price);
      if (!isCatalog && (market === null || Number.isNaN(market))) errors.push(`${itag}: item personalizado precisa do preço de mercado.`);
      if (market !== null && market < 0) errors.push(`${itag}: preço de mercado negativo.`);
    });
  });

  const updates = Array.isArray(input?.item_updates) ? input.item_updates : [];
  if (!isEdit && updates.length) errors.push("Alterações de itens só valem na edição de uma tabela existente.");
  updates.forEach((u: any, i: number) => {
    if (!UUID_RE.test(String(u?.item_id || ""))) errors.push(`Alteração ${i + 1}: item inválido.`);
    for (const k of ["quantity", "market_unit_price", "promotional_unit_price"]) {
      const v = num(u?.[k]);
      if (v !== null && (Number.isNaN(v) || v < 0)) errors.push(`Alteração ${i + 1}: ${k} inválido.`);
    }
    if (num(u?.quantity) === 0) errors.push(`Alteração ${i + 1}: quantidade deve ser maior que zero.`);
  });

  const c = input?.coupon;
  if (c) {
    const type = str(c.discount_type) || "percent";
    const value = num(c.discount_value);
    if (!["percent", "fixed"].includes(type)) errors.push("Cupom: tipo inválido.");
    if (value === null || !(value > 0)) errors.push("Cupom: informe um valor de desconto maior que zero.");
    if (type === "percent" && value !== null && value > 100) errors.push("Cupom: percentual acima de 100%.");
    if (c.valid_from && !DATE_RE.test(str(c.valid_from))) errors.push("Cupom: início inválido.");
    if (c.valid_until && !DATE_RE.test(str(c.valid_until))) errors.push("Cupom: fim inválido.");
    if (Array.isArray(c.seller_ids) && c.seller_ids.some((id: any) => !UUID_RE.test(String(id)))) errors.push("Cupom: vendedor inválido.");
  }
  if (isEdit && !sections.length && !updates.length && !c && !name && !vf && !vu && !input?.notes && !input?.pdf_title && !currency && input?.event_id === undefined && input?.distributor_id === undefined && input?.include_official_price_table === undefined) {
    errors.push("Nada a alterar.");
  }
  return { errors, warnings };
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export function validateWaInput(input: any, nowMs: number, isEdit: boolean) {
  const errors: string[] = [];
  const name = str(input?.name);
  if (!name) errors.push("Informe o nome da campanha.");
  const groups = Array.isArray(input?.group_ids) ? [...new Set(input.group_ids.map(String))] : [];
  if (!isEdit && groups.length === 0) errors.push("Selecione pelo menos um grupo.");
  if (groups.some((g) => !UUID_RE.test(g as string))) errors.push("Grupo inválido na seleção.");
  const steps = Array.isArray(input?.steps) ? input.steps : [];
  if (steps.length === 0) errors.push("Adicione pelo menos uma mensagem.");
  if (!steps.some((s: any) => s?.type !== "wait")) errors.push("A sequência precisa ter ao menos uma mensagem (não só esperas).");
  steps.forEach((s: any, i: number) => {
    const tag = `Etapa ${i + 1}`;
    switch (s?.type) {
      case "msg":
        if (!str(s.text)) errors.push(`${tag}: texto vazio.`);
        if (str(s.text).length > 4000) errors.push(`${tag}: texto acima de 4000 caracteres.`);
        break;
      case "wait": {
        if (s.absolute_at) {
          const t = Date.parse(s.absolute_at);
          if (Number.isNaN(t)) errors.push(`${tag}: data/hora inválida.`);
          else if (t <= nowMs) errors.push(`${tag}: data/hora deve ser futura.`);
        } else {
          const d = num(s.days) ?? 0, h = num(s.hours) ?? 0, m = num(s.minutes) ?? 0;
          if (d < 0 || h < 0 || m < 0) errors.push(`${tag}: tempo inválido.`);
          else if (d === 0 && h === 0 && m === 0) errors.push(`${tag}: defina dias, horas ou minutos (>0).`);
        }
        if (s.time && !HHMM.test(String(s.time))) errors.push(`${tag}: horário inválido (HH:MM).`);
        break;
      }
      case "image":
        if (!/^https:\/\//i.test(str(s.media_url))) errors.push(`${tag}: imagem precisa de URL https.`);
        break;
      case "link":
        if (!str(s.title)) errors.push(`${tag}: título do link obrigatório.`);
        if (!/^https?:\/\//i.test(str(s.url))) errors.push(`${tag}: URL do link inválida.`);
        break;
      default:
        errors.push(`${tag}: tipo não suportado (${s?.type}).`);
    }
  });
  if (input?.start_at) {
    const t = Date.parse(input.start_at);
    if (Number.isNaN(t)) errors.push("Início inválido.");
    else if (t <= nowMs) errors.push("O início deve ser futuro (ou deixe vazio para começar agora).");
  }
  const dl = num(input?.daily_limit) ?? 20, ds = num(input?.delay_seconds) ?? 30, dd = num(input?.dedupe_window_days) ?? 30;
  if (!(dl >= 1 && dl <= 500)) errors.push("Limite diário deve ficar entre 1 e 500.");
  if (!(ds >= 5 && ds <= 3600)) errors.push("Intervalo entre grupos deve ficar entre 5 e 3600 segundos.");
  if (!(dd >= 0 && dd <= 365)) errors.push("Janela anti-repetição deve ficar entre 0 e 365 dias.");
  return { errors, groups: groups as string[], limits: { daily_limit: dl, delay_seconds: ds, dedupe_window_days: dd } };
}

export function buildFlowNodes(steps: any[], idFn: () => string = () => crypto.randomUUID()) {
  return steps.map((s: any) => {
    const id = idFn();
    if (s.type === "msg") return { id, type: "msg", text: str(s.text), mention_all: s.mention_all === true };
    if (s.type === "wait") {
      return s.absolute_at
        ? { id, type: "wait", mode: "absolute", absolute_at: new Date(s.absolute_at).toISOString(), days: 0, hours: 0, minutes: 0, time: str(s.time) || "09:00", weekdays_only: false }
        : { id, type: "wait", mode: "relative", days: num(s.days) ?? 0, hours: num(s.hours) ?? 0, minutes: num(s.minutes) ?? 0, time: str(s.time) || "09:00", weekdays_only: s.weekdays_only === true };
    }
    if (s.type === "image") return { id, type: "image", media_url: str(s.media_url), caption: str(s.caption) };
    return { id, type: "link", title: str(s.title), description: str(s.description), url: str(s.url) };
  });
}

export function discountPct(market: number, promo: number) {
  return market > 0 ? Math.round(((market - promo) / market) * 1000) / 10 : 0;
}

const money = (v: number, cur = "BRL") => {
  try { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: cur }).format(v); } catch { return v.toFixed(2); }
};

// ───────────────────────── Executors ─────────────────────────
export function makeGuidedExecutors(ctx: GuidedCtx, onPending: (p: PendingRef) => void): Record<string, (a: any) => Promise<any>> {
  const { sb } = ctx;

  async function savePending(type: string, payload: any, summary: string, title: string) {
    const { data, error } = await sb.from("copilot_pending_actions")
      .insert({ user_id: ctx.userId, action_type: type, payload, summary })
      .select("id").single();
    if (error) return { error: `Não foi possível preparar a confirmação: ${error.message}` };
    onPending({ id: data.id, type, title, summary });
    return { success: true, pending_action_id: data.id, aguardando_confirmacao: true, instrucao: "Resumo e botões Confirmar/Cancelar já serão exibidos ao usuário. Não repita o resumo; diga apenas para conferir e confirmar." };
  }

  async function resolveCatalog(items: any[], currency: string) {
    const prodIds = [...new Set(items.map((i) => i.catalog_product_id).filter(Boolean))];
    const varIds = [...new Set(items.map((i) => i.catalog_variation_id).filter(Boolean))];
    const { data: vars } = varIds.length
      ? await sb.from("catalog_product_variations").select("id,catalog_product_id,presentation_qty,sku,price_brl,price_usd,price_eur").in("id", varIds)
      : { data: [] };
    for (const v of vars || []) prodIds.push(v.catalog_product_id);
    const { data: prods } = prodIds.length
      ? await sb.from("system_a_catalog").select("id,name,image_url,og_image_url,price,category,active,approved").in("id", [...new Set(prodIds)])
      : { data: [] };
    const pMap = new Map((prods || []).map((p: any) => [p.id, p]));
    const vMap = new Map((vars || []).map((v: any) => [v.id, v]));
    const priceKey = currency === "USD" ? "price_usd" : currency === "EUR" ? "price_eur" : "price_brl";
    return { pMap, vMap, priceKey };
  }

  return {
    guided_creation_menu: async (a) => {
      if (a?.kind === "tabela_promocional" && !ctx.isAdmin) return { error: PROMO_ADMIN_ONLY };
      return GUIDED_SEQUENCES[a?.kind] ?? { error: "Tipo desconhecido", opcoes: Object.keys(GUIDED_SEQUENCES) };
    },

    find_catalog_items: async (a) => {
      const term = str(a?.search).replace(/[%,()]/g, " ").trim();
      if (term.length < 2) return { error: "Informe ao menos 2 letras para buscar." };
      const currency = ["USD", "EUR"].includes(a?.currency) ? a.currency : "BRL";
      const { data: prods, error } = await sb.from("system_a_catalog")
        .select("id,name,image_url,og_image_url,price,category")
        .in("category", COMMERCIAL_TYPES).eq("active", true).eq("approved", true)
        .ilike("name", `%${term}%`).order("name").limit(15);
      if (error) return { error: error.message };
      const ids = (prods || []).map((p: any) => p.id);
      const { data: vars } = ids.length
        ? await sb.from("catalog_product_variations").select("id,catalog_product_id,presentation_qty,sku,price_brl,price_usd,price_eur,sort_order").in("catalog_product_id", ids).order("sort_order")
        : { data: [] };
      const priceKey = currency === "USD" ? "price_usd" : currency === "EUR" ? "price_eur" : "price_brl";
      const out: any[] = [];
      for (const p of prods || []) {
        const pv = (vars || []).filter((v: any) => v.catalog_product_id === p.id);
        const image = p.image_url || p.og_image_url || null;
        if (!pv.length) out.push({ catalog_product_id: p.id, catalog_variation_id: null, nome: p.name, apresentacao: null, sku: null, preco_catalogo: Number(p.price || 0), tem_foto: !!image });
        for (const v of pv) out.push({ catalog_product_id: p.id, catalog_variation_id: v.id, nome: p.name, apresentacao: v.presentation_qty, sku: v.sku, preco_catalogo: Number(v[priceKey] ?? p.price ?? 0), tem_foto: !!image });
      }
      return { moeda: currency, total: out.length, itens: out.slice(0, 40) };
    },

    list_promo_reference_data: async (a) => {
      const term = str(a?.search);
      const today = new Date().toISOString().slice(0, 10);
      let ev = sb.from("smartops_events").select("id,name,start_date").gte("start_date", today).order("start_date").limit(15);
      let ds = sb.from("distributors").select("id,razao_social,nome_fantasia").order("razao_social").limit(20);
      if (term) { ev = ev.ilike("name", `%${term}%`); ds = ds.or(`razao_social.ilike.%${term}%,nome_fantasia.ilike.%${term}%`); }
      const [e, d, s] = await Promise.all([
        ev, ds,
        sb.from("team_members").select("id,nome_completo,role").eq("ativo", true).in("role", ["vendedor", "cs", "marketing"]).order("nome_completo"),
      ]);
      return { eventos: e.data || [], distribuidores: d.data || [], vendedores: s.data || [] };
    },

    list_promotional_tables: async (a) => {
      let q = sb.from("promotional_tables").select("id,name,status,valid_from,valid_until,currency,event_id").order("created_at", { ascending: false }).limit(20);
      if (str(a?.search)) q = q.ilike("name", `%${str(a.search)}%`);
      const { data, error } = await q;
      return error ? { error: error.message } : { tabelas: data };
    },

    get_promotional_table: async (a) => {
      if (!UUID_RE.test(String(a?.table_id || ""))) return { error: "table_id inválido" };
      const { data: t } = await sb.from("promotional_tables").select("id,name,pdf_title,status,currency,valid_from,valid_until,notes,event_id,distributor_id,coupon_discount_type,coupon_discount_value,coupon_prefix,coupon_valid_from,coupon_valid_until").eq("id", a.table_id).maybeSingle();
      if (!t) return { error: "Tabela não encontrada" };
      const { data: secs } = await sb.from("promotional_table_sections").select("id,title,sort_order").eq("promotional_table_id", t.id).order("sort_order");
      const ids = (secs || []).map((s: any) => s.id);
      const { data: items } = ids.length ? await sb.from("promotional_table_items").select("id,section_id,name,sku,quantity,market_unit_price,promotional_unit_price").in("section_id", ids).order("sort_order") : { data: [] };
      return { tabela: t, combos: (secs || []).map((s: any) => ({ ...s, itens: (items || []).filter((i: any) => i.section_id === s.id) })) };
    },

    prepare_promotional_table: async (a) => {
      if (!ctx.isAdmin) return { success: false, errors: [PROMO_ADMIN_ONLY] };
      const isEdit = Boolean(a?.table_id);
      if (isEdit && !UUID_RE.test(String(a.table_id))) return { error: "table_id inválido" };
      const today = new Date().toISOString().slice(0, 10);
      const v = validatePromoInput(a, today, isEdit);
      if (v.errors.length) return { success: false, errors: v.errors, instrucao: "Pergunte ao usuário o que falta/está errado. Não prepare até corrigir." };

      let existing: any = null;
      if (isEdit) {
        const { data } = await sb.from("promotional_tables").select("id,name,currency,status,valid_from,valid_until").eq("id", a.table_id).maybeSingle();
        if (!data) return { error: "Tabela não encontrada" };
        existing = data;
      }
      const currency = str(a.currency) || existing?.currency || "BRL";
      const allItems = (a.sections || []).flatMap((s: any) => s.items || []);
      const { pMap, vMap, priceKey } = await resolveCatalog(allItems, currency);
      const warnings: string[] = [...v.warnings];
      const errors: string[] = [];

      const sections = (a.sections || []).map((s: any, si: number) => ({
        title: str(s.title), description: str(s.description) || null,
        items: (s.items || []).map((it: any, ii: number) => {
          const variation: any = it.catalog_variation_id ? vMap.get(it.catalog_variation_id) : null;
          const productId = variation?.catalog_product_id || it.catalog_product_id || null;
          const product: any = productId ? pMap.get(productId) : null;
          if ((it.catalog_variation_id && !variation) || (productId && !product)) {
            errors.push(`Combo ${si + 1}, item ${ii + 1}: produto não encontrado no catálogo.`);
          } else if (product && (!COMMERCIAL_TYPES.includes(product.category) || !product.active)) {
            errors.push(`Combo ${si + 1}, item ${ii + 1}: ${product.name} não é produto comercial ativo.`);
          }
          const catalogPrice = variation ? Number(variation[priceKey] ?? product?.price ?? 0) : Number(product?.price ?? 0);
          const market = num(it.market_unit_price) ?? (product ? catalogPrice : 0);
          const promo = Number(it.promotional_unit_price);
          const name = product ? (variation?.presentation_qty ? `${product.name} — ${variation.presentation_qty}` : product.name) : str(it.name);
          if (promo > market) warnings.push(`${name}: preço promocional maior que o de mercado.`);
          return {
            item_type: product ? "catalog" : "custom",
            catalog_product_id: product ? product.id : null,
            catalog_variation_id: variation ? variation.id : null,
            name, sku: variation?.sku ?? null,
            image_url: product ? (product.image_url || product.og_image_url || null) : null,
            quantity: num(it.quantity) ?? 1, market_unit_price: market, promotional_unit_price: promo,
            group_label: str(it.group_label) || null,
          };
        }),
      }));
      if (errors.length) return { success: false, errors };

      let couponSellers: any[] = [];
      if (a.coupon?.seller_ids?.length) {
        const { data } = await sb.from("team_members").select("id,nome_completo").in("id", a.coupon.seller_ids).eq("ativo", true);
        couponSellers = data || [];
        if (couponSellers.length !== new Set(a.coupon.seller_ids).size) return { success: false, errors: ["Cupom: vendedor não encontrado ou inativo."] };
      }
      const refs: string[] = [];
      if (a.event_id) {
        const { data } = await sb.from("smartops_events").select("name").eq("id", a.event_id).maybeSingle();
        if (!data) return { success: false, errors: ["Evento não encontrado."] };
        refs.push(`Evento: ${data.name}`);
      }
      if (a.distributor_id) {
        const { data } = await sb.from("distributors").select("razao_social,nome_fantasia").eq("id", a.distributor_id).maybeSingle();
        if (!data) return { success: false, errors: ["Distribuidor não encontrado."] };
        refs.push(`Distribuidor: ${data.nome_fantasia || data.razao_social}`);
      }

      const header: Record<string, any> = {};
      for (const k of ["name", "pdf_title", "valid_from", "valid_until", "notes"]) if (str(a[k])) header[k] = str(a[k]);
      if (str(a.currency)) header.currency = currency;
      if (a.event_id !== undefined) header.event_id = a.event_id || null;
      if (a.distributor_id !== undefined) header.distributor_id = a.distributor_id || null;
      if (typeof a.include_official_price_table === "boolean") header.include_official_price_table = a.include_official_price_table;
      if (a.coupon) {
        header.coupon_discount_type = a.coupon.discount_type || "percent";
        header.coupon_discount_value = Number(a.coupon.discount_value);
        header.coupon_prefix = str(a.coupon.prefix) || null;
        header.coupon_valid_from = str(a.coupon.valid_from) || header.valid_from || null;
        header.coupon_valid_until = str(a.coupon.valid_until) || header.valid_until || null;
        header.coupon_usage_limit = num(a.coupon.usage_limit);
        header.coupon_usage_per_customer = num(a.coupon.usage_per_customer);
        header.coupon_seller_ids = couponSellers.map((s) => s.id);
      }
      const itemUpdates = (a.item_updates || []).map((u: any) => ({ item_id: u.item_id, quantity: num(u.quantity), market_unit_price: num(u.market_unit_price), promotional_unit_price: num(u.promotional_unit_price) }));
      if (itemUpdates.length) {
        const { data: own } = await sb.from("promotional_table_items").select("id, promotional_table_sections!inner(promotional_table_id)").in("id", itemUpdates.map((u: any) => u.item_id));
        const ok = (own || []).filter((r: any) => r.promotional_table_sections?.promotional_table_id === a.table_id).length;
        if (ok !== itemUpdates.length) return { success: false, errors: ["Algum item alterado não pertence a esta tabela."] };
      }

      // Resumo
      const lines: string[] = [];
      const title = isEdit ? `Editar tabela promocional: ${existing.name}` : `Nova tabela promocional: ${header.name}`;
      lines.push(`### ${title}`);
      if (header.name && isEdit) lines.push(`- Novo nome: **${header.name}**`);
      if (header.valid_from || header.valid_until) lines.push(`- Vigência: ${header.valid_from || existing?.valid_from || "—"} a ${header.valid_until || existing?.valid_until || "—"}`);
      lines.push(`- Moeda: ${currency}`);
      refs.forEach((r) => lines.push(`- ${r}`));
      if (!isEdit) lines.push(`- Situação após confirmar: **ativa**`);
      for (const s of sections) {
        lines.push("", `**${s.title}**`, "| Item | Qtd. | Mercado | Promocional | Desconto |", "|---|---|---|---|---|");
        let tm = 0, tp = 0;
        for (const it of s.items) {
          tm += it.market_unit_price * it.quantity; tp += it.promotional_unit_price * it.quantity;
          lines.push(`| ${it.name}${it.item_type === "custom" ? " (personalizado)" : ""} | ${it.quantity} | ${money(it.market_unit_price, currency)} | ${money(it.promotional_unit_price, currency)} | ${discountPct(it.market_unit_price, it.promotional_unit_price)}% |`);
        }
        lines.push(`| **Total do combo** |  | ${money(tm, currency)} | ${money(tp, currency)} | ${discountPct(tm, tp)}% |`);
      }
      if (itemUpdates.length) lines.push("", `- ${itemUpdates.length} item(ns) existente(s) com quantidade/preço alterados`);
      if (a.coupon) {
        lines.push("", `- Cupom: ${header.coupon_discount_type === "percent" ? `${header.coupon_discount_value}%` : money(header.coupon_discount_value, currency)} de desconto, prefixo ${header.coupon_prefix || "—"}, validade ${header.coupon_valid_from || "—"} a ${header.coupon_valid_until || "—"}${couponSellers.length ? `, vendedores: ${couponSellers.map((s) => s.nome_completo).join(", ")}` : ""}`);
        lines.push(`- _Os códigos de cupom são gerados na tela da tabela (sincronização com a loja)._`);
      }
      if (warnings.length) lines.push("", ...warnings.map((w) => `- ⚠️ ${w}`));
      const summary = lines.join("\n");

      return savePending("promo_table", { table_id: a.table_id || null, header, sections, item_updates: itemUpdates }, summary, title);
    },

    list_wa_groups: async (a) => {
      let q = sb.from("wa_groups").select("id,name,instance_name,member_count,active_campaign_id,enabled,ativo").neq("ativo", false).order("name").limit(60);
      if (str(a?.search)) q = q.ilike("name", `%${str(a.search)}%`);
      if (str(a?.instance)) q = q.eq("instance_name", str(a.instance));
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { grupos: (data || []).filter((g: any) => g.enabled !== false).map((g: any) => ({ id: g.id, nome: g.name, instancia: g.instance_name, membros: g.member_count, ja_tem_campanha: !!g.active_campaign_id })) };
    },

    list_wa_group_campaigns: async (a) => {
      let q = sb.from("wa_campaigns").select("id,name,status,started_at,created_at").eq("wa_type", "groups").order("created_at", { ascending: false }).limit(20);
      if (str(a?.search)) q = q.ilike("name", `%${str(a.search)}%`);
      const { data, error } = await q;
      return error ? { error: error.message } : { campanhas: data };
    },

    prepare_wa_group_campaign: async (a) => {
      const isEdit = Boolean(a?.campaign_id);
      if (isEdit && !UUID_RE.test(String(a.campaign_id))) return { error: "campaign_id inválido" };
      const v = validateWaInput(a, Date.now(), isEdit);
      if (v.errors.length) return { success: false, errors: v.errors, instrucao: "Pergunte ao usuário o que falta/está errado." };
      let existing: any = null;
      if (isEdit) {
        const { data } = await sb.from("wa_campaigns").select("id,name,status,started_at").eq("id", a.campaign_id).maybeSingle();
        if (!data) return { error: "Campanha não encontrada" };
        if (data.status !== "draft") return { success: false, errors: [`Só é possível editar campanhas em rascunho pelo Copilot (atual: ${data.status}). Use a tela de campanhas.`] };
        existing = data;
      }
      let groupRows: any[] = [];
      if (v.groups.length) {
        const { data } = await sb.from("wa_groups").select("id,name,instance_name,active_campaign_id,enabled,ativo").in("id", v.groups);
        groupRows = (data || []).filter((g: any) => g.ativo !== false && g.enabled !== false);
        if (groupRows.length !== v.groups.length) return { success: false, errors: ["Algum grupo não existe ou está desativado. Use list_wa_groups."] };
      }
      if (isEdit && v.groups.length) return { success: false, errors: ["Para trocar grupos de uma campanha existente use a tela de campanhas."] };
      const nodes = buildFlowNodes(a.steps);
      const title = isEdit ? `Editar campanha de grupos: ${existing.name}` : `Nova campanha de grupos: ${str(a.name)}`;
      const lines = [`### ${title}`];
      if (groupRows.length) lines.push(`- Grupos (${groupRows.length}): ${groupRows.map((g) => `${g.name} (${g.instance_name})`).join(", ")}`);
      lines.push(`- Início: ${a.start_at ? new Date(a.start_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "assim que confirmar"}`);
      lines.push(`- Intervalo entre grupos: ${v.limits.delay_seconds}s · limite diário: ${v.limits.daily_limit} · anti-repetição: ${v.limits.dedupe_window_days} dias`);
      lines.push(`- Após confirmar: **campanha ativada**`, "", "**Sequência**");
      nodes.forEach((n: any, i: number) => {
        if (n.type === "msg") lines.push(`${i + 1}. 💬 ${n.text.replace(/\n+/g, " ").slice(0, 280)}${n.mention_all ? " (marca todos)" : ""}`);
        else if (n.type === "wait") lines.push(`${i + 1}. ⏳ ${n.mode === "absolute" ? `até ${new Date(n.absolute_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : `esperar ${[n.days ? `${n.days} dia(s)` : "", n.hours ? `${n.hours}h` : "", n.minutes ? `${n.minutes}min` : ""].filter(Boolean).join(" ")}${n.days ? `, envio às ${n.time}` : ""}${n.weekdays_only ? " (dias úteis)" : ""}`}`);
        else if (n.type === "image") lines.push(`${i + 1}. 🖼️ Imagem ${n.media_url}${n.caption ? ` — ${n.caption.slice(0, 160)}` : ""}`);
        else lines.push(`${i + 1}. 🔗 ${n.title} — ${n.url}`);
      });
      const busy = groupRows.filter((g) => g.active_campaign_id);
      if (busy.length) lines.push("", `- ⚠️ ${busy.length} grupo(s) já têm outra campanha ativa vinculada.`);
      const summary = lines.join("\n");
      return savePending("wa_group_campaign", {
        campaign_id: a.campaign_id || null, name: str(a.name), group_ids: v.groups,
        start_at: a.start_at ? new Date(a.start_at).toISOString() : null, flow_json: nodes, ...v.limits,
      }, summary, title);
    },
  };
}

// ───────────────────────── Execução após Confirmar ─────────────────────────
async function runPromo(ctx: GuidedCtx, p: any) {
  const { sb } = ctx;
  if (!ctx.isAdmin) throw new Error(PROMO_ADMIN_ONLY);
  let tableId = p.table_id;
  const created: any = { sections: 0, items: 0, updated_items: 0 };
  if (!tableId) {
    const { data, error } = await sb.from("promotional_tables")
      .insert({ ...p.header, status: "draft", created_by: ctx.userId }).select("id,name").single();
    if (error) throw new Error(`Tabela: ${error.message}`);
    tableId = data.id;
  } else if (Object.keys(p.header || {}).length) {
    const { error } = await sb.from("promotional_tables").update(p.header).eq("id", tableId);
    if (error) throw new Error(`Tabela: ${error.message}`);
  }
  const { count } = await sb.from("promotional_table_sections").select("id", { count: "exact", head: true }).eq("promotional_table_id", tableId);
  let order = count || 0;
  for (const s of p.sections || []) {
    const { data: sec, error } = await sb.from("promotional_table_sections")
      .insert({ promotional_table_id: tableId, title: s.title, description: s.description, sort_order: order++ }).select("id").single();
    if (error) throw new Error(`Combo "${s.title}": ${error.message} (tabela ${tableId} ficou em rascunho)`);
    created.sections++;
    const rows = (s.items || []).map((it: any, i: number) => ({ ...it, section_id: sec.id, sort_order: i }));
    if (rows.length) {
      const { error: ie } = await sb.from("promotional_table_items").insert(rows);
      if (ie) throw new Error(`Itens de "${s.title}": ${ie.message} (tabela ${tableId} ficou em rascunho)`);
      created.items += rows.length;
    }
  }
  for (const u of p.item_updates || []) {
    const patch: any = {};
    for (const k of ["quantity", "market_unit_price", "promotional_unit_price"]) if (u[k] !== null && u[k] !== undefined) patch[k] = u[k];
    if (!Object.keys(patch).length) continue;
    const { error } = await sb.from("promotional_table_items").update(patch).eq("id", u.item_id);
    if (error) throw new Error(`Item ${u.item_id}: ${error.message}`);
    created.updated_items++;
  }
  if (!p.table_id) {
    const { error } = await sb.from("promotional_tables").update({ status: "active" }).eq("id", tableId);
    if (error) throw new Error(`Ativação: ${error.message} (tabela ${tableId} ficou em rascunho)`);
  }
  return { table_id: tableId, ...created };
}

async function runWa(ctx: GuidedCtx, p: any) {
  const { sb } = ctx;
  let cid = p.campaign_id;
  const base: any = { name: p.name, flow_json: p.flow_json, daily_limit: p.daily_limit, delay_seconds: p.delay_seconds, dedupe_window_days: p.dedupe_window_days, started_at: p.start_at, status: "draft" };
  if (cid) {
    const { data: cur } = await sb.from("wa_campaigns").select("status").eq("id", cid).maybeSingle();
    if (!cur || cur.status !== "draft") throw new Error("A campanha não está mais em rascunho.");
    const { error } = await sb.from("wa_campaigns").update(base).eq("id", cid);
    if (error) throw new Error(error.message);
  } else {
    const single = p.group_ids.length === 1;
    const { data, error } = await sb.from("wa_campaigns")
      .insert({ ...base, group_id: single ? p.group_ids[0] : null, wa_type: "groups", campaign_type: "flow", created_by: ctx.userId })
      .select("id").single();
    if (error) throw new Error(error.message);
    cid = data.id;
    if (single) {
      await sb.from("wa_groups").update({ active_campaign_id: cid }).eq("id", p.group_ids[0]).is("active_campaign_id", null);
    } else {
      const { error: le } = await sb.from("wa_campaign_groups").insert(p.group_ids.map((g: string) => ({ campaign_id: cid, group_id: g })));
      if (le) throw new Error(`Vínculo de grupos: ${le.message} (campanha ${cid} ficou em rascunho)`);
    }
  }
  const res = await fetch(`${ctx.supabaseUrl}/functions/v1/wa-campaign-builder`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.serviceKey}`, apikey: ctx.serviceKey },
    body: JSON.stringify({ campaign_id: cid }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.ok === false) throw new Error(`Campanha ${cid} salva em rascunho, mas a ativação falhou: ${body?.error || res.status}`);
  return { campaign_id: cid, ativacao: body };
}

export async function executePendingAction(ctx: GuidedCtx, id: string, decision: "confirm" | "cancel") {
  const { sb } = ctx;
  if (!UUID_RE.test(String(id || ""))) return { ok: false, content: "❌ Ação inválida." };
  const { data: row } = await sb.from("copilot_pending_actions").select("*").eq("id", id).eq("user_id", ctx.userId).maybeSingle();
  if (!row) return { ok: false, content: "❌ Ação não encontrada para o seu usuário." };
  if (row.status !== "pending") return { ok: false, content: `ℹ️ Esta ação já foi tratada (situação: ${row.status}).` };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await sb.from("copilot_pending_actions").update({ status: "expired", decided_at: new Date().toISOString() }).eq("id", id).eq("status", "pending");
    return { ok: false, content: "⌛ Esta confirmação expirou (2 horas). Peça ao Copilot para preparar de novo." };
  }
  if (decision === "cancel") {
    await sb.from("copilot_pending_actions").update({ status: "cancelled", decided_at: new Date().toISOString() }).eq("id", id).eq("status", "pending");
    return { ok: true, content: "🚫 Cancelado. Nada foi gravado." };
  }
  // Claim atômico: impede dupla execução em clique duplo.
  const { data: claimed } = await sb.from("copilot_pending_actions")
    .update({ status: "executing", decided_at: new Date().toISOString() }).eq("id", id).eq("status", "pending").select("id");
  if (!claimed?.length) return { ok: false, content: "ℹ️ Esta ação já está sendo executada." };
  try {
    const result = row.action_type === "promo_table" ? await runPromo(ctx, row.payload) : await runWa(ctx, row.payload);
    await sb.from("copilot_pending_actions").update({ status: "executed", result }).eq("id", id);
    if (row.action_type === "promo_table") {
      const r: any = result;
      return { ok: true, result, content: `✅ **Tabela promocional ${row.payload.table_id ? "atualizada" : "criada e ativa"}.**\n- ID: ${r.table_id}\n- Combos adicionados: ${r.sections} · itens: ${r.items}${r.updated_items ? ` · itens alterados: ${r.updated_items}` : ""}\n- Abra em Catálogo › Tabelas promocionais para gerar cupons e o PDF.` };
    }
    const r: any = result;
    return { ok: true, result, content: `✅ **Campanha de grupos ${row.payload.campaign_id ? "atualizada" : "criada"} e ativada.**\n- ID: ${r.campaign_id}\n- Grupos: ${r.ativacao?.groups ?? "—"} · mensagens na fila: ${r.ativacao?.queued ?? 0}\n- Primeiro envio: ${r.ativacao?.first_send ? new Date(r.ativacao.first_send).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "conforme agenda"}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from("copilot_pending_actions").update({ status: "failed", error: msg }).eq("id", id);
    return { ok: false, content: `❌ Falha ao gravar: ${msg}` };
  }
}

export function renderPendingBlock(p: PendingRef) {
  return `${p.summary}\n\n\`\`\`${ACTION_MARKER}\n${JSON.stringify({ id: p.id, type: p.type, title: p.title })}\n\`\`\``;
}

export function stripActionMarkers(text: string) {
  return String(text || "").replace(new RegExp("```" + ACTION_MARKER + "[\\s\\S]*?```", "g"), "").trim();
}
