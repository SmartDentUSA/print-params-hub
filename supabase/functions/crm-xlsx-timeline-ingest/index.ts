// Ingestão de exports XLSX/CSV do PipeRun (atividades, propostas, oportunidades)
// na timeline unificada do lead (lead_activity_log).
// REGRAS: sempre usa a data real do evento (nunca now()); dedupe por (event_type, entity_id);
// NUNCA altera deals nem funis (somente escreve eventos de timeline).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Row = Record<string, unknown>;

const str = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 && s.toLowerCase() !== "nan" ? s : null;
};

const num = (v: unknown): number | null => {
  const s = str(v);
  if (!s) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const iso = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T") + (s.length <= 10 ? "T12:00:00Z" : "Z"));
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const digits = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  const d = s.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-11) : null;
};

const KIND_META: Record<string, { label: string; icon: string }> = {
  ligacao: { label: "Ligação", icon: "📞" },
  email: { label: "E-mail", icon: "✉️" },
  reuniao: { label: "Reunião", icon: "🤝" },
  whatsapp: { label: "WhatsApp", icon: "💬" },
  nota: { label: "Nota", icon: "🗒️" },
  tarefa: { label: "Tarefa", icon: "✅" },
  novo_lead: { label: "Novo lead", icon: "✨" },
};

