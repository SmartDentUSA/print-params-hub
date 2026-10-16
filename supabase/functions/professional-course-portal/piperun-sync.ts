/**
 * Sincronização Portal Profissional → PipeRun (CRM).
 *
 * Regras rígidas (pedido do usuário):
 * - NUNCA cria Pessoa, Organização ou Deal — só PUT em registros que JÁ existem
 *   (pessoa_piperun_id / empresa_piperun_id do lead).
 * - No CRM só INSERE dados faltantes: um campo só é enviado se estiver vazio
 *   no PipeRun. Nada é sobrescrito.
 * - Falhas de CRM nunca quebram o salvamento no sistema (log + segue).
 */
import { piperunGet, piperunPut, matchPiperunEnum, PIPERUN_AREA_ATUACAO_ENUM, PIPERUN_ESPECIALIDADE_ENUM } from "../_shared/piperun-field-map.ts";

// deno-lint-ignore no-explicit-any
type Admin = any;

function apiToken(): string | null {
  return Deno.env.get("PIPERUN_API_KEY") || Deno.env.get("PIPERUN_API_TOKEN") || null;
}

const isEmpty = (v: unknown) =>
  v === null || v === undefined || (typeof v === "string" && !v.trim());

type Endereco = {
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  postal_code?: string | null;
};

function enderecoLinha(e: Endereco | null): string | null {
  if (!e || typeof e !== "object") return null;
  const parts = [e.street, e.number, e.complement, e.district]
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/**
 * Envia ao PipeRun apenas os campos que estão vazios lá.
 * Retorna lista de campos efetivamente enviados (para log).
 */
export async function syncProfessionalToCrm(
  admin: Admin,
  leadId: string,
  changed: Record<string, unknown>,
): Promise<{ person_fields: string[]; company_fields: string[]; skipped: boolean }> {
  const token = apiToken();
  if (!token) return { person_fields: [], company_fields: [], skipped: true };

  const { data: lead } = await admin
    .from("lia_attendances")
    .select("nome, area_atuacao, especialidade, pessoa_cpf, empresa_cnpj, prof_city, prof_state, prof_cep, pessoa_endereco, prof_site, pessoa_piperun_id, empresa_piperun_id")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return { person_fields: [], company_fields: [], skipped: true };

  const sentPerson: string[] = [];
  const sentCompany: string[] = [];
  const endereco = (lead.pessoa_endereco && typeof lead.pessoa_endereco === "object"
    ? lead.pessoa_endereco
    : null) as Endereco | null;

  // ---- Pessoa (somente se já existir no CRM) ----
  const personId = Number(lead.pessoa_piperun_id) || 0;
  if (personId > 0) {
    try {
      const cur = await piperunGet(token, `persons/${personId}`);
      if (cur.success && cur.data && typeof cur.data === "object") {
        const p = cur.data as Record<string, unknown>;
        const payload: Record<string, unknown> = {};
        if (isEmpty(p.cpf) && !isEmpty(lead.pessoa_cpf)) payload.cpf = String(lead.pessoa_cpf).replace(/\D/g, "");
        if (isEmpty(p.job_title)) {
          const job = lead.especialidade || lead.area_atuacao;
          if (!isEmpty(job)) payload.job_title = String(job);
        }
        if (isEmpty(p.city) && !isEmpty(lead.prof_city)) payload.city = String(lead.prof_city);
        if (isEmpty(p.state) && !isEmpty(lead.prof_state)) payload.state = String(lead.prof_state);
        const addr = enderecoLinha(endereco);
        if (isEmpty(p.address) && addr) payload.address = addr;
        if (isEmpty(p.zip_code) && !isEmpty(lead.prof_cep)) payload.zip_code = String(lead.prof_cep).replace(/\D/g, "");
        if (Object.keys(payload).length) {
          const res = await piperunPut(token, `persons/${personId}`, payload);
          if (res.success) sentPerson.push(...Object.keys(payload));
          else console.warn("[portal] piperun person PUT falhou", res.status);
        }
      }
    } catch (e) {
      console.error("[portal] sync person CRM", e);
    }
  }

  // ---- Organização (somente se já existir no CRM) ----
  const companyId = Number(lead.empresa_piperun_id) || 0;
  if (companyId > 0) {
    try {
      const cur = await piperunGet(token, `companies/${companyId}`);
      if (cur.success && cur.data && typeof cur.data === "object") {
        const c = cur.data as Record<string, unknown>;
        const payload: Record<string, unknown> = {};
        if (isEmpty(c.cnpj) && !isEmpty(lead.empresa_cnpj)) payload.cnpj = String(lead.empresa_cnpj).replace(/\D/g, "");
        if (isEmpty(c.website) && !isEmpty(lead.prof_site)) payload.website = String(lead.prof_site);
        if (isEmpty(c.city) && !isEmpty(lead.prof_city)) payload.city = String(lead.prof_city);
        if (isEmpty(c.state) && !isEmpty(lead.prof_state)) payload.state = String(lead.prof_state);
        const addr = enderecoLinha(endereco);
        if (isEmpty(c.address) && addr) payload.address = addr;
        if (isEmpty(c.zip_code) && !isEmpty(lead.prof_cep)) payload.zip_code = String(lead.prof_cep).replace(/\D/g, "");
        if (isEmpty(c.segment) && !isEmpty(lead.area_atuacao)) {
          const seg = matchPiperunEnum(String(lead.area_atuacao), PIPERUN_AREA_ATUACAO_ENUM);
          if (seg) payload.segment = seg;
        }
        if (Object.keys(payload).length) {
          const res = await piperunPut(token, `companies/${companyId}`, payload);
          if (res.success) sentCompany.push(...Object.keys(payload));
          else console.warn("[portal] piperun company PUT falhou", res.status);
        }
      }
    } catch (e) {
      console.error("[portal] sync company CRM", e);
    }
  }

  // Campos de formulário da Pessoa (área/especialidade) — também só preenche se vazio
  if (personId > 0 && (changed.area_atuacao || changed.especialidade)) {
    try {
      const cur = await piperunGet(token, `persons/${personId}`);
      const p = (cur?.data ?? {}) as Record<string, unknown>;
      const cf: { id: number; value: unknown }[] = [];
      const existing = Array.isArray(p.custom_fields) ? p.custom_fields : [];
      const hasCf = (id: number) =>
        existing.some((f: any) => Number(f?.id) === id && !isEmpty(f?.value) && (!Array.isArray(f.value) || f.value.length));
      if (!hasCf(673900) && !isEmpty(lead.area_atuacao)) {
        const v = matchPiperunEnum(String(lead.area_atuacao), PIPERUN_AREA_ATUACAO_ENUM);
        if (v) cf.push({ id: 673900, value: v });
      }
      if (!hasCf(445631) && !isEmpty(lead.especialidade)) {
        const v = matchPiperunEnum(String(lead.especialidade), PIPERUN_ESPECIALIDADE_ENUM);
        if (v) cf.push({ id: 445631, value: [v] });
      }
      if (cf.length) {
        const res = await piperunPut(token, `persons/${personId}`, { custom_fields: cf });
        if (res.success) sentPerson.push(...cf.map((f) => `cf_${f.id}`));
      }
    } catch (e) {
      console.error("[portal] sync person custom fields CRM", e);
    }
  }

  return { person_fields: sentPerson, company_fields: sentCompany, skipped: false };
}
