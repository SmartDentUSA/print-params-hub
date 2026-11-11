// Roteiro do passo a passo "Tabela promocional" — segue a tela
// Catálogo › Tabelas promocionais campo a campo:
// Dados da promoção → Cupons → Seções do combo (combos e itens) → Salvar.
import type { WizardQuestion, WizardScript, WizardAnswer } from "./copilotWizard.ts";
import { WIZ_CONFIRM, WIZ_CANCEL, WIZ_SKIP } from "./copilotWizard.ts";
import {
  parseDateBR, parseMoneyBR, parseQuantity, parseYesNo, matchOption, formatDateBR, money, discountPct,
  type WizardOption,
} from "./copilotWizardParse.ts";

export type PromoRef = { id: string; label: string; date?: string | null };
export type CatalogHit = {
  productId: string; variationId: string | null; name: string; variation: string | null;
  sku: string | null; price: number;
};
export type PromoDeps = {
  loadEvents(): Promise<PromoRef[]>;
  loadDistributors(): Promise<PromoRef[]>;
  /** Vendedores do formulário do evento (pré-selecionados) ou toda a equipe ativa. */
  loadSellers(eventId: string | null): Promise<{ sellers: PromoRef[]; preselected: string[] }>;
  searchCatalog(term: string, currency: string): Promise<CatalogHit[]>;
};

export type PromoItemDraft = {
  kind: "catalog" | "custom";
  catalog_product_id: string | null; catalog_variation_id: string | null;
  name: string; description: string | null; sku: string | null;
  quantity: number; market_unit_price: number; promotional_unit_price: number;
  catalog_price?: number;
};
export type PromoComboDraft = {
  title: string; description: string | null;
  main_product_name: string | null; main_product_catalog_id: string | null;
  items: PromoItemDraft[];
};
type Currency = "BRL" | "USD" | "EUR";
export type PromoStep =
  | "name" | "pdf_title" | "event" | "event_search" | "event_pick" | "usage" | "dist_search" | "dist_pick"
  | "currency" | "valid_from" | "valid_until" | "status" | "notes" | "official" | "kol"
  | "coupon_ask" | "coupon_type" | "coupon_value" | "coupon_from" | "coupon_until" | "coupon_prefix"
  | "coupon_limit" | "coupon_per_customer" | "coupon_sellers"
  | "combo_title" | "combo_desc" | "item_kind" | "item_search" | "item_pick"
  | "custom_name" | "custom_desc" | "item_qty" | "item_market" | "item_promo"
  | "combo_main" | "combo_more" | "review";

export type PromoState = {
  step: PromoStep;
  today: string;
  events: PromoRef[];
  distributors: PromoRef[];
  sellers: PromoRef[];
  filter: string;
  hits: CatalogHit[];
  header: {
    name: string; pdf_title: string; event_id: string | null; distributor_id: string | null;
    currency: Currency; valid_from: string | null; valid_until: string | null;
    status: "active" | "draft"; notes: string | null;
    include_official_price_table: boolean; kol_visible: boolean;
  };
  coupon: null | {
    discount_type: "percent" | "fixed"; discount_value: number;
    valid_from: string | null; valid_until: string | null; prefix: string | null;
    usage_limit: number | null; usage_per_customer: number | null; seller_ids: string[];
  };
  combos: PromoComboDraft[];
  combo: PromoComboDraft | null;
  item: PromoItemDraft | null;
};

const D = "Dados da promoção";
const C = "Cupons de desconto";
const S = "Seções do combo";
const SKIP: WizardOption = { value: WIZ_SKIP, label: "Pular" };
const YESNO = (yes = "Sim", no = "Não"): WizardOption[] => [{ value: "yes", label: yes }, { value: "no", label: no }];
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const refLabel = (list: PromoRef[], id: string | null) => list.find((r) => r.id === id)?.label ?? null;
const filterRefs = (list: PromoRef[], term: string) => {
  const t = norm(term.trim());
  return list.filter((r) => norm(r.label).includes(t)).slice(0, 8);
};
const ok = (state: PromoState, note?: string): WizardAnswer<PromoState> => ({ state, note });
const err = (error: string): WizardAnswer<PromoState> => ({ error });
const choice = (raw: string, options: WizardOption[]) => matchOption(raw, options)?.value ?? null;
const yesNo = (raw: string) => (raw === "yes" ? true : raw === "no" ? false : parseYesNo(raw));
const newItem = (kind: "catalog" | "custom"): PromoItemDraft => ({
  kind, catalog_product_id: null, catalog_variation_id: null, name: "", description: null, sku: null,
  quantity: 1, market_unit_price: 0, promotional_unit_price: 0,
});
const hitLabel = (h: CatalogHit, cur: string) =>
  `${h.name}${h.variation ? ` — ${h.variation}` : ""} · ${money(h.price, cur)}`;

