import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { ProposalItem, EquipmentData, EquipKey, EquipmentEntry } from "@/types/courses";
import { EQUIP_CONFIG } from "@/lib/courseUtils";

interface Props {
  items: ProposalItem[];
  equipmentData: EquipmentData;
  onChange: (data: EquipmentData) => void;
}

export function EquipmentSerialsSection({ items, equipmentData, onChange }: Props) {
  const [showManualFresadora, setShowManualFresadora] = useState(false);

  const withEquip = items.filter((i) => i.equip_key !== null);
  const noEquip = items.filter((i) => i.equip_key === null);

  // Agrupar por etapa_number
  const grouped: Record<number, { etapa: string; items: ProposalItem[] }> = {};
  for (const item of withEquip) {
    const cfg = EQUIP_CONFIG[item.equip_key!];
    if (!cfg) continue;
    if (!grouped[cfg.etapa_number]) {
      grouped[cfg.etapa_number] = { etapa: cfg.etapa, items: [] };
    }
    grouped[cfg.etapa_number].items.push(item);
  }

  const sortedEtapas = Object.entries(grouped)
    .sort(([a], [b]) => Number(a) - Number(b));

  const updateEntry = (key: EquipKey, partial: Partial<EquipmentEntry>) => {
    const current = equipmentData[key] || { serial: "", ativacao: "", item_nome: "", proposal_ref: "" };
    onChange({ ...equipmentData, [key]: { ...current, ...partial } });
  };

  const handleSubtipoToggle = (item: ProposalItem, newSubtipo: "intraoral" | "bancada") => {
    const oldKey = item.equip_key!;
    const newKey: EquipKey = newSubtipo === "bancada" ? "equip_scanner_bancada" : "equip_scanner";
    const oldData = equipmentData[oldKey];
    const updated = { ...equipmentData };

    // Mover dados entre chaves
    if (oldData) {
      delete updated[oldKey];
      updated[newKey] = { ...oldData, subtipo: newSubtipo };
    } else {
      updated[newKey] = {
        serial: "", ativacao: "", item_nome: item.nome,
        proposal_ref: item.proposal_id, subtipo: newSubtipo,
      };
    }

    onChange(updated);
  };

  const hasFresadora = withEquip.some((i) => i.equip_key === "equip_fresadora");

  return (
    <div className="space-y-4">
      {sortedEtapas.map(([etapaNum, { etapa, items: etapaItems }]) => (
        <div key={etapaNum}>
          <h4 className="text-sm font-semibold text-muted-foreground mb-2">Etapa {etapa}</h4>
          <div className="space-y-3">
            {etapaItems.map((item, idx) => {
              const equipKey = item.equip_key!;
              const cfg = EQUIP_CONFIG[equipKey];
              const entry = equipmentData[equipKey];
              const currentSubtipo = entry?.subtipo || "intraoral";

              return (
                <Card key={`${item.proposal_id}-${item.item_idx}-${idx}`} className="border">
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-sm">{item.nome}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          Qtd: {item.qtd} | R$ {item.total.toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <Badge variant="outline">{cfg.label}</Badge>
                    </div>

                    {/* Toggle intraoral/bancada */}
                    {cfg.pode_ser_bancada && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={currentSubtipo === "intraoral" ? "default" : "outline"}
                          onClick={() => handleSubtipoToggle(item, "intraoral")}
                        >
                          Intraoral
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={currentSubtipo === "bancada" ? "default" : "outline"}
                          onClick={() => handleSubtipoToggle(item, "bancada")}
                        >
                          Bancada
                        </Button>
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs">{cfg.serial_label}</Label>
                        <Input
                          placeholder={cfg.serial_placeholder}
                          value={entry?.serial || ""}
                          onChange={(e) =>
                            updateEntry(
                              cfg.pode_ser_bancada
                                ? (currentSubtipo === "bancada" ? "equip_scanner_bancada" : "equip_scanner")
                                : equipKey,
                              {
                                serial: e.target.value,
                                item_nome: item.nome,
                                proposal_ref: item.proposal_id,
                                subtipo: cfg.pode_ser_bancada ? currentSubtipo : undefined,
                              }
                            )
                          }
                        />
                      </div>

                      {/* Data ativação — SOMENTE se cfg.lia_date_field !== null (equip_cad não tem) */}
                      {cfg.lia_date_field !== null && (
                        <div>
                          <Label className="text-xs">Data de ativação</Label>
                          <Input
                            type="date"
                            value={entry?.ativacao || ""}
                            onChange={(e) =>
                              updateEntry(
                                cfg.pode_ser_bancada
                                  ? (currentSubtipo === "bancada" ? "equip_scanner_bancada" : "equip_scanner")
                                  : equipKey,
                                {
                                  ativacao: e.target.value,
                                  item_nome: item.nome,
                                  proposal_ref: item.proposal_id,
                                  subtipo: cfg.pode_ser_bancada ? currentSubtipo : undefined,
                                }
                              )
                            }
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* Insumos e serviços */}
      {noEquip.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-2">Insumos e serviços</h4>
          <div className="space-y-1">
            {noEquip.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm py-1.5 px-3 bg-muted/50 rounded">
                <span>{item.nome}</span>
                <span className="text-muted-foreground">Qtd: {item.qtd} | R$ {item.total.toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Card manual fresadora */}
      {!hasFresadora && (
        <div>
          {!showManualFresadora ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowManualFresadora(true)}
            >
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
                    <Input
                      placeholder="Ex: DWX-52D"
                      value={equipmentData.equip_fresadora?.item_nome || ""}
                      onChange={(e) =>
                        updateEntry("equip_fresadora", {
                          item_nome: e.target.value,
                          proposal_ref: "manual",
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Nº de série</Label>
                    <Input
                      placeholder={EQUIP_CONFIG.equip_fresadora.serial_placeholder}
                      value={equipmentData.equip_fresadora?.serial || ""}
                      onChange={(e) =>
                        updateEntry("equip_fresadora", {
                          serial: e.target.value,
                          proposal_ref: "manual",
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Data de ativação</Label>
                    <Input
                      type="date"
                      value={equipmentData.equip_fresadora?.ativacao || ""}
                      onChange={(e) =>
                        updateEntry("equip_fresadora", {
                          ativacao: e.target.value,
                          proposal_ref: "manual",
                        })
                      }
                    />
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
