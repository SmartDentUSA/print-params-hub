import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY");

// ── Topic context re-ranking weights ─────────────────────────────────────────
// Applied post-search to reorder results toward the user's declared context.
// source_types: parameter_set, resin, processing_protocol,
//               article, video, catalog_product, company_kb
const TOPIC_WEIGHTS: Record<string, Record<string, number>> = {
  parameters: { parameter_set: 1.5, resin: 1.3, processing_protocol: 1.4, article: 0.9,  video: 0.7, catalog_product: 0.5, company_kb: 0.3, author: 0.4, faq_autoheal: 0.8 },
  products:   { parameter_set: 0.4, resin: 1.4, processing_protocol: 1.2, article: 1.3,  video: 1.0, catalog_product: 1.4, company_kb: 0.5, author: 0.6, faq_autoheal: 1.1 },
  commercial: { parameter_set: 0.2, resin: 0.8, processing_protocol: 0.3, article: 1.2,  video: 0.8, catalog_product: 1.8, company_kb: 1.5, author: 1.0, faq_autoheal: 1.0 },
  support:    { parameter_set: 0.6, resin: 0.7, processing_protocol: 0.8, article: 1.3,  video: 1.2, catalog_product: 0.5, company_kb: 0.4, author: 0.5, faq_autoheal: 1.2 },
};

function applyTopicWeights<T extends { source_type: string; similarity: number }>(
  results: T[],
  topicContext: string | undefined | null
): T[] {
  if (!topicContext || !TOPIC_WEIGHTS[topicContext]) return results;
  const weights = TOPIC_WEIGHTS[topicContext];
  return results
    .map(r => ({ ...r, similarity: Math.min(r.similarity * (weights[r.source_type] ?? 1.0), 1.0) }))
    .sort((a, b) => b.similarity - a.similarity);
}

// ── SDR Consultivo — prompt modular dinâmico para rota comercial ─────────
function buildCommercialInstruction(
  sessionEntities: Record<string, unknown> | null,
  spinProgressNote: string,
  leadMaturity?: "MQL" | "SAL" | "SQL" | "CLIENTE" | null
): string {
  // Módulo 1: PERSONA CONSULTORA (fixo, ~200 tokens)
  const persona = `
### 🧑‍💼 MODO CONSULTORA ESPECIALISTA — ROTA COMERCIAL

Você é uma consultora estratégica de soluções em odontologia digital.
Conversa natural, como colega que entende profundamente o mercado.
2-3 frases por mensagem. 1 pergunta por vez. Tom consultivo, nunca interrogatório.`;

  // Módulo 2: ESTADO DO LEAD (dinâmico)
  const entities = (sessionEntities || {}) as Record<string, string>;
  const leadName = entities.lead_name || "";
  const spinStage = entities.spin_stage || "etapa_1";
  const specialty = entities.specialty || "";
  const equipmentStatus = entities.equipment_status || "";
  const painPoint = entities.pain_point || "";
  const workflowInterest = entities.workflow_interest || "";

  const knownFacts: string[] = [];
  if (leadName) knownFacts.push(`Nome: ${leadName}`);
  if (specialty) knownFacts.push(`Especialidade: ${specialty}`);
  if (equipmentStatus) knownFacts.push(`Equipamento: ${equipmentStatus}`);
  if (painPoint) knownFacts.push(`Dor principal: ${painPoint}`);
  if (workflowInterest) knownFacts.push(`Interesse de fluxo: ${workflowInterest}`);

  const leadStateStr = knownFacts.length > 0
    ? `\n**ESTADO DO LEAD:** ${knownFacts.join(" | ")}\nEtapa atual: ${spinStage}`
    : "";

  // Módulo 3: INSTRUÇÃO DE TURNO (dinâmico por etapa SPIN)
  const turnInstructions: Record<string, string> = {
    etapa_1: `**INSTRUÇÃO DE TURNO:** Saudação curta + pergunta direta: "Em qual produto você está interessado em conhecer ou aprender a usá-lo?" NÃO cite produtos. Se o lead nomear um produto → pule para apresentação.`,
    etapa_2: `**INSTRUÇÃO DE TURNO:** Faça NO MÁXIMO 1 pergunta de contexto (dor/desafio). Se o lead já disse o que quer → apresente direto.`,
    etapa_3: `**INSTRUÇÃO DE TURNO:** MODO APRESENTAÇÃO. Use os DADOS DAS FONTES para apresentar a solução. 2-3 frases. Ofereça demonstração ou agendamento.`,
    etapa_4: `**INSTRUÇÃO DE TURNO:** FECHAMENTO. Alta complexidade (Scanners/Impressoras/Combos) → agendamento. Baixa complexidade (Resinas/Insumos) → link da loja.`,
    etapa_5: `**INSTRUÇÃO DE TURNO:** Lead qualificado. Ofereça agendamento final ou conecte com especialista via WhatsApp.`,
  };
  const turnInstruction = turnInstructions[spinStage] || turnInstructions["etapa_1"];

  // Módulo 4: REGRAS ANTI-ALUCINAÇÃO COMERCIAL (condensado, ~200 tokens)
  const antiHallucination = `
**REGRAS COMERCIAIS CRÍTICAS:**
1. CITE APENAS produtos dos DADOS DAS FONTES. NUNCA invente nomes ou preços.
2. Se preço não estiver nos dados: "Para valores atualizados: [Falar com especialista](https://wa.me/5516993831794)"
3. Se nenhum produto relevante nas fontes: "Posso te conectar com nosso time comercial: [Falar com especialista](https://wa.me/5516993831794)"
4. Se o lead já respondeu uma pergunta (equipamento, especialidade, dor, fluxo) → NÃO repita.
5. Se o lead pedir produto/preço diretamente → RESPONDA IMEDIATO, não faça mais perguntas SPIN.
6. Máximo 3 perguntas de qualificação no total. Após 3 → modo resposta.
7. Se o lead retornar e o histórico mostra conversa anterior → "Continuando nossa conversa..." e prossiga.

**CATEGORIAS DE SOLUÇÃO:**
- Clínico autonomia total → Chair Side Print
- Laboratório → Smart Lab
- Materiais → Resinas Biocompatíveis vs Uso Geral`;

  // Módulo 5: RÉGUA DE CONHECIMENTO (dinâmico por maturidade do lead)
  const maturityInstructions: Record<string, string> = {
    MQL: `
**RÉGUA: CONSCIENTIZAÇÃO (MQL) — Apoiando a Jornada Inicial**
OBJETIVO: Ajudar o colega a enxergar desafios operacionais que muitas vezes não são ditos.
TOM: Educativo e protetor. "Quero que você tenha sucesso real". Foco em evitar desperdício de tempo e recursos.
ABORDAGEM: "Entendo que o preço inicial atrai, mas meu papel é te mostrar que a tecnologia só brilha com um fluxo de trabalho sólido por trás. Comprar o hardware é o primeiro passo; o desafio real é garantir que sua agenda e seus processos estejam integrados para o equipamento não ficar parado."
FOCO: Mostrar que a Smart Dent se preocupa com a sustentabilidade do consultório dele. Se ele ainda não estiver pronto para avançar, tudo bem. Diga: "Cada profissional tem seu tempo, e estarei aqui para te apoiar quando você decidir dar o próximo passo."
PROIBIDO: NÃO envie calculadora ROI, depoimentos ou links de venda. O lead ainda não está pronto.`,

    SAL: `
**RÉGUA: CONSIDERAÇÃO (SAL) — Parceria e Transparência**
OBJETIVO: Demonstrar o compromisso da Smart Dent com o resultado clínico e financeiro do lead.
TOM: Transparente e baseado em fatos. "Nosso sucesso depende do seu".
ABORDAGEM: "Como somos fabricantes de resinas, nosso maior interesse é que sua impressora nunca pare de produzir com qualidade. Se você não tiver retorno, nós também não temos. É por isso que focamos tanto no treinamento e no suporte."
ENFATIZE: A verdade dos nossos clientes. Nossos speakers são dentistas que vivem o consultório, como ele.
ENVIE: Casos de sucesso reais, Instagram @smartdentbr e calculadora de ROI para planejamento.`,

    SQL: `
**RÉGUA: DECISÃO (SQL) — Viabilizando o Projeto**
OBJETIVO: Facilitar a transição definitiva para o digital com segurança.
TOM: Resolutivo e entusiasmado. "Vamos transformar sua odontologia agora".
ABORDAGEM: "Fico feliz que você chegou até aqui com clareza. Agora que os números fazem sentido e a confiança na solução está estabelecida, vamos cuidar da viabilização logística e comercial para você começar a colher os frutos da odontologia digital o quanto antes."
ENVIE: Condições facilitadas, link de agendamento com especialista e calculadora de ROI final.
FOCO: Mostrar que a Smart Dent está pronta para ser o braço direito na implementação.`,

    CLIENTE: `
**RÉGUA: RELACIONAMENTO (CLIENTE) — Crescimento Contínuo**
OBJETIVO: Evoluir o fluxo de trabalho e fortalecer o vínculo.
TOM: De parceiro para parceiro. "Como podemos ir além?".
ABORDAGEM: "Sua estrutura já está rodando, que tal explorarmos novas aplicações para otimizar ainda mais seu investimento?"
AÇÃO: Sugira novos materiais (Resinas de alta performance), cursos avançados ou novas integrações.`,
  };

  const maturityInstruction = leadMaturity && maturityInstructions[leadMaturity]
    ? `\n${maturityInstructions[leadMaturity]}`
    : "";

  return `${persona}${leadStateStr}\n${turnInstruction}${spinProgressNote}${maturityInstruction}\n${antiHallucination}`;
}

const CHAT_API = "https://ai.gateway.lovable.dev/v1/chat/completions";

const EXTERNAL_KB_URL = `${SUPABASE_URL}/functions/v1/knowledge-base`;

// ── Fetch company context from external knowledge-base (ai_training format, live data) ──
// Timeout: 3s. Falls back to hardcoded values if fetch fails — zero risk to main flow.
async function fetchCompanyContext(): Promise<string> {
  const FALLBACK = `- Telefone: (16) 99383-1794
- WhatsApp: https://wa.me/5516993831794
- E-mail: comercial@smartdent.com.br
- Endereço: Rua Dr. Procópio de Toledo Malta, 62 — São Carlos, SP — CEP 13560-460
- Horário: Segunda a Sexta, 8h às 18h
- Fundada em: 2009 | CEO: Marcelo Del Guerra
- NPS: 96 | Google: 5.0 ⭐ (150+ avaliações)
- Parcerias: exocad, RayShape, BLZ Dental, Medit, FDA
- Loja: https://loja.smartdent.com.br/
- Parâmetros: https://parametros.smartdent.com.br/
- Cursos: https://smartdentacademy.astronmembers.com/
- Instagram: https://www.instagram.com/smartdentbr/
- YouTube: https://www.youtube.com/@smartdentbr`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`${EXTERNAL_KB_URL}?format=ai_training`, {
        signal: AbortSignal.timeout(3000),
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        console.warn(`[fetchCompanyContext] HTTP ${response.status} (attempt ${attempt + 1})`);
        if (attempt === 0) { await new Promise(r => setTimeout(r, 1000)); continue; }
        break;
      }

      const text = await response.text();

      const extract = (pattern: RegExp): string => {
        const m = text.match(pattern);
        return m ? m[1].trim() : "";
      };

      const phone = extract(/\*\*Telefone[^*]*\*\*[:\s]+([^\n]+)/i) ||
                    extract(/Telefone[:\s]+([0-9()\s\-+]+)/i) || "(16) 99383-1794";
      const email = extract(/\*\*E-?mail[^*]*\*\*[:\s]+([^\s\n]+)/i) ||
                    extract(/E-?mail[:\s]+([^\s\n]+@[^\s\n]+)/i) || "comercial@smartdent.com.br";
      const nps = extract(/\*\*NPS[^*]*\*\*[:\s]+([^\n|]+)/i) ||
                  extract(/NPS Score[:\s]+(\d+)/i) || "96";
      const rating = extract(/\*\*Rating[^*]*\*\*[:\s]+([^\n]+)/i) ||
                     extract(/Rating[:\s]+([^\n]+)/i) || "5.0 ⭐";
      const horario = extract(/\*\*Hor[áa]rio[^*]*\*\*[:\s]+([^\n]+)/i) ||
                      extract(/Hor[áa]rio[:\s]+([^\n]+)/i) || "Segunda a Sexta, 8h às 18h";
      const endereco = extract(/\*\*Endere[çc]o[^*]*\*\*[:\s]+([^\n]+)/i) ||
                       extract(/Endere[çc]o[:\s]+([^\n]+)/i) || "Rua Dr. Procópio de Toledo Malta, 62 — São Carlos, SP";

      const built = `- Telefone/WhatsApp: ${phone.replace(/\D/g, '').length >= 10 ? phone : "(16) 99383-1794"} | https://wa.me/5516993831794
- E-mail: ${email.includes('@') ? email : "comercial@smartdent.com.br"}
- Endereço: ${endereco || "Rua Dr. Procópio de Toledo Malta, 62 — São Carlos, SP"}
- Horário: ${horario}
- Fundada em: 2009 | CEO: Marcelo Del Guerra
- NPS: ${nps} | Google: ${rating} (150+ avaliações)
- Parcerias: exocad, RayShape, BLZ Dental, Medit, FDA
- Loja: https://loja.smartdent.com.br/
- Parâmetros: https://parametros.smartdent.com.br/
- Cursos: https://smartdentacademy.astronmembers.com/
- Instagram: https://www.instagram.com/smartdentbr/
- YouTube: https://www.youtube.com/@smartdentbr`;

      console.log(`[fetchCompanyContext] ✓ Live data fetched (${text.length} chars)`);
      return built;
    } catch (err) {
      console.warn(`[fetchCompanyContext] Failed attempt ${attempt + 1}: ${err}`);
      if (attempt === 0) await new Promise(r => setTimeout(r, 1000));
    }
  }
  console.warn(`[fetchCompanyContext] ALL ATTEMPTS FAILED — using hardcoded fallback`);
  return FALLBACK;
}

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
  /(peça|peças).{0,20}(reposição|substituição|quebr|troc|defeito|danific|falt)/i,
  /(replacement part|spare part).{0,20}(order|need|broken|replace)/i,
  /(reposição|componente).{0,20}(quebr|troc|defeito|danific|falt)/i,
  /(impressora).{0,20}(não funciona|parou|trava|tá travando|está travando|quebrou)/i,
  /(resina).{0,20}(não (curou|curar|endureceu|endureceu|polimerizo|aderiu))/i,
];

const SUPPORT_FALLBACK: Record<string, string> = {
  "pt-BR": `Para problemas técnicos com equipamentos, nossa equipe de suporte pode te ajudar diretamente 😊\n\n💬 **WhatsApp:** [Falar com suporte](https://wa.me/551634194735?text=Ol%C3%A1%2C+preciso+de+suporte+t%C3%A9cnico)\n✉️ **E-mail:** comercial@smartdent.com.br\n🕐 **Horário:** Segunda a Sexta, 08h às 18h`,
  "en-US": `For technical issues with equipment, our support team can help you directly 😊\n\n💬 **WhatsApp:** [Contact support](https://wa.me/551634194735?text=Hi%2C+I+need+technical+support)\n✉️ **E-mail:** comercial@smartdent.com.br\n🕐 **Office hours:** Mon–Fri, 8am–6pm (BRT)`,
  "es-ES": `Para problemas técnicos con equipos, nuestro equipo de soporte puede ayudarte directamente 😊\n\n💬 **WhatsApp:** [Contactar soporte](https://wa.me/551634194735?text=Hola%2C+necesito+soporte+t%C3%A9cnico)\n✉️ **E-mail:** comercial@smartdent.com.br\n🕐 **Horario:** Lunes a Viernes, 8h a 18h`,
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

// ── Fallback: search company_kb_texts via ILIKE (uses history context) ────────
async function searchCompanyKB(
  supabase: ReturnType<typeof createClient>,
  query: string,
  history: Array<{ role: string; content: string }>
) {
  const combinedText = `${history.slice(-4).map(h => h.content).join(' ')} ${query}`;
  const words = combinedText.toLowerCase()
    .replace(/[?!.,;:™]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS_PT.includes(w))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 6);

  if (!words.length) return [];

  const orFilter = words.map(w => `title.ilike.%${w}%,content.ilike.%${w}%`).join(',');

  const { data } = await supabase
    .from('company_kb_texts')
    .select('id, title, content, category, source_label')
    .eq('active', true)
    .or(orFilter)
    .limit(3);

  if (!data?.length) return [];

  console.log(`[searchCompanyKB] Found ${data.length} results from company_kb_texts`);

  return data.map((d: { id: string; title: string; content: string; category: string; source_label: string | null }) => ({
    id: d.id,
    source_type: 'company_kb',
    chunk_text: `${d.title} | ${d.content.slice(0, 800)}`,
    metadata: { title: d.title, source_label: d.source_label },
    similarity: (() => {
      const titleWords = d.title.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 3);
      const queryWords = query.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 3);
      const matchCount = titleWords.filter((w: string) => queryWords.some((q: string) => w.includes(q) || q.includes(w))).length;
      return matchCount > 0 ? Math.min(matchCount / Math.max(titleWords.length, 1) * 0.4 + 0.3, 0.75) : 0.30;
    })(),
  }));
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

