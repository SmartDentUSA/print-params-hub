import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY");

const CHAT_API = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Greeting patterns — detect before triggering RAG
const GREETING_PATTERNS = [
  /^(olá|ola|oi|hey|hi|hola|hello|bom dia|boa tarde|boa noite|tudo bem|tudo bom|como vai|como estas|como está)\b/i,
  /^(good morning|good afternoon|good evening|how are you)\b/i,
  /^(buenos días|buenas tardes|buenas noches|qué tal)\b/i,
];

const isGreeting = (msg: string) =>
  GREETING_PATTERNS.some((p) => p.test(msg.trim())) && msg.trim().split(/\s+/).length <= 5;

// Support keywords — detect technical problems and redirect to WhatsApp (no RAG)
const SUPPORT_KEYWORDS = [
  /(impressora|printer|impresora).{0,30}(não liga|not turning|no enciende|erro|error|defeito|travando|falhou|quebrou|quebrada)/i,
  /(não consigo|can't|cannot|no puedo).{0,20}(imprimir|print|salvar|conectar|ligar)/i,
  /(erro|error|falha|falhou|travando|bug|problema).{0,20}(impressora|printer|software|slicer)/i,
  /(garantia|suporte técnico|assistência técnica|reparo|defeito de fábrica)/i,
  /(peça|peças|replacement part|reposição|componente)/i,
  /(impressora).{0,20}(não funciona|parou|trava|tá travando|está travando|quebrou)/i,
  /(resina).{0,20}(não (curou|curar|endureceu|endureceu|polimerizo|aderiu))/i,
];

const SUPPORT_FALLBACK: Record<string, string> = {
  "pt-BR": `Para problemas técnicos com equipamentos, nossa equipe de suporte pode te ajudar diretamente 😊\n\n💬 **WhatsApp:** [Falar com suporte](https://api.whatsapp.com/send/?phone=551634194735&text=Ol%C3%A1+preciso+de+suporte+t%C3%A9cnico)\n✉️ **E-mail:** comercial@smartdent.com.br\n🕐 **Horário:** Segunda a Sexta, 08h às 18h`,
  "en-US": `For technical issues with equipment, our support team can help you directly 😊\n\n💬 **WhatsApp:** [Contact support](https://api.whatsapp.com/send/?phone=551634194735&text=Hi+I+need+technical+support)\n✉️ **E-mail:** comercial@smartdent.com.br\n🕐 **Office hours:** Mon–Fri, 8am–6pm (BRT)`,
  "es-ES": `Para problemas técnicos con equipos, nuestro equipo de soporte puede ayudarte directamente 😊\n\n💬 **WhatsApp:** [Contactar soporte](https://api.whatsapp.com/send/?phone=551634194735&text=Hola+necesito+soporte+t%C3%A9cnico)\n✉️ **E-mail:** comercial@smartdent.com.br\n🕐 **Horario:** Lunes a Viernes, 8h a 18h`,
};

const isSupportQuestion = (msg: string) => SUPPORT_KEYWORDS.some((p) => p.test(msg));

// Protocol keywords — detect questions about cleaning, curing, finishing, thermal treatment
const PROTOCOL_KEYWORDS = [
  // PT
  /limpeza|lavagem|lavar|limpar/i,
  /\bcura\b|pós.cura|pos.cura|fotopolimerizar/i,
  /finaliz|acabamento|polimento|polir/i,
  /pré.process|pre.process|pós.process|pos.process|processamento|protocolo/i,
  /nanoclean|isopropílico|isopropilico|álcool|alcool/i,
  // NOVO PT: tratamento térmico e termos relacionados
  /tratamento.{0,5}t[ée]rmico|t[ée]rmico|forno|glicerina|soprador/i,
  /temperatura|aquecimento|aquece|calor/i,
  // EN
  /\bclean\b|wash|washing/i,
  /post.cure|post cure|\bcuring\b/i,
  /\bfinish\b|polish/i,
  /\bprocessing\b|protocol/i,
  /\bpost.?process\b|heat.?treat|thermal.?treat|thermal/i,
  // ES
  /limpieza/i,
  /curado|post.curado/i,
  /pulido|acabado/i,
  /procesamiento/i,
  /tratamiento.{0,5}t[ée]rmico|horno|temperatura/i,
];

const isProtocolQuestion = (msg: string) =>
  PROTOCOL_KEYWORDS.some((p) => p.test(msg));

// Stopwords para filtrar palavras irrelevantes antes do ILIKE
const STOPWORDS_PT = [
  'você', 'voce', 'tem', 'algum', 'alguma', 'entre', 'para', 'sobre',
  'como', 'qual', 'quais', 'esse', 'essa', 'este', 'esta', 'isso',
  'uma', 'uns', 'umas', 'que', 'com', 'por', 'mais', 'muito',
  'outras', 'outros', 'quando', 'onde', 'seria', 'tenho', 'temos',
  'fazer', 'feito', 'tenha', 'quer', 'quero', 'busco', 'busca',
  'preciso', 'existe', 'existem', 'possui', 'possuem', 'algum', 'alguma',
];

// Busca direta por ILIKE nos títulos e excertos de knowledge_contents
async function searchByILIKE(
  supabase: ReturnType<typeof createClient>,
  query: string,
) {
  // Ajuste 1: >= 3 para capturar nomes curtos de marcas como "Atos" (4), "Bio" (3)
  const words = query
    .toLowerCase()
    .replace(/[?!.,;:]/g, '')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS_PT.includes(w))
    .slice(0, 6);

  if (!words.length) return [];

  // Ajuste 3: incluir ai_context no filtro ILIKE para capturar sinônimos
  const orFilter = words.map((w) => `title.ilike.%${w}%,excerpt.ilike.%${w}%,ai_context.ilike.%${w}%`).join(',');

  const { data } = await supabase
    .from('knowledge_contents')
    .select('id, title, slug, excerpt, ai_context, category_id, knowledge_categories:knowledge_categories(letter)')
    .eq('active', true)
    .or(orFilter)
    .limit(20); // Buscar mais resultados para depois ordenar e filtrar

  // Ajuste 2: ordenar por relevância no título (maior score = mais palavras no título)
  const sorted = (data || []).sort((a: { title: string }, b: { title: string }) => {
    const scoreA = words.filter(w => a.title.toLowerCase().includes(w)).length;
    const scoreB = words.filter(w => b.title.toLowerCase().includes(w)).length;
    return scoreB - scoreA; // maior score primeiro
  });

  return sorted.slice(0, 5).map((a: {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    ai_context: string | null;
    knowledge_categories: { letter: string } | null;
  }) => {
    const letter = a.knowledge_categories?.letter?.toLowerCase() || '';
    // Camada 2: Similaridade proporcional ao número de palavras da query no título
    // score = palavras encontradas no título / total palavras da query → escala 0.1–0.5
    const matchedWords = words.filter(w => a.title.toLowerCase().includes(w)).length;
    const similarityScore = words.length > 0
      ? (matchedWords / words.length) * 0.4 + 0.1
      : 0.15; // fallback se words estiver vazio por algum motivo
    return {
      id: a.id,
      source_type: 'article',
      chunk_text: `${a.title} | ${a.excerpt}${a.ai_context ? ' | ' + a.ai_context : ''}`,
      metadata: {
        title: a.title,
        slug: a.slug,
        category_letter: letter,
        url_publica: letter ? `/base-conhecimento/${letter}/${a.slug}` : null,
      },
      similarity: similarityScore,
    };
  });
}

// ── GUIDED PRINTER DIALOG ────────────────────────────────────────────────────