function eventOptions(s: PromoState): WizardOption[] {
  const upcoming = s.events.filter((e) => !e.date || e.date >= s.today).sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 6);
  return [
    { value: "none", label: "Nenhum evento" },
    ...upcoming.map((e) => ({ value: e.id, label: `${e.label}${e.date ? ` — ${formatDateBR(e.date)}` : ""}` })),
    { value: "search", label: "Buscar outro evento" },
  ];
}

function itemKindOptions(s: PromoState): WizardOption[] {
  const opts: WizardOption[] = [
    { value: "catalog", label: "Produto do catálogo" },
    { value: "custom", label: "Item personalizado" },
  ];
  if (s.combo?.items.length) opts.push({ value: "done", label: "Terminar este combo" });
  return opts;
}

function pickOptions(s: PromoState): WizardOption[] {
  return [
    ...s.hits.map((h, i) => ({ value: String(i), label: hitLabel(h, s.header.currency), hint: h.sku || undefined })),
    { value: "again", label: "Buscar de novo" },
    { value: "custom", label: "Usar item personalizado" },
  ];
}

function mainOptions(s: PromoState): WizardOption[] {
  return [...(s.combo?.items ?? []).map((it, i) => ({ value: String(i), label: it.name })), SKIP];
}

function sellerOptions(s: PromoState): WizardOption[] {
  return s.sellers.map((r) => ({ value: r.id, label: r.label }));
}

