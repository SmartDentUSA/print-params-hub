import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Workflow as WorkflowIcon, Loader2 } from 'lucide-react';
import {
  ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState,
  type Connection, type Edge, type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LinkPicker, type LinkPickerSelection } from './LinkPicker';
import { SocialPostLinkPicker, type SocialPostPickResult } from './SocialPostLinkPicker';

const NODE_TYPES = [
  { type: 'send_dm', label: 'Enviar DM', color: 'hsl(var(--primary))' },
  { type: 'send_text', label: 'Enviar texto', color: 'hsl(var(--primary))' },
  { type: 'send_image', label: 'Enviar imagem', color: 'hsl(var(--primary))' },
  { type: 'send_buttons', label: 'Enviar botões', color: 'hsl(var(--primary))' },
  { type: 'send_quick_replies', label: 'Quick replies', color: 'hsl(var(--primary))' },
  { type: 'comment_reply', label: 'Resposta pública (comentário)', color: 'hsl(var(--primary))' },
  { type: 'send_comment_reply', label: 'Responder comentário', color: 'hsl(var(--primary))' },
  { type: 'wait', label: 'Aguardar', color: 'hsl(var(--muted-foreground))' },
  { type: 'condition', label: 'Condição (if/else)', color: 'hsl(43 96% 56%)' },
  { type: 'collect_input', label: 'Coletar resposta', color: 'hsl(217 91% 60%)' },
  { type: 'set_tag', label: 'Aplicar tag', color: 'hsl(142 70% 45%)' },
  { type: 'add_tag', label: 'Adicionar tag', color: 'hsl(142 70% 45%)' },
  { type: 'set_field', label: 'Definir campo', color: 'hsl(142 70% 45%)' },
  { type: 'trigger', label: 'Trigger', color: 'hsl(280 70% 55%)' },
  { type: 'create_lead', label: 'Criar lead no CRM', color: 'hsl(142 70% 45%)' },
  { type: 'end', label: 'Fim', color: 'hsl(var(--destructive))' },
];

const TRIGGER_TYPES = [
  { value: 'comment_keyword', label: 'Palavra-chave em comentário' },
  { value: 'dm_keyword', label: 'Palavra-chave em DM' },
  { value: 'story_reply', label: 'Resposta em story' },
  { value: 'mention', label: 'Menção' },
];