// Keywords that indicate the user is asking about print parameters
const PARAM_KEYWORDS = [
  /parâmetro|parametro|parameter|parametrizar/i,
  /configuração|configuracao|setting/i,
  /\bexposição\b|exposicao|exposure/i,
  /layer height|espessura de camada/i,
  /como imprimir|how to print|cómo imprimir/i,
  /tempo de cura|cure time|tiempo de exposición/i,
  /configurar|configurações|configuracoes/i,
  /quais (os )?param|qual (o )?param/i,
  // Padrões contextuais — capturam intenção sem palavra exata "parâmetro"
  /(preciso|quero|busco|quais|como|qual|configurar|usar|parametrizar).{0,40}\bimpressora\b/i,
  /\bimpressora\b.{0,40}(resina|parâmetro|configurar|parametrizar)/i,
  /(comprei|tenho|uso|adquiri).{0,30}(resina|impressora)/i,
  /(resina).{0,30}(impressora|imprimir|impressão)/i,
  /calibrar|calibração|calibragem/i,
  // Padrões de falha de impressão — captura contexto de troubleshooting
  /(impressões?|prints?).{0,40}(falh|problem|erro|ruim|mal|nao sai|não sai|nao fica|não fica)/i,
  /(falhas?|problemas?|erros?).{0,30}(impressão|imprimindo)/i,
  /minhas? impressões?/i,
  /(nao estou|não estou|tô tendo|estou tendo|tive).{0,30}(imprimindo|impressão)/i,
];

const isPrinterParamQuestion = (msg: string) =>
  PARAM_KEYWORDS.some((p) => p.test(msg));

type DialogState =
  | { state: "needs_brand"; availableBrands: string[] }
  | { state: "needs_model"; brand: string; brandSlug: string; brandId: string; availableModels: string[] }
  | { state: "needs_resin"; brandSlug: string; modelSlug: string; brandName: string; modelName: string; availableResins: string[] }
  | { state: "has_resin"; brandSlug: string; modelSlug: string; resinName: string; found: boolean }
  | { state: "brand_not_found"; brandGuess: string; availableBrands: string[] }
  | { state: "model_not_found"; brand: string; brandSlug: string; availableModels: string[] }
  | { state: "not_in_dialog" };

// Fetch all active brand names from DB
async function fetchActiveBrands(supabase: ReturnType<typeof createClient>): Promise<Array<{ id: string; slug: string; name: string }>> {
  const { data } = await supabase
    .from("brands")
    .select("id, slug, name")
    .eq("active", true)
    .order("name");
  return data || [];
}

// Fetch active models for a specific brand
async function fetchBrandModels(supabase: ReturnType<typeof createClient>, brandId: string): Promise<Array<{ slug: string; name: string }>> {
  const { data } = await supabase
    .from("models")
    .select("slug, name")
    .eq("active", true)
    .eq("brand_id", brandId)
    .order("name");
  return data || [];
}

// Fetch distinct resin names from parameter_sets for a brand+model combination
async function fetchAvailableResins(supabase: ReturnType<typeof createClient>, brandSlug: string, modelSlug: string): Promise<string[]> {
  const { data } = await supabase
    .from("parameter_sets")
    .select("resin_name")
    .eq("active", true)
    .eq("brand_slug", brandSlug)
    .eq("model_slug", modelSlug)
    .order("resin_name");
  if (!data?.length) return [];
  // Deduplicate
  const seen = new Set<string>();
  return data.map((r: { resin_name: string }) => r.resin_name).filter((n: string) => { if (seen.has(n)) return false; seen.add(n); return true; });
}

// Localized messages for each dialog step
const ASK_BRAND: Record<string, (brands: string[]) => string> = {
  "pt-BR": (brands) => `Claro! Para te ajudar com os parâmetros, qual é a **marca** da sua impressora?\n\nMarcas disponíveis: ${brands.join(", ")}`,
  "en-US": (brands) => `Sure! To help you with parameters, what is your printer **brand**?\n\nAvailable brands: ${brands.join(", ")}`,
  "es-ES": (brands) => `¡Claro! Para ayudarte con los parámetros, ¿cuál es la **marca** de tu impresora?\n\nMarcas disponibles: ${brands.join(", ")}`,
};

const ASK_MODEL: Record<string, (brand: string, models: string[]) => string> = {
  "pt-BR": (brand, models) => `Ótimo! A **${brand}** está cadastrada aqui. Qual é o **modelo** da impressora?\n\nModelos disponíveis: ${models.join(", ")}`,
  "en-US": (brand, models) => `Great! **${brand}** is in our database. What is the printer **model**?\n\nAvailable models: ${models.join(", ")}`,
  "es-ES": (brand, models) => `¡Genial! La **${brand}** está registrada aquí. ¿Cuál es el **modelo** de la impresora?\n\nModelos disponibles: ${models.join(", ")}`,
};

const ASK_RESIN: Record<string, (brand: string, model: string, modelSlug: string, brandSlug: string) => string> = {
  "pt-BR": (brand, model, _modelSlug, _brandSlug) =>
    `Encontrei a **${brand} ${model}**! Qual **resina** você vai usar?\n\nMe diga o nome da resina e verifico os parâmetros para você 😊`,
  "en-US": (brand, model, _modelSlug, _brandSlug) =>
    `Found **${brand} ${model}**! Which **resin** will you use?\n\nTell me the resin name and I'll check the parameters for you 😊`,
  "es-ES": (brand, model, _modelSlug, _brandSlug) =>
    `¡Encontré la **${brand} ${model}**! ¿Qué **resina** vas a usar?\n\nDime el nombre de la resina y verifico los parámetros para ti 😊`,
};

const RESIN_FOUND: Record<string, (resin: string, brand: string, model: string, brandSlug: string, modelSlug: string) => string> = {
  "pt-BR": (resin, brand, model, brandSlug, modelSlug) =>
    `Perfeito! Encontrei os parâmetros da **${resin}** para a **${brand} ${model}**:\n👉 [Ver parâmetros](/${brandSlug}/${modelSlug})\n\nSe precisar dos valores específicos, é só me pedir e busco para você!`,
  "en-US": (resin, brand, model, brandSlug, modelSlug) =>
    `Perfect! Found parameters for **${resin}** on the **${brand} ${model}**:\n👉 [View parameters](/${brandSlug}/${modelSlug})\n\nIf you need the specific values, just ask and I'll find them for you!`,
  "es-ES": (resin, brand, model, brandSlug, modelSlug) =>
    `¡Perfecto! Encontré los parámetros de **${resin}** para la **${brand} ${model}**:\n👉 [Ver parámetros](/${brandSlug}/${modelSlug})\n\n¡Si necesitas los valores específicos, solo pídeme y los busco para ti!`,
};

