import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getValidAccessToken } from "../_shared/google-oauth.ts";
import {
  fetchEnrichedProductDossier,
  fetchProductDossier,
  renderDossierForPrompt,
} from "../_shared/product-rag.ts";
import { renderLiveDossierForPrompt } from "../_shared/system-a-live.ts";
import { renderStrategyForPrompt } from "../_shared/smartdent-strategy.ts";


const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const YT = "https://www.googleapis.com/youtube/v3";

function toISO(date: string, time: string | null | undefined) {
  // horários cadastrados são de São Paulo (UTC-3)
  const t = (time || "09:00").slice(0, 5);
  return `${date}T${t}:00-03:00`;
}

function fmtBR(date: string, time?: string | null) {
  const d = new Date(toISO(date, time));
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Contexto da empresa (system_a_catalog / company_info) ──────────────
async function loadCompany() {
  const { data } = await admin
    .from("system_a_catalog")
    .select("name, description, canonical_url, extra_data")
    .eq("category", "company_info")
    .eq("active", true)
    .maybeSingle();
  const extra = (data?.extra_data ?? {}) as any;
  return {
    name: data?.name || "Smart Dent | Fluxo Digital",
    description: String(data?.description || "").slice(0, 900),
    site: data?.canonical_url || "https://parametros.smartdent.com.br",
    corporate: extra.corporate ?? {},
    contact: extra.contact ?? {},
    seo: extra.seo ?? {},
    social: extra.social_media ?? {},
    business: extra.business ?? {},
  };
}

// ── Dossiês de produto (RAG local + Sistema A live) ────────────────────
async function loadProductDossiers(names: string[]) {
  const out: Array<{ name: string; text: string; keywords: string[] }> = [];
  for (const n of names.slice(0, 3)) {
    try {
      const enriched = await fetchEnrichedProductDossier(admin as any, n);
      const d = enriched?.local ?? (await fetchProductDossier(admin as any, n));
      if (!d) continue;
      const liveText = renderLiveDossierForPrompt(enriched?.live ?? null);
      out.push({
        name: d.name || n,
        text: [renderDossierForPrompt(d, "PRODUTO"), liveText].filter(Boolean).join("\n"),
        keywords: [d.name, d.category, d.subcategory].filter(Boolean) as string[],
      });
    } catch (e) {
      console.warn("[youtube-live-create] dossier falhou", n, (e as Error).message);
    }
  }
  return out;
}


function buildTags(course: any, company: any, produtos: string[]): string[] {
  const raw = [
    "odontologia digital",
    "impressão 3D odontológica",
    "fluxo digital",
    company.name,
    course.category,
    ...produtos,
    ...(Array.isArray(company.seo?.context_keywords) ? company.seo.context_keywords : []),
    ...(Array.isArray(company.seo?.service_offerings) ? company.seo.service_offerings : []),
  ];
  const seen = new Set<string>();
  const tags: string[] = [];
  let chars = 0;
  for (const t of raw) {
    const v = String(t ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (!v || v.length < 3) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    if (chars + v.length + 1 > 480) break; // limite de 500 caracteres da API
    seen.add(k);
    tags.push(v);
    chars += v.length + 1;
  }
  return tags.slice(0, 25);
}

async function buildTexts(course: any, turma: any, startsAtBR: string) {
  const produtos: string[] = (course.related_product_names ?? []).filter(Boolean);
  const company = await loadCompany();
  const dossiers = await loadProductDossiers(produtos);

  const contatoLinhas = [
    company.site ? `Site: ${company.site}` : "",
    company.contact?.whatsapp ? `WhatsApp: ${company.contact.whatsapp}` : "",
    company.contact?.email ? `E-mail: ${company.contact.email}` : "",
    company.contact?.city && company.contact?.state
      ? `Localização: ${company.contact.city} / ${company.contact.state}${company.contact?.country ? ` — ${company.contact.country}` : ""}`
      : "",
    company.social?.instagram ? `Instagram: ${company.social.instagram}` : "",
    company.social?.youtube ? `YouTube: ${company.social.youtube}` : "",
  ].filter(Boolean);

  const sobreEmpresa = [
    `Sobre a ${company.name}`,
    company.description || company.corporate?.mission || "",
    company.corporate?.founded_year ? `Fundada em ${company.corporate.founded_year}.` : "",
    Array.isArray(company.corporate?.differentiators) && company.corporate.differentiators.length
      ? `Diferenciais: ${company.corporate.differentiators.slice(0, 5).join(" · ")}.`
      : "",
    Array.isArray(company.seo?.service_offerings) && company.seo.service_offerings.length
      ? `Soluções: ${company.seo.service_offerings.slice(0, 8).join(" · ")}.`
      : "",
  ].filter(Boolean).join("\n");

  const fallbackTitle = `${course.title} — ${startsAtBR} (ao vivo)`.slice(0, 100);
  const fallbackDesc = [
    course.description || `Transmissão ao vivo Smart Dent: ${course.title}.`,
    "",
    `Data e horário: ${startsAtBR} (horário de Brasília).`,
    produtos.length ? `Produtos abordados: ${produtos.join(", ")}.` : "",
    course.instructor_name ? `Apresentação: ${course.instructor_name}.` : "",
    "",
    ...dossiers.map((d) => `▸ ${d.name}\n${d.text.replace(/^### [^\n]*\n/, "")}`),
    "",
    sobreEmpresa,
    "",
    contatoLinhas.join("\n"),
  ].filter(Boolean).join("\n");

  const tags = buildTags(course, company, [...produtos, ...dossiers.flatMap((d) => d.keywords)]);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return { title: fallbackTitle, description: fallbackDesc.slice(0, 4900), tags };

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              "Você escreve títulos e descrições de transmissões ao vivo no YouTube para a Smart Dent (odontologia digital, Brasil). " +
              "Português do Brasil, tom profissional e humano, sem emojis exagerados, NUNCA cite preços ou valores comerciais. " +
              "A descrição é lida por buscadores e por IAs (AEO/GEO): deve ser RICA e COMPLETA, usando apenas os dados fornecidos — nunca invente especificações, certificações ou números. " +
              "Estruture a descrição assim: (1) 2 a 3 linhas de resumo com a proposta da live; (2) 'Data e horário'; (3) 'O que você vai ver' com 4 a 6 bullets; " +
              "(4) 'Produtos e tecnologias' com nome do produto, aplicações clínicas, compatibilidades e especificações fornecidas; (5) 'Sobre a Smart Dent' com histórico, diferenciais e soluções; " +
              "(6) 'Contato e links'; (7) hashtags relevantes. " +
              "O resumo e os bullets devem partir da dor real de fluxo digital e da complexidade retirada, conforme as premissas estratégicas abaixo.\n\n" +
              renderStrategyForPrompt() + "\n\n" +
              'Responda SOMENTE JSON: {"title": string (máx 95 caracteres), "description": string (2000 a 4500 caracteres)}.',

          },
          {
            role: "user",
            content: JSON.stringify({
              curso: course.title,
              descricao: course.description ?? null,
              categoria: course.category ?? null,
              apresentador: course.instructor_name ?? null,
              produtos,
              data_horario_brasilia: startsAtBR,
              opcao: turma.label ?? null,
              dossies_produtos: dossiers.map((d) => d.text),
              empresa: {
                nome: company.name,
                descricao: company.description,
                site: company.site,
                corporativo: company.corporate,
                contato: company.contact,
                seo: company.seo,
                redes: company.social,
                dados_cadastrais: company.business,
              },
            }),
          },
        ],
      }),
    });
    if (!resp.ok) {
      console.error("[youtube-live-create] AI", resp.status, await resp.text());
      return { title: fallbackTitle, description: fallbackDesc.slice(0, 4900), tags };
    }
    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw.replace(/^```json/i, "").replace(/```$/, "").trim());
    let description = String(parsed.description || fallbackDesc);
    if (contatoLinhas.length && !/parametros\.smartdent|smartdent\.com\.br/i.test(description)) {
      description += `\n\n${contatoLinhas.join("\n")}`;
    }
    return {
      title: String(parsed.title || fallbackTitle).slice(0, 100),
      description: description.slice(0, 4900),
      tags,
    };
  } catch (e) {
    console.error("[youtube-live-create] AI parse", e);
    return { title: fallbackTitle, description: fallbackDesc.slice(0, 4900), tags };
  }
}


