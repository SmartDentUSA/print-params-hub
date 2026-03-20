import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

export const WORKFLOW_CELLS: { value: string; label: string }[] = [
  { value: "1_captura_digital__scanner_intraoral", label: "1 · Captura Digital / Scanner Intraoral" },
  { value: "1_captura_digital__scanner_bancada",   label: "1 · Captura Digital / Scanner Bancada" },
  { value: "1_captura_digital__notebook",          label: "1 · Captura Digital / Notebook" },
  { value: "1_captura_digital__acessorios",        label: "1 · Captura Digital / Acessórios" },
  { value: "1_captura_digital__pecas_e_partes",    label: "1 · Captura Digital / Peças e Partes" },
  { value: "2_cad__software",                      label: "2 · CAD / Software" },
  { value: "2_cad__credito_ia",                    label: "2 · CAD / Crédito de IA" },
  { value: "2_cad__servicos",                      label: "2 · CAD / Serviços" },
  { value: "3_impressao__resinas",                 label: "3 · Impressão 3D / Resinas" },
  { value: "3_impressao__software",                label: "3 · Impressão 3D / Software" },
  { value: "3_impressao__impressora_3d",           label: "3 · Impressão 3D / Impressora 3D" },
  { value: "3_impressao__acessorios",              label: "3 · Impressão 3D / Acessórios" },
  { value: "3_impressao__pecas_e_partes",          label: "3 · Impressão 3D / Peças e Partes" },
  { value: "4_pos_impressao__equipamentos",        label: "4 · Pós-Impressão / Equipamentos" },
  { value: "4_pos_impressao__limpeza_e_acabamento",label: "4 · Pós-Impressão / Limpeza e Acabamento" },
  { value: "5_finalizacao__caracterizacao",        label: "5 · Finalização / Caracterização" },
  { value: "5_finalizacao__instalacao",            label: "5 · Finalização / Instalação" },
  { value: "5_finalizacao__destistica_orto",       label: "5 · Finalização / Dentística Orto" },
  { value: "6_cursos__presencial",                 label: "6 · Cursos / Presencial" },
  { value: "6_cursos__online",                     label: "6 · Cursos / Online" },
  { value: "7_fresagem__equipamentos",             label: "7 · Fresagem / Equipamentos" },
  { value: "7_fresagem__softwares",                label: "7 · Fresagem / Softwares" },
  { value: "7_fresagem__servicos",                 label: "7 · Fresagem / Serviços" },
  { value: "7_fresagem__acessorios",               label: "7 · Fresagem / Acessórios" },
  { value: "7_fresagem__pecas_e_partes",           label: "7 · Fresagem / Peças e Partes" },
];

const DB_COLUMNS_FLAT: { value: string; label: string; group: string }[] = [
  // Contato
  { value: "nome",              label: "Nome",              group: "Contato" },
  { value: "email",             label: "E-mail",            group: "Contato" },
  { value: "telefone_raw",      label: "Telefone",          group: "Contato" },
  { value: "cidade",            label: "Cidade",            group: "Contato" },
  { value: "uf",                label: "UF",                group: "Contato" },
  // Equipamentos
  { value: "equip_scanner",          label: "Scanner (modelo)",          group: "Equip. Ativos" },
  { value: "equip_impressora",       label: "Impressora (modelo)",       group: "Equip. Ativos" },
  { value: "equip_cad",              label: "CAD (modelo)",              group: "Equip. Ativos" },
  { value: "equip_pos_impressao",    label: "Pós-impressão (modelo)",    group: "Equip. Ativos" },
  { value: "equip_fresadora",        label: "Fresadora (modelo)",        group: "Equip. Ativos" },
  { value: "equip_notebook",         label: "Notebook (modelo)",         group: "Equip. Ativos" },
  { value: "insumos_adquiridos",     label: "Insumos adquiridos",        group: "Equip. Ativos" },
  // SDR
  { value: "sdr_scanner_modelo",     label: "Scanner modelo (SDR)",      group: "SDR" },
  { value: "sdr_cad_licenca",        label: "CAD licença (SDR)",         group: "SDR" },
  { value: "sdr_resina_atual",       label: "Resina atual (SDR)",        group: "SDR" },
  { value: "sdr_cura_modelo",        label: "Cura modelo (SDR)",         group: "SDR" },
  { value: "sdr_fresadora_marca",    label: "Fresadora marca (SDR)",     group: "SDR" },
  { value: "sdr_fresadora_modelo",   label: "Fresadora modelo (SDR)",    group: "SDR" },
  { value: "impressora_modelo",      label: "Impressora modelo",         group: "Equipamentos" },
  { value: "software_cad",          label: "Software CAD",              group: "Equipamentos" },
  { value: "resina_interesse",       label: "Resina de interesse",       group: "Interesse" },
];

const FIELD_TYPES = [
  { value: "text",     label: "Texto" },
  { value: "number",   label: "Número" },
  { value: "email",    label: "E-mail" },
  { value: "phone",    label: "Telefone" },
  { value: "textarea", label: "Texto longo" },
  { value: "radio",    label: "Opções (radio)" },
  { value: "select",   label: "Seleção (dropdown)" },
  { value: "checkbox", label: "Checkbox" },
];

