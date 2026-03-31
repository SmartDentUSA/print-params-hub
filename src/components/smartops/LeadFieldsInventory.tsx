import React, { useState, useMemo } from "react";

const PREFIX_GROUPS: Record<string, { label: string; icon: string }> = {
  equip_: { label: "Equipamentos", icon: "🔧" },
  sdr_: { label: "SDR & Captação", icon: "📱" },
  omie_: { label: "Omie ERP", icon: "🏭" },
  piperun_: { label: "PipeRun CRM", icon: "📊" },
  lojaintegrada_: { label: "Loja Integrada", icon: "🛒" },
  empresa_: { label: "Empresa", icon: "🏢" },
  pessoa_: { label: "Pessoa", icon: "👤" },
  hits_: { label: "Hits (Vendas)", icon: "📈" },
  astron_: { label: "Astron Academy", icon: "🎓" },
  cognitive_: { label: "Análise Cognitiva", icon: "🧠" },
  sellflux_: { label: "SellFlux", icon: "📨" },
  frete_: { label: "Frete", icon: "🚚" },
  timeline_: { label: "Timelines", icon: "⏱️" },
  platform_: { label: "Plataforma Ads", icon: "📣" },
  utm_: { label: "UTM", icon: "🔗" },
  data_ultima_compra_: { label: "Última Compra", icon: "🛍️" },
  ativo_: { label: "Ativos", icon: "✅" },
  status_: { label: "Status", icon: "🏷️" },
  last_form_: { label: "Último Formulário", icon: "📝" },
  intelligence_: { label: "Intelligence Score", icon: "🎯" },
  workflow_: { label: "Workflow", icon: "🔄" },
  imersao_: { label: "Imersão", icon: "🏫" },
  nps_: { label: "NPS", icon: "⭐" },
  recompra_: { label: "Recompra", icon: "🔄" },
  next_: { label: "Previsões", icon: "🔮" },
  ltv_: { label: "LTV", icon: "💰" },
  academy_: { label: "Academy", icon: "📚" },
  map_fresadora_: { label: "Mapeamento Fresadora", icon: "🔩" },
  crm_lock_: { label: "CRM Lock", icon: "🔒" },
  suporte_: { label: "Suporte", icon: "🎧" },
  cs_: { label: "Customer Success", icon: "🤝" },
  lead_: { label: "Lead Info", icon: "🧩" },
  resina_: { label: "Resinas", icon: "🧪" },
  impressora_: { label: "Impressora", icon: "🖨️" },
};

// Sorted by longest prefix first to match more specific prefixes
const SORTED_PREFIXES = Object.keys(PREFIX_GROUPS).sort((a, b) => b.length - a.length);

function getGroup(key: string): string {
  for (const prefix of SORTED_PREFIXES) {
    if (key.startsWith(prefix)) return prefix;
  }
  return "__general__";
}

function isFilled(value: any): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) return false;
  return true;
}

function formatValue(value: any): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "object") {
    const json = JSON.stringify(value);
    return json.length > 120 ? json.slice(0, 117) + "…" : json;
  }
  const str = String(value);
  return str.length > 120 ? str.slice(0, 117) + "…" : str;
}

interface GroupData {
  label: string;
  icon: string;
  fields: { key: string; value: any; filled: boolean }[];
  filledCount: number;
}

interface Props {
  lead: Record<string, any>;
}

export default function LeadFieldsInventory({ lead }: Props) {
  const [search, setSearch] = useState("");
  const [onlyFilled, setOnlyFilled] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const { groups, totalFilled, totalFields } = useMemo(() => {
    const map: Record<string, GroupData> = {};
    const keys = Object.keys(lead).sort();
    let filled = 0;

    for (const key of keys) {
      const groupKey = getGroup(key);
      const f = isFilled(lead[key]);
      if (f) filled++;

      if (!map[groupKey]) {
        const meta = groupKey === "__general__"
          ? { label: "Geral", icon: "📋" }
          : PREFIX_GROUPS[groupKey];
        map[groupKey] = { label: meta.label, icon: meta.icon, fields: [], filledCount: 0 };
      }
      map[groupKey].fields.push({ key, value: lead[key], filled: f });
      if (f) map[groupKey].filledCount++;
    }

    // Sort groups: filled% desc, then alphabetical
    const sorted = Object.entries(map).sort(([, a], [, b]) => {
      const aRatio = a.filledCount / a.fields.length;
      const bRatio = b.filledCount / b.fields.length;
      if (bRatio !== aRatio) return bRatio - aRatio;
      return a.label.localeCompare(b.label);
    });

    return { groups: sorted, totalFilled: filled, totalFields: keys.length };
  }, [lead]);

  const toggle = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const lowerSearch = search.toLowerCase();

  return (
    <div style={{ marginTop: 20, background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 12, padding: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
          📋 Inventário Completo de Campos ({totalFilled}/{totalFields})
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={onlyFilled}
              onChange={(e) => setOnlyFilled(e.target.checked)}
              style={{ accentColor: "var(--accent)" }}
            />
            Só preenchidos
          </label>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Buscar campo ou valor…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%", padding: "6px 10px", fontSize: 12,
          background: "var(--surface3)", border: "1px solid var(--border2)",
          borderRadius: 8, color: "var(--text)", marginBottom: 12, outline: "none",
        }}
      />

      {/* Groups */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {groups.map(([groupKey, group]) => {
          const filteredFields = group.fields.filter((f) => {
            if (onlyFilled && !f.filled) return false;
            if (lowerSearch) {
              const valStr = formatValue(f.value).toLowerCase();
              return f.key.toLowerCase().includes(lowerSearch) || valStr.includes(lowerSearch);
            }
            return true;
          });

          if (filteredFields.length === 0) return null;

          const isOpen = openGroups.has(groupKey);
          const filledInFiltered = filteredFields.filter((f) => f.filled).length;

          return (
            <div key={groupKey} style={{ border: "1px solid var(--border2)", borderRadius: 8, overflow: "hidden" }}>
              <button
                onClick={() => toggle(groupKey)}
                style={{
                  width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 12px", background: "var(--surface3)", border: "none",
                  cursor: "pointer", color: "var(--text)", fontSize: 12, fontWeight: 500,
                }}
              >
                <span>{isOpen ? "▼" : "▶"} {group.icon} {group.label}</span>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>
                  {filledInFiltered}/{filteredFields.length}
                </span>
              </button>
              {isOpen && (
                <div style={{ padding: "4px 8px 8px", maxHeight: 400, overflowY: "auto" }}>
                  {filteredFields.map((f) => (
                    <div
                      key={f.key}
                      style={{
                        display: "flex", gap: 8, alignItems: "flex-start",
                        padding: "3px 4px", fontSize: 11, borderBottom: "1px solid var(--border2)",
                      }}
                    >
                      <span style={{ flexShrink: 0, width: 16, textAlign: "center" }}>
                        {f.filled ? "✅" : "⬜"}
                      </span>
                      <span style={{ color: "var(--muted)", minWidth: 180, flexShrink: 0, fontFamily: "monospace", fontSize: 10 }}>
                        {f.key}
                      </span>
                      <span style={{
                        color: f.filled ? "var(--text)" : "var(--muted)",
                        wordBreak: "break-all", opacity: f.filled ? 1 : 0.4,
                      }}>
                        {formatValue(f.value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
