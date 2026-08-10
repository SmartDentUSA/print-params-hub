import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, Link2, Loader2, MessageCircle, Mail, ShieldOff } from "lucide-react";

interface TokenRow {
  id: string;
  token: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  uses: number;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  professional: { id: string; nome: string | null; email: string | null; prof_wa_ddi?: string | null; prof_wa_number?: string | null };
}

const makeToken = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
};

export default function ShareCoursePortalDialog({ open, onOpenChange, professional }: Props) {
  const { toast } = useToast();
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(90);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("professional_portal_tokens")
      .select("id, token, expires_at, revoked_at, last_used_at, uses, created_at")
      .eq("lead_id", professional.id)
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Erro ao carregar links", description: error.message, variant: "destructive" });
    setTokens((data ?? []) as TokenRow[]);
    setLoading(false);
  }, [professional.id, toast]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const urlFor = (t: string) => `${window.location.origin}/portal-cursos/${t}`;

  const generate = async () => {
    const token = makeToken();
    const expires = new Date(Date.now() + Math.max(1, days) * 86400000).toISOString();
    const { error } = await supabase.from("professional_portal_tokens").insert({
      token,
      lead_id: professional.id,
      expires_at: expires,
      created_by: "smartops_cursos",
    });
    if (error) {
      toast({ title: "Erro ao gerar link", description: error.message, variant: "destructive" });
      return;
    }
    await navigator.clipboard.writeText(urlFor(token)).catch(() => undefined);
    toast({ title: "Link gerado e copiado" });
    void load();
  };

  const revoke = async (id: string) => {
    const { error } = await supabase
      .from("professional_portal_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro ao revogar", description: error.message, variant: "destructive" });
      return;
    }
    void load();
  };

  const waHref = (t: string) => {
    const digits = `${professional.prof_wa_ddi ?? "55"}${(professional.prof_wa_number ?? "").replace(/\D/g, "")}`;
    const msg = `Olá ${professional.nome ?? ""}! Este é o seu link exclusivo para cadastrar e editar seus cursos: ${urlFor(t)}`;
    const base = digits.length > 6 ? `https://wa.me/${digits}` : "https://wa.me/";
    return `${base}?text=${encodeURIComponent(msg)}`;
  };

  const mailHref = (t: string) =>
    `mailto:${professional.email ?? ""}?subject=${encodeURIComponent("Seu portal de cursos — Smart Dent")}&body=${encodeURIComponent(
      `Olá ${professional.nome ?? ""},\n\nUse o link abaixo para cadastrar e editar seus cursos:\n${urlFor(t)}\n\nO link é pessoal e expira automaticamente.`,
    )}`;

  const status = (t: TokenRow) => {
    if (t.revoked_at) return { label: "Revogado", variant: "outline" as const };
    if (new Date(t.expires_at).getTime() < Date.now()) return { label: "Expirado", variant: "outline" as const };
    return { label: "Ativo", variant: "secondary" as const };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compartilhar editor de cursos</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Gere um link pessoal para {professional.nome ?? professional.email} cadastrar e editar os próprios cursos, sem precisar de login.
        </p>

        <div className="flex items-end gap-2">
          <div className="w-32">
            <Label>Validade (dias)</Label>
            <Input type="number" min={1} value={days} onChange={(e) => setDays(Number(e.target.value) || 90)} />
          </div>
          <Button onClick={generate}>
            <Link2 className="w-4 h-4 mr-2" /> Gerar link
          </Button>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando…
            </div>
          ) : tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum link gerado ainda.</p>
          ) : (
            tokens.map((t) => {
              const st = status(t);
              const active = st.label === "Ativo";
              return (
                <div key={t.id} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={st.variant}>{st.label}</Badge>
                    <span className="text-xs text-muted-foreground">
                      expira {new Date(t.expires_at).toLocaleDateString("pt-BR")} · {t.uses} acesso(s)
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Input readOnly value={urlFor(t.token)} className="text-xs" />
                    <Button size="icon" variant="outline" title="Copiar" onClick={() => { void navigator.clipboard.writeText(urlFor(t.token)); toast({ title: "Link copiado" }); }}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  {active && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <a href={waHref(t.token)} target="_blank" rel="noreferrer"><MessageCircle className="w-3.5 h-3.5 mr-1.5" /> WhatsApp</a>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a href={mailHref(t.token)}><Mail className="w-3.5 h-3.5 mr-1.5" /> E-mail</a>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => revoke(t.id)}>
                        <ShieldOff className="w-3.5 h-3.5 mr-1.5" /> Revogar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}