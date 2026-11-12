import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Copy, Link2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { DealerPriceTable } from "@/components/smartops/distributors/DealerPriceTable";
import { clonePromotionPriceTable } from "@/components/smartops/distributors/officialPriceList";
import { clonedPromoRows } from "@/lib/promoPriceTable";
import type { PromotionalTable } from "./promotionalTypes";

type DistributorOption = { id: string; razao_social: string; nome_fantasia: string | null };
type Patch = Partial<Pick<PromotionalTable,
  "include_official_price_table" | "price_table_mode" | "price_table_distributor_id" | "price_table_source_promotion_id">>;

type Props = {
  table: PromotionalTable;
  distributors: DistributorOption[];
  /** Outras tabelas promocionais que podem servir de origem para clonar. */
  promotions: PromotionalTable[];
  onChange: (patch: Patch) => void | Promise<void>;
};

const sourceLabel = (promo: PromotionalTable) => {
  const kind = promo.price_table_mode === "exclusive" ? "exclusiva"
    : promo.price_table_mode === "clone" ? "clonada" : "distribuição";
  return `${promo.name} — tabela ${kind}`;
};

/**
 * Tabela de preços anexada à promoção (independe dos combos), em 3 modos:
 * associar uma tabela de distribuição, criar uma exclusiva a partir da Loja
 * Oficial, ou clonar a tabela de outra promoção e editar os descontos.
 */
export function PromotionalPriceTableCard({ table, distributors, promotions, onChange }: Props) {
  const mode = table.price_table_mode === "exclusive" || table.price_table_mode === "clone" ? table.price_table_mode : "distribution";
  const included = table.include_official_price_table !== false;
  const official = distributors.find((d) => /loja oficial/i.test(d.nome_fantasia || d.razao_social || ""));
  const others = distributors.filter((d) => d.id !== official?.id);
  const [sourceId, setSourceId] = useState<string>(table.price_table_source_promotion_id || "");
  const [cloning, setCloning] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const clonedFrom = promotions.find((p) => p.id === table.price_table_source_promotion_id);

  const runClone = async () => {
    const source = promotions.find((p) => p.id === sourceId);
    if (!source) { toast.error("Escolha a promoção de origem."); return; }
    if (table.price_table_source_promotion_id && !confirm(`Substituir a tabela atual pelos itens de “${source.name}”? A versão atual fica salva no histórico.`)) return;
    setCloning(true);
    try {
      const count = await clonePromotionPriceTable(
        { id: table.id, name: table.name || "Promoção", currency: table.currency || "BRL" },
        source,
        clonedPromoRows,
      );
      await onChange({ price_table_mode: "clone", price_table_source_promotion_id: source.id });
      setEditorKey((k) => k + 1);
      toast.success(`${count} itens clonados de “${source.name}”. Agora é só ajustar os descontos.`);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível clonar a tabela.");
    } finally {
      setCloning(false);
    }
  };

  const options = [
    { value: "distribution" as const, icon: Link2, title: "Associar a tabela de distribuição", text: "Usa uma tabela já existente em Distribuição, sem alterar nada nela." },
    { value: "exclusive" as const, icon: Sparkles, title: "Tabela exclusiva para a promoção", text: "Copia a tabela da Loja Oficial como base e permite descontos por categoria ou por item." },
    { value: "clone" as const, icon: Copy, title: "Clonar de outra promoção", text: "Copia a tabela de outra tabela promocional, com os descontos dela, para editar aqui." },
  ];

  const editor = (
    <DealerPriceTable
      key={editorKey}
      distributors={[]}
      promotion={{ id: table.id, name: table.name || "Promoção", currency: table.currency || "BRL" }}
    />
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Tabela de preços da promoção</CardTitle>
        <p className="text-sm text-muted-foreground">
          Funciona com ou sem combos. A tabela escolhida entra no final do PDF, no Portal Profissional e na “Tabela vigente” da Agenda.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border p-3">
          <Switch checked={included} onCheckedChange={(checked) => onChange({ include_official_price_table: checked })} />
          <div className="space-y-1">
            <Label className="cursor-pointer">Incluir tabela de preços no PDF</Label>
            <p className="text-xs text-muted-foreground">Desligado, o PDF mostra apenas os combos.</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {options.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={mode === option.value ? "default" : "outline"}
              className="h-auto justify-start gap-3 p-4 text-left"
              onClick={() => onChange({ price_table_mode: option.value })}
            >
              <option.icon className="h-5 w-5 shrink-0" />
              <span className="space-y-1">
                <span className="block font-semibold whitespace-normal">{option.title}</span>
                <span className="block text-xs font-normal opacity-80 whitespace-normal">{option.text}</span>
              </span>
            </Button>
          ))}
        </div>

        {mode === "distribution" && (
          <div className="space-y-2 rounded-md border p-3">
            <Label>Tabela de distribuição associada</Label>
            <Select
              value={table.price_table_distributor_id || "official"}
              onValueChange={(value) => onChange({ price_table_distributor_id: value === "official" ? null : value })}
            >
              <SelectTrigger className="max-w-md"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="official">{official ? (official.nome_fantasia || official.razao_social) : "Smart Dent (Loja Oficial)"} — padrão</SelectItem>
                {others.map((d) => <SelectItem key={d.id} value={d.id}>{d.nome_fantasia || d.razao_social}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Os preços são os da tabela do distribuidor em SmartOps → Distribuição. Alterações lá aparecem no próximo PDF publicado.</p>
          </div>
        )}

        {mode === "exclusive" && (
          <div className="space-y-3 rounded-md border p-3">
            <p className="text-xs text-muted-foreground">
              O preço de tabela é o preço de venda da Loja Oficial; o desconto aplicado aqui vale só para esta promoção. Use “% Desc. categoria” para aplicar em um grupo inteiro ou edite item a item e clique em Salvar. A tabela da Loja Oficial e o catálogo não são alterados.
            </p>
            {editor}
          </div>
        )}

        {mode === "clone" && (
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[280px] flex-1 space-y-2">
                <Label>Promoção de origem</Label>
                <Select value={sourceId} onValueChange={setSourceId}>
                  <SelectTrigger><SelectValue placeholder="Escolha a tabela promocional a clonar" /></SelectTrigger>
                  <SelectContent>
                    {promotions.map((promo) => <SelectItem key={promo.id} value={promo.id}>{sourceLabel(promo)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={runClone} disabled={!sourceId || cloning}>
                {cloning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
                {table.price_table_source_promotion_id ? "Clonar de novo" : "Clonar tabela"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Copia os itens, preços e descontos da promoção escolhida. Depois disso a tabela é só desta promoção: editar aqui não muda a origem. Clonar de novo substitui os itens e guarda a versão anterior no histórico.
            </p>
            {table.price_table_source_promotion_id
              ? <>
                  <p className="text-sm">Clonada de: <strong>{clonedFrom?.name || "promoção de origem"}</strong></p>
                  {editor}
                </>
              : <p className="text-sm text-muted-foreground">Escolha a promoção de origem e clique em “Clonar tabela” para começar a editar.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
