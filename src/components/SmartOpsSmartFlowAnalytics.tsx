import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Legend } from "recharts";
import { Clock, TrendingUp, Zap, Bot, User, FileText, CheckCircle, Package } from "lucide-react";
import { toast } from "sonner";
import { SmartOpsROICardsManager } from "./SmartOpsROICardsManager";

interface WorkflowStage {
  id: string;
  name: string;
  manual: { time_min: number; cost?: number; waste_pct?: number };
  smartdent: { time_min: number; cost?: number; waste_pct?: number };
  asb_delegable: boolean;
}

const DEFAULT_STAGES: WorkflowStage[] = [
  { id: 'scan', name: 'Escaneamento', manual: { time_min: 15 }, smartdent: { time_min: 5 }, asb_delegable: true },
  { id: 'cad', name: 'CAD/Planejamento', manual: { time_min: 20, cost: 50 }, smartdent: { time_min: 4, cost: 8 }, asb_delegable: false },
  { id: 'print', name: 'CAM & Impressão', manual: { time_min: 15, waste_pct: 20 }, smartdent: { time_min: 0.5, waste_pct: 0 }, asb_delegable: true },
  { id: 'clean', name: 'Limpeza', manual: { time_min: 10 }, smartdent: { time_min: 0.67 }, asb_delegable: true },
  { id: 'cure', name: 'Pós-Cura', manual: { time_min: 15 }, smartdent: { time_min: 5 }, asb_delegable: true },
  { id: 'finish', name: 'Finalização (Make)', manual: { time_min: 30 }, smartdent: { time_min: 9 }, asb_delegable: true }
];

const GRAMAS_POR_PECA = 2.1;
const PRECO_GRAMA_RESINA = 1.50;

