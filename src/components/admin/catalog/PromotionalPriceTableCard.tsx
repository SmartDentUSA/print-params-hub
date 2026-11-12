import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Link2, Sparkles } from "lucide-react";
import { DealerPriceTable } from "@/components/smartops/distributors/DealerPriceTable";
import type { PromotionalTable } from "./promotionalTypes";

type DistributorOption = { id: string; razao_social: string; nome_fantasia: string | null };
type Patch = Partial<Pick<PromotionalTable, "include_official_price_table" | "price_table_mode" | "price_table_distributor_id">>;

type Props = {
  table: PromotionalTable;
  distributors: DistributorOption[];
  onChange: (patch: Patch) => void;
};

/**
 * Tabela de preços anexada à promoção (independe dos combos): associa uma
 * tabela de distribuição existente ou cria uma tabela exclusiva da campanha
 * a partir da Loja Oficial, editável por categoria ou por item.
 */
export function PromotionalPriceTableCard({ table, distributors, onChange }: Props) {
  const mode = table.price_table_mode === "exclusive" ? "exclusive" : "distribution";
  const included = table.include_official_price_table !== false;
  const official = distributors.find((d) => /loja oficial/i.test(d.nome_fantasia || d.razao_social || ""));
  const others = distributors.filter((d) => d.id !== official?.id);

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

        <div className="grid gap-3 md:grid-cols-2">
          <Button
            type="button"
            variant={mode === "distribution" ? "default" : "outline"}
            className="h-auto justify-start gap-3 p-4 text-left"
            onClick={() => onChange({ price_table_mode: "distribution" })}
          >
            <Link2 className="h-5 w-5 shrink-0" />
            <span className="space-y-1">
              <span className="block font-semibold">Associar a tabela de distribuição</span>
              <span className="block text-xs font-normal opacity-80 whitespace-normal">Usa uma tabela já existente em Distribuição, sem alterar nada nela.</span>
            </span>
          </Button>
          <Button
            type="button"
            variant={mode === "exclusive" ? "default" : "outline"}
            className="h-auto justify-start gap-3 p-4 text-left"
            onClick={() => onChange({ price_table_mode: "exclusive" })}
          >
            <Sparkles className="h-5 w-5 shrink-0" />
            <span className="space-y-1">
              <span className="block font-semibold">Tabela exclusiva para a promoção</span>
              <span className="block text-xs font-normal opacity-80 whitespace-normal">Copia a tabela da Loja Oficial como base e permite descontos por categoria ou por item.</span>
            </span>
          </Button>
        </div>

        {mode === "distribution" ? (
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
        ) : (
          <div className="space-y-3 rounded-md border p-3">
            <p className="text-xs text-muted-foreground">
              O preço de tabela é o preço de venda da Loja Oficial; o desconto aplicado aqui vale só para esta promoção. Use “% Desc. categoria” para aplicar em um grupo inteiro ou edite item a item e clique em Salvar. A tabela da Loja Oficial e o catálogo não são alterados.
            </p>
            <DealerPriceTable
              distributors={[]}
              promotion={{ id: table.id, name: table.name || "Promoção", currency: table.currency || "BRL" }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