function classify(tipo: string | null, titulo: string | null): string {
  const t = `${tipo ?? ""} ${titulo ?? ""}`.toLowerCase();
  if (/whats|wpp|zap|fop/.test(t)) return "whatsapp";
  if (/liga(ç|c)|call|telefone/.test(t)) return "ligacao";
  if (/reuni(ã|a)o|meeting|visita|demo/.test(t)) return "reuniao";
  if (/e-?mail/.test(t)) return "email";
  if (/novo lead/.test(t)) return "novo_lead";
  if (/nota|coment/.test(t)) return "nota";
  return "tarefa";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json() as { kind?: string; rows?: Row[] };
    const kind = String(body.kind ?? "activity");
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, received: 0, inserted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (rows.length > 800) {
      return new Response(JSON.stringify({ ok: false, error: "max 800 rows por chamada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Resolução de identidade em lote -------------------------------
    const dealIds = [...new Set(rows.map((r) => num(r.deal_id)).filter((v): v is number => v != null))];
    const personIds = [...new Set(rows.map((r) => num(r.person_id)).filter((v): v is number => v != null))];
    const emails = [...new Set(rows.map((r) => str(r.email)?.toLowerCase()).filter((v): v is string => !!v))];

    const dealMap = new Map<number, string>();
    for (let i = 0; i < dealIds.length; i += 300) {
      const { data } = await supabase.from("deals")
        .select("piperun_deal_id, lead_id")
        .in("piperun_deal_id", dealIds.slice(i, i + 300))
        .not("lead_id", "is", null);
      for (const d of data || []) dealMap.set(Number(d.piperun_deal_id), d.lead_id as string);
    }

    const personMap = new Map<number, string>();
    for (let i = 0; i < personIds.length; i += 300) {
      const chunk = personIds.slice(i, i + 300);
      const { data } = await supabase.from("lia_attendances")
        .select("id, pessoa_piperun_id")
        .is("merged_into", null)
        .in("pessoa_piperun_id", chunk);
      for (const l of data || []) personMap.set(Number(l.pessoa_piperun_id), l.id as string);
    }

    const emailMap = new Map<string, string>();
    for (let i = 0; i < emails.length; i += 200) {
      const { data } = await supabase.from("lia_attendances")
        .select("id, email")
        .is("merged_into", null)
        .in("email", emails.slice(i, i + 200));
      for (const l of data || []) {
        const e = String(l.email ?? "").toLowerCase();
        if (e && !emailMap.has(e)) emailMap.set(e, l.id as string);
      }
    }

    const resolve = (r: Row): string | null => {
      const d = num(r.deal_id);
      if (d != null && dealMap.has(d)) return dealMap.get(d)!;
      const p = num(r.person_id);
      if (p != null && personMap.has(p)) return personMap.get(p)!;
      const e = str(r.email)?.toLowerCase();
      if (e && emailMap.has(e)) return emailMap.get(e)!;
      return null;
    };

    // ---- Normalização --------------------------------------------------
    const out: Row[] = [];
    let unresolved = 0;
    let noDate = 0;

    for (const r of rows) {
      const entityId = str(r.source_id);
      if (!entityId) continue;
      const leadId = resolve(r);
      if (!leadId) { unresolved++; continue; }

      if (kind === "activity") {
        const ts = iso(r.concluido_em) || iso(r.inicio) || iso(r.created_at) || iso(r.prazo);
        if (!ts) { noDate++; continue; }
        const k = classify(str(r.tipo), str(r.titulo));
        out.push({
          lead_id: leadId,
          event_type: "crm_activity",
          entity_type: "piperun_activity",
          entity_id: entityId,
          entity_name: str(r.titulo),
          event_timestamp: ts,
          source_channel: "crm",
          event_data: {
            kind: k,
            kind_label: KIND_META[k]?.label ?? "Atividade",
            icon: KIND_META[k]?.icon ?? "🗒️",
            title: str(r.titulo),
            comment: str(r.descricao) || str(r.comentario),
            owner: str(r.responsavel),
            tipo_crm: str(r.tipo),
            status: str(r.status),
            concluida: !!iso(r.concluido_em),
            deal_id: num(r.deal_id),
            funil: str(r.funil),
            etapa: str(r.etapa),
            fonte: "piperun_export",
            dedupe_key: `activity:${entityId}`,
          },
        });
      } else if (kind === "proposal") {
        const ts = iso(r.created_at);
        if (!ts) { noDate++; continue; }
        out.push({
          lead_id: leadId,
          event_type: "crm_proposal",
          entity_type: "piperun_proposal",
          entity_id: entityId,
          entity_name: str(r.titulo) || `Proposta ${entityId}`,
          event_timestamp: ts,
          source_channel: "crm",
          value_numeric: num(r.valor),
          event_data: {
            kind: "proposta",
            kind_label: "Proposta",
            icon: "📄",
            status: str(r.status),
            valor: num(r.valor),
            vendedor: str(r.vendedor),
            versao: num(r.versao),
            link: str(r.link),
            deal_id: num(r.deal_id),
            funil: str(r.funil),
            etapa: str(r.etapa),
            fonte: "piperun_export",
            dedupe_key: `proposal:${entityId}`,
          },
        });
      } else if (kind === "opportunity") {
        const ts = iso(r.created_at);
        if (!ts) { noDate++; continue; }
        out.push({
          lead_id: leadId,
          event_type: "crm_deal_snapshot",
          entity_type: "deal",
          entity_id: entityId,
          entity_name: str(r.titulo),
          event_timestamp: ts,
          source_channel: "crm",
          value_numeric: num(r.valor),
          event_data: {
            kind: "oportunidade",
            kind_label: "Oportunidade",
            icon: "📈",
            funil: str(r.funil),
            etapa: str(r.etapa),
            status: str(r.status),
            situacao: str(r.situacao),
            origem: str(r.origem),
            owner: str(r.responsavel),
            valor: num(r.valor),
            data_fechamento: iso(r.closed_at),
            fonte: "piperun_export",
            dedupe_key: `deal_snapshot:${entityId}`,
          },
        });
      }
    }

    if (out.length === 0) {
      return new Response(JSON.stringify({ ok: true, received: rows.length, inserted: 0, unresolved, no_date: noDate }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Dedupe contra o banco -----------------------------------------
    const evType = out[0].event_type as string;
    const ids = [...new Set(out.map((o) => o.entity_id as string))];
    const existing = new Set<string>();
    for (let i = 0; i < ids.length; i += 300) {
      const { data } = await supabase.from("lead_activity_log")
        .select("entity_id")
        .eq("event_type", evType)
        .in("entity_id", ids.slice(i, i + 300));
      for (const e of data || []) existing.add(String(e.entity_id));
    }

    const seen = new Set<string>();
    const toInsert = out.filter((o) => {
      const id = o.entity_id as string;
      if (existing.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    let inserted = 0;
    const errors: string[] = [];
    for (let i = 0; i < toInsert.length; i += 200) {
      const chunk = toInsert.slice(i, i + 200);
      const { error } = await supabase.from("lead_activity_log").insert(chunk);
      if (error) { if (errors.length < 5) errors.push(error.message); }
      else inserted += chunk.length;
    }

    return new Response(
      JSON.stringify({
        ok: true, kind, received: rows.length, normalized: out.length,
        skipped_existing: out.length - toInsert.length, inserted, unresolved, no_date: noDate, errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});