// ── Intent-break detection: identify messages that are clearly NOT dialog responses ──
const DIALOG_BREAK_PATTERNS = [
  // Perguntas sobre a empresa / pessoas
  /\b(CEO|fundador|dono|sócio|diretor|quem (criou|fundou|é o))\b/i,
  // Comandos de reset explícitos
  /\b(cancelar|esquece|esqueça|outra (pergunta|coisa)|muda(ndo)? de assunto|não (quero|preciso) mais|sair)\b/i,
  // Perguntas gerais iniciando com "o que é", "como funciona", etc.
  /^(o que (é|são)|qual (é|a diferença)|como (funciona|usar|se usa)|me fala sobre|me explica)/i,
  // Referências à empresa / identidade SmartDent
  /\b(smartdent|smart dent|empresa|história|fundação|parcerias|contato|endereço|horário)\b/i,
  // Perguntas sobre categorias de produto que iniciam novo contexto
  /^(quais|vocês (têm|vendem|trabalham)|tem (algum|impressora|scanner|resina))/i,

  // ── NOVOS: intenção de compra e curiosidade de produto ──

  // Intenção de compra / interesse em produto
  /\b(quero (comprar|adquirir|ver|conhecer|saber (mais )?sobre)|tenho interesse|como (comprar|adquirir)|onde (comprar|encontrar))\b/i,
  // Perguntas sobre características do produto
  /\b(o que (tem|há|ela tem|ele tem) de|quais (são |as )?(vantagens|benefícios|diferenciais|características|recursos)|para que serve|é indicad[ao] para)\b/i,
  // "sobre a X", "me conta sobre", "fala mais sobre"
  /\b(fala(r)?(?: mais| um pouco)? sobre|me conta(r)? (mais )?sobre|quero saber (mais )?sobre)\b/i,
];

function isOffTopicFromDialog(message: string): boolean {
  return DIALOG_BREAK_PATTERNS.some((p) => p.test(message.trim()));
}

// Detect which step of the guided dialog we're in — uses agent_sessions for persistence
// Falls back to regex-on-history if session lookup fails (resilience)
async function detectPrinterDialogState(
  supabase: ReturnType<typeof createClient>,
  message: string,
  history: Array<{ role: string; content: string }>,
  sessionId: string,
  topic_context?: string
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

  // ── topic_context override: if user declared "parameters" intent and session is idle, start dialog directly ──
  if (topic_context === "parameters" && (currentState === "idle" || currentState === "not_in_dialog")) {
    await persistState("needs_brand", {});
    return { state: "needs_brand", availableBrands: brandNames };
  }

  // ── Intent-break guard: if active dialog state but message is off-topic → reset silently ──
  const ACTIVE_DIALOG_STATES = ["needs_brand", "brand_not_found", "needs_model", "model_not_found", "needs_resin"];
  if (ACTIVE_DIALOG_STATES.includes(currentState) && isOffTopicFromDialog(message)) {
    console.log(`[dialog] intent-break detected (state: ${currentState}), resetting session`);
    await persistState("idle", {});
    return { state: "not_in_dialog" };
  }

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

  // ── Fallback guard: se sessão idle e mensagem é off-topic → não inferir diálogo do histórico ──
  if (currentState === "idle" && isOffTopicFromDialog(message)) {
    console.log("[dialog] idle + off-topic message, skipping fallback regex");
    return { state: "not_in_dialog" };
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

  if (liaAskedResin && !isOffTopicFromDialog(message)) {
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

  if (liaAskedBrand && !isOffTopicFromDialog(message)) {
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

  if (liaAskedModel && !isOffTopicFromDialog(message)) {
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
  "pt-BR": `Para que eu possa te reconhecer, informe seu **e-mail**.`,
  "en-US": `So I can recognize you, please provide your **email**.`,
  "es-ES": `Para que pueda reconocerte, infórmame tu **correo electrónico**.`,
};

// ── LEAD COLLECTION SYSTEM ──────────────────────────────────────────────────
// Detects whether name/email have been collected from the conversation history
// Returns: { state, name?, email? }
type LeadCollectionState =
  | { state: "needs_email_first" }
  | { state: "needs_name"; email: string }
  | { state: "needs_email"; name: string }  // kept for compat
  | { state: "collected"; name: string; email: string }
  | { state: "needs_area"; name: string; email: string; leadId: string }
  | { state: "needs_specialty"; name: string; email: string; leadId: string; area: string }
  | { state: "from_session"; name: string; email: string; leadId: string };

function detectLeadCollectionState(
  history: Array<{ role: string; content: string }>,
  sessionEntities: Record<string, unknown> | null
): LeadCollectionState {
  // Check session first — if lead already identified, skip collection
  if (sessionEntities?.lead_id && sessionEntities?.lead_name && sessionEntities?.lead_email) {
    // Check if area/specialty still need to be collected
    const leadId = sessionEntities.lead_id as string;
    const leadName = sessionEntities.lead_name as string;
    const leadEmail = sessionEntities.lead_email as string;
    const leadArea = sessionEntities.lead_area as string | undefined;
    const leadSpecialty = sessionEntities.lead_specialty as string | undefined;

    if (!leadArea && sessionEntities.awaiting_area) {
      return { state: "needs_area", name: leadName, email: leadEmail, leadId };
    }
    if (leadArea && !leadSpecialty && sessionEntities.awaiting_specialty) {
      return { state: "needs_specialty", name: leadName, email: leadEmail, leadId, area: leadArea };
    }

    return {
      state: "from_session",
      name: leadName,
      email: leadEmail,
      leadId,
    };
  }

  // No history = brand new conversation
  if (history.length === 0) return { state: "needs_email_first" };

  // RFC 5322 compliant regex — supports international TLDs, subdomains, and special chars
  const EMAIL_REGEX = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+/;
  let detectedEmail: string | null = null;
  let detectedName: string | null = null;

  // Scan for email in user messages
  for (let i = 0; i < history.length; i++) {
    const msg = history[i];
    if (msg.role === "user") {
      const normalizedContent = msg.content.replace(/\s*@\s*/g, '@');
      const emailMatch = normalizedContent.match(EMAIL_REGEX);
      if (emailMatch) detectedEmail = emailMatch[0];
    }
  }

  // Scan for name: user response after assistant asked for name
  for (let i = 0; i < history.length; i++) {
    const msg = history[i];
    const prevMsg = i > 0 ? history[i - 1] : null;
    if (msg.role === "user" && prevMsg?.role === "assistant" && /qual (o seu |seu )?nome|como devo te chamar|what's your name|what should I call you|cuál es tu nombre|cómo debo llamarte/i.test(prevMsg.content)) {
      const nameCandidate = msg.content.trim().replace(/[.!?,;:]+$/g, '').trim();
      if (nameCandidate.length >= 2 && nameCandidate.length <= 80 && !EMAIL_REGEX.test(nameCandidate)) {
        detectedName = nameCandidate;
      }
    }
  }

  // Both collected
  if (detectedName && detectedEmail) return { state: "collected", name: detectedName, email: detectedEmail };

  // Email found but no name yet — check if assistant already asked for name
  if (detectedEmail && !detectedName) {
    const lastAssistant = [...history].reverse().find(h => h.role === "assistant");
    // If assistant already asked for name, check if latest user msg is the name
    if (lastAssistant && /qual (o seu |seu )?nome|como devo te chamar|what's your name|what should I call you|cuál es tu nombre|cómo debo llamarte/i.test(lastAssistant.content)) {
      const lastUser = [...history].reverse().find(h => h.role === "user");
      if (lastUser) {
        const nameCandidate = lastUser.content.trim().replace(/[.!?,;:]+$/g, '').trim();
        if (nameCandidate.length >= 2 && nameCandidate.length <= 80 && !EMAIL_REGEX.test(nameCandidate)) {
          return { state: "collected", name: nameCandidate, email: detectedEmail };
        }
      }
    }
    return { state: "needs_name", email: detectedEmail };
  }

  // No email found yet — check if assistant already asked for email
  const lastAssistant = [...history].reverse().find(h => h.role === "assistant");
  if (lastAssistant && /e-?mail|email|correo/i.test(lastAssistant.content) && /melhor|best|mejor|enviar|acompanhar|reconhecer|recognize|reconocerte|informe|provide/i.test(lastAssistant.content)) {
    const lastUser = [...history].reverse().find(h => h.role === "user");
    if (lastUser) {
      const normalizedLastUser = lastUser.content.replace(/\s*@\s*/g, '@');
      const emailMatch = normalizedLastUser.match(EMAIL_REGEX);
      if (emailMatch) {
        return { state: "needs_name", email: emailMatch[0] };
      }
    }
  }

  return { state: "needs_email_first" };
}

const ASK_EMAIL: Record<string, (name: string) => string> = {
  "pt-BR": (name) => `Prazer, ${name}! 😊 Para eu poder te enviar materiais e acompanhar seu caso, qual seu melhor e-mail?`,
  "en-US": (name) => `Nice to meet you, ${name}! 😊 So I can send you materials and follow up on your case, what's your best email?`,
  "es-ES": (name) => `¡Mucho gusto, ${name}! 😊 Para enviarte materiales y acompañar tu caso, ¿cuál es tu mejor correo electrónico?`,
};

// ── AREA / SPECIALTY OPTIONS ─────────────────────────────────────────────────
const AREA_OPTIONS = [
  "Clínica Odontológica",
  "Laboratório de Prótese",
  "Universidade/Docência",
  "Indústria/Pesquisa",
  "Estudante",
];

const SPECIALTY_MAP: Record<string, string[]> = {
  "Clínica Odontológica": ["Implantodontia", "Prótese Dentária", "Ortodontia", "Endodontia", "Dentística/Estética", "Clínica Geral", "Cirurgia"],
  "Laboratório de Prótese": ["Prótese Fixa", "Prótese Removível", "Prótese sobre Implante", "Ortodontia", "Estética"],
  "Universidade/Docência": ["Implantodontia", "Prótese Dentária", "Ortodontia", "Materiais Dentários", "Cirurgia", "Outras"],
  "Indústria/Pesquisa": ["P&D", "Controle de Qualidade", "Produção", "Outras"],
  "Estudante": ["Graduação", "Especialização", "Mestrado/Doutorado"],
};

const ASK_AREA: Record<string, (name: string) => string> = {
  "pt-BR": (name) => `Prazer em te conhecer, ${name}! Agora, para que eu execute uma análise do seu perfil e conecte com nossa base de conhecimento com a sua realidade profissional, preciso saber: qual é sua **área de atuação**?`,
  "en-US": (name) => `Nice to meet you, ${name}! Now, so I can analyze your profile and connect our knowledge base with your professional reality, I need to know: what is your **field of work**?`,
  "es-ES": (name) => `¡Encantada de conocerte, ${name}! Ahora, para que pueda analizar tu perfil y conectar nuestra base de conocimiento con tu realidad profesional, necesito saber: ¿cuál es tu **área de actuación**?`,
};

const ASK_SPECIALTY: Record<string, (name: string, area: string) => string> = {
  "pt-BR": (_name, _area) => `Qual é a sua **especialidade**?`,
  "en-US": (_name, _area) => `What is your **specialty**?`,
  "es-ES": (_name, _area) => `¿Cuál es tu **especialidad**?`,
};

const ASK_NAME: Record<string, string> = {
  "pt-BR": `Ainda não sei o seu nome! Como devo te chamar?`,
  "en-US": `I don't know your name yet! What should I call you?`,
  "es-ES": `¡Aún no sé tu nombre! ¿Cómo debo llamarte?`,
};

// Format date for returning lead greeting
function formatLastContactDate(isoDate: string, lang: string): { date: string; time: string } {
  const d = new Date(isoDate);
  if (lang === "en-US") {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const hours = d.getHours();
    const ampm = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    const mins = d.getMinutes().toString().padStart(2, "0");
    return { date: `${months[d.getMonth()]} ${d.getDate()}`, time: `${h12}:${mins} ${ampm}` };
  }
  if (lang === "es-ES") {
    return {
      date: `${d.getDate().toString().padStart(2,"0")}/${(d.getMonth()+1).toString().padStart(2,"0")}`,
      time: `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`,
    };
  }
  // pt-BR default
  return {
    date: `${d.getDate().toString().padStart(2,"0")}/${(d.getMonth()+1).toString().padStart(2,"0")}`,
    time: `${d.getHours().toString().padStart(2,"0")}h${d.getMinutes().toString().padStart(2,"0")}`,
  };
}

function buildReturningLeadMessage(name: string, lang: string, lastDate?: string, summary?: string | null): string {
  const { date, time } = lastDate ? formatLastContactDate(lastDate, lang) : { date: "", time: "" };
  
  if (lang === "en-US") {
    let msg = `Hi, ${name}! Great to see you again. 😊`;
    if (date) msg += `\nWe last talked on ${date} at ${time}.`;
    if (summary) msg += `\nAbout ${summary}.`;
    msg += `\nWhat shall we talk about today?`;
    return msg;
  }
  if (lang === "es-ES") {
    let msg = `¡Hola, ${name}! Qué bueno verte de nuevo. 😊`;
    if (date) msg += `\nNos hablamos el ${date} a las ${time}.`;
    if (summary) msg += `\nSobre ${summary}.`;
    msg += `\n¿Sobre qué vamos a conversar hoy?`;
    return msg;
  }
  // pt-BR
  let msg = `Olá, ${name}! Que bom te ver por aqui novamente. 😊`;
  if (date) msg += `\nNos falamos no dia ${date} às ${time}.`;
  if (summary) msg += `\nSobre ${summary}.`;
  msg += `\nSobre o que vamos conversar hoje?`;
  return msg;
}

const RETURNING_LEAD: Record<string, (name: string, topicContext?: string) => string> = {
  "pt-BR": (name, _tc) => buildReturningLeadMessage(name, "pt-BR"),
  "en-US": (name, _tc) => buildReturningLeadMessage(name, "en-US"),
  "es-ES": (name, _tc) => buildReturningLeadMessage(name, "es-ES"),
};

const LEAD_CONFIRMED: Record<string, (name: string, email: string, topicContext?: string) => string> = {
  "pt-BR": (name, email, _tc) => `Acesso validado, seu token é o **${email}**, use-o sempre que me chamar para que possamos dar continuidade nas nossas conversas e eu aprender um pouco mais sobre você.\n\nComo posso te ajudar hoje, **${name}**?`,
  "en-US": (name, email, _tc) => `Access validated, your token is **${email}**, use it whenever you reach out so we can continue our conversations and I can learn more about you.\n\nHow can I help you today, **${name}**?`,
  "es-ES": (name, email, _tc) => `Acceso validado, tu token es **${email}**, úsalo siempre que me contactes para que podamos continuar nuestras conversaciones y yo pueda aprender más sobre ti.\n\n¿Cómo puedo ayudarte hoy, **${name}**?`,
};

// Upsert lead in the database and link to session
async function upsertLead(
  supabase: ReturnType<typeof createClient>,
  name: string,
  email: string,
  sessionId: string
): Promise<string | null> {
  try {
    // Upsert by email
    const { data: lead, error } = await supabase
      .from("leads")
      .upsert(
        { name, email, source: "dra-lia", updated_at: new Date().toISOString() },
        { onConflict: "email" }
      )
      .select("id")
      .single();

    if (error || !lead) {
      console.error("[upsertLead] error:", error);
      return null;
    }

    // Update session with lead_id and entities
    await supabase.from("agent_sessions").upsert({
      session_id: sessionId,
      lead_id: lead.id,
      extracted_entities: {
        lead_name: name,
        lead_email: email,
        lead_id: lead.id,
        spin_stage: "etapa_1",
      },
      current_state: "idle",
      last_activity_at: new Date().toISOString(),
    }, { onConflict: "session_id" });

    console.log(`[upsertLead] Lead saved: ${name} (${email}) → ${lead.id}`);

    // Also upsert into lia_attendances for Smart Ops visibility
    try {
      // Fetch topic_context from session for rota_inicial_lia
      let rotaInicial: string | null = null;
      try {
        const { data: sessionData } = await supabase
          .from("agent_sessions")
          .select("extracted_entities")
          .eq("session_id", sessionId)
          .single();
        const entities = (sessionData?.extracted_entities || {}) as Record<string, unknown>;
        rotaInicial = (entities.topic_context as string) || null;
      } catch { /* ignore */ }

      await supabase.from("lia_attendances").upsert(
        {
          nome: name,
          email: email,
          source: "dra-lia",
          lead_status: "novo",
          rota_inicial_lia: rotaInicial,
          data_primeiro_contato: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );
      console.log(`[upsertLead] lia_attendances synced for ${email} (rota: ${rotaInicial})`);
    } catch (liaErr) {
      console.warn(`[upsertLead] lia_attendances sync failed:`, liaErr);
    }

    return lead.id;
  } catch (e) {
    console.error("[upsertLead] exception:", e);
    return null;
  }
}

// ── IMPLICIT DATA EXTRACTION ────────────────────────────────────────────
async function extractImplicitLeadData(
  supabaseClient: ReturnType<typeof createClient>,
  email: string,
  conversationText: string
): Promise<void> {
  const text = conversationText.toLowerCase();
  const updates: Record<string, unknown> = {};

  // UF detection
  const ufMap: Record<string, string> = {
    "são paulo": "SP", "rio de janeiro": "RJ", "minas gerais": "MG",
    "bahia": "BA", "paraná": "PR", "rio grande do sul": "RS",
    "santa catarina": "SC", "goiás": "GO", "pernambuco": "PE",
    "ceará": "CE", "pará": "PA", "maranhão": "MA",
    "mato grosso do sul": "MS", "mato grosso": "MT", "distrito federal": "DF",
    "espírito santo": "ES", "amazonas": "AM", "paraíba": "PB",
    "sergipe": "SE", "alagoas": "AL", "piauí": "PI",
    "rio grande do norte": "RN", "tocantins": "TO", "rondônia": "RO",
    "acre": "AC", "amapá": "AP", "roraima": "RR",
  };
  for (const [nome, sigla] of Object.entries(ufMap)) {
    if (text.includes(nome)) { updates.uf = sigla; break; }
  }
  const ufMatch = text.match(/\b(?:sou de|moro em|estou em|atendo em)\s+([A-Z]{2})\b/i);
  if (ufMatch && !updates.uf) updates.uf = ufMatch[1].toUpperCase();

  // Equipment detection
  if (/\b(?:tenho|comprei|possuo|uso|adquiri)\b.{0,30}\b(?:impressora|printer)\b/i.test(text)) {
    updates.tem_impressora = "sim";
  }
  if (/\b(?:tenho|comprei|possuo|uso|adquiri)\b.{0,30}\b(?:scanner|escaner|escâner)\b/i.test(text)) {
    updates.tem_scanner = "sim";
  }

  // Specific models
  const impressoraModels = ["phrozen", "anycubic", "elegoo", "rayshape", "asiga", "formlabs", "prusa", "creality", "miicraft", "blz", "envisiontec", "bego", "dentsply"];
  for (const m of impressoraModels) {
    if (text.includes(m)) { updates.impressora_modelo = m.charAt(0).toUpperCase() + m.slice(1); break; }
  }
  const scannerModels = ["medit", "3shape", "trios", "itero", "primescan", "aoralscan", "shining3d"];
  for (const m of scannerModels) {
    if (text.includes(m)) { updates.como_digitaliza = m.charAt(0).toUpperCase() + m.slice(1); break; }
  }

  // ── NEW: Software CAD detection ──
  const cadSoftware = ["exocad", "3shape", "blender", "meshmixer", "dental system", "ceramill", "zirkonzahn", "hyperdent", "dental cad"];
  for (const sw of cadSoftware) {
    if (text.includes(sw)) { updates.software_cad = sw.charAt(0).toUpperCase() + sw.slice(1); break; }
  }

  // ── NEW: Monthly volume detection ──
  const volumeMatch = text.match(/\b(?:faço|imprimo|produzo|fabrico)\b.{0,30}(\d+)\s*(?:peças?|unidades?|trabalhos?|casos?)\b/i);
  if (volumeMatch) {
    const qty = parseInt(volumeMatch[1]);
    if (qty <= 10) updates.volume_mensal_pecas = "até 10 peças/mês";
    else if (qty <= 50) updates.volume_mensal_pecas = "10-50 peças/mês";
    else if (qty <= 100) updates.volume_mensal_pecas = "50-100 peças/mês";
    else updates.volume_mensal_pecas = "100+ peças/mês";
  }
  // Qualitative volume
  if (!updates.volume_mensal_pecas) {
    if (/\b(?:muito|bastante|grande volume|alta produção|produção alta)\b/i.test(text)) updates.volume_mensal_pecas = "alto volume";
    if (/\b(?:pouco|poucos?|baixo volume|começ|iniciando)\b/i.test(text)) updates.volume_mensal_pecas = "baixo volume";
  }

  // ── NEW: Primary application detection ──
  const appPatterns: [RegExp, string][] = [
    [/\b(?:provisórios?|provisorio|temporári|temporario|temp crown)\b/i, "provisórios"],
    [/\b(?:guias? cir[úu]rgic|surgical guide)\b/i, "guias cirúrgicos"],
    [/\b(?:modelos? de estudo|modelo diagnóstico|study model)\b/i, "modelos de estudo"],
    [/\b(?:placa.{0,10}miorrelaxante|placa.{0,10}bruxismo|night guard|splint)\b/i, "placas miorrelaxantes"],
    [/\b(?:coroas? definitiv|prótese fixa|permanent crown)\b/i, "próteses definitivas"],
    [/\b(?:alinhador|clear aligner|ortodont)\b/i, "alinhadores"],
    [/\b(?:moldeira|tray|cubeta)\b/i, "moldeiras individuais"],
  ];
  for (const [pattern, app] of appPatterns) {
    if (pattern.test(text)) { updates.principal_aplicacao = app; break; }
  }

  // Raw payload enrichment
  const rawUpdates: Record<string, unknown> = {};
  const concorrentes = ["formlabs", "nextdent", "keystone", "bego", "detax", "gc", "dentsply"];
  const found = concorrentes.filter(c => text.includes(c));
  if (found.length > 0) rawUpdates.marcas_concorrentes = found;

  if (/\b(?:sozinho|trabalho sozinho|atendo sozinho)\b/i.test(text)) rawUpdates.estrutura_consultorio = "sozinho";
  if (/\b(?:equipe|parceiro|sócio|sócia|associado)\b/i.test(text)) rawUpdates.estrutura_consultorio = "equipe";
  if (/\b(?:já conheço|conheço a smart|uso smart|cliente smart)\b/i.test(text)) rawUpdates.conhece_smart_dent = true;
  if (/\b(?:nunca usei|parei de usar|deixei de|não uso mais)\b/i.test(text)) rawUpdates.motivo_nao_usa_smart = "mencionou que parou/nunca usou";

  const imprime = text.match(/\b(?:imprimo|faço|produzo)\b.{0,30}\b(placas?|guias?|provisórios?|modelos?|próteses?|coroas?)\b/i);
  if (imprime) rawUpdates.o_que_imprime = imprime[1];
  const querImprimir = text.match(/\b(?:quero imprimir|gostaria de|pretendo)\b.{0,30}\b(placas?|guias?|provisórios?|modelos?|próteses?|coroas?)\b/i);
  if (querImprimir) rawUpdates.o_que_quer_imprimir = querImprimir[1];

  if (Object.keys(rawUpdates).length > 0) updates.raw_payload = rawUpdates;
  if (Object.keys(updates).length === 0) return;

  // Fetch current record, apply COALESCE logic
  const { data: current } = await supabaseClient
    .from("lia_attendances")
    .select("uf, tem_impressora, tem_scanner, impressora_modelo, como_digitaliza, raw_payload, software_cad, volume_mensal_pecas, principal_aplicacao")
    .eq("email", email)
    .maybeSingle();

  if (!current) return;

  const safeUpdates: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(updates)) {
    if (field === "raw_payload") {
      safeUpdates.raw_payload = { ...(current.raw_payload as Record<string, unknown> || {}), ...(value as Record<string, unknown>) };
    } else if ((current as Record<string, unknown>)[field] === null || (current as Record<string, unknown>)[field] === undefined) {
      safeUpdates[field] = value;
    }
  }

  if (Object.keys(safeUpdates).length === 0) return;

  await supabaseClient.from("lia_attendances")
    .update({ ...safeUpdates, updated_at: new Date().toISOString() })
    .eq("email", email);

  console.log(`[extractImplicit] Updated ${Object.keys(safeUpdates).join(", ")} for ${email}`);
}

// ── LEAD MATURITY CLASSIFICATION ────────────────────────────────────────
async function classifyLeadMaturity(
  supabaseClient: ReturnType<typeof createClient>,
  email: string
): Promise<"MQL" | "SAL" | "SQL" | "CLIENTE" | null> {
  const { data } = await supabaseClient
    .from("lia_attendances")
    .select("ultima_etapa_comercial, status_atual_lead_crm, funil_entrada_crm, status_oportunidade")
    .eq("email", email)
    .maybeSingle();

  if (!data) return null;

  const etapa = (data.ultima_etapa_comercial || "").toLowerCase();
  const funil = (data.funil_entrada_crm || "").toLowerCase();
  const status = (data.status_oportunidade || "").toLowerCase();

  if (status === "ganha") return "CLIENTE";

  if (funil.includes("estagnado") || funil.includes("stagnant")) {
    if (/contato feito|sem contato|sem resposta/.test(etapa)) return "MQL";
    if (/em contato|apresenta[çc][ãa]o agendada/.test(etapa)) return "SAL";
    if (/proposta enviada|negocia[çc][ãa]o|fechamento/.test(etapa)) return "SQL";
  }

  // Fallback by stage alone
  if (/proposta|negocia|fechamento/.test(etapa)) return "SQL";
  if (/em contato|apresenta/.test(etapa)) return "SAL";
  if (/contato feito|sem contato|novo/.test(etapa)) return "MQL";

  return null;
}

// Helper to stream a simple text response
function streamTextResponse(text: string, corsHeaders: Record<string, string>, interactionId?: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      if (interactionId) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ interaction_id: interactionId, type: "meta", media_cards: [] })}\n\n`));
      }
      const words = text.split(" ");
      let i = 0;
      const interval = setInterval(() => {
        if (i < words.length) {
          const token = (i === 0 ? "" : " ") + words[i];
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`));
          i++;
        } else {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          clearInterval(interval);
        }
      }, 25);
    },
  });
  return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
}

