import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { Search, Download, ChevronLeft, ChevronRight, Brain, Route, Tag, Zap, Target, Pencil, Save, X } from "lucide-react";
import { SmartOpsLeadImporter } from "./SmartOpsLeadImporter";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { key: "all", label: "Todos" },
  { key: "novo", label: "Novo" },
  { key: "sem_contato", label: "Sem Contato" },
  { key: "contato_feito", label: "Contato Feito" },
  { key: "em_contato", label: "Em Contato" },
  { key: "apresentacao", label: "Apresentação" },
  { key: "proposta_enviada", label: "Proposta Enviada" },
  { key: "negociacao", label: "Negociação" },
  { key: "fechamento", label: "Fechamento" },
];

const TEMP_OPTIONS = [
  { key: "all", label: "Todas" },
  { key: "quente", label: "🔥 Quente" },
  { key: "morno", label: "🌤 Morno" },
  { key: "frio", label: "❄️ Frio" },
];

const STAGE_OPTIONS = [
  { key: "all", label: "Todos Estágios" },
  { key: "MQL_pesquisador", label: "🔍 MQL" },
  { key: "SAL_comparador", label: "🔄 SAL" },
  { key: "SQL_decisor", label: "✅ SQL" },
  { key: "CLIENTE_ativo", label: "👑 Cliente" },
];

const PAGE_SIZE = 50;

const PRODUCT_FLAGS = ["scan", "notebook", "cad", "cad_ia", "smart_slice", "print", "cura", "insumos"] as const;

interface LeadFull {
  [key: string]: unknown;
  id: string;
  nome: string;
  email: string;
  telefone_raw: string | null;
  telefone_normalized: string | null;
  source: string;
  form_name: string | null;
  lead_status: string;
  score: number | null;
  created_at: string;
  updated_at: string;
  data_primeiro_contato: string | null;
  area_atuacao: string | null;
  especialidade: string | null;
  como_digitaliza: string | null;
  tem_impressora: string | null;
  impressora_modelo: string | null;
  resina_interesse: string | null;
  produto_interesse: string | null;
  origem_campanha: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  proprietario_lead_crm: string | null;
  status_atual_lead_crm: string | null;
  funil_entrada_crm: string | null;
  piperun_id: string | null;
  id_cliente_smart: string | null;
  rota_inicial_lia: string | null;
  resumo_historico_ia: string | null;
  reuniao_agendada: boolean | null;
  data_contrato: string | null;
  cs_treinamento: string | null;
  ativo_scan: boolean | null;
  ativo_notebook: boolean | null;
  ativo_cad: boolean | null;
  ativo_cad_ia: boolean | null;
  ativo_smart_slice: boolean | null;
  ativo_print: boolean | null;
  ativo_cura: boolean | null;
  ativo_insumos: boolean | null;
  status_oportunidade: string | null;
  valor_oportunidade: number | null;
  tags_crm: string[] | null;
  temperatura_lead: string | null;
  motivo_perda: string | null;
  comentario_perda: string | null;
  cidade: string | null;
  uf: string | null;
  tem_scanner: string | null;
  data_fechamento_crm: string | null;
  lead_timing_dias: number | null;
  itens_proposta_crm: string | null;
  piperun_link: string | null;
  ultima_etapa_comercial: string | null;
  software_cad: string | null;
  volume_mensal_pecas: string | null;
  principal_aplicacao: string | null;
  pais_origem: string | null;
  ip_origem: string | null;
  proactive_sent_at: string | null;
  proactive_count: number | null;
  // Cognitive fields
  cognitive_analysis: Record<string, unknown> | null;
  cognitive_updated_at: string | null;
  lead_stage_detected: string | null;
  interest_timeline: string | null;
  urgency_level: string | null;
  psychological_profile: string | null;
  primary_motivation: string | null;
  objection_risk: string | null;
  recommended_approach: string | null;
  confidence_score_analysis: number | null;
  prediction_accuracy: number | null;
}

// ─── TAG Color System ───
const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  J: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300" },
  EC: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300" },
  Q: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-300" },
  C: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300" },
  CS: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-300" },
  LIA: { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-300" },
  A: { bg: "bg-red-50", text: "text-red-700", border: "border-red-300" },
};

