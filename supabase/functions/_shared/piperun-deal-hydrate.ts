/**
 * PipeRun Deal Hydration
 * ----------------------
 * Quando o webhook do PipeRun chega com payload incompleto (ex.: evento de
 * mudança de stage envia só `deal + stage + owner`, sem `person`/`company`
 * aninhados), buscamos o Deal completo via GET /deals/{id} e mesclamos em
 * cima do payload do webhook para preservar todos os ~129 campos disponíveis
 * no PipeRun.
 *
 * Regras:
 * - O payload do webhook tem precedência para campos que ele traz (timestamps
 *   reais do evento, action, etc).
 * - O GET preenche os blocos aninhados que possam estar faltando.
 */
import { piperunGet } from "./piperun-field-map.ts";

const HYDRATE_INCLUDES = [
  "person",
  "person.contact_emails",
  "person.contact_phones",
  "person.city",
  "person.state",
  "company",
  "company.contact_emails",
  "company.contact_phones",
  "company.city",
  "company.state",
  "company.custom_fields",
  "proposals",
  "proposals.items",
  "custom_fields",
  "activities",
  "files",
  "tags",
  "origin",
  "origin.group",
  "temperature",
  "loss_reason",
  "lost_reason",
  "notes",
  "stage",
  "pipeline",
  "owner",
  "involved_users",
];

/**
 * True quando o payload do webhook claramente está faltando blocos essenciais
 * (Person ou Company), o que indica um evento parcial do PipeRun.
 */
export function needsHydration(deal: Record<string, unknown>): {
  needs: boolean;
  reason: string;
} {
  const person = deal.person as Record<string, unknown> | undefined;
  const company = (person?.company || deal.company) as Record<string, unknown> | undefined;

  // Faltam blocos
  if (!person || typeof person !== "object") return { needs: true, reason: "no_person_block" };
  if (!company || typeof company !== "object") return { needs: true, reason: "no_company_block" };

  // Person veio sem nenhum identificador útil (email + telefone + id + hash)
  const hasEmail =
    (person.contact_emails as Array<{ address?: string }> | undefined)?.[0]?.address ||
    person.email;
  const hasPhone =
    (person.contact_phones as Array<{ number?: string }> | undefined)?.[0]?.number ||
    person.phone ||
    person.mobile;
  if (!hasEmail && !hasPhone && !person.id && !person.hash) {
    return { needs: true, reason: "no_person_identifiers" };
  }

  // Custom fields zerados quando o deal claramente tem valor
  const cf = deal.custom_fields as unknown[] | undefined;
  if ((!cf || (Array.isArray(cf) && cf.length === 0)) && (deal.value != null && Number(deal.value) > 0)) {
    return { needs: true, reason: "empty_custom_fields_with_value" };
  }

  // ─── Blocos comerciais do payload completo ───
  // Origem: obrigatória para relatórios de canal
  const origin = deal.origin as Record<string, unknown> | undefined;
  if (!origin && !deal.origin_id && !deal.origin_name) {
    return { needs: true, reason: "no_origin_block" };
  }

  // Temperatura / probabilidade (usadas no forecast)
  if (deal.temperature === undefined && deal.temperature_id === undefined) {
    return { needs: true, reason: "no_temperature" };
  }

  // Propostas/itens: deal com valor precisa ter itens para o mix de produtos
  const proposals = deal.proposals as unknown[] | undefined;
  const proposalsEmpty = !Array.isArray(proposals) || proposals.length === 0;
  if (proposalsEmpty && deal.value != null && Number(deal.value) > 0) {
    return { needs: true, reason: "no_proposals_with_value" };
  }
  if (Array.isArray(proposals) && proposals.length > 0) {
    const anyItems = proposals.some((p) => Array.isArray((p as Record<string, unknown>)?.items) &&
      ((p as Record<string, unknown>).items as unknown[]).length > 0);
    if (!anyItems) return { needs: true, reason: "proposals_without_items" };
  }

  // Timing de etapa (tempo em cada etapa no funil)
  if (!deal.last_stage_updated_at && !deal.stage_updated_at && !deal.last_stage_at) {
    return { needs: true, reason: "no_stage_timing" };
  }

  // Motivo de perda em deals fechados como perdidos
  const statusRaw = String(deal.status ?? "");
  if ((statusRaw === "3" || /perd/i.test(statusRaw)) && !deal.lost_reason && !deal.loss_reason) {
    return { needs: true, reason: "lost_without_reason" };
  }

  return { needs: false, reason: "complete" };
}

/**
 * Faz GET /deals/{id} com todos os includes e mescla em cima do payload
 * original do webhook. Campos escalares do webhook têm precedência.
 * Retorna o deal original se a chamada falhar (best-effort).
 */
