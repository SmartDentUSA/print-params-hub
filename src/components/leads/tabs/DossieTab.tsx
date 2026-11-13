import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";

interface Dossier {
  content: string;
  model: string;
  generated_at: string;
  sources?: { negocios?: number; notas_fiscais?: number; chamados?: number; eventos?: number };
}

async function callDossier(leadId: string, action: "get" | "generate") {
  const { data, error } = await supabase.functions.invoke("lead-dossier", { body: { lead_id: leadId, action } });
  if (error) {
    let msg = "Não foi possível carregar o dossiê.";
    let forbidden = false;
    try {
      const body = await (error as any).context?.json?.();
      if (body?.error) msg = body.error;
      forbidden = body?.code === "forbidden";
    } catch { /* mantém mensagem padrão */ }
    return { error: msg, forbidden };
  }
  return { dossier: (data?.dossier ?? null) as Dossier | null, cooldown: !!data?.cooldown };
}

export function DossieTab({ leadId }: { leadId: string }) {
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null); setDossier(null); setForbidden(false);
    callDossier(leadId, "get").then((r) => {
      if (!alive) return;
      if ("error" in r && r.error) { setError(r.error); setForbidden(!!r.forbidden); }
      else setDossier(r.dossier ?? null);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [leadId]);

  const generate = useCallback(async () => {
    setGenerating(true); setError(null);
    const r = await callDossier(leadId, "generate");
    if ("error" in r && r.error) setError(r.error);
    else if (r.dossier) setDossier(r.dossier);
    setGenerating(false);
  }, [leadId]);

  const s = dossier?.sources;
  const when = dossier ? new Date(dossier.generated_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null;

  return (
    <div className="tab-content">
      <div className="ai-panel">
        <div className="ai-panel-header">
          <span>📝</span>
          <span>Dossiê do lead — resumo para o vendedor antes do contato</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <span className="badge badge-ai">Claude Sonnet 5</span>
            {!forbidden && (
              <button
                onClick={generate}
                disabled={generating || loading}
                style={{
                  background: "rgba(79,143,255,.15)", border: "1px solid rgba(79,143,255,.3)", color: "var(--blue)",
                  padding: "3px 10px", borderRadius: 6, fontSize: 11,
                  cursor: generating || loading ? "default" : "pointer", opacity: generating || loading ? 0.5 : 1,
                }}
              >
                {generating ? "⏳ Gerando..." : dossier ? "↺ Atualizar dossiê" : "✦ Gerar dossiê"}
              </button>
            )}
          </div>
        </div>
        <div className={`ai-panel-body${generating ? " loading" : ""}`}>
          {loading ? (
            <div style={{ color: "var(--muted2)", fontSize: 12 }}>Carregando...</div>
          ) : generating ? (
            <><div className="live-dot" />Lendo negócios, notas fiscais, suporte e linha do tempo do lead...</>
          ) : (
            <>
              {error && <div style={{ color: "var(--red, #f87171)", fontSize: 12, marginBottom: dossier ? 12 : 0 }}>{error}</div>}
              {dossier ? (
                <div className="lead-dossier-md" style={{ lineHeight: 1.65, fontSize: 13 }}>
                  <ReactMarkdown>{dossier.content}</ReactMarkdown>
                </div>
              ) : !error && (
                <div style={{ color: "var(--muted)", fontSize: 12 }}>
                  Nenhum dossiê ainda. Clique em "✦ Gerar dossiê" para montar o resumo com base no histórico completo do lead.
                </div>
              )}
            </>
          )}
        </div>
        {dossier && !generating && (
          <div style={{ padding: "8px 14px", fontSize: 11, color: "var(--muted)", borderTop: "1px solid var(--border)" }}>
            Gerado em {when}
            {s && <> · baseado em {s.negocios ?? 0} negócios, {s.notas_fiscais ?? 0} notas fiscais, {s.chamados ?? 0} chamados e {s.eventos ?? 0} eventos</>}
            {" "}· confira os dados antes de usar com o cliente.
          </div>
        )}
      </div>
    </div>
  );
}
