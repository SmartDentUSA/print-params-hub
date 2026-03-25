import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, ArrowRight, ArrowLeft, CalendarDays, Users, Check, Plus, X, AlertTriangle, User,
} from "lucide-react";
import type {
  SmartopsCourse, Turma, TurmaDay, DealSearchResult,
  ProposalItem, EquipmentData, EnrollmentCompanion,
} from "@/types/courses";
import {
  extractProposalItems, isDealGanho, formatDatePtBr, formatWeekday,
  MODALITY_CONFIG, EQUIP_CONFIG,
} from "@/lib/courseUtils";
import { buildTemplateVars, interpolateTemplate, DEFAULT_ENROLLMENT_TEMPLATE } from "@/lib/courseWhatsapp";
import { useDealSearch } from "@/hooks/useDealSearch";
import { useEnrollment } from "@/hooks/useEnrollment";
import { EquipmentSerialsSection } from "./EquipmentSerialsSection";

interface Props {
  course: SmartopsCourse;
  preselectedTurmaId?: string;
  open: boolean;
  onClose: () => void;
}

// ─── Inline companions for Step 2 ───
function CompanionsInline({ companions, onChange }: {
  companions: Partial<EnrollmentCompanion>[];
  onChange: (c: Partial<EnrollmentCompanion>[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Partial<EnrollmentCompanion>>({});

  const saveDraft = () => {
    if (!draft.name?.trim()) return;
    onChange([...companions, draft]);
    setDraft({});
    setAdding(false);
  };

  const remove = (idx: number) => {
    onChange(companions.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-muted-foreground">Acompanhantes</h4>

      {/* Saved chips */}
      {companions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {companions.map((c, i) => (
            <Badge key={i} variant="secondary" className="gap-1.5 py-1 px-2.5 text-sm">
              <User className="w-3 h-3" />
              {c.name}
              <button type="button" onClick={() => remove(i)} className="ml-1 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Add form */}
      {adding ? (
        <Card className="border">
          <CardContent className="pt-3 space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Nome *</Label>
                <Input value={draft.name || ""} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} autoFocus />
              </div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input value={draft.email || ""} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Celular</Label>
                <Input value={draft.phone || ""} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Área de atuação</Label>
                <Input value={draft.area_atuacao || ""} onChange={(e) => setDraft((d) => ({ ...d, area_atuacao: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Especialidade</Label>
                <Input value={draft.especialidade || ""} onChange={(e) => setDraft((d) => ({ ...d, especialidade: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={saveDraft} disabled={!draft.name?.trim()}>Salvar acompanhante</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { setAdding(false); setDraft({}); }}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar acompanhante
        </Button>
      )}
    </div>
  );
}

export function EnrollmentModal({ course, preselectedTurmaId, open, onClose }: Props) {
  const [step, setStep] = useState(1);
  const dealSearch = useDealSearch();
  const { enroll } = useEnrollment();
  const [dealIdInput, setDealIdInput] = useState("");
  const [selectedDealIdx, setSelectedDealIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 2 form
  const [formData, setFormData] = useState({
    deal_title: "", person_name: "", especialidade: "", area_atuacao: "",
    numero_contrato: "",
    empresa_cnpj: "", empresa_pais: "", empresa_estado: "",
    empresa_cidade: "", empresa_endereco: "", empresa_telefone: "",
  });
  const [proposalItems, setProposalItems] = useState<ProposalItem[]>([]);
  const [equipmentData, setEquipmentData] = useState<EquipmentData>({});

  // Step 3
  const [turmas, setTurmas] = useState<(Turma & { days: TurmaDay[] })[]>([]);
  const [selectedTurmaId, setSelectedTurmaId] = useState(preselectedTurmaId || "");
  const [turmasLoading, setTurmasLoading] = useState(false);

  // Step 4
  const [companions, setCompanions] = useState<Partial<EnrollmentCompanion>[]>([]);

  // Step 5
  const [notes, setNotes] = useState("");

  // ─── Handlers ───

  const handleSearch = async () => {
    await dealSearch.search(dealIdInput);
  };

  // Populate form after search
  const populateFromResult = (result: DealSearchResult) => {
    const deal = result.matched_deal;
    const items = extractProposalItems(deal);
    setProposalItems(items);
    setFormData({
      deal_title: deal.deal_title || "",
      person_name: result.nome || "",
      especialidade: result.especialidade || "",
      area_atuacao: result.area_atuacao || "",
      numero_contrato: "",
      empresa_cnpj: result.empresa_cnpj || "",
      empresa_pais: result.pais_origem || "",
      empresa_estado: result.uf || "",
      empresa_cidade: result.cidade || "",
      empresa_endereco: "",
      empresa_telefone: "",
    });
    setEquipmentData({});
  };

  const ganhoDeals = useMemo(() => {
    if (!dealSearch.result) return [];
    return dealSearch.result.piperun_deals_history.filter(isDealGanho);
  }, [dealSearch.result]);

  const handleSelectDeal = (idx: number) => {
    if (!dealSearch.result) return;
    setSelectedDealIdx(idx);
    const deal = ganhoDeals[idx] || dealSearch.result.matched_deal;
    const items = extractProposalItems(deal);
    setProposalItems(items);
    setFormData((f) => ({ ...f, deal_title: deal.deal_title || "" }));
    setEquipmentData({});
  };

  const loadTurmas = async () => {
    setTurmasLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("smartops_course_turmas")
        .select("*, days:smartops_turma_days(*)")
        .eq("course_id", course.id)
        .eq("active", true)
        .order("sort_order");

      const formatted = (data ?? []).map((t: any) => ({
        ...t,
        days: (t.days ?? []).sort((a: TurmaDay, b: TurmaDay) => a.day_number - b.day_number),
      }));
      setTurmas(formatted);
      if (preselectedTurmaId && formatted.some((t: Turma) => t.id === preselectedTurmaId)) {
        setSelectedTurmaId(preselectedTurmaId);
      }
    } finally {
      setTurmasLoading(false);
    }
  };

  const goToStep = (s: number) => {
    if (s === 3 && turmas.length === 0) loadTurmas();
    setStep(s);
  };

  const selectedTurma = turmas.find((t) => t.id === selectedTurmaId);
  const selectedDays = selectedTurma?.days ?? [];

  const isB2B = dealSearch.result?.buyer_type === "B2B" || !!dealSearch.result?.empresa_cnpj;

  // ─── Preview WA (Step 5) ───
  const waPreview = useMemo(() => {
    if (!selectedTurma) return "";
    const tpl = course.whatsapp_message_template || DEFAULT_ENROLLMENT_TEMPLATE;
    const vars = buildTemplateVars(course, selectedTurma, selectedDays, formData.person_name, "CS");
    return interpolateTemplate(tpl, vars);
  }, [course, selectedTurma, selectedDays, formData.person_name]);

  const handleSubmit = async () => {
    if (!dealSearch.result || !selectedTurma) return;
    setSubmitting(true);
    const ok = await enroll({
      course,
      dealResult: dealSearch.result,
      formData,
      proposalItems,
      equipmentData,
      selectedTurma,
      turmadays: selectedDays,
      companions,
      notes,
    });
    setSubmitting(false);
    if (ok) onClose();
  };

  const updateForm = (field: string, value: string) =>
    setFormData((f) => ({ ...f, [field]: value }));

  // ─── Render ───
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Agendar — {course.title}
            <Badge variant="outline" className="ml-auto">Passo {step}/5</Badge>
          </DialogTitle>
        </DialogHeader>

          <div className="space-y-4 pb-4">
            {/* ═══ STEP 1: Busca por Deal ═══ */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Deal ID ou PipeRun ID..."
                    value={dealIdInput}
                    onChange={(e) => setDealIdInput(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <Button onClick={handleSearch} disabled={dealSearch.loading}>
                    <Search className="w-4 h-4 mr-1" />
                    {dealSearch.loading ? "Buscando..." : "Buscar"}
                  </Button>
                </div>

                {dealSearch.error && (
                  <p className="text-sm text-red-500">{dealSearch.error}</p>
                )}

                {dealSearch.result && (
                  <Card>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{dealSearch.result.nome}</span>
                        {dealSearch.result.email && (
                          <span className="text-xs text-muted-foreground">{dealSearch.result.email}</span>
                        )}
                      </div>

                      {ganhoDeals.length > 1 && (
                        <div>
                          <Label className="text-xs">Selecionar deal ganho:</Label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {ganhoDeals.map((d, i) => (
                              <Button
                                key={d.deal_id}
                                size="sm"
                                variant={selectedDealIdx === i ? "default" : "outline"}
                                onClick={() => handleSelectDeal(i)}
                              >
                                {d.deal_title || d.deal_id}
                                {d.value ? ` (R$ ${d.value.toLocaleString("pt-BR")})` : ""}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                      <Button
                        className="w-full"
                        onClick={() => {
                          populateFromResult(dealSearch.result!);
                          goToStep(2);
                        }}
                      >
                        Continuar <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* ═══ STEP 2: Conferência de dados ═══ */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Deal</Label>
                    <Input value={formData.deal_title} onChange={(e) => updateForm("deal_title", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Participante</Label>
                    <Input value={formData.person_name} onChange={(e) => updateForm("person_name", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">ID PipeRun</Label>
                    <Input value={dealSearch.result?.pessoa_piperun_id || ""} disabled />
                  </div>
                  <div>
                    <Label className="text-xs">Especialidade</Label>
                    <Input value={formData.especialidade} onChange={(e) => updateForm("especialidade", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Área de atuação</Label>
                    <Input value={formData.area_atuacao} onChange={(e) => updateForm("area_atuacao", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Nº Contrato</Label>
                    <Input value={formData.numero_contrato} onChange={(e) => updateForm("numero_contrato", e.target.value)} />
                  </div>
                </div>

                {/* B2B */}
                {isB2B && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground">Dados da Empresa (B2B)</h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs">CNPJ</Label>
                        <Input value={formData.empresa_cnpj} onChange={(e) => updateForm("empresa_cnpj", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">País</Label>
                        <Input value={formData.empresa_pais} onChange={(e) => updateForm("empresa_pais", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Estado</Label>
                        <Input value={formData.empresa_estado} onChange={(e) => updateForm("empresa_estado", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Cidade</Label>
                        <Input value={formData.empresa_cidade} onChange={(e) => updateForm("empresa_cidade", e.target.value)} />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Endereço</Label>
                        <Input value={formData.empresa_endereco} onChange={(e) => updateForm("empresa_endereco", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Telefone</Label>
                        <Input value={formData.empresa_telefone} onChange={(e) => updateForm("empresa_telefone", e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Equipamentos */}
                {proposalItems.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground">Equipamentos e Seriais</h4>
                    <EquipmentSerialsSection
                      items={proposalItems}
                      equipmentData={equipmentData}
                      onChange={setEquipmentData}
                    />
                  </div>
                )}

                {/* Acompanhantes inline */}
                <CompanionsInline companions={companions} onChange={setCompanions} />

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => goToStep(1)}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={!formData.person_name.trim()}
                    onClick={() => goToStep(3)}
                  >
                    Validar dados <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* ═══ STEP 3: Selecionar turma ═══ */}
            {step === 3 && (
              <div className="space-y-4">
                {turmasLoading ? (
                  <p className="text-center text-muted-foreground py-4">Carregando turmas...</p>
                ) : turmas.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Nenhuma turma ativa para este curso.</p>
                ) : (
                  <div className="space-y-3">
                    {turmas.map((turma) => {
                      const vagas = turma.slots - turma.enrolled_count;
                      const lotado = vagas <= 0;
                      const isSelected = selectedTurmaId === turma.id;
                      const mod = MODALITY_CONFIG[course.modality as keyof typeof MODALITY_CONFIG];

                      return (
                        <Card
                          key={turma.id}
                          className={`cursor-pointer transition-colors border-2 ${
                            isSelected ? "border-primary" : "border-transparent hover:border-muted-foreground/20"
                          } ${lotado ? "opacity-50" : ""}`}
                          onClick={() => !lotado && setSelectedTurmaId(turma.id)}
                        >
                          <CardContent className="pt-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {isSelected && <Check className="w-4 h-4 text-primary" />}
                                <span className="font-medium">{turma.label}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {mod && <Badge className={mod.badge}>{mod.label}</Badge>}
                                <Badge variant={lotado ? "destructive" : "outline"}>
                                  <Users className="w-3 h-3 mr-1" />
                                  {vagas} vagas
                                </Badge>
                              </div>
                            </div>

                            {course.instructor_name && (
                              <p className="text-xs text-muted-foreground">Instrutor: {course.instructor_name}</p>
                            )}

                            {turma.days.length > 0 && (
                              <div className="text-sm space-y-1">
                                {turma.days.map((d) => (
                                  <div key={d.day_number} className="flex items-center gap-2 text-xs">
                                    <CalendarDays className="w-3 h-3 text-muted-foreground" />
                                    <span>
                                      {formatDatePtBr(d.date)} ({formatWeekday(d.date)})
                                      {" "}{d.start_time?.substring(0, 5)}–{d.end_time?.substring(0, 5)}
                                    </span>
                                    {d.topic && <span className="text-muted-foreground">— {d.topic}</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => goToStep(2)}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={!selectedTurmaId}
                    onClick={() => goToStep(4)}
                  >
                    Continuar <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* ═══ STEP 4: Acompanhantes ═══ */}
            {step === 4 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold">Acompanhantes (opcional)</h4>

                {companions.map((c, i) => (
                  <Card key={i} className="border">
                    <CardContent className="pt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Acompanhante {i + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setCompanions((prev) => prev.filter((_, idx) => idx !== i))}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs">Nome *</Label>
                          <Input
                            value={c.name || ""}
                            onChange={(e) => {
                              const updated = [...companions];
                              updated[i] = { ...updated[i], name: e.target.value };
                              setCompanions(updated);
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Email</Label>
                          <Input
                            value={c.email || ""}
                            onChange={(e) => {
                              const updated = [...companions];
                              updated[i] = { ...updated[i], email: e.target.value };
                              setCompanions(updated);
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Telefone</Label>
                          <Input
                            value={c.phone || ""}
                            onChange={(e) => {
                              const updated = [...companions];
                              updated[i] = { ...updated[i], phone: e.target.value };
                              setCompanions(updated);
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Especialidade</Label>
                          <Input
                            value={c.especialidade || ""}
                            onChange={(e) => {
                              const updated = [...companions];
                              updated[i] = { ...updated[i], especialidade: e.target.value };
                              setCompanions(updated);
                            }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCompanions((prev) => [...prev, {}])}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar acompanhante
                </Button>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => goToStep(3)}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                  </Button>
                  <Button variant="outline" onClick={() => goToStep(5)}>
                    Pular
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => goToStep(5)}
                  >
                    Continuar <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* ═══ STEP 5: Revisão + Preview WA ═══ */}
            {step === 5 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold">Revisão do Agendamento</h4>

                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Curso</span><span>{course.title}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Turma</span><span>{selectedTurma?.label}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Participante</span><span>{formData.person_name}</span></div>
                  {formData.numero_contrato && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Nº Contrato</span><span>{formData.numero_contrato}</span></div>
                  )}
                  {selectedDays.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Datas:</span>
                      {selectedDays.map((d) => (
                        <div key={d.day_number} className="ml-4 text-xs">
                          {formatDatePtBr(d.date)} ({formatWeekday(d.date)}) {d.start_time?.substring(0, 5)}–{d.end_time?.substring(0, 5)}
                          {d.topic && ` — ${d.topic}`}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Equipamentos com serial */}
                  {Object.entries(equipmentData).filter(([, e]) => e?.serial).length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Equipamentos:</span>
                      {Object.entries(equipmentData).map(([key, entry]) => {
                        if (!entry?.serial) return null;
                        const cfg = EQUIP_CONFIG[key as keyof typeof EQUIP_CONFIG];
                        return (
                          <div key={key} className="ml-4 text-xs">
                            {cfg?.label}: {entry.serial}
                            {entry.ativacao && ` (ativação: ${entry.ativacao})`}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Sem telefone */}
                {!dealSearch.result?.telefone_normalized && (
                  <div className="flex items-center gap-2 text-amber-600 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    WhatsApp não será enviado (sem telefone cadastrado)
                  </div>
                )}

                {/* Preview bolha WA */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Preview WhatsApp</h4>
                  <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 text-sm whitespace-pre-wrap max-h-60 overflow-auto">
                    {waPreview}
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Observações (opcional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anotações internas..."
                    rows={2}
                  />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => goToStep(4)}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={submitting}
                    onClick={handleSubmit}
                  >
                    {submitting ? "Confirmando..." : "Confirmar Agendamento"}
                  </Button>
                </div>
              </div>
            )}
          </div>
      </DialogContent>
    </Dialog>
  );
}
