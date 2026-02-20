import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY");

const BATCH_SIZE = 5;
const DELAY_MS = 2000; // 2s between batches to avoid rate limits

const EXTERNAL_KB_URL = "https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/knowledge-base";

async function generateEmbedding(text: string): Promise<number[]> {
  const modelsToTry = [
    { model: "models/gemini-embedding-001", version: "v1beta" },
  ];

  for (const { model, version } of modelsToTry) {
    const modelId = model.replace("models/", "");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/${version}/models/${modelId}:embedContent?key=${GOOGLE_AI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          content: { parts: [{ text }] },
          taskType: "RETRIEVAL_DOCUMENT",
          outputDimensionality: 768,
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      const values = data.embedding?.values || [];
      if (values.length > 0) return values;
    } else {
      const err = await response.text();
      console.log(`${model}@${version}: ${response.status} - ${err.slice(0, 100)}`);
      if (response.status !== 404 && response.status !== 429) {
        throw new Error(`Embedding API error ${response.status}: ${err}`);
      }
    }
  }

  throw new Error("All embedding models failed. Check logs for details.");
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface Chunk {
  content_id?: string;
  source_type: "article" | "video" | "resin" | "parameter" | "company_kb" | "catalog_product";
  chunk_text: string;
  metadata: Record<string, unknown>;
}

// ── Decode mojibake / latin1-encoded UTF-8 strings ────────────────────────────
function fixEncoding(str: string): string {
  try {
    // The text comes encoded as latin1-interpreted UTF-8 bytes — decode back
    return decodeURIComponent(escape(str));
  } catch {
    return str;
  }
}

// ── Parse the ai_training endpoint text into semantic chunks ──────────────────
function parseExternalKBToChunks(rawText: string): Chunk[] {
  const text = fixEncoding(rawText);
  const chunks: Chunk[] = [];

  // ── 1. COMPANY PROFILE ─────────────────────────────────────────────────────
  const profileSection = extractSection(text, "## PERFIL DA EMPRESA", ["### ", "## "]);
  if (profileSection) {
    const name = extractField(profileSection, "Nome");
    const description = extractField(profileSection, "Descricao") || extractField(profileSection, "DescriÃ§Ã£o");
    const mission = extractField(profileSection, "Missao") || extractField(profileSection, "MissÃ£o");
    const differentals = extractField(profileSection, "Diferenciais");
    const competitiveAdv = extractField(profileSection, "Vantagens Competitivas");
    const techExpertise = extractField(profileSection, "Expertise Tecnica") || extractField(profileSection, "Expertise TÃ©cnica");
    const serviceAreas = extractField(profileSection, "Areas de Servico") || extractField(profileSection, "Ãreas de ServiÃ§o");
    const founded = extractField(profileSection, "Ano de Fundacao") || extractField(profileSection, "Ano de FundaÃ§Ã£o");
    const positioning = extractField(profileSection, "Posicionamento de Mercado");

    // Identity chunk
    chunks.push({
      source_type: "company_kb",
      chunk_text: [
        `Smart Dent — Empresa de tecnologia em odontologia digital fundada em ${founded || "2009"}.`,
        description ? `Descrição: ${description.slice(0, 600)}` : "",
        mission ? `Missão: ${mission.slice(0, 300)}` : "",
        positioning ? `Posicionamento: ${positioning.slice(0, 200)}` : "",
      ].filter(Boolean).join(" | "),
      metadata: { title: "Smart Dent — Perfil e Missão", category: "empresa", founded },
    });

    // Expertise + Differentials chunk
    if (differentals || techExpertise || competitiveAdv) {
      chunks.push({
        source_type: "company_kb",
        chunk_text: [
          "Smart Dent — Diferenciais e Expertise Técnica",
          differentals ? `Diferenciais: ${differentals.slice(0, 400)}` : "",
          techExpertise ? `Expertise: ${techExpertise.slice(0, 400)}` : "",
          competitiveAdv ? `Vantagens: ${competitiveAdv.slice(0, 300)}` : "",
        ].filter(Boolean).join(" | "),
        metadata: { title: "Smart Dent — Diferenciais e Expertise", category: "empresa" },
      });
    }

    // Service areas chunk
    if (serviceAreas) {
      chunks.push({
        source_type: "company_kb",
        chunk_text: `Smart Dent — Áreas de Atendimento e Alcance Geográfico | ${serviceAreas}`,
        metadata: {
          title: "Smart Dent — Áreas de Atendimento",
          category: "empresa",
          areas: serviceAreas,
        },
      });
    }
  }

  // ── 2. NPS INSIGHTS ────────────────────────────────────────────────────────
  const npsSection = extractSection(text, "INSIGHTS DE CLIENTES", ["## ", "### VIDEOS"]);
  if (npsSection) {
    const npsScore = extractField(npsSection, "NPS Score");
    const totalResp = extractField(npsSection, "Total de Respostas");
    const rating = extractField(npsSection, "Satisfacao Media") || extractField(npsSection, "SatisfaÃ§Ã£o MÃ©dia");
    chunks.push({
      source_type: "company_kb",
      chunk_text: [
        `Smart Dent — NPS e Satisfação de Clientes`,
        `NPS Score: ${npsScore || "96"} | Total de respostas: ${totalResp || "84"} | Satisfação média: ${rating || "4.6/5"}`,
        "Produtos mais demandados pelos clientes (NPS real): PROTOCOLOS IMPRESSOS 57 interessados 68%, IMPRESSAO 3D 35 interessados 42%, CIRURGIA GUIADA 35 interessados 42%",
        "Padrões de demanda: forte interesse em soluções digitais e protocolares, tecnologias de precisão e segurança cirúrgica, capacitação em fluxo digital",
      ].filter(Boolean).join(" | "),
      metadata: {
        title: "Smart Dent — NPS e Satisfação",
        category: "empresa",
        nps_score: npsScore || "96",
        total_responses: totalResp || "84",
      },
    });
  }

  // ── 3. PARTNERSHIP HISTORY (from Instagram reels) ──────────────────────────
  const videosSection = extractSection(text, "### VIDEOS DA EMPRESA", ["### REVIEWS"]);
  const igReels = videosSection || "";

  const partnershipTimeline = [
    {
      year: "2009",
      text: "Em 2009, a Smart Dent foi fundada no Núcleo de Manufatura Avançada da USP São Carlos. Nasceu a primeira Central de Usinagem CAD/CAM do Brasil e as primeiras resinas 3D específicas para odontologia. Fundador: Marcelo Del Guerra.",
      keywords: "fundacao 2009 USP Sao Carlos historia origem CAD CAM primeira",
    },
    {
      year: "2011",
      text: "Em 2011, a Smart Dent firmou parceria com a Medit, trazendo para o Brasil uma das maiores marcas de escaneamento intraoral do mundo. Essa união abriu as portas para a era do fluxo digital odontológico.",
      keywords: "Medit 2011 parceria scanner intraoral escaneamento digital",
    },
    {
      year: "2012",
      text: "Em 2012, a Smart Dent tornou-se distribuidora oficial da Exocad (exocad GmbH), empresa alemã referência global em softwares CAD para odontologia. A Exocad oferece DentalCAD, ChairsideCAD e Exoplan. Isso consolidou a Smart Dent como referência em integração digital.",
      keywords: "exocad 2012 software CAD dental alemanha distribuidora oficial DentalCAD ChairsideCAD Exoplan",
    },
    {
      year: "2022",
      text: "Em 2022, a Smart Dent lançou oficialmente a resina nanohíbrida Vitality, reforçando o compromisso com qualidade e estética clínica. No mesmo ano, tornou-se distribuidora oficial da ASIGA, referência mundial em impressoras 3D odontológicas.",
      keywords: "Vitality resina 2022 ASIGA impressora 3D nanohibrida lancamento",
    },
    {
      year: "2023",
      text: "Em 2023, a Smart Dent implementou o sistema ChairSide Print, unificando equipamentos, softwares e materiais em um fluxo digital completo: SCAN • CAD • PRINT • MAKE. Profissionais de todo o Brasil passaram a dominar todas as etapas da odontologia digital.",
      keywords: "ChairSide Print 2023 SCAN CAD PRINT MAKE fluxo digital completo chairside",
    },
    {
      year: "2024",
      text: "Em 2024, a Smart Dent tornou-se distribuidora oficial BLZ Dental (scanners intraorais BLZ INO200 e BLZ LS100, empresa chinesa especializada em digitalização odontológica). Também obteve registro FDA nos EUA (Registration Number: 3027526455).",
      keywords: "BLZ 2024 BLZ INO200 BLZ LS100 scanner intraoral distribuidor FDA registro",
    },
    {
      year: "2025",
      text: "Em 2025, a Smart Dent firmou parceria com a RayShape (empresa global de manufatura aditiva de precisão, impressoras 3D odontológicas de alta performance) e implementou Inteligência Artificial nos fluxos de trabalho digitais.",
      keywords: "RayShape 2025 impressao 3D inteligencia artificial IA fluxo digital parceria",
    },
  ];

  for (const p of partnershipTimeline) {
    // Also check if reel exists in the text for this year
    const reelMentioned = igReels.includes(p.year);
    chunks.push({
      source_type: "company_kb",
      chunk_text: `Smart Dent histórico ${p.year} — ${p.text} Palavras-chave: ${p.keywords}`,
      metadata: {
        title: `Smart Dent — Marco Histórico ${p.year}`,
        category: "empresa",
        year: p.year,
        source_confirmed: reelMentioned,
      },
    });
  }

  // ── 4. INTERNATIONAL PARTNERSHIPS ─────────────────────────────────────────
  const partnershipsSection = extractSection(text, "### PARCERIAS INTERNACIONAIS", ["## CATEGORIAS"]);
  if (partnershipsSection) {
    // Split by partner entries (bold partner name)
    const partnerBlocks = partnershipsSection.split(/\*\*([^*]+)\*\*\s*\(([^)]+)\)/);
    // partnerBlocks[0] = "" before first match
    // Then: [name, country, rest_text, name, country, rest_text...]
    for (let i = 1; i < partnerBlocks.length - 1; i += 3) {
      const partnerName = partnerBlocks[i]?.trim();
      const country = partnerBlocks[i + 1]?.trim();
      const details = partnerBlocks[i + 2] || "";
      const description = (details.match(/- DescriÃ§Ã£o: ([^\n-]+)/) || details.match(/- Descri.+?:([^\n-]+)/))?.[1]?.trim() || details.slice(0, 300).trim();
      const since = (details.match(/- Desde: (\d+)/))?.[1] || "";
      if (partnerName && partnerName.length > 2) {
        chunks.push({
          source_type: "company_kb",
          chunk_text: [
            `Smart Dent parceria internacional — ${partnerName} (${country})`,
            since ? `Desde: ${since}` : "",
            description ? `${description.slice(0, 400)}` : "",
          ].filter(Boolean).join(" | "),
          metadata: {
            title: `Parceria Smart Dent — ${partnerName}`,
            category: "parcerias",
            partner: partnerName,
            country,
            since,
          },
        });
      }
    }
  }

  // ── 5. CLIENT TESTIMONIALS ─────────────────────────────────────────────────
  const testimonialLines = extractSection(text, "**Videos de Depoimentos") || 
                            extractSection(text, "**VÃ­deos de Depoimentos") ||
                            extractTestimonialBlock(rawText);
  
  if (testimonialLines) {
    const lines = testimonialLines.split("\n").filter(l => l.trim().startsWith("- https://www.youtube.com/shorts/"));
    for (const line of lines) {
      const urlMatch = line.match(/- (https:\/\/www\.youtube\.com\/shorts\/\S+)/);
      const textMatch = line.match(/"([^"]+)"/);
      if (urlMatch && textMatch) {
        const url = urlMatch[1];
        const depoText = fixEncoding(textMatch[1]);
        // Extract location from emoji pattern: 📍 City — State
        const locationMatch = depoText.match(/[\u{1F4CD}]([^\n]+)/u) || depoText.match(/📍([^\n]+)/);
        const location = locationMatch ? locationMatch[1].trim() : "";
        // Extract name from title pattern
        const titleMatch = depoText.match(/Dr[^.]+\.|Dra[^.]+\.|[A-Z][a-z]+\s[A-Z][a-z]+\s/);
        const name = titleMatch ? titleMatch[0].trim() : "";
        
        const cleanText = depoText
          .replace(/[\u{1F4CD}\u{1F9B7}][^\n]*/gu, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 600);

        chunks.push({
          source_type: "company_kb",
          chunk_text: [
            `Depoimento cliente Smart Dent${name ? " — " + name : ""}${location ? " — " + location : ""}`,
            cleanText,
          ].filter(Boolean).join(" | "),
          metadata: {
            title: `Depoimento Smart Dent${name ? " — " + name : ""}`,
            category: "depoimentos",
            location: location || undefined,
            url,
          },
        });
      }
    }
  }

  // ── 6. GOOGLE REVIEWS (grouped in batches of 10) ──────────────────────────
  const reviewsSection = extractSection(text, "### REVIEWS DA EMPRESA", ["### TRACKING"]);
  if (reviewsSection) {
    const reviewLines = reviewsSection.split("\n").filter(l => /^\d+\.\s/.test(l.trim()));
    const batchSize = 10;
    for (let i = 0; i < reviewLines.length; i += batchSize) {
      const batch = reviewLines.slice(i, i + batchSize);
      const batchText = batch.map(l => {
        const fixed = fixEncoding(l);
        return fixed.replace(/^\d+\.\s+/, "").replace(/\s*\n/g, " ").trim();
      }).join(" | ");
      
      chunks.push({
        source_type: "company_kb",
        chunk_text: `Smart Dent avaliações Google 5 estrelas — Clientes satisfeitos (grupo ${Math.floor(i / batchSize) + 1}/${Math.ceil(reviewLines.length / batchSize)}) | ${batchText.slice(0, 1200)}`,
        metadata: {
          title: `Smart Dent — Avaliações Google (grupo ${Math.floor(i / batchSize) + 1})`,
          category: "avaliacoes",
          rating: "5.0",
          batch_index: Math.floor(i / batchSize) + 1,
          total_reviews: reviewLines.length,
        },
      });
    }
  }

  // ── 7. ANTI-HALLUCINATION RULES BY CATEGORY ────────────────────────────────
  const categoriesSection = extractSection(text, "## CATEGORIAS E SUBCATEGORIAS", ["## LINKS"]);
  if (categoriesSection) {
    // Extract only categories that have rules
    const categoryBlocks = categoriesSection.split(/### /);
    for (const block of categoryBlocks) {
      if (!block.includes("REGRAS ANTI-ALUCINACAO") && !block.includes("REGRAS ANTI-ALUCINAÃ‡ÃƒO")) continue;
      const lines = block.split("\n");
      const categoryTitle = fixEncoding(lines[0]?.trim() || "");
      const rules = block.split("\n").filter(l => l.includes("NUNCA") || l.includes("SEMPRE")).join(" | ");
      if (categoryTitle && rules) {
        chunks.push({
          source_type: "company_kb",
          chunk_text: `Regras anti-alucinação Smart Dent — Categoria: ${categoryTitle} | ${fixEncoding(rules).slice(0, 800)}`,
          metadata: {
            title: `Regras — ${categoryTitle}`,
            category: "anti-alucinacao",
          },
        });
      }
    }
  }

  // ── 8. COMPANY CONTACT + LINKS summary chunk ───────────────────────────────
  chunks.push({
    source_type: "company_kb",
    chunk_text: [
      "Smart Dent — Contato e Links Oficiais",
      "Telefone / WhatsApp: (16) 99383-1794 | https://wa.me/5516993831794",
      "E-mail: comercial@smartdent.com.br",
      "Endereço: Dr. Procópio de Toledo Malta, 62 — Morada dos Deuses, São Carlos, SP, 13562-291",
      "Horário: Segunda a Sexta, 08h às 18h",
      "CEO: Marcelo Del Guerra | Fundada em 2009 | CNPJ: 10.736.894/0001-36",
      "Google Rating: 5.0 estrelas | 150+ avaliações | NPS Score: 96",
      "Loja: https://loja.smartdent.com.br/",
      "Parâmetros de impressão: https://parametros.smartdent.com.br/",
      "Cursos: https://smartdentacademy.astronmembers.com/",
      "Soluções integradas: https://smartdent.com.br/solucoesintegradas",
      "Atendimento: todo o Brasil + EUA e América Latina",
      "Forte presença em: SP, RJ, MG, PR, SC, RS, GO, BA, PE, AM, DF",
    ].join(" | "),
    metadata: {
      title: "Smart Dent — Contato e Links",
      category: "contato",
      phone: "16993831794",
      email: "comercial@smartdent.com.br",
    },
  });

  return chunks.filter(c => c.chunk_text.length > 50);
}

