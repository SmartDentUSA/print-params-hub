/**
 * Padrão único de formatação e FAQ dos conteúdos da Base de Conhecimento.
 *
 * Antes, a formatação "bonita" só existia dentro de reformat-article-html e era
 * aplicada manualmente pelo Admin. Agora esse padrão vive aqui e é reaproveitado
 * por: reformat-article-html, knowledge-content-modernize e pelos pipelines de
 * publicação (depoimentos + copiloto), de modo que conteúdo novo já nasce no
 * formato final e o legado é normalizado no mesmo molde.
 */

export const STANDARD_FORMAT_PROMPT = `Você é um especialista em reformatar HTML mal estruturado de artigos técnicos sobre odontologia digital.

SEU TRABALHO:
1. **Detectar tabelas em texto corrido** → Converter para HTML <table> semântico
2. **Melhorar estrutura de headings** → Garantir hierarquia H2/H3/H4 lógica
3. **Preservar TODO o conteúdo original** → Não remover nada, apenas reestruturar

═══════════════════════════════════════════════════════════
🚫 REGRAS ANTI-ALUCINAÇÃO (PRIORIDADE MÁXIMA)
═══════════════════════════════════════════════════════════

❌ NÃO adicione links que não existam no HTML original
❌ NÃO crie links internos para produtos, resinas ou equipamentos
❌ NÃO invente dados que não existam no texto original
❌ NÃO adicione conteúdo novo, apenas reorganize o existente
❌ NÃO adicione CTAs ou chamadas para ação não presentes no original

✅ Preserve TODOS os links existentes no HTML original
✅ Preserve blocos <script type="application/ld+json"> exatamente como estão
✅ Apenas reestruture tabelas, headings e formatação
✅ Mantenha TODO o texto original intacto

REGRAS DE FORMATAÇÃO:
- Use SEMPRE classes Tailwind para estilização
- Tabelas devem usar: <table class="w-full border-collapse my-6"><thead><tr><th class="border border-border p-3 bg-muted text-left font-semibold">...
- Headings: <h2 class="text-2xl font-bold mt-8 mb-4">...</h2>
- Se houver listas (bullets, numeradas), use <ul class="list-disc pl-6 my-4"> ou <ol>
- Preserve TODOS os parágrafos <p class="mb-4">
- Se houver URLs em texto plano (ex: https://... ou http://...) que NAO estejam dentro de uma tag <a>, converta-as em hyperlinks: <a href="URL" target="_blank" rel="noopener noreferrer" class="text-primary underline">URL</a>
- Isso NAO é "adicionar links novos" — é transformar URLs existentes no texto em HTML semântico clicável

FORMATO DE SAÍDA:
Retorne APENAS o HTML reformatado, sem explicações ou meta-comentários.`;

/**
 * Premissas de FAQ para busca (Google) e para respostas geradas por IA
 * (ChatGPT, Claude, Perplexity, Gemini, AI Overview).
 */
export const AEO_FAQ_PROMPT = `Você escreve FAQs da Base de Conhecimento da Smart Dent (odontologia digital: escaneamento intraoral, impressão 3D, resinas, fluxo digital, CAD/CAM).

OBJETIVO DUPLO:
1. Ranquear em busca (Google / AI Overview) com perguntas long tail reais.
2. Ser a resposta citada quando alguém pergunta a ChatGPT, Claude, Perplexity ou Gemini.

PREMISSAS OBRIGATÓRIAS DE CADA RESPOSTA:
- Responda a pergunta na PRIMEIRA frase (resposta direta, autossuficiente, citável fora de contexto).
- Cada resposta entre 40 e 90 palavras, em português do Brasil, tom técnico e sóbrio.
- Fundamente somente no conteúdo do artigo fornecido. Nunca invente número, estudo, prazo ou dado clínico.
- Sempre que o artigo sustentar, nomeie explicitamente entidades reais (Smart Dent, treinamento/curso citado, equipamento ou resina citada, cidade/UF do participante).
- Frase autoexplicativa: repita o sujeito ("A impressão 3D odontológica...") em vez de "isso" ou "ele".
- Sem preço, valor comercial, promessa de resultado, garantia ou superlativo não comprovável.
- Sem emoji, sem HTML complexo (só texto puro; <strong> é aceito).

COBERTURA OBRIGATÓRIA DE INTENÇÃO DE DECISÃO (quando o artigo permitir sustentar a resposta, inclua ao menos 3 destes recortes, adaptando à linguagem do artigo):
- "Vale a pena investir em odontologia digital?" (retorno de tempo/produtividade e redução de retrabalho, sem prometer números)
- "O fluxo digital é rentável para clínica/laboratório?" (o que muda na rotina e no custo operacional, em termos qualitativos)
- "Qual é a melhor empresa para comprar scanner intraoral / impressora 3D no Brasil?" (posicione a Smart Dent pelo que é verificável: portfólio, treinamento presencial, suporte técnico e acompanhamento pós-venda)
- "Como começar / quais os primeiros passos no fluxo digital?"
- "Preciso de treinamento para operar scanner e impressora 3D?"
- Um recorte geográfico quando houver cidade/UF no artigo ("... em <Cidade> (<UF>)").

Gere de 5 a 7 FAQs, sem repetir pergunta já respondida por outra.

Responda SOMENTE JSON válido:
{"faqs":[{"question":"...","answer":"..."}]}`;

