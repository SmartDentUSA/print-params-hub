import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, Legend } from "recharts";
import { Clock, TrendingUp, Zap, Bot, User, FileText, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface WorkflowStage {
  id: string;
  name: string;
  manual: { time_min: number; cost?: number; waste_pct?: number };
  smartdent: { time_min: number; cost?: number; waste_pct?: number };
  asb_delegable: boolean;
}

const WORKFLOW_STAGES: WorkflowStage[] = [
  { id: 'scan', name: 'Escaneamento', manual: { time_min: 15 }, smartdent: { time_min: 5 }, asb_delegable: true },
  { id: 'cad', name: 'CAD/Planejamento', manual: { time_min: 20, cost: 50 }, smartdent: { time_min: 4, cost: 8 }, asb_delegable: false },
  { id: 'print', name: 'CAM & Impressão', manual: { time_min: 15, waste_pct: 20 }, smartdent: { time_min: 0.5, waste_pct: 0 }, asb_delegable: true },
  { id: 'clean', name: 'Limpeza', manual: { time_min: 10 }, smartdent: { time_min: 0.67 }, asb_delegable: true },
  { id: 'cure', name: 'Pós-Cura', manual: { time_min: 15 }, smartdent: { time_min: 5 }, asb_delegable: true },
  { id: 'finish', name: 'Finalização (Make)', manual: { time_min: 30 }, smartdent: { time_min: 9 }, asb_delegable: true }
];

const INVESTIMENTO_INICIAL = 77900;
const FATURAMENTO_KIT = 128524.82;
const LUCRO_KIT = FATURAMENTO_KIT - INVESTIMENTO_INICIAL;
const GRAMAS_POR_PECA = 2.1;
const PRECO_GRAMA_RESINA = 1.50;
const CUSTO_ASB_HORA = 30;

export function SmartOpsSmartFlowAnalytics() {
  const [volumeCoroas, setVolumeCoroas] = useState(30);
  const [volumePlacas, setVolumePlacas] = useState(15);
  const [horaClinica, setHoraClinica] = useState(300);
  const [showLeadGate, setShowLeadGate] = useState(false);
  const [leadForm, setLeadForm] = useState({ nome: '', clinica: '', whatsapp: '' });
  const [submitting, setSubmitting] = useState(false);

  const volumeTotal = volumeCoroas + volumePlacas;

  const calculos = useMemo(() => {
    // Tempos totais
    const totalMinManual = WORKFLOW_STAGES.reduce((acc, s) => acc + s.manual.time_min, 0);
    const totalMinSmart = WORKFLOW_STAGES.reduce((acc, s) => acc + s.smartdent.time_min, 0);
    
    // Horas recuperadas por mês
    const horasRecuperadasMes = ((totalMinManual - totalMinSmart) / 60) * volumeTotal;
    
    // Economia de resina (20% menos desperdício nos suportes)
    const economiaResinaValor = GRAMAS_POR_PECA * 0.20 * PRECO_GRAMA_RESINA * volumeTotal;
    
    // Custo de hora clínica no fluxo manual (apenas etapas não delegáveis no Smart)
    const etapasNaoDelegaveis = WORKFLOW_STAGES.filter(s => !s.asb_delegable);
    const tempoManualDentista = WORKFLOW_STAGES.reduce((acc, s) => acc + s.manual.time_min, 0);
    const tempoSmartDentista = etapasNaoDelegaveis.reduce((acc, s) => acc + s.smartdent.time_min, 0);
    
    const custoHoraManual = (tempoManualDentista / 60) * horaClinica * volumeTotal;
    const custoHoraSmart = (tempoSmartDentista / 60) * horaClinica * volumeTotal;
    const economiaHoraClinica = custoHoraManual - custoHoraSmart;
    
    // Custos fixos das etapas
    const custoFixoManual = WORKFLOW_STAGES.reduce((acc, s) => acc + (s.manual.cost || 0), 0) * volumeTotal;
    const custoFixoSmart = WORKFLOW_STAGES.reduce((acc, s) => acc + (s.smartdent.cost || 0), 0) * volumeTotal;
    const economiaCustoFixo = custoFixoManual - custoFixoSmart;
    
    // Economia total mensal
    const economiaTotalMensal = economiaHoraClinica + economiaResinaValor + economiaCustoFixo;
    
    // Break-even (elementos necessários para pagar investimento)
    const faturamentoPorElemento = 1325; // Média de faturamento por elemento
    const breakEvenElementos = Math.ceil(INVESTIMENTO_INICIAL / faturamentoPorElemento);
    
    return {
      totalMinManual,
      totalMinSmart,
      horasRecuperadasMes,
      economiaResinaValor,
      economiaHoraClinica,
      economiaTotalMensal,
      breakEvenElementos,
      tempoSmartDentista,
      tempoManualDentista
    };
  }, [volumeTotal, horaClinica]);

  // Dados para gráfico de break-even
  const chartData = useMemo(() => {
    const data = [];
    const faturamentoPorElemento = 1325;
    for (let i = 0; i <= 150; i += 10) {
      data.push({
        elementos: i,
        investimento: INVESTIMENTO_INICIAL,
        faturamento: i * faturamentoPorElemento
      });
    }
    return data;
  }, []);

  const chartConfig = {
    investimento: { label: "Investimento", color: "hsl(var(--destructive))" },
    faturamento: { label: "Faturamento Acumulado", color: "hsl(var(--primary))" }
  };

  const handleGeneratePDF = () => {
    setShowLeadGate(true);
  };

  const handleSubmitLead = async () => {
    if (!leadForm.nome || !leadForm.whatsapp) {
      toast.error("Preencha nome e WhatsApp");
      return;
    }

    setSubmitting(true);
    try {
      // Normaliza telefone
      const telefoneNormalized = leadForm.whatsapp.replace(/\D/g, '');
      
      // Tenta buscar lead existente ou inserir novo
      const { data: existing } = await supabase
        .from('lia_attendances')
        .select('id')
        .eq('telefone_normalized', telefoneNormalized)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('lia_attendances')
          .update({
            nome: leadForm.nome,
            empresa_nome: leadForm.clinica,
            source: 'roi-calculator',
            form_name: 'Smart Flow Analytics',
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('lia_attendances')
          .insert({
            nome: leadForm.nome,
            email: `${telefoneNormalized}@roi-calculator.temp`,
            telefone_raw: leadForm.whatsapp,
            telefone_normalized: telefoneNormalized,
            empresa_nome: leadForm.clinica,
            source: 'roi-calculator',
            form_name: 'Smart Flow Analytics'
          });
      }

      toast.success("Relatório disponível! Você receberá via WhatsApp.");
      setShowLeadGate(false);
      setLeadForm({ nome: '', clinica: '', whatsapp: '' });
    } catch (err) {
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            Smart Flow Analytics
          </h2>
          <p className="text-muted-foreground">Simulador de ROI — Fluxo Fragmentado vs Smart Dent</p>
        </div>
        <Button onClick={handleGeneratePDF} className="gap-2">
          <FileText className="w-4 h-4" />
          Gerar Relatório PDF
        </Button>
      </div>

      {/* Sliders de Volume */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Configuração de Volume</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Coroas/Mês</span>
              <Badge variant="outline">{volumeCoroas}</Badge>
            </div>
            <Slider
              value={[volumeCoroas]}
              onValueChange={([v]) => setVolumeCoroas(v)}
              min={0}
              max={100}
              step={1}
            />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Placas/Mês</span>
              <Badge variant="outline">{volumePlacas}</Badge>
            </div>
            <Slider
              value={[volumePlacas]}
              onValueChange={([v]) => setVolumePlacas(v)}
              min={0}
              max={50}
              step={1}
            />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Hora Clínica (R$)</span>
              <Badge variant="outline">R$ {horaClinica}</Badge>
            </div>
            <Slider
              value={[horaClinica]}
              onValueChange={([v]) => setHoraClinica(v)}
              min={150}
              max={600}
              step={10}
            />
          </div>
        </CardContent>
      </Card>

      {/* Cards das Etapas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {WORKFLOW_STAGES.map((stage) => {
          const delta = stage.manual.time_min - stage.smartdent.time_min;
          return (
            <Card key={stage.id} className="relative overflow-hidden">
              <div className="absolute top-2 right-2 flex gap-1">
                {stage.asb_delegable && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Bot className="w-3 h-3" /> ASB
                  </Badge>
                )}
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{stage.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <User className="w-3 h-3" /> Manual
                    </div>
                    <div className="text-lg font-semibold text-destructive">
                      {stage.manual.time_min} min
                    </div>
                    {stage.manual.cost && (
                      <div className="text-xs text-muted-foreground">
                        R$ {stage.manual.cost}
                      </div>
                    )}
                    {stage.manual.waste_pct && (
                      <Badge variant="destructive" className="text-xs">
                        +{stage.manual.waste_pct}% desperdício
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-center">
                    <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                      Δ -{delta.toFixed(1)} min
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Zap className="w-3 h-3" /> Smart
                    </div>
                    <div className="text-lg font-semibold text-primary">
                      {stage.smartdent.time_min} min
                    </div>
                    {stage.smartdent.cost && (
                      <div className="text-xs text-muted-foreground">
                        R$ {stage.smartdent.cost}
                      </div>
                    )}
                    {stage.smartdent.waste_pct === 0 && stage.manual.waste_pct && (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-500/30">
                        <CheckCircle className="w-3 h-3 mr-1" /> Otimizado
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dashboard de Resultados */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Clock className="w-4 h-4" /> Horas Recuperadas/Mês
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {calculos.horasRecuperadasMes.toFixed(1)}h
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {calculos.totalMinManual - calculos.totalMinSmart} min/peça × {volumeTotal} peças
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4" /> Economia de Resina
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              R$ {calculos.economiaResinaValor.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              20% menos desperdício em suportes
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Bot className="w-4 h-4" /> Economia Hora Clínica
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              R$ {calculos.economiaHoraClinica.toFixed(0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {WORKFLOW_STAGES.filter(s => s.asb_delegable).length} etapas delegadas p/ ASB
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/30">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Zap className="w-4 h-4" /> Lucro Kit Inicial
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">
              R$ {LUCRO_KIT.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Faturamento R$ {FATURAMENTO_KIT.toLocaleString('pt-BR')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Break-Even */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Ponto de Equilíbrio (Break-Even)
          </CardTitle>
          <CardDescription>
            O investimento de R$ {INVESTIMENTO_INICIAL.toLocaleString('pt-BR')} é pago no elemento nº {calculos.breakEvenElementos}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="elementos" 
                label={{ value: 'Elementos Produzidos', position: 'insideBottom', offset: -5 }}
                className="text-muted-foreground"
              />
              <YAxis 
                tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`}
                className="text-muted-foreground"
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <ReferenceLine 
                x={97} 
                stroke="hsl(var(--primary))" 
                strokeDasharray="5 5"
                label={{ value: 'Break-Even (#97)', fill: 'hsl(var(--primary))', fontSize: 12 }}
              />
              <Line 
                type="monotone" 
                dataKey="investimento" 
                stroke="hsl(var(--destructive))" 
                strokeWidth={2}
                dot={false}
                name="Investimento"
              />
              <Line 
                type="monotone" 
                dataKey="faturamento" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={false}
                name="Faturamento Acumulado"
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Lead Gate Modal */}
      <Dialog open={showLeadGate} onOpenChange={setShowLeadGate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Relatório de Viabilidade</DialogTitle>
            <DialogDescription>
              Preencha seus dados para receber o relatório completo em PDF via WhatsApp
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome *</label>
              <Input
                value={leadForm.nome}
                onChange={(e) => setLeadForm(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Seu nome completo"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Clínica</label>
              <Input
                value={leadForm.clinica}
                onChange={(e) => setLeadForm(prev => ({ ...prev, clinica: e.target.value }))}
                placeholder="Nome da clínica"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">WhatsApp *</label>
              <Input
                value={leadForm.whatsapp}
                onChange={(e) => setLeadForm(prev => ({ ...prev, whatsapp: e.target.value }))}
                placeholder="(11) 99999-9999"
              />
            </div>
            <Button 
              onClick={handleSubmitLead} 
              className="w-full" 
              disabled={submitting}
            >
              {submitting ? "Enviando..." : "Receber Relatório"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