export function promoQuestion(s: PromoState): WizardQuestion {
  const cur = s.header.currency;
  const comboN = s.combos.length + 1;
  const comboName = s.combo?.title || `Combo ${comboN}`;
  switch (s.step) {
    case "name": return { where: `${D} › Nome interno`, input: "text", ask: "Qual é o **nome interno** da tabela?", help: "É o nome que aparece na lista de tabelas e para a equipe. Ex.: *Black Friday 2026*.", placeholder: "Ex.: Black Friday 2026" };
    case "pdf_title": return { where: `${D} › Título no PDF`, input: "text", ask: "Qual **título** deve aparecer no topo do PDF?", help: "É o que o cliente lê no PDF. O padrão da tela é *TABELA PROMOCIONAL*.", quick: [{ value: "TABELA PROMOCIONAL", label: "Manter TABELA PROMOCIONAL" }] };
    case "event": return { where: `${D} › Evento associado`, input: "choice", ask: "A tabela é de algum **evento**?", help: "Com evento, o cronograma de demonstrações e os profissionais do estande entram no final do PDF.", options: eventOptions(s) };
    case "event_search": return { where: `${D} › Evento associado`, input: "text", ask: "Digite parte do **nome do evento**.", placeholder: "Ex.: CIOSP" };
    case "event_pick": return { where: `${D} › Evento associado`, input: "choice", ask: `Eventos encontrados para "${s.filter}":`, options: [...filterRefs(s.events, s.filter).map((e) => ({ value: e.id, label: `${e.label}${e.date ? ` — ${formatDateBR(e.date)}` : ""}` })), { value: "search", label: "Buscar de novo" }, { value: "none", label: "Nenhum evento" }] };
    case "usage": return { where: `${D} › Uso`, input: "choice", ask: "Qual é o **uso** da tabela?", help: "Campanha geral vale para todos. Escolha um distribuidor quando a tabela for exclusiva de uma revenda.", options: [{ value: "general", label: "Campanha geral" }, { value: "dist", label: "Para um distribuidor" }] };
    case "dist_search": return { where: `${D} › Uso`, input: "text", ask: "Digite parte do **nome do distribuidor**.", placeholder: "Ex.: Dental" };
    case "dist_pick": return { where: `${D} › Uso`, input: "choice", ask: `Distribuidores encontrados para "${s.filter}":`, options: [...filterRefs(s.distributors, s.filter).map((r) => ({ value: r.id, label: r.label })), { value: "search", label: "Buscar de novo" }, { value: "general", label: "Campanha geral" }] };
    case "currency": return { where: `${D} › Moeda`, input: "choice", ask: "Em qual **moeda** ficam os preços?", options: [{ value: "BRL", label: "BRL — Real" }, { value: "USD", label: "USD — Dólar" }, { value: "EUR", label: "EUR — Euro" }] };
    case "valid_from": return { where: `${D} › Início`, input: "date", ask: "Qual a **data de início** da promoção?", help: "Digite no formato dia/mês/ano, ex.: *20/11/2026*.", quick: [{ value: "hoje", label: "Hoje" }], placeholder: "dd/mm/aaaa" };
    case "valid_until": return { where: `${D} › Fim`, input: "date", ask: "E a **data de fim**?", help: `Precisa ser igual ou depois de ${formatDateBR(s.header.valid_from)}.`, placeholder: "dd/mm/aaaa" };
    case "status": return { where: `${D} › Status`, input: "choice", ask: "Qual **status** a tabela deve ter ao salvar?", help: "Ativa já fica disponível. Rascunho fica guardada para revisar depois.", options: [{ value: "active", label: "Ativa" }, { value: "draft", label: "Rascunho" }] };
    case "notes": return { where: `${D} › Observações e condições`, input: "textarea", ask: "Quer escrever **observações e condições**?", help: "Ex.: condições de pagamento, disponibilidade, validade enquanto durar o estoque.", quick: [SKIP] };
    case "official": return { where: `${D} › Incluir tabela Smart Dent (Loja Oficial)`, input: "choice", ask: "Incluir a **tabela oficial da Smart Dent** no final do PDF?", help: "Anexa a tabela de preços oficial no mesmo formato das revendas. Na tela já vem ligado.", options: YESNO("Sim, incluir", "Não incluir") };
    case "kol": return { where: `${D} › Vincular a tabela para KOLs`, input: "choice", ask: "**Vincular a tabela para KOLs** (Portal Profissional Parceiro)?", help: "Os profissionais parceiros passam a ver e baixar o PDF no menu \"Tabela de preços\".", options: YESNO("Sim, vincular", "Não") };
    case "coupon_ask": return { where: C, input: "choice", ask: "Esta promoção terá **cupom de desconto** na loja?", help: "Cada vendedor autorizado recebe o próprio código. Os códigos são gerados depois na tela da tabela.", options: YESNO("Sim, configurar cupom", "Sem cupom") };
    case "coupon_type": return { where: `${C} › Tipo de desconto`, input: "choice", ask: "Qual o **tipo de desconto** do cupom?", options: [{ value: "percent", label: "Percentual (%)" }, { value: "fixed", label: `Valor fixo (${cur})` }] };
    case "coupon_value": return { where: `${C} › Valor do desconto`, input: "money", ask: s.coupon?.discount_type === "fixed" ? `Qual o **valor do desconto** em ${cur}?` : "Qual o **percentual de desconto**?", help: s.coupon?.discount_type === "fixed" ? "Ex.: 150 ou 150,00." : "Só o número, ex.: 10 para 10%.", placeholder: "Ex.: 10" };
    case "coupon_from": return { where: `${C} › Início da promoção`, input: "date", ask: "A partir de quando o **cupom vale**?", quick: [{ value: s.header.valid_from || "hoje", label: `Mesmo início da tabela (${formatDateBR(s.header.valid_from)})` }], placeholder: "dd/mm/aaaa" };
    case "coupon_until": return { where: `${C} › Fim da promoção`, input: "date", ask: "Até quando o **cupom vale**?", quick: [{ value: s.header.valid_until || "", label: `Mesmo fim da tabela (${formatDateBR(s.header.valid_until)})` }], placeholder: "dd/mm/aaaa" };
    case "coupon_prefix": return { where: `${C} › Prefixo do código`, input: "text", ask: "Qual **prefixo** os códigos devem ter?", help: "Os códigos ficam prefixo + nome do vendedor. Ex.: *BF26*.", quick: [SKIP], placeholder: "Ex.: BF26" };
    case "coupon_limit": return { where: `${C} › Número de cupons a gerar`, input: "number", ask: "**Quantos usos** cada cupom pode ter no total?", help: "Deixe sem limite se não houver restrição.", quick: [{ value: WIZ_SKIP, label: "Sem limite" }] };
    case "coupon_per_customer": return { where: `${C} › Vezes que cada cliente pode usar`, input: "number", ask: "Quantas **vezes cada cliente** pode usar o cupom?", quick: [{ value: "1", label: "1 vez" }, { value: WIZ_SKIP, label: "Sem limite" }] };
    case "coupon_sellers": return { where: `${C} › Vendedores autorizados`, input: "multi", ask: "Quais **vendedores** podem divulgar o cupom?", help: s.header.event_id ? "Já marquei os consultores do formulário do evento. Ajuste e clique em Concluir." : "Marque os vendedores e clique em Concluir.", options: sellerOptions(s), selected: s.coupon?.seller_ids ?? [] };
    case "combo_title": return { where: `${S} › Adicionar combo`, input: "text", ask: `Qual o **título do combo ${comboN}**?`, help: "Ex.: *Kit Chairside Black Friday*. Cada combo vira um bloco no PDF.", quick: [{ value: `Combo ${comboN}`, label: `Usar "Combo ${comboN}"` }] };
    case "combo_desc": return { where: `${S} › ${comboName} › Descrição do combo`, input: "textarea", ask: "Quer uma **descrição** para este combo?", help: "Explique o que o combo entrega, benefícios e condições. No PDF ela fica ao lado da foto.", quick: [SKIP] };
    case "item_kind": return { where: `${S} › ${comboName} › Itens`, input: "choice", ask: s.combo?.items.length ? `O combo já tem ${s.combo.items.length} item(ns). **Adicionar mais um item?**` : "Vamos colocar o **primeiro item** do combo. Ele vem do catálogo ou é personalizado?", help: "Produto do catálogo copia nome, foto e preço oficial. Personalizado serve para serviços, créditos e treinamentos.", options: itemKindOptions(s) };
    case "item_search": return { where: `${S} › ${comboName} › Produto do catálogo`, input: "text", ask: "Digite o **nome ou SKU do produto** para eu buscar no catálogo.", placeholder: "Ex.: Vitality" };
    case "item_pick": return { where: `${S} › ${comboName} › Produto do catálogo`, input: "choice", ask: s.hits.length ? `Encontrei ${s.hits.length} opção(ões) para "${s.filter}". **Qual é o produto?**` : `Não encontrei produto para "${s.filter}".`, options: pickOptions(s) };
    case "custom_name": return { where: `${S} › ${comboName} › Item personalizado › Nome`, input: "text", ask: "Qual o **nome do item personalizado**?", placeholder: "Ex.: Treinamento presencial" };
    case "custom_desc": return { where: `${S} › ${comboName} › Item personalizado › Descrição`, input: "textarea", ask: "Quer uma **descrição** para este item?", quick: [SKIP] };
    case "item_qty": return { where: `${S} › ${comboName} › ${s.item?.name || "Item"} › Qtd.`, input: "number", ask: `Qual a **quantidade** de ${s.item?.name || "item"}?`, quick: [{ value: "1", label: "1" }, { value: "2", label: "2" }] };
    case "item_market": {
      const cat = s.item?.kind === "catalog" ? s.item.catalog_price ?? 0 : null;
      return { where: `${S} › ${comboName} › ${s.item?.name || "Item"} › Valor mercado`, input: "money", ask: `Qual o **valor de mercado** (unitário) de ${s.item?.name}?`, help: cat !== null ? "É o preço \"de\" no PDF. Já trouxe o preço oficial do catálogo." : "É o preço \"de\" no PDF, sem desconto.", quick: cat !== null ? [{ value: String(cat), label: `Manter ${money(cat, cur)}` }] : undefined, placeholder: "Ex.: 1.500,00" };
    }
    case "item_promo": return { where: `${S} › ${comboName} › ${s.item?.name || "Item"} › Valor promocional`, input: "money", ask: `Qual o **valor promocional** (unitário) de ${s.item?.name}?`, help: `É o preço "por" no PDF. Valor de mercado: ${money(s.item?.market_unit_price ?? 0, cur)}.`, placeholder: "Ex.: 1.200,00" };
    case "combo_main": return { where: `${S} › ${comboName} › Produto principal`, input: "choice", ask: "Qual é o **produto principal** do combo?", help: "É o que entra como \"Produto de interesse\" no CRM quando o lead escolhe este combo no formulário do evento.", options: mainOptions(s) };
    case "combo_more": return { where: S, input: "choice", ask: `Combo **${s.combos[s.combos.length - 1]?.title}** pronto. **Adicionar outro combo?**`, options: YESNO("Sim, outro combo", "Não, revisar e salvar") };
    case "review": return { where: "Salvar tabela", input: "choice", ask: "Confira o resumo acima. **Posso salvar a tabela?**", help: "Ao confirmar eu clico em Salvar por você.", options: [{ value: WIZ_CONFIRM, label: "Confirmar e salvar" }, { value: WIZ_CANCEL, label: "Cancelar" }] };
  }
}

