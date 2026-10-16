import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Pencil, Save } from "lucide-react";
import ProfessionalQualifications from "@/components/smartops/ProfessionalQualifications";
import type { QualificationEntry, UniversityRoleEntry } from "@/lib/mecInstitutions";

export interface PortalProfile {
  id: string;
  nome: string | null;
  email: string | null;
  prof_photo_url: string | null;
  prof_cro: string | null;
  prof_mini_cv: string | null;
  prof_wa_ddi: string | null;
  prof_wa_number: string | null;
  prof_course_wa_ddi: string | null;
  prof_course_wa_number: string | null;
  instagram: string | null;
  prof_tiktok: string | null;
  prof_youtube: string | null;
  prof_site: string | null;
  prof_city: string | null;
  prof_state: string | null;
  area_atuacao: string | null;
  especialidade: string | null;
  prof_cep: string | null;
  pessoa_endereco: string | null;
  pessoa_cpf: string | null;
  empresa_cnpj: string | null;
  prof_qualifications: Record<string, QualificationEntry[]> | null;
  prof_university_roles: UniversityRoleEntry[] | null;
}

interface ContractDataState {
  person_type: "PF" | "PJ" | "";
  legal_name: string;
  document: string;
  pix_key: string;
  locked: boolean; // contrato já assinado
  has_contract: boolean;
}

interface Props {
  profile: PortalProfile;
  onProfileChange: (p: PortalProfile) => void;
  call: (action: string, extra?: Record<string, unknown>) => Promise<any>;
}

/** Seção "Meus dados" do Portal Profissional Parceiro: perfil, dados do contrato,
 *  endereço, contatos, redes sociais, qualificações e funções universitárias. */
