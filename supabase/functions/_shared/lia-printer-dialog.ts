/**
 * LIA Printer Dialog — guided brand → model → resin flow for parameter lookup.
 * Extracted from dra-lia/index.ts for modularity and testability.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SupabaseClient = ReturnType<typeof createClient>;

// ── Dialog State Types ──
export type DialogState =
  | { state: "needs_brand"; availableBrands: string[] }
  | { state: "needs_model"; brand: string; brandSlug: string; brandId: string; availableModels: string[] }
  | { state: "needs_resin"; brandSlug: string; modelSlug: string; brandName: string; modelName: string; availableResins: string[] }
  | { state: "has_resin"; brandSlug: string; modelSlug: string; resinName: string; found: boolean }
  | { state: "brand_not_found"; brandGuess: string; availableBrands: string[] }
  | { state: "model_not_found"; brand: string; brandSlug: string; availableModels: string[] }
  | { state: "not_in_dialog" };

// ── Intent-break detection ──
const DIALOG_BREAK_PATTERNS = [
  /\b(CEO|fundador|dono|sócio|diretor|quem (criou|fundou|é o))\b/i,
  /\b(cancelar|esquece|esqueça|outra (pergunta|coisa)|muda(ndo)? de assunto|não (quero|preciso) mais|sair)\b/i,
  /^(o que (é|são)|qual (é|a diferença)|como (funciona|usar|se usa)|me fala sobre|me explica)/i,
  /\b(smartdent|smart dent|empresa|história|fundação|parcerias|contato|endereço|horário)\b/i,
  /^(quais|voc[eê]s (têm|vendem|trabalham)|vcs (têm|vendem|trabalham|tem)|tem (algum|impressora|scanner|resina))/i,
  /\b(quero (comprar|adquirir|ver|conhecer|saber (mais )?sobre)|tenho interesse|como (comprar|adquirir)|onde (comprar|encontrar))\b/i,
  /\b(o que (tem|há|ela tem|ele tem) de|quais (são |as )?(vantagens|benefícios|diferenciais|características|recursos)|para que serve|é indicad[ao] para)\b/i,
  /\b(fala(r)?(?: mais| um pouco)? sobre|me conta(r)? (mais )?sobre|quero saber (mais )?sobre)\b/i,
  /\b(falar com|quero falar|preciso falar|me (conecta|transfira|passa)|atendente|humano|pessoa real|suporte|vendedor|especialista|consultor)\b/i,
  /\b(vcs|voc[eê]s)\b.{0,15}\b(vendem|vende|tem|têm)\b/i,
  /\b(eles|elas|vocês|vcs|alguém|quando)\b.{0,15}\b(vão|vai|vem|liga|chama|entra|retorna)\b/i,
  /\b(vai me|vão me|vou receber|alguém vai)\b/i,
  /\?$/,
  /\b(obrigad[ao]|valeu|agradeço|thanks|gracias)\b/i,
  /\b(tchau|bye|até logo|até mais|adeus)\b/i,
];

function isOffTopicFromDialog(message: string): boolean {
  return DIALOG_BREAK_PATTERNS.some((p) => p.test(message.trim()));
}

// ── DB helpers ──
export async function fetchActiveBrands(supabase: SupabaseClient): Promise<Array<{ id: string; slug: string; name: string }>> {
  const { data } = await supabase.from("brands").select("id, slug, name").eq("active", true).order("name");
  return data || [];
}

export async function fetchBrandModels(supabase: SupabaseClient, brandId: string): Promise<Array<{ slug: string; name: string }>> {
  const { data } = await supabase.from("models").select("slug, name").eq("active", true).eq("brand_id", brandId).order("name");
  return data || [];
}

export async function fetchAvailableResins(supabase: SupabaseClient, brandSlug: string, modelSlug: string): Promise<string[]> {
  const { data } = await supabase.from("parameter_sets").select("resin_name").eq("active", true).eq("brand_slug", brandSlug).eq("model_slug", modelSlug).order("resin_name");
  if (!data?.length) return [];
  const seen = new Set<string>();
  return data.map((r: { resin_name: string }) => r.resin_name).filter((n: string) => { if (seen.has(n)) return false; seen.add(n); return true; });
}

// ── Matching helpers ──
export async function findBrandInMessage(brands: Array<{ id: string; slug: string; name: string }>, message: string): Promise<{ id: string; slug: string; name: string } | null> {
  const msg = message.toLowerCase();
  const sorted = [...brands].sort((a, b) => b.name.length - a.name.length);
  return sorted.find((b) => msg.includes(b.name.toLowerCase())) || null;
}

export function findModelInList(models: Array<{ slug: string; name: string }>, message: string): { slug: string; name: string } | null {
  const msg = message.toLowerCase();
  const scored = models.map((m) => {
    const words = m.name.toLowerCase().split(/\s+/).filter((w) => w.length >= 1);
    const matches = words.filter((w) => msg.includes(w)).length;
    const ratio = matches / words.length;
    return { model: m, matches, wordCount: words.length, ratio };
  }).filter((x) => x.matches > 0).sort((a, b) => b.ratio - a.ratio || b.matches - a.matches || a.wordCount - b.wordCount);
  const best = scored[0];
  if (!best) return null;
  if (best.matches >= 1 && best.ratio >= 0.5) return best.model;
  return null;
}

export function findResinInList(resins: string[], message: string): string | null {
  const msg = message.toLowerCase().trim();
  const sorted = [...resins].sort((a, b) => b.length - a.length);
  const exact = sorted.find((r) => msg.includes(r.toLowerCase()));
  if (exact) return exact;
  const msgWords = msg.split(/\s+/).filter((w) => w.length >= 4);
  for (const word of msgWords) {
    const hit = sorted.find((r) => r.toLowerCase().includes(word));
    if (hit) return hit;
  }
  const scored2 = resins.map((r) => {
    const words = r.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
    const matches = words.filter((w) => msg.includes(w)).length;
    return { resin: r, matches, ratio: words.length ? matches / words.length : 0 };
  }).filter((x) => x.matches > 0).sort((a, b) => b.ratio - a.ratio || b.matches - a.matches);
  return scored2.length > 0 ? scored2[0].resin : null;
}

// ── Localized messages ──
export const ASK_BRAND: Record<string, (brands: string[]) => string> = {
  "pt-BR": (brands) => `Claro! Para te ajudar com os parâmetros, qual é a **marca** da sua impressora?\n\nMarcas disponíveis: ${brands.join(", ")}`,
  "en-US": (brands) => `Sure! To help you with parameters, what is your printer **brand**?\n\nAvailable brands: ${brands.join(", ")}`,
  "es-ES": (brands) => `¡Claro! Para ayudarte con los parámetros, ¿cuál es la **marca** de tu impresora?\n\nMarcas disponibles: ${brands.join(", ")}`,
};

export const ASK_MODEL: Record<string, (brand: string, models: string[]) => string> = {
  "pt-BR": (brand, models) => `Ótimo! A **${brand}** está cadastrada aqui. Qual é o **modelo** da impressora?\n\nModelos disponíveis: ${models.join(", ")}`,
  "en-US": (brand, models) => `Great! **${brand}** is in our database. What is the printer **model**?\n\nAvailable models: ${models.join(", ")}`,
  "es-ES": (brand, models) => `¡Genial! La **${brand}** está registrada aquí. ¿Cuál es el **modelo** de la impresora?\n\nModelos disponibles: ${models.join(", ")}`,
};

export const ASK_RESIN: Record<string, (brand: string, model: string, modelSlug: string, brandSlug: string) => string> = {
  "pt-BR": (brand, model) => `Encontrei a **${brand} ${model}**! Qual **resina** você vai usar?\n\nMe diga o nome da resina e verifico os parâmetros para você 😊`,
  "en-US": (brand, model) => `Found **${brand} ${model}**! Which **resin** will you use?\n\nTell me the resin name and I'll check the parameters for you 😊`,
  "es-ES": (brand, model) => `¡Encontré la **${brand} ${model}**! ¿Qué **resina** vas a usar?\n\nDime el nombre de la resina y verifico los parámetros para ti 😊`,
};

export const RESIN_FOUND: Record<string, (resin: string, brand: string, model: string, brandSlug: string, modelSlug: string) => string> = {
  "pt-BR": (resin, brand, model, brandSlug, modelSlug) => `Perfeito! Encontrei os parâmetros da **${resin}** para a **${brand} ${model}**:\n👉 [Ver parâmetros](/${brandSlug}/${modelSlug})\n\nSe precisar dos valores específicos, é só me pedir e busco para você!`,
  "en-US": (resin, brand, model, brandSlug, modelSlug) => `Perfect! Found parameters for **${resin}** on the **${brand} ${model}**:\n👉 [View parameters](/${brandSlug}/${modelSlug})\n\nIf you need the specific values, just ask and I'll find them for you!`,
  "es-ES": (resin, brand, model, brandSlug, modelSlug) => `¡Perfecto! Encontré los parámetros de **${resin}** para la **${brand} ${model}**:\n👉 [Ver parámetros](/${brandSlug}/${modelSlug})\n\n¡Si necesitas los valores específicos, solo pídeme y los busco para ti!`,
};

export const RESIN_NOT_FOUND: Record<string, (resin: string, brand: string, model: string, brandSlug: string, modelSlug: string, availableResins: string[]) => string> = {
  "pt-BR": (resin, brand, model, brandSlug, modelSlug, availableResins) =>
    `Ainda não temos parâmetros da **${resin}** para a **${brand} ${model}**.\n\n` +
    (availableResins.length > 0 ? `Resinas com parâmetros cadastrados para esse modelo:\n${availableResins.join(", ")}\n\n` : "") +
    `👉 [Ver todos os parâmetros da ${brand} ${model}](/${brandSlug}/${modelSlug})`,
  "en-US": (resin, brand, model, brandSlug, modelSlug, availableResins) =>
    `We don't have parameters for **${resin}** on the **${brand} ${model}** yet.\n\n` +
    (availableResins.length > 0 ? `Resins with registered parameters for this model:\n${availableResins.join(", ")}\n\n` : "") +
    `👉 [View ${brand} ${model} parameters](/${brandSlug}/${modelSlug})`,
  "es-ES": (resin, brand, model, brandSlug, modelSlug, availableResins) =>
    `Aún no tenemos parámetros de **${resin}** para la **${brand} ${model}**.\n\n` +
    (availableResins.length > 0 ? `Resinas con parámetros registrados para este modelo:\n${availableResins.join(", ")}\n\n` : "") +
    `👉 [Ver parámetros de ${brand} ${model}](/${brandSlug}/${modelSlug})`,
};

export const BRAND_NOT_FOUND: Record<string, (brand: string, availableBrands: string[]) => string> = {
  "pt-BR": (brand, brands) => `Não encontrei a marca **${brand}** no nosso sistema.\n\nMarcas disponíveis: ${brands.join(", ")}\n\nOu acesse: 👉 [Ver todos os parâmetros](/)`,
  "en-US": (brand, brands) => `I couldn't find **${brand}** in our system.\n\nAvailable brands: ${brands.join(", ")}\n\nOr visit: 👉 [View all parameters](/)`,
  "es-ES": (brand, brands) => `No encontré la marca **${brand}** en nuestro sistema.\n\nMarcas disponibles: ${brands.join(", ")}\n\nO accede: 👉 [Ver todos los parámetros](/)`,
};

export const MODEL_NOT_FOUND: Record<string, (brand: string, brandSlug: string, availableModels: string[]) => string> = {
  "pt-BR": (brand, brandSlug, models) => `Não encontrei esse modelo para a **${brand}**.\n\nModelos disponíveis: ${models.join(", ")}\n\nOu acesse: 👉 [Ver modelos da ${brand}](/${brandSlug})`,
  "en-US": (brand, brandSlug, models) => `I couldn't find that model for **${brand}**.\n\nAvailable models: ${models.join(", ")}\n\nOr visit: 👉 [View ${brand} models](/${brandSlug})`,
  "es-ES": (brand, brandSlug, models) => `No encontré ese modelo para la **${brand}**.\n\nModelos disponibles: ${models.join(", ")}\n\nO accede: 👉 [Ver modelos de ${brand}](/${brandSlug})`,
};

// ── Main state machine ──
export async function detectPrinterDialogState(
  supabase: SupabaseClient,
  message: string,
  history: Array<{ role: string; content: string }>,
  sessionId: string,
  topic_context?: string
): Promise<DialogState> {
  const allBrands = await fetchActiveBrands(supabase);
  const brandNames = allBrands.map((b) => b.name);

  // Load persistent session state
  let sessionData: { current_state: string; extracted_entities: Record<string, string>; last_activity_at: string } | null = null;
  try {
    const { data } = await supabase.from("agent_sessions").select("current_state, extracted_entities, last_activity_at").eq("session_id", sessionId).maybeSingle();
    if (data) {
      const lastActivity = new Date(data.last_activity_at).getTime();
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      if (lastActivity < twoHoursAgo) {
        await supabase.from("agent_sessions").upsert({ session_id: sessionId, current_state: "idle", extracted_entities: {}, last_activity_at: new Date().toISOString() }, { onConflict: "session_id" });
        sessionData = null;
      } else {
        sessionData = data as typeof sessionData;
      }
    }
  } catch (e) { console.warn("agent_sessions lookup failed:", e); }

  const persistState = async (newState: string, newEntities: Record<string, string>) => {
    const updatedEntities = { ...(sessionData?.extracted_entities || {}), ...newEntities };
    try {
      await supabase.from("agent_sessions").upsert({ session_id: sessionId, current_state: newState, extracted_entities: updatedEntities, last_activity_at: new Date().toISOString() }, { onConflict: "session_id" });
    } catch (e) { console.warn("agent_sessions upsert failed:", e); }
    return updatedEntities;
  };

  const currentState = sessionData?.current_state || "idle";
  const entities = sessionData?.extracted_entities || {};

  // Guard: skip if support flow active
  if (sessionData?.extracted_entities) {
    const ent = sessionData.extracted_entities as Record<string, unknown>;
    if (ent.support_flow_stage) return { state: "not_in_dialog" };
  }

  // topic_context override
  if (topic_context === "parameters" && (currentState === "idle" || currentState === "not_in_dialog")) {
    await persistState("needs_brand", {});
    return { state: "needs_brand", availableBrands: brandNames };
  }

  // Intent-break guard
  const ACTIVE_DIALOG_STATES = ["needs_brand", "brand_not_found", "needs_model", "model_not_found", "needs_resin"];
  if (ACTIVE_DIALOG_STATES.includes(currentState) && isOffTopicFromDialog(message)) {
    console.log(`[dialog] intent-break detected (state: ${currentState}), resetting session`);
    await persistState("idle", {});
    return { state: "not_in_dialog" };
  }

  // State: needs_brand
  if (currentState === "needs_brand" || currentState === "brand_not_found") {
    const brand = await findBrandInMessage(allBrands, message);
    if (brand) {
      const models = await fetchBrandModels(supabase, brand.id);
      await persistState("needs_model", { brand_name: brand.name, brand_slug: brand.slug, brand_id: brand.id });
      return { state: "needs_model", brand: brand.name, brandSlug: brand.slug, brandId: brand.id, availableModels: models.map(m => m.name) };
    }
    const msgWords = message.trim().replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, "").trim().split(/\s+/).filter(w => w.length >= 3);
    const guess = msgWords.slice(0, 3).join(" ") || message.trim().slice(0, 30);
    await persistState("brand_not_found", {});
    return { state: "brand_not_found", brandGuess: guess, availableBrands: brandNames };
  }

  // State: needs_model
  if (currentState === "needs_model" || currentState === "model_not_found") {
    const brandSlug = entities.brand_slug;
    const brandId = entities.brand_id;
    const brandName = entities.brand_name;
    if (brandSlug && brandId) {
      const models = await fetchBrandModels(supabase, brandId);
      const model = findModelInList(models, message);
      if (model) {
        const resins = await fetchAvailableResins(supabase, brandSlug, model.slug);
        await persistState("needs_resin", { model_slug: model.slug, model_name: model.name });
        return { state: "needs_resin", brandSlug, modelSlug: model.slug, brandName: brandName || "", modelName: model.name, availableResins: resins };
      }
      await persistState("model_not_found", {});
      return { state: "model_not_found", brand: brandName || "", brandSlug, availableModels: models.map(m => m.name) };
    }
  }

  // State: needs_resin
  if (currentState === "needs_resin") {
    const brandSlug = entities.brand_slug;
    const modelSlug = entities.model_slug;
    if (brandSlug && modelSlug) {
      const availableResins = await fetchAvailableResins(supabase, brandSlug, modelSlug);
      const matched = findResinInList(availableResins, message);
      await persistState("idle", {});
      if (matched) return { state: "has_resin", brandSlug, modelSlug, resinName: matched, found: true };
      return { state: "has_resin", brandSlug, modelSlug, resinName: message.trim().slice(0, 80), found: false };
    }
  }

  // Fallback guard
  if (currentState === "idle" && isOffTopicFromDialog(message)) return { state: "not_in_dialog" };

  // Fallback: regex on last assistant message
  const lastAssistantMsg = [...history].reverse().find((h) => h.role === "assistant");
  const lastContent = lastAssistantMsg?.content || "";
  const lastLower = lastContent.toLowerCase();

  const liaAskedBrand = (lastLower.includes("marca") || lastLower.includes("brand")) && (lastLower.includes("qual") || lastLower.includes("what") || lastLower.includes("cuál") || lastLower.includes("cual")) && !lastLower.includes("modelo") && !lastLower.includes("model");
  const liaAskedModel = (lastLower.includes("modelo") || lastLower.includes("model")) && (lastLower.includes("qual") || lastLower.includes("what") || lastLower.includes("cuál") || lastLower.includes("cual")) && !lastLower.includes("resina") && !lastLower.includes("resin");
  const liaAskedResin = (lastLower.includes("resina") || lastLower.includes("resin")) && (lastLower.includes("qual") || lastLower.includes("what") || lastLower.includes("cuál") || lastLower.includes("cual") || lastLower.includes("vai usar") || lastLower.includes("will you use") || lastLower.includes("vas a usar"));

  if (liaAskedResin && !isOffTopicFromDialog(message)) {
    const linkMatch = lastContent.match(/\]\(\/([^/]+)\/([^)]+)\)/);
    if (linkMatch) {
      const bSlug = linkMatch[1], mSlug = linkMatch[2];
      const availResins = await fetchAvailableResins(supabase, bSlug, mSlug);
      const matched = findResinInList(availResins, message);
      await persistState("idle", {});
      if (matched) return { state: "has_resin", brandSlug: bSlug, modelSlug: mSlug, resinName: matched, found: true };
      return { state: "has_resin", brandSlug: bSlug, modelSlug: mSlug, resinName: message.trim().slice(0, 80), found: false };
    }
  }

  if (liaAskedBrand && !isOffTopicFromDialog(message)) {
    const brand = await findBrandInMessage(allBrands, message);
    if (brand) {
      const models = await fetchBrandModels(supabase, brand.id);
      await persistState("needs_model", { brand_name: brand.name, brand_slug: brand.slug, brand_id: brand.id });
      return { state: "needs_model", brand: brand.name, brandSlug: brand.slug, brandId: brand.id, availableModels: models.map(m => m.name) };
    }
    const guess = message.trim().replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, "").trim();
    await persistState("brand_not_found", {});
    return { state: "brand_not_found", brandGuess: guess || message.trim(), availableBrands: brandNames };
  }

  if (liaAskedModel && !isOffTopicFromDialog(message)) {
    const boldedPhrases = [...lastContent.matchAll(/\*\*([^*]+)\*\*/g)].map(m => m[1]);
    let matchedBrand: typeof allBrands[0] | undefined;
    for (const phrase of boldedPhrases) {
      const found = allBrands.find(b => phrase.toLowerCase() === b.name.toLowerCase() || phrase.toLowerCase().includes(b.name.toLowerCase()));
      if (found) { matchedBrand = found; break; }
    }
    if (!matchedBrand) matchedBrand = allBrands.find(b => lastLower.includes(b.name.toLowerCase()));
    if (matchedBrand) {
      const models = await fetchBrandModels(supabase, matchedBrand.id);
      const model = findModelInList(models, message);
      if (model) {
        const resins = await fetchAvailableResins(supabase, matchedBrand.slug, model.slug);
        await persistState("needs_resin", { brand_name: matchedBrand.name, brand_slug: matchedBrand.slug, brand_id: matchedBrand.id, model_slug: model.slug, model_name: model.name });
        return { state: "needs_resin", brandSlug: matchedBrand.slug, modelSlug: model.slug, brandName: matchedBrand.name, modelName: model.name, availableResins: resins };
      }
      await persistState("model_not_found", { brand_name: matchedBrand.name, brand_slug: matchedBrand.slug, brand_id: matchedBrand.id });
      return { state: "model_not_found", brand: matchedBrand.name, brandSlug: matchedBrand.slug, availableModels: models.map(m => m.name) };
    }
  }

  // Import guard check from lia-guards
  const PARAM_KEYWORDS = [
    /parâmetro|parametro|parameter|parametrizar/i,
    /configuração|configuracao|setting/i,
    /\bexposição\b|exposicao|exposure/i,
    /layer height|espessura de camada/i,
    /como imprimir|how to print|cómo imprimir/i,
    /tempo de cura|cure time|tiempo de exposición/i,
    /configurar|configurações|configuracoes/i,
    /quais (os )?param|qual (o )?param/i,
    /(preciso|quero|busco|quais|como|qual|configurar|usar|parametrizar).{0,40}\bimpressora\b/i,
    /\bimpressora\b.{0,40}(resina|parâmetro|configurar|parametrizar)/i,
    /(comprei|tenho|uso|adquiri).{0,30}(resina|impressora)/i,
    /(resina).{0,30}(impressora|imprimir|impressão)/i,
    /calibrar|calibração|calibragem/i,
    /(impressões?|prints?).{0,40}(falh|problem|erro|ruim|mal|nao sai|não sai|nao fica|não fica)/i,
    /(falhas?|problemas?|erros?).{0,30}(impressão|imprimindo)/i,
    /minhas? impressões?/i,
    /(nao estou|não estou|tô tendo|estou tendo|tive).{0,30}(imprimindo|impressão)/i,
  ];

  if (PARAM_KEYWORDS.some(p => p.test(message))) {
    await persistState("needs_brand", {});
    return { state: "needs_brand", availableBrands: brandNames };
  }

  return { state: "not_in_dialog" };
}