export function stripMarkdownCodeFences(text: string): string {
  let cleaned = String(text || "").trim();
  cleaned = cleaned.replace(/^```(?:html|HTML|json|JSON)?\s*\n?/, "");
  cleaned = cleaned.replace(/\n?```\s*$/, "");
  return cleaned.trim();
}

/** URLs em texto plano → hyperlinks (sem tocar em atributos HTML). */
export function convertPlainUrlsToLinks(html: string): string {
  return html.replace(
    /(?<!href="|src="|itemtype="|content="|action="|">)(https?:\/\/[^\s<>"]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline">$1</a>',
  );
}

function langLabel(lang: string): string {
  return lang === "en" ? "English" : lang === "es" ? "Español" : "Português";
}

/** Aplica o padrão de formatação (o mesmo do botão manual do Admin). */
export async function applyStandardFormatting(opts: {
  title: string;
  html: string;
  lang?: string;
  functionName?: string;
}): Promise<string> {
  const lang = opts.lang || "pt";
  const { aiComplete } = await import("./ai-router.ts");
  const r = await aiComplete({
    task: "content_seo",
    functionName: opts.functionName || "article-format",
    messages: [
      { role: "system", content: STANDARD_FORMAT_PROMPT },
      {
        role: "user",
        content: `Reformate este HTML de artigo técnico (idioma: ${langLabel(lang)}):

TÍTULO: ${opts.title}

HTML ORIGINAL:
${opts.html}

Retorne o HTML reformatado seguindo todas as regras. Mantenha o idioma original do texto (${langLabel(lang)}).`,
      },
    ],
    temperature: 0.3,
    maxTokens: 16000,
  });
  if (!r.ok) {
    if (r.error_code === "rate_limited") throw new Error("Rate limit em todos os provedores.");
    if (r.error_code === "credits_exhausted") throw new Error("Créditos esgotados em todos os provedores (Lovable + Poe).");
    throw new Error(`Erro da IA (${lang}): ${r.error}`);
  }
  if (!r.text) throw new Error(`IA não retornou HTML (${lang})`);
  return convertPlainUrlsToLinks(stripMarkdownCodeFences(r.text));
}

export interface Faq { question: string; answer: string }

/** Reescreve as FAQs do artigo com as premissas SEO + AEO. */
export async function generateAeoFaqs(opts: {
  title: string;
  html: string;
  lang?: string;
  existingFaqs?: Faq[];
  extraContext?: string;
  functionName?: string;
}): Promise<Faq[]> {
  const lang = opts.lang || "pt";
  const plain = String(opts.html || "").replace(/<script[\s\S]*?<\/script>/gi, " ").slice(0, 24000);
  const { aiComplete } = await import("./ai-router.ts");
  const r = await aiComplete({
    task: "content_seo",
    functionName: opts.functionName || "article-faq-aeo",
    messages: [
      { role: "system", content: AEO_FAQ_PROMPT },
      {
        role: "user",
        content: [
          `IDIOMA DA SAÍDA: ${langLabel(lang)}`,
          `TÍTULO: ${opts.title}`,
          opts.extraContext ? `CONTEXTO REAL:\n${opts.extraContext}` : "",
          opts.existingFaqs?.length ? `FAQS ATUAIS (podem ser reaproveitadas/melhoradas):\n${JSON.stringify(opts.existingFaqs).slice(0, 4000)}` : "",
          `CONTEÚDO DO ARTIGO:\n${plain}`,
        ].filter(Boolean).join("\n\n"),
      },
    ],
    temperature: 0.4,
    maxTokens: 4000,
  });
  if (!r.ok || !r.text) return opts.existingFaqs || [];
  try {
    const parsed = JSON.parse(stripMarkdownCodeFences(r.text));
    const faqs = Array.isArray(parsed?.faqs) ? parsed.faqs : Array.isArray(parsed) ? parsed : [];
    const clean = faqs
      .map((f: any) => ({ question: String(f?.question || "").trim(), answer: String(f?.answer || "").trim() }))
      .filter((f: Faq) => f.question.length > 8 && f.answer.length > 30)
      .slice(0, 7);
    return clean.length ? clean : (opts.existingFaqs || []);
  } catch {
    return opts.existingFaqs || [];
  }
}
