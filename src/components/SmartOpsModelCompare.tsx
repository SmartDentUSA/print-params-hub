import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ModelResult {
  model: string;
  response: string;
  latency_ms: number;
  error?: string;
}

export function SmartOpsModelCompare() {
  const [prompt, setPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(
    "Você é um especialista em odontologia digital 3D da Smart Dent."
  );
  const [results, setResults] = useState<ModelResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleCompare = async () => {
    if (!prompt.trim()) {
      toast.error("Digite um prompt para comparar");
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke("ai-model-compare", {
        body: {
          prompt,
          system_prompt: systemPrompt || undefined,
          models: ["gemini", "deepseek"],
          max_tokens: 600,
        },
      });

      if (error) throw error;
      setResults(data.results || []);
    } catch (err) {
      toast.error(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const getModelColor = (model: string) => {
    if (model.includes("gemini")) return "bg-blue-100 text-blue-800 border-blue-300";
    if (model.includes("deepseek")) return "bg-emerald-100 text-emerald-800 border-emerald-300";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Comparador de Modelos IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-sm font-medium text-muted-foreground">System Prompt</label>
            <Input
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Instrução de sistema (opcional)"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Prompt de teste</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: Qual a diferença entre a MiiCraft 125 e a Phrozen Sonic Mini 8K?"
              rows={3}
            />
          </div>
          <Button onClick={handleCompare} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Comparando...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" /> Comparar Gemini vs DeepSeek
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {results.map((r) => (
            <Card key={r.model} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge className={getModelColor(r.model)}>{r.model}</Badge>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {(r.latency_ms / 1000).toFixed(1)}s
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                {r.error ? (
                  <div className="flex items-start gap-2 text-destructive text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{r.error}</span>
                  </div>
                ) : (
                  <div className="text-sm whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">
                    {r.response}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