export default function PortalMyData({ profile, onProfileChange, call }: Props) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contractData, setContractData] = useState<ContractDataState>({
    person_type: "",
    legal_name: "",
    document: "",
    pix_key: "",
    locked: false,
    has_contract: false,
  });

  const set = (patch: Partial<PortalProfile>) => onProfileChange({ ...profile, ...patch });

  const loadContractData = useCallback(async () => {
    try {
      const d = await call("contract_data");
      const c = d.contract;
      const fb = d.fallback ?? {};
      const personType = (c?.person_type as "PF" | "PJ" | null) ?? (fb.cpf ? "PF" : fb.cnpj ? "PJ" : "");
      setContractData({
        person_type: personType ?? "",
        legal_name: c?.legal_name ?? fb.nome ?? "",
        document: c?.document ?? (personType === "PJ" ? fb.cnpj ?? "" : fb.cpf ?? ""),
        pix_key: c?.pix_key ?? "",
        locked: !!c && (c.status === "assinado" || !!c.signed_at),
        has_contract: !!c,
      });
    } catch {
      /* sem contrato: bloco aparece com fallback do lead */
    }
  }, [call]);

  useEffect(() => {
    void loadContractData();
  }, [loadContractData]);

  const save = async () => {
    setSaving(true);
    try {
      await call("save_profile", { professional: profile });
      if (!contractData.locked && contractData.person_type) {
        await call("save_contract_data", {
          contract_data: {
            person_type: contractData.person_type,
            legal_name: contractData.legal_name,
            document: contractData.document,
            pix_key: contractData.pix_key,
          },
        });
      }
      toast({ title: "Dados salvos com sucesso!" });
      setEditing(false);
      await loadContractData();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const disabled = !editing;
  const isPF = contractData.person_type === "PF";
  const isPJ = contractData.person_type === "PJ";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {editing ? (
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salvar tudo
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="w-4 h-4 mr-2" /> Editar
          </Button>
        )}
      </div>

      {/* 1. Perfil profissional */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perfil profissional</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><Label>Nome</Label><Input disabled={disabled} value={profile.nome ?? ""} onChange={(e) => set({ nome: e.target.value })} /></div>
          <div><Label>E-mail</Label><Input disabled value={profile.email ?? ""} /></div>
          <div><Label>CRO</Label><Input disabled={disabled} value={profile.prof_cro ?? ""} onChange={(e) => set({ prof_cro: e.target.value })} /></div>
          <div><Label>Área de atuação</Label><Input disabled={disabled} value={profile.area_atuacao ?? ""} onChange={(e) => set({ area_atuacao: e.target.value })} /></div>
          <div><Label>Especialidade</Label><Input disabled={disabled} value={profile.especialidade ?? ""} onChange={(e) => set({ especialidade: e.target.value })} /></div>
          <div className="md:col-span-3"><Label>Mini CV</Label><Textarea rows={3} disabled={disabled} value={profile.prof_mini_cv ?? ""} onChange={(e) => set({ prof_mini_cv: e.target.value })} /></div>
        </CardContent>
      </Card>

      {/* 2. Dados do contrato */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do contrato</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {contractData.locked && (
            <p className="text-sm text-muted-foreground">
              Contrato já assinado. Para alterar estes dados, peça um aditivo à equipe Smart Dent.
            </p>
          )}
          <div>
            <Label className="mb-2 block">Tipo de pessoa</Label>
            <RadioGroup
              value={contractData.person_type}
              onValueChange={(v) =>
                setContractData((c) => ({
                  ...c,
                  person_type: v as "PF" | "PJ",
                  document: v === "PF" ? (profile.pessoa_cpf ?? "") : (profile.empresa_cnpj ?? ""),
                }))
              }
              disabled={disabled || contractData.locked}
              className="flex gap-6"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="PF" /> Pessoa Física
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="PJ" /> Pessoa Jurídica
              </label>
            </RadioGroup>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>{isPJ ? "Razão social" : "Nome completo (legal)"}</Label>
              <Input
                disabled={disabled || contractData.locked || !contractData.person_type}
                value={contractData.legal_name}
                onChange={(e) => setContractData((c) => ({ ...c, legal_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>CPF</Label>
              <Input
                disabled={disabled || contractData.locked || !isPF}
                value={isPF ? contractData.document : (profile.pessoa_cpf ?? "")}
                onChange={(e) => setContractData((c) => ({ ...c, document: e.target.value }))}
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <Label>Chave PIX (CPF)</Label>
              <Input
                disabled={disabled || contractData.locked || !isPF}
                value={isPF ? contractData.pix_key : ""}
                onChange={(e) => setContractData((c) => ({ ...c, pix_key: e.target.value }))}
                placeholder="Chave PIX para comissões"
              />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input
                disabled={disabled || contractData.locked || !isPJ}
                value={isPJ ? contractData.document : (profile.empresa_cnpj ?? "")}
                onChange={(e) => setContractData((c) => ({ ...c, document: e.target.value }))}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div>
              <Label>Chave PIX (CNPJ)</Label>
              <Input
                disabled={disabled || contractData.locked || !isPJ}
                value={isPJ ? contractData.pix_key : ""}
                onChange={(e) => setContractData((c) => ({ ...c, pix_key: e.target.value }))}
                placeholder="Chave PIX para comissões"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Estes dados são usados na geração do seu contrato de parceria e no pagamento das comissões.
          </p>
        </CardContent>
      </Card>

      {/* 3. Endereço profissional */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Endereço profissional</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><Label>CEP</Label><Input disabled={disabled} value={profile.prof_cep ?? ""} onChange={(e) => set({ prof_cep: e.target.value })} placeholder="00000-000" /></div>
          <div className="md:col-span-2"><Label>Endereço</Label><Input disabled={disabled} value={profile.pessoa_endereco ?? ""} onChange={(e) => set({ pessoa_endereco: e.target.value })} placeholder="Rua, número, complemento, bairro" /></div>
          <div><Label>Cidade</Label><Input disabled={disabled} value={profile.prof_city ?? ""} onChange={(e) => set({ prof_city: e.target.value })} /></div>
          <div><Label>Estado</Label><Input disabled={disabled} value={profile.prof_state ?? ""} onChange={(e) => set({ prof_state: e.target.value })} placeholder="UF" /></div>
        </CardContent>
      </Card>

      {/* 4. Contatos WhatsApp */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contatos WhatsApp</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>WhatsApp pessoal</Label>
            <div className="flex gap-2">
              <Input className="w-20" disabled={disabled} value={profile.prof_wa_ddi ?? ""} onChange={(e) => set({ prof_wa_ddi: e.target.value })} placeholder="55" />
              <Input disabled={disabled} value={profile.prof_wa_number ?? ""} onChange={(e) => set({ prof_wa_number: e.target.value })} placeholder="16 99999-9999" />
            </div>
          </div>
          <div>
            <Label>WhatsApp para cursos</Label>
            <div className="flex gap-2">
              <Input className="w-20" disabled={disabled} value={profile.prof_course_wa_ddi ?? ""} onChange={(e) => set({ prof_course_wa_ddi: e.target.value })} placeholder="55" />
              <Input disabled={disabled} value={profile.prof_course_wa_number ?? ""} onChange={(e) => set({ prof_course_wa_number: e.target.value })} placeholder="16 99999-9999" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Cadastros e redes sociais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cadastros e redes sociais</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Instagram</Label><Input disabled={disabled} value={profile.instagram ?? ""} onChange={(e) => set({ instagram: e.target.value })} placeholder="@seuperfil" /></div>
          <div><Label>TikTok</Label><Input disabled={disabled} value={profile.prof_tiktok ?? ""} onChange={(e) => set({ prof_tiktok: e.target.value })} /></div>
          <div><Label>YouTube</Label><Input disabled={disabled} value={profile.prof_youtube ?? ""} onChange={(e) => set({ prof_youtube: e.target.value })} /></div>
          <div><Label>Site</Label><Input disabled={disabled} value={profile.prof_site ?? ""} onChange={(e) => set({ prof_site: e.target.value })} placeholder="https://" /></div>
        </CardContent>
      </Card>

      {/* 6 e 7. Qualificações e funções universitárias */}
      <ProfessionalQualifications
        disabled={disabled}
        qualifications={profile.prof_qualifications ?? {}}
        onQualificationsChange={(v) => set({ prof_qualifications: v })}
        universityRoles={profile.prof_university_roles ?? []}
        onUniversityRolesChange={(v) => set({ prof_university_roles: v })}
      />
    </div>
  );
}
