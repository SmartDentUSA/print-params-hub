import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, Ticket } from "lucide-react";
import { toast } from "sonner";
import { PromotionalCouponsCard } from "@/components/admin/catalog/PromotionalCouponsCard";
import type { PromotionalCoupon, PromotionalTable } from "@/components/admin/catalog/promotionalTypes";
import type { KolCoupon } from "./ProfessionalKolCommercial";

interface Props {
  leadId: string;
  nome: string;
  kolCoupons: KolCoupon[];
  onKolCouponsChange: (v: KolCoupon[]) => void;
  /** Perfil em modo leitura: nenhuma escrita (tabela, cupons, Loja Integrada). */
  disabled?: boolean;
}

/**
 * Gerador de cupons do profissional — mesmas regras do gerador de vendedores.
 * Usa uma tabela promocional oculta vinculada ao profissional, criada apenas
 * quando alguém em modo de edição pede explicitamente (nunca ao só visualizar).
 */
export default function ProfessionalCouponsGenerator({ leadId, nome, kolCoupons, onKolCouponsChange, disabled }: Props) {
  const [table, setTable] = useState<PromotionalTable | null>(null);
  const [draft, setDraft] = useState<Partial<PromotionalTable>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("promotional_tables" as any)
        .select("*")
        .eq("professional_lead_id", leadId)
        .maybeSingle();
      const row = data as unknown as PromotionalTable | null;
      if (!cancelled) {
        setTable(row);
        setDraft(row ?? {});
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [leadId]);

  const createTable = useCallback(async () => {
    setCreating(true);
    const { data: auth } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("promotional_tables" as any)
      .insert({
        name: `Cupons — ${nome}`,
        pdf_title: "CUPOM DO PROFISSIONAL",
        status: "active",
        professional_lead_id: leadId,
        include_official_price_table: false,
        created_by: auth.user?.id,
      })
      .select("*")
      .single();
    setCreating(false);
    if (error) {
      toast.error("Não foi possível ativar os cupons. Apenas administradores podem criar cupons de profissional.");
      return;
    }
    const row = data as unknown as PromotionalTable;
    setTable(row);
    setDraft(row);
  }, [leadId, nome]);

  const onDraftChange = (patch: Partial<PromotionalTable>) => {
    if (disabled) return;
    setDraft((d) => ({ ...d, ...patch }));
    if (!table) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      supabase.from("promotional_tables" as any).update(patch).eq("id", table.id).then(({ error }) => {
        if (error) toast.error("Alteração não salva: apenas administradores podem editar cupons de profissional.");
      });
    }, 600);
  };

  // Cupons gerados entram na lista de cupons KOL do formulário; gravação segue o "Salvar" do perfil.
  const onCouponsGenerated = (coupons: PromotionalCoupon[]) => {
    const next = [...kolCoupons];
    for (const c of coupons) {
      const code = c.code.toUpperCase();
      const idx = next.findIndex((k) => k.code.toUpperCase() === code);
      const entry = { code, active_from: c.valid_from, active_to: c.valid_until, commission_percent: idx >= 0 ? next[idx].commission_percent ?? null : null };
      if (idx >= 0) next[idx] = entry; else next.push(entry);
    }
    onKolCouponsChange(next);
    toast.info("Cupons adicionados à lista do profissional. Clique em Salvar para gravar no perfil.");
  };

  if (loading) {
    return (
      <Card><CardContent className="py-6 flex items-center text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando cupons do profissional…
      </CardContent></Card>
    );
  }

  if (!table) {
    return (
      <Card><CardContent className="py-6 flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span className="flex items-center">
          {disabled ? <Lock className="w-4 h-4 mr-2" /> : <Ticket className="w-4 h-4 mr-2" />}
          {disabled ? "Cupons do profissional ainda não ativados. Clique em Editar para ativar." : "Cupons do profissional ainda não ativados."}
        </span>
        {!disabled && (
          <Button size="sm" onClick={createTable} disabled={creating}>
            {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Ativar cupons
          </Button>
        )}
      </CardContent></Card>
    );
  }

  return (
    <div className={disabled ? "relative" : undefined}>
      {disabled && (
        <p className="mb-2 flex items-center text-xs text-muted-foreground">
          <Lock className="w-3 h-3 mr-1" /> Modo leitura — clique em Editar para gerar ou enviar cupons.
        </p>
      )}
      <fieldset disabled={disabled} className={disabled ? "pointer-events-none opacity-60" : undefined}>
        <PromotionalCouponsCard
          table={table}
          draft={draft}
          onDraftChange={onDraftChange}
          professional={{ id: leadId, nome }}
          onCouponsGenerated={onCouponsGenerated}
        />
      </fieldset>
    </div>
  );
}
