import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AREA_ATUACAO_OPTIONS, ESPECIALIDADE_OPTIONS } from "@/lib/dentalTaxonomy";
import { Loader2, Search, Save, Upload, Pencil, Lock } from "lucide-react";

type LeadRow = Record<string, any>;

const DDI_OPTIONS = [
  { value: "55", label: "🇧🇷 +55 (Brasil)" },
  { value: "1", label: "🇺🇸 +1 (EUA/Canadá)" },
  { value: "351", label: "🇵🇹 +351 (Portugal)" },
  { value: "34", label: "🇪🇸 +34 (Espanha)" },
  { value: "54", label: "🇦🇷 +54 (Argentina)" },
  { value: "56", label: "🇨🇱 +56 (Chile)" },
  { value: "57", label: "🇨🇴 +57 (Colômbia)" },
  { value: "52", label: "🇲🇽 +52 (México)" },
];

const emptyForm = {
  nome: "",
  email: "",
  area_atuacao: "",
  especialidade: "",
  pessoa_nascimento: "",
  prof_cro: "",
  prof_photo_url: "",
  prof_mini_cv: "",
  prof_course_platform: "",
  prof_wa_ddi: "55",
  prof_wa_number: "",
  prof_course_wa_ddi: "55",
  prof_course_wa_number: "",
  prof_cep: "",
  prof_country: "Brasil",
  prof_state: "",
  prof_city: "",
  prof_neighborhood: "",
  prof_street: "",
  prof_number: "",
  prof_complement: "",
  instagram: "",
  prof_tiktok: "",
  prof_youtube: "",
  pessoa_linkedin: "",
  prof_lattes: "",
  prof_orcid: "",
  prof_fapesp_id: "",
  prof_site: "",
  prof_marketing_consent: false,
};

type FormState = typeof emptyForm;

interface CoursesProfessionalProfileProps {
  initialEmail?: string;
  onSaved?: (leadId: string) => void;
}