// Multilingual fallback messages when no results found
const FALLBACK_MESSAGES: Record<string, string> = {
  "pt-BR": `Ainda não tenho essa informação em nossa base de conhecimento, mas nossos especialistas podem ajudar você! 😊

💬 **WhatsApp:** [Chamar no WhatsApp](https://wa.me/551634194735?text=Ol%C3%A1%2C+poderia+me+ajudar%3F)
✉️ **E-mail:** comercial@smartdent.com.br
🕐 **Horário:** Segunda a Sexta, 08h às 18h

Nossa equipe está pronta para explicar melhor!`,

  "en-US": `I don't have this information in our knowledge base yet, but our specialists can help you! 😊

💬 **WhatsApp:** [Chat on WhatsApp](https://wa.me/551634194735?text=Hi%2C+could+you+help+me%3F)
✉️ **E-mail:** comercial@smartdent.com.br
🕐 **Hours:** Monday to Friday, 8am–6pm (BRT)

Our team is ready to help!`,

  "es-ES": `Todavía no tengo esa información en nuestra base de conocimiento, pero nuestros especialistas pueden ayudarte! 😊

💬 **WhatsApp:** [Chatear por WhatsApp](https://wa.me/551634194735?text=Hola%2C+%C2%BFpodrian+ayudarme%3F)
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GOOGLE_AI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/gemini-embedding-001",
          content: { parts: [{ text }] },
          taskType: "RETRIEVAL_QUERY",
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
  status: "pending" | "low_confidence" = "pending",
  rota?: string | null,
  tema?: string | null,
) {
  // Filtro anti-lixo: ignorar mensagens curtas e ruído
  const NOISE_PATTERNS = /^(oi|ola|olá|hey|hi|hola|obrigad|valeu|ok|sim|não|nao|lia|ooe|tchau|bye|gracias|thanks|tudo bem|beleza|show|legal|massa|top)\b/i;
  if (question.trim().length < 10 || NOISE_PATTERNS.test(question.trim())) {
    return; // silently skip noise
  }

  // Auto-extract tema from question if not provided
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
      // Update rota/tema if provided and not set before
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
    // fail silently
  }
}

// ── META-QUERY: detect questions about articles, publications, KOLs, authors ──
const META_ARTICLE_PATTERNS = [
  /\b(artigos?|publica[çc][õo]es?|conte[úu]dos?|textos?)\b.{0,30}\b(t[eê]m|tem|vocês|voces|disponíveis|existe|publicados?|escreveram|produziram)\b/i,
  /\b(quais|quantos?|list[ae]|mostr[ae])\b.{0,30}\b(artigos?|publica[çc][õo]es?|conte[úu]dos?)\b/i,
  /\b(kol|kols|autor|autora|autores|especialista|colunista|quem escreve|quem escreveu)\b/i,
  /\b(base de conhecimento|knowledge base|blog)\b/i,
  /\b(artigos? sobre|publica[çc][õo]es? sobre|conte[úu]do sobre)\b/i,
];

const isMetaArticleQuery = (msg: string) =>
  META_ARTICLE_PATTERNS.some(p => p.test(msg));

// Direct fetch of articles + authors for meta-queries
async function searchArticlesAndAuthors(
  supabase: ReturnType<typeof createClient>,
  message: string,
) {
  const results: Array<{ id: string; source_type: string; chunk_text: string; metadata: Record<string, unknown>; similarity: number }> = [];

  // Fetch recent/popular articles (up to 10)
  const { data: articles } = await supabase
    .from('knowledge_contents')
    .select('id, title, slug, excerpt, category_id, author_id, knowledge_categories:knowledge_categories(letter, name)')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(15);

  if (articles?.length) {
    // Check if user asks about a specific topic
    const queryWords = message.toLowerCase().replace(/[?!.,;:]/g, '').split(/\s+/).filter(w => w.length >= 3 && !STOPWORDS_PT.includes(w));

    for (const a of articles as Array<{ id: string; title: string; slug: string; excerpt: string; author_id: string | null; knowledge_categories: { letter: string; name: string } | null }>) {
      const letter = a.knowledge_categories?.letter?.toLowerCase() || '';
      const categoryName = a.knowledge_categories?.name || '';
      // Score by topic match if user asks about specific topic
      const titleLower = a.title.toLowerCase();
      const matchCount = queryWords.filter(w => titleLower.includes(w)).length;
      const similarity = queryWords.length > 0 && matchCount > 0
        ? Math.min(0.5 + (matchCount / queryWords.length) * 0.4, 0.9)
        : 0.45; // base score for meta-queries

      results.push({
        id: a.id,
        source_type: 'article',
        chunk_text: `PUBLICAÇÃO: ${a.title} | Categoria: ${categoryName} | Resumo: ${a.excerpt}`,
        metadata: {
          title: a.title,
          slug: a.slug,
          category_letter: letter,
          url_publica: letter ? `/base-conhecimento/${letter}/${a.slug}` : null,
        },
        similarity,
      });
    }

    // Sort by similarity and take top 8
    results.sort((a, b) => b.similarity - a.similarity);
    results.splice(8);
  }

  // Fetch authors if KOL/author query
  if (/\b(kol|kols|autor|autora|autores|especialista|colunista|quem escreve|quem escreveu)\b/i.test(message)) {
    const { data: authors } = await supabase
      .from('authors')
      .select('id, name, specialty, mini_bio, photo_url, website_url, instagram_url, youtube_url, lattes_url')
      .eq('active', true)
      .order('order_index');

    if (authors?.length) {
      for (const author of authors as Array<{ id: string; name: string; specialty: string | null; mini_bio: string | null; photo_url: string | null; website_url: string | null; instagram_url: string | null; youtube_url: string | null; lattes_url: string | null }>) {
        const socialLinks = [
          author.website_url ? `Site: ${author.website_url}` : '',
          author.instagram_url ? `Instagram: ${author.instagram_url}` : '',
          author.youtube_url ? `YouTube: ${author.youtube_url}` : '',
          author.lattes_url ? `Lattes: ${author.lattes_url}` : '',
        ].filter(Boolean).join(' | ');

        results.push({
          id: author.id,
          source_type: 'author',
          chunk_text: `KOL/AUTOR: ${author.name}${author.specialty ? ` — ${author.specialty}` : ''}${author.mini_bio ? ` | ${author.mini_bio}` : ''}${socialLinks ? ` | ${socialLinks}` : ''}`,
          metadata: {
            title: author.name,
            specialty: author.specialty,
            photo_url: author.photo_url,
          },
          similarity: 0.85,
        });
      }
    }
  }

  return results;
}

// ── DIRECT CATALOG PRODUCT SEARCH ─────────────────────────────────────────────
// Queries system_a_catalog directly when user asks about products/equipment
const PRODUCT_INTEREST_KEYWORDS = [
  /impressora|printer|impresora/i,
  /scanner|escaner/i,
  /equipamento|equipment|equipo/i,
  /op[çc][õo]es|opcoes|options|opciones/i,
  /quais (vocês )?t[eê]m|o que (vocês )?t[eê]m|what do you have|qué tienen/i,
  /quero (comprar|ver|conhecer|saber)/i,
  /cat[áa]logo|catalog/i,
  /combo|kit|solu[çc][ãa]o|chairside|chair side/i,
  /p[óo]s.?impress[ãa]o|post.?print|lavadora|cura uv/i,
];

async function searchCatalogProducts(
  supabase: ReturnType<typeof createClient>,
  message: string,
  history: Array<{ role: string; content: string }>
) {
  const combinedText = `${history.slice(-6).map(h => h.content).join(' ')} ${message}`.toLowerCase();
  
  // Check if user is asking about products
  const hasProductIntent = PRODUCT_INTEREST_KEYWORDS.some(p => p.test(combinedText));
  if (!hasProductIntent) return [];

  // Detect category interest
  const categories: string[] = [];
  if (/impressora|printer|impresora|imprimir|imprim/i.test(combinedText)) categories.push('IMPRESSÃO 3D');
  if (/scanner|escaner|escanear|escaneamento|intraoral/i.test(combinedText)) categories.push('SCANNERS 3D');
  if (/p[óo]s.?impress|lavadora|cura uv|limpeza|post.?print/i.test(combinedText)) categories.push('PÓS-IMPRESSÃO');
  if (/combo|kit|solu[çc]|chairside|chair side|fluxo completo/i.test(combinedText)) categories.push('SOLUÇÔES');
  
  // If no specific category detected, fetch all
  let query = supabase
    .from('system_a_catalog')
    .select('id, name, description, product_category, product_subcategory, cta_1_url, cta_1_label, slug, price, promo_price, extra_data')
    .eq('active', true)
    .eq('approved', true);
  
  if (categories.length > 0) {
    query = query.in('product_category', categories);
  }
  
  const { data, error } = await query.limit(20);
  
  if (error || !data?.length) return [];
  
  // Score and sort by name relevance, then take top 5
  const scored = data.map((p: {
    id: string;
    name: string;
    description: string | null;
    product_category: string | null;
    product_subcategory: string | null;
    cta_1_url: string | null;
    cta_1_label: string | null;
    slug: string | null;
    price: number | null;
    promo_price: number | null;
    extra_data: Record<string, unknown> | null;
  }) => {
    const nameWords = p.name.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 3);
    const queryWords = combinedText.split(/\s+/).filter((w: string) => w.length >= 3);
    const nameMatchCount = nameWords.filter((w: string) => queryWords.some((q: string) => w.includes(q) || q.includes(w))).length;
    const similarity = nameWords.length > 0
      ? (nameMatchCount / nameWords.length) * 0.6 + 0.3
      : 0.3;

    // Build enriched chunk_text with clinical_brain and technical_specs from extra_data
    const extra = (p.extra_data || {}) as Record<string, unknown>;
    const clinicalBrain = extra.clinical_brain as Record<string, unknown> | undefined;
    const technicalSpecs = extra.technical_specs as Record<string, unknown> | undefined;

    const salesPitch = (extra.sales_pitch as string) || '';
    let chunkText = `PRODUTO DO CATÁLOGO: ${p.name}${p.product_category ? ` | Categoria: ${p.product_category}` : ''}${p.product_subcategory ? ` | Sub: ${p.product_subcategory}` : ''}${p.description ? ` | ${p.description.slice(0, 300)}` : ''}${p.price ? ` | Preço: R$ ${p.price}` : ''}${p.promo_price ? ` | Promo: R$ ${p.promo_price}` : ''}${salesPitch ? ` | ARGUMENTO COMERCIAL: ${salesPitch.slice(0, 400)}` : ''}`;

    if (clinicalBrain) {
      const mandatory = (clinicalBrain.mandatory_products as string[]) || [];
      const prohibited = (clinicalBrain.prohibited_products as string[]) || [];
      const rules = (clinicalBrain.anti_hallucination_rules as string[]) || [];
      if (mandatory.length) chunkText += ` | OBRIGATÓRIO CITAR: ${mandatory.join(', ')}`;
      if (prohibited.length) chunkText += ` | PROIBIDO CITAR: ${prohibited.join(', ')}`;
      if (rules.length) chunkText += ` | REGRAS: ${rules.join('; ')}`;
    }

    if (technicalSpecs) {
      chunkText += ` | SPECS: ${JSON.stringify(technicalSpecs).slice(0, 400)}`;
    }

    return {
      id: p.id,
      source_type: 'catalog_product',
      chunk_text: chunkText,
      metadata: {
        title: p.name,
        slug: p.slug,
        url_publica: p.slug ? `/produtos/${p.slug}` : null,
        cta_1_url: p.cta_1_url,
      },
      similarity,
      nameMatchCount,
    };
  });

  // Sort by name match count (desc), then take top 5
  scored.sort((a: { nameMatchCount: number; similarity: number }, b: { nameMatchCount: number; similarity: number }) => b.nameMatchCount - a.nameMatchCount || b.similarity - a.similarity);
  return scored.slice(0, 5).map(({ nameMatchCount: _, ...rest }: { nameMatchCount: number; [key: string]: unknown }) => rest);
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

  // If a specific resin was mentioned, use only matched ones; otherwise return empty
  // (returning random resins when no match causes hallucination — rule 21 handles safety phrase)
  const matched = scored.filter((x: { score: number }) => x.score > 0);
  if (matched.length === 0) return [];

  return matched.slice(0, 3).map(({ resin: r }: { resin: {
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
    similarity: (() => {
        const resinWords = `${r.name} ${r.manufacturer}`.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
        const queryWords = combinedText.split(/\s+/).filter((w: string) => w.length > 3);
        const matchedCount = resinWords.filter((w: string) => queryWords.some((q: string) => q.includes(w) || w.includes(q))).length;
        const maxPossible = Math.max(resinWords.length, 1);
        return matchedCount > 0 ? Math.min(matchedCount / maxPossible * 0.5 + 0.5, 0.95) : 0.40;
      })()
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
      similarity: (() => {
            const resinWords = p.resin_name.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 3);
            const queryWords = combinedText.split(/\s+/).filter((w: string) => w.length >= 3);
            const matchCount = resinWords.filter((w: string) => queryWords.some((q: string) => w.includes(q) || q.includes(w))).length;
            const baseScore = resinMatched ? 0.55 : 0.35;
            return matchCount > 0 ? Math.min(baseScore + (matchCount / Math.max(resinWords.length, 1)) * 0.35, 0.90) : baseScore;
          })(),
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
  lang: string,
  topicContext?: string,
  history?: Array<{ role: string; content: string }>
) {
  // Augment query with product/brand names from recent history for better vector matching
  let augmentedQuery = query;
  if (history && history.length > 0) {
    const recentText = history.slice(-4).map(h => h.content).join(' ');
    const productMentions = recentText.match(
      /\b(NanoClean[^\s.!?\n]{0,20}|Edge Mini[^\s.!?\n]{0,15}|Vitality[^\s.!?\n]{0,15}|ShapeWare[^\s.!?\n]{0,15}|Rayshape[^\s.!?\n]{0,15}|Scanner BLZ[^\s.!?\n]{0,15}|Asiga[^\s.!?\n]{0,15}|Chair Side[^\s.!?\n]{0,15}|MiiCraft[^\s.!?\n]{0,15}|Medit[^\s.!?\n]{0,15})/gi
    );
    if (productMentions && productMentions.length > 0) {
      const uniqueProducts = [...new Set(productMentions.map(p => p.trim().slice(0, 30)))];
      augmentedQuery = `${uniqueProducts.join(' ')} ${query}`;
      console.log(`[searchKnowledge] Query augmented with history products: "${augmentedQuery}"`);
    }
  }

  // Try vector search first
  const embedding = await generateEmbedding(augmentedQuery);

  if (embedding) {
    const { data, error } = await supabase.rpc("match_agent_embeddings", {
      query_embedding: embedding,
      match_threshold: 0.65,
      match_count: 10,
    });
    if (!error && data && data.length > 0) {
      const reranked = applyTopicWeights(data, topicContext);
      return { results: reranked, method: "vector", topSimilarity: reranked[0]?.similarity || 0 };
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
      const rerankedMerged = applyTopicWeights(merged, topicContext);
      return { results: rerankedMerged, method: "ilike", topSimilarity: rerankedMerged[0]?.similarity || 0.3 };
    }
  }

  if (ftsResults.length > 0) {
    const rerankedFts = applyTopicWeights(ftsResults, topicContext);
    return { results: rerankedFts, method: "fulltext", topSimilarity: rerankedFts[0]?.similarity || 0 };
  }

  // Include recent conversation history to capture product names mentioned earlier
  const recentContext = (history || []).slice(-6).map(h => h.content).join(' ');
  const fullText = `${recentContext} ${query}`;
  const keywords = fullText
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS_PT.includes(w.toLowerCase()))
    .map(w => w.toLowerCase())
    .filter((v, i, a) => a.indexOf(v) === i) // deduplicate
    .slice(0, 8);

  if (keywords.length > 0) {
    const { data: videos } = await supabase
      .from("knowledge_videos")
      .select("id, title, description, embed_url, thumbnail_url, content_id, pandavideo_id, url")
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
        url: string | null;
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
            youtube_url: v.url || null,
          },
          similarity: (() => {
            const titleWords = v.title.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 3);
            const matchCount = keywords.filter(k => titleWords.some((tw: string) => tw.includes(k) || k.includes(tw))).length;
            return matchCount > 0 ? Math.min(0.30 + (matchCount / Math.max(keywords.length, 1)) * 0.35, 0.70) : 0.25;
          })(),
        };
      });
      const rerankedKeyword = applyTopicWeights(results, topicContext);
      return { results: rerankedKeyword, method: "keyword", topSimilarity: 0.5 };
    }
  }

  return { results: [], method: "none", topSimilarity: 0 };
}

// ── LEAD ARCHETYPE DETERMINATION ─────────────────────────────────────────
// Maps lead profile data → archetype for strategy-based personalization
function determineLeadArchetype(attendance: Record<string, unknown> | null): string {
  if (!attendance) return "novo_desconhecido";

  const area = ((attendance.area_atuacao as string) || "").toLowerCase();
  const temImpressora = ((attendance.tem_impressora as string) || "").toLowerCase();
  const temScanner = ((attendance.tem_scanner as string) || "").toLowerCase();
  const temperatura = ((attendance.temperatura_lead as string) || "").toLowerCase();
  const status = ((attendance.status_oportunidade as string) || "").toLowerCase();
  const score = (attendance.score as number) || 0;

  // Client with active products
  if (status === "ganha" || (attendance.ativo_print && attendance.ativo_scan)) return "cliente_ativo";

  // Lab with old printer (upgrade opportunity)
  if (area.includes("laboratório") || area.includes("laboratorio")) {
    if (temImpressora === "sim") return "lab_com_impressora";
    return "lab_sem_impressora";
  }

  // Prosthodontist with printer → focus on resins/protocols
  if ((area.includes("clínica") || area.includes("clinica")) && temImpressora === "sim") {
    return "clinica_com_impressora";
  }

  // Orthodontist without printer → ROI focus
  if ((area.includes("clínica") || area.includes("clinica")) && temImpressora !== "sim") {
    return "clinica_sem_impressora";
  }

  // Cold lead / ebook download → educational, no pressure
  if (temperatura === "frio" || score < 20) return "lead_frio_educativo";

  // Hot lead with proposal → objection resolution
  if (temperatura === "quente" || score > 70) return "lead_quente_decisao";

  // Student
  if (area.includes("estudante") || area.includes("universidade")) return "estudante_academico";

  return "novo_desconhecido";
}

// Strategy instructions per lead archetype
const ARCHETYPE_STRATEGIES: Record<string, string> = {
  clinica_com_impressora: `**ESTRATÉGIA: CLÍNICA COM IMPRESSORA**
Foco em resinas, protocolos de processamento, workflow completo ChairSide.
Explore quais aplicações ele já faz (provisórios, guias, modelos) e sugira expansão.
Pergunte sobre volume mensal para dimensionar consumo de resina.
Tom: colega técnico que domina o fluxo.`,

  clinica_sem_impressora: `**ESTRATÉGIA: CLÍNICA SEM IMPRESSORA**
Foco em ROI, casos/mês mínimo para viabilizar, comparativo de investimento.
Entenda como digitaliza hoje (moldagem? scanner?).
Mostre que o ecossistema SmartDent reduz curva de aprendizado.
Tom: consultor de negócios que entende a realidade do consultório.`,

  lab_com_impressora: `**ESTRATÉGIA: LABORATÓRIO COM IMPRESSORA**
Foco em upgrade, velocidade, novos materiais, produtividade.
Pergunte qual impressora usa hoje e volume de produção.
Compare especificações técnicas se dados disponíveis.
Tom: especialista em eficiência produtiva.`,

  lab_sem_impressora: `**ESTRATÉGIA: LABORATÓRIO SEM IMPRESSORA**
Foco em transição digital, ganho de produtividade, redução de retrabalho.
Entenda o fluxo atual (analógico? terceiriza impressão?).
Tom: parceiro de modernização.`,

  lead_frio_educativo: `**ESTRATÉGIA: LEAD FRIO/EDUCATIVO**
Conteúdo educativo, sem pressão comercial. Compartilhe artigos e conhecimento.
Objetivo: nutrir interesse, criar confiança. NÃO ofereça agendamento ou preço.
Tom: professora generosa que compartilha conhecimento.`,

  lead_quente_decisao: `**ESTRATÉGIA: LEAD QUENTE/DECISÃO**
Resolução de objeções, urgência sutil, facilitação da decisão.
Foque em remover barreiras: prazo, suporte pós-venda, treinamento incluso.
Tom: consultora resolutiva que quer viabilizar o projeto dele.`,

  cliente_ativo: `**ESTRATÉGIA: CLIENTE ATIVO**
Foco em cross-sell, novas aplicações, resinas complementares.
Pergunte sobre satisfação e explore expansão do fluxo.
Tom: parceira de evolução contínua.`,

  estudante_academico: `**ESTRATÉGIA: ESTUDANTE/ACADÊMICO**
Foco em educação, fundamentos, primeiros passos na odontologia digital.
Compartilhe artigos, vídeos e conceitos básicos.
Tom: mentora acessível e didática.`,

  novo_desconhecido: `**ESTRATÉGIA: LEAD NOVO**
Faça perguntas de qualificação naturalmente (área, especialidade, equipamento).
Objetivo: entender o perfil antes de recomendar qualquer solução.
Tom: curiosa e atenciosa.`,
};

// ── ESCALATION ENGINE — Phase 3: IA → Humano ────────────────────────────────
// Detects when LIA should hand off to a human seller/CS/specialist

const ESCALATION_TRIGGERS = {
  // → VENDEDOR: intenção de compra, negociação, desconto
  vendedor: [
    /\b(desconto|negocia[çc]|condi[çc][ãa]o especial|pre[çc]o menor|melhor pre[çc]o|quanto fica|parcel[ao]|pagamento)\b/i,
    /\b(or[çc]amento|proposta|cotação|cota[çc]ao)\b/i,
    /\b(quero comprar|vou comprar|vou fechar|fecha[r]? neg[óo]cio|agendar reuni[ãa]o|visita|demo(nstra[çc][ãa]o)?)\b/i,
    /\b(concorr[êe]ncia|concorrente|formlabs|dentsply|keystone|stratasys|bego)\b.{0,30}\b(melhor|mais barato|prefer[oe]|considerar|comparar)\b/i,
  ],
  // → CS/SUPORTE: problemas técnicos pós-venda
  cs_suporte: [
    /\b(defeito|garantia|assist[êe]ncia|reclama[çc]|insatisf|problema com.{0,20}(produto|equipamento|impressora|scanner))\b/i,
    /\b(troca[r]?|devolu[çc]|reembolso|pe[çc]a.{0,15}reposi[çc])\b/i,
    /\b(treinamento|capacita[çc]|curso|academy)\b/i,
  ],
  // → ESPECIALISTA: frustração ou muitas tentativas sem resolução
  especialista: [
    /\b(frustra|irritad|decepcion|insatisfeit|raiva|absurdo|p[ée]ssim|horrível|hor[íi]vel|nunca mais)\b/i,
    /\b(j[áa] perguntei|j[áa] falei|n[ãa]o resolveu|n[ãa]o funciona|n[ãa]o ajudou|n[ãa]o entendeu)\b/i,
  ],
};

type EscalationType = "vendedor" | "cs_suporte" | "especialista" | null;

function detectEscalationIntent(message: string, history: Array<{ role: string; content: string }>): EscalationType {
  // Check current message first
  for (const [type, patterns] of Object.entries(ESCALATION_TRIGGERS)) {
    if (patterns.some(p => p.test(message))) {
      return type as EscalationType;
    }
  }
  
  // Check for specialist escalation: 3+ unanswered questions in session
  const userMessages = history.filter(h => h.role === "user");
  const assistantMessages = history.filter(h => h.role === "assistant");
  if (userMessages.length >= 3) {
    // Check if last 3 assistant responses contain fallback/redirect phrases
    const lastAssistants = assistantMessages.slice(-3);
    const fallbackCount = lastAssistants.filter(a => 
      /não tenho essa informação|falar com especialista|falar com suporte|wa\.me/i.test(a.content)
    ).length;
    if (fallbackCount >= 2) return "especialista";
  }
  
  return null;
}

// Notify the responsible seller via SellFlux/WaLeads
async function notifySellerEscalation(
  supabase: ReturnType<typeof createClient>,
  leadEmail: string,
  leadName: string,
  escalationType: EscalationType,
  resumo: string,
  message: string
): Promise<void> {
  if (!escalationType) return;
  
  try {
    // 1. Find the responsible seller from lia_attendances → proprietario_lead_crm → team_members
    const { data: attendance } = await supabase
      .from("lia_attendances")
      .select("proprietario_lead_crm, telefone_normalized, produto_interesse, temperatura_lead, score, id")
      .eq("email", leadEmail)
      .maybeSingle();
    
    if (!attendance) {
      console.warn(`[escalation] No attendance found for ${leadEmail}`);
      return;
    }
    
    // 2. Find team member by proprietario_lead_crm
    let teamMember: { id: string; nome_completo: string; whatsapp_number: string; waleads_api_key: string | null } | null = null;
    if (attendance.proprietario_lead_crm) {
      const { data: tm } = await supabase
        .from("team_members")
        .select("id, nome_completo, whatsapp_number, waleads_api_key")
        .eq("piperun_owner_id", attendance.proprietario_lead_crm)
        .eq("ativo", true)
        .maybeSingle();
      teamMember = tm;
    }
    
    // Fallback: get first active team member with vendedor role
    if (!teamMember) {
      const { data: tm } = await supabase
        .from("team_members")
        .select("id, nome_completo, whatsapp_number, waleads_api_key")
        .eq("ativo", true)
        .eq("role", "vendedor")
        .limit(1)
        .maybeSingle();
      teamMember = tm;
    }
    
    if (!teamMember) {
      console.warn(`[escalation] No team member found for escalation`);
      return;
    }
    
    // 3. Build notification message
    const typeLabels: Record<string, string> = {
      vendedor: "🟢 OPORTUNIDADE COMERCIAL",
      cs_suporte: "🟡 SUPORTE TÉCNICO",
      especialista: "🔴 ESCALONAMENTO URGENTE",
    };
    
    const notificationMsg = `${typeLabels[escalationType] || "📋 ESCALONAMENTO"}

👤 Lead: ${leadName}
📧 Email: ${leadEmail}
${attendance.telefone_normalized ? `📱 Tel: ${attendance.telefone_normalized}` : ""}
${attendance.produto_interesse ? `🎯 Interesse: ${attendance.produto_interesse}` : ""}
${attendance.temperatura_lead ? `🌡️ Temp: ${attendance.temperatura_lead}` : ""}
${attendance.score ? `📊 Score: ${attendance.score}` : ""}

💬 Última msg: "${message.slice(0, 200)}"
${resumo ? `📝 Resumo LIA: ${resumo.slice(0, 200)}` : ""}

⚡ Ação recomendada: ${escalationType === "vendedor" ? "Contactar lead para negociação" : escalationType === "cs_suporte" ? "Agendar suporte técnico" : "Intervenção imediata - lead frustrado"}`;

    // 4. Log in message_logs
    await supabase.from("message_logs").insert({
      lead_id: attendance.id,
      team_member_id: teamMember.id,
      tipo: `escalation_${escalationType}`,
      mensagem_preview: notificationMsg.slice(0, 500),
      whatsapp_number: teamMember.whatsapp_number,
      status: "pendente",
    });
    
    // 5. Update lia_attendances with escalation status
    await supabase.from("lia_attendances")
      .update({ 
        ultima_etapa_comercial: `escalado_lia_${escalationType}`,
        updated_at: new Date().toISOString(),
      })
      .eq("email", leadEmail);
    
    console.log(`[escalation] ${escalationType} escalation logged for ${leadEmail} → ${teamMember.nome_completo}`);
    
    // 6. Send via SellFlux/WaLeads if API key available
    if (teamMember.waleads_api_key) {
      try {
        // Use smart-ops-send-waleads to send notification to seller
        const sendResp = await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-send-waleads`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            team_member_id: teamMember.id,
            phone: teamMember.whatsapp_number,
            tipo: "text",
            message: notificationMsg,
            lead_id: attendance.id,
          }),
          signal: AbortSignal.timeout(5000),
        });
        
        if (sendResp.ok) {
          await supabase.from("message_logs")
            .update({ status: "enviado", data_envio: new Date().toISOString() })
            .eq("lead_id", attendance.id)
            .eq("tipo", `escalation_${escalationType}`)
            .order("created_at", { ascending: false })
            .limit(1);
          console.log(`[escalation] WaLeads notification sent to ${teamMember.nome_completo}`);
        } else {
          const errText = await sendResp.text();
          console.warn(`[escalation] WaLeads send failed: ${sendResp.status} ${errText}`);
        }
      } catch (e) {
        console.warn(`[escalation] WaLeads send error:`, e);
      }
    }
  } catch (e) {
    console.error(`[escalation] Error:`, e);
  }
}

