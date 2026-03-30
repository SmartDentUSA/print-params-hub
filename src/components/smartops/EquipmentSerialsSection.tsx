import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import type { ProposalItem, EquipmentData, EquipKey, EquipmentEntry } from "@/types/courses";
import { EQUIP_CONFIG } from "@/lib/courseUtils";

interface Props {
  items: ProposalItem[];
  equipmentData: EquipmentData;
  onChange: (data: EquipmentData) => void;
}

function isOutroKey(key: EquipKey): boolean {
  return key.startsWith('equip_outro_');
}

function getItemConfig(equipKey: EquipKey) {
  if (isOutroKey(equipKey)) {
    return {
      label: 'Acessório / Insumo',
      etapa: 'Outros itens',
      etapa_number: 99,
      serial_label: 'Nº de série / Lote',
      serial_placeholder: 'Ex: LOTE-2024-001',
      lia_serial_field: '',
      lia_model_field: '',
      lia_date_field: 'ativacao',
      pode_ser_bancada: false,
    };
  }
  return EQUIP_CONFIG[equipKey as keyof typeof EQUIP_CONFIG];
}

export function EquipmentSerialsSection({ items, equipmentData, onChange, tipoEntrega, rastreamento, onTipoEntregaChange, onRastreamentoChange }: Props) {
  const [showManualFresadora, setShowManualFresadora] = useState(false);
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, { serial: string; ativacao: string }>>({});

  // All items now have equip_key (either known or equip_outro_N)
  const allItems = items.filter((i) => i.equip_key !== null);

  // Agrupar por etapa_number
  const grouped: Record<number, { etapa: string; items: ProposalItem[] }> = {};
  for (const item of allItems) {
    const cfg = getItemConfig(item.equip_key!);
    if (!cfg) continue;
    if (!grouped[cfg.etapa_number]) {
      grouped[cfg.etapa_number] = { etapa: cfg.etapa, items: [] };
    }
    grouped[cfg.etapa_number].items.push(item);
  }

  const sortedEtapas = Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b));

  const resolveKey = (item: ProposalItem, currentSubtipo: string): EquipKey => {
    if (isOutroKey(item.equip_key!)) return item.equip_key!;
    const cfg = EQUIP_CONFIG[item.equip_key as keyof typeof EQUIP_CONFIG];
    if (cfg?.pode_ser_bancada) {
      return currentSubtipo === "bancada" ? "equip_scanner_bancada" : "equip_scanner";
    }
    return item.equip_key!;
  };

  const updateEntry = (key: EquipKey, partial: Partial<EquipmentEntry>) => {
    const current = equipmentData[key] || { serial: "", ativacao: "", item_nome: "", proposal_ref: "" };
    onChange({ ...equipmentData, [key]: { ...current, ...partial } });
  };

  const removeEntry = (key: EquipKey) => {
    const updated = { ...equipmentData };
    delete updated[key];
    onChange(updated);
    setEditing((prev) => { const s = new Set(prev); s.delete(key); return s; });
  };

  const handleSubtipoToggle = (item: ProposalItem, newSubtipo: "intraoral" | "bancada") => {
    const oldKey = item.equip_key!;
    const newKey: EquipKey = newSubtipo === "bancada" ? "equip_scanner_bancada" : "equip_scanner";
    const oldData = equipmentData[oldKey];
    const updated = { ...equipmentData };
    if (oldData) {
      delete updated[oldKey];
      updated[newKey] = { ...oldData, subtipo: newSubtipo };
    } else {
      updated[newKey] = { serial: "", ativacao: "", item_nome: item.nome, proposal_ref: item.proposal_id, subtipo: newSubtipo };
    }
    onChange(updated);
  };

  const startAdd = (key: EquipKey) => {
    setDrafts((d) => ({ ...d, [key]: { serial: "", ativacao: "" } }));
    setEditing((prev) => new Set(prev).add(key));
  };

  const startEdit = (key: EquipKey) => {
    const entry = equipmentData[key];
    setDrafts((d) => ({ ...d, [key]: { serial: entry?.serial || "", ativacao: entry?.ativacao || "" } }));
    setEditing((prev) => new Set(prev).add(key));
  };

  const cancelEdit = (key: EquipKey) => {
    setEditing((prev) => { const s = new Set(prev); s.delete(key); return s; });
    setDrafts((d) => { const n = { ...d }; delete n[key]; return n; });
  };

  const saveDraft = (key: EquipKey, item: ProposalItem) => {
    const draft = drafts[key];
    if (!draft) return;
    updateEntry(key, {
      serial: draft.serial,
      ativacao: draft.ativacao,
      item_nome: item.nome,
      proposal_ref: item.proposal_id,
    });
    setEditing((prev) => { const s = new Set(prev); s.delete(key); return s; });
    setDrafts((d) => { const n = { ...d }; delete n[key]; return n; });
  };

  const updateDraft = (key: string, field: "serial" | "ativacao", value: string) => {
    setDrafts((d) => ({ ...d, [key]: { ...d[key], [field]: value } }));
  };

  const hasFresadora = allItems.some((i) => i.equip_key === "equip_fresadora");

  return (
    <div className="space-y-4">
      {sortedEtapas.map(([etapaNum, { etapa, items: etapaItems }]) => (
        <div key={etapaNum}>
          <h4 className="text-sm font-semibold text-muted-foreground mb-2">
            {Number(etapaNum) === 99 ? 'Outros itens da proposta' : `Etapa ${etapa}`}
          </h4>
          <div className="space-y-3">
            {etapaItems.map((item, idx) => {
              const equipKey = item.equip_key!;
              const cfg = getItemConfig(equipKey);
              if (!cfg) return null;
              const entry = equipmentData[equipKey];
              const currentSubtipo = entry?.subtipo || "intraoral";
              const resolvedKey = resolveKey(item, currentSubtipo);
              const resolvedEntry = equipmentData[resolvedKey];
              const isEditing = editing.has(resolvedKey);
              const hasSerial = !!resolvedEntry?.serial;
              const draft = drafts[resolvedKey];
              const isOutro = isOutroKey(equipKey);

              return (
                <Card key={`${item.proposal_id}-${item.item_idx}-${idx}`} className="border">
                  <CardContent className="pt-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-sm">{item.nome}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          Qtd: {item.qtd} | R$ {item.total.toLocaleString("pt-BR")}
                        </span>
                        {item.deal_ref && (
                          <span className="block text-[10px] text-muted-foreground/70 mt-0.5 truncate max-w-[300px]">
                            Negócio: {item.deal_ref}
                          </span>
                        )}
                      </div>
                      <Badge variant={isOutro ? "secondary" : "outline"}>{cfg.label}</Badge>
                    </div>

                    {/* Toggle intraoral/bancada */}
                    {cfg.pode_ser_bancada && (
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant={currentSubtipo === "intraoral" ? "default" : "outline"} onClick={() => handleSubtipoToggle(item, "intraoral")}>Intraoral</Button>
                        <Button type="button" size="sm" variant={currentSubtipo === "bancada" ? "default" : "outline"} onClick={() => handleSubtipoToggle(item, "bancada")}>Bancada</Button>
                      </div>
                    )}

                    {/* State: no serial, not editing → show [+ Adicionar] */}
                    {!hasSerial && !isEditing && (
                      <Button type="button" variant="outline" size="sm" onClick={() => startAdd(resolvedKey)}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> {isOutro ? 'Adicionar série / lote' : 'Adicionar'}
                      </Button>
                    )}

                    {/* State: has serial, not editing → show readonly + [Edit] [Remove] */}
                    {hasSerial && !isEditing && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 text-sm bg-muted/50 rounded px-3 py-2">
                          <div className="flex-1">
                            <span className="text-xs text-muted-foreground">{cfg.serial_label}: </span>
                            <span className="font-mono">{resolvedEntry!.serial}</span>
                          </div>
                          {resolvedEntry!.ativacao && (
                            <div>
                              <span className="text-xs text-muted-foreground">Ativação: </span>
                              <span className="font-mono text-xs">{resolvedEntry!.ativacao}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => startEdit(resolvedKey)}>
                            <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => removeEntry(resolvedKey)}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* State: editing → show inputs + [Save] [Cancel] */}
                    {isEditing && draft && (
                      <div className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label className="text-xs">{cfg.serial_label}</Label>
                            <Input
                              placeholder={cfg.serial_placeholder}
                              value={draft.serial}
                              onChange={(e) => updateDraft(resolvedKey, "serial", e.target.value)}
                              autoFocus
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Data de ativação</Label>
                            <Input type="date" value={draft.ativacao} onChange={(e) => updateDraft(resolvedKey, "ativacao", e.target.value)} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" size="sm" onClick={() => saveDraft(resolvedKey, item)} disabled={!draft.serial.trim()}>
                            <Save className="w-3.5 h-3.5 mr-1" /> Salvar
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => cancelEdit(resolvedKey)}>
                            <X className="w-3.5 h-3.5 mr-1" /> Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* Tipo de Entrega + Rastreamento */}
      {onTipoEntregaChange && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground">Tipo de Entrega</h4>
          <div className="flex gap-3">
            <Button type="button" size="sm" variant={tipoEntrega === 'enviar' ? 'default' : 'outline'} onClick={() => onTipoEntregaChange('enviar')}>Enviar</Button>
            <Button type="button" size="sm" variant={tipoEntrega === 'retirar' ? 'default' : 'outline'} onClick={() => { onTipoEntregaChange('retirar'); onRastreamentoChange?.(''); }}>Retirar</Button>
          </div>
          {tipoEntrega === 'enviar' && onRastreamentoChange && (
            <div>
              <Label className="text-xs">Rastreamento</Label>
              <Input value={rastreamento || ''} onChange={(e) => onRastreamentoChange(e.target.value)} placeholder="Ex: BR123456789BR" />
            </div>
          )}
        </div>
      )}

      {/* Card manual fresadora */}
      {!hasFresadora && (
        <div>
          {!showManualFresadora ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setShowManualFresadora(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar fresadora manualmente
            </Button>
          ) : (
            <Card className="border">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Fresadora (manual)</span>
                  <Badge variant="outline">Fresadora</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label className="text-xs">Modelo</Label>
                    <Input placeholder="Ex: DWX-52D" value={equipmentData.equip_fresadora?.item_nome || ""} onChange={(e) => updateEntry("equip_fresadora", { item_nome: e.target.value, proposal_ref: "manual" })} />
                  </div>
                  <div>
                    <Label className="text-xs">Nº de série</Label>
                    <Input placeholder={EQUIP_CONFIG.equip_fresadora.serial_placeholder} value={equipmentData.equip_fresadora?.serial || ""} onChange={(e) => updateEntry("equip_fresadora", { serial: e.target.value, proposal_ref: "manual" })} />
                  </div>
                  <div>
                    <Label className="text-xs">Data de ativação</Label>
                    <Input type="date" value={equipmentData.equip_fresadora?.ativacao || ""} onChange={(e) => updateEntry("equip_fresadora", { ativacao: e.target.value, proposal_ref: "manual" })} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