async function yt(path: string, token: string, init?: RequestInit) {
  const resp = await fetch(`${YT}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`YouTube ${path} → ${resp.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const turmaId = String(body?.turma_id ?? "");
    const privacy = ["public", "unlisted", "private"].includes(String(body?.privacy))
      ? String(body.privacy)
      : "unlisted";
    if (!turmaId) return json({ error: "turma_id é obrigatório" }, 400);

    const { data: turma, error: tErr } = await admin
      .from("smartops_course_turmas")
      .select("id, label, course_id, live_url, days:smartops_turma_days(date, start_time, end_time, day_number)")
      .eq("id", turmaId)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!turma) return json({ error: "Turma não encontrada. Salve o curso antes de gerar a live." }, 404);

    const { data: course, error: cErr } = await admin
      .from("smartops_courses")
      .select("id, title, description, category, modality, instructor_name, related_product_names")
      .eq("id", turma.course_id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!course) return json({ error: "Curso não encontrado" }, 404);

    const days = ((turma as any).days ?? [])
      .slice()
      .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
    const first = days[0];
    if (!first?.date) return json({ error: "Defina a data e o horário da sessão antes de criar a live." }, 400);

    const startISO = toISO(first.date, first.start_time);
    const endISO = toISO(first.date, first.end_time);
    const startsAtBR = fmtBR(first.date, first.start_time);

    const token = await getValidAccessToken();
    const { title, description, tags } = await buildTexts(course, turma, startsAtBR);

    // 1) broadcast
    const broadcast = await yt("liveBroadcasts?part=id,snippet,status,contentDetails", token, {
      method: "POST",
      body: JSON.stringify({
        snippet: {
          title,
          description,
          scheduledStartTime: new Date(startISO).toISOString(),
          scheduledEndTime: first.end_time ? new Date(endISO).toISOString() : undefined,
        },
        status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
        contentDetails: { enableAutoStart: true, enableAutoStop: true, latencyPreference: "low" },
      }),
    });

    // 1b) metadados do vídeo (tags/idioma/categoria) — indexação por busca e IAs
    try {
      await yt("videos?part=snippet", token, {
        method: "PUT",
        body: JSON.stringify({
          id: broadcast.id,
          snippet: {
            title,
            description,
            tags,
            categoryId: "27", // Education
            defaultLanguage: "pt-BR",
            defaultAudioLanguage: "pt-BR",
          },
        }),
      });
    } catch (e) {
      console.error("[youtube-live-create] videos.update falhou", (e as Error).message);
    }


    // 2) stream + bind (permite transmitir por qualquer encoder/OBS)
    let streamKey: string | null = null;
    try {
      const stream = await yt("liveStreams?part=id,snippet,cdn", token, {
        method: "POST",
        body: JSON.stringify({
          snippet: { title: `${title} — stream`.slice(0, 128) },
          cdn: { frameRate: "variable", ingestionType: "rtmp", resolution: "variable" },
        }),
      });
      await yt(`liveBroadcasts/bind?part=id,contentDetails&id=${broadcast.id}&streamId=${stream.id}`, token, {
        method: "POST",
      });
      streamKey = stream?.cdn?.ingestionInfo?.streamName ?? null;
    } catch (e) {
      console.error("[youtube-live-create] bind falhou (broadcast criado)", e);
    }

    const watchUrl = `https://www.youtube.com/watch?v=${broadcast.id}`;

    const { error: upErr } = await admin
      .from("smartops_course_turmas")
      .update({ live_url: watchUrl })
      .eq("id", turmaId);
    if (upErr) throw upErr;

    return json({
      ok: true,
      broadcast_id: broadcast.id,
      watch_url: watchUrl,
      studio_url: `https://studio.youtube.com/video/${broadcast.id}/livestreaming`,
      stream_key: streamKey,
      title,
      description,
      tags,
      scheduled_start: startISO,
    });
  } catch (e) {
    const msg = (e as Error).message ?? "internal_error";
    console.error("[youtube-live-create]", msg);
    const needsAuth = /No Google OAuth token|insufficient|Insufficient|invalid_grant|refresh|expirado|401|403/i.test(msg);
    return json({ error: msg, needs_google_auth: needsAuth }, needsAuth ? 401 : 500);
  }
});