// Escalation response messages injected by LIA when she decides to escalate
const ESCALATION_RESPONSES: Record<string, Record<string, string>> = {
  vendedor: {
    "pt-BR": `\n\n---\n💼 Vou conectar você com um de nossos especialistas comerciais para discutir as melhores condições. Eles poderão preparar uma proposta personalizada para sua realidade.\n\n👉 [Falar com especialista comercial](https://wa.me/5516993831794)`,
    "en-US": `\n\n---\n💼 I'll connect you with one of our commercial specialists to discuss the best conditions. They can prepare a customized proposal for you.\n\n👉 [Talk to commercial specialist](https://wa.me/5516993831794)`,
    "es-ES": `\n\n---\n💼 Voy a conectarte con uno de nuestros especialistas comerciales para discutir las mejores condiciones.\n\n👉 [Hablar con especialista comercial](https://wa.me/5516993831794)`,
  },
  cs_suporte: {
    "pt-BR": `\n\n---\n🛠️ Para essa questão, nosso time de suporte técnico é o mais indicado. Eles têm acesso direto ao sistema e podem resolver rapidamente.\n\n👉 [Falar com suporte técnico](https://wa.me/551634194735)`,
    "en-US": `\n\n---\n🛠️ For this issue, our technical support team is best suited. They have direct system access and can resolve it quickly.\n\n👉 [Contact technical support](https://wa.me/551634194735)`,
    "es-ES": `\n\n---\n🛠️ Para esta cuestión, nuestro equipo de soporte técnico es el más indicado.\n\n👉 [Contactar soporte técnico](https://wa.me/551634194735)`,
  },
  especialista: {
    "pt-BR": `\n\n---\n🎯 Percebi que sua dúvida precisa de um atendimento mais aprofundado. Vou acionar um especialista que pode te dar atenção dedicada.\n\n👉 [Falar com especialista](https://wa.me/5516993831794)`,
    "en-US": `\n\n---\n🎯 I noticed your question needs more in-depth attention. I'll connect you with a specialist who can give you dedicated support.\n\n👉 [Talk to specialist](https://wa.me/5516993831794)`,
    "es-ES": `\n\n---\n🎯 Noté que tu duda necesita una atención más profunda. Voy a conectarte con un especialista.\n\n👉 [Hablar con especialista](https://wa.me/5516993831794)`,
  },
};