function finishItem(s: PromoState): PromoState {
  const combo = { ...s.combo!, items: [...s.combo!.items, s.item!] };
  return { ...s, combo, item: null, step: "item_kind" };
}

export async function promoAnswer(s: PromoState, raw: string, deps: PromoDeps): Promise<WizardAnswer<PromoState>> {
  const v = String(raw ?? "").trim();
  const q = promoQuestion(s);
  const pick = q.options ? choice(v, q.options) : null;
  const h = s.header;
  const set = (patch: Partial<PromoState["header"]>, step: PromoStep) => ({ ...s, header: { ...h, ...patch }, step });
  const setC = (patch: Partial<NonNullable<PromoState["coupon"]>>, step: PromoStep) => ({ ...s, coupon: { ...s.coupon!, ...patch }, step });
  if (q.input === "choice" && !pick) return err("Escolha uma das opções (clique no botão ou digite o número).");

  switch (s.step) {
    case "name":
      if (v.length < 3) return err("O nome precisa ter pelo menos 3 letras.");
      if (v.length > 120) return err("Nome muito longo (máximo 120).");
      return ok(set({ name: v }, "pdf_title"));
    case "pdf_title":
      if (!v) return err("Digite o título ou clique em Manter.");
      return ok(set({ pdf_title: v.slice(0, 120) }, "event"));
    case "event":
      if (pick === "search") return ok({ ...s, step: "event_search" });
      return ok(set({ event_id: pick === "none" ? null : pick }, "usage"));
    case "event_search":
      if (v.length < 2) return err("Digite ao menos 2 letras.");
      return ok({ ...s, filter: v, step: "event_pick" });
    case "event_pick":
      if (pick === "search") return ok({ ...s, step: "event_search" });
      return ok(set({ event_id: pick === "none" ? null : pick }, "usage"));
    case "usage":
      if (pick === "dist") return ok({ ...s, step: "dist_search" });
      return ok(set({ distributor_id: null }, "currency"));
    case "dist_search":
      if (v.length < 2) return err("Digite ao menos 2 letras.");
      return ok({ ...s, filter: v, step: "dist_pick" });
    case "dist_pick":
      if (pick === "search") return ok({ ...s, step: "dist_search" });
      return ok(set({ distributor_id: pick === "general" ? null : pick }, "currency"));
    case "currency":
      return ok(set({ currency: pick as Currency }, "valid_from"));
    case "valid_from": {
      const d = parseDateBR(v, s.today);
      if (!d) return err("Data inválida. Use dia/mês/ano, ex.: 20/11/2026.");
      return ok(set({ valid_from: d, valid_until: h.valid_until && h.valid_until < d ? null : h.valid_until }, "valid_until"));
    }
    case "valid_until": {
      const d = parseDateBR(v, s.today);
      if (!d) return err("Data inválida. Use dia/mês/ano, ex.: 30/11/2026.");
      if (h.valid_from && d < h.valid_from) return err(`A data de fim não pode ser antes do início (${formatDateBR(h.valid_from)}).`);
      if (d < s.today) return err("Essa data já passou. A promoção precisa terminar hoje ou depois.");
      return ok(set({ valid_until: d }, "status"));
    }
    case "status":
      return ok(set({ status: pick as "active" | "draft" }, "notes"));
    case "notes":
      return ok(set({ notes: v === WIZ_SKIP || !v ? null : v.slice(0, 2000) }, "official"));
    case "official":
      return ok(set({ include_official_price_table: pick === "yes" }, "kol"));
    case "kol":
      return ok(set({ kol_visible: pick === "yes" }, "coupon_ask"),
        pick === "yes" ? "Depois de salvar, o PDF vai para o portal quando você abrir a tabela e clicar em **Publicar PDF no portal agora**." : undefined);
    case "coupon_ask":
      if (pick === "no") return ok({ ...s, coupon: null, step: "combo_title" });
      return ok({ ...s, step: "coupon_type", coupon: s.coupon ?? { discount_type: "percent", discount_value: 0, valid_from: h.valid_from, valid_until: h.valid_until, prefix: null, usage_limit: null, usage_per_customer: null, seller_ids: [] } });
    case "coupon_type":
      return ok(setC({ discount_type: pick as "percent" | "fixed" }, "coupon_value"));
    case "coupon_value": {
      const n = parseMoneyBR(v);
      if (n === null || n <= 0) return err("Digite um valor maior que zero.");
      if (s.coupon?.discount_type === "percent" && n > 100) return err("O percentual não pode passar de 100.");
      return ok(setC({ discount_value: n }, "coupon_from"));
    }
    case "coupon_from": {
      const d = parseDateBR(v, s.today);
      if (!d) return err("Data inválida. Use dia/mês/ano.");
      return ok(setC({ valid_from: d }, "coupon_until"));
    }
    case "coupon_until": {
      const d = parseDateBR(v, s.today);
      if (!d) return err("Data inválida. Use dia/mês/ano.");
      if (s.coupon?.valid_from && d < s.coupon.valid_from) return err("O fim do cupom não pode ser antes do início.");
      return ok(setC({ valid_until: d }, "coupon_prefix"));
    }
    case "coupon_prefix": {
      const p = v === WIZ_SKIP ? null : v.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 20) || null;
      return ok(setC({ prefix: p }, "coupon_limit"));
    }
    case "coupon_limit": {
      if (v === WIZ_SKIP) return ok(setC({ usage_limit: null }, "coupon_per_customer"));
      const n = parseQuantity(v);
      if (!n || !Number.isInteger(n)) return err("Digite um número inteiro maior que zero, ou clique em Sem limite.");
      return ok(setC({ usage_limit: n }, "coupon_per_customer"));
    }
    case "coupon_per_customer": {
      let n: number | null = null;
      if (v !== WIZ_SKIP) {
        n = parseQuantity(v);
        if (!n || !Number.isInteger(n)) return err("Digite um número inteiro maior que zero, ou clique em Sem limite.");
      }
      const { sellers, preselected } = await deps.loadSellers(h.event_id);
      if (!sellers.length) return ok({ ...s, coupon: { ...s.coupon!, usage_per_customer: n, seller_ids: [] }, step: "combo_title" }, "Não encontrei vendedores ativos para o cupom. Você pode escolher depois na tela.");
      const keep = (s.coupon?.seller_ids ?? []).filter((id) => sellers.some((r) => r.id === id));
      return ok({ ...s, sellers, coupon: { ...s.coupon!, usage_per_customer: n, seller_ids: keep.length ? keep : preselected }, step: "coupon_sellers" });
    }
    case "coupon_sellers": {
      let ids: string[] = [];
      try { ids = JSON.parse(v); } catch { return err("Marque os vendedores e clique em Concluir."); }
      if (!Array.isArray(ids)) return err("Marque os vendedores e clique em Concluir.");
      ids = ids.filter((id) => s.sellers.some((r) => r.id === id));
      if (!ids.length) return err("Marque pelo menos um vendedor.");
      return ok(setC({ seller_ids: ids }, "combo_title"));
    }
    case "combo_title":
      if (v.length < 2) return err("Digite o título do combo.");
      return ok({ ...s, combo: { title: v.slice(0, 120), description: null, main_product_name: null, main_product_catalog_id: null, items: [] }, step: "combo_desc" });
    case "combo_desc":
      return ok({ ...s, combo: { ...s.combo!, description: v === WIZ_SKIP || !v ? null : v.slice(0, 2000) }, step: "item_kind" });
    case "item_kind":
      if (pick === "done") {
        const only = s.combo!.items.length === 1 ? s.combo!.items[0] : null;
        if (only) {
          const combo = { ...s.combo!, main_product_name: only.name, main_product_catalog_id: only.catalog_product_id };
          return ok({ ...s, combos: [...s.combos, combo], combo: null, step: "combo_more" }, `Produto principal do combo: **${only.name}** (único item).`);
        }
        return ok({ ...s, step: "combo_main" });
      }
      return ok({ ...s, item: newItem(pick as "catalog" | "custom"), step: pick === "catalog" ? "item_search" : "custom_name" });
    case "item_search": {
      if (v.length < 2) return err("Digite ao menos 2 letras.");
      const hits = (await deps.searchCatalog(v, h.currency)).slice(0, 10);
      return ok({ ...s, filter: v, hits, step: "item_pick" });
    }
    case "item_pick": {
      if (pick === "again") return ok({ ...s, step: "item_search" });
      if (pick === "custom") return ok({ ...s, item: newItem("custom"), step: "custom_name" });
      const hit = s.hits[Number(pick)];
      if (!hit) return err("Escolha uma das opções.");
      const name = hit.variation ? `${hit.name} — ${hit.variation}` : hit.name;
      return ok({ ...s, item: { ...newItem("catalog"), catalog_product_id: hit.productId, catalog_variation_id: hit.variationId, name, sku: hit.sku, market_unit_price: hit.price, catalog_price: hit.price, promotional_unit_price: hit.price }, hits: [], step: "item_qty" });
    }
    case "custom_name":
      if (v.length < 2) return err("Digite o nome do item.");
      return ok({ ...s, item: { ...s.item!, name: v.slice(0, 200) }, step: "custom_desc" });
    case "custom_desc":
      return ok({ ...s, item: { ...s.item!, description: v === WIZ_SKIP || !v ? null : v.slice(0, 1000) }, step: "item_qty" });
    case "item_qty": {
      const n = parseQuantity(v);
      if (!n) return err("Digite uma quantidade maior que zero.");
      return ok({ ...s, item: { ...s.item!, quantity: n }, step: "item_market" });
    }
    case "item_market": {
      const n = parseMoneyBR(v);
      if (n === null || n < 0) return err("Digite um valor válido, ex.: 1.500,00.");
      return ok({ ...s, item: { ...s.item!, market_unit_price: n }, step: "item_promo" });
    }
    case "item_promo": {
      const n = parseMoneyBR(v);
      if (n === null || n < 0) return err("Digite um valor válido, ex.: 1.200,00.");
      const it = { ...s.item!, promotional_unit_price: n };
      const pct = discountPct(it.market_unit_price, n);
      const warn = n > it.market_unit_price ? " ⚠️ O promocional ficou maior que o de mercado." : "";
      return ok(finishItem({ ...s, item: it }), `✓ **${it.name}** — ${it.quantity} × ${money(n, h.currency)} (desconto de ${pct}%).${warn}`);
    }
    case "combo_main": {
      const it = pick === WIZ_SKIP ? null : s.combo!.items[Number(pick)];
      const combo = { ...s.combo!, main_product_name: it?.name ?? null, main_product_catalog_id: it?.catalog_product_id ?? null };
      return ok({ ...s, combos: [...s.combos, combo], combo: null, step: "combo_more" });
    }
    case "combo_more":
      return ok({ ...s, step: pick === "yes" ? "combo_title" : "review" });
    case "review":
      return ok(s);
  }
}