export function SmartOpsSmartFlowAnalytics() {
  const [volumeCoroas, setVolumeCoroas] = useState(30);
  const [volumePlacas, setVolumePlacas] = useState(15);
  const [horaClinica, setHoraClinica] = useState(300);
  const [showLeadGate, setShowLeadGate] = useState(false);
  const [leadForm, setLeadForm] = useState({ nome: '', clinica: '', whatsapp: '' });
  const [submitting, setSubmitting] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);

  const volumeTotal = volumeCoroas + volumePlacas;

  // Fetch published cards
  const { data: roiCards = [] } = useQuery({
    queryKey: ["roi-cards-published"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roi_cards")
        .select("*")
        .eq("status", "publicado")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const selectedCard = roiCards.find((c: any) => c.id === selectedCardId) as any;

  // Map selected card to workflow stages
  const workflowStages: WorkflowStage[] = useMemo(() => {
    if (!selectedCard) return DEFAULT_STAGES;
    return [
      { id: 'scan', name: 'Escaneamento', manual: { time_min: Number(selectedCard.scan_time_manual) }, smartdent: { time_min: Number(selectedCard.scan_time_smart) }, asb_delegable: selectedCard.asb_scan },
      { id: 'cad', name: 'CAD/Planejamento', manual: { time_min: Number(selectedCard.cad_time_manual), cost: Number(selectedCard.cad_cost_manual) }, smartdent: { time_min: Number(selectedCard.cad_time_smart), cost: Number(selectedCard.cad_cost_smart) }, asb_delegable: selectedCard.asb_cad },
      { id: 'print', name: 'CAM & Impressão', manual: { time_min: Number(selectedCard.print_time_manual), waste_pct: Number(selectedCard.waste_pct_manual) }, smartdent: { time_min: Number(selectedCard.print_time_smart), waste_pct: Number(selectedCard.waste_pct_smart) }, asb_delegable: selectedCard.asb_print },
      { id: 'clean', name: 'Limpeza', manual: { time_min: Number(selectedCard.clean_time_manual) }, smartdent: { time_min: Number(selectedCard.clean_time_smart) }, asb_delegable: selectedCard.asb_clean },
      { id: 'cure', name: 'Pós-Cura', manual: { time_min: Number(selectedCard.cure_time_manual) }, smartdent: { time_min: Number(selectedCard.cure_time_smart) }, asb_delegable: selectedCard.asb_cure },
      { id: 'finish', name: 'Finalização (Make)', manual: { time_min: Number(selectedCard.finish_time_manual) }, smartdent: { time_min: Number(selectedCard.finish_time_smart) }, asb_delegable: selectedCard.asb_finish },
    ];
  }, [selectedCard]);

  const investimentoInicial = selectedCard ? Number(selectedCard.investimento_inicial) : 77900;
  const faturamentoKit = selectedCard ? Number(selectedCard.faturamento_kit) : 128524.82;
  const lucroKit = faturamentoKit - investimentoInicial;
  const wastePctManual = selectedCard ? Number(selectedCard.waste_pct_manual) : 20;

  const calculos = useMemo(() => {
    const totalMinManual = workflowStages.reduce((acc, s) => acc + s.manual.time_min, 0);
    const totalMinSmart = workflowStages.reduce((acc, s) => acc + s.smartdent.time_min, 0);
    const horasRecuperadasMes = ((totalMinManual - totalMinSmart) / 60) * volumeTotal;
    const economiaResinaValor = GRAMAS_POR_PECA * (wastePctManual / 100) * PRECO_GRAMA_RESINA * volumeTotal;

    const etapasNaoDelegaveis = workflowStages.filter(s => !s.asb_delegable);
    const tempoManualDentista = workflowStages.reduce((acc, s) => acc + s.manual.time_min, 0);
    const tempoSmartDentista = etapasNaoDelegaveis.reduce((acc, s) => acc + s.smartdent.time_min, 0);

    const custoHoraManual = (tempoManualDentista / 60) * horaClinica * volumeTotal;
    const custoHoraSmart = (tempoSmartDentista / 60) * horaClinica * volumeTotal;
    const economiaHoraClinica = custoHoraManual - custoHoraSmart;

    const custoFixoManual = workflowStages.reduce((acc, s) => acc + (s.manual.cost || 0), 0) * volumeTotal;
    const custoFixoSmart = workflowStages.reduce((acc, s) => acc + (s.smartdent.cost || 0), 0) * volumeTotal;
    const economiaCustoFixo = custoFixoManual - custoFixoSmart;

    const economiaTotalMensal = economiaHoraClinica + economiaResinaValor + economiaCustoFixo;

    const faturamentoPorElemento = 1325;
    const breakEvenElementos = Math.ceil(investimentoInicial / faturamentoPorElemento);

    return {
      totalMinManual, totalMinSmart, horasRecuperadasMes,
      economiaResinaValor, economiaHoraClinica, economiaTotalMensal,
      breakEvenElementos, tempoSmartDentista, tempoManualDentista
    };
  }, [workflowStages, volumeTotal, horaClinica, investimentoInicial, wastePctManual]);

  const chartData = useMemo(() => {
    const data = [];
    const faturamentoPorElemento = 1325;
    for (let i = 0; i <= 150; i += 10) {
      data.push({ elementos: i, investimento: investimentoInicial, faturamento: i * faturamentoPorElemento });
    }
    return data;
  }, [investimentoInicial]);

  const chartConfig = {
    investimento: { label: "Investimento", color: "hsl(var(--destructive))" },
    faturamento: { label: "Faturamento Acumulado", color: "hsl(var(--primary))" }
  };

  const handleSubmitLead = async () => {
    if (!leadForm.nome || !leadForm.whatsapp) { toast.error("Preencha nome e WhatsApp"); return; }
    setSubmitting(true);
    try {
      const telefoneNormalized = leadForm.whatsapp.replace(/\D/g, '');
      const { data: existing } = await supabase.from('lia_attendances').select('id').eq('telefone_normalized', telefoneNormalized).maybeSingle();
      if (existing) {
        await supabase.from('lia_attendances').update({ nome: leadForm.nome, empresa_nome: leadForm.clinica, source: 'roi-calculator', form_name: 'Smart Flow Analytics', updated_at: new Date().toISOString() }).eq('id', existing.id);
      } else {
        await supabase.from('lia_attendances').insert({ nome: leadForm.nome, email: `${telefoneNormalized}@roi-calculator.temp`, telefone_raw: leadForm.whatsapp, telefone_normalized: telefoneNormalized, empresa_nome: leadForm.clinica, source: 'roi-calculator', form_name: 'Smart Flow Analytics' });
      }
      toast.success("Relatório disponível! Você receberá via WhatsApp.");
      setShowLeadGate(false);
      setLeadForm({ nome: '', clinica: '', whatsapp: '' });
    } catch { toast.error("Erro ao salvar. Tente novamente."); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" /> Smart Flow Analytics
          </h2>
          <p className="text-muted-foreground">Simulador de ROI — Selecione um equipamento para calcular</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAdmin(!showAdmin)}>
            {showAdmin ? "Fechar Admin" : "⚙ Gerenciar Cards"}
          </Button>
          <Button onClick={() => setShowLeadGate(true)} className="gap-2">
            <FileText className="w-4 h-4" /> Gerar Relatório PDF
          </Button>
        </div>
      </div>

      {/* Admin Panel */}
      {showAdmin && <SmartOpsROICardsManager />}

      {/* Gallery */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2"><Package className="w-5 h-5" /> Selecione o Equipamento</CardTitle>
          <CardDescription>Clique em um card para carregar seus parâmetros na calculadora</CardDescription>
        </CardHeader>
        <CardContent>
          {roiCards.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum card publicado. Cadastre cards no painel admin acima.</p>
          ) : (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {roiCards.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCardId(c.id === selectedCardId ? null : c.id)}
                  className={`rounded-lg border-2 p-3 text-left transition-all hover:shadow-md ${
                    c.id === selectedCardId
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  {c.image_url ? (
                    <img src={c.image_url} alt={c.name} className="w-full h-20 object-contain rounded mb-2" />
                  ) : (
                    <div className="w-full h-20 bg-muted rounded mb-2 flex items-center justify-center">
                      <Package className="w-8 h-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <Badge variant="outline" className="text-xs mt-1">{c.category}</Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected card indicator */}
      {selectedCard && (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-primary" />
          Calculando com: <strong className="text-foreground">{selectedCard.name}</strong>
          <span className="text-xs">(Investimento: R$ {investimentoInicial.toLocaleString('pt-BR')} | Faturamento: R$ {faturamentoKit.toLocaleString('pt-BR')})</span>
        </div>
      )}

      {/* Sliders */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">Configuração de Volume</CardTitle></CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span>Coroas/Mês</span><Badge variant="outline">{volumeCoroas}</Badge></div>
            <Slider value={[volumeCoroas]} onValueChange={([v]) => setVolumeCoroas(v)} min={0} max={100} step={1} />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span>Placas/Mês</span><Badge variant="outline">{volumePlacas}</Badge></div>
            <Slider value={[volumePlacas]} onValueChange={([v]) => setVolumePlacas(v)} min={0} max={50} step={1} />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span>Hora Clínica (R$)</span><Badge variant="outline">R$ {horaClinica}</Badge></div>
            <Slider value={[horaClinica]} onValueChange={([v]) => setHoraClinica(v)} min={150} max={600} step={10} />
          </div>
        </CardContent>
      </Card>

      {/* Stage Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {workflowStages.map((stage) => {
          const delta = stage.manual.time_min - stage.smartdent.time_min;
          return (
            <Card key={stage.id} className="relative overflow-hidden">
              <div className="absolute top-2 right-2 flex gap-1">
                {stage.asb_delegable && (
                  <Badge variant="secondary" className="text-xs gap-1"><Bot className="w-3 h-3" /> ASB</Badge>
                )}
              </div>
              <CardHeader className="pb-2"><CardTitle className="text-base">{stage.name}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1"><User className="w-3 h-3" /> Manual</div>
                    <div className="text-lg font-semibold text-destructive">{stage.manual.time_min} min</div>
                    {stage.manual.cost && <div className="text-xs text-muted-foreground">R$ {stage.manual.cost}</div>}
                    {stage.manual.waste_pct ? <Badge variant="destructive" className="text-xs">+{stage.manual.waste_pct}% desperdício</Badge> : null}
                  </div>
                  <div className="flex items-center justify-center">
                    <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Δ -{delta.toFixed(1)} min</Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Zap className="w-3 h-3" /> Smart</div>
                    <div className="text-lg font-semibold text-primary">{stage.smartdent.time_min} min</div>
                    {stage.smartdent.cost && <div className="text-xs text-muted-foreground">R$ {stage.smartdent.cost}</div>}
                    {stage.smartdent.waste_pct === 0 && stage.manual.waste_pct ? (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" /> Otimizado</Badge>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dashboard */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><Clock className="w-4 h-4" /> Horas Recuperadas/Mês</CardDescription></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{calculos.horasRecuperadasMes.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground mt-1">{(calculos.totalMinManual - calculos.totalMinSmart).toFixed(1)} min/peça × {volumeTotal} peças</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><TrendingUp className="w-4 h-4" /> Economia de Resina</CardDescription></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">R$ {calculos.economiaResinaValor.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">{wastePctManual}% menos desperdício em suportes</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5">
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><Bot className="w-4 h-4" /> Economia Hora Clínica</CardDescription></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">R$ {calculos.economiaHoraClinica.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground mt-1">{workflowStages.filter(s => s.asb_delegable).length} etapas delegadas p/ ASB</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/30">
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><Zap className="w-4 h-4" /> Lucro Kit Inicial</CardDescription></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">R$ {lucroKit.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground mt-1">Faturamento R$ {faturamentoKit.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Break-Even Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Ponto de Equilíbrio (Break-Even)</CardTitle>
          <CardDescription>O investimento de R$ {investimentoInicial.toLocaleString('pt-BR')} é pago no elemento nº {calculos.breakEvenElementos}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="elementos" label={{ value: 'Elementos Produzidos', position: 'insideBottom', offset: -5 }} className="text-muted-foreground" />
              <YAxis tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} className="text-muted-foreground" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <ReferenceLine x={calculos.breakEvenElementos} stroke="hsl(var(--primary))" strokeDasharray="5 5" label={{ value: `Break-Even (#${calculos.breakEvenElementos})`, fill: 'hsl(var(--primary))', fontSize: 12 }} />
              <Line type="monotone" dataKey="investimento" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} name="Investimento" />
              <Line type="monotone" dataKey="faturamento" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Faturamento Acumulado" />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Lead Gate Modal */}
      <Dialog open={showLeadGate} onOpenChange={setShowLeadGate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Relatório de Viabilidade</DialogTitle>
            <DialogDescription>Preencha seus dados para receber o relatório completo em PDF via WhatsApp</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome *</label>
              <Input value={leadForm.nome} onChange={(e) => setLeadForm(prev => ({ ...prev, nome: e.target.value }))} placeholder="Seu nome completo" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Clínica</label>
              <Input value={leadForm.clinica} onChange={(e) => setLeadForm(prev => ({ ...prev, clinica: e.target.value }))} placeholder="Nome da clínica" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">WhatsApp *</label>
              <Input value={leadForm.whatsapp} onChange={(e) => setLeadForm(prev => ({ ...prev, whatsapp: e.target.value }))} placeholder="(11) 99999-9999" />
            </div>
            <Button onClick={handleSubmitLead} className="w-full" disabled={submitting}>
              {submitting ? "Enviando..." : "Receber Relatório"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