function getTagColor(tag: string) {
  if (tag.startsWith("J0")) return TAG_COLORS.J;
  if (tag.startsWith("EC_")) return TAG_COLORS.EC;
  if (tag.startsWith("Q_")) return TAG_COLORS.Q;
  if (tag.startsWith("CS_")) return TAG_COLORS.CS;
  if (tag.startsWith("C_")) return TAG_COLORS.C;
  if (tag.startsWith("LIA_")) return TAG_COLORS.LIA;
  if (tag.startsWith("A_")) return TAG_COLORS.A;
  return { bg: "bg-muted/50", text: "text-muted-foreground", border: "border-muted" };
}

function getTagCategory(tag: string): string {
  if (tag.startsWith("J0")) return "Jornada";
  if (tag.startsWith("EC_")) return "E-commerce";
  if (tag.startsWith("Q_")) return "Qualificação";
  if (tag.startsWith("CS_")) return "CS/Onboarding";
  if (tag.startsWith("C_")) return "Comercial";
  if (tag.startsWith("LIA_")) return "LIA";
  if (tag.startsWith("A_")) return "Alerta";
  return "Outros";
}

// Journey step visualization
const JOURNEY_STEPS = [
  { tag: "J01_CONSCIENCIA", label: "Consciência", emoji: "👀" },
  { tag: "J02_CONSIDERACAO", label: "Consideração", emoji: "🤔" },
  { tag: "J03_NEGOCIACAO", label: "Negociação", emoji: "🤝" },
  { tag: "J04_COMPRA", label: "Compra", emoji: "💰" },
  { tag: "J05_RETENCAO", label: "Retenção", emoji: "🔄" },
  { tag: "J06_APOIO", label: "Apoio", emoji: "⭐" },
];

