/**
 * Resolução de produto para itens da Loja Integrada.
 *
 * Escopo: exclusivamente Loja Integrada. Não altera regras de catálogo,
 * de CRM ou de qualquer outra integração — apenas traduz o item de um
 * pedido da loja para um produto/variação do catálogo.
 *
 * A cadeia é deliberadamente ordenada da chave mais forte para a mais fraca,
 * e cada resultado carrega `matched_by` para que a origem da decisão seja
 * auditável depois.
 *
 *   1. sku_exato        — SKU do item bate com catalog_product_variations.sku
 *   2. alias_sku        — alias por nome resolve para um SKU do catálogo
 *   3. alias_nome       — alias por nome resolve só o nome canônico
 *   4. nome_exato       — nome do item bate com system_a_catalog.name
 *   5. sku_base         — SKU sem o sufixo de variante ("-250g") bate
 *   6. nome_aproximado  — comparação com pontuação/espaços colapsados
 *
 * `normNome` espelha exatamente a função SQL `public.painel_nome_norm`,
 * que já indexa `produto_aliases`. Manter as duas idênticas é o que evita
 * a divergência de normalização entre a view e o resolver.
 */

const ACENTOS_DE = "ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç";
const ACENTOS_PARA = "AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc";

/** Espelho TS de public.painel_nome_norm(text). */
export function normNome(valor: string | null | undefined): string {
  const s = String(valor ?? "");
  let out = "";
  for (const ch of s) {
    const i = ACENTOS_DE.indexOf(ch);
    out += i >= 0 ? ACENTOS_PARA[i] : ch;
  }
  return out.toLowerCase().trim();
}

/** Normalização tolerante: colapsa pontuação e espaços repetidos. */
export function normLoose(valor: string | null | undefined): string {
  return normNome(valor).replace(/[^a-z0-9]+/g, " ").trim();
}

/** SKU comparável: maiúsculas, sem espaços nas pontas. */
export function normSku(valor: string | null | undefined): string {
  return String(valor ?? "").trim().toUpperCase();
}

/**
 * Remove o sufixo de variante que a Loja Integrada acrescenta por gramatura
 * ("JQDMYATZP-250g" → "JQDMYATZP"). Devolve "" quando não há sufixo, para
 * que o chamador não tente casar o SKU inteiro duas vezes.
 */
export function skuBase(valor: string | null | undefined): string {
  const s = normSku(valor);
  const corte = s.lastIndexOf("-");
  if (corte <= 0) return "";
  const base = s.slice(0, corte);
  return base.length >= 3 ? base : "";
}

export type LiMatchedBy =
  | "sku_exato"
  | "alias_sku"
  | "alias_nome"
  | "nome_exato"
  | "sku_base"
  | "nome_aproximado";

export interface LiSkuMatch {
  sku_interno: string | null;
  nome_canonico: string | null;
  catalog_variation_id: string | null;
  catalog_product_id: string | null;
  matched_by: LiMatchedBy | null;
  confidence: number;
}

const SEM_MATCH: LiSkuMatch = {
  sku_interno: null,
  nome_canonico: null,
  catalog_variation_id: null,
  catalog_product_id: null,
  matched_by: null,
  confidence: 0,
};

interface VariacaoRef {
  variation_id: string;
  catalog_product_id: string | null;
  sku: string;
}

interface AliasRef {
  sku_interno: string | null;
  nome_canonico: string;
}

export interface LiCatalogIndex {
  porSku: Map<string, VariacaoRef>;
  porSkuBase: Map<string, VariacaoRef>;
  aliasPorNome: Map<string, AliasRef>;
  aliasPorNomeLoose: Map<string, AliasRef>;
  produtoPorNome: Map<string, string>;
  produtoPorNomeLoose: Map<string, string>;
  tamanho: { variacoes: number; aliases: number; produtos: number };
}

/** Índice vazio — usado como degradação quando o catálogo não pôde ser lido. */
export function emptyCatalogIndex(): LiCatalogIndex {
  return {
    porSku: new Map(),
    porSkuBase: new Map(),
    aliasPorNome: new Map(),
    aliasPorNomeLoose: new Map(),
    produtoPorNome: new Map(),
    produtoPorNomeLoose: new Map(),
    tamanho: { variacoes: 0, aliases: 0, produtos: 0 },
  };
}

/**
 * Carrega catálogo, variações e aliases numa única vez por invocação.
 * As três tabelas somam poucas centenas de linhas, então o índice cabe
 * em memória com folga e evita uma consulta por item de pedido.
 */
