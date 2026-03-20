import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

const DB_COLUMNS: Record<string, { label: string; columns: { value: string; label: string }[] }> = {
  "Contato": {
    label: "Contato",
    columns: [
      { value: "nome", label: "Nome" },
      { value: "email", label: "E-mail" },
      { value: "telefone_raw", label: "Telefone" },
      { value: "cidade", label: "Cidade" },
      { value: "uf", label: "UF" },
      { value: "pais_origem", label: "País de origem" },
    ],
  },
  "Profissional": {
    label: "Profissional",
    columns: [
      { value: "especialidade", label: "Especialidade" },
      { value: "area_atuacao", label: "Área de atuação" },
      { value: "empresa_nome", label: "Empresa" },
      { value: "pessoa_cargo", label: "Cargo" },
      { value: "pessoa_cpf", label: "CPF" },
      { value: "pessoa_genero", label: "Gênero" },
      { value: "pessoa_nascimento", label: "Data nascimento" },
      { value: "pessoa_linkedin", label: "LinkedIn" },
      { value: "pessoa_facebook", label: "Facebook" },
    ],
  },
  "Empresa": {
    label: "Empresa",
    columns: [
      { value: "empresa_cnpj", label: "CNPJ" },
      { value: "empresa_razao_social", label: "Razão Social" },
      { value: "empresa_segmento", label: "Segmento" },
      { value: "empresa_website", label: "Website" },
      { value: "empresa_ie", label: "Inscrição Estadual" },
      { value: "empresa_porte", label: "Porte" },
    ],
  },
  "Equipamentos": {
    label: "Equipamentos",
    columns: [
      { value: "tem_impressora", label: "Tem impressora?" },
      { value: "impressora_modelo", label: "Modelo impressora" },
      { value: "tem_scanner", label: "Tem scanner?" },
      { value: "software_cad", label: "Software CAD" },
      { value: "como_digitaliza", label: "Como digitaliza" },
    ],
  },
  "Interesse": {
    label: "Interesse",
    columns: [
      { value: "produto_interesse", label: "Produto de interesse" },
      { value: "resina_interesse", label: "Resina de interesse" },
      { value: "principal_aplicacao", label: "Principal aplicação" },
      { value: "volume_mensal_pecas", label: "Volume mensal peças" },
      { value: "informacao_desejada", label: "Informação desejada" },
      { value: "temperatura_lead", label: "Temperatura do lead" },
      { value: "codigo_contrato", label: "Código contrato" },
    ],
  },
  "SDR": {
    label: "SDR",
    columns: [
      { value: "sdr_scanner_interesse", label: "Scanner interesse" },
      { value: "sdr_impressora_interesse", label: "Impressora interesse" },
      { value: "sdr_software_cad_interesse", label: "Software CAD interesse" },
      { value: "sdr_cursos_interesse", label: "Cursos interesse" },
      { value: "sdr_insumos_lab_interesse", label: "Insumos lab interesse" },
      { value: "sdr_pos_impressao_interesse", label: "Pós-impressão interesse" },
      { value: "sdr_solucoes_interesse", label: "Soluções interesse" },
      { value: "sdr_dentistica_interesse", label: "Dentística interesse" },
      { value: "sdr_caracterizacao_interesse", label: "Caracterização interesse" },
      { value: "sdr_marca_impressora_param", label: "Marca impressora (param)" },
      { value: "sdr_modelo_impressora_param", label: "Modelo impressora (param)" },
      { value: "sdr_resina_param", label: "Resina (param)" },
      { value: "sdr_suporte_equipamento", label: "Equipamento (suporte)" },
      { value: "sdr_suporte_tipo", label: "Tipo de suporte" },
      { value: "sdr_suporte_descricao", label: "Descrição suporte" },
    ],
  },
  "Marketing": {
    label: "Marketing",
    columns: [
      { value: "origem_campanha", label: "Origem / Campanha" },
      { value: "utm_source", label: "UTM Source" },
      { value: "utm_medium", label: "UTM Medium" },
      { value: "utm_campaign", label: "UTM Campaign" },
      { value: "utm_term", label: "UTM Term" },
    ],
  },
  "CS & Suporte": {
    label: "CS & Suporte",
    columns: [
      { value: "cs_treinamento", label: "Treinamento CS" },
      { value: "data_treinamento", label: "Data treinamento" },
      { value: "data_contrato", label: "Data contrato" },
      { value: "reuniao_agendada", label: "Reunião agendada?" },
      { value: "data_primeiro_contato", label: "Data primeiro contato" },
    ],
  },
  "Funil & Status": {
    label: "Funil & Status",
    columns: [
      { value: "status_oportunidade", label: "Status oportunidade" },
      { value: "valor_oportunidade", label: "Valor oportunidade" },
      { value: "proprietario_lead_crm", label: "Proprietário lead (CRM)" },
      { value: "produto_interesse_auto", label: "Produto interesse (auto)" },
      { value: "motivo_perda", label: "Motivo de perda" },
      { value: "comentario_perda", label: "Comentário de perda" },
      { value: "id_cliente_smart", label: "ID Cliente Smart" },
    ],
  },
  "Equip. Ativos": {
    label: "Equip. Ativos",
    columns: [
      { value: "equip_scanner", label: "Scanner (modelo)" },
      { value: "equip_scanner_serial", label: "Scanner (nº série)" },
      { value: "equip_impressora", label: "Impressora (modelo)" },
      { value: "equip_impressora_serial", label: "Impressora (nº série)" },
      { value: "equip_cad", label: "CAD (modelo)" },
      { value: "equip_cad_serial", label: "CAD (nº série)" },
      { value: "equip_pos_impressao", label: "Pós-impressão (modelo)" },
      { value: "equip_pos_impressao_serial", label: "Pós-impressão (nº série)" },
      { value: "equip_notebook", label: "Notebook (modelo)" },
      { value: "equip_notebook_serial", label: "Notebook (nº série)" },
      { value: "insumos_adquiridos", label: "Insumos adquiridos" },
    ],
  },
};