export default function CoursesProfessionalProfile({ initialEmail, onSaved }: CoursesProfessionalProfileProps = {}) {
  const { toast } = useToast();
  const [searchEmail, setSearchEmail] = useState(initialEmail ?? "");
  const [searching, setSearching] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [locked, setLocked] = useState(true); // when a lead is loaded, fields are locked until Edit
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const setField = (k: keyof FormState, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const loadByEmail = useCallback(async () => {
    const email = searchEmail.trim().toLowerCase();
    if (!email) return;
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from("lia_attendances")
        .select(
          "id, nome, email, area_atuacao, especialidade, pessoa_nascimento, prof_cro, prof_photo_url, prof_mini_cv, prof_course_platform, prof_wa_ddi, prof_wa_number, prof_course_wa_ddi, prof_course_wa_number, prof_cep, prof_country, prof_state, prof_city, prof_neighborhood, prof_street, prof_number, prof_complement, instagram, prof_tiktok, prof_youtube, pessoa_linkedin, prof_lattes, prof_orcid, prof_fapesp_id, prof_site, prof_marketing_consent"
        )
        .ilike("email", email)
        .is("merged_into", null)
        .order("created_at", { ascending: false } as any)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Novo profissional
        setLeadId(null);
        setForm({ ...emptyForm, email });
        setLocked(false);
        toast({ title: "E-mail não encontrado", description: "Preencha os dados para criar uma nova ficha." });
        return;
      }

      setLeadId(data.id);
      setForm({
        ...emptyForm,
        ...Object.fromEntries(Object.entries(data).filter(([k]) => k in emptyForm)),
        email: data.email ?? email,
      } as FormState);
      setLocked(true);
      toast({ title: "Ficha carregada", description: `Lead encontrado — ${data.nome ?? email}` });
    } catch (e: any) {
      toast({ title: "Erro ao buscar", description: e.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  }, [searchEmail, toast]);

  const onCepBlur = async () => {
    const cep = form.prof_cep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const j = await r.json();
      if (j?.erro) return;
      setForm((f) => ({
        ...f,
        prof_state: j.uf ?? f.prof_state,
        prof_city: j.localidade ?? f.prof_city,
        prof_neighborhood: j.bairro ?? f.prof_neighborhood,
        prof_street: j.logradouro ?? f.prof_street,
        prof_country: f.prof_country || "Brasil",
      }));
    } catch {
      /* silencioso */
    }
  };

  const onUploadPhoto = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const key = `course-profiles/${(form.email || "anon").replace(/[^a-z0-9]/gi, "_")}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("catalog-images").upload(key, file, {
        upsert: true,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("catalog-images").getPublicUrl(key);
      setField("prof_photo_url", data.publicUrl);
      toast({ title: "Foto enviada" });
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.email) {
      toast({ title: "E-mail obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        ...form,
        pessoa_nascimento: form.pessoa_nascimento || null,
        prof_marketing_consent_at: form.prof_marketing_consent ? new Date().toISOString() : null,
        prof_updated_at: new Date().toISOString(),
      };

      if (leadId) {
        const { error } = await supabase.from("lia_attendances").update(payload).eq("id", leadId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("lia_attendances")
          .insert({ ...payload, lead_status: "novo", origem_primeiro_contato: "smartops_ficha_profissional" })
          .select("id")
          .single();
        if (error) throw error;
        setLeadId(data.id);
      }
      setLocked(true);
      toast({ title: "Ficha salva com sucesso" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const disabled = locked;

  return (
    <div className="space-y-6">
      {/* Busca por e-mail */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Ficha do Profissional
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              placeholder="E-mail do profissional (busca automática)"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadByEmail()}
            />
            <Button onClick={loadByEmail} disabled={searching || !searchEmail.trim()}>
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              Buscar
            </Button>
          </div>
          {leadId && (
            <div className="flex items-center gap-2 mt-3">
              <Badge variant="secondary">Lead: {leadId.slice(0, 8)}</Badge>
              {locked ? (
                <Button size="sm" variant="outline" onClick={() => setLocked(false)}>
                  <Pencil className="w-4 h-4 mr-2" /> Editar
                </Button>
              ) : (
                <Badge variant="outline" className="text-orange-600">
                  <Pencil className="w-3 h-3 mr-1" /> Modo edição
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Foto + Dados básicos */}
      <Card>
        <CardHeader>
          <CardTitle>1. Dados do profissional</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center gap-2">
              <div className="w-24 h-24 rounded-full bg-muted overflow-hidden border">
                {form.prof_photo_url ? (
                  <img src={form.prof_photo_url} alt="Foto" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                    Sem foto
                  </div>
                )}
              </div>
              <label>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={disabled || uploading}
                  onChange={(e) => e.target.files?.[0] && onUploadPhoto(e.target.files[0])}
                />
                <Button asChild size="sm" variant="outline" disabled={disabled || uploading}>
                  <span>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                    Foto
                  </span>
                </Button>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
              <div>
                <Label>Nome completo</Label>
                <Input value={form.nome} onChange={(e) => setField("nome", e.target.value)} disabled={disabled} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input value={form.email} onChange={(e) => setField("email", e.target.value)} disabled={disabled || !!leadId} />
              </div>
              <div>
                <Label>Área de atuação</Label>
                <Select value={form.area_atuacao} onValueChange={(v) => setField("area_atuacao", v)} disabled={disabled}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {AREA_ATUACAO_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Especialidade</Label>
                <Select value={form.especialidade} onValueChange={(v) => setField("especialidade", v)} disabled={disabled}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {ESPECIALIDADE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data de nascimento</Label>
                <Input type="date" value={form.pessoa_nascimento?.slice(0, 10) || ""} onChange={(e) => setField("pessoa_nascimento", e.target.value)} disabled={disabled} />
              </div>
              <div>
                <Label>Registro profissional (CRO)</Label>
                <Input value={form.prof_cro} onChange={(e) => setField("prof_cro", e.target.value)} disabled={disabled} />
              </div>
              <div>
                <Label>Plataforma de cursos</Label>
                <Input value={form.prof_course_platform} onChange={(e) => setField("prof_course_platform", e.target.value)} disabled={disabled} placeholder="Hotmart, Kiwify, Astron..." />
              </div>
            </div>
          </div>

          <div>
            <Label>Mini CV</Label>
            <Textarea value={form.prof_mini_cv} onChange={(e) => setField("prof_mini_cv", e.target.value)} disabled={disabled} rows={4} placeholder="Formação, experiência, cursos ministrados..." />
          </div>
        </CardContent>
      </Card>

      {/* Endereço profissional */}
      <Card>
        <CardHeader><CardTitle>Endereço profissional</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>CEP</Label>
            <Input value={form.prof_cep} onChange={(e) => setField("prof_cep", e.target.value)} onBlur={onCepBlur} disabled={disabled} placeholder="00000-000" />
          </div>
          <div>
            <Label>País</Label>
            <Input value={form.prof_country} onChange={(e) => setField("prof_country", e.target.value)} disabled={disabled} />
          </div>
          <div>
            <Label>Estado</Label>
            <Input value={form.prof_state} onChange={(e) => setField("prof_state", e.target.value)} disabled={disabled} />
          </div>
          <div>
            <Label>Cidade</Label>
            <Input value={form.prof_city} onChange={(e) => setField("prof_city", e.target.value)} disabled={disabled} />
          </div>
          <div>
            <Label>Bairro</Label>
            <Input value={form.prof_neighborhood} onChange={(e) => setField("prof_neighborhood", e.target.value)} disabled={disabled} />
          </div>
          <div className="md:col-span-2">
            <Label>Endereço</Label>
            <Input value={form.prof_street} onChange={(e) => setField("prof_street", e.target.value)} disabled={disabled} />
          </div>
          <div>
            <Label>Número</Label>
            <Input value={form.prof_number} onChange={(e) => setField("prof_number", e.target.value)} disabled={disabled} />
          </div>
          <div className="md:col-span-4">
            <Label>Complemento</Label>
            <Input value={form.prof_complement} onChange={(e) => setField("prof_complement", e.target.value)} disabled={disabled} />
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp */}
      <Card>
        <CardHeader><CardTitle>Contatos WhatsApp</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>WhatsApp de contato</Label>
            <div className="flex gap-2">
              <Select value={form.prof_wa_ddi} onValueChange={(v) => setField("prof_wa_ddi", v)} disabled={disabled}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DDI_OPTIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={form.prof_wa_number} onChange={(e) => setField("prof_wa_number", e.target.value)} disabled={disabled} placeholder="DDD + número" />
            </div>
          </div>
          <div>
            <Label>WhatsApp do curso</Label>
            <div className="flex gap-2">
              <Select value={form.prof_course_wa_ddi} onValueChange={(v) => setField("prof_course_wa_ddi", v)} disabled={disabled}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DDI_OPTIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={form.prof_course_wa_number} onChange={(e) => setField("prof_course_wa_number", e.target.value)} disabled={disabled} placeholder="DDD + número" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Redes sociais e cadastros */}
      <Card>
        <CardHeader><CardTitle>Cadastros e redes sociais</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Instagram</Label><Input value={form.instagram} onChange={(e) => setField("instagram", e.target.value)} disabled={disabled} /></div>
          <div><Label>TikTok</Label><Input value={form.prof_tiktok} onChange={(e) => setField("prof_tiktok", e.target.value)} disabled={disabled} /></div>
          <div><Label>Canal YouTube</Label><Input value={form.prof_youtube} onChange={(e) => setField("prof_youtube", e.target.value)} disabled={disabled} /></div>
          <div><Label>LinkedIn</Label><Input value={form.pessoa_linkedin} onChange={(e) => setField("pessoa_linkedin", e.target.value)} disabled={disabled} /></div>
          <div><Label>Lattes</Label><Input value={form.prof_lattes} onChange={(e) => setField("prof_lattes", e.target.value)} disabled={disabled} /></div>
          <div><Label>ORCID</Label><Input value={form.prof_orcid} onChange={(e) => setField("prof_orcid", e.target.value)} disabled={disabled} /></div>
          <div><Label>FAPESP ID</Label><Input value={form.prof_fapesp_id} onChange={(e) => setField("prof_fapesp_id", e.target.value)} disabled={disabled} /></div>
          <div><Label>Site</Label><Input value={form.prof_site} onChange={(e) => setField("prof_site", e.target.value)} disabled={disabled} /></div>
        </CardContent>
      </Card>

      {/* Consentimento */}
      <Card>
        <CardHeader><CardTitle>Consentimento</CardTitle></CardHeader>
        <CardContent>
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={form.prof_marketing_consent}
              onCheckedChange={(v) => setField("prof_marketing_consent", !!v)}
              disabled={disabled}
            />
            <span className="text-sm">
              Permito que a Smart Dent utilize estes dados para divulgação dos meus cursos.
            </span>
          </label>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 sticky bottom-4">
        {locked && leadId ? (
          <Button onClick={() => setLocked(false)} variant="outline">
            <Pencil className="w-4 h-4 mr-2" /> Editar ficha
          </Button>
        ) : (
          <>
            {leadId && (
              <Button variant="outline" onClick={() => setLocked(true)}>
                <Lock className="w-4 h-4 mr-2" /> Cancelar
              </Button>
            )}
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar ficha
            </Button>
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Fase 1 · Próximas fases: Mix de produtos, Perfil de experiência (Scanner / Impressora / Resinas / etc.) e Ratings.
      </p>
    </div>
  );
}