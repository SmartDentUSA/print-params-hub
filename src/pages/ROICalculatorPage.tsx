import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Calculator, ArrowLeft, Package, Clock, TrendingUp, Zap, Bot, User, CheckCircle
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getKnowledgeBasePath } from "@/utils/i18nPaths";

interface WorkflowStage {
  name: string;
  manual_min: number;
  smart_min: number;
  manual_cost?: number;
  smart_cost?: number;
  asb: boolean;
}

function buildStages(card: any): WorkflowStage[] {
  return [
    { name: "Escaneamento", manual_min: Number(card.scan_time_manual) || 0, smart_min: Number(card.scan_time_smart) || 0, asb: !!card.asb_scan },
    { name: "CAD Planejamento", manual_min: Number(card.cad_time_manual) || 0, smart_min: Number(card.cad_time_smart) || 0, manual_cost: Number(card.cad_cost_manual) || 0, smart_cost: Number(card.cad_cost_smart) || 0, asb: !!card.asb_cad },
    { name: "CAM Impressão", manual_min: Number(card.cam_time_manual) || 0, smart_min: Number(card.cam_time_smart) || 0, asb: !!card.asb_cam },
    { name: "Impressão", manual_min: Number(card.print_time_manual) || 0, smart_min: Number(card.print_time_smart) || 0, asb: !!card.asb_print },
    { name: "Limpeza Pós impressão", manual_min: Number(card.clean_time_manual) || 0, smart_min: Number(card.clean_time_smart) || 0, asb: !!card.asb_clean },
    { name: "Pós cura", manual_min: Number(card.cure_time_manual) || 0, smart_min: Number(card.cure_time_smart) || 0, asb: !!card.asb_cure },
    { name: "Finalização", manual_min: Number(card.finish_time_manual) || 0, smart_min: Number(card.finish_time_smart) || 0, asb: !!card.asb_finish },
  ];
}