function JourneyVisualizer({ tags }: { tags: string[] | null }) {
  if (!tags?.length) return null;
  const activeJourney = JOURNEY_STEPS.findIndex((s) => tags.includes(s.tag));
  if (activeJourney === -1) return null;

  return (
    <div className="flex items-center gap-1 py-2">
      {JOURNEY_STEPS.map((step, i) => {
        const isActive = tags.includes(step.tag);
        const isPast = i < activeJourney;
        return (
          <div key={step.tag} className="flex items-center">
            {i > 0 && <div className={`w-4 h-0.5 ${isPast || isActive ? "bg-primary" : "bg-muted"}`} />}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium border-2 ${
                    isActive ? "bg-primary text-primary-foreground border-primary" :
                    isPast ? "bg-primary/20 text-primary border-primary/40" :
                    "bg-muted text-muted-foreground border-muted"
                  }`}>
                    {step.emoji}
                  </div>
                </TooltipTrigger>
                <TooltipContent><p className="text-xs">{step.label}</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        );
      })}
    </div>
  );
}

function TagsBadges({ tags }: { tags: string[] | null }) {
  if (!tags?.length) return <span className="text-muted-foreground text-[10px]">—</span>;

  // Group by category
  const grouped: Record<string, string[]> = {};
  for (const tag of tags) {
    const cat = getTagCategory(tag);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(tag);
  }

  return (
    <div className="space-y-2">
      {Object.entries(grouped).map(([category, catTags]) => (
        <div key={category}>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">{category}</div>
          <div className="flex gap-1 flex-wrap">
            {catTags.map((tag) => {
              const color = getTagColor(tag);
              return (
                <Badge key={tag} variant="outline" className={`text-[9px] px-1.5 py-0 ${color.bg} ${color.text} ${color.border}`}>
                  {tag}
                </Badge>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function TagsSummaryBadges({ tags }: { tags: string[] | null }) {
  if (!tags?.length) return null;
  const shown = tags.slice(0, 3);
  return (
    <div className="flex gap-0.5 flex-wrap">
      {shown.map((tag) => {
        const color = getTagColor(tag);
        return (
          <Badge key={tag} variant="outline" className={`text-[8px] px-1 py-0 ${color.bg} ${color.text} ${color.border}`}>
            {tag.replace(/_/g, " ").slice(0, 12)}
          </Badge>
        );
      })}
      {tags.length > 3 && (
        <Badge variant="outline" className="text-[8px] px-1 py-0">+{tags.length - 3}</Badge>
      )}
    </div>
  );
}

function ActiveIcons({ lead }: { lead: LeadFull }) {
  const active = PRODUCT_FLAGS.filter((p) => lead[`ativo_${p}`] === true);
  if (active.length === 0) return <span className="text-muted-foreground text-[10px]">—</span>;
  return (
    <div className="flex gap-0.5 flex-wrap">
      {active.slice(0, 3).map((p) => (
        <Badge key={p} variant="outline" className="text-[9px] px-1 py-0 bg-green-50 text-green-700 border-green-300">
          {p.replace("_", " ").toUpperCase()}
        </Badge>
      ))}
      {active.length > 3 && (
        <Badge variant="outline" className="text-[9px] px-1 py-0">+{active.length - 3}</Badge>
      )}
    </div>
  );
}

function TempBadge({ temp }: { temp: string | null }) {
  if (!temp) return <span className="text-muted-foreground text-[10px]">—</span>;
  const t = temp.toLowerCase();
  if (t === "quente") return <Badge className="bg-destructive text-destructive-foreground text-[10px] px-1.5">🔥</Badge>;
  if (t === "morno") return <Badge className="bg-accent text-accent-foreground text-[10px] px-1.5">🌤</Badge>;
  return <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5">❄️</Badge>;
}

function StageBadge({ stage }: { stage: string | null }) {
  if (!stage) return null;
  const config: Record<string, { label: string; className: string }> = {
    MQL_pesquisador: { label: "MQL", className: "bg-muted text-muted-foreground border-muted" },
    SAL_comparador: { label: "SAL", className: "bg-primary/10 text-primary border-primary/30" },
    SQL_decisor: { label: "SQL", className: "bg-green-50 text-green-700 border-green-300" },
    CLIENTE_ativo: { label: "CLIENTE", className: "bg-purple-50 text-purple-700 border-purple-300" },
  };
  const c = config[stage] || { label: stage, className: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={`text-[9px] px-1.5 ${c.className}`}>{c.label}</Badge>;
}

function UrgencyIcon({ urgency }: { urgency: string | null }) {
  if (!urgency) return null;
  if (urgency === "alta") return <span title="Urgência alta" className="text-destructive">🔴</span>;
  if (urgency === "media") return <span title="Urgência média" className="text-accent-foreground">🟡</span>;
  return <span title="Urgência baixa" className="text-primary">🟢</span>;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function formatDateTime(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${dt.toLocaleDateString("pt-BR")} ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// ─── Proposal Items Parser ───
function parseItensProposta(raw: string | null) {
  if (!raw) return null;
  // Extract proposal number: (XXXX) PRO XXXXX or just PRO XXXXX
  const propostaMatch = raw.match(/(?:\((\d+)\)\s*)?(PRO\s*\d+)/);
  const proposalNumber = propostaMatch
    ? (propostaMatch[1] ? `(${propostaMatch[1]}) ${propostaMatch[2]}` : propostaMatch[2])
    : null;

  // Split items by ", PRO" or ", ("
  const parts = raw.split(/,\s*(?=PRO\s|(?:\(\d+\)\s*PRO\s))/).map((s) => s.trim()).filter(Boolean);

  const items: { qty: number; name: string; productCode?: string }[] = [];
  for (const part of parts) {
    const m = part.match(/(?:\((\d+)\)\s*)?PRO\s*\d+\s*\[(\d+(?:\.\d+)?)\]\s*(.+)/);
    if (m) {
      items.push({
        productCode: m[1] || undefined,
        qty: Math.round(parseFloat(m[2])),
        name: m[3].trim(),
      });
    }
  }

  return { proposalNumber, items };
}

function ProposalItemsDisplay({ raw }: { raw: string | null }) {
  const parsed = parseItensProposta(raw);
  if (!parsed || parsed.items.length === 0) return null;

  return (
    <div className="space-y-2">
      {parsed.proposalNumber && (
        <div className="p-2 rounded bg-muted/30 border">
          <div className="text-[10px] text-muted-foreground font-mono">N. Proposta</div>
          <div className="text-sm font-semibold">{parsed.proposalNumber}</div>
        </div>
      )}
      <div className="p-2 rounded bg-muted/30 border">
        <div className="text-[10px] text-muted-foreground font-mono mb-1">Itens da Proposta</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-7 px-2 text-[10px] w-14">Quant.</TableHead>
              <TableHead className="h-7 px-2 text-[10px]">Item</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parsed.items.map((item, i) => (
              <TableRow key={i}>
                <TableCell className="p-2 text-xs text-center">{item.qty}</TableCell>
                <TableCell className="p-2 text-xs">{item.name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function TruncatedText({ text, maxLen = 40 }: { text: string | null; maxLen?: number }) {
  if (!text) return <span className="text-muted-foreground">—</span>;
  if (text.length <= maxLen) return <span className="text-xs">{text}</span>;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-xs cursor-help">{text.slice(0, maxLen)}…</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm"><p className="text-sm">{text}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const ROUTE_LABELS: Record<string, string> = {
  parameters: "Parâmetros",
  products: "Produtos",
  commercial: "Comercial",
  support: "Suporte",
};

/* ─── Detail Modal Sections ─── */
function EditableDetailSection({ title, fields, editing, editValues, onFieldChange }: {
  title: string;
  fields: { label: string; value: unknown; fieldKey?: string; type?: "text" | "number" | "boolean" | "select"; options?: string[] }[];
  editing: boolean;
  editValues: Record<string, unknown>;
  onFieldChange: (key: string, value: unknown) => void;
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {fields.map((f) => {
          const currentValue = f.fieldKey && f.fieldKey in editValues ? editValues[f.fieldKey] : f.value;
          const isEmpty = currentValue === null || currentValue === undefined || currentValue === "";
          return (
            <div key={f.label} className={`p-2 rounded border ${isEmpty ? "bg-muted/10 border-dashed" : "bg-muted/30"}`}>
              <div className="text-[10px] text-muted-foreground font-mono">{f.label}</div>
              {editing && f.fieldKey ? (
                f.type === "boolean" ? (
                  <Checkbox
                    checked={!!currentValue}
                    onCheckedChange={(c) => onFieldChange(f.fieldKey!, !!c)}
                  />
                ) : f.type === "select" && f.options ? (
                  <Select value={String(currentValue || "")} onValueChange={(v) => onFieldChange(f.fieldKey!, v)}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {f.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : f.type === "number" ? (
                  <Input type="number" className="h-7 text-xs" value={currentValue != null ? String(currentValue) : ""} onChange={(e) => onFieldChange(f.fieldKey!, e.target.value ? Number(e.target.value) : null)} />
                ) : (
                  <Input className="h-7 text-xs" value={currentValue != null ? String(currentValue) : ""} onChange={(e) => onFieldChange(f.fieldKey!, e.target.value || null)} />
                )
              ) : (
                <div className="text-sm break-all">{formatValue(currentValue)}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetailSection({ title, fields }: { title: string; fields: { label: string; value: unknown }[] }) {
  const nonEmpty = fields.filter((f) => f.value !== null && f.value !== undefined && f.value !== "");
  if (nonEmpty.length === 0) return null;
  return (
    <EditableDetailSection title={title} fields={nonEmpty} editing={false} editValues={{}} onFieldChange={() => {}} />
  );
}

const STATUS_EDIT_OPTIONS = ["novo", "sem_contato", "contato_feito", "em_contato", "apresentacao", "proposta_enviada", "negociacao", "fechamento", "ganho", "perdido"];
const TEMP_EDIT_OPTIONS = ["quente", "morno", "frio"];
const OPORTUNIDADE_OPTIONS = ["aberta", "ganha", "perdida"];
const TREINAMENTO_OPTIONS = ["pendente", "agendado", "concluido"];

function LeadDetailDialog({ lead, onClose, onSaved }: {
  lead: LeadFull | null;
  onClose: () => void;
  onSaved: (updated: LeadFull) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  const handleFieldChange = (key: string, value: unknown) => {
    setEditValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!lead) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(editValues)) {
        updates[key] = value;
      }
      const { error } = await supabase
        .from("lia_attendances")
        .update(updates)
        .eq("id", lead.id);
      if (error) throw error;
      toast.success("Lead atualizado com sucesso");
      onSaved({ ...lead, ...updates } as LeadFull);
      setEditing(false);
      setEditValues({});
    } catch (err) {
      toast.error(`Erro ao salvar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setEditValues({});
  };

  if (!lead) return null;

  return (
    <Dialog open={!!lead} onOpenChange={(open) => { if (!open) { handleCancel(); onClose(); } }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Detalhes — {lead.nome}</DialogTitle>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button size="sm" variant="outline" onClick={handleCancel} disabled={saving}>
                    <X className="w-4 h-4 mr-1" /> Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    <Save className="w-4 h-4 mr-1" /> {saving ? "Salvando..." : "Salvar"}
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="w-4 h-4 mr-1" /> Editar
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* AI Summary */}
          {(lead.resumo_historico_ia || editing) && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-1.5 mb-1">
                <Brain className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-primary">Resumo IA do Histórico</span>
              </div>
              {editing ? (
                <Input className="text-sm" value={editValues.resumo_historico_ia != null ? String(editValues.resumo_historico_ia) : (lead.resumo_historico_ia || "")} onChange={(e) => handleFieldChange("resumo_historico_ia", e.target.value || null)} />
              ) : (
                <p className="text-sm">{lead.resumo_historico_ia}</p>
              )}
            </div>
          )}

          {/* Cognitive Analysis */}
          {lead.lead_stage_detected && (
            <div className="p-3 rounded-lg bg-accent/30 border border-accent">
              <div className="flex items-center gap-1.5 mb-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-primary">Análise Cognitiva</span>
                {lead.confidence_score_analysis != null && (
                  <Badge variant="outline" className="text-[9px] ml-auto">Confiança: {lead.confidence_score_analysis}%</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Estágio:</span> <StageBadge stage={lead.lead_stage_detected} /></div>
                <div><span className="text-muted-foreground">Urgência:</span> <UrgencyIcon urgency={lead.urgency_level} /> {lead.urgency_level}</div>
                <div><span className="text-muted-foreground">Timeline:</span> {lead.interest_timeline || "—"}</div>
                <div><span className="text-muted-foreground">Perfil:</span> {lead.psychological_profile || "—"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Motivação:</span> {lead.primary_motivation || "—"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Risco objeção:</span> {lead.objection_risk || "—"}</div>
                <div className="col-span-2 p-2 rounded bg-muted/50 border"><span className="text-muted-foreground font-semibold">Abordagem:</span> {lead.recommended_approach || "—"}</div>
              </div>
            </div>
          )}

          {/* Journey Visualizer */}
          {lead.tags_crm && lead.tags_crm.some((t) => t.startsWith("J0")) && (
            <div className="p-3 rounded-lg bg-muted/30 border">
              <div className="flex items-center gap-1.5 mb-1">
                <Route className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-muted-foreground uppercase">Jornada do Cliente</span>
              </div>
              <JourneyVisualizer tags={lead.tags_crm} />
            </div>
          )}

          {/* Route + badges */}
          <div className="flex gap-2 flex-wrap">
            {lead.rota_inicial_lia && (
              <Badge variant="secondary" className="gap-1">
                <Route className="w-3 h-3" />
                Rota: {ROUTE_LABELS[lead.rota_inicial_lia] || lead.rota_inicial_lia}
              </Badge>
            )}
            {lead.temperatura_lead && <TempBadge temp={lead.temperatura_lead} />}
            {lead.especialidade && (
              <Badge variant="outline">Especialidade: {lead.especialidade}</Badge>
            )}
          </div>

          {/* TAGs Section */}
          {lead.tags_crm && lead.tags_crm.length > 0 && (
            <div className="p-3 rounded-lg bg-muted/20 border">
              <div className="flex items-center gap-1.5 mb-2">
                <Tag className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase">TAGs ({lead.tags_crm.length})</span>
              </div>
              <TagsBadges tags={lead.tags_crm} />
            </div>
          )}

          {/* Editable Sections */}
          <EditableDetailSection title="Dados Pessoais" editing={editing} editValues={editValues} onFieldChange={handleFieldChange} fields={[
            { label: "Nome", value: lead.nome, fieldKey: "nome" },
            { label: "Email", value: lead.email, fieldKey: "email" },
            { label: "Telefone Raw", value: lead.telefone_raw, fieldKey: "telefone_raw" },
            { label: "Telefone Normalizado", value: lead.telefone_normalized, fieldKey: "telefone_normalized" },
            { label: "Cidade", value: lead.cidade, fieldKey: "cidade" },
            { label: "UF", value: lead.uf, fieldKey: "uf" },
            { label: "País", value: lead.pais_origem, fieldKey: "pais_origem" },
            { label: "Área de atuação", value: lead.area_atuacao, fieldKey: "area_atuacao" },
            { label: "Especialidade", value: lead.especialidade, fieldKey: "especialidade" },
            { label: "Aplicação principal", value: lead.principal_aplicacao, fieldKey: "principal_aplicacao" },
          ]} />

          <EditableDetailSection title="Comercial" editing={editing} editValues={editValues} onFieldChange={handleFieldChange} fields={[
            { label: "Status Lead", value: lead.lead_status, fieldKey: "lead_status", type: "select", options: STATUS_EDIT_OPTIONS },
            { label: "Temperatura", value: lead.temperatura_lead, fieldKey: "temperatura_lead", type: "select", options: TEMP_EDIT_OPTIONS },
            { label: "Produto de Interesse", value: lead.produto_interesse, fieldKey: "produto_interesse" },
            { label: "Resina de Interesse", value: lead.resina_interesse, fieldKey: "resina_interesse" },
            { label: "Score", value: lead.score, fieldKey: "score", type: "number" },
            { label: "Valor Oportunidade", value: lead.valor_oportunidade, fieldKey: "valor_oportunidade", type: "number" },
            { label: "Status Oportunidade", value: lead.status_oportunidade, fieldKey: "status_oportunidade", type: "select", options: OPORTUNIDADE_OPTIONS },
            { label: "Última Etapa Comercial", value: lead.ultima_etapa_comercial, fieldKey: "ultima_etapa_comercial" },
            { label: "Motivo Perda", value: lead.motivo_perda, fieldKey: "motivo_perda" },
            { label: "Comentário Perda", value: lead.comentario_perda, fieldKey: "comentario_perda" },
            { label: "Reunião Agendada", value: lead.reuniao_agendada, fieldKey: "reuniao_agendada", type: "boolean" },
          ]} />

          <EditableDetailSection title="CRM / PipeRun" editing={editing} editValues={editValues} onFieldChange={handleFieldChange} fields={[
            { label: "PipeRun ID", value: lead.piperun_id, fieldKey: "piperun_id" },
            { label: "PipeRun Link", value: lead.piperun_link, fieldKey: "piperun_link" },
            { label: "Proprietário", value: lead.proprietario_lead_crm, fieldKey: "proprietario_lead_crm" },
            { label: "Status CRM", value: lead.status_atual_lead_crm, fieldKey: "status_atual_lead_crm" },
            { label: "Funil", value: lead.funil_entrada_crm, fieldKey: "funil_entrada_crm" },
            { label: "Itens Proposta", value: lead.itens_proposta_crm, fieldKey: "itens_proposta_crm" },
            { label: "Data Fechamento CRM", value: lead.data_fechamento_crm, fieldKey: "data_fechamento_crm" },
          ]} />
          {!editing && <ProposalItemsDisplay raw={lead.itens_proposta_crm} />}

          <EditableDetailSection title="Equipamentos / Técnico" editing={editing} editValues={editValues} onFieldChange={handleFieldChange} fields={[
            { label: "Tem impressora", value: lead.tem_impressora, fieldKey: "tem_impressora" },
            { label: "Modelo impressora", value: lead.impressora_modelo, fieldKey: "impressora_modelo" },
            { label: "Software CAD", value: lead.software_cad, fieldKey: "software_cad" },
            { label: "Como digitaliza", value: lead.como_digitaliza, fieldKey: "como_digitaliza" },
            { label: "Tem scanner", value: lead.tem_scanner, fieldKey: "tem_scanner" },
            { label: "Volume mensal peças", value: lead.volume_mensal_pecas, fieldKey: "volume_mensal_pecas" },
          ]} />

          <EditableDetailSection title="Soluções de Interesse (SDR)" editing={editing} editValues={editValues} onFieldChange={handleFieldChange} fields={[
            { label: "Scanner", value: (lead as Record<string, unknown>).sdr_scanner_interesse, fieldKey: "sdr_scanner_interesse" },
            { label: "Impressora", value: (lead as Record<string, unknown>).sdr_impressora_interesse, fieldKey: "sdr_impressora_interesse" },
            { label: "Software CAD", value: (lead as Record<string, unknown>).sdr_software_cad_interesse, fieldKey: "sdr_software_cad_interesse" },
            { label: "Caracterização", value: (lead as Record<string, unknown>).sdr_caracterizacao_interesse, fieldKey: "sdr_caracterizacao_interesse" },
            { label: "Cursos", value: (lead as Record<string, unknown>).sdr_cursos_interesse, fieldKey: "sdr_cursos_interesse" },
            { label: "Dentística", value: (lead as Record<string, unknown>).sdr_dentistica_interesse, fieldKey: "sdr_dentistica_interesse" },
            { label: "Insumos Lab", value: (lead as Record<string, unknown>).sdr_insumos_lab_interesse, fieldKey: "sdr_insumos_lab_interesse" },
            { label: "Pós-impressão", value: (lead as Record<string, unknown>).sdr_pos_impressao_interesse, fieldKey: "sdr_pos_impressao_interesse" },
            { label: "Soluções", value: (lead as Record<string, unknown>).sdr_solucoes_interesse, fieldKey: "sdr_solucoes_interesse" },
            { label: "Marca param.", value: (lead as Record<string, unknown>).sdr_marca_impressora_param, fieldKey: "sdr_marca_impressora_param" },
            { label: "Modelo param.", value: (lead as Record<string, unknown>).sdr_modelo_impressora_param, fieldKey: "sdr_modelo_impressora_param" },
            { label: "Resina param.", value: (lead as Record<string, unknown>).sdr_resina_param, fieldKey: "sdr_resina_param" },
            { label: "Suporte Equipamento", value: (lead as Record<string, unknown>).sdr_suporte_equipamento, fieldKey: "sdr_suporte_equipamento" },
            { label: "Tipo Suporte", value: (lead as Record<string, unknown>).sdr_suporte_tipo, fieldKey: "sdr_suporte_tipo" },
            { label: "Descrição Suporte", value: (lead as Record<string, unknown>).sdr_suporte_descricao, fieldKey: "sdr_suporte_descricao" },
          ]} />

          <EditableDetailSection title="Campanha / UTM" editing={editing} editValues={editValues} onFieldChange={handleFieldChange} fields={[
            { label: "Source", value: lead.source, fieldKey: "source" },
            { label: "Form Name", value: lead.form_name, fieldKey: "form_name" },
            { label: "Origem Campanha", value: lead.origem_campanha, fieldKey: "origem_campanha" },
            { label: "utm_source", value: lead.utm_source, fieldKey: "utm_source" },
            { label: "utm_medium", value: lead.utm_medium, fieldKey: "utm_medium" },
            { label: "utm_campaign", value: lead.utm_campaign, fieldKey: "utm_campaign" },
            { label: "utm_term", value: lead.utm_term, fieldKey: "utm_term" },
            { label: "IP Origem", value: lead.ip_origem, fieldKey: "ip_origem" },
          ]} />

          <EditableDetailSection title="IA / LIA" editing={editing} editValues={editValues} onFieldChange={handleFieldChange} fields={[
            { label: "Rota Inicial LIA", value: lead.rota_inicial_lia, fieldKey: "rota_inicial_lia" },
            { label: "ID Cliente Smart", value: lead.id_cliente_smart, fieldKey: "id_cliente_smart" },
            { label: "CS Treinamento", value: lead.cs_treinamento, fieldKey: "cs_treinamento", type: "select", options: TREINAMENTO_OPTIONS },
            { label: "Proativo enviado em", value: lead.proactive_sent_at ? formatDateTime(lead.proactive_sent_at) : null },
            { label: "Proativos enviados", value: lead.proactive_count },
          ]} />

          <EditableDetailSection title="Ativos (Produtos)" editing={editing} editValues={editValues} onFieldChange={handleFieldChange} fields={[
            ...PRODUCT_FLAGS.map((p) => ({
              label: `Ativo ${p.replace("_", " ").toUpperCase()}`,
              value: lead[`ativo_${p}`],
              fieldKey: `ativo_${p}`,
              type: "boolean" as const,
            })),
          ]} />

          <EditableDetailSection title="Datas" editing={editing} editValues={editValues} onFieldChange={handleFieldChange} fields={[
            { label: "Criado em", value: formatDateTime(lead.created_at) },
            { label: "Atualizado em", value: formatDateTime(lead.updated_at) },
            { label: "1º Contato", value: lead.data_primeiro_contato ? formatDateTime(lead.data_primeiro_contato) : null },
            { label: "Data Contrato", value: lead.data_contrato ? formatDate(lead.data_contrato) : null },
            { label: "Lead Timing (dias)", value: lead.lead_timing_dias, fieldKey: "lead_timing_dias", type: "number" },
          ]} />

          {/* Astron Section */}
          <EditableDetailSection title="Astron (EAD)" editing={false} editValues={{}} onFieldChange={() => {}} fields={[
            { label: "Status", value: (lead as Record<string, unknown>).astron_status },
            { label: "Nome", value: (lead as Record<string, unknown>).astron_nome },
            { label: "Email", value: (lead as Record<string, unknown>).astron_email },
            { label: "Planos ativos", value: (lead as Record<string, unknown>).astron_plans_active ? ((lead as Record<string, unknown>).astron_plans_active as string[]).join(", ") : null },
            { label: "Cursos completados", value: (lead as Record<string, unknown>).astron_courses_completed },
            { label: "Total cursos", value: (lead as Record<string, unknown>).astron_courses_total },
            { label: "Último login", value: (lead as Record<string, unknown>).astron_last_login_at ? formatDateTime(String((lead as Record<string, unknown>).astron_last_login_at)) : null },
            { label: "Sincronizado em", value: (lead as Record<string, unknown>).astron_synced_at ? formatDateTime(String((lead as Record<string, unknown>).astron_synced_at)) : null },
          ]} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SmartOpsLeadsList() {
  const [leads, setLeads] = useState<LeadFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [tempFilter, setTempFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [stagnantOnly, setStagnantOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedLead, setSelectedLead] = useState<LeadFull | null>(null);

  const fetchLeads = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("lia_attendances")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    setLeads((data as LeadFull[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchLeads(); }, []);

  const sources = useMemo(() => [...new Set(leads.map((l) => l.source))].sort(), [leads]);

  const thirtyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }, []);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (statusFilter !== "all" && l.lead_status !== statusFilter) return false;
      if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
      if (tempFilter !== "all" && (l.temperatura_lead || "").toLowerCase() !== tempFilter) return false;
      if (stageFilter !== "all" && l.lead_stage_detected !== stageFilter) return false;
      if (stagnantOnly && l.updated_at > thirtyDaysAgo) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!l.nome.toLowerCase().includes(q) && !l.email.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [leads, search, statusFilter, sourceFilter, tempFilter, stageFilter, stagnantOnly, thirtyDaysAgo]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => { setPage(0); }, [search, statusFilter, sourceFilter, tempFilter, stageFilter, stagnantOnly]);

  const exportCSV = () => {
    const headers = ["nome", "email", "telefone_normalized", "produto_interesse", "lead_status", "temperatura_lead", "ultima_etapa_comercial", "score", "proprietario_lead_crm", "source", "rota_inicial_lia", "resumo_historico_ia", "created_at"];
    const csv = [headers.join(","), ...filtered.map((l) => headers.map((h) => `"${formatValue((l as Record<string, unknown>)[h])}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_smartops_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando leads...</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
            <CardTitle className="text-lg">Lista de Leads ({filtered.length})</CardTitle>
            <div className="flex gap-2">
              <SmartOpsLeadImporter onComplete={fetchLeads} />
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download className="w-4 h-4 mr-1" /> CSV
              </Button>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-2 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar nome ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {sources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={tempFilter} onValueChange={setTempFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Temp." /></SelectTrigger>
              <SelectContent>
                {TEMP_OPTIONS.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estágio Cogn." /></SelectTrigger>
              <SelectContent>
                {STAGE_OPTIONS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <Checkbox id="stagnant" checked={stagnantOnly} onCheckedChange={(c) => setStagnantOnly(!!c)} />
              <label htmlFor="stagnant" className="text-xs whitespace-nowrap cursor-pointer">Estagnados (&gt;30d)</label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>🌡️</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>TAGs</TableHead>
                  <TableHead>Resumo IA</TableHead>
                  <TableHead>Oport.</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Proprietário</TableHead>
                  <TableHead>Cognitivo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ativos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((lead) => (
                  <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLead(lead)}>
                    <TableCell className="font-medium whitespace-nowrap">
                      <div>{lead.nome}</div>
                      <div className="text-[10px] text-muted-foreground">{lead.email}</div>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {lead.cidade && lead.uf ? `${lead.cidade}/${lead.uf}` : lead.uf || "—"}
                    </TableCell>
                    <TableCell className="text-xs">{lead.produto_interesse || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{lead.lead_status}</Badge></TableCell>
                    <TableCell><TempBadge temp={lead.temperatura_lead} /></TableCell>
                    <TableCell className="text-xs max-w-[100px]">
                      <TruncatedText text={lead.ultima_etapa_comercial} maxLen={20} />
                    </TableCell>
                    <TableCell className="max-w-[150px]">
                      <TagsSummaryBadges tags={lead.tags_crm} />
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <TruncatedText text={lead.resumo_historico_ia} maxLen={35} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={lead.status_oportunidade === "ganha" ? "default" : lead.status_oportunidade === "perdida" ? "destructive" : "secondary"} className="text-[10px]">
                        {lead.status_oportunidade || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono">
                      {lead.valor_oportunidade ? `R$ ${Number(lead.valor_oportunidade).toLocaleString("pt-BR")}` : "—"}
                    </TableCell>
                    <TableCell className="text-center">{lead.score ?? 0}</TableCell>
                    <TableCell className="text-xs">{lead.proprietario_lead_crm || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <StageBadge stage={lead.lead_stage_detected} />
                        <UrgencyIcon urgency={lead.urgency_level} />
                        {lead.recommended_approach && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild><Target className="w-3 h-3 text-muted-foreground cursor-help" /></TooltipTrigger>
                              <TooltipContent className="max-w-xs"><p className="text-xs">{lead.recommended_approach}</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(lead.created_at)}</TableCell>
                    <TableCell><ActiveIcons lead={lead} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editable Detail Dialog */}
      <LeadDetailDialog
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onSaved={(updated) => {
          setLeads((prev) => prev.map((l) => l.id === updated.id ? { ...l, ...updated } : l));
          setSelectedLead(null);
        }}
      />
    </div>
  );
}