const RESIN_NOT_FOUND: Record<string, (resin: string, brand: string, model: string, brandSlug: string, modelSlug: string, availableResins: string[]) => string> = {
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

const BRAND_NOT_FOUND: Record<string, (brand: string, availableBrands: string[]) => string> = {
  "pt-BR": (brand, brands) => `Não encontrei a marca **${brand}** no nosso sistema.\n\nMarcas disponíveis: ${brands.join(", ")}\n\nOu acesse: 👉 [Ver todos os parâmetros](/)`,
  "en-US": (brand, brands) => `I couldn't find **${brand}** in our system.\n\nAvailable brands: ${brands.join(", ")}\n\nOr visit: 👉 [View all parameters](/)`,
  "es-ES": (brand, brands) => `No encontré la marca **${brand}** en nuestro sistema.\n\nMarcas disponibles: ${brands.join(", ")}\n\nO accede: 👉 [Ver todos los parámetros](/)`,
};

const MODEL_NOT_FOUND: Record<string, (brand: string, brandSlug: string, availableModels: string[]) => string> = {
  "pt-BR": (brand, brandSlug, models) => `Não encontrei esse modelo para a **${brand}**.\n\nModelos disponíveis: ${models.join(", ")}\n\nOu acesse: 👉 [Ver modelos da ${brand}](/${brandSlug})`,
  "en-US": (brand, brandSlug, models) => `I couldn't find that model for **${brand}**.\n\nAvailable models: ${models.join(", ")}\n\nOr visit: 👉 [View ${brand} models](/${brandSlug})`,
  "es-ES": (brand, brandSlug, models) => `No encontré ese modelo para la **${brand}**.\n\nModelos disponibles: ${models.join(", ")}\n\nO accede: 👉 [Ver modelos de ${brand}](/${brandSlug})`,
};

// Find a brand by name in the user's message
async function findBrandInMessage(
  brands: Array<{ id: string; slug: string; name: string }>,
  message: string
): Promise<{ id: string; slug: string; name: string } | null> {
  const msg = message.toLowerCase();
  // Sort by name length descending to prefer longer (more specific) matches
  const sorted = [...brands].sort((a, b) => b.name.length - a.name.length);
  return sorted.find((b) => msg.includes(b.name.toLowerCase())) || null;
}

// Find a model by name in the user's message, from a pre-fetched list
function findModelInList(
  models: Array<{ slug: string; name: string }>,
  message: string
): { slug: string; name: string } | null {
  const msg = message.toLowerCase();

  const scored = models
    .map((m) => {
      const words = m.name.toLowerCase().split(/\s+/).filter((w) => w.length >= 1);
      const matches = words.filter((w) => msg.includes(w)).length;
      const ratio = matches / words.length;
      return { model: m, matches, wordCount: words.length, ratio };
    })
    .filter((x) => x.matches > 0)
    .sort((a, b) => b.ratio - a.ratio || b.matches - a.matches || a.wordCount - b.wordCount);

  const best = scored[0];
  if (!best) return null;
  if (best.matches >= 1 && best.ratio >= 0.5) return best.model;
  return null;
}

// Find a resin in the list using fuzzy matching
function findResinInList(resins: string[], message: string): string | null {
  const msg = message.toLowerCase().trim();
  // Sort by length descending for longer match priority
  const sorted = [...resins].sort((a, b) => b.length - a.length);
  // Try full name match first
  const exact = sorted.find((r) => msg.includes(r.toLowerCase()));
  if (exact) return exact;
  // Try word-level match: any word >= 4 chars from the message that appears in a resin name
  // Also: if message is a single meaningful word (e.g. "Vitality"), match it against any resin containing that word
  const msgWords = msg.split(/\s+/).filter((w) => w.length >= 4);
  for (const word of msgWords) {
    const hit = sorted.find((r) => r.toLowerCase().includes(word));
    if (hit) return hit;
  }
  // Fallback: ratio-based match (any 1 matching word is enough for short queries)
  const scored = resins.map((r) => {
    const words = r.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
    const matches = words.filter((w) => msg.includes(w)).length;
    return { resin: r, matches, ratio: words.length ? matches / words.length : 0 };
  }).filter((x) => x.matches > 0).sort((a, b) => b.ratio - a.ratio || b.matches - a.matches);
  return scored.length > 0 ? scored[0].resin : null;
}

// Detect which step of the guided dialog we're in — uses agent_sessions for persistence
// Falls back to regex-on-history if session lookup fails (resilience)
async function detectPrinterDialogState(
  supabase: ReturnType<typeof createClient>,
  message: string,
  history: Array<{ role: string; content: string }>,
  sessionId: string
): Promise<DialogState> {
  // Always fetch brands (needed for most steps)
  const allBrands = await fetchActiveBrands(supabase);
  const brandNames = allBrands.map((b) => b.name);

  // ── Load persistent session state ──────────────────────────────────────────
  let sessionData: { current_state: string; extracted_entities: Record<string, string>; last_activity_at: string } | null = null;
  try {
    const { data } = await supabase
      .from("agent_sessions")
      .select("current_state, extracted_entities, last_activity_at")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (data) {
      // Validate expiration: if last_activity_at > 2 hours ago, treat as idle
      const lastActivity = new Date(data.last_activity_at).getTime();
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      if (lastActivity < twoHoursAgo) {
        // Session expired — reset silently
        await supabase
          .from("agent_sessions")
          .upsert({ session_id: sessionId, current_state: "idle", extracted_entities: {}, last_activity_at: new Date().toISOString() }, { onConflict: "session_id" });
        sessionData = null;
      } else {
        sessionData = data as { current_state: string; extracted_entities: Record<string, string>; last_activity_at: string };
      }
    }
  } catch (e) {
    console.warn("agent_sessions lookup failed, falling back to history regex:", e);
  }

  // ── Helper: persist state update cumulatively ──────────────────────────────
  const persistState = async (newState: string, newEntities: Record<string, string>) => {
    const updatedEntities = { ...(sessionData?.extracted_entities || {}), ...newEntities };
    try {
      await supabase.from("agent_sessions").upsert({
        session_id: sessionId,
        current_state: newState,
        extracted_entities: updatedEntities,
        last_activity_at: new Date().toISOString(),
      }, { onConflict: "session_id" });
    } catch (e) {
      console.warn("agent_sessions upsert failed:", e);
    }
    return updatedEntities;
  };

  const currentState = sessionData?.current_state || "idle";
  const entities = sessionData?.extracted_entities || {};

  // ── State machine based on persisted state ─────────────────────────────────

  // State: needs_model → user is responding with a brand name
  if (currentState === "needs_brand" || currentState === "brand_not_found") {
    const brand = await findBrandInMessage(allBrands, message);
    if (brand) {
      const models = await fetchBrandModels(supabase, brand.id);
      const modelNames = models.map((m) => m.name);
      await persistState("needs_model", { brand_name: brand.name, brand_slug: brand.slug, brand_id: brand.id });
      return { state: "needs_model", brand: brand.name, brandSlug: brand.slug, brandId: brand.id, availableModels: modelNames };
    }
    const guess = message.trim().replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, "").trim();
    await persistState("brand_not_found", {});
    return { state: "brand_not_found", brandGuess: guess || message.trim(), availableBrands: brandNames };
  }

  // State: needs_resin → user is responding with a model name
  if (currentState === "needs_model" || currentState === "model_not_found") {
    const brandSlug = entities.brand_slug;
    const brandId = entities.brand_id;
    const brandName = entities.brand_name;

    if (brandSlug && brandId) {
      const brandObj = allBrands.find((b) => b.id === brandId);
      const models = await fetchBrandModels(supabase, brandId);
      const model = findModelInList(models, message);
      if (model) {
        const resins = await fetchAvailableResins(supabase, brandSlug, model.slug);
        await persistState("needs_resin", { model_slug: model.slug, model_name: model.name });
        return {
          state: "needs_resin",
          brandSlug,
          modelSlug: model.slug,
          brandName: brandName || (brandObj?.name ?? ""),
          modelName: model.name,
          availableResins: resins,
        };
      }
      const modelNames = models.map((m) => m.name);
      await persistState("model_not_found", {});
      return { state: "model_not_found", brand: brandName || "", brandSlug, availableModels: modelNames };
    }
  }

  // State: has_resin → user is responding with a resin name
  if (currentState === "needs_resin") {
    const brandSlug = entities.brand_slug;
    const modelSlug = entities.model_slug;
    if (brandSlug && modelSlug) {
      const availableResins = await fetchAvailableResins(supabase, brandSlug, modelSlug);
      const matched = findResinInList(availableResins, message);
      if (matched) {
        await persistState("idle", {});
        return { state: "has_resin", brandSlug, modelSlug, resinName: matched, found: true };
      }
      const guess = message.trim().slice(0, 80);
      await persistState("idle", {});
      return { state: "has_resin", brandSlug, modelSlug, resinName: guess, found: false };
    }
  }

  // ── Fallback: regex on last assistant message (resilience for legacy sessions) ──
  const lastAssistantMsg = [...history].reverse().find((h) => h.role === "assistant");
  const lastContent = lastAssistantMsg?.content || "";
  const lastLower = lastContent.toLowerCase();

  const liaAskedBrand =
    (lastLower.includes("marca") || lastLower.includes("brand")) &&
    (lastLower.includes("qual") || lastLower.includes("what") || lastLower.includes("cuál") || lastLower.includes("cual")) &&
    !lastLower.includes("modelo") && !lastLower.includes("model");

  const liaAskedModel =
    (lastLower.includes("modelo") || lastLower.includes("model")) &&
    (lastLower.includes("qual") || lastLower.includes("what") || lastLower.includes("cuál") || lastLower.includes("cual")) &&
    !lastLower.includes("resina") && !lastLower.includes("resin");

  const liaAskedResin =
    (lastLower.includes("resina") || lastLower.includes("resin")) &&
    (lastLower.includes("qual") || lastLower.includes("what") || lastLower.includes("cuál") || lastLower.includes("cual") ||
     lastLower.includes("vai usar") || lastLower.includes("will you use") || lastLower.includes("vas a usar"));

  if (liaAskedResin) {
    const linkMatch = lastContent.match(/\]\(\/([^/]+)\/([^)]+)\)/);
    if (linkMatch) {
      const brandSlug = linkMatch[1];
      const modelSlug = linkMatch[2];
      const availableResins = await fetchAvailableResins(supabase, brandSlug, modelSlug);
      const matched = findResinInList(availableResins, message);
      if (matched) {
        await persistState("idle", {});
        return { state: "has_resin", brandSlug, modelSlug, resinName: matched, found: true };
      }
      const guess = message.trim().slice(0, 80);
      await persistState("idle", {});
      return { state: "has_resin", brandSlug, modelSlug, resinName: guess, found: false };
    }
  }

  if (liaAskedBrand) {
    const brand = await findBrandInMessage(allBrands, message);
    if (brand) {
      const models = await fetchBrandModels(supabase, brand.id);
      const modelNames = models.map((m) => m.name);
      await persistState("needs_model", { brand_name: brand.name, brand_slug: brand.slug, brand_id: brand.id });
      return { state: "needs_model", brand: brand.name, brandSlug: brand.slug, brandId: brand.id, availableModels: modelNames };
    }
    const guess = message.trim().replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, "").trim();
    await persistState("brand_not_found", {});
    return { state: "brand_not_found", brandGuess: guess || message.trim(), availableBrands: brandNames };
  }

  if (liaAskedModel) {
    const boldedPhrases = [...lastContent.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1]);
    let matchedBrand: typeof allBrands[0] | undefined;
    for (const phrase of boldedPhrases) {
      const phraseLower = phrase.toLowerCase();
      const found = allBrands.find(
        (b) => phraseLower === b.name.toLowerCase() || phraseLower.includes(b.name.toLowerCase())
      );
      if (found) { matchedBrand = found; break; }
    }
    if (!matchedBrand) {
      matchedBrand = allBrands.find((b) => lastLower.includes(b.name.toLowerCase()));
    }

    if (matchedBrand) {
      const models = await fetchBrandModels(supabase, matchedBrand.id);
      const model = findModelInList(models, message);
      if (model) {
        const resins = await fetchAvailableResins(supabase, matchedBrand.slug, model.slug);
        await persistState("needs_resin", { brand_name: matchedBrand.name, brand_slug: matchedBrand.slug, brand_id: matchedBrand.id, model_slug: model.slug, model_name: model.name });
        if (resins.length > 0) {
          return { state: "needs_resin", brandSlug: matchedBrand.slug, modelSlug: model.slug, brandName: matchedBrand.name, modelName: model.name, availableResins: resins };
        }
        return { state: "needs_resin", brandSlug: matchedBrand.slug, modelSlug: model.slug, brandName: matchedBrand.name, modelName: model.name, availableResins: [] };
      }
      const modelNames = models.map((m) => m.name);
      await persistState("model_not_found", { brand_name: matchedBrand.name, brand_slug: matchedBrand.slug, brand_id: matchedBrand.id });
      return { state: "model_not_found", brand: matchedBrand.name, brandSlug: matchedBrand.slug, availableModels: modelNames };
    }
  }

  // Step 1: Current message is a param question — start the dialog
  if (isPrinterParamQuestion(message)) {
    await persistState("needs_brand", {});
    return { state: "needs_brand", availableBrands: brandNames };
  }

  return { state: "not_in_dialog" };
}