export async function hydrateDealPayload(
  apiToken: string,
  dealId: string,
  webhookDeal: Record<string, unknown>,
): Promise<{ deal: Record<string, unknown>; hydrated: boolean; error?: string }> {
  if (!apiToken || !dealId) return { deal: webhookDeal, hydrated: false, error: "no_token_or_id" };

  try {
    const res = await piperunGet(apiToken, `deals/${dealId}`, {}, {
      "with[]": HYDRATE_INCLUDES,
    });
    if (!res.success || !res.data) {
      return { deal: webhookDeal, hydrated: false, error: `piperun_get_${res.status}` };
    }
    const fetched = (res.data as Record<string, unknown>).data as Record<string, unknown> | undefined;
    if (!fetched || typeof fetched !== "object") {
      return { deal: webhookDeal, hydrated: false, error: "no_data_in_response" };
    }

    // Estratégia de merge:
    // - fetched é a base (PipeRun = source of truth para o estado atual)
    // - webhookDeal sobrescreve campos escalares específicos do evento que o
    //   GET não retorna (ex: `action`, `stage_changed_at` em alguns casos),
    //   mantendo `proposals`, `person`, `company`, `custom_fields` do GET.
    const merged: Record<string, unknown> = { ...fetched };

    // Preserva metadados do evento que só o webhook tem
    const EVENT_ONLY_KEYS = ["action", "trigger", "webhook_event", "fired_at"];
    for (const k of EVENT_ONLY_KEYS) {
      if (webhookDeal[k] !== undefined) merged[k] = webhookDeal[k];
    }

    // Para arrays/objetos sensíveis: se o GET veio vazio e o webhook tem
    // dado, mantém o do webhook (caso raro de proteção dupla).
    for (const k of [
      "proposals",
      "custom_fields",
      "activities",
      "files",
      "involved_users",
      "tags",
      "notes",
      "origin",
      "temperature",
      "lost_reason",
      "loss_reason",
    ]) {
      const fetchedVal = merged[k];
      const webhookVal = webhookDeal[k];
      const fetchedEmpty = !fetchedVal || (Array.isArray(fetchedVal) && fetchedVal.length === 0);
      const webhookHas = webhookVal && (!Array.isArray(webhookVal) || webhookVal.length > 0);
      if (fetchedEmpty && webhookHas) merged[k] = webhookVal;
    }

    // Timestamps reais do evento nunca devem ser substituídos por now()/GET vazio
    for (const k of [
      "created_at",
      "closed_at",
      "updated_at",
      "last_stage_updated_at",
      "stage_updated_at",
      "last_contact_at",
      "forecast_close_at",
    ]) {
      if (!merged[k] && webhookDeal[k]) merged[k] = webhookDeal[k];
    }

    // ─── Identity preservation ───
    // O GET /deals/{id} frequentemente devolve person/company SEM contact_emails
    // ou contact_phones (mesmo com with[]), o que apagaria a identidade que o
    // próprio webhook entregou. Se o webhook trouxe contatos e o GET veio sem,
    // preservamos os contatos originais por bloco.
    const preserveContactArrays = (
      blockKey: "person" | "company",
    ) => {
      const fetchedBlock = merged[blockKey] as Record<string, unknown> | undefined;
      const webhookBlock = webhookDeal[blockKey] as Record<string, unknown> | undefined;
      if (!webhookBlock || typeof webhookBlock !== "object") return;
      const target = (fetchedBlock && typeof fetchedBlock === "object") ? { ...fetchedBlock } : {};

      for (const arrKey of ["contact_emails", "contact_phones"]) {
        const fetchedArr = target[arrKey] as unknown[] | undefined;
        const webhookArr = webhookBlock[arrKey] as unknown[] | undefined;
        const fetchedEmpty = !Array.isArray(fetchedArr) || fetchedArr.length === 0;
        const webhookHas = Array.isArray(webhookArr) && webhookArr.length > 0;
        if (fetchedEmpty && webhookHas) target[arrKey] = webhookArr;
      }
      // Scalars de fallback (email/phone/mobile no person)
      for (const sKey of ["email", "phone", "mobile"]) {
        if (!target[sKey] && webhookBlock[sKey]) target[sKey] = webhookBlock[sKey];
      }
      merged[blockKey] = target;
    };
    preserveContactArrays("person");
    preserveContactArrays("company");

    // Person.company também pode trazer contatos — mescla se o bloco company
    // mesclado acima ainda estiver sem.
    const mergedPerson = merged.person as Record<string, unknown> | undefined;
    const webhookPerson = webhookDeal.person as Record<string, unknown> | undefined;
    const personCompanyWebhook = webhookPerson?.company as Record<string, unknown> | undefined;
    if (mergedPerson && personCompanyWebhook && typeof personCompanyWebhook === "object") {
      const mergedPersonCompany = (mergedPerson.company as Record<string, unknown> | undefined) || {};
      const personCompany: Record<string, unknown> = { ...personCompanyWebhook, ...mergedPersonCompany };
      for (const arrKey of ["contact_emails", "contact_phones"]) {
        const fa = personCompany[arrKey] as unknown[] | undefined;
        const wa = personCompanyWebhook[arrKey] as unknown[] | undefined;
        if ((!Array.isArray(fa) || fa.length === 0) && Array.isArray(wa) && wa.length > 0) {
          personCompany[arrKey] = wa;
        }
      }
      (mergedPerson as Record<string, unknown>).company = personCompany;
      merged.person = mergedPerson;
    }

    return { deal: merged, hydrated: true };
  } catch (e) {
    return { deal: webhookDeal, hydrated: false, error: String(e) };
  }
}

/**
 * Fetch contact_emails/contact_phones de uma Company via GET /companies/{id}.
 * O endpoint /deals/{id} com `with[]=company.contact_emails` nem sempre
 * retorna esses arrays — buscamos diretamente quando precisamos do contato
 * da empresa para identificar o lead.
 */
export async function fetchCompanyContacts(
  apiToken: string,
  companyId: number | string,
): Promise<{ contact_emails?: Array<{ address?: string }>; contact_phones?: Array<{ number?: string }> } | null> {
  if (!apiToken || !companyId) return null;
  try {
    const res = await piperunGet(apiToken, `companies/${companyId}`, {}, {
      "with[]": ["contact_emails", "contact_phones"],
    });
    if (!res.success || !res.data) return null;
    const data = (res.data as Record<string, unknown>).data as Record<string, unknown> | undefined;
    if (!data) return null;
    return {
      contact_emails: data.contact_emails as Array<{ address?: string }> | undefined,
      contact_phones: data.contact_phones as Array<{ number?: string }> | undefined,
    };
  } catch {
    return null;
  }
}