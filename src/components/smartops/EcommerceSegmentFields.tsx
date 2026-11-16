import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, ShoppingCart, X } from "lucide-react";
import type { EcommerceFormState } from "@/lib/campaignEcommerceFilters";

interface Props {
  value: EcommerceFormState;
  onChange: (next: EcommerceFormState) => void;
}

interface Options {
  produtos: string[];
  status: string[];
  pagamento: string[];
  cupons: string[];
}

const uniqSorted = (xs: Array<string | null | undefined>) =>
  [...new Set(xs.map((x) => (x ?? "").toString().trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));

/** Seção "E-commerce" da etapa 2 (Segmentar Leads) — dados da Loja Integrada no cadastro do lead. */
export function EcommerceSegmentFields({ value, onChange }: Props) {
  const [opts, setOpts] = useState<Options>({ produtos: [], status: [], pagamento: [], cupons: [] });
  const [open, setOpen] = useState(false);
  const set = <K extends keyof EcommerceFormState>(k: K, v: EcommerceFormState[K]) => onChange({ ...value, [k]: v });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("lia_attendances")
        .select("lojaintegrada_produtos_comprados, lojaintegrada_ultimo_pedido_status, lojaintegrada_forma_pagamento, lojaintegrada_cupom_desconto")
        .is("merged_into", null)
        .or("lojaintegrada_produtos_comprados.not.is.null,lojaintegrada_ultimo_pedido_data.not.is.null")
        .limit(5000);
      const rows = (data || []) as any[];
      setOpts({
        produtos: uniqSorted(rows.flatMap((r) => (Array.isArray(r.lojaintegrada_produtos_comprados) ? r.lojaintegrada_produtos_comprados : []))),
        status: uniqSorted(rows.map((r) => r.lojaintegrada_ultimo_pedido_status)),
        pagamento: uniqSorted(rows.map((r) => r.lojaintegrada_forma_pagamento)),
        cupons: uniqSorted(rows.map((r) => r.lojaintegrada_cupom_desconto)),
      });
    })();
  }, []);

  const toggleProduto = (p: string) => {
    const has = value.produtos.includes(p);
    set("produtos", has ? value.produtos.filter((x) => x !== p) : [...value.produtos, p]);
  };

  return (
    <div className="space-y-2 pt-2 border-t">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <ShoppingCart className="w-3.5 h-3.5" /> E-commerce (Loja Integrada)
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="text-sm font-medium">Compras na loja</label>
          <Select value={value.cliente} onValueChange={(v) => set("cliente", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="yes">Já comprou na loja</SelectItem>
              <SelectItem value="no">Nunca comprou na loja</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="sm:col-span-2">
          <label className="text-sm font-medium">Comprou algum destes produtos</label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
                <span className="truncate">
                  {value.produtos.length
                    ? `${value.produtos.length} produto${value.produtos.length > 1 ? "s" : ""} selecionado${value.produtos.length > 1 ? "s" : ""}`
                    : "Todos os produtos"}
                </span>
                <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar produto comprado..." />
                <CommandList>
                  <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                  <CommandGroup>
                    {opts.produtos.map((p) => (
                      <CommandItem key={p} value={p} onSelect={() => toggleProduto(p)}>
                        <Check className={`w-4 h-4 mr-2 ${value.produtos.includes(p) ? "opacity-100" : "opacity-0"}`} />
                        {p}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {value.produtos.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {value.produtos.map((p) => (
                <Badge key={p} variant="secondary" className="gap-1">
                  {p}
                  <button type="button" aria-label={`Remover ${p}`} onClick={() => toggleProduto(p)}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium">Última compra na loja</label>
          <Select value={value.ultimaCompra} onValueChange={(v) => set("ultimaCompra", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualquer data</SelectItem>
              <SelectItem value="le_30">Nos últimos 30 dias</SelectItem>
              <SelectItem value="le_90">Nos últimos 90 dias</SelectItem>
              <SelectItem value="le_180">Nos últimos 180 dias</SelectItem>
              <SelectItem value="le_365">Nos últimos 12 meses</SelectItem>
              <SelectItem value="gt_90">Sem comprar há mais de 90 dias</SelectItem>
              <SelectItem value="gt_180">Sem comprar há mais de 180 dias</SelectItem>
              <SelectItem value="gt_365">Sem comprar há mais de 12 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Primeira compra (novos clientes)</label>
          <Select value={value.primeiraCompra} onValueChange={(v) => set("primeiraCompra", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualquer data</SelectItem>
              <SelectItem value="le_30">Nos últimos 30 dias</SelectItem>
              <SelectItem value="le_90">Nos últimos 90 dias</SelectItem>
              <SelectItem value="le_180">Nos últimos 180 dias</SelectItem>
              <SelectItem value="le_365">Nos últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Pedidos pagos (mínimo)</label>
          <Input type="number" min={0} step={1} value={value.pedidosMin}
            onChange={(e) => set("pedidosMin", e.target.value)} placeholder="Ex.: 2" />
        </div>
        <div>
          <label className="text-sm font-medium">Total gasto na loja — mínimo (R$)</label>
          <Input type="number" min={0} step={100} value={value.gastoMin}
            onChange={(e) => set("gastoMin", e.target.value)} placeholder="Ex.: 1000" />
        </div>
        <div>
          <label className="text-sm font-medium">Total gasto na loja — máximo (R$)</label>
          <Input type="number" min={0} step={100} value={value.gastoMax}
            onChange={(e) => set("gastoMax", e.target.value)} placeholder="Ex.: 5000" />
        </div>
        <div>
          <label className="text-sm font-medium">Status do último pedido</label>
          <Select value={value.status} onValueChange={(v) => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {opts.status.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Forma de pagamento</label>
          <Select value={value.pagamento} onValueChange={(v) => set("pagamento", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {opts.pagamento.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Cupom usado</label>
          <Select value={value.cupom} onValueChange={(v) => set("cupom", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="any">Usou algum cupom</SelectItem>
              <SelectItem value="none">Não usou cupom</SelectItem>
              {opts.cupons.map((c) => <SelectItem key={c} value={c}>Cupom {c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Pessoa na loja</label>
          <Select value={value.tipoPessoa} onValueChange={(v) => set("tipoPessoa", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="PF">Pessoa física</SelectItem>
              <SelectItem value="PJ">Pessoa jurídica</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