const GREETING_RESPONSES: Record<string, string> = {
  "pt-BR": `Olá! 😊 Seja bem-vindo à SmartDent!\n\nSou a Dra. L.I.A., sua assistente de odontologia digital. Estou aqui para te ajudar com o que você precisar.\n\nMe conta: o que você está buscando hoje? Pode ser uma dúvida sobre resinas, parâmetros de impressão 3D, protocolos clínicos ou qualquer outro assunto odontológico. 👇`,
  "en-US": `Hello! 😊 Welcome to SmartDent!\n\nI'm Dr. L.I.A., your digital dentistry assistant. I'm here to help you with whatever you need.\n\nTell me: what are you looking for today? It could be a question about resins, 3D print parameters, clinical protocols, or any other dental topic. 👇`,
  "es-ES": `¡Hola! 😊 ¡Bienvenido a SmartDent!\n\nSoy la Dra. L.I.A., tu asistente de odontología digital. Estoy aquí para ayudarte con lo que necesites.\n\nCuéntame: ¿qué estás buscando hoy? Puede ser una duda sobre resinas, parámetros de impresión 3D, protocolos clínicos o cualquier otro tema odontológico. 👇`,
};

// Multilingual fallback messages when no results found
const FALLBACK_MESSAGES: Record<string, string> = {
  "pt-BR": `Ainda não tenho essa informação em nossa base de conhecimento, mas nossos especialistas podem ajudar você! 😊

💬 **WhatsApp:** [Chamar no WhatsApp](https://api.whatsapp.com/send/?phone=551634194735&text=Ol%C3%A1+poderia+me+ajudar%3F)
✉️ **E-mail:** comercial@smartdent.com.br
🕐 **Horário:** Segunda a Sexta, 08h às 18h

Nossa equipe está pronta para explicar melhor!`,

  "en-US": `I don't have this information in our knowledge base yet, but our specialists can help you! 😊

💬 **WhatsApp:** [Chat on WhatsApp](https://api.whatsapp.com/send/?phone=551634194735&text=Ol%C3%A1+poderia+me+ajudar%3F)
✉️ **E-mail:** comercial@smartdent.com.br
🕐 **Hours:** Monday to Friday, 8am–6pm (BRT)

Our team is ready to help!`,

  "es-ES": `Todavía no tengo esa información en nuestra base de conocimiento, pero nuestros especialistas pueden ayudarte! 😊

💬 **WhatsApp:** [Chatear por WhatsApp](https://api.whatsapp.com/send/?phone=551634194735&text=Ol%C3%A1+poderia+me+ajudar%3F)
✉️ **E-mail:** comercial@smartdent.com.br
🕐 **Horario:** Lunes a Viernes, 08h–18h (BRT)

¡Nuestro equipo está listo para ayudarte!`,
};

const LANG_INSTRUCTIONS: Record<string, string> = {
  "pt-BR": "RESPONDA SEMPRE em português do Brasil (pt-BR). Mesmo que os dados do contexto estejam em outro idioma.",
  "en-US": "ALWAYS RESPOND in English (en-US). Even if the context data is in Portuguese or Spanish. Translate technical descriptions but keep numerical values as-is.",
  "es-ES": "RESPONDE SIEMPRE en español (es-ES). Aunque los datos del contexto estén en portugués. Traduce las descripciones pero mantén los valores numéricos.",
};

// Generate embedding via Google AI API (if key available) or return null
async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!GOOGLE_AI_KEY) return null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GOOGLE_AI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text }] },
          outputDimensionality: 768,
        }),
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.embedding?.values || null;
  } catch {
    return null;
  }
}