interface MappingField {
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
  workflow_cell_target: string | null;
}

export function SmartOpsMappingFieldsEditor({ formId }: { formId: string }) {
  const [fields, setFields] = useState<MappingField[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFields = async () => {
    const { data } = await supabase
      .from("smartops_form_fields" as any)
      .select("*")
      .eq("form_id", formId)
      .not("workflow_cell_target", "is", null)
      .order("order_index");
    if (data) setFields(data as any);
    setLoading(false);
  };

  useEffect(() => { fetchFields(); }, [formId]);

  const addMappingField = async () => {
    const maxOrder = fields.length > 0 ? Math.max(...fields.map(f => f.order_index)) + 1 : 1000;
    const { error } = await supabase.from("smartops_form_fields" as any).insert({
      form_id: formId,
      label: "Novo campo de mapeamento",
      field_type: "text",
      order_index: maxOrder,
      required: false,
      workflow_cell_target: "",
    } as any);
    if (error) toast.error(error.message);
    else fetchFields();
  };

  const updateField = async (id: string, updates: Partial<MappingField>) => {
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
    await Promise.all(
      updated.map((f, i) =>
        supabase.from("smartops_form_fields" as any).update({ order_index: f.order_index } as any).eq("id", f.id)
      )
    );
    // swap order_index values
    await supabase.from("smartops_form_fields" as any)
      .update({ order_index: updated[target].order_index } as any)
      .eq("id", updated[index].id);
    await supabase.from("smartops_form_fields" as any)
      .update({ order_index: updated[index].order_index } as any)
      .eq("id", updated[target].id);
    fetchFields();
  };

  const handleColumnChange = (fieldId: string, value: string) => {
    if (value === "__custom__") {
      updateField(fieldId, { db_column: null, custom_field_name: "" });
    } else {
      updateField(fieldId, { db_column: value, custom_field_name: null });
    }
  };

  // Group DB_COLUMNS_FLAT by group
  const groupedColumns = DB_COLUMNS_FLAT.reduce<Record<string, typeof DB_COLUMNS_FLAT>>((acc, col) => {
    if (!acc[col.group]) acc[col.group] = [];
    acc[col.group].push(col);
    return acc;
  }, {});

  if (loading) return <p className="text-sm text-muted-foreground">Carregando campos de mapeamento...</p>;

  return (
    <div className="space-y-4">
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum campo de mapeamento adicionado. Clique em "+ Adicionar campo de mapeamento" para começar.
        </p>
      )}

      {fields.map((field, idx) => (
        <Card key={field.id} className="border border-amber-200 bg-amber-50/30">
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

            {/* Linha 1: Label + Tipo + Obrigatório */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Pergunta / Label</Label>
                <Input
                  value={field.label}
                  onChange={(e) => updateField(field.id, { label: e.target.value })}
                  placeholder="Ex: Se tem scanner, qual marca?"
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
              <div className="flex items-center gap-2 pt-5">
                <Switch
                  checked={field.required}
                  onCheckedChange={(v) => updateField(field.id, { required: v })}
                />
                <Label className="text-xs">Obrigatório</Label>
              </div>
            </div>

            {/* Linha 2: Campo no banco */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Campo no banco (lia_attendances)</Label>
                <Select
                  value={field.db_column || (field.custom_field_name !== null ? "__custom__" : "")}
                  onValueChange={(v) => handleColumnChange(field.id, v)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(groupedColumns).map(([group, cols]) => (
                      <div key={group}>
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{group}</div>
                        {cols.map((col) => (
                          <SelectItem key={col.value} value={col.value}>{col.label}</SelectItem>
                        ))}
                      </div>
                    ))}
                    <SelectItem value="__custom__">📝 Campo customizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Linha 2b: Célula do Workflow 7×3 */}
              <div>
                <Label className="text-xs">Célula Workflow 7×3 — Mapeamento</Label>
                <Select
                  value={field.workflow_cell_target || ""}
                  onValueChange={(v) => updateField(field.id, { workflow_cell_target: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione a célula..." /></SelectTrigger>
                  <SelectContent>
                    {WORKFLOW_CELLS.map((cell) => (
                      <SelectItem key={cell.value} value={cell.value}>{cell.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Custom field name input */}
            {field.custom_field_name !== null && (
              <div>
                <Label className="text-xs">Nome do campo customizado</Label>
                <Input
                  value={field.custom_field_name || ""}
                  onChange={(e) => updateField(field.id, { custom_field_name: e.target.value })}
                  placeholder="ex: marca_scanner_atual"
                />
              </div>
            )}

            {/* Opções para radio/select/checkbox */}
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

            {/* Placeholder */}
            <div>
              <Label className="text-xs">Placeholder</Label>
              <Input
                value={field.placeholder || ""}
                onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                placeholder="Texto de exemplo no campo"
              />
            </div>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" onClick={addMappingField} className="w-full border-amber-300 text-amber-700 hover:bg-amber-50">
        <Plus className="w-4 h-4 mr-1" /> Adicionar campo de mapeamento
      </Button>
    </div>
  );
}
