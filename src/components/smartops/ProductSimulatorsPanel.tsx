import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, MessageCircle, Search } from "lucide-react";
import { PRODUCT_CATALOG_ENTITY_TYPES } from "@/lib/catalogEntityTypes";
import type { CatalogRow } from "@/lib/catalogProductOptions";
import { groupProductSimulators, productSimulatorUrl } from "@/lib/productSimulators";
import { CLICK_ORIGINS, CLICK_ORIGIN_LABEL, type ClickOrigin } from "@/lib/clickOrigin";
import { shortenUrl } from "@/utils/shortLink";

const PUBLIC_SITE = "https://www.smartdent.com.br";

let catalogCache: Promise<CatalogRow[]> | null = null;
/** Produtos comerciais ativos do catálogo (mesma lista dos seletores de produto). */
export function loadCommercialCatalog(): Promise<CatalogRow[]> {
  if (!catalogCache) {
    catalogCache = (supabase as any)
      .from("system_a_catalog")
      .select("id, name, category, active, product_category")
      .eq("active", true)
      .in("category", PRODUCT_CATALOG_ENTITY_TYPES as unknown as string[])
      .order("name")
      .then(({ data, error }: any) => {
        if (error) { catalogCache = null; throw error; }
        return (data ?? []) as CatalogRow[];
      });
  }
  return catalogCache!;
}

interface Props {
  /** Formulários de campanha comercial que podem ser escolhidos (o primeiro vem selecionado). */
  forms: { id: string; name: string }[];
  /** Origem fixa do clique (canal da campanha); sem ela, a pessoa escolhe. */
  origin?: ClickOrigin | null;
  /** Inserir o link curto em vez de copiar. */
  onInsert?: (url: string) => void;
  listClassName?: string;
}

/** Lista de todos os produtos do catálogo, cada um com o próprio simulador de WhatsApp do formulário. */
export function ProductSimulatorsPanel({ forms, origin: fixedOrigin, onInsert, listClassName }: Props) {
  const [rows, setRows] = useState<CatalogRow[] | null>(null);
  const [formId, setFormId] = useState(forms[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [origin, setOrigin] = useState<ClickOrigin | "">(fixedOrigin ?? "");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    loadCommercialCatalog().then(setRows, () => { setRows([]); toast.error("Não foi possível carregar o catálogo"); });
  }, []);
  useEffect(() => { if (!forms.some((f) => f.id === formId)) setFormId(forms[0]?.id ?? ""); }, [forms, formId]);

  const groups = useMemo(() => groupProductSimulators(rows ?? [], search), [rows, search]);
  const total = useMemo(() => groupProductSimulators(rows ?? []).reduce((n, g) => n + g.items.length, 0), [rows]);
  const effectiveOrigin = (fixedOrigin ?? origin) || null;

  const pick = async (productId: string) => {
    if (!formId) return;
    setBusy(productId);
    try {
      const full = productSimulatorUrl({ formId, productId, base: PUBLIC_SITE, origin: effectiveOrigin });
      const short = await shortenUrl(full);
      if (onInsert) { onInsert(short); return; }
      await navigator.clipboard.writeText(short);
      toast.success(short === full ? "Link completo copiado" : "Link curto do simulador copiado");
    } catch {
      toast.error("Não foi possível gerar o link");
    } finally {
      setBusy(null);
    }
  };

  if (!forms.length) return <p className="text-xs text-muted-foreground">Nenhuma campanha comercial ativa.</p>;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {forms.length > 1 && (
          <select
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"
            value={formId}
            onChange={(e) => setFormId(e.target.value)}
            aria-label="Formulário da campanha"
          >
            {forms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        )}
        {fixedOrigin === undefined && (
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={origin}
            onChange={(e) => setOrigin(e.target.value as ClickOrigin | "")}
            aria-label="Origem do clique"
          >
            <option value="">Sem origem marcada</option>
            {CLICK_ORIGINS.map((o) => <option key={o} value={o}>{CLICK_ORIGIN_LABEL[o]}</option>)}
          </select>
        )}
      </div>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-8 pl-7 text-xs" placeholder={`Buscar entre ${total} produtos`} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className={listClassName ?? "max-h-[50vh] overflow-y-auto rounded-md border"}>
        {!rows ? (
          <div className="flex items-center justify-center gap-2 p-4 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando catálogo…</div>
        ) : groups.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">Nenhum produto encontrado.</p>
        ) : groups.map((g) => (
          <div key={g.category}>
            <div className="sticky top-0 z-10 bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {g.category} · {g.items.length}
            </div>
            {g.items.map((p) => (
              <div key={p.id} className="flex items-center gap-2 border-t border-border px-2 py-1.5 text-xs">
                <MessageCircle className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate" title={p.name}>{p.name}</span>
                <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[10px]" disabled={busy === p.id} onClick={() => pick(p.id)}>
                  {busy === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : onInsert ? null : <Copy className="h-3 w-3" />}
                  {onInsert ? "Inserir" : "Copiar link"}
                </Button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
