import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CalendarDays, Users, Tags, Plus, Trash2, MousePointerClick } from "lucide-react";
import { useActiveTeamMembers } from "@/hooks/useActiveTeamMembers";
import { useCatalogCategoryTree, catKey } from "@/hooks/useCatalogCategoryTree";
import { PRODUCT_CATALOG_ENTITY_TYPES } from "@/lib/catalogEntityTypes";

interface EventOption {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
}

interface CatalogProductOption {
  id: string;
  name: string;
}

interface EventProductButton {
  label: string;
  product_catalog_id: string;
  product_name: string;
}

/**
 * Painel de configuração exclusivo do tipo "Feiras e Eventos":
 * evento associado, consultores que aparecem na lista do formulário e
 * categorias do catálogo habilitadas para o evento.
 */
export function FeiraEventoConfig({ formId }: { formId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [consultants, setConsultants] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [products, setProducts] = useState<CatalogProductOption[]>([]);
  const [productButtons, setProductButtons] = useState<EventProductButton[]>([]);
  const [memberSearch, setMemberSearch] = useState("");

  const { data: members = [] } = useActiveTeamMembers();
  const { data: tree = [], isLoading: treeLoading } = useCatalogCategoryTree();

  useEffect(() => {
    (async () => {
      const [{ data: form }, { data: evs }, { data: catalogProducts }] = await Promise.all([
        (supabase as any)
          .from("smartops_forms")
          .select("event_id, event_consultant_ids, event_categories, event_product_buttons")
          .eq("id", formId)
          .maybeSingle(),
        (supabase as any)
          .from("smartops_events")
          .select("id, name, start_date, end_date")
          .order("start_date", { ascending: false })
          .limit(200),
        (supabase as any)
          .from("system_a_catalog")
          .select("id, name")
          .in("category", [...PRODUCT_CATALOG_ENTITY_TYPES])
          .eq("active", true)
          .eq("approved", true)
          .order("name")
          .limit(2000),
      ]);
      setEvents((evs ?? []) as EventOption[]);
      setProducts((catalogProducts ?? []) as CatalogProductOption[]);
      setEventId((form?.event_id as string) ?? "");
      setConsultants((form?.event_consultant_ids ?? []) as string[]);
      setCategories(
        Array.isArray(form?.event_categories) ? (form!.event_categories as string[]) : [],
      );
      setProductButtons(
        Array.isArray(form?.event_product_buttons)
          ? (form.event_product_buttons as EventProductButton[]).slice(0, 3)
          : [],
      );
      setLoading(false);
    })();
  }, [formId]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.nome_completo.toLowerCase().includes(q));
  }, [members, memberSearch]);

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const updateProductButton = (index: number, updates: Partial<EventProductButton>) => {
    setProductButtons((current) =>
      current.map((button, buttonIndex) =>
        buttonIndex === index ? { ...button, ...updates } : button,
      ),
    );
  };

  const selectProduct = (index: number, productId: string) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    updateProductButton(index, {
      product_catalog_id: product.id,
      product_name: product.name,
      label: productButtons[index]?.label || product.name,
    });
  };

  const save = async () => {
    const invalidButton = productButtons.find(
      (button) => !button.label.trim() || !button.product_catalog_id || !button.product_name.trim(),
    );
    if (invalidButton) {
      toast.error("Preencha o texto e selecione o produto de cada botão.");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any)
      .from("smartops_forms")
      .update({
        event_id: eventId || null,
        event_consultant_ids: consultants,
        event_categories: categories,
        event_product_buttons: productButtons.map((button) => ({
          ...button,
          label: button.label.trim(),
        })),
      })
      .eq("id", formId);
    setSaving(false);
    if (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
      return;
    }
    toast.success("Configuração do evento salva!");
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando configuração do evento...
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="w-4 h-4" /> Feira / Evento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Evento */}
        <div className="space-y-2">
          <Label className="text-xs">Evento associado</Label>
          <Select value={eventId || undefined} onValueChange={setEventId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione o evento..." />
            </SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                  {e.start_date
                    ? ` · ${new Date(e.start_date).toLocaleDateString("pt-BR")}`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Consultores */}
        <div className="space-y-2">
          <Label className="text-xs flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Consultores no estande
            <Badge variant="secondary" className="ml-1">{consultants.length}</Badge>
          </Label>
          <p className="text-xs text-muted-foreground">
            Quem for escolhido no formulário passa a ser o responsável do lead no CRM.
          </p>
          <Input
            placeholder="Buscar membro da equipe..."
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            className="h-8 text-xs"
          />
          <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
            {filteredMembers.map((m) => (
              <label
                key={m.id}
                className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-accent"
              >
                <Checkbox
                  checked={consultants.includes(m.id)}
                  onCheckedChange={() => setConsultants((s) => toggle(s, m.id))}
                />
                <span className="truncate">{m.nome_completo}</span>
                {m.role && (
                  <span className="ml-auto text-[10px] text-muted-foreground">{m.role}</span>
                )}
              </label>
            ))}
            {filteredMembers.length === 0 && (
              <p className="px-2 py-3 text-xs text-muted-foreground">Nenhum membro encontrado.</p>
            )}
          </div>
        </div>

        {/* Botões rápidos de produto */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs flex items-center gap-1.5">
              <MousePointerClick className="w-3.5 h-3.5" /> Botões de produto de interesse
              <Badge variant="secondary" className="ml-1">{productButtons.length}/3</Badge>
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={productButtons.length >= 3}
              onClick={() =>
                setProductButtons((current) => [
                  ...current,
                  { label: "", product_catalog_id: "", product_name: "" },
                ])
              }
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar botão
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Aparecem abaixo dos combos e antes das perguntas. O visitante escolhe somente um,
            que será o produto de interesse no CRM.
          </p>
          {productButtons.map((button, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] gap-2 items-end rounded-md border p-3">
              <div className="space-y-1">
                <Label className="text-[11px]">Texto do botão</Label>
                <Input
                  value={button.label}
                  placeholder="Ex.: SmartMake"
                  maxLength={40}
                  onChange={(event) => updateProductButton(index, { label: event.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Produto de interesse associado</Label>
                <Select value={button.product_catalog_id || undefined} onValueChange={(value) => selectProduct(index, value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remover botão ${index + 1}`}
                onClick={() => setProductButtons((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
          {productButtons.length === 0 && (
            <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              Nenhum botão configurado. Você pode adicionar até três.
            </p>
          )}
        </div>

        {/* Categorias */}
        <div className="space-y-2">
          <Label className="text-xs flex items-center gap-1.5">
            <Tags className="w-3.5 h-3.5" /> Categorias habilitadas no evento
            <Badge variant="secondary" className="ml-1">{categories.length}</Badge>
          </Label>
          <p className="text-xs text-muted-foreground">
            Seguem a estrutura do catálogo de produtos. Aparecem no formulário como interesse
            de múltipla escolha.
          </p>
          <p className="text-xs text-muted-foreground">
            Se o evento tiver uma <strong>tabela promocional</strong> associada (em Produtos →
            Tabelas promocionais), o formulário mostra os <strong>combos da tabela</strong> no
            lugar destas categorias.
          </p>
          {treeLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando catálogo...
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-md border p-2 space-y-3">
              {tree.map((node) => {
                const catk = catKey(node.category);
                return (
                  <div key={node.category} className="space-y-1">
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <Checkbox
                        checked={categories.includes(catk)}
                        onCheckedChange={() => setCategories((s) => toggle(s, catk))}
                      />
                      {node.category}
                    </label>
                    {node.subcategories.length > 0 && (
                      <div className="pl-6 space-y-1">
                        {node.subcategories.map((sub) => {
                          const key = catKey(node.category, sub.label);
                          return (
                            <label
                              key={key}
                              className="flex items-center gap-2 text-xs cursor-pointer"
                            >
                              <Checkbox
                                checked={categories.includes(key)}
                                onCheckedChange={() => setCategories((s) => toggle(s, key))}
                              />
                              <span className="truncate">{sub.label}</span>
                              <span className="ml-auto text-[10px] text-muted-foreground">
                                {sub.count}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Button onClick={save} disabled={saving} className="w-full">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Salvar configuração do evento
        </Button>
      </CardContent>
    </Card>
  );
}
