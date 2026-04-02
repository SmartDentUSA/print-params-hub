import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Save, RefreshCw, Grid3X3, Package, Shield, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Stage definitions (same as WorkflowPortfolio) ───
const STAGES = [
  { key: "etapa_1_scanner", label: "1 · Captura Digital", cols: [
    { field: "scanner_intraoral", label: "Scanner Intraoral" },
    { field: "scanner_bancada", label: "Scanner Bancada" },
    { field: "notebook", label: "Notebook" },
    { field: "acessorios", label: "Acessórios" },
    { field: "pecas_partes", label: "Peças/Partes" },
  ]},
  { key: "etapa_2_cad", label: "2 · CAD", cols: [
    { field: "software", label: "Software" },
    { field: "creditos_ia", label: "Créditos IA CAD" },
    { field: "servico", label: "Serviço" },
  ]},
  { key: "etapa_3_impressao", label: "3 · Impressão 3D", cols: [
    { field: "resina", label: "Resina" },
    { field: "software_imp", label: "Software" },
    { field: "impressora", label: "Impressora" },
    { field: "acessorios", label: "Acessórios" },
    { field: "pecas_partes", label: "Peças/Partes" },
  ]},
  { key: "etapa_4_pos_impressao", label: "4 · Pós-Impressão", cols: [
    { field: "equipamentos", label: "Equipamentos" },
    { field: "limpeza_acabamento", label: "Limpeza/Acabamento" },
  ]},
  { key: "etapa_5_finalizacao", label: "5 · Finalização", cols: [
    { field: "caracterizacao", label: "Caracterização" },
    { field: "instalacao", label: "Instalação" },
    { field: "dentistica_orto", label: "Dentística/Orto" },
  ]},
  { key: "etapa_6_cursos", label: "6 · Cursos", cols: [
    { field: "presencial", label: "Presencial" },
    { field: "online", label: "Online" },
  ]},
  { key: "etapa_7_fresagem", label: "7 · Fresagem", cols: [
    { field: "equipamentos", label: "Equipamentos" },
    { field: "software", label: "Software" },
    { field: "servico", label: "Serviço" },
    { field: "acessorios", label: "Acessórios" },
    { field: "pecas_partes", label: "Peças/Partes" },
  ]},
];

const ACTION_TYPES = [
  { value: "upgrade", label: "Upgrade" },
  { value: "migration", label: "Migration" },
  { value: "cross_sell", label: "Cross-Sell" },
  { value: "upsell", label: "Upsell" },
  { value: "recompra", label: "Recompra" },
  { value: "complemento", label: "Complemento" },
  { value: "upsell_edu", label: "Upsell Educação" },
  { value: "reativacao", label: "Reativação" },
];

// Known competitor items by stage
const COMPETITOR_ITEMS: Record<string, string[]> = {
  etapa_1_scanner: [
    "Medit i500", "Medit i600", "Medit i700", "Medit i700 Wireless", "Medit i900",
    "Dentsply Sirona Omnicam", "Dentsply Sirona Omnicam AF", "Dentsply Sirona Primescan",
    "Align iTero Element E1", "Align iTero Element E2", "Align iTero 5D", "Align iTero 5D Plus", "Align iTero Lumina",
    "Shining 3D Aoralscan 2", "Shining 3D Aoralscan 3", "Shining 3D Aoralscan 3 Wireless",
    "Shining 3D Aoralscan Elite", "Shining 3D Aoralscan Elite Wireless",
    "Straumann Virtuo Vivo", "Straumann Sirius", "Straumann SIRIOS X3",
    "Dexis - Carestream CS 3600", "Dexis - Carestream CS 3700", "Dexis - Carestream CS 3800",
    "3DISC Heron IOS", "Planmeca Emerald", "Planmeca Emerald S",
    "Helios 500 Scanner", "Panda P3 Scanner", "Panda P2 Scanner",
    "Aidite Rapid 5 Scanner", "Eagle IOS", "Runyes IOS 3.0",
    "BLZ Dental INO 200", "BLZ Dental INO100 Plus", "BLZ Dental Leap 500",
    "Outros"
  ],
  etapa_3_impressao: [
    "Formlabs Form 3B+", "Formlabs Form 4B", "SprintRay Pro 95",
    "Asiga Max UV", "BEGO Varseo XS", "Ackuretta SOL",
    "Phrozen Sonic Mini 8K", "Elegoo Mars 4", "Anycubic Photon",
    "Outros"
  ],
};

