import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Calculator, DollarSign, TrendingUp, Clock, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getKnowledgeBasePath } from "@/utils/i18nPaths";

interface ROICalculator {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: "rascunho" | "publicado";
  investimento_inicial: number;
  custo_terceirizado_peca: number;
  custo_operacional_peca: number;
  volume_mensal: number;
  created_at: string;
}

interface CalculatorInputs {
  investimento_inicial: number;
  custo_terceirizado_peca: number;
  custo_operacional_peca: number;
  volume_mensal: number;
}

function calcROI(inputs: CalculatorInputs) {
  const economiaPorPeca = inputs.custo_terceirizado_peca - inputs.custo_operacional_peca;
  const economiaMensal = economiaPorPeca * inputs.volume_mensal;
  const paybackMeses = economiaMensal > 0 ? inputs.investimento_inicial / economiaMensal : Infinity;
  const roiAnual = inputs.investimento_inicial > 0
    ? ((economiaMensal * 12 - inputs.investimento_inicial) / inputs.investimento_inicial) * 100
    : 0;
  return { economiaPorPeca, economiaMensal, paybackMeses, roiAnual };
}

function ROIResults({ inputs }: { inputs: CalculatorInputs }) {
  const { economiaPorPeca, economiaMensal, paybackMeses, roiAnual } = calcROI(inputs);
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
      <Card className="border-border">
        <CardContent className="pt-4 pb-3 px-4 text-center">
          <DollarSign className="w-6 h-6 mx-auto text-emerald-500 mb-2" />
          <p className="text-sm text-muted-foreground mb-1">Economia por peça</p>
          <p className="text-xl font-bold text-emerald-600">
            R$ {economiaPorPeca.toFixed(2)}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="pt-4 pb-3 px-4 text-center">
          <TrendingUp className="w-6 h-6 mx-auto text-primary mb-2" />
          <p className="text-sm text-muted-foreground mb-1">Economia mensal</p>
          <p className="text-xl font-bold text-primary">
            R$ {economiaMensal.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="pt-4 pb-3 px-4 text-center">
          <Clock className="w-6 h-6 mx-auto text-amber-500 mb-2" />
          <p className="text-sm text-muted-foreground mb-1">Tempo de Payback</p>
          <p className="text-xl font-bold text-amber-600">
            {paybackMeses === Infinity ? "—" : `${paybackMeses.toFixed(1)} meses`}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="pt-4 pb-3 px-4 text-center">
          <Calculator className="w-6 h-6 mx-auto text-purple-500 mb-2" />
          <p className="text-sm text-muted-foreground mb-1">ROI Anual</p>
          <p className={`text-xl font-bold ${roiAnual >= 0 ? "text-emerald-600" : "text-destructive"}`}>
            {roiAnual.toFixed(0)}%
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ROICalculatorPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  // Load calculators from localStorage
  const calculators = useMemo(() => {
    try {
      const stored = localStorage.getItem("roi_calculators");
      const all: ROICalculator[] = stored ? JSON.parse(stored) : [];
      return all.filter(calc => calc.status === "publicado");
    } catch {
      return [];
    }
  }, []);

  // Find specific calculator or show general calculator
  const selectedCalculator = slug ? calculators.find(calc => calc.slug === slug) : null;

  // User inputs for calculator
  const [inputs, setInputs] = useState<CalculatorInputs>(() => ({
    investimento_inicial: selectedCalculator?.investimento_inicial || 50000,
    custo_terceirizado_peca: selectedCalculator?.custo_terceirizado_peca || 80,
    custo_operacional_peca: selectedCalculator?.custo_operacional_peca || 15,
    volume_mensal: selectedCalculator?.volume_mensal || 100,
  }));

  const handleInputChange = (field: keyof CalculatorInputs, value: number) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  const handleBack = () => {
    navigate(getKnowledgeBasePath(language));
  };

  return (
    <div className="min-h-screen bg-gradient-surface">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={handleBack}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')}
          </Button>

          <h1 className="text-3xl font-bold text-foreground mb-2">
            {selectedCalculator ? selectedCalculator.name : t('knowledge.roi_calculator')}
          </h1>
          <p className="text-lg text-muted-foreground">
            {t('knowledge.roi_calculator_description')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calculator Inputs */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-primary" />
                  Dados para Cálculo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="investimento">Investimento inicial (R$)</Label>
                  <Input
                    id="investimento"
                    type="number"
                    value={inputs.investimento_inicial}
                    onChange={(e) => handleInputChange('investimento_inicial', Number(e.target.value))}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="terceirizado">Custo terceirizado por peça (R$)</Label>
                  <Input
                    id="terceirizado"
                    type="number"
                    step="0.01"
                    value={inputs.custo_terceirizado_peca}
                    onChange={(e) => handleInputChange('custo_terceirizado_peca', Number(e.target.value))}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="operacional">Custo operacional por peça (R$)</Label>
                  <Input
                    id="operacional"
                    type="number"
                    step="0.01"
                    value={inputs.custo_operacional_peca}
                    onChange={(e) => handleInputChange('custo_operacional_peca', Number(e.target.value))}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="volume">Volume mensal (peças)</Label>
                  <Input
                    id="volume"
                    type="number"
                    value={inputs.volume_mensal}
                    onChange={(e) => handleInputChange('volume_mensal', Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Resultados do Cálculo ROI</CardTitle>
              </CardHeader>
              <CardContent>
                <ROIResults inputs={inputs} />

                <Separator className="my-6" />

                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <h3 className="font-medium text-sm">💡 Como interpretar os resultados:</h3>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• <strong>Economia por peça:</strong> Quanto você economiza produzindo internamente vs terceirizando</li>
                    <li>• <strong>Economia mensal:</strong> Total economizado por mês com base no seu volume</li>
                    <li>• <strong>Payback:</strong> Tempo para recuperar o investimento inicial</li>
                    <li>• <strong>ROI Anual:</strong> Retorno percentual sobre o investimento no primeiro ano</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Published Calculators List */}
        {!selectedCalculator && calculators.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">Calculadoras Disponíveis</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {calculators.map(calc => (
                <Card key={calc.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">{calc.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Calculadora específica com valores otimizados
                    </p>
                    <Button 
                      onClick={() => navigate(`${getKnowledgeBasePath(language)}/calculadora-roi/${calc.slug}`)}
                      className="w-full gap-2"
                    >
                      <Calculator className="w-4 h-4" />
                      Usar Calculadora
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}