function ROICardCalculator({ card }: { card: any }) {
  const stages = useMemo(() => buildStages(card), [card]);
  const investimento = Number(card.investimento_inicial) || 0;
  const faturamento = Number(card.faturamento_kit) || 0;
  const lucro = faturamento - investimento;
  const totalManual = stages.reduce((a, s) => a + s.manual_min, 0);
  const totalSmart = stages.reduce((a, s) => a + s.smart_min, 0);
  const economiaMin = totalManual - totalSmart;

  return (
    <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-primary/20">
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <Clock className="w-5 h-5 mx-auto text-primary mb-1" />
            <p className="text-xs text-muted-foreground">Economia/peça</p>
            <p className="text-lg font-bold text-primary">{economiaMin.toFixed(1)} min</p>
          </CardContent>
        </Card>
        <Card className="border-secondary/40">
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <TrendingUp className="w-5 h-5 mx-auto text-secondary-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Investimento</p>
            <p className="text-lg font-bold text-foreground">R$ {investimento.toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>
        <Card className="border-accent/40">
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <Zap className="w-5 h-5 mx-auto text-accent-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Faturamento Kit</p>
            <p className="text-lg font-bold text-foreground">R$ {faturamento.toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>
        <Card className="border-primary/20">
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <Calculator className="w-5 h-5 mx-auto text-primary mb-1" />
            <p className="text-xs text-muted-foreground">Lucro Kit</p>
            <p className={`text-lg font-bold ${lucro >= 0 ? "text-primary" : "text-destructive"}`}>
              R$ {lucro.toLocaleString("pt-BR")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Workflow stages comparison — horizontal columns */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Comparação de Workflow por Etapa</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="flex gap-2 min-w-[700px]">
            {stages.map((stage) => {
              const delta = stage.manual_min - stage.smart_min;
              return (
                <div key={stage.name} className="flex-1 rounded-lg border p-3 flex flex-col items-center text-center relative min-w-[90px]">
                  {stage.asb && (
                    <Badge variant="secondary" className="text-[10px] gap-0.5 mb-1 px-1.5 py-0.5">
                      <Bot className="w-3 h-3" /> ASB
                    </Badge>
                  )}
                  <p className="font-semibold text-xs mb-2 leading-tight">{stage.name}</p>
                  <div className="space-y-1.5 w-full">
                    <div className="bg-destructive/10 rounded px-2 py-1.5">
                      <span className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5"><User className="w-3 h-3" /> Manual</span>
                      <span className="text-sm font-bold text-destructive">{stage.manual_min} min</span>
                      {stage.manual_cost ? <span className="block text-[10px] text-muted-foreground">R$ {stage.manual_cost}</span> : null}
                    </div>
                    <Badge className="bg-primary/10 text-primary border-primary/30 text-[10px] w-full justify-center">
                      Δ -{delta.toFixed(1)} min
                    </Badge>
                    <div className="bg-primary/10 rounded px-2 py-1.5">
                      <span className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5"><Zap className="w-3 h-3" /> Smart</span>
                      <span className="text-sm font-bold text-primary">{stage.smart_min} min</span>
                      {stage.smart_cost ? <span className="block text-[10px] text-muted-foreground">R$ {stage.smart_cost}</span> : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <h3 className="font-medium text-sm">💡 Como interpretar:</h3>
        <ul className="text-sm text-muted-foreground space-y-1 ml-4">
          <li>• <strong>Economia/peça:</strong> Minutos economizados em cada peça produzida</li>
          <li>• <strong>ASB:</strong> Etapas que podem ser delegadas para auxiliar</li>
          <li>• <strong>Lucro Kit:</strong> Faturamento do combo menos o investimento</li>
        </ul>
      </div>
    </div>
  );
}

export default function ROICalculatorPage() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const { data: roiCards = [], isLoading } = useQuery({
    queryKey: ["roi-cards-public"],
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

  const selectedCard = roiCards.find((c: any) => c.id === selectedCardId);

  return (
    <div className="min-h-screen bg-gradient-surface">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => navigate(getKnowledgeBasePath(language))} className="mb-4 gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t("common.back")}
          </Button>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t("knowledge.roi_calculator")}
          </h1>
          <p className="text-lg text-muted-foreground">
            Selecione um equipamento para visualizar o cálculo de ROI detalhado
          </p>
        </div>

        {/* Card Gallery */}
        {isLoading ? (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : roiCards.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">Nenhuma calculadora disponível no momento.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
            {roiCards.map((card: any) => (
              <button
                key={card.id}
                onClick={() => setSelectedCardId(card.id === selectedCardId ? null : card.id)}
                className={`rounded-xl border-2 p-4 text-left transition-all hover:shadow-lg group ${
                  card.id === selectedCardId
                    ? "border-primary bg-primary/5 shadow-lg ring-2 ring-primary/20"
                    : "border-border hover:border-primary/40"
                }`}
              >
                {card.image_url ? (
                  <img
                    src={card.image_url}
                    alt={card.name}
                    className="w-full h-28 object-contain rounded-lg mb-3 group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-28 bg-muted rounded-lg mb-3 flex items-center justify-center">
                    <Package className="w-10 h-10 text-muted-foreground/30" />
                  </div>
                )}
                <p className="font-semibold text-sm truncate">{card.name}</p>
                <Badge variant="outline" className="text-xs mt-1">{card.category}</Badge>
                {card.id === selectedCardId && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                    <CheckCircle className="w-3 h-3" /> Selecionado
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Expanded Calculator */}
        {selectedCard && (
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
              <CheckCircle className="w-4 h-4 text-primary" />
              Calculando ROI para: <strong className="text-foreground">{(selectedCard as any).name}</strong>
            </div>
            <ROICardCalculator card={selectedCard} />
          </div>
        )}
      </div>
    </div>
  );
}
