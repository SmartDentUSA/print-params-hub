import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Copy, ExternalLink, Pencil, Trash2, Settings, CopyPlus, FileText, Lock } from "lucide-react";
import { SmartOpsFormEditor } from "./SmartOpsFormEditor";
import { SmartOpsSdrCaptacaoEditor } from "./SmartOpsSdrCaptacaoEditor";
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

const PURPOSE_CONFIG: Record<string, { label: string; color: string; disabled?: boolean; description?: string }> = {
  // Legados
  nps:      { label: "NPS",      color: "bg-green-100 text-green-800 border-green-300" },
  sdr:      { label: "SDR",      color: "bg-blue-100 text-blue-800 border-blue-300" },
  roi:      { label: "ROI",      color: "bg-purple-100 text-purple-800 border-purple-300" },
  cs:       { label: "CS",       color: "bg-orange-100 text-orange-800 border-orange-300" },
  captacao: { label: "Captação", color: "bg-gray-100 text-gray-800 border-gray-300" },
  evento:   { label: "Evento",   color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  // Novos
  sdr_captacao:   { label: "SDR — Captação",    color: "bg-sky-100 text-sky-800 border-sky-300",       disabled: false, description: "Uso externo" },
  cm_update_deal:  { label: "CM — Update Deal",  color: "bg-slate-100 text-slate-600 border-slate-300", disabled: true,  description: "Uso interno — em breve" },
  cs_update_deals: { label: "CS — Update Deals", color: "bg-slate-100 text-slate-600 border-slate-300", disabled: true,  description: "Uso interno — em breve" },
  st_update_deals: { label: "ST — Update Deals", color: "bg-slate-100 text-slate-600 border-slate-300", disabled: true,  description: "Uso interno — em breve" },
};

interface SmartOpsForm {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  title: string | null;
  subtitle: string | null;
  active: boolean;
  form_purpose: string;
  theme_color: string | null;
  success_message: string | null;
  success_redirect_url: string | null;
  submissions_count: number;
  created_at: string;
  // Fase 2 — SDR-Captação
  hero_image_url: string | null;
  hero_image_alt: string | null;
  campaign_identifier: string | null;
  product_catalog_id: string | null;
  workflow_stage_target: string | null;
}

const BASE_FORM_FIELDS = [
  // Contato
  { label: "Nome", field_type: "text", db_column: "nome", required: true, placeholder: "Seu nome completo", order_index: 1 },
  { label: "E-mail", field_type: "email", db_column: "email", required: true, placeholder: "seu@email.com", order_index: 2 },
  { label: "Telefone", field_type: "phone", db_column: "telefone_raw", required: false, placeholder: "(11) 99999-9999", order_index: 3 },
  { label: "Cidade", field_type: "text", db_column: "cidade", required: false, placeholder: "Sua cidade", order_index: 4 },
  { label: "UF", field_type: "select", db_column: "uf", required: false, placeholder: "Selecione o estado", order_index: 5, options: ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"] },
  // Profissional
  { label: "Especialidade", field_type: "select", db_column: "especialidade", required: false, placeholder: "Selecione", order_index: 6, options: ["Prótese Dentária","Implantodontia","Ortodontia","Dentística","Endodontia","Periodontia","Cirurgia","Odontopediatria","Harmonização Orofacial","Radiologia","Laboratório","Outra"] },
  { label: "Área de atuação", field_type: "select", db_column: "area_atuacao", required: false, placeholder: "Selecione", order_index: 7, options: ["Consultório","Clínica","Laboratório","Universidade","Hospital","Outro"] },
  { label: "Empresa", field_type: "text", db_column: "empresa_nome", required: false, placeholder: "Nome da empresa/clínica", order_index: 8 },
  { label: "Cargo", field_type: "text", db_column: "pessoa_cargo", required: false, placeholder: "Seu cargo", order_index: 9 },
  // Equipamentos
  { label: "Tem impressora 3D?", field_type: "radio", db_column: "tem_impressora", required: false, placeholder: "", order_index: 10, options: ["Sim","Não","Pretendo adquirir"] },
  { label: "Modelo da impressora", field_type: "text", db_column: "impressora_modelo", required: false, placeholder: "Ex: MiiCraft 125", order_index: 11 },
  { label: "Tem scanner?", field_type: "radio", db_column: "tem_scanner", required: false, placeholder: "", order_index: 12, options: ["Sim","Não","Pretendo adquirir"] },
  { label: "Software CAD", field_type: "text", db_column: "software_cad", required: false, placeholder: "Ex: Exocad, 3Shape", order_index: 13 },
  { label: "Como digitaliza?", field_type: "select", db_column: "como_digitaliza", required: false, placeholder: "Selecione", order_index: 14, options: ["Scanner intraoral","Scanner de bancada","Moldagem convencional","Não digitalizo ainda","Outro"] },
  // Interesse
  { label: "Produto de interesse", field_type: "select", db_column: "produto_interesse", required: false, placeholder: "Selecione", order_index: 15, options: ["Impressora 3D","Scanner intraoral","Scanner de bancada","Resinas","Software CAD","Pós-processamento","Insumos","Cursos","Suporte técnico","Outro"] },
  { label: "Resina de interesse", field_type: "text", db_column: "resina_interesse", required: false, placeholder: "Ex: SmartPrint Bio Gengiva", order_index: 16 },
  { label: "Principal aplicação", field_type: "select", db_column: "principal_aplicacao", required: false, placeholder: "Selecione", order_index: 17, options: ["Provisórios","Modelos","Guias cirúrgicos","Placas oclusais","Próteses definitivas","Restaurações","Alinhadores","Outro"] },
  { label: "Volume mensal de peças", field_type: "select", db_column: "volume_mensal_pecas", required: false, placeholder: "Selecione", order_index: 18, options: ["Menos de 10","10 a 30","30 a 100","Mais de 100"] },
  // SDR
  { label: "Interesse em scanner", field_type: "radio", db_column: "sdr_scanner_interesse", required: false, placeholder: "", order_index: 19, options: ["Sim","Não","Talvez"] },
  { label: "Interesse em impressora", field_type: "radio", db_column: "sdr_impressora_interesse", required: false, placeholder: "", order_index: 20, options: ["Sim","Não","Talvez"] },
  { label: "Interesse em software CAD", field_type: "radio", db_column: "sdr_software_cad_interesse", required: false, placeholder: "", order_index: 21, options: ["Sim","Não","Talvez"] },
  { label: "Interesse em cursos", field_type: "radio", db_column: "sdr_cursos_interesse", required: false, placeholder: "", order_index: 22, options: ["Sim","Não","Talvez"] },
  { label: "Interesse em insumos lab", field_type: "radio", db_column: "sdr_insumos_lab_interesse", required: false, placeholder: "", order_index: 23, options: ["Sim","Não","Talvez"] },
  { label: "Interesse em pós-impressão", field_type: "radio", db_column: "sdr_pos_impressao_interesse", required: false, placeholder: "", order_index: 24, options: ["Sim","Não","Talvez"] },
  { label: "Interesse em soluções", field_type: "radio", db_column: "sdr_solucoes_interesse", required: false, placeholder: "", order_index: 25, options: ["Sim","Não","Talvez"] },
  { label: "Interesse em dentística", field_type: "radio", db_column: "sdr_dentistica_interesse", required: false, placeholder: "", order_index: 26, options: ["Sim","Não","Talvez"] },
  { label: "Interesse em caracterização", field_type: "radio", db_column: "sdr_caracterizacao_interesse", required: false, placeholder: "", order_index: 27, options: ["Sim","Não","Talvez"] },
  // Profissional (extras)
  { label: "CNPJ", field_type: "text", db_column: "empresa_cnpj", required: false, placeholder: "00.000.000/0000-00", order_index: 28 },
  { label: "Razão Social", field_type: "text", db_column: "empresa_razao_social", required: false, placeholder: "Razão social da empresa", order_index: 29 },
  { label: "Segmento da empresa", field_type: "select", db_column: "empresa_segmento", required: false, placeholder: "Selecione", order_index: 30, options: ["Clínica odontológica","Laboratório de prótese","Universidade","Hospital","Indústria","Distribuidor","Outro"] },
  { label: "CPF", field_type: "text", db_column: "pessoa_cpf", required: false, placeholder: "000.000.000-00", order_index: 31 },
  { label: "Gênero", field_type: "select", db_column: "pessoa_genero", required: false, placeholder: "Selecione", order_index: 32, options: ["Masculino","Feminino","Outro","Prefiro não informar"] },
  // SDR Parâmetros
  { label: "Marca da impressora (parâmetros)", field_type: "text", db_column: "sdr_marca_impressora_param", required: false, placeholder: "Ex: MiiCraft, Formlabs", order_index: 33 },
  { label: "Modelo da impressora (parâmetros)", field_type: "text", db_column: "sdr_modelo_impressora_param", required: false, placeholder: "Ex: 125 Ultra Plus", order_index: 34 },
  { label: "Resina (parâmetros)", field_type: "text", db_column: "sdr_resina_param", required: false, placeholder: "Ex: SmartPrint Bio Gengiva", order_index: 35 },
  // SDR Suporte
  { label: "Equipamento (suporte)", field_type: "text", db_column: "sdr_suporte_equipamento", required: false, placeholder: "Ex: MiiCraft 125", order_index: 36 },
  { label: "Tipo de suporte", field_type: "select", db_column: "sdr_suporte_tipo", required: false, placeholder: "Selecione", order_index: 37, options: ["Instalação","Manutenção","Calibração","Software","Garantia","Dúvida técnica","Outro"] },
  { label: "Descrição do suporte", field_type: "textarea", db_column: "sdr_suporte_descricao", required: false, placeholder: "Descreva o problema ou necessidade", order_index: 38 },
  // Marketing
  { label: "Origem / Campanha", field_type: "text", db_column: "origem_campanha", required: false, placeholder: "Ex: Google Ads, Indicação", order_index: 39 },
  // Empresa extras
  { label: "Website da empresa", field_type: "text", db_column: "empresa_website", required: false, placeholder: "https://...", order_index: 40 },
  { label: "Inscrição Estadual", field_type: "text", db_column: "empresa_ie", required: false, placeholder: "IE", order_index: 41 },
  { label: "Porte da empresa", field_type: "select", db_column: "empresa_porte", required: false, placeholder: "Selecione", order_index: 42, options: ["MEI","ME","EPP","Médio","Grande"] },
  // Pessoa extras
  { label: "Data de nascimento", field_type: "text", db_column: "pessoa_nascimento", required: false, placeholder: "DD/MM/AAAA", order_index: 43 },
  { label: "LinkedIn", field_type: "text", db_column: "pessoa_linkedin", required: false, placeholder: "https://linkedin.com/in/...", order_index: 44 },
  { label: "Facebook", field_type: "text", db_column: "pessoa_facebook", required: false, placeholder: "https://facebook.com/...", order_index: 45 },
  // Comercial extras
  { label: "Informação desejada", field_type: "textarea", db_column: "informacao_desejada", required: false, placeholder: "O que gostaria de saber?", order_index: 46 },
  { label: "Temperatura do lead", field_type: "select", db_column: "temperatura_lead", required: false, placeholder: "Selecione", order_index: 47, options: ["Frio","Morno","Quente"] },
  { label: "País de origem", field_type: "select", db_column: "pais_origem", required: false, placeholder: "Selecione", order_index: 48, options: ["Brasil","Argentina","Chile","Colômbia","México","Peru","Portugal","Espanha","EUA","Outro"] },
  { label: "Código do contrato", field_type: "text", db_column: "codigo_contrato", required: false, placeholder: "Código interno", order_index: 49 },
  // CS & Suporte
  { label: "Treinamento CS", field_type: "select", db_column: "cs_treinamento", required: false, placeholder: "Selecione", order_index: 50, options: ["pendente","agendado","concluido"] },
  { label: "Data do treinamento", field_type: "text", db_column: "data_treinamento", required: false, placeholder: "DD/MM/AAAA", order_index: 51 },
  { label: "Data do contrato", field_type: "text", db_column: "data_contrato", required: false, placeholder: "DD/MM/AAAA", order_index: 52 },
  { label: "Reunião agendada?", field_type: "radio", db_column: "reuniao_agendada", required: false, placeholder: "", order_index: 53, options: ["Sim","Não"] },
  { label: "Data primeiro contato", field_type: "text", db_column: "data_primeiro_contato", required: false, placeholder: "DD/MM/AAAA", order_index: 54 },
  // Funil & Status
  { label: "Status da oportunidade", field_type: "select", db_column: "status_oportunidade", required: false, placeholder: "Selecione", order_index: 55, options: ["aberta","ganha","perdida"] },
  { label: "Valor da oportunidade", field_type: "number", db_column: "valor_oportunidade", required: false, placeholder: "R$ 0,00", order_index: 56 },
  { label: "Proprietário do lead (CRM)", field_type: "text", db_column: "proprietario_lead_crm", required: false, placeholder: "Nome do vendedor", order_index: 57 },
  { label: "Produto interesse (auto)", field_type: "text", db_column: "produto_interesse_auto", required: false, placeholder: "Detectado automaticamente", order_index: 58 },
  // Equipamentos Ativos (seriais)
  { label: "Scanner (modelo)", field_type: "text", db_column: "equip_scanner", required: false, placeholder: "Ex: Medit i700", order_index: 59 },
  { label: "Scanner (nº série)", field_type: "text", db_column: "equip_scanner_serial", required: false, placeholder: "Nº série", order_index: 60 },
  { label: "Impressora (modelo)", field_type: "text", db_column: "equip_impressora", required: false, placeholder: "Ex: MiiCraft 125", order_index: 61 },
  { label: "Impressora (nº série)", field_type: "text", db_column: "equip_impressora_serial", required: false, placeholder: "Nº série", order_index: 62 },
  { label: "CAD (modelo)", field_type: "text", db_column: "equip_cad", required: false, placeholder: "Ex: Exocad", order_index: 63 },
  { label: "CAD (nº série)", field_type: "text", db_column: "equip_cad_serial", required: false, placeholder: "Nº série", order_index: 64 },
  { label: "Pós-impressão (modelo)", field_type: "text", db_column: "equip_pos_impressao", required: false, placeholder: "Ex: Bre.Lux Power", order_index: 65 },
  { label: "Pós-impressão (nº série)", field_type: "text", db_column: "equip_pos_impressao_serial", required: false, placeholder: "Nº série", order_index: 66 },
  { label: "Notebook (modelo)", field_type: "text", db_column: "equip_notebook", required: false, placeholder: "Ex: Dell Precision", order_index: 67 },
  { label: "Notebook (nº série)", field_type: "text", db_column: "equip_notebook_serial", required: false, placeholder: "Nº série", order_index: 68 },
  { label: "Insumos adquiridos", field_type: "textarea", db_column: "insumos_adquiridos", required: false, placeholder: "Liste os insumos já adquiridos", order_index: 69 },
  // Marketing / UTM
  { label: "UTM Source", field_type: "text", db_column: "utm_source", required: false, placeholder: "google, facebook...", order_index: 70 },
  { label: "UTM Medium", field_type: "text", db_column: "utm_medium", required: false, placeholder: "cpc, email...", order_index: 71 },
  { label: "UTM Campaign", field_type: "text", db_column: "utm_campaign", required: false, placeholder: "nome_campanha", order_index: 72 },
  { label: "UTM Term", field_type: "text", db_column: "utm_term", required: false, placeholder: "palavra-chave", order_index: 73 },
  // Tags & Status
  { label: "Motivo de perda", field_type: "text", db_column: "motivo_perda", required: false, placeholder: "Motivo da perda", order_index: 74 },
  { label: "Comentário de perda", field_type: "textarea", db_column: "comentario_perda", required: false, placeholder: "Detalhes sobre a perda", order_index: 75 },
  { label: "ID Cliente Smart", field_type: "text", db_column: "id_cliente_smart", required: false, placeholder: "ID interno", order_index: 76 },
];

export function SmartOpsFormBuilder() {
  const [forms, setForms] = useState<SmartOpsForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingForm, setEditingForm] = useState<SmartOpsForm | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPurpose, setNewPurpose] = useState("captacao");
  const [editingMeta, setEditingMeta] = useState<SmartOpsForm | null>(null);
  const [metaName, setMetaName] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaSubtitle, setMetaSubtitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [metaPurpose, setMetaPurpose] = useState("");
  const [metaColor, setMetaColor] = useState("");
  const [metaSuccess, setMetaSuccess] = useState("");
  const [metaRedirect, setMetaRedirect] = useState("");
  const [metaHeroImageUrl, setMetaHeroImageUrl] = useState("");
  const [metaHeroImageAlt, setMetaHeroImageAlt] = useState("");
  const [metaCampaignIdentifier, setMetaCampaignIdentifier] = useState("");
  const [metaProductCatalogId, setMetaProductCatalogId] = useState("");
  const [metaWorkflowStageTarget, setMetaWorkflowStageTarget] = useState("");

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

  const handleCreateBaseForm = async () => {
    const slug = `formulario-base-${Date.now()}`;
    const { data: formData, error: formError } = await supabase
      .from("smartops_forms" as any)
      .insert({
        name: "📋 Formulário Base (todos os campos)",
        slug,
        form_purpose: "captacao",
        title: "Formulário SmartDent 3D",
        subtitle: "Preencha seus dados para atendimento especializado",
        description: "Formulário completo com todos os campos disponíveis no sistema.",
        active: true,
      } as any)
      .select("id")
      .single();

    if (formError || !formData) {
      toast.error(`Erro: ${formError?.message}`);
      return;
    }

    const formId = (formData as any).id;
    const fieldsToInsert = BASE_FORM_FIELDS.map((f) => ({
      form_id: formId,
      label: f.label,
      field_type: f.field_type,
      db_column: f.db_column,
      required: f.required,
      placeholder: f.placeholder || null,
      order_index: f.order_index,
      options: f.options || null,
    }));

    const { error: fieldsError } = await supabase
      .from("smartops_form_fields" as any)
      .insert(fieldsToInsert as any);

    if (fieldsError) {
      toast.error(`Erro nos campos: ${fieldsError.message}`);
      return;
    }

    toast.success("Formulário base criado com 27 campos!");
    fetchForms();
  };

  const handleDuplicate = async (form: SmartOpsForm) => {
    const newSlug = `${form.slug}-copia-${Date.now()}`;
    const { data: newForm, error: formError } = await supabase
      .from("smartops_forms" as any)
      .insert({
        name: `${form.name} (cópia)`,
        slug: newSlug,
        form_purpose: form.form_purpose,
        title: (form as any).title || null,
        subtitle: (form as any).subtitle || null,
        description: form.description || null,
        theme_color: form.theme_color || null,
        success_message: form.success_message || null,
        success_redirect_url: (form as any).success_redirect_url || null,
        active: false,
      } as any)
      .select("id")
      .single();

    if (formError || !newForm) {
      toast.error(`Erro: ${formError?.message}`);
      return;
    }

    const { data: fields } = await supabase
      .from("smartops_form_fields" as any)
      .select("*")
      .eq("form_id", form.id)
      .order("order_index");

    if (fields && (fields as any[]).length > 0) {
      const newFields = (fields as any[]).map(({ id, form_id, created_at, ...rest }: any) => ({
        ...rest,
        form_id: (newForm as any).id,
      }));
      await supabase.from("smartops_form_fields" as any).insert(newFields as any);
    }

    toast.success("Formulário duplicado!");
    fetchForms();
  };

  const openEditMeta = (form: SmartOpsForm) => {
    setMetaName(form.name);
    setMetaTitle(form.title || "");
    setMetaSubtitle(form.subtitle || "");
    setMetaDescription(form.description || "");
    setMetaPurpose(form.form_purpose);
    setMetaColor(form.theme_color || "");
    setMetaSuccess(form.success_message || "");
    setMetaRedirect(form.success_redirect_url || "");
    setMetaHeroImageUrl(form.hero_image_url || "");
    setMetaHeroImageAlt(form.hero_image_alt || "");
    setMetaCampaignIdentifier(form.campaign_identifier || "");
    setMetaProductCatalogId(form.product_catalog_id || "");
    setMetaWorkflowStageTarget(form.workflow_stage_target || "");
    setEditingMeta(form);
  };

  const handleSaveMeta = async () => {
    if (!editingMeta || !metaName.trim()) return;
    const { error } = await supabase.from("smartops_forms" as any)
      .update({
        name: metaName.trim(),
        title: metaTitle || null,
        subtitle: metaSubtitle || null,
        description: metaDescription || null,
        form_purpose: metaPurpose,
        theme_color: metaColor || null,
        success_message: metaSuccess || null,
        success_redirect_url: metaRedirect || null,
        hero_image_url: metaHeroImageUrl || null,
        hero_image_alt: metaHeroImageAlt || null,
        campaign_identifier: metaCampaignIdentifier || null,
        product_catalog_id: metaProductCatalogId || null,
        workflow_stage_target: metaWorkflowStageTarget || null,
      } as any)
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
    const purposeCfg = PURPOSE_CONFIG[editingForm.form_purpose];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setEditingForm(null); fetchForms(); }}>
            ← Voltar
          </Button>
          <h3 className="font-semibold text-lg">{editingForm.name}</h3>
          {purposeCfg && (
            <Badge className={purposeCfg.color}>{purposeCfg.label}</Badge>
          )}
        </div>
        {editingForm.form_purpose === "sdr_captacao" ? (
          <SmartOpsSdrCaptacaoEditor form={editingForm} />
        ) : (
          <SmartOpsFormEditor formId={editingForm.id} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-lg">Formulários</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleCreateBaseForm}>
            <FileText className="w-4 h-4 mr-1" /> Criar Formulário Base
          </Button>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Novo Formulário</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Formulário — Selecione o tipo</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {/* Tipo: SDR — Captação (habilitado) */}
                <button
                  className="w-full text-left rounded-lg border-2 border-sky-300 bg-sky-50 p-3 hover:bg-sky-100 transition-colors"
                  onClick={() => { setNewPurpose("sdr_captacao"); }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sky-800 text-sm">SDR — Captação</p>
                      <p className="text-xs text-sky-600 mt-0.5">Formulário público de captação de leads</p>
                    </div>
                    {newPurpose === "sdr_captacao" && (
                      <span className="text-xs bg-sky-600 text-white px-2 py-0.5 rounded">Selecionado</span>
                    )}
                  </div>
                </button>

                {/* Tipos desabilitados */}
                {(["cm_update_deal", "cs_update_deals", "st_update_deals"] as const).map((key) => {
                  const cfg = PURPOSE_CONFIG[key];
                  return (
                    <div
                      key={key}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 opacity-60 cursor-not-allowed"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-500 text-sm flex items-center gap-1.5">
                            <Lock className="w-3 h-3" />
                            {cfg.label}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">{cfg.description}</p>
                        </div>
                        <span className="text-xs bg-slate-200 text-slate-500 px-2 py-0.5 rounded">Em breve</span>
                      </div>
                    </div>
                  );
                })}

                <hr className="my-1" />
                <div className="space-y-2">
                  <Input
                    placeholder="Nome do formulário (interno)"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                  <Button
                    onClick={handleCreate}
                    className="w-full"
                    disabled={newPurpose !== "sdr_captacao" || !newName.trim()}
                  >
                    Criar formulário SDR — Captação
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={!!editingMeta} onOpenChange={(o) => !o && setEditingMeta(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Formulário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nome interno (admin)</label>
                <Input value={metaName} onChange={(e) => setMetaName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium">Título público (web)</label>
                <Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder="Ex: Cadastre-se para receber atendimento" />
                <p className="text-xs text-muted-foreground mt-1">Aparece como título principal na página do formulário.</p>
              </div>
              <div>
                <label className="text-xs font-medium">Subtítulo (web)</label>
                <Input value={metaSubtitle} onChange={(e) => setMetaSubtitle(e.target.value)} placeholder="Ex: Preencha os dados abaixo" />
              </div>
              <div>
                <label className="text-xs font-medium">Descrição (web)</label>
                <Textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} placeholder="Texto descritivo exibido na página pública" rows={3} />
              </div>
              <div>
                <label className="text-xs font-medium">Finalidade</label>
                <Select value={metaPurpose} onValueChange={setMetaPurpose}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PURPOSE_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key} disabled={cfg.disabled}>
                        {cfg.label}{cfg.disabled ? " (em breve)" : ""}
                      </SelectItem>
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

              {/* Campos Fase 2 — visíveis para todos os tipos (safe para valores nulos em tipos legados) */}
              <div className="border-t pt-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SDR-Captação / Workflow</p>
                <div>
                  <label className="text-xs font-medium">URL da imagem HERO</label>
                  <Input value={metaHeroImageUrl} onChange={(e) => setMetaHeroImageUrl(e.target.value)} placeholder="https://..." />
                </div>
                <div>
                  <label className="text-xs font-medium">ALT da imagem HERO</label>
                  <Input value={metaHeroImageAlt} onChange={(e) => setMetaHeroImageAlt(e.target.value)} placeholder="Descrição da imagem" />
                </div>
                <div>
                  <label className="text-xs font-medium">Identificador de campanha</label>
                  <Input value={metaCampaignIdentifier} onChange={(e) => setMetaCampaignIdentifier(e.target.value)} placeholder="ex: feira-cbo-2026" />
                </div>
                <div>
                  <label className="text-xs font-medium">Etapa Workflow (workflow_stage_target)</label>
                  <Input value={metaWorkflowStageTarget} onChange={(e) => setMetaWorkflowStageTarget(e.target.value)} placeholder="ex: 1_captura_digital__scanner_intraoral" />
                </div>
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
                  <td className="p-3">
                    <div className="font-medium">{form.name}</div>
                    {(form as any).title && (
                      <div className="text-xs text-muted-foreground">Web: {(form as any).title}</div>
                    )}
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={PURPOSE_CONFIG[form.form_purpose]?.color ?? "bg-gray-100 text-gray-600 border-gray-300"}>
                      {PURPOSE_CONFIG[form.form_purpose]?.label ?? form.form_purpose}
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
                      <Button variant="ghost" size="icon" onClick={() => handleDuplicate(form)} title="Duplicar formulário">
                        <CopyPlus className="w-4 h-4" />
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
