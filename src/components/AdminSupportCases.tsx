import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, ArrowLeft, Trash2, Check, X, ChevronDown, Loader2 } from 'lucide-react';
import { useSupportCases, FAILURE_TYPES, type SupportCase } from '@/hooks/useSupportCases';

// ── Workflow stage definitions ───────────────────────────────────────────────
const WORKFLOW_STAGES = [
  {
    label: '1. Captura Digital',
    fields: [
      { key: 'workflow_scanners', label: 'Scanners', category: 'SCANNERS 3D' },
      { key: 'workflow_notebook', label: 'Notebook', type: 'text' as const },
    ],
  },
  {
    label: '2. Planejamento CAD',
    fields: [
      { key: 'workflow_cad_softwares', label: 'Softwares CAD', category: 'SOFTWARES' },
    ],
  },
  {
    label: '3. Impressão 3D',
    fields: [
      { key: 'workflow_resins', label: 'Resinas', category: 'RESINAS 3D' },
      { key: 'workflow_print_software', label: 'Software de Impressão', category: 'SOFTWARES' },
      { key: 'workflow_printers', label: 'Impressoras', category: 'IMPRESSÃO 3D', subcategory: 'IMPRESSORAS ODONTOLÓGICAS' },
      { key: 'workflow_print_accessories', label: 'Acessórios', category: 'IMPRESSÃO 3D', subcategory: 'ACESSÓRIOS' },
      { key: 'workflow_print_parts', label: 'Peças', category: 'IMPRESSÃO 3D', subcategory: 'PEÇAS DE REPOSIÇÃO' },
    ],
  },
  {
    label: '4. Pós-Impressão',
    fields: [
      { key: 'workflow_cure_equipment', label: 'Equipamentos de Cura', category: 'PÓS-IMPRESSÃO', subcategory: 'EQUIPAMENTOS DE CURA' },
      { key: 'workflow_finishing', label: 'Acabamento', category: 'PÓS-IMPRESSÃO', subcategory: 'ACABAMENTO E FINALIZAÇÃO' },
    ],
  },
  {
    label: '5. Finalização',
    fields: [
      { key: 'workflow_characterization', label: 'Caracterização', category: 'CARACTERIZAÇÃO' },
      { key: 'workflow_installation', label: 'Instalação', category: 'DENTÍSTICA, ESTÉTICA E ORTODONTIA', subcategory: 'ADESIVOS' },
      { key: 'workflow_dentistry_ortho', label: 'Dentística/Orto', category: 'DENTÍSTICA, ESTÉTICA E ORTODONTIA', subcategory: 'RESINAS COMPOSTAS' },
      { key: 'workflow_lab_supplies', label: 'Insumos Lab', category: 'INSUMOS LABORATÓRIO' },
    ],
  },
];

type CatalogProduct = { id: string; product_name: string; product_category: string; product_subcategory: string | null };

const emptyForm = (): Partial<SupportCase> => ({
  title: '',
  problem_description: '',
  failure_type: 'other',
  confidence: 0.8,
  causes: [],
  solutions: [],
  image_urls: [],
  tags: [],
  brand_id: null,
  model_id: null,
  resin_id: null,
  workflow_scanners: [],
  workflow_notebook: null,
  workflow_cad_softwares: [],
  workflow_resins: [],
  workflow_print_software: [],
  workflow_printers: [],
  workflow_print_accessories: [],
  workflow_print_parts: [],
  workflow_cure_equipment: [],
  workflow_finishing: [],
  workflow_final_equipment: [],
  workflow_characterization: [],
  workflow_installation: [],
  workflow_dentistry_ortho: [],
  workflow_lab_supplies: [],
});