export function SocialFlowEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [channel, setChannel] = useState('instagram');
  const [isActive, setIsActive] = useState(false);
  const [produtoSlug, setProdutoSlug] = useState<string | undefined>();
  const [formName, setFormName] = useState<string | undefined>();
  const [zernioAutomationId, setZernioAutomationId] = useState<string | null>(null);
  const [hasZernioConfig, setHasZernioConfig] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [triggers, setTriggers] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase.from('social_flows').select('*').eq('id', id).single();
      if (error) { toast.error(error.message); setLoading(false); return; }
      setName(data.name); setDescription(data.description ?? ''); setChannel(data.channel ?? 'instagram');
      setIsActive(!!data.is_active);
      setProdutoSlug((data as any).produto_slug ?? undefined);
      setFormName((data as any).form_name ?? undefined);
      setZernioAutomationId((data as any).zernio_automation_id ?? null);
      setHasZernioConfig(!!(data as any).zernio_automation_config);
      const rawNodes = Array.isArray(data.nodes) ? (data.nodes as any[]) : [];
      const normalized = rawNodes.map((n, i) => ({
        ...n,
        id: String(n?.id ?? `n_${i}`),
        type: n?.type && ['default', 'input', 'output', 'group'].includes(n.type) ? n.type : 'default',
        position:
          n?.position && typeof n.position.x === 'number' && typeof n.position.y === 'number'
            ? n.position
            : { x: 80 + (i % 4) * 240, y: 80 + Math.floor(i / 4) * 140 },
        data: n?.data ?? {
          label: n?.label ?? n?.type ?? `Nó ${i + 1}`,
          nodeType: n?.type,
          config: n,
        },
      })) as Node[];
      setNodes(normalized);
      const rawEdges = Array.isArray(data.edges) ? (data.edges as any[]) : [];
      setEdges(rawEdges.filter((e) => e?.source && e?.target) as Edge[]);
      const { data: trg } = await supabase.from('social_triggers').select('*').eq('flow_id', id);
      setTriggers(trg ?? []);
      setLoading(false);
    })();
  }, [id, setNodes, setEdges]);

  const onConnect = useCallback((c: Connection) => setEdges((eds) => addEdge(c, eds)), [setEdges]);

  const addNode = (type: string) => {
    const nt = NODE_TYPES.find((n) => n.type === type)!;
    const node: Node = {
      id: crypto.randomUUID(),
      type: 'default',
      position: { x: 200 + Math.random() * 300, y: 100 + Math.random() * 200 },
      data: { label: nt.label, nodeType: type, config: {} },
      style: { border: `2px solid ${nt.color}`, borderRadius: 8, padding: 8, minWidth: 140, background: 'hsl(var(--card))' },
    };
    setNodes((nds) => [...nds, node]);
  };

  const updateNodeConfig = (nodeId: string, patch: any) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, config: { ...(n.data as any).config, ...patch } } } : n));
    setSelectedNode((s) => s?.id === nodeId ? { ...s, data: { ...s.data, config: { ...(s.data as any).config, ...patch } } } : s);
  };

  const deleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  };

  const save = async () => {
    if (!name.trim()) { toast.error('Dê um nome ao flow'); return; }
    setSaving(true);
    try {
      // Serialize React Flow nodes back to the flat DB shape: { id, type, label, position, ...config }
      const flatNodes = nodes.map((n) => {
        const d: any = n.data ?? {};
        const cfg: any = d.config ?? {};
        const { label: _lbl, nodeType: _nt, config: _cfg, ...restData } = d;
        return {
          ...cfg,
          id: n.id,
          type: d.nodeType ?? cfg.type ?? n.type,
          label: d.label ?? cfg.label ?? n.id,
          position: n.position,
          ...restData,
        };
      });
      const payload = { name, description, channel, is_active: isActive, nodes: flatNodes as any, edges: edges as any, updated_at: new Date().toISOString() };
      let flowId = id;
      if (isNew) {
        const { data, error } = await supabase.from('social_flows').insert(payload).select('id').single();
        if (error) throw error;
        flowId = data.id;
      } else {
        const { error } = await supabase.from('social_flows').update(payload).eq('id', id!);
        if (error) throw error;
      }
      // Sync triggers
      if (flowId) {
        await supabase.from('social_triggers').delete().eq('flow_id', flowId);
        if (triggers.length > 0) {
          await supabase.from('social_triggers').insert(triggers.map((t) => ({ ...t, flow_id: flowId, id: undefined })));
        }
      }
      toast.success('Flow salvo');
      if (isNew && flowId) navigate(`/social/flows/${flowId}`);
    } catch (e: any) {
      toast.error(`Erro: ${e.message ?? e}`);
    } finally { setSaving(false); }
  };

  const addTrigger = () => setTriggers((t) => [...t, { trigger_type: 'comment_keyword', keywords: [], is_regex: false, priority: 0 }]);
  const updateTrigger = (i: number, patch: any) => setTriggers((t) => t.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const removeTrigger = (i: number) => setTriggers((t) => t.filter((_, idx) => idx !== i));

  if (loading) return <div className="p-6">Carregando…</div>;

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col">
      <header className="border-b border-border p-3 flex items-center justify-between gap-2 bg-card">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link to="/social/flows"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do flow" className="max-w-xs font-medium" />
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-sm"><Switch checked={isActive} onCheckedChange={setIsActive} /> Ativo</div>
        </div>
        <Button onClick={save} disabled={saving}><Save className="w-4 h-4 mr-1" /> {saving ? 'Salvando…' : 'Salvar'}</Button>
      </header>

      <Tabs defaultValue="canvas" className="flex-1 flex flex-col min-h-0">
        <TabsList className="self-start ml-3 mt-2">
          <TabsTrigger value="canvas"><WorkflowIcon className="w-4 h-4 mr-1" /> Canvas</TabsTrigger>
          <TabsTrigger value="triggers">Triggers ({triggers.length})</TabsTrigger>
          <TabsTrigger value="meta">Metadados</TabsTrigger>
        </TabsList>

        <TabsContent value="canvas" className="flex-1 min-h-0 m-0 flex">
          <aside className="w-48 border-r border-border p-3 space-y-1 overflow-y-auto bg-muted/20">
            <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Adicionar nó</div>
            {NODE_TYPES.map((nt) => (
              <Button key={nt.type} variant="outline" size="sm" className="w-full justify-start text-xs" onClick={() => addNode(nt.type)}>
                <Plus className="w-3 h-3 mr-1" /> {nt.label}
              </Button>
            ))}
          </aside>

          <div className="flex-1 relative">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, n) => setSelectedNode(n)}
              fitView
            >
              <Background />
              <Controls />
              <MiniMap pannable zoomable />
            </ReactFlow>
          </div>

          {selectedNode && (
            <aside className="w-72 border-l border-border p-3 overflow-y-auto bg-card">
              {hasZernioConfig && (
                <div className="mb-3 p-2 rounded-md border border-green-500/30 bg-green-500/10 text-xs space-y-1">
                  <div className="font-medium text-green-700 dark:text-green-400">
                    ⚡ Automação Zernio ativa
                  </div>
                  {zernioAutomationId && (
                    <div className="text-muted-foreground truncate">ID: <span className="font-mono">{zernioAutomationId}</span></div>
                  )}
                  <ZernioStatsButton automationId={zernioAutomationId} />
                </div>
              )}
              <div className="flex items-start justify-between mb-1 gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate" title={(selectedNode.data as any).label}>
                    {(selectedNode.data as any).label ?? 'Nó'}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground truncate">{selectedNode.id}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => deleteNode(selectedNode.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
              <div className="mb-3"><Badge variant="outline">{(selectedNode.data as any).nodeType}</Badge></div>
              <NodeInspector
                node={selectedNode}
                onUpdate={(p) => updateNodeConfig(selectedNode.id, p)}
                produtoSlug={produtoSlug}
                formName={formName}
              />
            </aside>
          )}
        </TabsContent>

        <TabsContent value="triggers" className="p-6 space-y-3 overflow-y-auto">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Triggers</h3>
            <Button size="sm" onClick={addTrigger}><Plus className="w-4 h-4 mr-1" /> Adicionar trigger</Button>
          </div>
          {triggers.length === 0 ? (
            <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Adicione um trigger para iniciar o flow.</CardContent></Card>
          ) : triggers.map((t, i) => (
            <Card key={i}>
              <CardContent className="p-3 grid md:grid-cols-3 gap-2 items-end">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={t.trigger_type} onValueChange={(v) => updateTrigger(i, { trigger_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRIGGER_TYPES.map((x) => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Keywords (separadas por vírgula)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={(t.keywords ?? []).join(', ')}
                      onChange={(e) => updateTrigger(i, { keywords: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })}
                      placeholder="orçamento, info, quero"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeTrigger(i)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="meta" className="p-6 max-w-xl space-y-3">
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NodeInspector({ node, onUpdate, produtoSlug, formName }: { node: Node; onUpdate: (p: any) => void; produtoSlug?: string; formName?: string }) {
  const cfg: any = (node.data as any).config ?? {};
  const type = (node.data as any).nodeType;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [socialPickerOpen, setSocialPickerOpen] = useState(false);
  const [imageLibOpen, setImageLibOpen] = useState(false);

  const handleLink = (l: LinkPickerSelection) => {
    const prefix = cfg.message ? cfg.message.trimEnd() + '\n\n' : '';
    const appended = `${prefix}📎 ${l.titulo}\nURL: ${l.url}`;
    onUpdate({
      message: appended,
      link_url: l.url,
      link_titulo: l.titulo,
      link_tipo: l.tipo,
      link_thumbnail: l.thumbnail_url ?? null,
    });
  };

  const handleSocialPick = (p: SocialPostPickResult) => {
    onUpdate({
      post_url: p.url,
      post_titulo: p.titulo,
      post_thumbnail: p.thumbnail_url ?? null,
      post_caption: p.caption ?? null,
      post_platform: p.platform,
      post_source: p.source,
      message: cfg.message ?? `Olha esse conteúdo 👇\n${p.url}`,
    });
  };

  switch (type) {
    case 'trigger':
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Keywords (separadas por vírgula)</Label>
            <Input
              value={Array.isArray(cfg.keywords) ? cfg.keywords.join(', ') : (cfg.keywords ?? '')}
              onChange={(e) => onUpdate({ keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              placeholder="brasil, copa, gol"
            />
            {Array.isArray(cfg.keywords) && cfg.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {cfg.keywords.map((k: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">{k}</Badge>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea rows={3} value={cfg.description ?? ''} onChange={(e) => onUpdate({ description: e.target.value })} />
          </div>
        </div>
      );
    case 'comment_reply':
      return (
        <div>
          <Label className="text-xs">Texto público (resposta no comentário)</Label>
          <Textarea rows={4} value={cfg.text ?? ''} onChange={(e) => onUpdate({ text: e.target.value })} />
        </div>
      );
    case 'send_image':
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">URL da imagem</Label>
            <Input value={cfg.image_url ?? ''} onChange={(e) => onUpdate({ image_url: e.target.value })} placeholder="https://…" />
            <Button variant="outline" size="sm" className="w-full mt-1" onClick={() => setImageLibOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Abrir biblioteca
            </Button>
          </div>
          {cfg.image_url && (
            <img src={cfg.image_url} alt="" className="w-full max-h-32 object-contain rounded border border-border bg-muted/30" />
          )}
          <div>
            <Label className="text-xs">Legenda</Label>
            <Textarea rows={3} value={cfg.caption ?? ''} onChange={(e) => onUpdate({ caption: e.target.value })} />
          </div>
          <ImageLibraryDialog
            open={imageLibOpen}
            onOpenChange={setImageLibOpen}
            produtoSlug={produtoSlug}
            onPick={(url) => { onUpdate({ image_url: url }); setImageLibOpen(false); }}
          />
        </div>
      );
    case 'send_text':
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Texto</Label>
            <Textarea rows={6} value={cfg.text ?? ''} onChange={(e) => onUpdate({ text: e.target.value })} placeholder="Olá {{nome}}…" />
            <div className="flex flex-wrap gap-1 mt-1">
              {['{{nome}}', '{{username}}'].map((v) => (
                <button
                  key={v}
                  type="button"
                  className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted hover:bg-accent"
                  onClick={() => onUpdate({ text: (cfg.text ?? '') + ' ' + v })}
                >{v}</button>
              ))}
            </div>
          </div>
          <ButtonsEditor
            buttons={Array.isArray(cfg.buttons) ? cfg.buttons : []}
            onChange={(b) => onUpdate({ buttons: b })}
            max={3}
            simple
          />
        </div>
      );
    case 'send_quick_replies':
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Texto</Label>
            <Textarea rows={4} value={cfg.text ?? ''} onChange={(e) => onUpdate({ text: e.target.value })} />
          </div>
          <QuickRepliesEditor
            items={Array.isArray(cfg.quick_replies) ? cfg.quick_replies : []}
            onChange={(q) => onUpdate({ quick_replies: q })}
          />
        </div>
      );
    case 'add_tag':
      return (
        <div>
          <Label className="text-xs">Tag</Label>
          <Input value={cfg.tag ?? ''} onChange={(e) => onUpdate({ tag: e.target.value })} />
        </div>
      );
    case 'set_field':
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Nome do campo</Label>
            <Input value={cfg.field_name ?? ''} onChange={(e) => onUpdate({ field_name: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Valor do campo</Label>
            <Input value={cfg.field_value ?? ''} onChange={(e) => onUpdate({ field_value: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Campo no CRM</Label>
            <Input value={cfg.crm_field ?? ''} onChange={(e) => onUpdate({ crm_field: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={!!cfg.sync_to_crm} onCheckedChange={(v) => onUpdate({ sync_to_crm: !!v })} />
            Sincronizar com CRM
          </label>
        </div>
      );
    case 'send_buttons':
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Texto</Label>
            <Textarea rows={4} value={cfg.text ?? ''} onChange={(e) => onUpdate({ text: e.target.value })} />
          </div>
          <ButtonsEditor
            buttons={Array.isArray(cfg.buttons) ? cfg.buttons : []}
            onChange={(b) => onUpdate({ buttons: b })}
            max={3}
          />
        </div>
      );
    case 'send_dm':
    case 'send_comment_reply':
      return (
        <div className="space-y-3">
          <div><Label className="text-xs">Mensagem</Label>
            <Textarea value={cfg.message ?? ''} onChange={(e) => onUpdate({ message: e.target.value })} rows={5} placeholder="Olá {{name}}, …" /></div>
          <Button variant="outline" size="sm" className="w-full" onClick={() => setPickerOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar um link
          </Button>
          {cfg.link_url && (
            <div className="text-xs text-muted-foreground p-2 rounded border border-border bg-muted/30">
              <div className="font-medium text-foreground truncate">📎 {cfg.link_titulo}</div>
              <div className="truncate">{cfg.link_url}</div>
            </div>
          )}
          <LinkPicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onSelect={handleLink}
            filterProduto={produtoSlug}
            highlightFormName={formName}
          />
        </div>
      );
    case 'wait':
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Segundos</Label>
            <Input type="number" value={cfg.delay_seconds ?? cfg.seconds ?? 0} onChange={(e) => onUpdate({ delay_seconds: Number(e.target.value) })} />
          </div>
          <div>
            <Label className="text-xs">Minutos</Label>
            <Input type="number" value={cfg.delay_minutes ?? 0} onChange={(e) => onUpdate({ delay_minutes: Number(e.target.value) })} />
          </div>
        </div>
      );
    case 'condition':
      return (
        <ConditionEditor cfg={cfg} onUpdate={onUpdate} />
      );
    case 'collect_input':
      return (
        <div className="space-y-2">
          <div><Label className="text-xs">Pergunta</Label><Textarea value={cfg.prompt ?? ''} onChange={(e) => onUpdate({ prompt: e.target.value })} rows={3} /></div>
          <div><Label className="text-xs">Salvar em</Label><Input value={cfg.save_as ?? ''} onChange={(e) => onUpdate({ save_as: e.target.value })} placeholder="email" /></div>
        </div>
      );
    case 'set_tag':
      return (
        <div><Label className="text-xs">Tag</Label><Input value={cfg.tag ?? ''} onChange={(e) => onUpdate({ tag: e.target.value })} /></div>
      );
    case 'create_lead':
      return (
        <div className="space-y-2">
          <div><Label className="text-xs">Form name</Label><Input value={cfg.form_name ?? 'social_flow'} onChange={(e) => onUpdate({ form_name: e.target.value })} /></div>
          <p className="text-xs text-muted-foreground">Lead criado via smart-ops-ingest-lead com dados coletados.</p>
        </div>
      );
    default:
      return <p className="text-xs text-muted-foreground">Sem configuração.</p>;
  }
}