interface CellMapping {
  id?: string;
  workflow_stage: string;
  workflow_cell: string;
  mapping_type: string;
  mapped_value: string;
  mapped_label?: string;
}

interface OpportunityRule {
  id?: string;
  workflow_stage: string;
  workflow_cell: string;
  source_item: string;
  action_type: string;
  target_product_name: string;
  useful_life_months: number;
  active: boolean;
}

interface FormField {
  id: string;
  label: string;
  db_column: string | null;
  custom_field_name: string | null;
  workflow_cell_target: string | null;
  form_id: string;
  field_type: string | null;
  options: any;
}

export function SmartOpsWorkflowMapper() {
  const [mappings, setMappings] = useState<CellMapping[]>([]);
  const [rules, setRules] = useState<OpportunityRule[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("sdr");

  // New mapping input state
  const [newMappingValue, setNewMappingValue] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [mappingsRes, rulesRes, productsRes, formFieldsRes] = await Promise.all([
      supabase.from("workflow_cell_mappings").select("*").order("created_at"),
      supabase.from("opportunity_rules").select("*").order("created_at"),
      supabase.from("system_a_catalog").select("id, name").eq("active", true).order("name"),
      supabase.from("smartops_form_fields" as any).select("id, label, db_column, custom_field_name, workflow_cell_target, form_id, field_type, options").order("order_index"),
    ]);
    setMappings((mappingsRes.data as CellMapping[]) || []);
    setRules((rulesRes.data as OpportunityRule[]) || []);
    setProducts(productsRes.data || []);
    setFormFields((formFieldsRes.data as unknown as FormField[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Mapping CRUD ───
  const addMapping = async (stage: string, cell: string, type: string, value: string, label?: string) => {
    const { error } = await supabase.from("workflow_cell_mappings").upsert({
      workflow_stage: stage,
      workflow_cell: cell,
      mapping_type: type,
      mapped_value: value,
      mapped_label: label || value,
    }, { onConflict: "workflow_stage,workflow_cell,mapping_type,mapped_value" });
    if (error) { toast.error(error.message); return; }
    toast.success("Mapeamento adicionado");
    fetchAll();
  };

  const removeMapping = async (id: string) => {
    await supabase.from("workflow_cell_mappings").delete().eq("id", id);
    toast.success("Mapeamento removido");
    fetchAll();
  };

  // ─── Rules CRUD ───
  const addRule = async (rule: Omit<OpportunityRule, "id" | "active">) => {
    const { error } = await supabase.from("opportunity_rules").insert({ ...rule, active: true });
    if (error) { toast.error(error.message); return; }
    toast.success("Regra adicionada");
    fetchAll();
  };

  const removeRule = async (id: string) => {
    await supabase.from("opportunity_rules").delete().eq("id", id);
    toast.success("Regra removida");
    fetchAll();
  };

  const toggleRule = async (id: string, active: boolean) => {
    await supabase.from("opportunity_rules").update({ active, updated_at: new Date().toISOString() }).eq("id", id);
    fetchAll();
  };

  // ─── Helpers ───
  const getMappingsForCell = (stage: string, cell: string, type: string) =>
    mappings.filter(m => m.workflow_stage === stage && m.workflow_cell === cell && m.mapping_type === type);

  const getRulesForStage = (stage: string) =>
    rules.filter(r => r.workflow_stage === stage);

  const getProductsForStage = (stage: string) => {
    const productMappings = mappings.filter(m => m.workflow_stage === stage && m.mapping_type === "product");
    return productMappings.map(m => m.mapped_value);
  };

  // ─── Render mapping grid ───
  const renderMappingGrid = (mappingType: string, getOptions: (stageKey: string) => string[], labelMap?: { value: string; label: string }[]) => (
    <div className="space-y-4">
      {STAGES.map(stage => (
        <Card key={stage.key} className="border-border/50">
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-sm font-semibold">{stage.label}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {stage.cols.map(col => {
                const cellMappings = getMappingsForCell(stage.key, col.field, mappingType);
                const options = getOptions(stage.key);
                return (
                  <div key={col.field} className="border rounded-lg p-2 bg-muted/30 min-h-[80px]">
                    <p className="text-xs font-medium text-muted-foreground mb-1">{col.label}</p>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {cellMappings.map(m => (
                        <Badge key={m.id} variant="secondary" className="text-[10px] gap-1 pr-1">
                          {m.mapped_label || m.mapped_value}
                          <button onClick={() => m.id && removeMapping(m.id)} className="ml-0.5 hover:text-destructive">×</button>
                        </Badge>
                      ))}
                    </div>
                    {mappingType === "competitor" ? (
                      <div className="flex gap-1">
                        <Input
                          placeholder="Adicionar..."
                          className="h-6 text-[10px]"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.target as HTMLInputElement).value) {
                              addMapping(stage.key, col.field, mappingType, (e.target as HTMLInputElement).value);
                              (e.target as HTMLInputElement).value = "";
                            }
                          }}
                        />
                      </div>
                    ) : options.length > 0 ? (
                      <Select onValueChange={(v) => {
                        const lbl = labelMap?.find(e => e.value === v)?.label;
                        addMapping(stage.key, col.field, mappingType, v, lbl);
                      }}>
                        <SelectTrigger className="h-6 text-[10px]">
                          <SelectValue placeholder="+ Adicionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {options
                            .filter(o => !cellMappings.some(m => m.mapped_value === o))
                            .map(o => {
                              const displayLabel = labelMap?.find(e => e.value === o)?.label || o;
                              return <SelectItem key={o} value={o} className="text-xs">{displayLabel}</SelectItem>;
                            })}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder="Adicionar..."
                        className="h-6 text-[10px]"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.target as HTMLInputElement).value) {
                            addMapping(stage.key, col.field, mappingType, (e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = "";
                          }
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // ─── SDR Fields: base + dynamic from form fields ───
  const SDR_FIELDS_BASE = [
    "tem_impressora", "tem_scanner", "impressora_modelo", "scanner_modelo",
    "software_cad", "volume_mensal_pecas", "area_atuacao", "especialidade",
    "como_digitaliza", "produto_interesse", "resina_interesse",
    "informacao_desejada", "cs_treinamento", "equip_scanner_marca",
    "equip_impressora_marca", "equip_software_cad", "equip_forno",
    "equip_lavadora", "equip_fresadora", "equip_fotopolimerizador",
  ];

  // Build dynamic field list with labels
  const dynamicFieldEntries = formFields
    .map(f => ({
      value: f.db_column || f.custom_field_name || f.id,
      label: `${f.label} (formulário)`,
    }))
    .filter(f => f.value);

  // Merge base + dynamic, deduplicate by value
  const allSDRFieldEntries = [
    ...SDR_FIELDS_BASE.map(f => ({ value: f, label: f })),
    ...dynamicFieldEntries.filter(df => !SDR_FIELDS_BASE.includes(df.value)),
  ];

  // For competitor tab: extract options from form fields with radio/select/checkbox
  const formFieldOptions = formFields
    .filter(f => ["radio", "select", "checkbox"].includes(f.field_type || "") && Array.isArray(f.options))
    .flatMap(f => (f.options as string[]).map(opt => `${opt} (${f.label})`));

  // ─── Render rules table ───
  const renderRulesTable = () => (
    <div className="space-y-4">
      {STAGES.map(stage => {
        const stageRules = getRulesForStage(stage.key);
        const stageProducts = getProductsForStage(stage.key);
        const stageCompetitors = mappings
          .filter(m => m.workflow_stage === stage.key && m.mapping_type === "competitor")
          .map(m => m.mapped_value);
        const allSourceItems = [...new Set([...stageCompetitors, ...stageProducts])];

        return (
          <Card key={stage.key} className="border-border/50">
            <CardHeader className="py-2 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">{stage.label}</CardTitle>
              <Badge variant="outline" className="text-xs">{stageRules.length} regras</Badge>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {stageRules.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Item Detectado</TableHead>
                      <TableHead className="text-xs">Tipo Ação</TableHead>
                      <TableHead className="text-xs">Produto do Mix</TableHead>
                      <TableHead className="text-xs">Tempo Útil (meses)</TableHead>
                      <TableHead className="text-xs w-[60px]">Ativo</TableHead>
                      <TableHead className="text-xs w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stageRules.map(rule => (
                      <TableRow key={rule.id} className={!rule.active ? "opacity-50" : ""}>
                        <TableCell className="text-xs py-1">{rule.source_item}</TableCell>
                        <TableCell className="text-xs py-1">
                          <Badge variant="outline" className="text-[10px]">
                            {ACTION_TYPES.find(a => a.value === rule.action_type)?.label || rule.action_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs py-1">{rule.target_product_name || "—"}</TableCell>
                        <TableCell className="text-xs py-1">{rule.useful_life_months}m</TableCell>
                        <TableCell className="py-1">
                          <button
                            onClick={() => rule.id && toggleRule(rule.id, !rule.active)}
                            className={`text-xs ${rule.active ? "text-green-600" : "text-muted-foreground"}`}
                          >
                            {rule.active ? "✅" : "⬜"}
                          </button>
                        </TableCell>
                        <TableCell className="py-1">
                          <button onClick={() => rule.id && removeRule(rule.id)} className="text-destructive hover:text-destructive/80">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <NewRuleForm
                stageKey={stage.key}
                sourceItems={allSourceItems}
                products={products.map(p => p.name)}
                onAdd={(rule) => addRule(rule)}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando mapeamentos...</div>;

  const totalMappings = mappings.length;
  const totalRules = rules.length;
  const activeRules = rules.filter(r => r.active).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">Mapeamento 7×3 — Motor de Regras</h3>
          <p className="text-xs text-muted-foreground">
            Configure produtos, campos SDR e concorrência para cada etapa do workflow. As regras alimentam LIA, Copilot e Análise Cognitiva.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Badge variant="secondary">{totalMappings} mapeamentos</Badge>
          <Badge variant="secondary">{activeRules}/{totalRules} regras ativas</Badge>
          <Button variant="outline" size="sm" onClick={fetchAll}>
            <RefreshCw className="w-3 h-3 mr-1" /> Atualizar
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sdr" className="gap-1"><BookOpen className="w-3 h-3" /> SDR / Interesse</TabsTrigger>
          <TabsTrigger value="products" className="gap-1"><Package className="w-3 h-3" /> Produtos SmartDent</TabsTrigger>
          <TabsTrigger value="competitors" className="gap-1"><Shield className="w-3 h-3" /> Concorrência</TabsTrigger>
          <TabsTrigger value="rules" className="gap-1"><Grid3X3 className="w-3 h-3" /> Regras de Oportunidade</TabsTrigger>
        </TabsList>

        <TabsContent value="sdr">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Campos SDR / Interesse → Células do Workflow</CardTitle>
              <p className="text-xs text-muted-foreground">Vincule campos do lead (lia_attendances) que indicam interesse em cada célula do fluxo 7×3</p>
            </CardHeader>
            <CardContent>
              {renderMappingGrid("sdr_field", () => allSDRFieldEntries.map(e => e.value), allSDRFieldEntries)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Produtos SmartDent → Células do Workflow</CardTitle>
              <p className="text-xs text-muted-foreground">Mapeie quais produtos do catálogo pertencem a cada célula do fluxo</p>
            </CardHeader>
            <CardContent>
              {renderMappingGrid("product", () => products.map(p => p.name))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="competitors">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Concorrência → Células do Workflow</CardTitle>
              <p className="text-xs text-muted-foreground">Identifique equipamentos de concorrentes que os leads possuem. Digite ou selecione dos itens pré-cadastrados.</p>
            </CardHeader>
            <CardContent>
              {renderMappingGrid("competitor", (stageKey) => COMPETITOR_ITEMS[stageKey] || [])}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Regras de Oportunidade</CardTitle>
              <p className="text-xs text-muted-foreground">
                Defina ações quando um item é detectado: tipo de ação, produto recomendado e tempo útil (meses antes de gerar oportunidade).
                Estas regras são usadas pela LIA, Copilot e Análise Cognitiva.
              </p>
            </CardHeader>
            <CardContent>
              {renderRulesTable()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── New Rule Form ───
function NewRuleForm({ stageKey, sourceItems, products, onAdd }: {
  stageKey: string;
  sourceItems: string[];
  products: string[];
  onAdd: (rule: Omit<OpportunityRule, "id" | "active">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [sourceItem, setSourceItem] = useState("");
  const [actionType, setActionType] = useState("");
  const [targetProduct, setTargetProduct] = useState("");
  const [months, setMonths] = useState("12");

  if (!open) return (
    <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setOpen(true)}>
      <Plus className="w-3 h-3 mr-1" /> Adicionar Regra
    </Button>
  );

  const handleSubmit = () => {
    if (!sourceItem || !actionType) { toast.error("Preencha item e tipo de ação"); return; }
    onAdd({
      workflow_stage: stageKey,
      workflow_cell: "",
      source_item: sourceItem,
      action_type: actionType,
      target_product_name: targetProduct,
      useful_life_months: parseInt(months) || 12,
    });
    setSourceItem(""); setActionType(""); setTargetProduct(""); setMonths("12");
    setOpen(false);
  };

  return (
    <div className="mt-2 flex flex-wrap gap-2 items-end border-t pt-2">
      <div className="flex-1 min-w-[150px]">
        <label className="text-[10px] text-muted-foreground">Item Detectado</label>
        {sourceItems.length > 0 ? (
          <Select value={sourceItem} onValueChange={setSourceItem}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {sourceItems.map(i => <SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Input className="h-7 text-xs" value={sourceItem} onChange={e => setSourceItem(e.target.value)} placeholder="Digite..." />
        )}
      </div>
      <div className="w-[130px]">
        <label className="text-[10px] text-muted-foreground">Tipo Ação</label>
        <Select value={actionType} onValueChange={setActionType}>
          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Ação..." /></SelectTrigger>
          <SelectContent>
            {ACTION_TYPES.map(a => <SelectItem key={a.value} value={a.value} className="text-xs">{a.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex-1 min-w-[150px]">
        <label className="text-[10px] text-muted-foreground">Produto do Mix</label>
        <Select value={targetProduct} onValueChange={setTargetProduct}>
          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Produto..." /></SelectTrigger>
          <SelectContent>
            {products.map(p => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="w-[80px]">
        <label className="text-[10px] text-muted-foreground">Meses</label>
        <Input className="h-7 text-xs" type="number" value={months} onChange={e => setMonths(e.target.value)} />
      </div>
      <Button size="sm" className="h-7 text-xs" onClick={handleSubmit}>
        <Save className="w-3 h-3 mr-1" /> Salvar
      </Button>
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>Cancelar</Button>
    </div>
  );
}