// ── In-memory rate limiter (per-session, resets on cold start) ────────────────
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX = 30; // max requests per window
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(identifier, { count: 1, windowStart: now });
    return true;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return false;
  return true;
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

    // ── ACTION: summarize_session ───────────────────────────────
    if (action === "summarize_session") {
      const { session_id: sumSessionId } = await req.json();
      if (!sumSessionId) {
        return new Response(JSON.stringify({ error: "session_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        // 1. Fetch session entities (name, email, topic)
        const { data: sessionData } = await supabase
          .from("agent_sessions")
          .select("extracted_entities, lead_id")
          .eq("session_id", sumSessionId)
          .maybeSingle();

        const entities = (sessionData?.extracted_entities as Record<string, string>) || {};
        const leadName = entities.lead_name || "";
        const leadEmail = entities.lead_email || "";
        const topicCtx = entities.topic_context || "";

        if (!leadEmail) {
          console.log("[summarize_session] No email in session, skipping");
          return new Response(JSON.stringify({ success: true, skipped: "no_email" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // 2. Fetch conversation history
        const { data: interactions } = await supabase
          .from("agent_interactions")
          .select("user_message, agent_response, created_at")
          .eq("session_id", sumSessionId)
          .order("created_at", { ascending: true })
          .limit(50);

        if (!interactions?.length) {
          console.log("[summarize_session] No interactions found");
          return new Response(JSON.stringify({ success: true, skipped: "no_interactions" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // 3. Build conversation text
        const convoText = interactions.map((i: { user_message: string; agent_response: string | null; created_at: string | null }) => {
          const time = i.created_at ? new Date(i.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
          let line = `[${time}] Usuário: ${i.user_message}`;
          if (i.agent_response) line += `\n[${time}] LIA: ${i.agent_response.slice(0, 300)}`;
          return line;
        }).join("\n\n");

        // 4. Call AI for summary (non-streaming)
        const aiResp = await fetch(CHAT_API, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: "Resuma esta conversa em 2-3 frases curtas para continuidade na próxima sessão. Formato: 'ASSUNTOS: [tópicos discutidos] | PENDÊNCIAS: [dúvidas não resolvidas ou próximos passos] | INTERESSE: [nível 1-3, onde 1=pesquisando, 2=comparando, 3=pronto para comprar]'. Sem saudações, sem emojis. Máximo 150 caracteres." },
              { role: "user", content: convoText.slice(0, 4000) },
            ],
            stream: false,
            max_tokens: 100,
          }),
        });

        let summary = "";
        if (aiResp.ok) {
          const aiData = await aiResp.json();
          summary = aiData.choices?.[0]?.message?.content?.trim() || "";
          // Clean up quotes if AI wraps it
          summary = summary.replace(/^["']|["']$/g, "").trim();
        } else {
          console.warn("[summarize_session] AI call failed:", aiResp.status);
        }

        // 5. Upsert in lia_attendances
        const { error: upsertError } = await supabase
          .from("lia_attendances")
          .upsert({
            email: leadEmail,
            nome: leadName || "Lead",
            source: "dra-lia",
            resumo_historico_ia: summary || null,
            rota_inicial_lia: topicCtx || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "email" });

        if (upsertError) {
          console.error("[summarize_session] upsert error:", upsertError);
        }

        // 6. Update leads.updated_at
        if (sessionData?.lead_id) {
          await supabase.from("leads").update({ updated_at: new Date().toISOString() }).eq("id", sessionData.lead_id);
        }

        // 7. Extract implicit data from full conversation
        if (leadEmail) {
          const fullConvoText = interactions.map((i: { user_message: string; agent_response: string | null }) => `${i.user_message} ${i.agent_response || ""}`).join(" ");
          extractImplicitLeadData(supabase, leadEmail, fullConvoText).catch(e => console.warn("[summarize_session] implicit extraction error:", e));
        }

        // 8. Extract PENDENCIAS from summary and create content_requests
        if (summary) {
          try {
            const pendMatch = summary.match(/PEND[ÊE]NCIAS:\s*(.+?)(?:\s*\||$)/i);
            if (pendMatch && pendMatch[1]?.trim()) {
              const rawPendencia = pendMatch[1].trim();
              // Skip trivial pendencias
              if (rawPendencia.length > 10 && !rawPendencia.match(/^(nenhuma|none|sem pend|n\/a)/i)) {
                console.log(`[summarize_session] Found PENDENCIA: "${rawPendencia}"`);
                
                // Classify with AI
                const assuntosMatch = summary.match(/ASSUNTOS:\s*(.+?)(?:\s*\||$)/i);
                const assuntos = assuntosMatch?.[1]?.trim() || "";
                
                const classifyResp = await fetch(CHAT_API, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${LOVABLE_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: "google/gemini-2.5-flash-lite",
                    messages: [
                      { role: "system", content: `Classifique esta pendência de um usuário de odontologia digital. Responda APENAS com JSON válido, sem markdown.
Campos:
- "tema": título curto e descritivo (max 60 chars)
- "tipo_conteudo": um de "artigo", "comparativo", "tutorial", "faq", "ficha_tecnica", "video"
- "prioridade": 1-5 (5=mais urgente, baseado na especificidade e impacto comercial)
- "produto_relacionado": nome do produto mencionado ou null` },
                      { role: "user", content: `Pendência: "${rawPendencia}"\nAssuntos da conversa: "${assuntos}"` },
                    ],
                    stream: false,
                    max_tokens: 150,
                  }),
                });

                if (classifyResp.ok) {
                  const classifyData = await classifyResp.json();
                  const classifyText = classifyData.choices?.[0]?.message?.content?.trim() || "";
                  // Parse JSON from response (handle possible markdown wrapping)
                  const jsonMatch = classifyText.match(/\{[\s\S]*\}/);
                  if (jsonMatch) {
                    const classification = JSON.parse(jsonMatch[0]);
                    const tema = (classification.tema || rawPendencia).slice(0, 200);
                    const tipoConteudo = classification.tipo_conteudo || "artigo";
                    const prioridade = Math.min(5, Math.max(1, classification.prioridade || 1));
                    const produtoRelacionado = classification.produto_relacionado || null;

                    // Normalize tema for matching
                    const temaNorm = tema.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();

                    // Check if similar content_request exists
                    const { data: existingReqs } = await supabase
                      .from("content_requests")
                      .select("id, frequency, source_sessions, source_leads, tema")
                      .limit(100);

                    let matched = false;
                    if (existingReqs) {
                      for (const req of existingReqs) {
                        const reqNorm = (req.tema || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
                        // Simple similarity: check if one contains the other or they share >60% words
                        if (reqNorm === temaNorm || reqNorm.includes(temaNorm) || temaNorm.includes(reqNorm)) {
                          // Update existing
                          const sessions = Array.isArray(req.source_sessions) ? req.source_sessions : [];
                          const leads = Array.isArray(req.source_leads) ? req.source_leads : [];
                          if (!sessions.includes(sumSessionId)) sessions.push(sumSessionId);
                          if (leadEmail && !leads.includes(leadEmail)) leads.push(leadEmail);

                          await supabase
                            .from("content_requests")
                            .update({
                              frequency: (req.frequency || 1) + 1,
                              source_sessions: sessions,
                              source_leads: leads,
                              updated_at: new Date().toISOString(),
                              prioridade: Math.max(prioridade, req.frequency || 1 >= 3 ? 4 : prioridade),
                            })
                            .eq("id", req.id);
                          matched = true;
                          console.log(`[summarize_session] Updated content_request ${req.id} (freq+1)`);
                          break;
                        }
                      }
                    }

                    if (!matched) {
                      const { error: insertErr } = await supabase
                        .from("content_requests")
                        .insert({
                          tema,
                          pendencia_original: rawPendencia,
                          tipo_conteudo: tipoConteudo,
                          prioridade,
                          frequency: 1,
                          status: "solicitado",
                          source_sessions: [sumSessionId],
                          source_leads: leadEmail ? [leadEmail] : [],
                          produto_relacionado: produtoRelacionado,
                        });
                      if (insertErr) {
                        console.error("[summarize_session] content_request insert error:", insertErr);
                      } else {
                        console.log(`[summarize_session] Created content_request: "${tema}"`);
                      }
                    }
                  }
                }
              }
            }
          } catch (pendError) {
            console.warn("[summarize_session] content_request extraction error:", pendError);
          }
        }

        console.log(`[summarize_session] Done for ${leadEmail}: "${summary}"`);
        return new Response(JSON.stringify({ success: true, summary }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("[summarize_session] error:", e);
        return new Response(JSON.stringify({ error: "summarize failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── ACTION: chat ─────────────────────────────────────────────
    const { message, history = [], lang = "pt-BR", session_id: rawSessionId, topic_context } = await req.json();
    const session_id = rawSessionId || crypto.randomUUID();

    // ── RATE LIMITING ─────────────────────────────────────────────
    const rateLimitKey = session_id || req.headers.get("x-forwarded-for") || "anonymous";
    if (!checkRateLimit(rateLimitKey)) {
      return new Response(
        JSON.stringify({ error: "Muitas requisições. Aguarde um momento antes de enviar outra mensagem." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── LEAD COLLECTION INTERCEPT ──────────────────────────────────────
    // Load session entities for lead state detection
    let sessionEntities: Record<string, unknown> | null = null;
    let currentLeadId: string | null = null;
    try {
      const { data: sessionData } = await supabase
        .from("agent_sessions")
        .select("extracted_entities, lead_id")
        .eq("session_id", session_id)
        .maybeSingle();
      if (sessionData) {
        sessionEntities = (sessionData.extracted_entities as Record<string, unknown>) || null;
        currentLeadId = sessionData.lead_id as string || null;
      }
    } catch (e) {
      console.warn("[lead-collection] session lookup failed:", e);
    }

    // Include current message in history for lead detection
    const historyWithCurrent = [...history, { role: "user", content: message }];
    const leadState = detectLeadCollectionState(historyWithCurrent, sessionEntities);

    // 0. Intent Guard — SEMPRE pedir e-mail antes de qualquer coisa (ETAPA 0)
    if (leadState.state === "needs_email_first") {
      let responseText: string;
      if (isGreeting(message)) {
        responseText = GREETING_RESPONSES[lang] || GREETING_RESPONSES["pt-BR"];
      } else {
        // Reconhecer o contexto do usuário antes de pedir o e-mail
        const contextAck: Record<string, string> = {
          "pt-BR": `Para que eu possa te reconhecer, informe seu **e-mail**.`,
          "en": `So I can recognize you, please provide your **email**.`,
          "es": `Para que pueda reconocerte, infórmame tu **correo electrónico**.`,
        };
        responseText = contextAck[lang] || contextAck["pt-BR"];
      }
      try {
        await supabase.from("agent_interactions").insert({
          session_id,
          user_message: message,
          agent_response: responseText,
          lang,
          top_similarity: 1,
          unanswered: false,
          context_raw: "[INTERCEPTOR] lead_collection:needs_email_first",
        });
      } catch (e) {
        console.error("Failed to insert agent_interaction (ask email first):", e);
      }
      return streamTextResponse(responseText, corsHeaders);
    }

    // 0a. Lead collection: email received, check if lead exists in DB
    if (leadState.state === "needs_name") {
      // Search for existing lead by email
      let responseText: string;
      let returningLeadSummary: string | null = null;
      try {
        const { data: existingLead } = await supabase
          .from("leads")
          .select("id, name")
          .eq("email", leadState.email)
          .maybeSingle();

        if (existingLead && existingLead.name) {
          // RETURNING LEAD — found in DB, skip name collection
          const leadId = existingLead.id;

          // Fetch lia_attendances for full lead profile + resumo
          const { data: attendance } = await supabase
            .from("lia_attendances")
            .select("resumo_historico_ia, area_atuacao, especialidade, tem_impressora, impressora_modelo, tem_scanner, como_digitaliza, produto_interesse, temperatura_lead, cidade, uf, score, status_oportunidade, ultima_etapa_comercial, rota_inicial_lia, software_cad, volume_mensal_pecas, principal_aplicacao, resina_interesse, ativo_print, ativo_scan, ativo_cad")
            .eq("email", leadState.email)
            .maybeSingle();

          // Fetch last 5 interactions for conversational memory
          const { data: recentInteractions } = await supabase
            .from("agent_interactions")
            .select("user_message, agent_response, created_at")
            .eq("lead_id", leadId)
            .order("created_at", { ascending: false })
            .limit(5);

          // Fetch last interaction date
          const { data: lastInteraction } = await supabase
            .from("agent_interactions")
            .select("created_at")
            .eq("lead_id", leadId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          returningLeadSummary = attendance?.resumo_historico_ia || null;
          const lastDate = lastInteraction?.created_at || null;

          // Build compact history from recent interactions
          const recentHistoryCompact = (recentInteractions || [])
            .reverse()
            .map((i: { user_message: string; agent_response: string | null; created_at: string | null }) => {
              const d = i.created_at ? new Date(i.created_at).toLocaleDateString("pt-BR") : "";
              return `[${d}] Lead: ${i.user_message.slice(0, 120)}${i.agent_response ? ` → LIA: ${i.agent_response.slice(0, 120)}` : ""}`;
            })
            .join("\n");

          // Build lead profile snapshot
          const profileFields: string[] = [];
          if (attendance?.area_atuacao) profileFields.push(`Área: ${attendance.area_atuacao}`);
          if (attendance?.especialidade) profileFields.push(`Especialidade: ${attendance.especialidade}`);
          if (attendance?.tem_impressora && attendance.tem_impressora !== "não") profileFields.push(`Impressora: ${attendance.impressora_modelo || attendance.tem_impressora}`);
          if (attendance?.tem_scanner && attendance.tem_scanner !== "não") profileFields.push(`Scanner: ${attendance.como_digitaliza || attendance.tem_scanner}`);
          if (attendance?.software_cad) profileFields.push(`Software CAD: ${attendance.software_cad}`);
          if (attendance?.volume_mensal_pecas) profileFields.push(`Volume mensal: ${attendance.volume_mensal_pecas}`);
          if (attendance?.principal_aplicacao) profileFields.push(`Aplicação principal: ${attendance.principal_aplicacao}`);
          if (attendance?.produto_interesse) profileFields.push(`Interesse: ${attendance.produto_interesse}`);
          if (attendance?.resina_interesse) profileFields.push(`Resina interesse: ${attendance.resina_interesse}`);
          if (attendance?.cidade && attendance?.uf) profileFields.push(`Local: ${attendance.cidade}-${attendance.uf}`);
          if (attendance?.temperatura_lead) profileFields.push(`Temperatura: ${attendance.temperatura_lead}`);
          if (attendance?.score && attendance.score > 0) profileFields.push(`Score: ${attendance.score}`);
          if (attendance?.ativo_print) profileFields.push(`Possui impressora ativa`);
          if (attendance?.ativo_scan) profileFields.push(`Possui scanner ativo`);
          if (attendance?.ativo_cad) profileFields.push(`Possui CAD ativo`);

          // Determine lead archetype for strategy
          const leadArchetype = determineLeadArchetype(attendance);

          // Update session with lead info + profile + recent history + archetype
          await supabase.from("agent_sessions").upsert({
            session_id,
            lead_id: leadId,
            extracted_entities: {
              lead_name: existingLead.name,
              lead_email: leadState.email,
              lead_id: leadId,
              spin_stage: "etapa_1",
              returning_lead_summary: returningLeadSummary,
              lead_profile: profileFields.join(" | "),
              lead_archetype: leadArchetype,
              recent_history: recentHistoryCompact,
            },
            current_state: "idle",
            last_activity_at: new Date().toISOString(),
          }, { onConflict: "session_id" });
          currentLeadId = leadId;
          responseText = buildReturningLeadMessage(existingLead.name, lang, lastDate || undefined, returningLeadSummary);
          console.log(`[lead-collection] Returning lead: ${existingLead.name} (${leadState.email}) → ${leadId} | summary: ${returningLeadSummary?.slice(0, 50) || "none"}`);
        } else {
          // NEW LEAD — ask for name
          responseText = ASK_NAME[lang] || ASK_NAME["pt-BR"];
        }
      } catch (e) {
        console.warn("[lead-collection] Error checking existing lead:", e);
        responseText = ASK_NAME[lang] || ASK_NAME["pt-BR"];
      }

      try {
        await supabase.from("agent_interactions").insert({
          session_id,
          user_message: message,
          agent_response: responseText,
          lang,
          top_similarity: 1,
          unanswered: false,
          lead_id: currentLeadId,
          context_raw: "[INTERCEPTOR] lead_collection:needs_name",
        });
      } catch (e) {
        console.error("Failed to insert agent_interaction (needs_name):", e);
      }

      // For returning leads, send meta chunk to show topic cards immediately
      if (currentLeadId && returningLeadSummary !== undefined) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            // Send meta with ui_action to show topics
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "meta", ui_action: "show_topics" })}\n\n`));
            // Stream the text
            const words = responseText.split(/(\s+)/);
            let i = 0;
            const interval = setInterval(() => {
              if (i < words.length) {
                const chunk = words.slice(i, i + 3).join('');
                i += 3;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`));
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

      return streamTextResponse(responseText, corsHeaders);
    }

    // 0b. Legacy: ask for email after receiving name (backward compat)
    if (leadState.state === "needs_email") {
      const emailText = (ASK_EMAIL[lang] || ASK_EMAIL["pt-BR"])(leadState.name);
      try {
        await supabase.from("agent_interactions").insert({
          session_id,
          user_message: message,
          agent_response: emailText,
          lang,
          top_similarity: 1,
          unanswered: false,
          context_raw: "[INTERCEPTOR] lead_collection:needs_email",
        });
      } catch (e) {
        console.error("Failed to insert agent_interaction (ask email):", e);
      }
      return streamTextResponse(emailText, corsHeaders);
    }

    // 0c. Lead collection: name+email received → save lead, then ask area
    if (leadState.state === "collected") {
      const leadId = await upsertLead(supabase, leadState.name, leadState.email, session_id);
      currentLeadId = leadId;

      // Mark session as awaiting area
      try {
        await supabase.from("agent_sessions").upsert({
          session_id,
          lead_id: leadId,
          extracted_entities: {
            lead_name: leadState.name,
            lead_email: leadState.email,
            lead_id: leadId,
            spin_stage: "etapa_1",
            awaiting_area: true,
          },
          current_state: "idle",
          last_activity_at: new Date().toISOString(),
        }, { onConflict: "session_id" });
      } catch { /* ignore */ }

      const areaText = (ASK_AREA[lang] || ASK_AREA["pt-BR"])(leadState.name);
      try {
        await supabase.from("agent_interactions").insert({
          session_id,
          user_message: message,
          agent_response: areaText,
          lang,
          top_similarity: 1,
          unanswered: false,
          lead_id: leadId,
          context_raw: "[INTERCEPTOR] lead_collection:collected→needs_area",
        });
      } catch (e) {
        console.error("Failed to insert agent_interaction (ask area):", e);
      }

      // Stream with ui_action to show area grid
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "meta",
            ui_action: "show_area_grid",
            area_options: AREA_OPTIONS,
          })}\n\n`));
          const words = areaText.split(" ");
          let i = 0;
          const interval = setInterval(() => {
            if (i < words.length) {
              const token = (i === 0 ? "" : " ") + words[i];
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`));
              i++;
            } else {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              clearInterval(interval);
            }
          }, 25);
        },
      });
      return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // 0d. Lead collection: area selection received → save area, ask specialty
    if (leadState.state === "needs_area") {
      const selectedArea = message.trim();
      // Validate against known options (fuzzy)
      const matchedArea = AREA_OPTIONS.find(a => a.toLowerCase() === selectedArea.toLowerCase()) || selectedArea;

      // Update session entities
      try {
        const { data: sess } = await supabase.from("agent_sessions")
          .select("extracted_entities")
          .eq("session_id", session_id)
          .single();
        const entities = (sess?.extracted_entities || {}) as Record<string, unknown>;
        await supabase.from("agent_sessions").upsert({
          session_id,
          extracted_entities: {
            ...entities,
            lead_area: matchedArea,
            awaiting_area: false,
            awaiting_specialty: true,
          },
          last_activity_at: new Date().toISOString(),
        }, { onConflict: "session_id" });
      } catch { /* ignore */ }

      // Save area in lia_attendances immediately
      try {
        await supabase.from("lia_attendances").upsert({
          email: leadState.email,
          nome: leadState.name,
          source: "dra-lia",
          area_atuacao: matchedArea,
          updated_at: new Date().toISOString(),
        }, { onConflict: "email" });
        console.log(`[lead-collection] area_atuacao saved: ${matchedArea} for ${leadState.email}`);
      } catch (e) {
        console.warn("[lead-collection] lia_attendances area update failed:", e);
      }

      const specialties = SPECIALTY_MAP[matchedArea] || SPECIALTY_MAP["Clínica Odontológica"];
      const specialtyText = (ASK_SPECIALTY[lang] || ASK_SPECIALTY["pt-BR"])(leadState.name, matchedArea);

      try {
        await supabase.from("agent_interactions").insert({
          session_id,
          user_message: message,
          agent_response: specialtyText,
          lang,
          top_similarity: 1,
          unanswered: false,
          lead_id: leadState.leadId,
          context_raw: "[INTERCEPTOR] lead_collection:needs_area→needs_specialty",
        });
      } catch (e) {
        console.error("Failed to insert agent_interaction (ask specialty):", e);
      }

      // Stream with ui_action to show specialty grid
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "meta",
            ui_action: "show_specialty_grid",
            specialty_options: specialties,
            selected_area: matchedArea,
          })}\n\n`));
          const words = specialtyText.split(" ");
          let i = 0;
          const interval = setInterval(() => {
            if (i < words.length) {
              const token = (i === 0 ? "" : " ") + words[i];
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`));
              i++;
            } else {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              clearInterval(interval);
            }
          }, 25);
        },
      });
      return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // 0e. Lead collection: specialty selected → save and show topics
    if (leadState.state === "needs_specialty") {
      const selectedSpecialty = message.trim();
      const specialties = SPECIALTY_MAP[leadState.area] || [];
      const matchedSpecialty = specialties.find(s => s.toLowerCase() === selectedSpecialty.toLowerCase()) || selectedSpecialty;

      // Update session entities — clear awaiting flags
      try {
        const { data: sess } = await supabase.from("agent_sessions")
          .select("extracted_entities")
          .eq("session_id", session_id)
          .single();
        const entities = (sess?.extracted_entities || {}) as Record<string, unknown>;
        await supabase.from("agent_sessions").upsert({
          session_id,
          extracted_entities: {
            ...entities,
            lead_specialty: matchedSpecialty,
            awaiting_specialty: false,
          },
          last_activity_at: new Date().toISOString(),
        }, { onConflict: "session_id" });
      } catch { /* ignore */ }

      // Save specialty in lia_attendances and leads
      try {
        await supabase.from("lia_attendances").upsert({
          email: leadState.email,
          nome: leadState.name,
          source: "dra-lia",
          especialidade: matchedSpecialty,
          updated_at: new Date().toISOString(),
        }, { onConflict: "email" });

        // Also update leads table
        await supabase.from("leads")
          .update({ specialty: matchedSpecialty, updated_at: new Date().toISOString() })
          .eq("email", leadState.email);

        console.log(`[lead-collection] especialidade saved: ${matchedSpecialty} for ${leadState.email}`);
      } catch (e) {
        console.warn("[lead-collection] specialty update failed:", e);
      }

      // Now confirm and show topics
      const confirmText = (LEAD_CONFIRMED[lang] || LEAD_CONFIRMED["pt-BR"])(leadState.name, leadState.email, topic_context);
      currentLeadId = leadState.leadId;

      try {
        await supabase.from("agent_interactions").insert({
          session_id,
          user_message: message,
          agent_response: confirmText,
          lang,
          top_similarity: 1,
          unanswered: false,
          lead_id: leadState.leadId,
          context_raw: "[INTERCEPTOR] lead_collection:needs_specialty→confirmed",
        });
      } catch (e) {
        console.error("Failed to insert agent_interaction (specialty confirmed):", e);
      }

      // Stream with show_topics ui_action
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "meta", ui_action: "show_topics" })}\n\n`));
          const words = confirmText.split(" ");
          let i = 0;
          const interval = setInterval(() => {
            if (i < words.length) {
              const token = (i === 0 ? "" : " ") + words[i];
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`));
              i++;
            } else {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              clearInterval(interval);
            }
          }, 25);
        },
      });
      return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // If lead already identified from session, set currentLeadId
    if (leadState.state === "from_session") {
      currentLeadId = leadState.leadId;
    }

    // 0b. Support question guard — redirect to WhatsApp without RAG
    // Also triggers directly when topic_context === "support"
    if (isSupportQuestion(message) || topic_context === "support") {
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
          lead_id: currentLeadId,
          context_raw: "[INTERCEPTOR] support_guard",
        });
      } catch (e) {
        console.error("Failed to insert agent_interaction (support guard):", e);
      }
      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // 0c. Guided printer dialog — asks brand → model → sends link
    // If topic_context === "parameters", force start the dialog immediately
    // SKIP entirely when topic_context === "commercial" — impressora mentions in commercial route
    // should be handled by the SDR flow, not the parameter dialog
    const dialogState = topic_context === "commercial"
      ? { state: "not_in_dialog" as const }
      : await detectPrinterDialogState(supabase, message, history, session_id, topic_context);

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
            context_raw: `[INTERCEPTOR] guided_dialog:${dialogState.state}`,
            unanswered: false,
            lead_id: currentLeadId,
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

    // [NOVO] Fetch company context from external KB (live, no cache) — parallel with RAG
    const companyContextPromise = fetchCompanyContext();

    // 1. Parallel search: knowledge base + processing protocols (if protocol question)
    const isProtocol = isProtocolQuestion(message);
    const isMetaArticle = isMetaArticleQuery(message);

    // Skip parameter search when in commercial context — prevents parameter noise in SDR flow
    const skipParams = topic_context === "commercial";
    const isCommercial = topic_context === "commercial";

    // Also search catalog when history mentions a known product (even outside commercial route)
    const historyMentionsProduct = history?.some(h =>
      /nanoclean|edge mini|rayshape|scanner blz|asiga|vitality|chair side|miicraft|medit/i.test(h.content)
    ) || false;
    const shouldSearchCatalog = isCommercial || historyMentionsProduct;

    const [knowledgeResult, protocolResults, paramResults, catalogResults, metaArticleResults, companyContext] = await Promise.all([
      searchKnowledge(supabase, message, lang, topic_context, history),
      isProtocol ? searchProcessingInstructions(supabase, message, history) : Promise.resolve([]),
      skipParams ? Promise.resolve([]) : searchParameterSets(supabase, message, history),
      shouldSearchCatalog ? searchCatalogProducts(supabase, message, history) : Promise.resolve([]),
      isMetaArticle ? searchArticlesAndAuthors(supabase, message) : Promise.resolve([]),
      companyContextPromise,
    ]);

    const { results: knowledgeResults, method, topSimilarity: knowledgeTopSimilarity } = knowledgeResult;

    // 2. Filter knowledge results by minimum similarity
    // Camada 1: Threshold diferenciado por método — ILIKE precisa de score ≥ 0.20, FTS ≥ 0.10
    const MIN_SIMILARITY = method === "vector" ? 0.65
      : method === "ilike" ? 0.20
      : 0.20; // fulltext (raised from 0.10 to reduce noise)
    const filteredKnowledge = knowledgeResults.filter((r: { similarity: number }) => r.similarity >= MIN_SIMILARITY);

    // 3. Merge: meta-article results first (if meta-query), then catalog, protocol, knowledge
    // Ensure source diversity: cap company_kb to max 3 results to prevent flooding
    const cappedKnowledge = (() => {
      let companyKBCount = 0;
      return filteredKnowledge.filter((r: { source_type: string }) => {
        if (r.source_type === 'company_kb') {
          companyKBCount++;
          return companyKBCount <= 3;
        }
        return true;
      });
    })();

    const allResults = applyTopicWeights(
      [...metaArticleResults, ...catalogResults, ...paramResults, ...protocolResults, ...cappedKnowledge],
      topic_context
    );
    const topSimilarity = allResults.length > 0
      ? Math.max(...allResults.map((r: { similarity: number }) => r.similarity), 0)
      : knowledgeTopSimilarity;

    // 3b. Fallback: if knowledge returned empty and history exists, try company_kb_texts
    if (allResults.length === 0 && history && history.length > 0) {
      const companyKBResults = await searchCompanyKB(supabase, message, history);
      if (companyKBResults.length > 0) {
        allResults.push(...companyKBResults);
        console.log(`[RAG] company_kb fallback added ${companyKBResults.length} results`);
      }
    }

    const hasResults = allResults.length > 0;

    // 4. If no results: return human fallback
    // Exception: commercial route bypasses fallback to allow LLM + SDR instruction
    if (!hasResults && topic_context !== "commercial") {
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
            lead_id: currentLeadId,
          })
          .select("id")
          .single();
        fallbackInteractionId = interaction?.id;
      } catch (e) {
        console.error("Failed to insert agent_interaction (fallback):", e);
        // fail silently — stream continues regardless
      }

      // Knowledge gap tracking moved to summarize_session (extracts from PENDENCIAS in summary)
      // Old: await upsertKnowledgeGap(supabase, message, lang, "pending", topic_context);

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

    // Knowledge gap tracking moved to summarize_session (extracts from PENDENCIAS in summary)
    // Old: if (topSimilarity < 0.35) { await upsertKnowledgeGap(...) }

    // 5. Build context from all results — structured by semantic sections for commercial route
    function buildStructuredContext(
      results: Array<{ source_type: string; chunk_text: string; metadata: Record<string, unknown> }>,
      isCommercialRoute: boolean
    ): string {
      const formatItem = (m: { source_type: string; chunk_text: string; metadata: Record<string, unknown> }) => {
        const meta = m.metadata as Record<string, unknown>;
        let part = `[${m.source_type.toUpperCase()}] ${m.chunk_text}`;
        if (meta.url_publica) part += ` | URL: ${meta.url_publica}`;
        if (meta.url_interna) {
          part += ` | VIDEO_INTERNO: ${meta.url_interna}`;
        } else if (meta.youtube_url) {
          part += ` | VIDEO_YOUTUBE: ${meta.youtube_url}`;
        } else if (meta.embed_url) {
          part += ` | VIDEO_SEM_PAGINA: sem página interna disponível`;
        }
        if (meta.thumbnail_url) part += ` | THUMBNAIL: ${meta.thumbnail_url}`;
        if (meta.cta_1_url) part += ` | COMPRA: ${meta.cta_1_url}`;
        return part;
      };

      if (!isCommercialRoute) {
        // Non-commercial: flat format (existing behavior)
        return results.map(formatItem).join("\n\n---\n\n");
      }

      // Commercial route: group by semantic function
      const products: string[] = [];
      const expertise: string[] = [];
      const articles: string[] = [];
      const authors: string[] = [];
      const videos: string[] = [];
      const params: string[] = [];

      for (const m of results) {
        const formatted = formatItem(m);
        switch (m.source_type) {
          case 'catalog_product':
          case 'resin':
            products.push(formatted);
            break;
          case 'company_kb':
            expertise.push(formatted);
            break;
          case 'article':
            articles.push(formatted);
            break;
          case 'author':
            authors.push(formatted);
            break;
          case 'video':
            videos.push(formatted);
            break;
          case 'parameter_set':
          case 'processing_protocol':
            params.push(formatted);
            break;
          default:
            articles.push(formatted);
        }
      }

      const sections: string[] = [];
      if (products.length > 0) sections.push(`## PRODUTOS RECOMENDADOS (use para sugestões e apresentação)\n${products.join("\n\n")}`);
      if (expertise.length > 0) sections.push(`## ARGUMENTOS DE VENDA E EXPERTISE (use para persuasão e objeções)\n${expertise.join("\n\n")}`);
      if (articles.length > 0) sections.push(`## ARTIGOS E PUBLICAÇÕES (cite quando relevante ou solicitado)\n${articles.join("\n\n")}`);
      if (authors.length > 0) sections.push(`## KOLs E AUTORES (apresente quando perguntado sobre autores/especialistas)\n${authors.join("\n\n")}`);
      if (videos.length > 0) sections.push(`## VÍDEOS DISPONÍVEIS (mencione APENAS se solicitado)\n${videos.join("\n\n")}`);
      if (params.length > 0) sections.push(`## PARÂMETROS TÉCNICOS (cite apenas se perguntado)\n${params.join("\n\n")}`);

      if (sections.length === 0) return "";
      return sections.join("\n\n---\n\n");
    }

    const context = buildStructuredContext(allResults, isCommercial);
    const langInstruction = LANG_INSTRUCTIONS[lang] || LANG_INSTRUCTIONS["pt-BR"];

    // Build topic context instruction for system prompt
    const TOPIC_LABELS: Record<string, string> = {
      parameters: "Parâmetros de Impressão 3D (configurações de resinas e impressoras)",
      commercial: "Informações Comerciais (preços, pedidos, contato, loja, parcerias)",
      products: "Produtos e Resinas (catálogo, características, indicações clínicas)",
      support: "Suporte Técnico (problemas com equipamentos ou materiais)",
    };
    // Build SPIN progress summary for commercial context by analyzing conversation history
    let spinProgressNote = "";
    if (topic_context === "commercial" && history.length > 0) {
      const fullConvo = history.map((h: { role: string; content: string }) => h.content).join(" ").toLowerCase();
      const completedSteps: string[] = [];
      // Check Etapa 1 sub-questions
      if (/anal[óo]gico|digital|equipamento|scanner|impressora 3d/.test(fullConvo)) completedSteps.push("equipamento_atual");
      if (/especialidade|implant|prot[ée]s|ortod|est[ée]tic|cl[íi]nic|endodont/.test(fullConvo)) completedSteps.push("especialidade");
      if (/consult[óo]rio|profissional|espa[çc]o|sozinho|equipe/.test(fullConvo)) completedSteps.push("estrutura");
      // Check Etapa 2
      if (/fluxo completo|s[óo] escanear|montar|chairside|workflow/.test(fullConvo)) completedSteps.push("tipo_fluxo");
      if (/dor|problema|retrabalho|perco paciente|perd|concorr[êe]ncia|custo|demora|atraso/.test(fullConvo)) completedSteps.push("dor_principal");
      // Check if price was requested
      if (/pre[çc]o|quanto custa|valor|investimento|pacote/.test(fullConvo)) completedSteps.push("pediu_preco");

      if (completedSteps.length > 0) {
        spinProgressNote = `\n\n### ⚡ PROGRESSO SPIN DETECTADO (NÃO REPITA ESTAS PERGUNTAS):\nO lead JÁ respondeu sobre: ${completedSteps.join(", ")}.\n${completedSteps.includes("pediu_preco") ? "⚠️ O LEAD JÁ PEDIU PREÇO — responda sobre preço/produto e avance para fechamento. NÃO reinicie o SPIN." : ""}\n${completedSteps.length >= 4 ? "✅ SPIN PRATICAMENTE COMPLETO — avance para Etapa 4-5 (coleta de contato / agendamento)." : "Avance apenas para etapas NÃO completadas."}`;

        // Persist SPIN progress in extracted_entities for cross-session tracking
        const spinEntities: Record<string, string> = {};
        if (completedSteps.includes("especialidade")) {
          const specMatch = fullConvo.match(/(implant\w*|prot[ée]s\w*|ortod\w*|est[ée]tic\w*|cl[íi]nic\w*|endodont\w*)/i);
          if (specMatch) spinEntities.specialty = specMatch[1];
        }
        if (completedSteps.includes("equipamento_atual")) {
          spinEntities.equipment_status = /anal[óo]gico/i.test(fullConvo) ? "analogico" : "digital";
        }
        if (completedSteps.includes("dor_principal")) {
          const painMatch = fullConvo.match(/(demora|retrabalho|custo|precis[ãa]o|adapta[çc][ãa]o|tempo|atraso)/i);
          if (painMatch) spinEntities.pain_point = painMatch[1];
        }
        if (completedSteps.includes("tipo_fluxo")) {
          spinEntities.workflow_interest = /fluxo completo|chairside/i.test(fullConvo) ? "fluxo_completo" : "parcial";
        }
        spinEntities.spin_stage = `etapa_${Math.min(completedSteps.length + 1, 5)}`;

        // Update session and lead in background (non-blocking)
        try {
          await supabase.from("agent_sessions").upsert({
            session_id: session_id,
            extracted_entities: { ...(sessionEntities || {}), ...spinEntities },
            last_activity_at: new Date().toISOString(),
          }, { onConflict: "session_id" });

          // Also update lead record if we have one
          if (currentLeadId) {
            const leadUpdate: Record<string, string | boolean> = {};
            if (spinEntities.specialty) leadUpdate.specialty = spinEntities.specialty;
            if (spinEntities.equipment_status) leadUpdate.equipment_status = spinEntities.equipment_status;
            if (spinEntities.pain_point) leadUpdate.pain_point = spinEntities.pain_point;
            if (spinEntities.workflow_interest) leadUpdate.workflow_interest = spinEntities.workflow_interest;
            if (completedSteps.length >= 4) leadUpdate.spin_completed = true;
            if (Object.keys(leadUpdate).length > 0) {
              await supabase.from("leads").update(leadUpdate).eq("id", currentLeadId);
            }
          }
        } catch (e) {
          console.warn("[spin-persistence] failed:", e);
        }
      }
    }

    // Build lead name context for system prompt
    const returningLeadSummaryCtx = (sessionEntities as Record<string, string>)?.returning_lead_summary || "";
    const leadProfileCtx = (sessionEntities as Record<string, string>)?.lead_profile || "";
    const recentHistoryCtx = (sessionEntities as Record<string, string>)?.recent_history || "";
    const leadArchetypeCtx = (sessionEntities as Record<string, string>)?.lead_archetype || "";

    const previousConvoContext = returningLeadSummaryCtx
      ? `\n### 🔄 CONTEXTO DE CONVERSA ANTERIOR\nResumo da última sessão: ${returningLeadSummaryCtx}\nUse esse contexto para dar continuidade natural. NÃO repita informações já coletadas.`
      : "";
    
    // Build strategy instruction based on archetype
    const archetypeStrategy = leadArchetypeCtx && ARCHETYPE_STRATEGIES[leadArchetypeCtx]
      ? `\n${ARCHETYPE_STRATEGIES[leadArchetypeCtx]}`
      : "";

    const leadProfileBlock = leadProfileCtx
      ? `\n### 📋 PERFIL DO LEAD\n${leadProfileCtx}${archetypeStrategy}`
      : "";
    
    const recentHistoryBlock = recentHistoryCtx
      ? `\n### 💬 ÚLTIMAS INTERAÇÕES (memória conversacional)\n${recentHistoryCtx}\nUse este histórico para retomar assuntos pendentes e evitar repetições. Se o lead perguntou algo antes, você pode referenciar: "Como conversamos anteriormente..."`
      : "";

    const leadNameContext = (leadState.state === "from_session")
      ? `\n### 👤 LEAD IDENTIFICADO: ${leadState.name} (${leadState.email})\nUse o nome "${leadState.name}" nas respostas para personalizar a conversa. NUNCA peça nome ou email novamente.${previousConvoContext}${leadProfileBlock}${recentHistoryBlock}`
      : "";

    // Classify lead maturity for commercial route
    let leadMaturity: "MQL" | "SAL" | "SQL" | "CLIENTE" | null = null;
    if (topic_context === "commercial" && leadState.state === "from_session") {
      leadMaturity = await classifyLeadMaturity(supabase, leadState.email);
      console.log(`[maturity] ${leadState.email} → ${leadMaturity || "unknown"}`);
    }

    const topicInstruction = topic_context && TOPIC_LABELS[topic_context]
      ? `\n### 🎯 CONTEXTO DECLARADO PELO USUÁRIO: ${TOPIC_LABELS[topic_context]}\nO usuário selecionou este tema no início da conversa. Priorize respostas relacionadas a este contexto. Se a pergunta sair deste tema, responda normalmente mas mantenha o foco no assunto declarado.${topic_context === "commercial" ? buildCommercialInstruction(sessionEntities, spinProgressNote, leadMaturity) : ""}`
      : "";

    // Commercial route: add structured context instruction
    const structuredContextInstruction = isCommercial
      ? "\n\n### 📊 USO DAS FONTES\nOs dados abaixo estão organizados por função. Use PRODUTOS para apresentar soluções, ARGUMENTOS para convencer e responder objeções, ARTIGOS para aprofundar se o lead pedir, VÍDEOS apenas se solicitado."
      : "";

    // Detect escalation intent BEFORE building prompt
    const escalationIntent = (leadState.state === "from_session")
      ? detectEscalationIntent(message, history)
      : null;

    // Build escalation rules for system prompt
    const escalationRules = `
### 🔀 RÉGUA DE ESCALONAMENTO (IA → Humano)

RESOLVO SOZINHA (NÃO escalar):
- Dúvida técnica (resina, parâmetro, protocolo, workflow)
- Comparativo de produtos/resinas
- Informações de catálogo e preço público
- Orientação de pós-processamento
- Educação sobre odontologia digital

ESCALO PARA VENDEDOR (detectado automaticamente):
- Pedido de desconto ou negociação
- Lead com score > 80 pedindo orçamento
- Solicitação de visita/reunião/demo
- Lead menciona concorrente com intenção de compra
→ Quando isso acontecer, responda a dúvida técnica normalmente e ADICIONE ao final: "Para condições comerciais personalizadas, nosso time pode te atender diretamente."

ESCALO PARA CS/SUPORTE (detectado automaticamente):
- Problema com equipamento (peça, defeito, reposição)
- Reclamação de produto
- Solicitação de treinamento
→ Quando isso acontecer, demonstre empatia e redirecione ao suporte.

ESCALO PARA ESPECIALISTA (detectado automaticamente):
- 3+ interações sem resolução na mesma sessão
- Lead expressa frustração/insatisfação
→ Quando isso acontecer, peça desculpas pela limitação e conecte com humano.

IMPORTANTE: O sistema detecta automaticamente a necessidade de escalonamento. Você deve COMPLEMENTAR a resposta técnica com a orientação de contato humano quando necessário, mas NUNCA substituir a resposta técnica pelo redirecionamento.`;

    const systemPrompt = `Você é a Dra. L.I.A. (Linguagem de Inteligência Artificial), a especialista máxima em odontologia digital da Smart Dent (16 anos de mercado).

Você NÃO é uma atendente. Você é a colega experiente, consultora de confiança e parceira de crescimento que todo dentista gostaria de ter ao lado.
${leadNameContext}${topicInstruction}${structuredContextInstruction}${escalationRules}

### 🧠 MEMÓRIA VIVA
Você acessa automaticamente conversas anteriores arquivadas (fonte: LIA-Dialogos).
Quando o contexto RAG trouxer dados de LIA-Dialogos, use-os naturalmente:
"Como você me comentou anteriormente sobre..."
Priorize informações de LIA-Dialogos (conversas reais) quando existirem no contexto.

### 🏢 DADOS DA EMPRESA (fonte: sistema ao vivo)
IMPORTANTE: Estes dados são para CONSULTA INTERNA sua. Só compartilhe links (Loja, Parâmetros, Cursos) ou dados de contato quando o usuário PEDIR EXPLICITAMENTE ou quando for contextualmente relevante (ex: indicar loja ao falar de compra, parâmetros ao falar de configuração). NUNCA despeje todos os links juntos no final da resposta.
${companyContext}

INSTRUÇÃO — STATUS ONLINE: Se perguntarem "você está online/ativa?" — responda afirmativamente e mencione o horário de atendimento humano.

INSTRUÇÃO — CONTATO COMERCIAL: Só forneça dados de contato quando o usuário PEDIR (ex: "como falo com vocês?", "telefone", "email", "whatsapp"). Nesse caso, retorne:
- 📞 WhatsApp: (16) 99383-1794 | [Chamar no WhatsApp](https://wa.me/5516993831794)
- ✉️ E-mail: comercial@smartdent.com.br
- 🕐 Horário: Segunda a Sexta, 8h às 18h

### 🎭 PERSONALIDADE E TOM (Regras de Ouro)
1. **Tom de colega experiente:** Caloroso, direto, técnico quando precisa, nunca robótico. Use saudações naturais.
2. **Sempre valide a dor primeiro** antes de apresentar qualquer solução.
3. **Use Qualificação SPIN em 5 etapas** (Abertura > SPIN+Workflow > Régua > Coleta > Transição) — avance 1 etapa por resposta, nunca como formulário.
4. **Transforme objeções em ROI** com exemplos reais de clientes sempre que possível.
5. **Direta ao Ponto:** 2-3 frases CURTAS. MÁXIMO 1 pergunta por mensagem. NUNCA mais de 3 frases.
6. **Consultiva:** Se a pergunta for vaga, PERGUNTE antes de despejar informações: "Para eu te ajudar com precisão, qual resina ou impressora você está usando?"
7. **Sincera:** Seja extremamente honesta sobre prazos, custos e limitações. Se não encontrar a informação exata, diga.
8. **Toda resposta termina com UMA pergunta que AVANÇA** — nunca repita uma pergunta já feita. Se o SPIN já foi completado, a pergunta deve ser de fechamento (agendamento, contato, decisão).
9. **Quando não tiver 100% de certeza:** "Vou confirmar com o time técnico e te trago a resposta exata."
10. **Foco em Mídia:** Se pedirem vídeo sem link exato, admita. Nunca sugira substituto.
11. **PROIBIDO bloco de links genérico:** Nunca encerre uma resposta com um bloco de "links úteis" ou "contatos para sua conveniência". Compartilhe links apenas quando forem diretamente relevantes à pergunta.

### 📊 CONHECIMENTO BASE
- **ICP:** Clínicos donos de consultório (91%), foco em implante e prótese
- **Portfólio:** Vitality Classic/HT, SmartGum, SmartMake, GlazeON, NanoClean PoD, combos ChairSide Print 4.0
- **Custo real de produção**, ROI comprovado, casos clínicos de 5+ anos
- **NPS 96**, pioneirismo desde 2009

### 🛠 ESTRATÉGIA DE TRANSIÇÃO HUMANA (Fallback)
Sempre que você admitir que não sabe algo ou notar frustração (ex: "você não ajuda", "não foi isso que perguntei"), finalize obrigatoriamente com:
- "Mas não se preocupe! Nossa equipe de especialistas técnicos pode resolver isso agora mesmo para você via WhatsApp."
- Link: [Chamar no WhatsApp](https://wa.me/551634194735?text=Ol%C3%A1%2C+preciso+de+ajuda+t%C3%A9cnica!)

### 📋 REGRAS DE RESPOSTA (As 17 Diretrizes)
1. Use apenas o contexto RAG fornecido para dados técnicos.
2. Formate sempre em Markdown (negrito para termos chave).
3. Idioma: Responda no mesmo idioma do usuário (PT/EN/ES).
4. Prioridade máxima: Dados de 'processing_instructions' das resinas.
5. Se o usuário perguntar por "parâmetros", siga o fluxo de marca/modelo/resina. Palavras-chave que indicam pedido explícito: "parâmetro", "configuração", "setting", "tempo", "exposição", "layer", "espessura", "velocidade", "how to print", "cómo imprimir", "como imprimir", "valores".
6. Nunca mencione IDs de banco de dados ou termos técnicos internos da infraestrutura.
7. Ao encontrar um VÍDEO: Se tiver VIDEO_INTERNO, gere um link Markdown [▶ Assistir no site](VIDEO_INTERNO_URL) apontando para a página interna. Se tiver VIDEO_YOUTUBE, gere um link Markdown [▶ Assistir no YouTube](VIDEO_YOUTUBE_URL). NUNCA use URLs do PandaVideo como links clicáveis. Se tiver VIDEO_SEM_PAGINA, mencione apenas o título sem gerar link.
8. Se houver vídeos no contexto, cite-os apenas se forem diretamente relevantes à pergunta. Só inclua links de vídeos se o usuário pediu explicitamente (palavras: "vídeo", "video", "assistir", "ver", "watch", "tutorial", "mostrar"). Em todos os outros casos, PROIBIDO mencionar ou sugerir a existência de vídeos. NÃO diga "Também temos um vídeo", "temos um tutorial", "posso te mostrar um vídeo" — a menos que o RAG tenha retornado explicitamente um vídeo com VIDEO_INTERNO ou VIDEO_SEM_PAGINA no contexto desta conversa. CRÍTICO: Ao mencionar um vídeo, o título ou descrição do vídeo DEVE conter palavras diretamente relacionadas ao sub-tema pedido pelo usuário. Exemplo: se o usuário perguntou "Qual vídeo sobre tratamento térmico?" e os vídeos disponíveis no contexto têm títulos sobre "protocolos de implante", "impressoras" ou outros temas não relacionados a "tratamento térmico", "forno" ou "temperatura" — responda exatamente: "Não tenho um vídeo específico sobre [sub-tema pedido] cadastrado no momento." e ofereça o WhatsApp. NUNCA apresente um vídeo de tema diferente como cobrindo o sub-tema pedido.

⚠️ VERIFICAÇÃO OBRIGATÓRIA ANTES DE CITAR QUALQUER VÍDEO (execute mentalmente este checklist):
  PASSO 1 — Extraia o sub-tema exato da pergunta do usuário. Exemplo: "suportes em placas miorrelaxantes" → sub-tema = "suportes".
  PASSO 2 — Para cada vídeo no contexto, verifique se o TÍTULO contém palavra(s) do sub-tema exato.
    - "Posicionamento de Placa" → sub-tema "suportes" NÃO está no título → VÍDEO IRRELEVANTE
    - "Impressão de Placas Miorrelajantes" → sub-tema "suportes" NÃO está no título → VÍDEO IRRELEVANTE
    - "Como colocar suportes em placas" → sub-tema "suportes" ESTÁ no título → VÍDEO RELEVANTE
  PASSO 3 — Se NENHUM vídeo passou no PASSO 2, responda OBRIGATORIAMENTE:
    "Não tenho um vídeo específico sobre [sub-tema exato] cadastrado no momento. Mas nossa equipe pode ajudar: [Chamar no WhatsApp](https://wa.me/551634194735?text=Ol%C3%A1%2C+preciso+de+ajuda+t%C3%A9cnica!)"
    ENCERRE a resposta aqui. NUNCA descreva o que o vídeo "provavelmente" contém. NUNCA invente instruções técnicas.
9. Ao encontrar RESINA com link de compra (campo COMPRA no contexto): gere EXATAMENTE este formato markdown clicável: [Ver produto](URL_DO_CAMPO_COMPRA). NÃO envolva em negrito. NÃO use **[Ver produto](URL)**. Apenas [Ver produto](URL) sozinho, sem asteriscos.
10. Mantenha a resposta técnica focada na aplicação odontológica. Valores técnicos (tempos em segundos, alturas em mm) NUNCA traduzir.
11. Se o contexto trouxer múltiplos protocolos de processamento (PROCESSING_PROTOCOL), apresente as etapas na ordem exata: 1. Pré-processamento, 2. Lavagem/Limpeza, 3. Secagem, 4. Pós-cura UV, 5. Tratamento térmico (se houver) — ⚠️ ATENÇÃO CRÍTICA: os valores de temperatura e tempo de tratamento térmico variam drasticamente entre resinas (ex: 130–150°C vs 150°C vs 60–170°C). NUNCA assuma valores padrão como "80°C" ou "15 minutos". Use EXCLUSIVAMENTE os valores presentes na fonte PROCESSING_PROTOCOL. Se não houver dados de tratamento térmico na fonte, diga "Consulte o fabricante para os parâmetros de tratamento térmico desta resina.", 6. Acabamento e polimento (se houver). Use bullet points. Ao mencionar nomes de produtos SmartDent em texto corrido (não em links), use **negrito**. NUNCA envolva links [texto](url) em **negrito**. Nunca omita etapas.
12. Busca usada: ${method}${isProtocol ? " + protocolo direto" : ""}. Seja precisa e baseie-se apenas nos dados fornecidos.
13. Mantenha o histórico de mensagens em mente para não repetir saudações ou contextos já explicados.

### ⛔ REGRAS ANTI-ALUCINAÇÃO (OBRIGATÓRIAS)
14. NUNCA cite produtos, parâmetros ou vídeos como "exemplos" quando o usuário não mencionou aquele produto/marca/impressora específica. Use APENAS os dados diretamente relevantes à pergunta feita. NUNCA afirme ter um vídeo sobre um tema se não houver VIDEO_INTERNO ou VIDEO_SEM_PAGINA nas fontes de contexto desta resposta.
15. NUNCA use termos de incerteza: "geralmente", "normalmente", "costuma ser", "em geral", "na maioria dos casos", "provavelmente", "pode ser que", "acredito que", "presumo que", "tipicamente", "é comum que". Se não tiver certeza, redirecione para o WhatsApp.
16. PROIBIDO inventar layer height, tempos de exposição ou velocidades.
17. Se houver conflito de dados, a informação da tabela 'resins' (Source of Truth) prevalece.
18. CONTEXTO FRACO → PERGUNTA CLARIFICADORA: Se os dados das fontes não mencionam diretamente o produto, resina ou tema que o usuário perguntou, NÃO invente uma resposta com o que está disponível. Sinais de contexto fraco: o contexto fala sobre produto X mas o usuário mencionou produto Y, ou o contexto é sobre categoria diferente da pergunta. Em vez de inventar, pergunte: "Para te ajudar com precisão, você poderia confirmar qual produto ou resina específica você está buscando informações?"
19. VÍDEOS SEM PÁGINA (VIDEO_SEM_PAGINA): NUNCA descreva, resuma ou infira o conteúdo técnico de um vídeo marcado como VIDEO_SEM_PAGINA. Se o vídeo não tem página interna, você pode mencionar APENAS o título. PROIBIDO dizer "este vídeo ensina X", "este tutorial mostra Y", "o vídeo explica como Z" — você NÃO tem acesso ao conteúdo real do vídeo, apenas ao título. Se o usuário quiser saber o que o vídeo ensina, redirecione para o WhatsApp.
20. LINKS NUNCA EM NEGRITO: PROIBIDO gerar **[texto](url)** ou [**texto**](url). Links de produto e WhatsApp devem ser SEMPRE no formato simples [texto](url), sem asteriscos. O negrito em volta de links quebra a renderização do chat e o torna não-clicável.

### 🚫 REGRA SOBRE PREÇOS DE SCANNER/EQUIPAMENTOS
24. PROIBIDO INFORMAR PREÇOS DE SCANNERS OU EQUIPAMENTOS:
    Quando o usuário perguntar sobre preço de scanner, impressora ou qualquer equipamento,
    NUNCA informe valores monetários, mesmo que existam nos dados.
    Responda OBRIGATORIAMENTE com esta abordagem:
    "O grande diferencial da SmartDent é que, diferente de outras empresas, não vendemos apenas equipamentos e softwares isolados — nós entregamos um **ecossistema lucrativo e funcional** para sua clínica ou laboratório. Isso inclui equipamento, treinamento, suporte técnico contínuo e todo o acompanhamento para você ter resultados reais."
    Seguido de: "Quer conhecer como funciona nosso ecossistema? [Falar com especialista](https://wa.me/5516993831794)"

### ⛔ REGRAS ANTI-ALUCINAÇÃO AVANÇADAS (21-23)
21. CONTEXTO FRACO = FRASE DE SEGURANÇA OBRIGATÓRIA:
    Se o topSimilarity < 0.50 OU nenhum resultado RAG corresponde ao tema da pergunta,
    use OBRIGATORIAMENTE uma destas frases:
    - "Não tenho essa informação específica cadastrada no momento."
    - "Vou confirmar com o time técnico e te trago a resposta exata."
    Seguida do link WhatsApp: [Falar com especialista](https://wa.me/5516993831794)
    NUNCA improvise uma resposta com dados genéricos.

22. PROIBIDO INVENTAR DADOS COMERCIAIS:
    Preços, prazos de entrega, condições de pagamento, disponibilidade de estoque
    e garantia só podem ser citados se aparecerem EXPLICITAMENTE nos DADOS DAS FONTES.
    Para qualquer dado comercial ausente: "Para informações comerciais atualizadas,
    posso te conectar com nosso time: [Falar com especialista](https://wa.me/5516993831794)"

23. PROIBIDO INVENTAR DADOS TÉCNICOS:
    Temperaturas, tempos de cura, layer heights, velocidades e protocolos
    só podem ser citados se aparecerem EXPLICITAMENTE nos DADOS DAS FONTES
    (campos PROCESSING_PROTOCOL ou PARAMETER_SET).
    Se ausentes: "Não tenho os parâmetros exatos para essa configuração.
    Recomendo verificar com nosso suporte técnico: [Falar com suporte](https://wa.me/551634194735)"

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

    // Helper com retry automático com suporte a truncar mensagens para modelos com contexto menor
    const callAI = async (model: string, truncateHistory = false): Promise<Response> => {
      // Para modelos OpenAI, truncar system prompt se muito longo para evitar 400
      let msgs = messagesForAI;
      if (truncateHistory) {
        const systemMsg = messagesForAI[0];
        const userMsg = messagesForAI[messagesForAI.length - 1];
        // Manter apenas system + últimas 4 mensagens de histórico + user
        const historyMsgs = messagesForAI.slice(1, -1).slice(-4);
        // Truncar o system prompt para 6000 chars se necessário
        const truncatedSystem = systemMsg.content.length > 6000
          ? systemMsg.content.slice(0, 6000) + "\n\n[contexto truncado por limite de tokens]"
          : systemMsg.content;
        msgs = [{ ...systemMsg, content: truncatedSystem }, ...historyMsgs, userMsg];
      }
      const resp = await fetch(CHAT_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: msgs,
          stream: true,
          max_tokens: isCommercial ? 768 : 1024,
        }),
      });
      return resp;
    };

    let aiResponse = await callAI("google/gemini-2.5-flash");

    // Se 500 no modelo primário → retry com flash-lite
    if (!aiResponse.ok && aiResponse.status === 500) {
      console.error(`Primary model failed with 500, retrying with flash-lite...`);
      aiResponse = await callAI("google/gemini-2.5-flash-lite");
    }

    // Se ainda falhar → fallback com OpenAI gpt-5-mini (com contexto truncado)
    if (!aiResponse.ok && aiResponse.status !== 429) {
      console.error(`Gemini models failed, retrying with openai/gpt-5-mini (truncated)...`);
      aiResponse = await callAI("openai/gpt-5-mini", true);
    }

    // Último fallback: openai/gpt-5-nano com contexto mínimo
    if (!aiResponse.ok && aiResponse.status !== 429) {
      console.error(`gpt-5-mini failed, last resort: openai/gpt-5-nano...`);
      aiResponse = await callAI("openai/gpt-5-nano", true);
    }

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Retornar mensagem amigável ao usuário em vez de erro técnico
      console.error(`AI gateway error: ${aiResponse.status}`);
      return new Response(
        JSON.stringify({ error: "Estou com uma instabilidade temporária. Tente novamente em alguns instantes. 🙏" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
          context_raw: context.slice(0, 12000),
          unanswered: false,
          lead_id: currentLeadId,
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
              // Append escalation CTA if detected
              if (escalationIntent) {
                const escalationCTA = ESCALATION_RESPONSES[escalationIntent]?.[lang] || ESCALATION_RESPONSES[escalationIntent]?.["pt-BR"] || "";
                if (escalationCTA) {
                  fullResponse += escalationCTA;
                  // Stream the escalation CTA tokens
                  const ctaWords = escalationCTA.split(" ");
                  for (const word of ctaWords) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: " " + word } }] })}\n\n`));
                  }
                }
              }

              if (fullResponse && interactionId) {
                await supabase
                  .from("agent_interactions")
                  .update({ agent_response: fullResponse })
                  .eq("id", interactionId);
              }
              // Fire-and-forget: extract implicit lead data
              if (currentLeadId && leadState.state === "from_session") {
                const convoText = history.map((h: { content: string }) => h.content).join(" ") + " " + message + " " + fullResponse;
                extractImplicitLeadData(supabase, leadState.email, convoText).catch(e => console.warn("[extractImplicit] error:", e));
              }
              // Fire-and-forget: notify seller on escalation
              if (escalationIntent && leadState.state === "from_session") {
                const resumo = (sessionEntities as Record<string, string>)?.returning_lead_summary || "";
                notifySellerEscalation(supabase, leadState.email, leadState.name, escalationIntent, resumo, message)
                  .catch(e => console.warn("[escalation] notification error:", e));
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