// ── Helper: upsert knowledge gap with frequency increment ─────────────────
async function upsertKnowledgeGap(
  supabase: ReturnType<typeof createClient>,
  question: string,
  lang: string,
  status: "pending" | "low_confidence" = "pending"
) {
  try {
    const truncated = question.slice(0, 500);
    const { data: existing } = await supabase
      .from("agent_knowledge_gaps")
      .select("id, frequency")
      .eq("question", truncated)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("agent_knowledge_gaps")
        .update({
          frequency: (existing.frequency ?? 1) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("agent_knowledge_gaps")
        .insert({ question: truncated, lang, frequency: 1, status });
    }
  } catch (e) {
    console.error("[upsertKnowledgeGap] error:", e);
    // fail silently
  }
}

// Search processing instructions directly from resins table — SOURCE OF TRUTH
async function searchProcessingInstructions(
  supabase: ReturnType<typeof createClient>,
  message: string,
  history: Array<{ role: string; content: string }> = []
) {
  const { data: resins, error } = await supabase
    .from("resins")
    .select("id, name, manufacturer, slug, processing_instructions, cta_1_url, cta_1_label")
    .eq("active", true)
    .not("processing_instructions", "is", null);

  if (error || !resins?.length) return [];

  // Combine recent history + current message to identify resin from conversation context
  const recentHistory = history.slice(-8).map((h) => h.content).join(' ');
  const combinedText = `${recentHistory} ${message}`.toLowerCase();
  const words = combinedText.split(/\s+/).filter((w) => w.length > 3);

  const scored = resins
    .map((r: {
      id: string;
      name: string;
      manufacturer: string;
      slug: string | null;
      processing_instructions: string;
      cta_1_url: string | null;
      cta_1_label: string | null;
    }) => {
      const text = `${r.name} ${r.manufacturer}`.toLowerCase();
      const score = words.filter((w) => text.includes(w)).length;
      return { resin: r, score };
    })
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

  // If a specific resin was mentioned, use only matched ones; otherwise return all
  const matched = scored.filter((x: { score: number }) => x.score > 0);
  const targets = matched.length > 0 ? matched : scored;

  return targets.slice(0, 3).map(({ resin: r }: { resin: {
    id: string;
    name: string;
    manufacturer: string;
    slug: string | null;
    processing_instructions: string;
    cta_1_url: string | null;
    cta_1_label: string | null;
  }}) => ({
    id: r.id,
    source_type: "processing_protocol",
    chunk_text: `${r.name} (${r.manufacturer}) — Instruções de Pré e Pós Processamento:\n${r.processing_instructions}`,
    metadata: {
      title: `Protocolo de Processamento: ${r.name}`,
      resin_name: r.name,
      cta_1_url: r.cta_1_url,
      url_publica: r.slug ? `/resina/${r.slug}` : null,
    },
    similarity: 0.95, // High priority — source of truth
  }));
}

// Search parameter_sets directly based on brand/model/resin mentions in full conversation context
async function searchParameterSets(
  supabase: ReturnType<typeof createClient>,
  message: string,
  history: Array<{ role: string; content: string }>
) {
  const recentHistory = history.slice(-8).map((h) => h.content).join(" ");
  const combinedText = `${recentHistory} ${message}`.toLowerCase();

  const { data: brands } = await supabase.from("brands").select("id, slug, name").eq("active", true);
  if (!brands?.length) return [];

  const mentionedBrands = (brands as Array<{ id: string; slug: string; name: string }>).filter(
    (b) => combinedText.includes(b.name.toLowerCase()) || combinedText.includes(b.slug.replace(/-/g, " "))
  );
  if (!mentionedBrands.length) return [];

  const paramResults: Array<{ id: string; source_type: string; chunk_text: string; metadata: Record<string, unknown>; similarity: number }> = [];

  for (const brand of mentionedBrands.slice(0, 2)) {
    const { data: models } = await supabase.from("models").select("slug, name").eq("brand_id", brand.id).eq("active", true);
    if (!models?.length) continue;

    type ModelRow = { slug: string; name: string };
    const mentionedModels = (models as ModelRow[]).filter((m) => {
      const nameWords = m.name.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
      const matches = nameWords.filter((w) => combinedText.includes(w)).length;
      return matches >= 1 && (matches >= Math.ceil(nameWords.length * 0.5));
    });

    for (const model of mentionedModels.slice(0, 2)) {
      type ParamRow = { id: string; resin_name: string; layer_height: number; cure_time: number; light_intensity: number; bottom_layers: number | null; bottom_cure_time: number | null; lift_speed: number | null; lift_distance: number | null; retract_speed: number | null; notes: string | null };
      const { data: params } = await supabase.from("parameter_sets").select("id, resin_name, layer_height, cure_time, light_intensity, bottom_layers, bottom_cure_time, lift_speed, lift_distance, retract_speed, notes").eq("brand_slug", brand.slug).eq("model_slug", model.slug).eq("active", true).limit(15);
      if (!params?.length) continue;

      const typedParams = params as ParamRow[];
      const resinMatched = typedParams.find((p) => {
        const resinWords = p.resin_name.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
        return resinWords.some((w) => combinedText.includes(w));
      });

      const targetParams = resinMatched
        ? typedParams.filter((p) => resinMatched.resin_name.toLowerCase().split(/\s+/).filter((w) => w.length >= 4).some((w) => p.resin_name.toLowerCase().includes(w)))
        : typedParams.slice(0, 5);

      for (const p of targetParams.slice(0, 5)) {
        const lines = [
          `Parâmetros de impressão confirmados: ${brand.name} ${model.name} + ${p.resin_name}`,
          `• Altura de camada: ${p.layer_height}mm`,
          `• Tempo de cura: ${p.cure_time}s`,
          `• Intensidade de luz: ${p.light_intensity}%`,
          p.bottom_layers != null ? `• Camadas iniciais: ${p.bottom_layers} x ${p.bottom_cure_time}s` : "",
          p.lift_speed != null ? `• Lift speed: ${p.lift_speed}mm/min | Lift distance: ${p.lift_distance}mm` : "",
          p.retract_speed != null ? `• Retract speed: ${p.retract_speed}mm/min` : "",
          p.notes ? `• Observações: ${p.notes}` : "",
        ].filter(Boolean).join("\n");

        paramResults.push({
          id: p.id,
          source_type: "parameter_set",
          chunk_text: lines,
          metadata: { title: `${brand.name} ${model.name} + ${p.resin_name}`, url_publica: `/${brand.slug}/${model.slug}` },
          similarity: resinMatched ? 0.93 : 0.78,
        });
      }
    }
  }
  return paramResults;
}

// Search using pgvector if embeddings available, otherwise full-text search
async function searchKnowledge(
  supabase: ReturnType<typeof createClient>,
  query: string,
  lang: string
) {
  // Try vector search first
  const embedding = await generateEmbedding(query);

  if (embedding) {
    const { data, error } = await supabase.rpc("match_agent_embeddings", {
      query_embedding: embedding,
      match_threshold: 0.65,
      match_count: 10,
    });
    if (!error && data && data.length > 0) {
      return { results: data, method: "vector", topSimilarity: data[0]?.similarity || 0 };
    }
  }

  // Fallback: full-text search via existing search_knowledge_base function
  const langCode = lang.split("-")[0]; // 'pt' | 'en' | 'es'
  const { data: articles, error: artError } = await supabase.rpc("search_knowledge_base", {
    search_query: query,
    language_code: langCode,
  });

  const ftsResults = (!artError && articles && articles.length > 0)
    ? articles.slice(0, 8).map((a: {
        content_id: string;
        content_type: string;
        title: string;
        excerpt: string;
        slug: string;
        category_letter: string;
        relevance: number;
      }) => ({
        id: a.content_id,
        source_type: a.content_type,
        chunk_text: `${a.title} | ${a.excerpt}`,
        metadata: {
          title: a.title,
          slug: a.slug,
          category_letter: a.category_letter,
          url_publica: `/base-conhecimento/${a.category_letter}/${a.slug}`,
        },
        similarity: a.relevance,
      }))
    : [];

  // Check FTS quality: weak if 0-2 results with low relevance (< 0.25)
  const ftsIsWeak =
    ftsResults.length === 0 ||
    (ftsResults.length <= 2 && (ftsResults[0]?.similarity ?? 0) < 0.25);

  if (ftsIsWeak) {
    const ilikeResults = await searchByILIKE(supabase, query);
    if (ilikeResults.length > 0) {
      // Merge: ILIKE first, then any decent FTS results (>= 0.15)
      const merged = [
        ...ilikeResults,
        ...ftsResults.filter((f) => f.similarity >= 0.15),
      ];
      return { results: merged, method: "ilike", topSimilarity: merged[0]?.similarity || 0.3 };
    }
  }

  if (ftsResults.length > 0) {
    return { results: ftsResults, method: "fulltext", topSimilarity: ftsResults[0]?.similarity || 0 };
  }

  // Last resort: keyword search on videos
  const keywords = query.split(" ").filter((w) => w.length > 3).slice(0, 4);

  if (keywords.length > 0) {
    const { data: videos } = await supabase
      .from("knowledge_videos")
      .select("id, title, description, embed_url, thumbnail_url, content_id, pandavideo_id")
      .or(keywords.map((k) => `title.ilike.%${k}%`).join(","))
      .limit(5);

    if (videos && videos.length > 0) {
      // Fetch internal page URLs for videos with associated articles
      const contentIds = videos.filter((v: { content_id: string | null }) => v.content_id).map((v: { content_id: string }) => v.content_id);
      let contentMap: Record<string, { slug: string; category_letter: string }> = {};

      if (contentIds.length > 0) {
        const { data: contents } = await supabase
          .from("knowledge_contents")
          .select("id, slug, category_id, knowledge_categories:knowledge_categories(letter)")
          .in("id", contentIds);

        if (contents) {
          for (const c of contents as Array<{ id: string; slug: string; knowledge_categories: { letter: string } | null }>) {
            const letter = c.knowledge_categories?.letter?.toLowerCase() || "";
            if (letter) {
              contentMap[c.id] = { slug: c.slug, category_letter: letter };
            }
          }
        }
      }

      const results = videos.map((v: {
        id: string;
        title: string;
        description: string | null;
        embed_url: string | null;
        thumbnail_url: string | null;
        content_id: string | null;
        pandavideo_id: string | null;
      }) => {
        const contentInfo = v.content_id ? contentMap[v.content_id] : null;
        const internalUrl = contentInfo
          ? `/base-conhecimento/${contentInfo.category_letter}/${contentInfo.slug}`
          : null;

        return {
          id: v.id,
          source_type: "video",
          chunk_text: `${v.title} ${v.description || ""}`,
          metadata: {
            title: v.title,
            embed_url: v.embed_url,
            thumbnail_url: v.thumbnail_url,
            video_id: v.id,
            url_interna: internalUrl,
            has_internal_page: !!internalUrl,
          },
          similarity: 0.5,
        };
      });
      return { results, method: "keyword", topSimilarity: 0.5 };
    }
  }

  return { results: [], method: "none", topSimilarity: 0 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "chat";

    // ── ACTION: feedback ─────────────────────────────────────────
    if (action === "feedback") {
      const { interaction_id, feedback, feedback_comment } = await req.json();

      await supabase
        .from("agent_interactions")
        .update({ feedback, feedback_comment })
        .eq("id", interaction_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: chat ─────────────────────────────────────────────
    const { message, history = [], lang = "pt-BR", session_id: rawSessionId } = await req.json();
    const session_id = rawSessionId || crypto.randomUUID();

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 0. Intent Guard — intercept greetings before RAG
    if (isGreeting(message)) {
      const greetingText = GREETING_RESPONSES[lang] || GREETING_RESPONSES["pt-BR"];
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const words = greetingText.split(" ");
          let i = 0;
          const interval = setInterval(() => {
            if (i < words.length) {
              const token = (i === 0 ? "" : " ") + words[i];
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`)
              );
              i++;
            } else {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              clearInterval(interval);
            }
          }, 25);
        },
      });
      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // 0b. Support question guard — redirect to WhatsApp without RAG
    if (isSupportQuestion(message)) {
      const supportText = SUPPORT_FALLBACK[lang] || SUPPORT_FALLBACK["pt-BR"];
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const words = supportText.split(" ");
          let i = 0;
          const interval = setInterval(() => {
            if (i < words.length) {
              const token = (i === 0 ? "" : " ") + words[i];
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`)
              );
              i++;
            } else {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              clearInterval(interval);
            }
          }, 25);
        },
      });
      // Save interaction
      try {
        await supabase.from("agent_interactions").insert({
          session_id,
          user_message: message,
          agent_response: supportText,
          lang,
          top_similarity: 1,
          unanswered: false,
        });
      } catch (e) {
        console.error("Failed to insert agent_interaction (support guard):", e);
      }
      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // 0c. Guided printer dialog — asks brand → model → sends link
    const dialogState = await detectPrinterDialogState(supabase, message, history, session_id);

    if (dialogState.state !== "not_in_dialog") {
      let dialogText: string;
      let contextSources: Array<{ type: string; title: string }> = [];

      if (dialogState.state === "needs_brand") {
        const fn = ASK_BRAND[lang] || ASK_BRAND["pt-BR"];
        dialogText = fn(dialogState.availableBrands);
      } else if (dialogState.state === "needs_model") {
        const fn = ASK_MODEL[lang] || ASK_MODEL["pt-BR"];
        dialogText = fn(dialogState.brand, dialogState.availableModels);
      } else if (dialogState.state === "needs_resin") {
        const fn = ASK_RESIN[lang] || ASK_RESIN["pt-BR"];
        dialogText = fn(dialogState.brandName, dialogState.modelName, dialogState.modelSlug, dialogState.brandSlug);
        contextSources = [{ type: "printer_page", title: `${dialogState.brandName} ${dialogState.modelName}` }];
      } else if (dialogState.state === "has_resin") {
        // Find brand/model names from slugs for the response message
        const [{ data: brandData }, { data: modelData }] = await Promise.all([
          supabase.from("brands").select("name").eq("slug", dialogState.brandSlug).single(),
          supabase.from("models").select("name").eq("slug", dialogState.modelSlug).single(),
        ]);
        const brandName = brandData?.name || dialogState.brandSlug;
        const modelName = modelData?.name || dialogState.modelSlug;
        if (dialogState.found) {
          const fn = RESIN_FOUND[lang] || RESIN_FOUND["pt-BR"];
          dialogText = fn(dialogState.resinName, brandName, modelName, dialogState.brandSlug, dialogState.modelSlug);
        } else {
          // Fetch available resins to show in fallback message
          const availableResins = await fetchAvailableResins(supabase, dialogState.brandSlug, dialogState.modelSlug);
          const fn = RESIN_NOT_FOUND[lang] || RESIN_NOT_FOUND["pt-BR"];
          dialogText = fn(dialogState.resinName, brandName, modelName, dialogState.brandSlug, dialogState.modelSlug, availableResins);
        }
        contextSources = [{ type: "printer_page", title: `${brandName} ${modelName}` }];
      } else if (dialogState.state === "brand_not_found") {
        const fn = BRAND_NOT_FOUND[lang] || BRAND_NOT_FOUND["pt-BR"];
        dialogText = fn(dialogState.brandGuess, dialogState.availableBrands);
      } else if (dialogState.state === "model_not_found") {
        const fn = MODEL_NOT_FOUND[lang] || MODEL_NOT_FOUND["pt-BR"];
        dialogText = fn(dialogState.brand, dialogState.brandSlug, dialogState.availableModels);
      } else {
        dialogText = "";
      }

      // Save interaction
      let dialogInteractionId: string | undefined;
      try {
        const { data: interaction } = await supabase
          .from("agent_interactions")
          .insert({
            session_id,
            user_message: message,
            agent_response: dialogText,
            lang,
            top_similarity: 1,
            context_sources: contextSources,
            unanswered: false,
          })
          .select("id")
          .single();
        dialogInteractionId = interaction?.id;
      } catch (e) {
        console.error("Failed to insert agent_interaction (dialog):", e);
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ interaction_id: dialogInteractionId, type: "meta", media_cards: [] })}\n\n`)
          );
          const words = dialogText.split(" ");
          let i = 0;
          const interval = setInterval(() => {
            if (i < words.length) {
              const token = (i === 0 ? "" : " ") + words[i];
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`)
              );
              i++;
            } else {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              clearInterval(interval);
            }
          }, 25);
        },
      });
      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // 1. Parallel search: knowledge base + processing protocols (if protocol question)
    const isProtocol = isProtocolQuestion(message);

    const [knowledgeResult, protocolResults, paramResults] = await Promise.all([
      searchKnowledge(supabase, message, lang),
      isProtocol ? searchProcessingInstructions(supabase, message, history) : Promise.resolve([]),
      searchParameterSets(supabase, message, history),
    ]);

    const { results: knowledgeResults, method, topSimilarity: knowledgeTopSimilarity } = knowledgeResult;

    // 2. Filter knowledge results by minimum similarity
    // Camada 1: Threshold diferenciado por método — ILIKE precisa de score ≥ 0.20, FTS ≥ 0.10
    const MIN_SIMILARITY = method === "vector" ? 0.65
      : method === "ilike" ? 0.20
      : 0.10; // fulltext
    const filteredKnowledge = knowledgeResults.filter((r: { similarity: number }) => r.similarity >= MIN_SIMILARITY);

    // 3. Merge: protocol results first (higher priority), then knowledge results
    const allResults = [...paramResults, ...protocolResults, ...filteredKnowledge];
    const topSimilarity = protocolResults.length > 0
      ? 0.95
      : (filteredKnowledge[0]?.similarity || knowledgeTopSimilarity);

    const hasResults = allResults.length > 0;

    // 4. If no results: return human fallback
    if (!hasResults) {
      const fallbackText = FALLBACK_MESSAGES[lang] || FALLBACK_MESSAGES["pt-BR"];

      let fallbackInteractionId: string | undefined;
      try {
        const { data: interaction } = await supabase
          .from("agent_interactions")
          .insert({
            session_id,
            user_message: message,
            agent_response: fallbackText,
            lang,
            top_similarity: 0,
            context_sources: [],
            unanswered: true,
          })
          .select("id")
          .single();
        fallbackInteractionId = interaction?.id;
      } catch (e) {
        console.error("Failed to insert agent_interaction (fallback):", e);
        // fail silently — stream continues regardless
      }

      // Track knowledge gap (Bug fix: was using invalid .onConflict?.() syntax)
      await upsertKnowledgeGap(supabase, message, lang, "pending");

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ interaction_id: fallbackInteractionId, type: "meta" })}\n\n`)
          );
          const words = fallbackText.split(" ");
          let i = 0;
          const interval = setInterval(() => {
            if (i < words.length) {
              const token = (i === 0 ? "" : " ") + words[i];
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`)
              );
              i++;
            } else {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              clearInterval(interval);
            }
          }, 25);
        },
      });

      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Track low-confidence results as knowledge gaps (Bug fix: was never captured before)
    if (topSimilarity < 0.35) {
      await upsertKnowledgeGap(supabase, message, lang, "low_confidence");
    }

    // 5. Build context from all results
    const contextParts = allResults.map((m: {
      source_type: string;
      chunk_text: string;
      metadata: Record<string, unknown>;
    }) => {
      const meta = m.metadata as Record<string, unknown>;
      let part = `[${m.source_type.toUpperCase()}] ${m.chunk_text}`;
      if (meta.url_publica) part += ` | URL: ${meta.url_publica}`;
      if (meta.url_interna) {
        part += ` | VIDEO_INTERNO: ${meta.url_interna}`;
      } else if (meta.embed_url) {
        part += ` | VIDEO_SEM_PAGINA: sem página interna disponível`;
      }
      if (meta.thumbnail_url) part += ` | THUMBNAIL: ${meta.thumbnail_url}`;
      if (meta.cta_1_url) part += ` | COMPRA: ${meta.cta_1_url}`;
      return part;
    });

    const context = contextParts.join("\n\n---\n\n");
    const langInstruction = LANG_INSTRUCTIONS[lang] || LANG_INSTRUCTIONS["pt-BR"];

    const systemPrompt = `Você é a Dra. L.I.A., assistente técnica especialista da Smart Dent. Sua missão é fornecer suporte preciso sobre odontologia digital, impressoras 3D e resinas.

### 🎭 PERSONALIDADE E TOM (Regras de Ouro)
1. **Humana e Calorosa:** Responda como uma especialista gentil, não como um robô de busca. Use saudações naturais.
2. **Direta ao Ponto:** Prefira 2-3 frases claras. Evite paredes de texto.
3. **Consultiva:** Se a pergunta for vaga (ex: "ajuda com resina"), NÃO despeje informações. PERGUNTE: "Claro! Para eu te ajudar melhor, qual resina ou impressora você está usando?"
4. **Sincera:** Se não encontrar a informação exata no contexto RAG, diga: "Não tenho essa informação específica cadastrada no momento."
5. **Foco em Mídia:** Se pedirem um vídeo e você não tiver o link exato, admita o erro. Nunca sugira um texto "substituto" se a intenção clara era assistir a algo.

### 🛠 ESTRATÉGIA DE TRANSIÇÃO HUMANA (Fallback)
Sempre que você admitir que não sabe algo ou notar frustração (ex: "você não ajuda", "não foi isso que perguntei"), finalize obrigatoriamente com:
- "Mas não se preocupe! Nossa equipe de especialistas técnicos pode resolver isso agora mesmo para você via WhatsApp."
- Link: **[Chamar no WhatsApp](https://api.whatsapp.com/send/?phone=551634194735)**.

### 📋 REGRAS DE RESPOSTA (As 17 Diretrizes)
1. Use apenas o contexto RAG fornecido para dados técnicos.
2. Formate sempre em Markdown (negrito para termos chave).
3. Idioma: Responda no mesmo idioma do usuário (PT/EN/ES).
4. Prioridade máxima: Dados de 'processing_instructions' das resinas.
5. Se o usuário perguntar por "parâmetros", siga o fluxo de marca/modelo/resina. Palavras-chave que indicam pedido explícito: "parâmetro", "configuração", "setting", "tempo", "exposição", "layer", "espessura", "velocidade", "how to print", "cómo imprimir", "como imprimir", "valores".
6. Nunca mencione IDs de banco de dados ou termos técnicos internos da infraestrutura.
7. Ao encontrar um VÍDEO: Se tiver VIDEO_INTERNO, gere um link Markdown [▶ Assistir no site](VIDEO_INTERNO_URL) apontando para a página interna. NUNCA use URLs do PandaVideo como links clicáveis. Se tiver VIDEO_SEM_PAGINA, mencione apenas o título sem gerar link.
8. Se houver vídeos no contexto, cite-os apenas se forem diretamente relevantes à pergunta. Só inclua links de vídeos se o usuário pediu explicitamente (palavras: "vídeo", "video", "assistir", "ver", "watch", "tutorial", "mostrar"). Em todos os outros casos, PROIBIDO mencionar ou sugerir a existência de vídeos. NÃO diga "Também temos um vídeo", "temos um tutorial", "posso te mostrar um vídeo" — a menos que o RAG tenha retornado explicitamente um vídeo com VIDEO_INTERNO ou VIDEO_SEM_PAGINA no contexto desta conversa. CRÍTICO: Ao mencionar um vídeo, o título ou descrição do vídeo DEVE conter palavras diretamente relacionadas ao sub-tema pedido pelo usuário. Exemplo: se o usuário perguntou "Qual vídeo sobre tratamento térmico?" e os vídeos disponíveis no contexto têm títulos sobre "protocolos de implante", "impressoras" ou outros temas não relacionados a "tratamento térmico", "forno" ou "temperatura" — responda exatamente: "Não tenho um vídeo específico sobre [sub-tema pedido] cadastrado no momento." e ofereça o WhatsApp. NUNCA apresente um vídeo de tema diferente como cobrindo o sub-tema pedido.
9. Ao encontrar RESINA com link de compra: inclua um link [Ver produto](URL).
10. Mantenha a resposta técnica focada na aplicação odontológica. Valores técnicos (tempos em segundos, alturas em mm) NUNCA traduzir.
11. Se o contexto trouxer múltiplos protocolos de processamento (PROCESSING_PROTOCOL), apresente as etapas na ordem exata: 1. Pré-processamento, 2. Lavagem/Limpeza, 3. Secagem, 4. Pós-cura UV, 5. Tratamento térmico (se houver) — ⚠️ ATENÇÃO CRÍTICA: os valores de temperatura e tempo de tratamento térmico variam drasticamente entre resinas (ex: 130–150°C vs 150°C vs 60–170°C). NUNCA assuma valores padrão como "80°C" ou "15 minutos". Use EXCLUSIVAMENTE os valores presentes na fonte PROCESSING_PROTOCOL. Se não houver dados de tratamento térmico na fonte, diga "Consulte o fabricante para os parâmetros de tratamento térmico desta resina.", 6. Acabamento e polimento (se houver). Use bullet points. Destaque produtos SmartDent com **negrito**. Nunca omita etapas.
12. Busca usada: ${method}${isProtocol ? " + protocolo direto" : ""}. Seja precisa e baseie-se apenas nos dados fornecidos.
13. Mantenha o histórico de mensagens em mente para não repetir saudações ou contextos já explicados.

### ⛔ REGRAS ANTI-ALUCINAÇÃO (OBRIGATÓRIAS)
14. NUNCA cite produtos, parâmetros ou vídeos como "exemplos" quando o usuário não mencionou aquele produto/marca/impressora específica. Use APENAS os dados diretamente relevantes à pergunta feita. NUNCA afirme ter um vídeo sobre um tema se não houver VIDEO_INTERNO ou VIDEO_SEM_PAGINA nas fontes de contexto desta resposta.
15. NUNCA use termos de incerteza: "geralmente", "normalmente", "costuma ser", "em geral", "na maioria dos casos", "provavelmente", "pode ser que", "acredito que", "presumo que", "tipicamente", "é comum que". Se não tiver certeza, redirecione para o WhatsApp.
16. PROIBIDO inventar layer height, tempos de exposição ou velocidades.
17. Se houver conflito de dados, a informação da tabela 'resins' (Source of Truth) prevalece.
18. CONTEXTO FRACO → PERGUNTA CLARIFICADORA: Se os dados das fontes não mencionam diretamente o produto, resina ou tema que o usuário perguntou, NÃO invente uma resposta com o que está disponível. Sinais de contexto fraco: o contexto fala sobre produto X mas o usuário mencionou produto Y, ou o contexto é sobre categoria diferente da pergunta. Em vez de inventar, pergunte: "Para te ajudar com precisão, você poderia confirmar qual produto ou resina específica você está buscando informações?"

--- DADOS DAS FONTES ---
${context}
--- FIM DOS DADOS ---

Responda à pergunta do usuário usando APENAS as fontes acima.`;

    // 6. Stream response via Gemini
    const messagesForAI = [
      { role: "system", content: systemPrompt },
      ...history.slice(-8).map((h: { role: string; content: string }) => ({
        role: h.role,
        content: h.content,
      })),
      { role: "user", content: message },
    ];

    const aiResponse = await fetch(CHAT_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: messagesForAI,
        stream: true,
        max_tokens: 1024,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    // 7. Save interaction
    const contextSources = allResults.map((m: { source_type: string; metadata: Record<string, unknown> }) => ({
      type: m.source_type,
      title: (m.metadata as Record<string, unknown>).title,
    }));

    let interactionId: string | undefined;
    try {
      const { data: interaction } = await supabase
        .from("agent_interactions")
        .insert({
          session_id,
          user_message: message,
          lang,
          top_similarity: topSimilarity,
          context_sources: contextSources,
          context_raw: context.slice(0, 8000),
          unanswered: false,
        })
        .select("id")
        .single();
      interactionId = interaction?.id;
    } catch (e) {
      console.error("Failed to insert agent_interaction:", e);
      // fail silently — stream continues regardless
    }

    // 8. Stream AI response
    const encoder = new TextEncoder();
    let fullResponse = "";

    // Build media_cards ONLY when user explicitly requested media (vídeo/tutorial/assistir)
    // Cards de parâmetros de impressora são filtrados quando a intenção é de protocolo
    const VIDEO_REQUEST_PATTERNS = [
      /\bv[íi]deo[s]?\b|\bassistir\b|\bwatch\b|\btutorial[s]?\b|\bmostrar\b/i,
    ];

    // Intenção de protocolo (limpeza, cura, processamento) — cards de parâmetros são irrelevantes aqui
    const PROTOCOL_INTENT_PATTERNS = [
      /\blimpeza\b|\blavar\b|\bcleaning\b|\blimpieza\b/i,
      /\bcura\b|\bcuring\b|\bcurado\b|\bpós[-\s]?cura\b/i,
      /\bprotocolo\b|\bprotocol\b|\bprocessamento\b|\bprocessing\b/i,
      /\bacabamento\b|\bpolimento\b|\bfinishing\b/i,
      /\bsecagem\b|\bdrying\b|\bsecar\b/i,
    ];

    // Sinais de que o card é sobre parâmetros de impressora (não relevante para perguntas de protocolo)
    const PARAMETER_CARD_PATTERNS = [
      /\bpar[âa]metros?\b|\bsettings?\b|\bparametr/i,
      /\banycubic\b|\bphrozen\b|\belite[1i]x?\b|\bmiicraft\b|\bprusa\b|\bchitubox\b/i,
      /\blayer height\b|\bexposure\b|\blift speed\b/i,
    ];

    const userRequestedMedia = VIDEO_REQUEST_PATTERNS.some((p: RegExp) => p.test(message));
    const isProtocolQuery = PROTOCOL_INTENT_PATTERNS.some((p: RegExp) => p.test(message));
    const isParameterCard = (title: string) => PARAMETER_CARD_PATTERNS.some((p: RegExp) => p.test(title));

    // Gate de relevância por sub-tema: extrai tokens do sub-tema pedido pelo usuário
    // Exemplo: "Qual vídeo sobre tratamento térmico?" → ["tratamento", "térmico"]
    const VIDEO_TOPIC_STOPWORDS = new Set([
      'qual', 'quais', 'vídeo', 'video', 'videos', 'vídeos', 'sobre', 'tem', 'ter', 'quero', 'ver',
      'assistir', 'tutorial', 'tutoriais', 'mostrar', 'vocês', 'voce', 'você', 'preciso',
      'gostaria', 'existe', 'existem', 'algum', 'alguma', 'tenho', 'temos', 'busco',
      'me', 'mim', 'um', 'uma', 'uns', 'umas', 'o', 'a', 'os', 'as',
      'de', 'do', 'da', 'dos', 'das', 'para', 'que', 'como', 'mais',
      'com', 'em', 'no', 'na', 'nos', 'nas', 'por', 'pelo', 'pela',
    ]);

    function extractVideoTopic(msg: string): string[] {
      return msg.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos para comparação
        .replace(/[?!.,;:]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3 && !VIDEO_TOPIC_STOPWORDS.has(w));
    }

    function cardMatchesTopic(title: string, topicTokens: string[]): boolean {
      if (topicTokens.length === 0) return true; // sem tema específico, aceita qualquer card
      const titleNorm = title.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return topicTokens.some(token => titleNorm.includes(token));
    }

    const topicTokens = userRequestedMedia ? extractVideoTopic(message) : [];

    const mediaCards = userRequestedMedia
      ? allResults
          .filter((r: { source_type: string; metadata: Record<string, unknown> }) => {
            const meta = r.metadata as Record<string, unknown>;
            return meta.thumbnail_url || meta.url_publica || meta.url_interna;
          })
          .filter((r: { source_type: string; metadata: Record<string, unknown> }) => {
            // Se é query de protocolo, remove cards de parâmetros de impressora
            if (isProtocolQuery) {
              const title = (r.metadata as Record<string, unknown>).title as string ?? '';
              return !isParameterCard(title);
            }
            return true;
          })
          .filter((r: { source_type: string; metadata: Record<string, unknown> }) => {
            // Gate de relevância: o título do card deve conter tokens do sub-tema pedido
            const title = (r.metadata as Record<string, unknown>).title as string ?? '';
            return cardMatchesTopic(title, topicTokens);
          })
          .slice(0, 3)
          .map((r: { source_type: string; metadata: Record<string, unknown> }) => {
            const meta = r.metadata as Record<string, unknown>;
            return {
              type: r.source_type === 'video' ? 'video' : 'article',
              title: meta.title as string,
              thumbnail: meta.thumbnail_url as string | undefined,
              url: (meta.url_interna || meta.url_publica) as string | undefined,
            };
          })
      : [];

    const transformedStream = new ReadableStream({
      async start(controller) {
        if (!aiResponse.body) { controller.close(); return; }

        // Send interaction meta first (with media_cards)
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ interaction_id: interactionId, type: "meta", media_cards: mediaCards })}\n\n`)
        );

        const reader = aiResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") {
              if (fullResponse && interactionId) {
                await supabase
                  .from("agent_interactions")
                  .update({ agent_response: fullResponse })
                  .eq("id", interactionId);
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullResponse += content;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`));
              }
            } catch { /* partial JSON */ }
          }
        }
        controller.close();
      },
    });

    return new Response(transformedStream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("dra-lia error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