const FIELD_TYPES = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "textarea", label: "Texto longo" },
  { value: "radio", label: "Opções (radio)" },
  { value: "select", label: "Seleção (dropdown)" },
  { value: "checkbox", label: "Checkbox" },
  { value: "slider", label: "Slider de valores" },
  { value: "roi_calculator", label: "Calculadora ROI" },
];

const CUSTOM_CATEGORIES = [
  { value: "contato", label: "Contato" },
  { value: "profissional", label: "Profissional" },
  { value: "empresa", label: "Empresa" },
  { value: "equipamentos", label: "Equipamentos" },
  { value: "interesse", label: "Interesse" },
  { value: "sdr", label: "SDR" },
  { value: "marketing", label: "Marketing" },
];

interface FormField {
  id: string;
  form_id: string;
  label: string;
  field_type: string;
  db_column: string | null;
  custom_field_name: string | null;
  options: any;
  required: boolean;
  placeholder: string | null;
  order_index: number;
  roi_config: any;
}

export function SmartOpsFormEditor({
  formId,
  filterMappingFields = false,
}: {
  formId: string;
  filterMappingFields?: boolean;
}) {
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFields = async () => {
    let query = supabase
      .from("smartops_form_fields" as any)
      .select("*")
      .eq("form_id", formId)
      .order("order_index");
    if (filterMappingFields) {
      query = (query as any).is("workflow_cell_target", null);
    }
    const { data } = await query;
    if (data) setFields(data as any);
    setLoading(false);
  };

  useEffect(() => { fetchFields(); }, [formId]);

  const addField = async () => {
    const maxOrder = fields.length > 0 ? Math.max(...fields.map(f => f.order_index)) + 1 : 0;
    const { error } = await supabase.from("smartops_form_fields" as any).insert({
      form_id: formId,
      label: "Novo campo",
      field_type: "text",
      order_index: maxOrder,
      required: false,
    } as any);
    if (error) toast.error(error.message);
    else fetchFields();
  };

  const updateField = async (id: string, updates: Partial<FormField>) => {
    await supabase.from("smartops_form_fields" as any)
      .update(updates as any)
      .eq("id", id);
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const deleteField = async (id: string) => {
    await supabase.from("smartops_form_fields" as any).delete().eq("id", id);
    fetchFields();
  };

  const moveField = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= fields.length) return;
    const updated = [...fields];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    const promises = updated.map((f, i) =>
      supabase.from("smartops_form_fields" as any).update({ order_index: i } as any).eq("id", f.id)
    );
    await Promise.all(promises);
    fetchFields();
  };

  const handleColumnChange = (fieldId: string, value: string) => {
    if (value === "__custom__") {
      updateField(fieldId, { db_column: null, custom_field_name: "" });
    } else {
      updateField(fieldId, { db_column: value, custom_field_name: null });
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando campos...</p>;

  return (
    <div className="space-y-4">
      {fields.map((field, idx) => (
        <Card key={field.id} className="border">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-mono">#{idx + 1}</span>
              <div className="flex-1" />
              <Button variant="ghost" size="icon" onClick={() => moveField(idx, -1)} disabled={idx === 0}>
                <ArrowUp className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => moveField(idx, 1)} disabled={idx === fields.length - 1}>
                <ArrowDown className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => deleteField(field.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Label</Label>
                <Input
                  value={field.label}
                  onChange={(e) => updateField(field.id, { label: e.target.value })}
                />
              </div>

              <div>
                <Label className="text-xs">Tipo</Label>
                <Select
                  value={field.field_type}
                  onValueChange={async (v) => {
                    await supabase
                      .from("smartops_form_fields" as any)
                      .update({ field_type: v } as any)
                      .eq("id", field.id);
                    setFields((prev) =>
                      prev.map((f) => f.id === field.id ? { ...f, field_type: v } : f)
                    );
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Mapear para</Label>
                <Select
                  value={field.db_column || (field.custom_field_name !== null ? "__custom__" : "")}
                  onValueChange={(v) => handleColumnChange(field.id, v)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DB_COLUMNS).map(([group, { label, columns }]) => (
                      <div key={group}>
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{label}</div>
                        {columns.map((col) => (
                          <SelectItem key={col.value} value={col.value}>{col.label}</SelectItem>
                        ))}
                      </div>
                    ))}
                    <SelectItem value="__custom__">📝 Campo customizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {field.custom_field_name !== null && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Categoria do campo</Label>
                  <Select
                    value={(() => {
                      const opts = Array.isArray(field.options) ? {} : (field.options || {}) as Record<string, any>;
                      return opts.category || "";
                    })()}
                    onValueChange={(v) => {
                      const currentOpts = Array.isArray(field.options) ? {} : (field.options || {}) as Record<string, any>;
                      updateField(field.id, { options: { ...currentOpts, category: v } });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione a categoria..." /></SelectTrigger>
                    <SelectContent>
                      {CUSTOM_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Nome do campo customizado</Label>
                  <Input
                    value={field.custom_field_name || ""}
                    onChange={(e) => updateField(field.id, { custom_field_name: e.target.value })}
                    placeholder="ex: score_nps, feedback_texto"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Placeholder</Label>
                <Input
                  value={field.placeholder || ""}
                  onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch
                  checked={field.required}
                  onCheckedChange={(v) => updateField(field.id, { required: v })}
                />
                <Label className="text-xs">Obrigatório</Label>
              </div>
            </div>

            {["radio", "select", "checkbox"].includes(field.field_type) && (
              <div>
                <Label className="text-xs">Opções (uma por linha)</Label>
                <textarea
                  className="w-full border rounded-md p-2 text-sm min-h-[80px] bg-background"
                  value={Array.isArray(field.options) ? field.options.join("\n") : ""}
                  onChange={(e) => updateField(field.id, {
                    options: e.target.value.split("\n").filter(Boolean),
                  })}
                  placeholder="Opção 1&#10;Opção 2&#10;Opção 3"
                />
              </div>
            )}

            {field.field_type === "slider" && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Valor inicial</Label>
                  <Input
                    type="number"
                    value={(() => { const o = Array.isArray(field.options) ? {} : (field.options || {}) as Record<string, any>; return o.min ?? 0; })()}
                    onChange={(e) => {
                      const cur = Array.isArray(field.options) ? {} : (field.options || {}) as Record<string, any>;
                      updateField(field.id, { options: { ...cur, min: Number(e.target.value) } });
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Valor médio</Label>
                  <Input
                    type="number"
                    value={(() => { const o = Array.isArray(field.options) ? {} : (field.options || {}) as Record<string, any>; return o.mid ?? 50; })()}
                    onChange={(e) => {
                      const cur = Array.isArray(field.options) ? {} : (field.options || {}) as Record<string, any>;
                      updateField(field.id, { options: { ...cur, mid: Number(e.target.value) } });
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Valor final</Label>
                  <Input
                    type="number"
                    value={(() => { const o = Array.isArray(field.options) ? {} : (field.options || {}) as Record<string, any>; return o.max ?? 100; })()}
                    onChange={(e) => {
                      const cur = Array.isArray(field.options) ? {} : (field.options || {}) as Record<string, any>;
                      updateField(field.id, { options: { ...cur, max: Number(e.target.value) } });
                    }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" onClick={addField} className="w-full">
        <Plus className="w-4 h-4 mr-1" /> Adicionar Campo
      </Button>
    </div>
  );
}