export function promoSummary(s: PromoState): string {
  const h = s.header, cur = h.currency;
  const lines = [
    `### Nova tabela promocional: ${h.name}`,
    `- Título no PDF: ${h.pdf_title}`,
    `- Evento: ${refLabel(s.events, h.event_id) ?? "nenhum"}`,
    `- Uso: ${h.distributor_id ? `distribuidor ${refLabel(s.distributors, h.distributor_id) ?? ""}` : "campanha geral"}`,
    `- Moeda: ${cur} · Vigência: ${formatDateBR(h.valid_from)} a ${formatDateBR(h.valid_until)}`,
    `- Status ao salvar: **${h.status === "active" ? "Ativa" : "Rascunho"}**`,
    `- Tabela oficial no PDF: ${h.include_official_price_table ? "sim" : "não"} · KOLs: ${h.kol_visible ? "sim" : "não"}`,
  ];
  if (h.notes) lines.push(`- Observações: ${h.notes.replace(/\n+/g, " ").slice(0, 200)}`);
  if (s.coupon) {
    const c = s.coupon;
    const names = c.seller_ids.map((id) => refLabel(s.sellers, id)).filter(Boolean);
    lines.push(`- Cupom: ${c.discount_type === "percent" ? `${c.discount_value}%` : money(c.discount_value, cur)} · ${formatDateBR(c.valid_from)} a ${formatDateBR(c.valid_until)} · prefixo ${c.prefix || "—"} · usos ${c.usage_limit ?? "sem limite"} · por cliente ${c.usage_per_customer ?? "sem limite"}${names.length ? ` · vendedores: ${names.join(", ")}` : ""}`);
  } else lines.push("- Cupom: não");
  for (const combo of s.combos) {
    lines.push("", `**${combo.title}**${combo.main_product_name ? ` — principal: ${combo.main_product_name}` : ""}`, "| Item | Qtd. | Mercado | Promocional | Desconto |", "|---|---|---|---|---|");
    let tm = 0, tp = 0;
    for (const it of combo.items) {
      tm += it.market_unit_price * it.quantity; tp += it.promotional_unit_price * it.quantity;
      lines.push(`| ${it.name}${it.kind === "custom" ? " (personalizado)" : ""} | ${it.quantity} | ${money(it.market_unit_price, cur)} | ${money(it.promotional_unit_price, cur)} | ${discountPct(it.market_unit_price, it.promotional_unit_price)}% |`);
    }
    lines.push(`| **Total do combo** |  | ${money(tm, cur)} | ${money(tp, cur)} | ${discountPct(tm, tp)}% |`);
  }
  return lines.join("\n");
}

