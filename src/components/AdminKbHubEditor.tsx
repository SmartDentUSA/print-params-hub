import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useData } from '@/contexts/DataContext';
import { CATALOG_SIDEBAR_FILTERS } from '@/components/knowledge/catalogSidebarFilters';
import { PRODUCT_CATALOG_ENTITY_TYPES } from '@/lib/catalogEntityTypes';
import { Save, Image as ImageIcon, Pin, X, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

type HeroKey =
  | 'overview' | 'parametros' | 'catalogo' | 'videos'
  | 'artigos' | 'ebooks' | 'eventos' | 'distribuidores';

interface HeroOverride { title?: string; subtitle?: string; image_url?: string }

const HERO_TABS: { key: HeroKey; label: string; defaults: { title: string; subtitle: string } }[] = [
  { key: 'overview',       label: 'Overview',       defaults: { title: 'Base de Conhecimento', subtitle: 'Tudo o que você precisa para operar a odontologia digital.' } },
  { key: 'parametros',     label: 'Parâmetros',     defaults: { title: 'Parâmetros',    subtitle: 'Parâmetros de impressão testados por impressora e resina.' } },
  { key: 'catalogo',       label: 'Catálogo',       defaults: { title: 'Catálogo',      subtitle: 'Resinas, impressoras, scanners e consumíveis Smart Dent.' } },
  { key: 'videos',         label: 'Vídeos',         defaults: { title: 'Vídeos',        subtitle: 'Vídeos tutoriais, casos clínicos e depoimentos.' } },
  { key: 'artigos',        label: 'Artigos',        defaults: { title: 'Artigos',       subtitle: 'Artigos técnicos, casos clínicos e guias práticos.' } },
  { key: 'ebooks',         label: 'Ebooks',         defaults: { title: 'Ebooks',        subtitle: 'Materiais aprofundados para download.' } },
  { key: 'eventos',        label: 'Eventos',        defaults: { title: 'Eventos',       subtitle: 'Cursos, feiras e treinamentos.' } },
  { key: 'distribuidores', label: 'Revendas',       defaults: { title: 'Revendas',      subtitle: 'Rede oficial de revendas Smart Dent.' } },
];

export const KB_HERO_SETTING_KEY = (k: HeroKey) => `kb_hero_${k}`;
export const KB_CATALOG_PINS_KEY = (k: string) => `kb_catalog_pins_${k}`;
export const KB_NAV_SHOW_OVERVIEW_KEY = 'kb_nav_show_overview';

interface CatalogRow { id: string; name: string; product_category: string | null; product_subcategory: string | null }

export function AdminKbHubEditor() {
  const { toast } = useToast();
  const { fetchSetting, updateSetting } = useData();
  const [heroValues, setHeroValues] = useState<Record<HeroKey, HeroOverride>>(
    () => Object.fromEntries(HERO_TABS.map(t => [t.key, {}])) as Record<HeroKey, HeroOverride>
  );
  const [savingHero, setSavingHero] = useState<HeroKey | null>(null);
  const [catalogRows, setCatalogRows] = useState<CatalogRow[]>([]);
  const [pins, setPins] = useState<Record<string, string[]>>({});
  const [savingPins, setSavingPins] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>(CATALOG_SIDEBAR_FILTERS[0].key);
  const [productSearch, setProductSearch] = useState('');
  const [uploading, setUploading] = useState<HeroKey | null>(null);
  const [showOverview, setShowOverview] = useState<boolean>(false);
  const [savingOverview, setSavingOverview] = useState(false);

  useEffect(() => {
    (async () => {
      // Load hero overrides
      const entries = await Promise.all(HERO_TABS.map(async (t) => {
        const raw = await fetchSetting(KB_HERO_SETTING_KEY(t.key));
        let v: HeroOverride = {};
        if (raw) { try { v = JSON.parse(raw); } catch { v = {}; } }
        return [t.key, v] as const;
      }));
      setHeroValues(Object.fromEntries(entries) as any);

      // Load pins
      const pinEntries = await Promise.all(CATALOG_SIDEBAR_FILTERS.map(async (f) => {
        const raw = await fetchSetting(KB_CATALOG_PINS_KEY(f.key));
        let ids: string[] = [];
        if (raw) { try { const p = JSON.parse(raw); if (Array.isArray(p)) ids = p.filter((x) => typeof x === 'string'); } catch { /* noop */ } }
        return [f.key, ids] as const;
      }));
      setPins(Object.fromEntries(pinEntries));

      // Load nav visibility settings
      const rawShowOverview = await fetchSetting(KB_NAV_SHOW_OVERVIEW_KEY);
      setShowOverview(rawShowOverview === 'true');

      // Load catalog products (allowlist only)
      const { data } = await (supabase.from('system_a_catalog') as any)
        .select('id, name, product_category, product_subcategory')
        .in('category', PRODUCT_CATALOG_ENTITY_TYPES)
        .eq('active', true)
        .eq('approved', true)
        .order('name')
        .limit(2000);
      setCatalogRows((data ?? []) as CatalogRow[]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setHeroField = (k: HeroKey, field: keyof HeroOverride, v: string) => {
    setHeroValues((prev) => ({ ...prev, [k]: { ...prev[k], [field]: v } }));
  };

  const saveHero = async (k: HeroKey) => {
    setSavingHero(k);
    try {
      const cleaned: HeroOverride = {};
      const cur = heroValues[k] || {};
      if (cur.title?.trim()) cleaned.title = cur.title.trim();
      if (cur.subtitle?.trim()) cleaned.subtitle = cur.subtitle.trim();
      if (cur.image_url?.trim()) cleaned.image_url = cur.image_url.trim();
      const ok = await updateSetting(KB_HERO_SETTING_KEY(k), JSON.stringify(cleaned));
      if (!ok) throw new Error('save failed');
      toast({ title: 'Hero salvo', description: `${k} atualizado.` });
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message || 'Falha ao salvar', variant: 'destructive' });
    } finally {
      setSavingHero(null);
    }
  };

  const uploadHeroImage = async (k: HeroKey, file: File) => {
    setUploading(k);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `kb-hero/${k}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('model-images').upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('model-images').getPublicUrl(path);
      setHeroField(k, 'image_url', data.publicUrl);
      toast({ title: 'Imagem enviada', description: 'Clique em Salvar para aplicar.' });
    } catch (e: any) {
      toast({ title: 'Erro no upload', description: e?.message || 'Falha', variant: 'destructive' });
    } finally {
      setUploading(null);
    }
  };

  const currentPins = pins[activeFilter] || [];
  const pinnedRows = useMemo(
    () => currentPins.map((id) => catalogRows.find((r) => r.id === id)).filter(Boolean) as CatalogRow[],
    [currentPins, catalogRows]
  );
  const availableRows = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    return catalogRows.filter((r) => !currentPins.includes(r.id) && (!term || r.name?.toLowerCase().includes(term)));
  }, [catalogRows, currentPins, productSearch]);

  const togglePin = (id: string) => {
    setPins((prev) => {
      const cur = prev[activeFilter] || [];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return { ...prev, [activeFilter]: next };
    });
  };

  const savePins = async () => {
    setSavingPins(activeFilter);
    try {
      const ok = await updateSetting(KB_CATALOG_PINS_KEY(activeFilter), JSON.stringify(currentPins));
      if (!ok) throw new Error('save failed');
      toast({ title: 'Vínculos salvos', description: `${currentPins.length} produto(s) na categoria "${CATALOG_SIDEBAR_FILTERS.find(f=>f.key===activeFilter)?.label}".` });
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message || 'Falha ao salvar', variant: 'destructive' });
    } finally {
      setSavingPins(null);
    }
  };

  const saveOverviewVisibility = async (next: boolean) => {
    setShowOverview(next);
    setSavingOverview(true);
    try {
      const ok = await updateSetting(KB_NAV_SHOW_OVERVIEW_KEY, next ? 'true' : 'false');
      if (!ok) throw new Error('save failed');
      toast({ title: 'Navegação atualizada', description: next ? '"Visão geral" visível na sidebar.' : '"Visão geral" oculta da sidebar.' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message || 'Falha ao salvar', variant: 'destructive' });
      setShowOverview(!next);
    } finally {
      setSavingOverview(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Navegação da Sidebar</CardTitle>
          <p className="text-sm text-muted-foreground">
            Controle quais itens aparecem no menu lateral da Base de Conhecimento.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Mostrar item "Visão geral"</Label>
              <p className="text-xs text-muted-foreground">Quando desligado, o botão "Visão geral" fica oculto da navegação.</p>
            </div>
            <Switch checked={showOverview} onCheckedChange={saveOverviewVisibility} disabled={savingOverview} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ImageIcon className="w-5 h-5" /> Hero da Base de Conhecimento</CardTitle>
          <p className="text-sm text-muted-foreground">
            Troque título, subtítulo e imagem exibidos no topo de cada aba. Deixe em branco para usar o padrão do sistema.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {HERO_TABS.map((t) => {
            const v = heroValues[t.key] || {};
            return (
              <div key={t.key} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{t.label}</Badge>
                    <span className="text-xs text-muted-foreground">chave: {KB_HERO_SETTING_KEY(t.key)}</span>
                  </div>
                  <Button size="sm" onClick={() => saveHero(t.key)} disabled={savingHero === t.key}>
                    {savingHero === t.key ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                    Salvar
                  </Button>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Título (padrão: {t.defaults.title})</Label>
                    <Input value={v.title ?? ''} placeholder={t.defaults.title} onChange={(e) => setHeroField(t.key, 'title', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Subtítulo (padrão: {t.defaults.subtitle})</Label>
                    <Input value={v.subtitle ?? ''} placeholder={t.defaults.subtitle} onChange={(e) => setHeroField(t.key, 'subtitle', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">URL da imagem</Label>
                  <div className="flex gap-2">
                    <Input value={v.image_url ?? ''} placeholder="https://... (deixe vazio para usar imagem padrão)" onChange={(e) => setHeroField(t.key, 'image_url', e.target.value)} />
                    <label className="inline-flex items-center gap-1 px-3 py-2 text-xs rounded-md border cursor-pointer hover:bg-accent">
                      {uploading === t.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                      Upload
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadHeroImage(t.key, f); e.target.value = ''; }} />
                    </label>
                  </div>
                  {v.image_url && (
                    <div className="mt-2">
                      <img src={v.image_url} alt="preview" className="h-24 rounded border object-cover" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Pin className="w-5 h-5" /> Produtos vinculados às Categorias do Catálogo</CardTitle>
          <p className="text-sm text-muted-foreground">
            Fixe produtos em uma categoria da sidebar da Base de Conhecimento. Isto é <strong>apenas um filtro visual</strong> — não altera a categoria real do produto no sistema.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {CATALOG_SIDEBAR_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setActiveFilter(f.key)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${activeFilter === f.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'}`}
              >
                {f.label} <span className="ml-1 opacity-70">({(pins[f.key] || []).length})</span>
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Fixados em "{CATALOG_SIDEBAR_FILTERS.find(f => f.key === activeFilter)?.label}"</h4>
                <Button size="sm" onClick={savePins} disabled={savingPins === activeFilter}>
                  {savingPins === activeFilter ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                  Salvar
                </Button>
              </div>
              {pinnedRows.length === 0 && <p className="text-xs text-muted-foreground">Nenhum produto fixado.</p>}
              <ul className="space-y-1 max-h-96 overflow-y-auto">
                {pinnedRows.map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm border rounded px-2 py-1">
                    <span className="truncate">{r.name}</span>
                    <button type="button" onClick={() => togglePin(r.id)} className="text-muted-foreground hover:text-destructive" aria-label="Remover">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border p-3 space-y-2">
              <h4 className="font-medium text-sm">Produtos disponíveis</h4>
              <Input placeholder="Buscar produto..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
              <ul className="space-y-1 max-h-96 overflow-y-auto">
                {availableRows.slice(0, 200).map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => togglePin(r.id)}
                      className="w-full text-left text-sm border rounded px-2 py-1 hover:bg-accent flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{r.name}</span>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[40%]">{r.product_category}</span>
                    </button>
                  </li>
                ))}
                {availableRows.length > 200 && (
                  <li className="text-xs text-muted-foreground px-2">…refine a busca ({availableRows.length} restantes)</li>
                )}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminKbHubEditor;