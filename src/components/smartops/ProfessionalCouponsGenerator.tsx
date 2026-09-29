import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PromotionalCouponsCard } from "@/components/admin/catalog/PromotionalCouponsCard";
import type { PromotionalCoupon, PromotionalTable } from "@/components/admin/catalog/promotionalTypes";
import type { KolCoupon } from "./ProfessionalKolCommercial";

interface Props {
  leadId: string;
  nome: string;
  kolCoupons: KolCoupon[];
  onKolCouponsChange: (v: KolCoupon[]) => void;
}

/**
 * Gerador de cupons do profissional — mesmas regras do gerador de vendedores
 * (tabelas promocionais / eventos). Usa uma tabela promocional oculta, vinculada
 * ao profissional, para reaproveitar o envio à Loja Integrada.
 */
export default function ProfessionalCouponsGenerator({ leadId, nome, kolCoupons, onKolCouponsChange }: Props) {
  const [table, setTable] = useState<PromotionalTable | null>(null);
  const [draft, setDraft] = useState<Partial<PromotionalTable>>({});
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: existing } = await supabase
        .from("promotional_tables" as any)
        .select("*")
        .eq("professional_lead_id", leadId)
        .maybeSingle();
      let row = existing as unknown as PromotionalTable | null;
      if (!row) {
        const { data, error } = await supabase
          .from("promotional_tables" as any)
          .insert({
            name: `Cupons — ${nome}`,
            pdf_title: "CUPOM DO PROFISSIONAL",
            status: "active",
            professional_lead_id: leadId,
            include_official_price_table: false,
          })
          .select("*")
          .single();
        if (error) toast.error(error.message);
        row = data as unknown as PromotionalTable | null;
      }
      if (!cancelled && row) { setTable(row); setDraft(row); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [leadId]);

  const onDraftChange = (patch: Partial<PromotionalTable>) => {
    setDraft((d) => ({ ...d, ...patch }));
    if (!table) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      supabase.from("promotional_tables" as any).update(patch).eq("id", table.id).then(({ error }) => {
        if (error) toast.error(error.message);
      });
    }, 600);
  };

  // Cupons gerados entram na lista de cupons de indicação (KOL) com as mesmas datas.
  const onCouponsGenerated = async (coupons: PromotionalCoupon[]) => {
    const next = [...kolCoupons];
    for (const c of coupons) {
      const code = c.code.toUpperCase();
      const entry = { code, active_from: c.valid_from, active_to: c.valid_until };
      const idx = next.findIndex((k) => k.code.toUpperCase() === code);
      if (idx >= 0) next[idx] = entry; else next.push(entry);
    }
    onKolCouponsChange(next);
    const { error } = await supabase.from("lia_attendances").update({ prof_kol_coupons: next as any }).eq("id", leadId);
    if (error) toast.error(`Cupons gerados, mas não vinculados ao profissional: ${error.message}`);
  };

  if (loading || !table) {
    return (
      <Card><CardContent className="py-6 flex items-center text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando cupons do profissional…
      </CardContent></Card>
    );
  }

  return (
    <PromotionalCouponsCard
      table={table}
      draft={draft}
      onDraftChange={onDraftChange}
      professional={{ id: leadId, nome }}
      onCouponsGenerated={onCouponsGenerated}
    />
  );
}
