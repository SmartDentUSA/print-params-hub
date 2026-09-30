import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, UserCheck, X } from "lucide-react";

interface Props {
  formId: string;
}

interface Prof {
  id: string;
  nome: string | null;
  email: string | null;
  especialidade?: string | null;
  area_atuacao?: string | null;
}

/**
 * Configuração exclusiva dos formulários do tipo "Credenciamento":
 * vincula o formulário à ficha de um profissional.
 */
export default function CredenciamentoConfig({ formId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linked, setLinked] = useState<Prof | null>(null);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Prof[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("smartops_forms" as any)
      .select("professional_lead_id")
      .eq("id", formId)
      .maybeSingle();
    const leadId = (data as any)?.professional_lead_id as string | undefined;
    if (leadId) {
      const { data: lead } = await supabase
        .from("lia_attendances")
        .select("id, nome, email, especialidade, area_atuacao")
        .eq("id", leadId)
        .maybeSingle();
      setLinked((lead as any) ?? null);
    } else {
      setLinked(null);
    }
    setLoading(false);
  }, [formId]);

  useEffect(() => { void load(); }, [load]);

  const search = async () => {
    const q = term.trim();
    if (q.length < 2) return;
    setSearching(true);
    const { data } = await supabase
      .from("lia_attendances")
      .select("id, nome, email, especialidade, area_atuacao")
      .is("merged_into", null)
      .or(`nome.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(15);
    setResults(((data as any[]) ?? []) as Prof[]);
    setSearching(false);
  };

  const link = async (prof: Prof | null) => {
    setSaving(true);
    const { error } = await supabase
      .from("smartops_forms" as any)
      .update({ professional_lead_id: prof?.id ?? null } as any)
      .eq("id", formId);
    setSaving(false);
    if (error) {
      toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" });
      return;
    }
    setLinked(prof);
    setResults([]);
    setTerm("");
    toast({ title: prof ? "Profissional vinculado" : "Vínculo removido" });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <UserCheck className="w-4 h-4" /> Credenciamento — profissional responsável
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando vínculo...
          </div>
        ) : (
          <>
            {linked ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
                <div>
                  <p className="font-medium text-sm">{linked.nome ?? "(sem nome)"}</p>
                  <p className="text-xs text-muted-foreground">{linked.email}</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {linked.especialidade && <Badge variant="outline" className="text-[10px]">{linked.especialidade}</Badge>}
                    {linked.area_atuacao && <Badge variant="outline" className="text-[10px]">{linked.area_atuacao}</Badge>}
                  </div>
                </div>
                <Button variant="ghost" size="sm" disabled={saving} onClick={() => link(null)}>
                  <X className="w-4 h-4 mr-1" /> Remover
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum profissional vinculado. As candidaturas deste formulário ficam associadas à ficha do profissional escolhido.
              </p>
            )}

            <div>
              <Label className="text-xs">Buscar profissional (nome ou e-mail)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search()}
                  placeholder="Ex.: Erick adriano de souza"
                />
                <Button variant="outline" onClick={search} disabled={searching || term.trim().length < 2}>
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {results.length > 0 && (
              <div className="rounded-lg border divide-y max-h-64 overflow-y-auto">
                {results.map((r) => (
                  <button
                    key={r.id}
                    className="w-full text-left p-2.5 hover:bg-muted transition-colors"
                    onClick={() => link(r)}
                    disabled={saving}
                  >
                    <p className="text-sm font-medium">{r.nome ?? "(sem nome)"}</p>
                    <p className="text-xs text-muted-foreground">{r.email}</p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