export function promoPayload(s: PromoState): Record<string, unknown> {
  const h = s.header;
  return {
    name: h.name, pdf_title: h.pdf_title, currency: h.currency,
    valid_from: h.valid_from, valid_until: h.valid_until, notes: h.notes ?? "",
    event_id: h.event_id, distributor_id: h.distributor_id,
    include_official_price_table: h.include_official_price_table, kol_visible: h.kol_visible,
    status: h.status,
    coupon: s.coupon ? { ...s.coupon, prefix: s.coupon.prefix ?? "" } : undefined,
    sections: s.combos.map((c) => ({
      title: c.title, description: c.description ?? "",
      main_product_name: c.main_product_name, main_product_catalog_id: c.main_product_catalog_id,
      items: c.items.map((it) => ({
        catalog_product_id: it.catalog_product_id ?? undefined,
        catalog_variation_id: it.catalog_variation_id ?? undefined,
        name: it.kind === "custom" ? it.name : undefined,
        description: it.description ?? undefined,
        quantity: it.quantity, market_unit_price: it.market_unit_price, promotional_unit_price: it.promotional_unit_price,
      })),
    })),
  };
}

export const promoTableWizard: WizardScript<PromoState, PromoDeps> = {
  key: "tabela_promocional",
  title: "Tabela promocional",
  intro: "Vou montar a **tabela promocional** com você, campo por campo, na mesma ordem da tela **Catálogo › Tabelas promocionais**. Para cada campo eu digo o que colocar. Use **Voltar** para corrigir a resposta anterior.",
  async init(deps, today) {
    const [events, distributors] = await Promise.all([deps.loadEvents(), deps.loadDistributors()]);
    return {
      step: "name", today, events, distributors, sellers: [], filter: "", hits: [],
      header: { name: "", pdf_title: "TABELA PROMOCIONAL", event_id: null, distributor_id: null, currency: "BRL", valid_from: null, valid_until: null, status: "active", notes: null, include_official_price_table: true, kol_visible: false },
      coupon: null, combos: [], combo: null, item: null,
    };
  },
  question: promoQuestion,
  answer: promoAnswer,
  isReview: (s) => s.step === "review",
  summary: promoSummary,
  payload: promoPayload,
};
