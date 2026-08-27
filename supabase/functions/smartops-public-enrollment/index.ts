import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  course_slug: z.string().min(1),
  turma_id: z.string().uuid().optional(),
  nome: z.string().trim().min(3).max(160),
  email: z.string().trim().email().max(255),
  telefone: z.string().trim().min(10).max(20),
  is_client_smartdent: z.boolean().optional(),
  // Dados confirmados/corrigidos pelo cliente na tela "estas informações estão corretas?"
  confirmation: z
    .object({
      area_atuacao: z.string().trim().max(120).optional(),
      especialidade: z.string().trim().max(160).optional(),
      cidade: z.string().trim().max(120).optional(),
      confirmed: z.boolean().optional(),
    })
    .optional(),
  qualification: z
    .object({
      form_id: z.string().uuid().optional(),
      form_name: z.string().optional(),
      db_columns: z.record(z.any()).optional(),
      custom_fields: z.record(z.any()).optional(),
      form_responses: z
        .array(z.object({ label: z.string(), value: z.string() }))
        .optional(),
      workflow_responses: z
        .array(
          z.object({
            field_id: z.string().uuid(),
            field_label: z.string(),
            value: z.string(),
            workflow_cell_target: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
});

function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  // strip leading 55 if BR country code
  if (digits.length === 13 && digits.startsWith("55")) return digits.slice(2);
  if (digits.length === 12 && digits.startsWith("55")) return digits.slice(2);
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = parsed.data;
    const phone = normalizePhone(body.telefone);
    const email = body.email.toLowerCase().trim();

    // 1. Load course
    const { data: course, error: eCourse } = await supabase
      .from("smartops_courses")
      .select("id, slug, title, modality, public_enrollment_enabled, active, related_product_ids, related_product_names, stage_after_enroll, pipeline_id_kanban, instructor_name, location, meeting_link, whatsapp_group_link, whatsapp_message_template, wa_instance_name")
      .eq("slug", body.course_slug)
      .maybeSingle();
    if (eCourse) throw eCourse;
    if (!course || !course.active || !course.public_enrollment_enabled) {
      return new Response(JSON.stringify({ error: "course_not_available" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowed = ["online", "online_ao_vivo", "workshop", "webinar"];
    if (!allowed.includes(course.modality)) {
      return new Response(JSON.stringify({ error: "modality_not_public" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Resolve turma (first active if not provided)
    let turmaId = body.turma_id;
    if (!turmaId) {
      const { data: t } = await supabase
        .from("smartops_course_turmas")
        .select("id")
        .eq("course_id", course.id)
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      turmaId = t?.id;
    }
    if (!turmaId) {
      return new Response(JSON.stringify({ error: "no_turma_available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2b. Snapshot da turma escolhida (datas + link da Live daquela sessão).
    // Sem isso o cron de lembrete não encontra a inscrição e a mensagem
    // de confirmação sai sem data/horário/link.
    const { data: turmaRow } = await supabase
      .from("smartops_course_turmas")
      .select("id, label, turma_number, slots, whatsapp_group_link, live_url, sellflux_tag")
      .eq("id", turmaId)
      .maybeSingle();
    const { data: turmaDays } = await supabase
      .from("smartops_course_turma_days")
      .select("day_number, date, start_time, end_time, topic")
      .eq("turma_id", turmaId)
      .order("day_number", { ascending: true });
    const turmaSnapshot: any = { ...(turmaRow ?? { id: turmaId }), days: turmaDays ?? [] };

    const isOnlineCourse = course.modality === "online_ao_vivo" || course.modality === "online";
    let waReminderScheduledFor: string | null = null;
    {
      const d0: any = (turmaDays ?? [])[0];
      if (isOnlineCourse && d0?.date && d0?.start_time) {
        // America/Sao_Paulo = UTC-3 (sem DST)
        const startSp = new Date(`${d0.date}T${d0.start_time}-03:00`);
        if (!isNaN(startSp.getTime())) {
          waReminderScheduledFor = new Date(startSp.getTime() - 60 * 60 * 1000).toISOString();
        }
      }
    }

    // 3. Find existing lead by email or phone (canonical only)
    let leadId: string | null = null;
    let isExistingClient = false;
    // `true` quando o ingest já gravou os eventos `form_response` na timeline.
    let ingestLogged = false;

    {
      // `telefone_normalized` varia entre `+5511...` e dígitos puros → sufixo.
      const orFilter = `email.eq.${email},telefone_normalized.like.*${phone},telefone_raw.like.*${phone}`;

      const { data: leads, error: eLeads } = await supabase
        .from("lia_attendances")
        .select("id, piperun_id, omie_codigo_cliente")
        .or(orFilter)
        .is("merged_into", null)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (eLeads) console.error("[public-enrollment] lead lookup", eLeads);
      if (leads && leads.length > 0) {
        leadId = leads[0].id;
        // Cliente de verdade = proposta GANHA no CRM, negócio em funil de CS,
        // ou cliente no ERP. Existir no CRM (`piperun_id`) NÃO é cliente.
        const { data: wonDeals } = await supabase
          .from("deals")
          .select("id")
          .eq("lead_id", leadId)
          .eq("status", "ganha")
          .limit(1);
        if ((wonDeals?.length ?? 0) > 0) {
          isExistingClient = true;
        } else {
          const { data: csDeals } = await supabase
            .from("deals")
            .select("id")
            .eq("lead_id", leadId)
            .in("pipeline_name", ["CS Onboarding", "Ganhos Aleatórios (CS)"])
            .limit(1);
          isExistingClient =
            (csDeals?.length ?? 0) > 0 || Boolean(leads[0].omie_codigo_cliente);
        }
      }
    }


    // Origin label for the Deal in PipeRun: prefix `#` keeps it filterable
    // alongside the other form-based origins (e.g. `# - FORMS - ...`).
    const formName = body.qualification?.form_name ?? `# - ${course.title}`;
    const productNames: string[] = Array.isArray(course.related_product_names)
      ? (course.related_product_names as string[])
      : [];

    // 4. Always run through ingest so a Deal is created on the VENDAS pipeline
    // when the user is not yet a client. The course's related products are the
    // source of truth for `produto_interesse_auto` and Workflow 7×3 cells.
    {
      const q = body.qualification ?? {};
      const ingestPayload: Record<string, any> = {
        source: "course_enrollment_public",
        form_name: formName,
        form_purpose: "sdr_captacao",
        nome: body.nome,
        email,
        telefone: phone,
        origem_primeiro_contato: formName,
        // "Produtos do portfólio relacionados" (editor do curso) é a fonte de
        // verdade do produto de interesse — sobrepõe qualquer inferência.
        ...(productNames.length > 0
          ? {
              produto_interesse: productNames.join(", "),
              produto_interesse_auto: productNames[0],
            }
          : {}),
        // Pass DB column answers (area_atuacao, especialidade, tem_scanner, etc.)
        ...(q.db_columns ?? {}),
        // Dados confirmados pelo cliente têm prioridade sobre inferências
        ...(body.confirmation?.area_atuacao ? { area_atuacao: body.confirmation.area_atuacao } : {}),
        ...(body.confirmation?.especialidade ? { especialidade: body.confirmation.especialidade } : {}),
        ...(body.confirmation?.cidade ? { cidade: body.confirmation.cidade } : {}),
        form_responses: q.form_responses ?? [],
      };
      const customFields = { ...(q.custom_fields ?? {}) };
      if (Object.keys(customFields).length > 0) {
        ingestPayload.raw_payload = { custom_fields: customFields };
      }
      try {
        const { data: ingestRes } = await supabase.functions.invoke("smart-ops-ingest-lead", {
          body: ingestPayload,
        });
        const ingestedId = (ingestRes as any)?.lead_id ?? (ingestRes as any)?.id ?? null;
        if (ingestedId) {
          leadId = ingestedId;
          ingestLogged = (q.form_responses?.length ?? 0) > 0;
        }
      } catch (e) {
        console.warn("[ingest-lead]", e);
      }

      // Fallback: direct insert if ingest didn't yield a lead
      if (!leadId) {
        const { data: inserted } = await supabase
          .from("lia_attendances")
          .insert({
            nome: body.nome,
            email,
            telefone: phone,
            origem_primeiro_contato: formName,
            form_name: formName,
            produto_interesse: productNames.length > 0 ? productNames.join(", ") : null,
            produto_interesse_auto: productNames[0] ?? null,
          })
          .select("id")
          .single();
        leadId = inserted?.id ?? null;
      }
    }

    if (!leadId) {
      return new Response(JSON.stringify({ error: "lead_creation_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3b. Confirmação de cadastro pelo próprio cliente (fonte mais confiável).
    if (body.confirmation?.confirmed) {
      const conf: Record<string, string> = {};
      if (body.confirmation.area_atuacao) conf.area_atuacao = body.confirmation.area_atuacao;
      if (body.confirmation.especialidade) conf.especialidade = body.confirmation.especialidade;
      if (body.confirmation.cidade) conf.cidade = body.confirmation.cidade;
      if (Object.keys(conf).length > 0) {
        await supabase
          .from("lia_attendances")
          .update(conf)
          .eq("id", leadId)
          .then(() => {}, (e) => console.warn("[confirm-update]", e));
      }
      await supabase
        .from("lead_activity_log")
        .insert({
          lead_id: leadId,
          event_type: "dados_confirmados_cliente",
          entity_type: "course_enrollment",
          entity_name: course.title,
          source_channel: "formulario_publico",
          event_data: {
            ...conf,
            course_title: course.title,
            description: [
              "Cliente confirmou seus dados na inscrição pública",
              ...Object.entries(conf).map(([k, v]) => `${k}: ${v}`),
            ].join("\n"),
          },
        })
        .then(() => {}, (e) => console.warn("[confirm-activity]", e));
    }

    // 4b. Persist Workflow 7×3 mapping responses (used by SDR mapping panel).
    // The course's related products are the source of truth — the user-facing
    // answer (model owned) is appended for context.
    const wfResponses = body.qualification?.workflow_responses ?? [];
    if (wfResponses.length > 0 && body.qualification?.form_id) {
      const productSummary = productNames.length > 0 ? productNames.join(", ") : null;
      const rows = wfResponses.map((r) => ({
        form_id: body.qualification!.form_id!,
        field_id: r.field_id,
        lead_id: leadId!,
        value: productSummary ? `${productSummary} · resposta: ${r.value}` : r.value,
        workflow_cell_target: r.workflow_cell_target,
        field_label: r.field_label,
      }));
      await supabase
        .from("smartops_form_field_responses")
        .insert(rows)
        .then(() => {}, (e) => console.warn("[wf-responses]", e));
    }

    // 4c. Fire-and-forget: post a "Resumo do Lead" note on the PipeRun deal
    // mirroring the standard form ingest behaviour.
    if ((body.qualification?.form_responses?.length ?? 0) > 0) {
      supabase.functions
        .invoke("smart-ops-deal-form-note", {
          body: {
            lead_id: leadId,
            form_name: formName,
            responses: body.qualification!.form_responses,
          },
        })
        .catch((err) => console.warn("[deal-form-note]", err));
    }

    // 6. Create enrollment (idempotent: reuse active enrollment for same lead+turma)
    let enrollment: { id: string } | null = null;
    let reusedEnrollment = false;
    {
      const { data: existing } = await supabase
        .from("smartops_course_enrollments")
        .select("id")
        .eq("turma_id", turmaId)
        .eq("lead_id", leadId)
        .not("status", "in", "(cancelado,nao_compareceu)")
        .maybeSingle();
      if (existing) {
        reusedEnrollment = true;
        enrollment = existing as { id: string };

      } else {
        const { data: inserted, error: eEnroll } = await supabase
          .from("smartops_course_enrollments")
          .insert({
            course_id: course.id,
            turma_id: turmaId,
            turma_snapshot: turmaSnapshot,
            wa_reminder_scheduled_for: waReminderScheduledFor,
            lead_id: leadId,
            person_name: body.nome,
            status: "agendado",
            enrolled_at: new Date().toISOString(),
            source: "public",
            is_client_smartdent: isExistingClient || Boolean(body.is_client_smartdent),
            public_form_payload: {
              nome: body.nome,
              email,
              telefone: phone,
              declared_client: body.is_client_smartdent ?? null,
              ip: req.headers.get("x-forwarded-for"),
              ua: req.headers.get("user-agent"),
            },
          })
          .select("id")
          .single();
        if (eEnroll) {
          // Race condition: another concurrent submit landed first — reuse it
          if ((eEnroll as any).code === "23505") {
            const { data: again } = await supabase
              .from("smartops_course_enrollments")
              .select("id")
              .eq("turma_id", turmaId)
              .eq("lead_id", leadId)
              .order("enrolled_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            enrollment = (again as { id: string } | null) ?? null;
            if (!enrollment) throw eEnroll;
          } else {
            throw eEnroll;
          }
        } else {
          enrollment = inserted as { id: string };
        }
      }
    }
    if (!enrollment) throw new Error("enrollment_creation_failed");

    // 5. Histórico de conversão — só na primeira inscrição desta turma.
    if (!reusedEnrollment) {
      // supabase-js resolve com `{ error }` em vez de rejeitar — logar o erro.
      const { error: convErr } = await supabase.from("lead_conversion_history").insert({
        lead_id: leadId,
        // `conversion_type` tem CHECK fechado; inscrição = 'formulario'.
        conversion_type: "formulario",
        conversion_date: new Date().toISOString(),
        details: {
          label: `# - Inscrição [${course.title}]`,
          subtype: "inscricao_curso",
          course_id: course.id,
          course_title: course.title,
          turma_id: turmaId,
          produtos: productNames,
          source: "public_enrollment_form",
        },

      });
      if (convErr) console.error("[conversion]", JSON.stringify(convErr));
    }


    // 7. Activity log
    const qaLines = (body.qualification?.form_responses ?? []).map(
      (r) => `${r.label}: ${r.value}`,
    );
    if (!reusedEnrollment) await supabase.from("lead_activity_log").insert({

      lead_id: leadId,
      event_type: "inscricao_curso_publica",
      entity_type: "course_enrollment",
      entity_id: enrollment.id,
      entity_name: course.title,
      source_channel: "formulario_publico",
      user_agent: req.headers.get("user-agent"),
      event_data: {
        turma_id: turmaId,
        source: "public_form",
        course_id: course.id,
        course_slug: course.slug,
        course_title: course.title,
        form_name: formName,
        nome: body.nome,
        email,
        telefone: phone,
        is_client_smartdent: isExistingClient || Boolean(body.is_client_smartdent),
        produtos: productNames,
        respostas: body.qualification?.form_responses ?? [],
        description: [
          `Inscrição pública em "${course.title}"`,
          ...(qaLines.length > 0 ? ["Qualificação:", ...qaLines] : []),
        ].join("\n"),
      },
    }).then(() => {}, (e) => console.warn("[activity]", e));

    // 7c. Atividade "Live agendada" no deal do PipeRun (Planejada, 60 min,
    // lembrete 5 min antes, responsável = dono atual do lead). Roda depois do
    // ingest → lia-assign (Regra de Ouro) e nunca move/fecha deals.
    if (!reusedEnrollment) {
      supabase.functions
        .invoke("smartops-live-demo-activity", {
          body: {
            lead_id: leadId,
            turma_id: turmaId,
            enrollment_id: enrollment.id,
            course_title: course.title,
          },
        })
        .catch((err) => console.warn("[live-demo-activity]", err));
    }

    // 7d. Confirmação por WhatsApp com o link da Live DA SESSÃO escolhida.
    // Quando a turma tem `live_url` (Online ao Vivo → Live de produtos), o link
    // do YouTube substitui a linha do grupo de WhatsApp.
    if (!reusedEnrollment) {
      try {
        const fmtDate = (d?: string) => (d ? String(d).split("-").reverse().join("/") : "");
        const hm = (s?: string) => (s ?? "").substring(0, 5);
        const days: any[] = turmaSnapshot.days ?? [];
        const d0: any = days[0] ?? {};
        const dLast: any = days[days.length - 1] ?? d0;
        const cronograma = days.length
          ? (days.length === 1
              ? `📅 *Data:* ${fmtDate(d0.date)}\n⏰ *Horário:* ${hm(d0.start_time)} às ${hm(d0.end_time)}`
              : days
                  .map((d, i) => `📅 *${d.topic || `Dia ${i + 1}`}*\n    ${fmtDate(d.date)} | ${hm(d.start_time)}–${hm(d.end_time)}`)
                  .join("\n\n"))
          : "";
        const liveUrl = turmaSnapshot.live_url || course.meeting_link || "";
        const isYouTube = /youtu\.?be|youtube\.com/i.test(String(liveUrl));
        const linkLine = liveUrl
          ? (isYouTube
              ? `📺 *Link da Live no YouTube:*\n👉 ${liveUrl}`
              : `💻 *Link da reunião (aula online):*\n👉 ${liveUrl}`)
          : "";
        const grupo = liveUrl
          ? ""
          : (turmaSnapshot.whatsapp_group_link || course.whatsapp_group_link || "");
        const grupoLine = grupo
          ? `📱 *Entre no grupo de WhatsApp do seu treinamento:*\n👉 ${grupo}`
          : "";
        const local = course.modality === "presencial"
          ? (course.location || "Local a confirmar")
          : "Online";

        const tpl = (course.whatsapp_message_template as string | null) || [
          "Olá, {{nome}}! 👋",
          "",
          "Sua inscrição foi confirmada. Aqui estão os detalhes:",
          "",
          "📚 *{{curso}}*",
          "🏷 Turma: *{{turma_label}}*",
          "👨‍🏫 Instrutor: {{instrutor}}",
          "📍 {{local}}",
          "",
          "{{cronograma}}",
          "",
          "{{link_reuniao}}",
          "",
          "{{grupo_whatsapp}}",
          "",
          "_Equipe Smart Dent_ 🦷",
        ].join("\n");

        const message = tpl
          .replace(/\{\{nome\}\}/g, String(body.nome).split(" ")[0])
          .replace(/\{\{curso\}\}/g, course.title ?? "")
          .replace(/\{\{turma_label\}\}/g, turmaSnapshot.label ?? "")
          .replace(/\{\{instrutor\}\}/g, course.instructor_name ?? "")
          .replace(/\{\{local\}\}/g, local)
          .replace(/\{\{cronograma\}\}/g, cronograma)
          .replace(/\{\{duracao\}\}/g, days.length ? `${days.length} dia(s)` : "")
          .replace(/\{\{data_inicio\}\}/g, fmtDate(d0.date))
          .replace(/\{\{data_fim\}\}/g, fmtDate(dLast.date))
          .replace(/\{\{horario_inicio\}\}/g, hm(d0.start_time))
          .replace(/\{\{link_reuniao\}\}/g, linkLine)
          .replace(/\{\{grupo_whatsapp\}\}/g, grupoLine)
          .replace(/\{\{cs_nome\}\}/g, "")
          .replace(/\n{3,}/g, "\n\n")
          .trim();

        let waTeamMemberId: string | null = null;
        const instanceName = (course.wa_instance_name as string | null)
          || Deno.env.get("CS_EVOLUTION_INSTANCE")
          || "cs_principal";
        const { data: csRow } = await supabase
          .from("team_members")
          .select("id")
          .eq("evolution_instance_name", instanceName)
          .maybeSingle();
        waTeamMemberId = csRow?.id ?? null;

        const { data: waRes, error: waErr } = await supabase.functions.invoke("smart-ops-wa-send", {
          body: {
            to: phone,
            message,
            lead_id: leadId,
            team_member_id: waTeamMemberId,
            source: "public_enrollment_confirmation",
            metadata: { enrollment_id: enrollment.id, course_id: course.id, turma_id: turmaId },
          },
        });
        if (waErr || (waRes as any)?.success === false) {
          console.warn("[wa-confirmation]", JSON.stringify(waErr ?? waRes));
        }
      } catch (e) {
        console.warn("[wa-confirmation]", String((e as Error)?.message ?? e));
      }
    }


    // 7b. Cada resposta como evento próprio da timeline — só quando o ingest
    // NÃO registrou (ele já cria um `form_response` por resposta). Evita
    // duplicar o questionário no card do lead.
    if ((body.qualification?.form_responses?.length ?? 0) > 0 && !ingestLogged && !reusedEnrollment) {


      const answerRows = body.qualification!.form_responses!.map((r) => ({
        lead_id: leadId!,
        event_type: "form_response",
        entity_type: "form_field",
        entity_id: enrollment!.id,
        entity_name: r.label,
        source_channel: "formulario_publico",
        event_data: {
          form_name: formName,
          course_title: course.title,
          label: r.label,
          value: r.value,
          description: `${r.label}: ${r.value}`,
        },
      }));
      await supabase
        .from("lead_activity_log")
        .insert(answerRows)
        .then(() => {}, (e) => console.warn("[activity-answers]", e));
    }

    // NPS só para cliente CONFIRMADO no banco (proposta ganha / funil CS / ERP).
    // Dizer "sou cliente" no formulário não libera o NPS.
    let showNps = isExistingClient;

    // NPS de demonstrações é obrigatório apenas 1x a cada 30 dias por lead/email.
    if (showNps) {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      let recent = supabase
        .from("smartops_nps_responses")
        .select("id")
        .eq("survey_type", "demonstracao_ao_vivo")
        .gte("created_at", since)
        .limit(1);
      if (leadId) {
        recent = recent.eq("lead_id", leadId);
      } else if (body.email) {
        recent = recent.eq("email", String(body.email).toLowerCase().trim());
      }
      if (leadId || body.email) {
        const { data: recentRows } = await recent;
        if ((recentRows?.length ?? 0) > 0) showNps = false;
      }
    }

    // Override manual do painel: força o NPS obrigatório no próximo agendamento.
    const overrideEmail = body.email ? String(body.email).toLowerCase().trim() : null;
    if (overrideEmail) {
      const { data: ov } = await supabase
        .from("smartops_nps_demo_overrides")
        .select("id, force_next")
        .eq("email", overrideEmail)
        .maybeSingle();
      if (ov?.force_next) {
        showNps = true;
        await supabase
          .from("smartops_nps_demo_overrides")
          .update({ force_next: false, updated_at: new Date().toISOString() })
          .eq("id", ov.id)
          .then(() => {}, (e) => console.warn("[nps-override-consume]", e));
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        enrollment_id: enrollment.id,
        lead_id: leadId,
        is_client_smartdent: isExistingClient,
        show_nps: showNps,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[public-enrollment]", err);
    return new Response(JSON.stringify({ error: err?.message ?? "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});