// ── Helper: extract a ## section until the next section header ────────────────
function extractSection(text: string, header: string, stopAt: string[]): string | null {
  const startIdx = text.indexOf(header);
  if (startIdx === -1) return null;
  
  let endIdx = text.length;
  for (const stop of stopAt) {
    const idx = text.indexOf(stop, startIdx + header.length);
    if (idx !== -1 && idx < endIdx) endIdx = idx;
  }
  
  return text.slice(startIdx, endIdx);
}

// ── Helper: extract a **Field:** value line ───────────────────────────────────
function extractField(text: string, fieldName: string): string | null {
  // Match bold field pattern: **Field:** value (up to newline or next **)
  const patterns = [
    new RegExp(`\\*\\*${fieldName}[^*]*\\*\\*:?\\s*([^\\n*]{5,})`, "i"),
    new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*([^\\n*]{5,})`, "i"),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]?.trim()) return match[1].trim();
  }
  return null;
}

// ── Helper: extract testimonial block from raw text ───────────────────────────
function extractTestimonialBlock(rawText: string): string | null {
  // Look for the testimonial section in raw (non-fixed) text
  const markers = ["**VÃ­deos de Depoimentos", "**Videos de Depoimentos"];
  for (const marker of markers) {
    const idx = rawText.indexOf(marker);
    if (idx !== -1) {
      const end = rawText.indexOf("**VÃ­deos TÃ©cnicos", idx) || rawText.indexOf("**Videos Tecnicos", idx) || idx + 10000;
      return rawText.slice(idx, typeof end === "number" ? end : end);
    }
  }
  return null;
}

// ── Fetch all chunks from external KB endpoint ────────────────────────────────
async function fetchExternalKBChunks(): Promise<Chunk[]> {
  try {
    const res = await fetch(`${EXTERNAL_KB_URL}?format=ai_training`, {
      signal: AbortSignal.timeout(15000), // 15s — more tolerant for indexing
    });
    if (!res.ok) {
      console.warn(`[external-kb] fetch failed: HTTP ${res.status}`);
      return [];
    }
    const text = await res.text();
    console.log(`[external-kb] fetched ${text.length} chars from ai_training endpoint`);
    const chunks = parseExternalKBToChunks(text);
    console.log(`[external-kb] parsed ${chunks.length} semantic chunks`);
    return chunks;
  } catch (err) {
    console.warn("[external-kb] fetch failed:", err);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate GOOGLE_AI_KEY upfront — fail fast with a clear error
  if (!GOOGLE_AI_KEY) {
    return new Response(
      JSON.stringify({
        error: "GOOGLE_AI_KEY secret not configured. Add it in Supabase Dashboard > Settings > Edge Functions > Secrets.",
        hint: "Get your key at https://aistudio.google.com/app/apikey",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") || "full"; // 'full' | 'incremental'
    const stage = url.searchParams.get("stage") || "all"; // 'all' | 'articles' | 'videos' | 'resins' | 'parameters' | 'company_kb' | 'catalog_products'

    const stageToSourceType: Record<string, string> = {
      articles: "article",
      videos: "video",
      resins: "resin",
      parameters: "parameter",
      company_kb: "company_kb",
      catalog_products: "catalog_product",
    };

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── DELETE logic based on mode + stage ──────────────────────
    if (mode === "full") {
      if (stage !== "all") {
        const sourceType = stageToSourceType[stage];
        if (sourceType) {
          await supabase.from("agent_embeddings").delete().eq("source_type", sourceType);
          console.log(`[delete] Cleared chunks for source_type="${sourceType}" (stage=${stage})`);
        }
      }
      // For stage=all, deletion happens after all chunks are collected (at the filter step below)
    }

    const chunks: Chunk[] = [];

    // ── 1. ARTICLES ─────────────────────────────────────────────
    if (stage === "all" || stage === "articles") {
    const { data: articles, error: artError } = await supabase
      .from("knowledge_contents")
      .select("id, title, slug, excerpt, meta_description, keywords, category_id, content_html, og_image_url")
      .eq("active", true);

    if (artError) throw artError;

    for (const a of articles || []) {
      const chunkText = [
        a.title,
        a.excerpt,
        a.meta_description,
        (a.keywords || []).join(", "),
        // Include first 800 chars of content_html stripped of tags
        a.content_html
          ? a.content_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 800)
          : "",
      ]
        .filter(Boolean)
        .join(" | ");

      chunks.push({
        content_id: a.id,
        source_type: "article",
        chunk_text: chunkText,
        metadata: {
          title: a.title,
          slug: a.slug,
          category_id: a.category_id,
          og_image_url: a.og_image_url,
          url_publica: `/base-conhecimento/A/${a.slug}`,
        },
      });
    }
    } // end if articles

    // ── 2. VIDEOS (all with transcripts — all will be published) ─
    if (stage === "all" || stage === "videos") {
    const { data: videos, error: vidError } = await supabase
      .from("knowledge_videos")
      .select("id, title, description, video_transcript, embed_url, thumbnail_url, content_id, pandavideo_id")
      .not("video_transcript", "is", null)
      .neq("video_transcript", "");

    if (vidError) throw vidError;

    for (const v of videos || []) {
      const transcript = v.video_transcript || "";
      // Split long transcripts into 2 chunks with overlap
      const CHUNK_LIMIT = 1200;
      const OVERLAP = 150;

      if (transcript.length <= CHUNK_LIMIT) {
        const chunkText = [v.title, v.description, transcript].filter(Boolean).join(" | ");
        chunks.push({
          content_id: v.content_id || undefined,
          source_type: "video",
          chunk_text: chunkText,
          metadata: {
            title: v.title,
            embed_url: v.embed_url,
            thumbnail_url: v.thumbnail_url,
            pandavideo_id: v.pandavideo_id,
            video_id: v.id,
          },
        });
      } else {
        // Chunk 1
        const part1 = transcript.slice(0, CHUNK_LIMIT);
        chunks.push({
          content_id: v.content_id || undefined,
          source_type: "video",
          chunk_text: [v.title, v.description, part1].filter(Boolean).join(" | "),
          metadata: {
            title: v.title,
            embed_url: v.embed_url,
            thumbnail_url: v.thumbnail_url,
            pandavideo_id: v.pandavideo_id,
            video_id: v.id,
            chunk_part: 1,
          },
        });
        // Chunk 2 (with overlap)
        const part2 = transcript.slice(CHUNK_LIMIT - OVERLAP);
        chunks.push({
          content_id: v.content_id || undefined,
          source_type: "video",
          chunk_text: [v.title, part2].filter(Boolean).join(" | "),
          metadata: {
            title: v.title,
            embed_url: v.embed_url,
            thumbnail_url: v.thumbnail_url,
            pandavideo_id: v.pandavideo_id,
            video_id: v.id,
            chunk_part: 2,
          },
        });
      }
      }
    } // end if videos

    // ── 3. RESINS ────────────────────────────────────────────────
    if (stage === "all" || stage === "resins") {
    const { data: resins, error: resinError } = await supabase
      .from("resins")
      .select("id, name, manufacturer, description, processing_instructions, slug, cta_1_url, system_a_product_url, keywords")
      .eq("active", true);

    if (resinError) throw resinError;

    for (const r of resins || []) {
      const chunkText = [
        `${r.manufacturer} ${r.name}`,
        r.description,
        r.processing_instructions,
        (r.keywords || []).join(", "),
      ]
        .filter(Boolean)
        .join(" | ");

      chunks.push({
        source_type: "resin",
        chunk_text: chunkText,
        metadata: {
          title: `${r.manufacturer} ${r.name}`,
          name: r.name,
          manufacturer: r.manufacturer,
          slug: r.slug,
          cta_1_url: r.cta_1_url || r.system_a_product_url || null,
          url_publica: r.slug ? `/resina/${r.slug}` : null,
        },
      });
    }
    } // end if resins

    // ── 4. PARAMETERS ────────────────────────────────────────────
    if (stage === "all" || stage === "parameters") {
    const { data: params, error: parError } = await supabase
      .from("parameter_sets")
      .select("id, brand_slug, model_slug, resin_name, resin_manufacturer, layer_height, cure_time, light_intensity, bottom_layers, bottom_cure_time, notes")
      .eq("active", true);

    if (parError) throw parError;

    for (const p of params || []) {
      const chunkText = [
        `Parâmetros ${p.brand_slug} ${p.model_slug} - Resina: ${p.resin_manufacturer} ${p.resin_name}`,
        `Altura de camada: ${p.layer_height}mm`,
        `Tempo de cura: ${p.cure_time}s`,
        `Intensidade de luz: ${p.light_intensity}%`,
        `Camadas base: ${p.bottom_layers}`,
        p.bottom_cure_time ? `Tempo de adesão: ${p.bottom_cure_time}s` : "",
        p.notes || "",
      ]
        .filter(Boolean)
        .join(" | ");

      chunks.push({
        source_type: "parameter",
        chunk_text: chunkText,
        metadata: {
          brand_slug: p.brand_slug,
          model_slug: p.model_slug,
          resin_name: p.resin_name,
          resin_manufacturer: p.resin_manufacturer,
          layer_height: p.layer_height,
          cure_time: p.cure_time,
          url_publica: `/${p.brand_slug}/${p.model_slug}`,
        },
      });
    }
    } // end if parameters

    // ── 5. EXTERNAL KB (company_kb) ──────────────────────────────
    if (stage === "all" || stage === "company_kb") {
    const externalChunks = await fetchExternalKBChunks();
    console.log(`[external-kb] ${externalChunks.length} chunks from ai_training endpoint`);
    chunks.push(...externalChunks);

    // ── NOVO: Ler blocos de experiência humana da company_kb_texts ──
    const { data: kbTexts, error: kbError } = await supabase
      .from("company_kb_texts")
      .select("id, title, category, source_label, content")
      .eq("active", true);

    if (kbError) console.warn("[company-kb-texts] query error:", kbError.message);

    for (const kb of kbTexts || []) {
      const KB_CHUNK_SIZE = 900;
      const KB_OVERLAP = 150;
      const parts: string[] = [];
      for (let i = 0; i < kb.content.length; i += KB_CHUNK_SIZE - KB_OVERLAP) {
        parts.push(kb.content.slice(i, i + KB_CHUNK_SIZE));
        if (i + KB_CHUNK_SIZE >= kb.content.length) break;
      }
      parts.forEach((slice, i) => {
        chunks.push({
          source_type: "company_kb",
          chunk_text: `[${kb.category.toUpperCase()}] ${kb.title}${parts.length > 1 ? ` (parte ${i + 1}/${parts.length})` : ""} | ${slice}`,
          metadata: {
            title: kb.title,
            category: kb.category,
            source_label: kb.source_label,
            kb_text_id: kb.id,
            chunk_part: i + 1,
            total_parts: parts.length,
          },
        });
      });
    }
    console.log(`[company-kb-texts] ${(kbTexts || []).length} blocos de experiência humana processados`);
    } // end if company_kb

    // ── 6. CATALOG PRODUCTS (system_a_catalog) ───────────────────
    if (stage === "all" || stage === "catalog_products") {
    const { data: catalogProducts, error: catalogError } = await supabase
      .from("system_a_catalog")
      .select("id, name, category, product_category, product_subcategory, description, cta_1_url, slug, extra_data, keywords, meta_description")
      .eq("active", true)
      .eq("approved", true)
      .eq("category", "product");

    if (catalogError) console.warn("[catalog-products] query error:", catalogError.message);

    for (const p of catalogProducts || []) {
      const productUrl = p.cta_1_url || (p.slug ? `https://loja.smartdent.com.br/${p.slug}` : null);
      const categoryLabel = [p.product_category, p.product_subcategory].filter(Boolean).join(" > ");

      // Chunk 1: Description (principal — "o que é / o que tem de especial")
      if (p.description && p.description.length > 50) {
        // Strip HTML tags from description
        const cleanDesc = p.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        chunks.push({
          source_type: "catalog_product",
          chunk_text: [
            `${p.name}${categoryLabel ? " — " + categoryLabel : ""}`,
            p.meta_description || "",
            cleanDesc.slice(0, 1200),
          ].filter(Boolean).join(" | "),
          metadata: {
            title: p.name,
            category: categoryLabel,
            url: productUrl,
            product_id: p.id,
            chunk_type: "description",
          },
        });
      }

      // Chunk 2: Benefits ("quais os diferenciais/vantagens")
      const benefits: string[] = (p.extra_data as Record<string, unknown>)?.benefits as string[] || [];
      if (benefits.length > 0) {
        chunks.push({
          source_type: "catalog_product",
          chunk_text: [
            `${p.name} — Diferenciais e Benefícios`,
            benefits.map((b: string) => `• ${b}`).join(" | ").slice(0, 1000),
          ].filter(Boolean).join(" | "),
          metadata: {
            title: `${p.name} — Benefícios`,
            category: categoryLabel,
            url: productUrl,
            product_id: p.id,
            chunk_type: "benefits",
          },
        });
      }

      // Chunk 3: FAQs ("perguntas específicas dos clientes")
      const faqs: Array<{question: string; answer: string}> = (p.extra_data as Record<string, unknown>)?.faq as Array<{question: string; answer: string}> || [];
      if (faqs.length > 0) {
        const faqText = faqs
          .slice(0, 5)
          .map((f: {question: string; answer: string}) =>
            `P: ${f.question.replace(/<[^>]+>/g, "")} R: ${f.answer.replace(/<[^>]+>/g, "").slice(0, 200)}`
          )
          .join(" | ");
        chunks.push({
          source_type: "catalog_product",
          chunk_text: [
            `${p.name} — Perguntas Frequentes`,
            faqText,
          ].filter(Boolean).join(" | ").slice(0, 1500),
          metadata: {
            title: `${p.name} — FAQ`,
            category: categoryLabel,
            url: productUrl,
            product_id: p.id,
            chunk_type: "faq",
          },
        });
      }
    }
    } // end if catalog_products

    console.log(`[catalog-products] chunks gerados`);

    // ── FILTER incremental: skip already indexed ─────────────────
    let chunksToIndex = chunks;
    if (mode === "incremental") {
      const { data: existing } = await supabase
        .from("agent_embeddings")
        .select("chunk_text");
      const existingTexts = new Set((existing || []).map((e: { chunk_text: string }) => e.chunk_text));
      chunksToIndex = chunks.filter((c) => !existingTexts.has(c.chunk_text));
    } else if (mode === "full" && stage === "all") {
      // Full mode + all stages: clear everything first
      await supabase.from("agent_embeddings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }
    // Note: full mode + specific stage already deleted selectively above

    const externalChunksCount = chunks.filter(c => c.source_type === "company_kb").length;
    const catalogProductChunksCount = chunks.filter(c => c.source_type === "catalog_product").length;
    console.log(`Mode: ${mode} | Stage: ${stage} | Total: ${chunks.length} | To index: ${chunksToIndex.length} | company_kb: ${externalChunksCount} | catalog_products: ${catalogProductChunksCount}`);

    // ── PROCESS in batches ───────────────────────────────────────
    let indexed = 0;
    let errors = 0;

    for (let i = 0; i < chunksToIndex.length; i += BATCH_SIZE) {
      const batch = chunksToIndex.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (chunk) => {
          const embedding = await generateEmbedding(chunk.chunk_text);
          const { error } = await supabase.from("agent_embeddings").insert({
            content_id: chunk.content_id || null,
            source_type: chunk.source_type,
            chunk_text: chunk.chunk_text,
            embedding,
            metadata: chunk.metadata,
            embedding_updated_at: new Date().toISOString(),
          });
          if (error) throw error;
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled") indexed++;
        else {
          errors++;
          console.error("Chunk error:", r.reason);
        }
      }

      console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${indexed} indexed, ${errors} errors`);

      if (i + BATCH_SIZE < chunksToIndex.length) {
        await sleep(DELAY_MS);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        stage,
        total_chunks: chunks.length,
        company_kb_chunks: externalChunksCount,
        catalog_product_chunks: catalogProductChunksCount,
        indexed,
        errors,
        skipped: chunks.length - chunksToIndex.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("index-embeddings error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
