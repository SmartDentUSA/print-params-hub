/**
 * LIA Guards — pattern detection for greetings, support, protocol, problems,
 * general knowledge, price intent, and knowledge gap tracking.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

// ── Greeting detection ──
const GREETING_PATTERNS = [
  /^(olá|ola|oi|hey|hi|hola|hello|bom dia|boa tarde|boa noite|tudo bem|tudo bom|como vai|como estas|como está)\b/i,
  /^(good morning|good afternoon|good evening|how are you)\b/i,
  /^(buenos días|buenas tardes|buenas noches|qué tal)\b/i,
];

export const isGreeting = (msg: string) =>
  GREETING_PATTERNS.some((p) => p.test(msg.trim())) && msg.trim().split(/\s+/).length <= 5;

// ── Support detection ──
const SUPPORT_KEYWORDS = [
  /(impressora|printer|impresora).{0,30}(não liga|not turning|no enciende|erro|error|defeito|travando|falhou|quebrou|quebrada)/i,
  /(não consigo|can't|cannot|no puedo).{0,20}(imprimir|print|salvar|conectar|ligar)/i,
  /(erro|error|falha|falhou|travando|bug|problema).{0,20}(impressora|printer|software|slicer|exocad|3shape|cad)/i,
  /(garantia|suporte técnico|assistência técnica|reparo|defeito de fábrica)/i,
  /(peça|peças).{0,20}(reposição|substituição|quebr|troc|defeito|danific|falt)/i,
  /(replacement part|spare part).{0,20}(order|need|broken|replace)/i,
  /(reposição|componente).{0,20}(quebr|troc|defeito|danific|falt)/i,
  /(impressora).{0,20}(não funciona|parou|trava|tá travando|está travando|quebrou)/i,
  /(resina).{0,20}(não (curou|curar|endureceu|endureceu|polimerizo|aderiu))/i,
  /\b(quero|preciso|gostaria de|need to|want to)\b.{0,15}\b(falar com|talk to|hablar con)\b.{0,15}\b(suporte|support|soporte|atendente|humano|pessoa|human|someone)\b/i,
  /\b(falar com o suporte|falar com suporte|talk to support|hablar con soporte)\b/i,
  // Broader support intent patterns
  /(preciso|quero|necessito|gostaria).{0,15}(de )?(suporte|ajuda técnica|assistência)/i,
  /(abrir|criar|gerar).{0,10}(chamado|ticket|ocorrência)/i,
  /(chamar|acionar|contactar|contatar).{0,10}(o )?(suporte|técnico|assistência)/i,
  /preciso de (uma )?m[ãa]ozinha/i,
  // CAD software issues
  /(exocad|3shape|cad|software|slicer).{0,30}(não (abre|inicia|carrega|funciona|liga)|travou|travando|deu erro|erro|error|bug|problema|crashed|crash)/i,
  /(problema|issue|problema).{0,15}(com |no |na |with )?(meu |my |mi )?(exocad|3shape|cad|software|slicer)/i,
  /(não (abre|inicia|carrega|funciona)|travou|deu erro|crashou).{0,20}(exocad|3shape|cad|software|slicer)/i,
  // Direct human request patterns
  /\b(atendente humano|suporte humano|falar com algu[eé]m|falar com uma pessoa|quero uma pessoa|preciso de uma pessoa)\b/i,
  /\b(falar com um humano|talk to a human|hablar con una persona|human agent|live agent)\b/i,
  /\b(preciso falar com|quero falar com).{0,15}(atendente|humano|pessoa|algu[eé]m|suporte)\b/i,
];

export const SUPPORT_FALLBACK: Record<string, string> = {
  "pt-BR": `Para problemas técnicos com equipamentos, nossa equipe de suporte pode te ajudar diretamente 😊\n\n💬 **WhatsApp:** [Falar com suporte](https://wa.me/551634194735?text=Ol%C3%A1%2C+preciso+de+suporte+t%C3%A9cnico)\n✉️ **E-mail:** comercial@smartdent.com.br\n🕐 **Horário:** Segunda a Sexta, 08h às 18h`,
  "en-US": `For technical issues with equipment, our support team can help you directly 😊\n\n💬 **WhatsApp:** [Contact support](https://wa.me/551634194735?text=Hi%2C+I+need+technical+support)\n✉️ **E-mail:** comercial@smartdent.com.br\n🕐 **Office hours:** Mon–Fri, 8am–6pm (BRT)`,
  "es-ES": `Para problemas técnicos con equipos, nuestro equipo de soporte puede ayudarte directamente 😊\n\n💬 **WhatsApp:** [Contactar soporte](https://wa.me/551634194735?text=Hola%2C+necesito+soporte+t%C3%A9cnico)\n✉️ **E-mail:** comercial@smartdent.com.br\n🕐 **Horario:** Lunes a Viernes, 8h a 18h`,
};

// Informational queries about existing tickets — should NOT trigger support creation flow
const SUPPORT_INFO_QUERY = /\b(quantos?|quais?|ver|listar|consultar|hist[oó]rico|status|meus?)\b.{0,20}\b(chamado|ticket|ocorr[eê]ncia)/i;

export const isSupportQuestion = (msg: string) => {
  if (SUPPORT_INFO_QUERY.test(msg)) return false;
  return SUPPORT_KEYWORDS.some((p) => p.test(msg));
};

// ── Protocol detection ──
const PROTOCOL_KEYWORDS = [
  /limpeza|lavagem|lavar|limpar/i,
  /\bcura\b|pós.cura|pos.cura|fotopolimerizar/i,
  /finaliz|acabamento|polimento|polir/i,
  /pré.process|pre.process|pós.process|pos.process|processamento|protocolo/i,
  /nanoclean|isopropílico|isopropilico|álcool|alcool/i,
  /tratamento.{0,5}t[ée]rmico|t[ée]rmico|forno|glicerina|soprador/i,
  /temperatura|aquecimento|aquece|calor/i,
  /\bclean\b|wash|washing/i,
  /post.cure|post cure|\bcuring\b/i,
  /\bfinish\b|polish/i,
  /\bprocessing\b|protocol/i,
  /\bpost.?process\b|heat.?treat|thermal.?treat|thermal/i,
  /limpieza/i,
  /curado|post.curado/i,
  /pulido|acabado/i,
  /procesamiento/i,
  /tratamiento.{0,5}t[ée]rmico|horno|temperatura/i,
];

export const isProtocolQuestion = (msg: string) =>
  PROTOCOL_KEYWORDS.some((p) => p.test(msg));

// ── Problem report guard ──
const PROBLEM_GUARD = /(descascando|delamina|warping|empenad|danificad|quebrad|rachad|não.{0,10}(funciona|liga|sai|gruda|adere|cura)|falhando|defeito|erro de|problema com|qualidade ruim|saindo mal|trocar|substituir|FEP|LCD|tela danificad|motor|eixo.?z|calibra[çc][ãa]o falh|layer.?shift|não.{0,10}ader|pós.?processamento|pós.?cura|limpeza.?(ipa|álcool|alcool)|falha.?(de|na|no)|suporte.?(técnico|tecnico)|manuten[çc][ãa]o)/i;

export const isProblemReport = (msg: string) => PROBLEM_GUARD.test(msg);

// ── Printer parameter question detection ──
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

export const isPrinterParamQuestion = (msg: string) =>
  PARAM_KEYWORDS.some((p) => p.test(msg));

// ── Meta-article query detection ──
const META_ARTICLE_PATTERNS = [
  /\b(quais|quantos?|quantas?|tem|existe[m]?|h[áa])\b.{0,20}\b(artigo|artigos|publicaç|post|posts|conteúdo|conteudos|material|materiais)\b/i,
  /\b(quem).{0,15}\b(escreveu|publicou|criou|autor[ae]?|é o autor|wrote)\b/i,
  /\b(lista|listar|mostrar|exibir|show me).{0,15}\b(artigos|publicações|conteúdos|materiais|videos)\b/i,
  /\b(autor|autora|autores|author|authors|especialista|kol|speaker)\b/i,
  /\b(quem (é|sao|são) (os|as)?).{0,15}(autor|autora|especialista|speaker)/i,
];

export const isMetaArticleQuery = (msg: string) =>
  META_ARTICLE_PATTERNS.some((p) => p.test(msg));

// ── General knowledge guard ──
export const GENERAL_KNOWLEDGE_PATTERNS = [
  /qual a capital d[aeo]/i,
  /quem (descobriu|inventou|criou|foi|é|eh) /i,
  /quem foi [A-Z][a-z]+ [A-Z]/i,
  /por que (você|vc|voce) se chama/i,
  /(historia|história) d[aeo] /i,
  /em que ano /i,
  /onde fica[s]? /i,
  /quem [eé] [A-Z][a-z]+/i,
  /o que significa [a-z]+ (?!resina|impressora|scanner|cad|cam)/i,
  /qual o sentido d[aeo]/i,
  /presidente d[aeo]/i,
  /quantos (estados|paises|continentes)/i,
];

// ── Price intent guard ──
export const PRICE_INTENT_PATTERNS = [
  /quanto custa/i, /qual o (valor|preco|preço)/i,
  /me passa[r]? (o )?(valor|preco|preço)/i,
  /how much/i, /cuánto cuesta/i,
  /tabela de preco/i, /price list/i,
];

// ── Knowledge gap upsert ──
export async function upsertKnowledgeGap(
  supabase: SupabaseClient,
  question: string,
  lang: string,
  status: "pending" | "low_confidence" = "pending",
  rota?: string | null,
  tema?: string | null,
) {
  const NOISE_PATTERNS = /^(oi|ola|olá|hey|hi|hola|obrigad|valeu|ok|sim|não|nao|lia|ooe|tchau|bye|gracias|thanks|tudo bem|beleza|show|legal|massa|top)\b/i;
  if (question.trim().length < 10 || NOISE_PATTERNS.test(question.trim())) {
    return;
  }

  const extractedTema = tema || (() => {
    const cleaned = question
      .replace(/^(como|what|how|qual|quais|por que|why|onde|where|quando|when|o que|que)\s+/i, "")
      .replace(/[?!.]/g, "")
      .trim();
    return cleaned.split(/\s+/).slice(0, 5).join(" ");
  })();

  try {
    const truncated = question.slice(0, 500);
    const { data: existing } = await supabase
      .from("agent_knowledge_gaps")
      .select("id, frequency")
      .eq("question", truncated)
      .maybeSingle();

    if (existing) {
      const updatePayload: Record<string, unknown> = {
        frequency: (existing.frequency ?? 1) + 1,
        updated_at: new Date().toISOString(),
      };
      if (rota) updatePayload.rota = rota;
      if (extractedTema) updatePayload.tema = extractedTema;

      await supabase
        .from("agent_knowledge_gaps")
        .update(updatePayload)
        .eq("id", existing.id);
    } else {
      await supabase
        .from("agent_knowledge_gaps")
        .insert({
          question: truncated,
          lang,
          frequency: 1,
          status,
          rota: rota || null,
          tema: extractedTema || null,
        });
    }
  } catch (e) {
    console.error("[upsertKnowledgeGap] error:", e);
  }
}

// ── Stopwords (shared with RAG pipeline) ──
export const STOPWORDS_PT = [
  'você', 'voce', 'tem', 'algum', 'alguma', 'entre', 'para', 'sobre',
  'como', 'qual', 'quais', 'esse', 'essa', 'este', 'esta', 'isso',
  'uma', 'uns', 'umas', 'que', 'com', 'por', 'mais', 'muito',
  'outras', 'outros', 'quando', 'onde', 'seria', 'tenho', 'temos',
  'fazer', 'feito', 'tenha', 'quer', 'quero', 'busco', 'busca',
  'preciso', 'existe', 'existem', 'possui', 'possuem', 'algum', 'alguma',
];
