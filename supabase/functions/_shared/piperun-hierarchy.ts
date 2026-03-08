/**
 * PipeRun Hierarchy — Person → Company → Deal management.
 * Extracted from smart-ops-lia-assign for reuse.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  PIPELINES,
  STAGES_VENDAS,
  ORIGINS,
  piperunPost,
  piperunPut,
  piperunGet,
  addDealNote,
  customFieldsToHashMap,
  PESSOA_CUSTOM_FIELDS,
  PESSOA_CUSTOM_FIELD_HASHES,
} from "./piperun-field-map.ts";

type SupabaseClient = ReturnType<typeof createClient>;

// ── Person Operations ──

export async function findPersonByEmail(
  apiToken: string,
  email: string
): Promise<{ id: number; company_id: number | null } | null> {
  if (!email) return null;
  try {
    const res = await piperunGet(apiToken, "persons", { email, show: 1 });
    if (res.success && res.data) {
      const items = (res.data as Record<string, unknown>).data as Array<Record<string, unknown>> | undefined;
      if (items && items.length > 0 && items[0].id) {
        return {
          id: Number(items[0].id),
          company_id: items[0].company_id ? Number(items[0].company_id) : null,
        };
      }
    }
  } catch (e) {
    console.warn("[piperun-hierarchy] Person search error:", e);
  }
  return null;
}

export async function createPerson(
  apiToken: string,
  lead: Record<string, unknown>
): Promise<number | null> {
  const email = lead.email as string | null;
  const nome = (lead.nome || email || "Lead Sem Nome") as string;
  const phone = (lead.telefone_normalized || lead.telefone_raw) as string | null;
  const especialidade = lead.especialidade as string | null;
  const areaAtuacao = lead.area_atuacao as string | null;

  const personPayload: Record<string, unknown> = { name: nome };
  if (email) personPayload.emails = [{ email }];
  if (phone) personPayload.phones = [{ phone }];
  if (especialidade) personPayload.job_title = especialidade;

  const personCustomFields: Array<{ custom_field_id: number; value: string }> = [];
  if (areaAtuacao) personCustomFields.push({ custom_field_id: PESSOA_CUSTOM_FIELDS.AREA_ATUACAO, value: areaAtuacao });
  if (especialidade) personCustomFields.push({ custom_field_id: PESSOA_CUSTOM_FIELDS.ESPECIALIDADE, value: especialidade });
  if (personCustomFields.length > 0) personPayload.custom_fields = personCustomFields;

  console.log(`[piperun-hierarchy] Creating person: ${nome}`);
  const createRes = await piperunPost(apiToken, "persons", personPayload);
  if (createRes.success && createRes.data) {
    const personData = (createRes.data as Record<string, unknown>).data as Record<string, unknown> | undefined;
    if (personData?.id) return Number(personData.id);
  }
  console.warn(`[piperun-hierarchy] Failed to create person (${createRes.status})`);
  return null;
}

export async function updatePersonFields(
  apiToken: string,
  personId: number,
  lead: Record<string, unknown>
): Promise<void> {
  const nome = (lead.nome || lead.email || "") as string;
  const phone = (lead.telefone_normalized || lead.telefone_raw) as string | null;
  const especialidade = lead.especialidade as string | null;
  const areaAtuacao = lead.area_atuacao as string | null;

  const updatePayload: Record<string, unknown> = {};
  if (nome) updatePayload.name = nome;
  if (phone) updatePayload.phones = [{ phone }];
  if (especialidade) updatePayload.job_title = especialidade;
  if (areaAtuacao) updatePayload[PESSOA_CUSTOM_FIELD_HASHES[PESSOA_CUSTOM_FIELDS.AREA_ATUACAO]] = areaAtuacao;
  if (especialidade) updatePayload[PESSOA_CUSTOM_FIELD_HASHES[PESSOA_CUSTOM_FIELDS.ESPECIALIDADE]] = especialidade;

  if (Object.keys(updatePayload).length === 0) return;

  const res = await piperunPut(apiToken, `persons/${personId}`, updatePayload);
  console.log(`[piperun-hierarchy] Person ${personId} update: ${res.success} (${res.status})`);
}

// ── Company Operations ──

export async function findOrCreateCompany(
  apiToken: string,
  personId: number,
  existingCompanyId: number | null,
  lead: Record<string, unknown>
): Promise<number | null> {
  const nome = (lead.nome || lead.email || "Empresa Lead") as string;
  const email = lead.email as string | null;
  const phone = (lead.telefone_normalized || lead.telefone_raw) as string | null;
  const cnpj = lead.empresa_cnpj as string | null;
  const razaoSocial = lead.empresa_razao_social as string | null;
  const segmento = lead.empresa_segmento as string | null;
  const website = lead.empresa_website as string | null;

  if (existingCompanyId) {
    const enrichPayload: Record<string, unknown> = { name: razaoSocial || nome };
    if (email) enrichPayload.emails = [{ email }];
    if (phone) enrichPayload.phones = [{ phone }];
    if (cnpj) enrichPayload.cnpj = cnpj;
    if (segmento) enrichPayload.segment = segmento;
    if (website) enrichPayload.website = website;
    await piperunPut(apiToken, `companies/${existingCompanyId}`, enrichPayload);
    return existingCompanyId;
  }

  const companyPayload: Record<string, unknown> = { name: razaoSocial || nome };
  if (email) companyPayload.emails = [{ email }];
  if (phone) companyPayload.phones = [{ phone }];
  if (cnpj) companyPayload.cnpj = cnpj;
  if (segmento) companyPayload.segment = segmento;
  if (website) companyPayload.website = website;

  const createRes = await piperunPost(apiToken, "companies", companyPayload);
  const companyId = ((createRes.data as Record<string, unknown>)?.data as Record<string, unknown>)?.id;

  if (companyId) {
    await piperunPut(apiToken, `persons/${personId}`, { company_id: Number(companyId) });
    return Number(companyId);
  }
  return null;
}

export async function fetchCompanyData(
  apiToken: string,
  companyId: number
): Promise<Record<string, unknown> | null> {
  try {
    const res = await piperunGet(apiToken, `companies/${companyId}`, {});
    if (res.success && res.data) {
      const companyData = (res.data as Record<string, unknown>).data as Record<string, unknown> | undefined;
      return companyData || null;
    }
  } catch (e) {
    console.warn("[piperun-hierarchy] Error fetching company data:", e);
  }
  return null;
}

// ── Deal Operations ──

export async function findPersonDeals(
  apiToken: string,
  personId: number
): Promise<Array<Record<string, unknown>>> {
  try {
    const res = await piperunGet(apiToken, "deals", { person_id: personId, show: 50 });
    if (res.success && res.data) {
      const items = (res.data as Record<string, unknown>).data as Array<Record<string, unknown>> | undefined;
      if (items) return items.filter((d) => d.deleted !== 1 && d.deleted !== true);
    }
  } catch (e) {
    console.warn("[piperun-hierarchy] Error fetching person deals:", e);
  }
  return [];
}

export async function updateExistingDeal(
  apiToken: string,
  dealId: number,
  ownerId: number | null,
  customFields: Array<{ custom_field_id: number; value: string }>,
  lead: Record<string, unknown>,
  companyId: number | null | undefined,
  supabase: SupabaseClient,
  buildNotification: (lead: Record<string, unknown>, supabase: SupabaseClient) => Promise<string>
): Promise<void> {
  const hashFields = customFieldsToHashMap(customFields);
  const updatePayload: Record<string, unknown> = {
    origin_id: ORIGINS.DRA_LIA.id,
    ...hashFields,
  };
  if (ownerId !== null) updatePayload.owner_id = ownerId;
  if (companyId) updatePayload.company_id = companyId;

  await piperunPut(apiToken, `deals/${dealId}`, updatePayload);

  const noteText = await buildNotification(lead, supabase);
  await addDealNote(apiToken, dealId, noteText);
}

export async function moveDealToVendas(
  apiToken: string,
  dealId: number,
  ownerId: number,
  stageId: number,
  customFields: Array<{ custom_field_id: number; value: string }>,
  lead: Record<string, unknown>,
  companyId: number | null | undefined,
  supabase: SupabaseClient,
  buildNotification: (lead: Record<string, unknown>, supabase: SupabaseClient) => Promise<string>
): Promise<void> {
  const hashFields = customFieldsToHashMap(customFields);
  const updatePayload: Record<string, unknown> = {
    pipeline_id: PIPELINES.VENDAS,
    stage_id: stageId,
    owner_id: ownerId,
    origin_id: ORIGINS.DRA_LIA.id,
    freezed: 0,
    ...hashFields,
  };
  if (companyId) updatePayload.company_id = companyId;

  await piperunPut(apiToken, `deals/${dealId}`, updatePayload);

  const noteText = "🔄 [Dra. L.I.A.] Deal reativado do funil Estagnados → Funil de Vendas\n\n" +
    await buildNotification(lead, supabase);
  await addDealNote(apiToken, dealId, noteText);
}

export async function createNewDeal(
  apiToken: string,
  personId: number,
  companyId: number | null,
  lead: Record<string, unknown>,
  pipelineId: number,
  stageId: number,
  ownerId: number,
  customFields: Array<{ custom_field_id: number; value: string }>,
  email: string,
  supabase: SupabaseClient,
  buildNotification: (lead: Record<string, unknown>, supabase: SupabaseClient) => Promise<string>
): Promise<string | null> {
  const dealPayload: Record<string, unknown> = {
    title: lead.nome || email,
    pipeline_id: pipelineId,
    stage_id: stageId,
    owner_id: ownerId,
    origin_id: ORIGINS.DRA_LIA.id,
    reference: email,
    person_id: personId,
  };
  if (companyId) dealPayload.company_id = companyId;
  if (customFields.length > 0) dealPayload.custom_fields = customFields;

  const createRes = await piperunPost(apiToken, "deals", dealPayload);
  if (createRes.success && createRes.data) {
    const dealData = (createRes.data as Record<string, unknown>).data as Record<string, unknown> | undefined;
    if (dealData?.id) {
      const dealId = String(dealData.id);
      const noteText = await buildNotification(lead, supabase);
      await addDealNote(apiToken, Number(dealId), noteText);
      return dealId;
    }
  }
  return null;
}

export async function resolveFirstStage(
  apiToken: string,
  pipelineId: number
): Promise<number> {
  try {
    const res = await piperunGet(apiToken, `stages`, { pipeline_id: pipelineId });
    if (res.success && res.data) {
      const stages = (res.data as Record<string, unknown>).data as Array<Record<string, unknown>> | undefined;
      if (stages && stages.length > 0) {
        return Number(stages[0].id);
      }
    }
  } catch (e) {
    console.warn("[piperun-hierarchy] Error resolving first stage:", e);
  }
  return STAGES_VENDAS.SEM_CONTATO;
}
