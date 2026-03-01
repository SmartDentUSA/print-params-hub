import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Copy, ExternalLink, Pencil, Trash2, Settings } from "lucide-react";
import { SmartOpsFormEditor } from "./SmartOpsFormEditor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const PURPOSE_CONFIG: Record<string, { label: string; color: string }> = {
  nps: { label: "NPS", color: "bg-green-100 text-green-800 border-green-300" },
  sdr: { label: "SDR", color: "bg-blue-100 text-blue-800 border-blue-300" },
  roi: { label: "ROI", color: "bg-purple-100 text-purple-800 border-purple-300" },
  cs: { label: "CS", color: "bg-orange-100 text-orange-800 border-orange-300" },
  captacao: { label: "Captação", color: "bg-gray-100 text-gray-800 border-gray-300" },
  evento: { label: "Evento", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
};

interface SmartOpsForm {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  form_purpose: string;
  theme_color: string | null;
  success_message: string | null;
  submissions_count: number;
  created_at: string;
}

export function SmartOpsFormBuilder() {
  const [forms, setForms] = useState<SmartOpsForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingForm, setEditingForm] = useState<SmartOpsForm | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPurpose, setNewPurpose] = useState("captacao");
  const [editingMeta, setEditingMeta] = useState<SmartOpsForm | null>(null);
  const [metaName, setMetaName] = useState("");
  const [metaPurpose, setMetaPurpose] = useState("");
  const [metaColor, setMetaColor] = useState("");
  const [metaSuccess, setMetaSuccess] = useState("");
  const [metaRedirect, setMetaRedirect] = useState("");

  const PRODUCTION_BASE = "https://parametros.smartdent.com.br";

  const fetchForms = async () => {
    const { data, error } = await supabase
      .from("smartops_forms" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setForms(data as any);
    setLoading(false);
  };

  useEffect(() => { fetchForms(); }, []);

  const generateSlug = (text: string) =>
    text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const slug = generateSlug(newName);
    const { error } = await supabase.from("smartops_forms" as any).insert({
      name: newName.trim(),
      slug,
      form_purpose: newPurpose,
    } as any);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    toast.success("Formulário criado!");
    setNewName("");
    setShowCreate(false);
    fetchForms();
  };

  const openEditMeta = (form: SmartOpsForm) => {
    setMetaName(form.name);
    setMetaPurpose(form.form_purpose);
    setMetaColor(form.theme_color || "");
    setMetaSuccess(form.success_message || "");
    setMetaRedirect((form as any).success_redirect_url || "");
    setEditingMeta(form);
  };

  const handleSaveMeta = async () => {
    if (!editingMeta || !metaName.trim()) return;
    const { error } = await supabase.from("smartops_forms" as any)
      .update({ name: metaName.trim(), form_purpose: metaPurpose, theme_color: metaColor || null, success_message: metaSuccess || null, success_redirect_url: metaRedirect || null } as any)
      .eq("id", editingMeta.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Formulário atualizado!");
    setEditingMeta(null);
    fetchForms();
  };

  const toggleActive = async (form: SmartOpsForm) => {
    await supabase.from("smartops_forms" as any)
      .update({ active: !form.active } as any)
      .eq("id", form.id);
    fetchForms();
  };

  const deleteForm = async (id: string) => {
    if (!confirm("Excluir formulário e todos os campos?")) return;
    await supabase.from("smartops_forms" as any).delete().eq("id", id);
    toast.success("Formulário excluído");
    fetchForms();
  };

  const getFormUrl = (slug: string) => `${PRODUCTION_BASE}/f/${slug}`;

  const copyEmbed = (slug: string, formName: string) => {
    const url = getFormUrl(slug);
    const code = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${formName} | SmartDent 3D</title>
  <meta name="description" content="${formName} - Formulário SmartDent 3D. Preencha e receba atendimento especializado." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${url}" />
  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${formName} | SmartDent 3D" />
  <meta property="og:description" content="${formName} - Formulário SmartDent 3D." />
  <meta property="og:url" content="${url}" />
  <meta property="og:site_name" content="SmartDent 3D" />
  <meta property="og:locale" content="pt_BR" />
  <!-- Geo -->
  <meta name="geo.region" content="BR-SC" />
  <meta name="geo.placename" content="Florianópolis" />
  <meta name="geo.position" content="-27.5954;-48.5480" />
  <meta name="ICBM" content="-27.5954, -48.5480" />
  <!-- Schema.org -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "${formName}",
    "url": "${url}",
    "publisher": {
      "@type": "Organization",
      "name": "SmartDent 3D",
      "url": "https://parametros.smartdent.com.br"
    }
  }
  </script>
  <style>
    body { margin: 0; padding: 0; font-family: sans-serif; }
    iframe { border: none; width: 100%; min-height: 600px; }
  </style>
</head>
<body>
  <iframe src="${url}" width="100%" height="700" frameborder="0" title="${formName}" loading="lazy"></iframe>
</body>
</html>`;
    navigator.clipboard.writeText(code);
    toast.success("HTML embed com SEO/GEO copiado!");
  };

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(getFormUrl(slug));
    toast.success("Link copiado!");
  };

  if (editingForm) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setEditingForm(null); fetchForms(); }}>
            ← Voltar
          </Button>
          <h3 className="font-semibold text-lg">{editingForm.name}</h3>
          <Badge className={PURPOSE_CONFIG[editingForm.form_purpose]?.color}>
            {PURPOSE_CONFIG[editingForm.form_purpose]?.label}
          </Badge>
        </div>
        <SmartOpsFormEditor formId={editingForm.id} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Formulários</h3>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Novo Formulário</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Formulário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Nome do formulário"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Select value={newPurpose} onValueChange={setNewPurpose}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PURPOSE_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleCreate} className="w-full">Criar</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editingMeta} onOpenChange={(o) => !o && setEditingMeta(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Formulário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium">Nome</label>
                <Input value={metaName} onChange={(e) => setMetaName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium">Finalidade</label>
                <Select value={metaPurpose} onValueChange={setMetaPurpose}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PURPOSE_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Cor tema (hex)</label>
                <Input value={metaColor} onChange={(e) => setMetaColor(e.target.value)} placeholder="#3b82f6" />
              </div>
              <div>
                <label className="text-xs font-medium">Mensagem de sucesso</label>
                <Input value={metaSuccess} onChange={(e) => setMetaSuccess(e.target.value)} placeholder="Obrigado pelo envio!" />
              </div>
              <div>
                <label className="text-xs font-medium">URL de redirecionamento após envio</label>
                <Input value={metaRedirect} onChange={(e) => setMetaRedirect(e.target.value)} placeholder="https://parametros.smartdent.com.br/obrigado" />
                <p className="text-xs text-muted-foreground mt-1">Se preenchido, redireciona o lead para esta URL após o envio.</p>
              </div>
              <Button onClick={handleSaveMeta} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : forms.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum formulário criado ainda.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Nome</th>
                <th className="text-left p-3 font-medium">Finalidade</th>
                <th className="text-center p-3 font-medium">Submissões</th>
                <th className="text-center p-3 font-medium">Ativo</th>
                <th className="text-right p-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {forms.map((form) => (
                <tr key={form.id} className="border-t">
                  <td className="p-3 font-medium">{form.name}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={PURPOSE_CONFIG[form.form_purpose]?.color}>
                      {PURPOSE_CONFIG[form.form_purpose]?.label}
                    </Badge>
                  </td>
                  <td className="p-3 text-center">{form.submissions_count}</td>
                  <td className="p-3 text-center">
                    <Switch checked={form.active} onCheckedChange={() => toggleActive(form)} />
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openEditMeta(form)} title="Editar nome/config">
                        <Settings className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditingForm(form)} title="Editar campos">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => copyLink(form.slug)} title="Copiar link">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => copyEmbed(form.slug, form.name)} title="Copiar HTML embed com SEO">
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteForm(form.id)} title="Excluir">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
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
