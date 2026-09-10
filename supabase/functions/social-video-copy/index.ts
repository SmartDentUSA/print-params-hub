// social-video-copy — transcreve o áudio/narração + textos na tela de um vídeo
// (Gemini multimodal) e devolve a copy pronta (legenda + hashtags + 1º comentário).
//
// Body: { video_url, instructions?, hard_facts?[], mentions?[], platform?, tone?, language? }
// Resp: { transcript, on_screen_text, caption, hashtags[], first_comment }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const MODEL = "google/gemini-3.8-flash";
const MAX_HASHTAGS = 30;

type AgendaSession = { date?: string; start_time?: string; end_time?: string; theme?: string };
type AgendaSpeaker = { name?: string; instagram?: string; theme?: string; sessions?: AgendaSession[] };
type EventAgenda = { event_name?: string; location?: string; stand?: string; speakers?: AgendaSpeaker[] };

function sanitizeHashtags(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    const t = String(raw || "").trim().replace(/^#+/, "").replace(/\s+/g, "");
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length >= MAX_HASHTAGS) break;
  }
  return out;
}

const MAX_VIDEO_BYTES = 24 * 1024 * 1024; // 24 MB

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// O provedor de IA não consegue baixar o vídeo do Storage: enviamos os bytes inline.
async function fetchVideoAsDataUri(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Não foi possível baixar o vídeo (${res.status})`);
  const declared = Number(res.headers.get("content-length") || 0);
  if (declared && declared > MAX_VIDEO_BYTES) {
    throw new Error("Vídeo muito grande para análise (limite ~24 MB). Envie uma versão mais curta ou compactada.");
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_VIDEO_BYTES) {
    throw new Error("Vídeo muito grande para análise (limite ~24 MB). Envie uma versão mais curta ou compactada.");
  }
  const mime = (res.headers.get("content-type") || "video/mp4").split(";")[0].trim();
  return `data:${mime.startsWith("video/") ? mime : "video/mp4"};base64,${bytesToBase64(buf)}`;
}

function stripJson(text: string): any {
  const cleaned = String(text || "").replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Resposta da IA sem JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalize(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function formatDate(value?: string): string {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || "");
}

function cleanHandle(value?: string): string {
  const handle = String(value || "")
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@+/, "");
  return handle ? `@${handle}` : "";
}

function findSpeaker(agendas: EventAgenda[], evidence: string): { event: EventAgenda; speaker: AgendaSpeaker } | null {
  const haystack = normalize(evidence);
  let winner: { event: EventAgenda; speaker: AgendaSpeaker; score: number } | null = null;
  for (const event of agendas) {
    for (const speaker of event.speakers || []) {
      const name = String(speaker.name || "").trim();
      const tokens = name.split(/\s+/).map(normalize).filter((token) => token.length >= 4);
      const handle = normalize(cleanHandle(speaker.instagram));
      let score = 0;
      if (normalize(name) && haystack.includes(normalize(name))) score += 10;
      score += tokens.filter((token) => haystack.includes(token)).length * 2;
      if (handle && haystack.includes(handle)) score += 8;
      if (!winner || score > winner.score) winner = { event, speaker, score };
    }
  }
  return winner && winner.score >= 2 ? winner : null;
}

function agendaBlock(event: EventAgenda, speaker: AgendaSpeaker): string {
  const sessions = (speaker.sessions || []).filter((session) => session.date && session.start_time);
  if (!sessions.length) return "";
  const lines = sessions.flatMap((session, index) => {
    const end = session.end_time ? ` às ${String(session.end_time).slice(0, 5)}` : "";
    return [
      `Demonstração ${index + 1}`,
      `🗓️ ${formatDate(session.date)} ⏰ ${String(session.start_time).slice(0, 5)}${end}`,
    ];
  });
  const place = [event.stand ? `Estande ${String(event.stand).replace(/^estande\s*/i, "")}` : "", event.location || ""]
    .filter(Boolean)
    .join(" — ");
  return [`Anote na agenda:`, ...lines, place ? `📍 ${place}` : ""].filter(Boolean).join("\n");
}

function ensureAgenda(caption: string, agendas: EventAgenda[], evidence: string): { caption: string; matched: string | null } {
  if (!agendas.length) return { caption, matched: null };
  const matched = findSpeaker(agendas, evidence);
  const onlySpeaker = agendas.flatMap((event) => (event.speakers || []).map((speaker) => ({ event, speaker })));
  const target = matched || (onlySpeaker.length === 1 ? onlySpeaker[0] : null);
  if (!target) return { caption, matched: null };
  const block = agendaBlock(target.event, target.speaker);
  if (!block) return { caption, matched: null };
  const sessionTimes = (target.speaker.sessions || []).map((session) => String(session.start_time || "").slice(0, 5));
  const hasEveryTime = sessionTimes.every((time) => time && caption.includes(time));
  if (hasEveryTime) return { caption, matched: String(target.speaker.name || "") || null };
  return {
    caption: `${caption.trim()}\n\n${block}`.slice(0, 2200),
    matched: String(target.speaker.name || "") || null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
    const body = await req.json();
    const videoUrl = String(body?.video_url || "").trim();
    // Caminho preferido: o navegador extrai o áudio (MP3 leve) + quadros do vídeo,
    // então vídeos grandes (centenas de MB) funcionam sem enviar o arquivo original.
    const audioBase64 = String(body?.audio_base64 || "");
    const audioFormat = String(body?.audio_format || "mp3");
    const frames: string[] = Array.isArray(body?.frames)
      ? body.frames.map(String).filter((f: string) => f.startsWith("data:image/")).slice(0, 12)
      : [];
    const hasExtracted = !!audioBase64 || frames.length > 0;
    if (!hasExtracted && !/^https:\/\//.test(videoUrl)) {
      throw new Error("Envie um vídeo válido (video_url https)");
    }

    const hardFacts: string[] = Array.isArray(body?.hard_facts) ? body.hard_facts.map(String) : [];
    const mentions: string[] = Array.isArray(body?.mentions) ? body.mentions.map(String) : [];
    const eventAgendas: EventAgenda[] = Array.isArray(body?.event_agendas) ? body.event_agendas : [];
    const language = String(body?.language || "pt-BR");
    const platform = String(body?.platform || "instagram");
    const tone = String(body?.tone || "Profissional");
    const instructions = String(body?.instructions || "").trim();

    const system = [
      "Você é redator sênior de social media da Smart Dent (odontologia digital, impressão 3D, CAD/CAM).",
      `Idioma: ${language}. Plataforma: ${platform}. Tom: ${tone}.`,
      hasExtracted
        ? "Você recebeu o ÁUDIO do vídeo (narração completa) e vários QUADROS extraídos ao longo dele: ouça toda a narração e leia todos os textos que aparecem nas imagens."
        : "Você vai ASSISTIR ao vídeo enviado: ouça toda a narração e leia todos os textos que aparecem na tela.",
      "Com base APENAS no que está no vídeo + nos fatos fornecidos, escreva a copy final pronta para publicar.",
      "REGRAS:",
      "- Nunca invente datas, horários, locais, estande, nomes, @perfis, preços ou especificações. Se não estiver no vídeo nem nos fatos, não cite.",
      "- NUNCA cite preços ou valores comerciais.",
      "- Reproduza literalmente os fatos obrigatórios (datas, horários, local, estande).",
      "- AGENDA ESTRUTURADA é a fonte oficial. O texto e o áudio do vídeo servem para identificar o profissional; nunca substitua a agenda cadastrada por horários lidos no vídeo.",
      "- OBRIGATÓRIO: identifique pelo áudio/textos da tela QUEM é o profissional do vídeo e, nos FATOS OBRIGATÓRIOS, localize a linha 🎤 dele. Escreva um BLOCO DE AGENDA com TODAS as demonstrações dessa pessoa, uma por linha, no formato: 'Demonstração N' + nova linha + '🗓️ {data} ⏰ {horário}'. Copie data e horário exatamente como estão nos fatos, sem arredondar nem omitir nenhuma sessão.",
      "- Sempre cite o local e o estande junto do bloco de agenda quando existirem nos fatos.",
      "- Se não conseguir identificar a pessoa do vídeo com segurança, escreva o bloco de agenda com as demonstrações de todos os profissionais listados nos fatos.",
      "- Nunca publique a legenda sem datas e horários quando eles existirem nos fatos obrigatórios.",
      "- Marque os @perfis autorizados (palestrantes, evento, marcas) no fechamento da legenda.",
      "- Legenda: gancho forte na 1ª linha, parágrafos curtos, emojis pontuais, bloco de agenda quando houver horários, CTA de comentário/compartilhamento e 'salve este post'.",
      "- NÃO escreva hashtags dentro da legenda: elas vão só no campo hashtags (10 a 20).",
      "- Máximo 2200 caracteres na legenda.",
      'Responda SOMENTE JSON: {"transcript":"","on_screen_text":"","caption":"","hashtags":[],"first_comment":""}',
    ].join("\n");

    const userParts: any[] = [
      {
        type: "text",
        text: [
          instructions ? `BRIEFING/CONTEXTO:\n${instructions}` : "",
          hardFacts.length ? `FATOS OBRIGATÓRIOS (copiar literalmente):\n${hardFacts.join("\n")}` : "",
          eventAgendas.length ? `AGENDA ESTRUTURADA OFICIAL:\n${JSON.stringify(eventAgendas)}` : "",
          mentions.length ? `PERFIS AUTORIZADOS PARA MARCAR: ${mentions.join(" ")}` : "",
          "Transcreva a narração, leia os textos da tela e devolva o JSON pedido.",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ];

    if (hasExtracted) {
      if (audioBase64) {
        userParts.push({
          type: "input_audio",
          input_audio: { data: audioBase64, format: audioFormat },
        });
      }
      for (const f of frames) {
        userParts.push({ type: "image_url", image_url: { url: f } });
      }
    } else {
      userParts.push({ type: "video_url", video_url: { url: await fetchVideoAsDataUri(videoUrl) } });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userParts },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[social-video-copy] gateway", res.status, detail.slice(0, 800));
      const message =
        res.status === 402
          ? "IA sem créditos no momento."
          : res.status === 429
            ? "IA sobrecarregada — tente novamente em alguns segundos."
            : `Falha da IA (${res.status}). ${detail.slice(0, 300)}`;
      return new Response(JSON.stringify({ error: message }), {
        status: res.status === 402 || res.status === 429 ? res.status : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content ?? "";
    const parsed = stripJson(typeof text === "string" ? text : JSON.stringify(text));

    const rawCaption = String(parsed.caption || "").replace(/#([\p{L}\p{N}_]{2,60})/gu, "").replace(/\n{3,}/g, "\n\n").trim();
    const evidence = [parsed.transcript, parsed.on_screen_text, rawCaption].filter(Boolean).join("\n");
    const enforced = ensureAgenda(rawCaption, eventAgendas, evidence);

    return new Response(
      JSON.stringify({
        transcript: String(parsed.transcript || ""),
        on_screen_text: String(parsed.on_screen_text || ""),
        caption: enforced.caption.slice(0, 2200),
        hashtags: sanitizeHashtags(parsed.hashtags),
        first_comment: String(parsed.first_comment || "").slice(0, 2200),
        _meta: { model: MODEL, matched_speaker: enforced.matched, agenda_enforced: enforced.caption !== rawCaption },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[social-video-copy] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Erro inesperado" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