// ── Status badge helper ──────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: 'Pendente', variant: 'secondary' },
    approved: { label: 'Aprovado', variant: 'default' },
    rejected: { label: 'Rejeitado', variant: 'destructive' },
  };
  const info = map[status] || { label: status, variant: 'outline' as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

// ── Multi-select for catalog products ────────────────────────────────────────
function ProductMultiSelect({
  label,
  category,
  subcategory,
  selected,
  onChange,
  fetchProducts,
}: {
  label: string;
  category: string;
  subcategory?: string;
  selected: string[];
  onChange: (ids: string[]) => void;
  fetchProducts: (cat: string, sub?: string) => Promise<CatalogProduct[]>;
}) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (loaded) return;
    const data = await fetchProducts(category, subcategory);
    setProducts(data);
    setLoaded(true);
  }, [category, subcategory, fetchProducts, loaded]);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between text-sm font-normal" onClick={load}>
          {label} {selected.length > 0 && <Badge variant="secondary" className="ml-2">{selected.length}</Badge>}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4 pt-1 space-y-1 max-h-48 overflow-y-auto">
        {!loaded ? (
          <p className="text-xs text-muted-foreground">Clique para carregar...</p>
        ) : products.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum produto encontrado</p>
        ) : (
          products.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
              <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} className="rounded" />
              {p.product_name}
            </label>
          ))
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export function AdminSupportCases() {
  const {
    cases, loading, statusFilter, setStatusFilter,
    createCase, updateCase, updateStatus, deleteCase,
    fetchBrands, fetchModels, fetchResins, fetchProductsByCategory,
  } = useSupportCases();

  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<SupportCase>>(emptyForm());
  const [saving, setSaving] = useState(false);

  // Reference data
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [models, setModels] = useState<{ id: string; name: string; brand_id: string }[]>([]);
  const [resins, setResins] = useState<{ id: string; name: string; manufacturer: string }[]>([]);

  // Causes/solutions as text for editing
  const [causesText, setCausesText] = useState('');
  const [solutionsText, setSolutionsText] = useState('');
  const [tagsText, setTagsText] = useState('');

  useEffect(() => {
    fetchBrands().then(setBrands);
    fetchResins().then(setResins);
  }, []);

  useEffect(() => {
    if (form.brand_id) {
      fetchModels(form.brand_id).then(setModels);
    } else {
      setModels([]);
    }
  }, [form.brand_id]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setCausesText('');
    setSolutionsText('');
    setTagsText('');
    setView('form');
  };

  const openEdit = (c: SupportCase) => {
    setEditingId(c.id);
    setForm(c);
    setCausesText((c.causes || []).join('\n'));
    setSolutionsText((c.solutions || []).join('\n'));
    setTagsText((c.tags || []).join(', '));
    setView('form');
  };

  const handleSave = async () => {
    if (!form.title || !form.problem_description) return;
    setSaving(true);
    const payload = {
      ...form,
      causes: causesText.split('\n').map((s) => s.trim()).filter(Boolean),
      solutions: solutionsText.split('\n').map((s) => s.trim()).filter(Boolean),
      tags: tagsText.split(',').map((s) => s.trim()).filter(Boolean),
    };
    const ok = editingId
      ? await updateCase(editingId, payload)
      : await createCase(payload);
    setSaving(false);
    if (ok) setView('list');
  };

  const setField = <K extends keyof SupportCase>(key: K, value: SupportCase[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label>Filtro:</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="approved">Aprovados</SelectItem>
                <SelectItem value="rejected">Rejeitados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo Caso</Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
          </div>
        ) : cases.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Nenhum caso de suporte encontrado.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3">Título</th>
                  <th className="text-left p-3">Tipo de Falha</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Data</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-medium">{c.title}</td>
                    <td className="p-3">
                      <Badge variant="outline">
                        {FAILURE_TYPES.find((f) => f.value === c.failure_type)?.label || c.failure_type}
                      </Badge>
                    </td>
                    <td className="p-3"><StatusBadge status={c.status} /></td>
                    <td className="p-3 text-muted-foreground">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="p-3 text-right space-x-1">
                      {c.status === 'pending' && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => updateStatus(c.id, 'approved')}>
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => updateStatus(c.id, 'rejected')}>
                            <X className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>Editar</Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm('Excluir caso?')) deleteCase(c.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── FORM VIEW ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => setView('list')}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar à lista
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? 'Editar Caso' : 'Novo Caso de Suporte'}</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" defaultValue={['dados', 'param', 'workflow']}>
            {/* Section 1: Case Data */}
            <AccordionItem value="dados">
              <AccordionTrigger>📋 Dados do Caso</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div>
                  <Label>Título *</Label>
                  <Input value={form.title || ''} onChange={(e) => setField('title', e.target.value)} placeholder="Ex: Warping em prótese parcial" />
                </div>
                <div>
                  <Label>Descrição do Problema *</Label>
                  <Textarea value={form.problem_description || ''} onChange={(e) => setField('problem_description', e.target.value)} rows={4} placeholder="Descreva o problema em detalhes..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo de Falha</Label>
                    <Select value={form.failure_type || 'other'} onValueChange={(v) => setField('failure_type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FAILURE_TYPES.map((ft) => (
                          <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Confiança: {Math.round((form.confidence || 0.8) * 100)}%</Label>
                    <Slider
                      value={[form.confidence || 0.8]}
                      onValueChange={([v]) => setField('confidence', v)}
                      min={0} max={1} step={0.05} className="mt-2"
                    />
                  </div>
                </div>
                <div>
                  <Label>Causas (uma por linha)</Label>
                  <Textarea value={causesText} onChange={(e) => setCausesText(e.target.value)} rows={3} placeholder="Temperatura da resina baixa&#10;Plataforma suja" />
                </div>
                <div>
                  <Label>Soluções (uma por linha)</Label>
                  <Textarea value={solutionsText} onChange={(e) => setSolutionsText(e.target.value)} rows={3} placeholder="Aquecer resina a 30°C&#10;Limpar plataforma com IPA" />
                </div>
                <div>
                  <Label>Tags (separadas por vírgula)</Label>
                  <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="warping, resina, DLP" />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 2: Parametrization */}
            <AccordionItem value="param">
              <AccordionTrigger>⚙️ Parametrização</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Marca</Label>
                    <Select value={form.brand_id || ''} onValueChange={(v) => { setField('brand_id', v || null); setField('model_id', null); }}>
                      <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      <SelectContent>
                        {brands.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Modelo</Label>
                    <Select value={form.model_id || ''} onValueChange={(v) => setField('model_id', v || null)} disabled={!form.brand_id}>
                      <SelectTrigger><SelectValue placeholder={form.brand_id ? 'Selecionar...' : 'Selecione marca'} /></SelectTrigger>
                      <SelectContent>
                        {models.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Resina</Label>
                    <Select value={form.resin_id || ''} onValueChange={(v) => setField('resin_id', v || null)}>
                      <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      <SelectContent>
                        {resins.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.name} ({r.manufacturer})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 3: Workflow */}
            <AccordionItem value="workflow">
              <AccordionTrigger>🔄 Workflow (5 Etapas)</AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                {WORKFLOW_STAGES.map((stage) => (
                  <div key={stage.label} className="border rounded-md p-3">
                    <h4 className="text-sm font-semibold mb-2">{stage.label}</h4>
                    <div className="space-y-1">
                      {stage.fields.map((field) => {
                        if (field.type === 'text') {
                          return (
                            <div key={field.key} className="pl-2">
                              <Label className="text-xs">{field.label}</Label>
                              <Input
                                value={(form as any)[field.key] || ''}
                                onChange={(e) => setField(field.key as any, e.target.value)}
                                placeholder="Ex: MacBook Pro M2"
                                className="h-8 text-sm"
                              />
                            </div>
                          );
                        }
                        return (
                          <ProductMultiSelect
                            key={field.key}
                            label={field.label}
                            category={field.category!}
                            subcategory={(field as any).subcategory}
                            selected={((form as any)[field.key] || []) as string[]}
                            onChange={(ids) => setField(field.key as any, ids as any)}
                            fetchProducts={fetchProductsByCategory}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setView('list')}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.title || !form.problem_description}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingId ? 'Salvar Alterações' : 'Criar Caso'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