export async function buildLiCatalogIndex(
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<LiCatalogIndex> {
  const idx = emptyCatalogIndex();

  const [variacoes, aliases, produtos] = await Promise.all([
    supabase
      .from("catalog_product_variations")
      .select("id, sku, catalog_product_id")
      .not("sku", "is", null)
      .limit(5000),
    supabase
      .from("produto_aliases")
      .select("nome_variante, nome_canonico, sku_interno, ativo")
      .eq("ativo", true)
      .limit(5000),
    supabase
      .from("system_a_catalog")
      .select("id, name")
      .not("name", "is", null)
      .limit(5000),
  ]);

  for (const v of variacoes?.data ?? []) {
    const sku = normSku(v.sku);
    if (!sku) continue;
    const ref: VariacaoRef = {
      variation_id: v.id,
      catalog_product_id: v.catalog_product_id ?? null,
      sku: v.sku,
    };
    if (!idx.porSku.has(sku)) idx.porSku.set(sku, ref);
    const base = skuBase(sku);
    if (base && !idx.porSkuBase.has(base)) idx.porSkuBase.set(base, ref);
  }

  for (const a of aliases?.data ?? []) {
    const ref: AliasRef = {
      sku_interno: a.sku_interno ?? null,
      nome_canonico: a.nome_canonico,
    };
    const k = normNome(a.nome_variante);
    if (k && !idx.aliasPorNome.has(k)) idx.aliasPorNome.set(k, ref);
    const kl = normLoose(a.nome_variante);
    if (kl && !idx.aliasPorNomeLoose.has(kl)) idx.aliasPorNomeLoose.set(kl, ref);
  }

  for (const p of produtos?.data ?? []) {
    const k = normNome(p.name);
    if (k && !idx.produtoPorNome.has(k)) idx.produtoPorNome.set(k, p.id);
    const kl = normLoose(p.name);
    if (kl && !idx.produtoPorNomeLoose.has(kl)) idx.produtoPorNomeLoose.set(kl, p.id);
  }

  idx.tamanho = {
    variacoes: idx.porSku.size,
    aliases: idx.aliasPorNome.size,
    produtos: idx.produtoPorNome.size,
  };
  return idx;
}

// O isolate da edge function é reaproveitado entre requisições, e o catálogo
// muda em escala de dias, não de segundos. Um TTL curto evita reconstruir o
// índice (3 consultas) a cada pedido recebido sem deixar a curadoria de SKU
// demorar a surtir efeito.
const TTL_MS = 5 * 60 * 1000;
let cacheIdx: LiCatalogIndex | null = null;
let cacheEm = 0;

/** Índice com cache por isolate. Use no caminho quente (webhook). */
export async function getLiCatalogIndex(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  opts: { forcar?: boolean } = {},
): Promise<LiCatalogIndex> {
  const agora = Date.now();
  if (!opts.forcar && cacheIdx && agora - cacheEm < TTL_MS) return cacheIdx;
  try {
    cacheIdx = await buildLiCatalogIndex(supabase);
    cacheEm = agora;
  } catch (e) {
    console.warn("[li-sku-match] falha ao montar índice do catálogo:", e);
    // Sem índice, os itens são gravados como pendentes em vez de se perderem.
    if (!cacheIdx) cacheIdx = emptyCatalogIndex();
  }
  return cacheIdx;
}

function daVariacao(
  v: VariacaoRef,
  matched_by: LiMatchedBy,
  confidence: number,
  nome_canonico: string | null = null,
): LiSkuMatch {
  return {
    sku_interno: v.sku,
    nome_canonico,
    catalog_variation_id: v.variation_id,
    catalog_product_id: v.catalog_product_id,
    matched_by,
    confidence,
  };
}

/**
 * Resolve um item de pedido da loja contra o índice do catálogo.
 * Devolve sempre um objeto — `matched_by: null` significa "não resolvido",
 * que é o insumo legítimo da fila de curadoria manual.
 */
export function matchLiItem(
  idx: LiCatalogIndex,
  item: { sku?: string | null; nome?: string | null },
): LiSkuMatch {
  const sku = normSku(item.sku);
  const nome = normNome(item.nome);
  const nomeLoose = normLoose(item.nome);

  // 1. SKU do item bate direto com uma variação do catálogo.
  if (sku) {
    const v = idx.porSku.get(sku);
    if (v) return daVariacao(v, "sku_exato", 1);
  }

  // 2/3. Alias curado por nome — resolve o SKU quando o alias tem um.
  if (nome) {
    const a = idx.aliasPorNome.get(nome);
    if (a) {
      const v = a.sku_interno ? idx.porSku.get(normSku(a.sku_interno)) : undefined;
      if (v) return daVariacao(v, "alias_sku", 0.95, a.nome_canonico);
      return {
        sku_interno: a.sku_interno,
        nome_canonico: a.nome_canonico,
        catalog_variation_id: null,
        catalog_product_id: idx.produtoPorNome.get(normNome(a.nome_canonico)) ?? null,
        matched_by: "alias_nome",
        confidence: 0.85,
      };
    }
  }

  // 4. Nome do item bate com o nome de um produto do catálogo.
  if (nome) {
    const produtoId = idx.produtoPorNome.get(nome);
    if (produtoId) {
      return {
        sku_interno: null,
        nome_canonico: null,
        catalog_variation_id: null,
        catalog_product_id: produtoId,
        matched_by: "nome_exato",
        confidence: 0.8,
      };
    }
  }

  // 5. SKU sem o sufixo de variante — só compensa depois que o catálogo
  //    passar a registrar os SKUs no formato que a loja emite.
  const base = skuBase(sku);
  if (base) {
    const v = idx.porSku.get(base) ?? idx.porSkuBase.get(base);
    if (v) return daVariacao(v, "sku_base", 0.7);
  }

  // 6. Última tentativa: nome com pontuação e espaços colapsados.
  if (nomeLoose) {
    const a = idx.aliasPorNomeLoose.get(nomeLoose);
    if (a) {
      const v = a.sku_interno ? idx.porSku.get(normSku(a.sku_interno)) : undefined;
      return {
        sku_interno: a.sku_interno,
        nome_canonico: a.nome_canonico,
        catalog_variation_id: v?.variation_id ?? null,
        catalog_product_id: v?.catalog_product_id ??
          idx.produtoPorNomeLoose.get(normLoose(a.nome_canonico)) ?? null,
        matched_by: "nome_aproximado",
        confidence: 0.6,
      };
    }
    const produtoId = idx.produtoPorNomeLoose.get(nomeLoose);
    if (produtoId) {
      return {
        sku_interno: null,
        nome_canonico: null,
        catalog_variation_id: null,
        catalog_product_id: produtoId,
        matched_by: "nome_aproximado",
        confidence: 0.6,
      };
    }
  }

  return { ...SEM_MATCH };
}
