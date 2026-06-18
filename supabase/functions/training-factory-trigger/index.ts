import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const DepoimentoSchema = z.object({
  enrollment_id: z.string().optional().nullable(),
  nome: z.string().optional().default(""),
  telefone: z.string().optional().default(""),
  instagram: z.string().nullable().optional(),
  video_url: z.string().optional().default(""),
  audio_url: z.string().nullable().optional(),
});

const BodySchema = z.object({
  turma_number: z.number().int(),
  media: z.object({
    foto_grupo: z.string().nullable().optional(),
    reel_url: z.string().nullable().optional(),
    depoimentos: z.array(DepoimentoSchema).default([]),
    fotos_dia: z
      .object({
        "1": z.array(z.string()).optional().default([]),
        "2": z.array(z.string()).optional().default([]),
        "3": z.array(z.string()).optional().default([]),
      })
      .partial()
      .default({}),
  }),
});

async function callLovableAI(
  apiKey: string,
  messages: any[],
  model = "google/gemini-3-flash-preview",
): Promise<string> {
  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`AI Gateway ${res.status}: ${txt}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

async function transcribeAudio(apiKey: string, audioUrl: string): Promise<string> {
  if (!audioUrl) return "";
  try {
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) throw new Error(`audio fetch ${audioRes.status}`);
    const buf = new Uint8Array(await audioRes.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    const mime = audioRes.headers.get("content-type") || "video/mp4";

    const res = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Transcreva este depoimento odontológico em português. Retorne apenas a transcrição limpa, sem formatação adicional.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mime};base64,${b64}`,
                },
              },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`AI Gateway ${res.status}: ${txt}`);
    }
    const data = await res.json();
    return (data?.choices?.[0]?.message?.content ?? "").trim();
  } catch (e) {
    console.error("transcribeAudio error", e);
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { turma_number, media } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Find turma
    const { data: turma, error: turmaErr } = await supabase
      .from("smartops_course_turmas")
      .select("id, turma_number, course_id, smartops_courses(*)")
      .eq("turma_number", turma_number)
      .maybeSingle();
    if (turmaErr || !turma) {
      return new Response(
        JSON.stringify({ error: `Turma ${turma_number} not found`, details: turmaErr }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Factory data via RPC
    const { data: factoryData, error: factoryErr } = await supabase.rpc(
      "fn_get_turma_factory_data",
      { p_turma_id: turma.id },
    );
    if (factoryErr) console.error("fn_get_turma_factory_data error", factoryErr);
    const fd: any = factoryData ?? {};

    const cursoNome = fd?.curso?.nome || (turma as any)?.smartops_courses?.title || "Curso";
    const rawEquip = fd?.curso?.equipamento || fd?.equipamento || "";
    const rawLabel = fd?.curso?.label || fd?.label || (turma as any)?.label || "";
    // Extrai apenas o modelo do equipamento (ex: "BLZ INO 200") de qualquer string suja
    // tipo "144 BLZ INO 200 Dias 10,11,12/06".
    const extractEquip = (s: string) =>
      (s || "").match(/(?:BLZ\s+)?INO\s*\d+|RayShape\s*\w*/i)?.[0]?.trim() || "";
    const equipamento =
      extractEquip(rawEquip) || extractEquip(rawLabel) || rawEquip || "";
    const participantes: any[] = fd?.participantes || [];
    const estados: string[] = Array.from(
      new Set(
        participantes
          .map((p) => p.estado || p.uf || p.state)
          .filter((s) => !!s && typeof s === "string"),
      ),
    );
    const qtdParticipantes = participantes.length || media.depoimentos.length;

    // 3. Create run
    const { data: run, error: runErr } = await supabase
      .from("training_factory_runs")
      .insert({
        turma_id: turma.id,
        turma_number,
        status: "processando",
        started_at: new Date().toISOString(),
        media_uploaded: media as any,
      })
      .select()
      .single();
    if (runErr || !run) throw new Error(`run insert: ${runErr?.message}`);

    try {
      // 4. Transcribe each depoimento
      const depoimentosWithTranscription = await Promise.all(
        media.depoimentos.map(async (d) => ({
          ...d,
          transcription: await transcribeAudio(apiKey, d.audio_url),
        })),
      );

      // 5. Generate texts
      const turmaContext = JSON.stringify({
        turma_number,
        curso: cursoNome,
        equipamento,
        qtd_participantes: qtdParticipantes,
        estados,
        participantes: participantes.map((p) => ({
          nome: p.nome || p.name,
          estado: p.estado || p.uf,
        })),
        depoimentos_transcritos: depoimentosWithTranscription.map((d) => ({
          nome: d.nome,
          transcription: d.transcription,
        })),
      });

      const captionIG = await callLovableAI(apiKey, [
        {
          role: "system",
          content:
            "Você é um copywriter especialista em redes sociais para o mercado odontológico digital. Escreva em português brasileiro.",
        },
        {
          role: "user",
          content: `Gere uma CAPTION PARA INSTAGRAM (máximo 2200 caracteres) sobre esta turma de imersão.
Requisitos:
- Abertura impactante sobre a turma
- Mencionar número da turma (#${turma_number}), curso e equipamento
- Quantidade de participantes (${qtdParticipantes}) e estados representados (${estados.join(", ")})
- Convite para comentar
- NÃO inclua hashtags na caption — o sistema de publicação anexa as hashtags automaticamente

Dados da turma:
${turmaContext}

Retorne APENAS o texto da caption pronto para publicar.`,
        },
      ]);

      const captionLI = await callLovableAI(apiKey, [
        {
          role: "system",
          content:
            "Você é um copywriter corporativo B2B para LinkedIn no setor odontológico. Escreva em português brasileiro com tom profissional.",
        },
        {
          role: "user",
          content: `Gere uma CAPTION PARA LINKEDIN sobre esta turma de imersão.
Requisitos:
- Tom corporativo, foco em resultados e transformação profissional
- Mencionar: ${qtdParticipantes} profissionais, ${estados.length} estados (${estados.join(", ")}), curso "${cursoNome}"
- CTA para conhecer o programa
- Sem hashtags excessivas (no máximo 3-4 relevantes ao final)

Dados:
${turmaContext}

Retorne APENAS o texto pronto para publicar.`,
        },
      ]);

      const waGrupos = await callLovableAI(apiKey, [
        {
          role: "user",
          content: `Gere uma mensagem curta de WhatsApp para grupos de clientes anunciando a conclusão da Turma #${turma_number}.
Estrutura sugerida:
- "Mais uma turma concluída! 🎓"
- Turma #${turma_number} — ${cursoNome} — ${equipamento}
- ${qtdParticipantes} profissionais de ${estados.length} estados
- "Veja como foi: [LINK_INSTAGRAM]"

Mantenha [LINK_INSTAGRAM] como placeholder literal. Retorne APENAS o texto da mensagem.`,
        },
      ]);

      // 6. Insert assets
      const assets: any[] = [];

      if (media.reel_url) {
        assets.push({
          run_id: run.id,
          turma_id: turma.id,
          turma_number,
          asset_type: "reel_turma",
          media_url: media.reel_url,
          media_type: "video",
          caption: captionIG,
          hashtags: [
            "odontologiadigital",
            "smartdent",
            "chairsideprint",
            "impressao3d",
            "ino200",
            "odontologia",
          ],
          status: "pronto",
        });
      }

      assets.push({
        run_id: run.id,
        turma_id: turma.id,
        turma_number,
        asset_type: "feed_instagram",
        media_url: media.foto_grupo || null,
        media_type: "image",
        caption: captionIG,
        hashtags: [
          "odontologiadigital",
          "smartdent",
          "chairsideprint",
          "impressao3d",
          "ino200",
          "odontologia",
        ],
        status: "pronto",
      });

      assets.push({
        run_id: run.id,
        turma_id: turma.id,
        turma_number,
        asset_type: "linkedin",
        media_url: media.foto_grupo || null,
        media_type: "image",
        caption: captionLI,
        status: "pronto",
      });

      assets.push({
        run_id: run.id,
        turma_id: turma.id,
        turma_number,
        asset_type: "whatsapp_grupos",
        whatsapp_text: waGrupos,
        status: "pronto",
      });

      // Depoimentos + whatsapp per participant
      for (const d of depoimentosWithTranscription) {
        assets.push({
          run_id: run.id,
          turma_id: turma.id,
          turma_number,
          asset_type: "depoimento",
          enrollment_id: d.enrollment_id || null,
          media_url: d.video_url || null,
          media_type: "video",
          transcription: d.transcription || null,
          participant_name: d.nome,
          participant_phone: d.telefone,
          participant_instagram: d.instagram,
          status: "pronto",
        });

        const waMsg = await callLovableAI(apiKey, [
          {
            role: "user",
            content: `Gere uma mensagem de WhatsApp pessoal e próxima para um participante da imersão.
Estrutura:
- "Olá ${d.nome || "[nome]"}! Seu depoimento e as fotos da Turma #${turma_number} estão no ar!"
- "Acesse, curta e comente: [LINK_INSTAGRAM]"
- Tom próximo e pessoal, 2-4 linhas no total

Mantenha [LINK_INSTAGRAM] como placeholder literal. Retorne APENAS o texto.`,
          },
        ]);

        assets.push({
          run_id: run.id,
          turma_id: turma.id,
          turma_number,
          asset_type: "whatsapp_participante",
          enrollment_id: d.enrollment_id || null,
          participant_name: d.nome,
          participant_phone: d.telefone,
          participant_instagram: d.instagram,
          whatsapp_text: waMsg,
          status: "pronto",
        });
      }

      const { error: assetsErr } = await supabase
        .from("training_factory_assets")
        .insert(assets);
      if (assetsErr) throw new Error(`assets insert: ${assetsErr.message}`);

      // 7. Update run
      await supabase
        .from("training_factory_runs")
        .update({
          status: "pronto",
          ready_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", run.id);

      // 8. Update turma
      await supabase
        .from("smartops_course_turmas")
        .update({ factory_status: "pronto" })
        .eq("turma_number", turma_number);

      return new Response(
        JSON.stringify({
          success: true,
          run_id: run.id,
          turma_id: turma.id,
          assets_created: assets.length,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (innerErr: any) {
      await supabase
        .from("training_factory_runs")
        .update({
          status: "erro",
          error_message: String(innerErr?.message || innerErr),
          updated_at: new Date().toISOString(),
        })
        .eq("id", run.id);
      throw innerErr;
    }
  } catch (err: any) {
    console.error("training-factory-trigger error", err);
    return new Response(
      JSON.stringify({ error: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});