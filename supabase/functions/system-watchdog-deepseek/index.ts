import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AnomalyReport {
  orphan_leads: { email: string; name: string; id: string }[];
  missing_piperun: { email: string; nome: string; id: string; lead_status: string }[];
  missing_cognitive: { email: string; nome: string; id: string; total_messages: number }[];
  recent_errors: { function_name: string; error_type: string; count: number }[];
}

async function analyzeWithDeepSeek(report: AnomalyReport): Promise<{ analysis: string; suggested_actions: string[] }> {
  const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
  if (!DEEPSEEK_API_KEY) return { analysis: "DeepSeek API key not configured", suggested_actions: [] };

  const totalAnomalies =
    report.orphan_leads.length +
    report.missing_piperun.length +
    report.missing_cognitive.length +
    report.recent_errors.length;

  if (totalAnomalies === 0) {
    return { analysis: "Sistema saudável. Nenhuma anomalia detectada.", suggested_actions: [] };
  }

  const prompt = `Você é o fiscal do sistema LIA (Lead Intelligence Agent). Analise este relatório de anomalias e classifique a severidade geral, identifique padrões e sugira ações corretivas específicas.

RELATÓRIO DE ANOMALIAS:
- Leads órfãos (tabela leads sem correspondente em lia_attendances): ${report.orphan_leads.length}
  ${report.orphan_leads.slice(0, 5).map(l => `  • ${l.email} (${l.name})`).join("\n")}
- Leads sem PipeRun ID (status avançado sem sync CRM): ${report.missing_piperun.length}
  ${report.missing_piperun.slice(0, 5).map(l => `  • ${l.email} - status: ${l.lead_status}`).join("\n")}
- Leads sem análise cognitiva (>=5 mensagens): ${report.missing_cognitive.length}
  ${report.missing_cognitive.slice(0, 5).map(l => `  • ${l.email} - ${l.total_messages} msgs`).join("\n")}
- Erros recentes (últimas 24h): ${report.recent_errors.length}
  ${report.recent_errors.map(e => `  • ${e.function_name}/${e.error_type}: ${e.count}x`).join("\n")}

Responda em JSON: { "severity": "critical|warning|info", "analysis": "resumo em português max 200 palavras", "suggested_actions": ["ação 1", "ação 2"] }`;

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      console.error("[watchdog] DeepSeek API error:", res.status);
      return { analysis: `DeepSeek API error: ${res.status}`, suggested_actions: [] };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Log token usage
    const usage = data.usage;
    if (usage) {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      try {
        await sb.from("ai_token_usage").insert({
          function_name: "system-watchdog-deepseek",
          action_label: "anomaly_analysis",
          provider: "deepseek",
          model: "deepseek-chat",
          prompt_tokens: usage.prompt_tokens || 0,
          completion_tokens: usage.completion_tokens || 0,
          total_tokens: usage.total_tokens || 0,
          estimated_cost_usd: ((usage.prompt_tokens || 0) * 0.00000014 + (usage.completion_tokens || 0) * 0.00000028),
        });
      } catch (_) { /* ignore */ }
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { analysis: parsed.analysis || content, suggested_actions: parsed.suggested_actions || [] };
    }
    return { analysis: content, suggested_actions: [] };
  } catch (e) {
    console.error("[watchdog] DeepSeek call failed:", e);
    return { analysis: `Erro na análise: ${String(e)}`, suggested_actions: [] };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let dry_run = false;
    try {
      const body = await req.json();
      dry_run = body?.dry_run === true;
    } catch (_) { /* no body is fine */ }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    console.log("[watchdog] Starting system integrity check...");

    // 1. Detect orphan leads (in `leads` but not in `lia_attendances`)
    const { data: allLeads } = await supabase.from("leads").select("id, email, name, source");
    const { data: allLia } = await supabase.from("lia_attendances").select("email");

    const liaEmails = new Set((allLia || []).map(l => l.email?.toLowerCase()));
    const orphanLeads = (allLeads || []).filter(l => !liaEmails.has(l.email?.toLowerCase()));

    // 2. Detect leads without piperun_id (advanced status)
    const { data: missingPiperun } = await supabase
      .from("lia_attendances")
      .select("id, email, nome, lead_status")
      .is("piperun_id", null)
      .not("lead_status", "eq", "novo")
      .lt("created_at", new Date(Date.now() - 3600000).toISOString())
      .limit(50);

    // 3. Detect leads without cognitive_analysis with enough messages
    const { data: missingCognitive } = await supabase
      .from("lia_attendances")
      .select("id, email, nome, total_messages")
      .is("cognitive_analysis", null)
      .gte("total_messages", 5)
      .limit(50);

    // 4. Recent errors from system_health_logs
    const { data: recentErrors } = await supabase
      .from("system_health_logs")
      .select("function_name, error_type")
      .eq("resolved", false)
      .gte("created_at", new Date(Date.now() - 86400000).toISOString());

    // Aggregate errors by function+type
    const errorMap: Record<string, number> = {};
    (recentErrors || []).forEach(e => {
      const key = `${e.function_name}|${e.error_type || "unknown"}`;
      errorMap[key] = (errorMap[key] || 0) + 1;
    });
    const errorSummary = Object.entries(errorMap).map(([key, count]) => {
      const [fn, et] = key.split("|");
      return { function_name: fn, error_type: et, count };
    });

    const report: AnomalyReport = {
      orphan_leads: orphanLeads.map(l => ({ email: l.email, name: l.name, id: l.id })),
      missing_piperun: (missingPiperun || []).map(l => ({ email: l.email, nome: l.nome, id: l.id, lead_status: l.lead_status })),
      missing_cognitive: (missingCognitive || []).map(l => ({ email: l.email, nome: l.nome, id: l.id, total_messages: l.total_messages || 0 })),
      recent_errors: errorSummary,
    };

    const totalAnomalies = report.orphan_leads.length + report.missing_piperun.length + report.missing_cognitive.length;
    console.log(`[watchdog] Found: ${report.orphan_leads.length} orphans, ${report.missing_piperun.length} missing PipeRun, ${report.missing_cognitive.length} missing cognitive`);

    // 5. DeepSeek analysis (only if anomalies exist)
    let aiResult = { analysis: "Sistema saudável. Nenhuma anomalia detectada.", suggested_actions: [] as string[] };
    if (totalAnomalies > 0 || errorSummary.length > 0) {
      aiResult = await analyzeWithDeepSeek(report);
    }

    // 6. Auto-remediation: re-ingest orphan leads (skip in dry_run, limit to 3)
    let remediatedCount = 0;
    if (!dry_run) {
      for (const orphan of report.orphan_leads.slice(0, 3)) {
        try {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-ingest-lead`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
            body: JSON.stringify({ email: orphan.email, name: orphan.name, source: "watchdog-recovery" }),
          });
          if (res.ok) remediatedCount++;

          await supabase.from("system_health_logs").insert({
            function_name: "system-watchdog-deepseek",
            severity: "warning",
            error_type: "orphan_lead_recovered",
            lead_email: orphan.email,
            details: { original_lead_id: orphan.id, remediation_status: res.ok ? "success" : "failed" },
            ai_analysis: aiResult.analysis,
            ai_suggested_action: aiResult.suggested_actions.join("; "),
            auto_remediated: res.ok,
            resolved: res.ok,
            resolved_at: res.ok ? new Date().toISOString() : null,
          }).catch(() => {});
        } catch (e) {
          console.warn(`[watchdog] Failed to re-ingest ${orphan.email}:`, e);
        }
      }
    }

    // 7. Log missing piperun and cognitive as warnings
    if (report.missing_piperun.length > 0) {
      await supabase.from("system_health_logs").insert({
        function_name: "system-watchdog-deepseek",
        severity: report.missing_piperun.length > 10 ? "critical" : "warning",
        error_type: "missing_piperun_ids",
        details: { count: report.missing_piperun.length, samples: report.missing_piperun.slice(0, 5) },
        ai_analysis: aiResult.analysis,
        ai_suggested_action: aiResult.suggested_actions.join("; "),
      }).catch(() => {});
    }

    if (report.missing_cognitive.length > 0) {
      await supabase.from("system_health_logs").insert({
        function_name: "system-watchdog-deepseek",
        severity: "warning",
        error_type: "missing_cognitive_analysis",
        details: { count: report.missing_cognitive.length, samples: report.missing_cognitive.slice(0, 5) },
        ai_analysis: aiResult.analysis,
        ai_suggested_action: aiResult.suggested_actions.join("; "),
      }).catch(() => {});
    }

    // 8. Trigger missing cognitive analyses
    for (const lead of (report.missing_cognitive || []).slice(0, 5)) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/cognitive-lead-analysis`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ lead_id: lead.id, trigger: "watchdog" }),
        }).catch(() => {});
      } catch (_) { /* fire and forget */ }
    }

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      anomalies: {
        orphan_leads: report.orphan_leads.length,
        missing_piperun: report.missing_piperun.length,
        missing_cognitive: report.missing_cognitive.length,
        recent_errors: errorSummary.length,
      },
      remediated: remediatedCount,
      ai_analysis: aiResult.analysis,
      ai_suggested_actions: aiResult.suggested_actions,
    };

    console.log("[watchdog] Complete:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[watchdog] Fatal error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
