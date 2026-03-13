import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ─── Parse BRL currency string to number ─── */
function parseBRL(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/R\$\s*/g, "").replace(/\./g, "").replace(",", ".").trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function parseQty(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(",", ".").trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (!digits || digits.length < 8) return null;
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  if (digits.length === 10) {
    const ddd = parseInt(digits.slice(0, 2));
    if (ddd >= 11) digits = digits.slice(0, 2) + "9" + digits.slice(2);
  }
  if (digits.length < 10 || digits.length > 11) return null;
  return `+55${digits}`;
}

/* ─── Email helpers ─── */
function extractEmails(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const cleaned = String(raw)
    .replace(/^"|"$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return [];

  const tokens = cleaned
    .split(/[;,\s]+/g)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t && t.includes("@") && !t.includes("(") && !t.includes(")"));

  return Array.from(new Set(tokens));
}

/* ─── CSV parser (semicolon, handles quoted fields) ─── */
function parseCSVLine(line: string): string[] {
  // Fast path for most rows (no quoted fields)
  if (!line.includes('"')) {
    return line.split(";").map((field) => field.trim());
  }

  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ";" && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function normalizeColName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function buildColumnMap(headerFields: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (let i = 0; i < headerFields.length; i++) {
    const raw = headerFields[i].replace(/^"|"$/g, "").trim();
    map[raw] = i;
    const norm = normalizeColName(raw);
    if (norm && !(norm in map)) map[norm] = i;
  }
  return map;
}

// Cache resolved column indexes per column map to avoid repeated normalize/lookups per row
const columnIndexCache = new WeakMap<Record<string, number>, Map<string, number>>();

function col(row: string[], colMap: Record<string, number>, name: string): string {
  let cache = columnIndexCache.get(colMap);
  if (!cache) {
    cache = new Map<string, number>();
    columnIndexCache.set(colMap, cache);
  }

  let idx = cache.get(name);
  if (idx === undefined) {
    const direct = colMap[name];
    const normalized = direct === undefined ? colMap[normalizeColName(name)] : direct;
    idx = normalized === undefined ? -1 : normalized;
    cache.set(name, idx);
  }

  if (idx < 0 || idx >= row.length) return "";
  return row[idx]?.replace(/^"|"$/g, "").trim() || "";
}

/* ─── Try multiple column name variants ─── */
function colAny(row: string[], colMap: Record<string, number>, ...names: string[]): string {
  for (const name of names) {
    const v = col(row, colMap, name);
    if (v) return v;
  }
  return "";
}

interface ProposalItem {
  item_id: string;
  nome: string;
  tipo: string;
  qtd: number;
  unit: number;
  total: number;
  categoria: string;
}

interface ProposalData {
  proposal_id: string;
  proposal_link: string;
  proposal_sigla: string;
  status: string;
  created_at: string;
  valor_ps: number;
  valor_mrr: number;
  parcelas: number;
  tipo_frete: string;
  valor_frete: number;
  vendedor: string;
  items: ProposalItem[];
}

interface DealData {
  deal_id: string;
  deal_link: string;
  funil: string;
  etapa: string;
  lead_timing: string;
  dono_email: string;
  dono_nome: string;
  origem: string;
  data_cadastro: string;
  data_fechamento: string;
  titulo: string;
  status: string;
  situacao: string;
  valor_ps_opp: number;
  valor_mrr_opp: number;
  tags: string;
  motivo_perda: string;
  comentario_perda: string;
  proposals: ProposalData[];
  pessoa_id: string;
  pessoa_nome: string;
  pessoa_cpf: string;
  pessoa_email: string;
  pessoa_telefone: string;
  pessoa_cidade: string;
  pessoa_uf: string;
  empresa_id: string;
  empresa_nome: string;
  empresa_cnpj: string;
  empresa_cidade: string;
  empresa_uf: string;
  empresa_segmento: string;
  especialidade: string;
  area_atuacao: string;
  produto_interesse: string;
  tem_impressora: string;
  tem_scanner: string;
}

function buildDealSnapshot(deal: DealData) {
  const totalProposalsValue = deal.proposals.reduce((s, p) => s + p.valor_ps, 0);
  const totalFreight = deal.proposals.reduce((s, p) => s + p.valor_frete, 0);
  const totalMRR = deal.proposals.reduce((s, p) => s + p.valor_mrr, 0);
  const allItems = deal.proposals.flatMap((p) => p.items);
  const sorted = [...allItems].sort((a, b) => b.total - a.total);
  const mainProduct = sorted[0]?.nome || null;

  return {
    deal_id: deal.deal_id,
    pipeline_name: deal.funil,
    stage_name: deal.etapa,
    status: deal.status || "Aberta",
    situacao: deal.situacao,
    value: totalProposalsValue || deal.valor_ps_opp || 0,
    value_products: totalProposalsValue - totalFreight,
    value_freight: totalFreight,
    value_mrr: totalMRR || deal.valor_mrr_opp || 0,
    product: mainProduct,
    owner_name: deal.dono_nome,
    owner_email: deal.dono_email,
    origem: deal.origem,
    tags: deal.tags,
    motivo_perda: deal.motivo_perda,
    comentario_perda: deal.comentario_perda,
    created_at: deal.data_cadastro || null,
    closed_at: deal.data_fechamento || null,
    synced_at: new Date().toISOString(),
    proposals: deal.proposals.map((p) => ({
      id: p.proposal_id,
      sigla: p.proposal_sigla,
      status: p.status,
      valor_ps: p.valor_ps,
      valor_mrr: p.valor_mrr,
      parcelas: p.parcelas,
      tipo_frete: p.tipo_frete,
      valor_frete: p.valor_frete,
      vendedor: p.vendedor,
      items: p.items.map((it) => ({
        item_id: it.item_id,
        nome: it.nome,
        tipo: it.tipo,
        qtd: it.qtd,
        unit: it.unit,
        total: it.total,
        categoria: it.categoria,
      })),
    })),
  };
}

/* ─── Find deal ID column — tries multiple variants ─── */
function findDealId(row: string[], colMap: Record<string, number>): string {
  return colAny(row, colMap,
    "Hash (Oportunidade)",
    "ID (Oportunidade)",
    "Id (Oportunidade)",
    "id (oportunidade)",
  );
}

function parseDealFromRow(row: string[], colMap: Record<string, number>): {
  dealId: string;
  proposalId: string;
  deal: DealData;
  item: ProposalItem | null;
  proposal: ProposalData | null;
} | null {
  const dealId = findDealId(row, colMap);
  if (!dealId) return null;

  const proposalId = colAny(row, colMap, "ID", "Id", "ID (Proposta)", "Id (Proposta)");
  const itemId = colAny(row, colMap, "ID do item (Item)", "Id do item (Item)", "ID do Item (Item)");
  const itemName = colAny(row, colMap, "Nome do item (Item)", "Nome do Item (Item)");

  const deal: DealData = {
    deal_id: dealId,
    deal_link: colAny(row, colMap, "Link (Oportunidade)"),
    funil: colAny(row, colMap, "Funil (Oportunidade)"),
    etapa: colAny(row, colMap, "Etapa (Oportunidade)"),
    lead_timing: colAny(row, colMap, "Lead-Timing (Oportunidade)"),
    dono_email: colAny(row, colMap, "Dono da oportunidade (Oportunidade)"),
    dono_nome: colAny(row, colMap, "Nome do dono da oportunidade (Oportunidade)"),
    origem: colAny(row, colMap, "Origem (Oportunidade)"),
    data_cadastro: colAny(row, colMap, "Data de cadastro (Oportunidade)"),
    data_fechamento: colAny(row, colMap, "Data de fechamento (Oportunidade)"),
    titulo: colAny(row, colMap, "Titulo (Oportunidade)", "Título (Oportunidade)"),
    status: colAny(row, colMap, "Status (Oportunidade)"),
    situacao: colAny(row, colMap, "Situação (Oportunidade)", "Situacao (Oportunidade)"),
    valor_ps_opp: parseBRL(colAny(row, colMap, "Valor de P&S (Oportunidade)")),
    valor_mrr_opp: parseBRL(colAny(row, colMap, "Valor de MRR (Oportunidade)")),
    tags: colAny(row, colMap, "Tags (Oportunidade)"),
    motivo_perda: colAny(row, colMap, "(MP) Motivo de perda (Oportunidade)"),
    comentario_perda: colAny(row, colMap, "(MP) Comentário (Oportunidade)", "(MP) Comentario (Oportunidade)"),
    proposals: [],
    pessoa_id: colAny(row, colMap, "ID (Pessoa)", "Id (Pessoa)"),
    pessoa_nome: colAny(row, colMap, "Nome completo (Pessoa)"),
    pessoa_cpf: colAny(row, colMap, "CPF (Pessoa)"),
    pessoa_email: colAny(row, colMap, "E-mail (Pessoa)", "Email (Pessoa)"),
    pessoa_telefone: colAny(row, colMap, "Telefone Principal (Pessoa)", "Telefone principal (Pessoa)"),
    pessoa_cidade: colAny(row, colMap, "Endereço - Cidade (Pessoa)", "Endereco - Cidade (Pessoa)"),
    pessoa_uf: colAny(row, colMap, "Endereço - Estado (UF) (Pessoa)", "Endereco - Estado (UF) (Pessoa)"),
    empresa_id: colAny(row, colMap, "ID (Empresa)", "Id (Empresa)"),
    empresa_nome: colAny(row, colMap, "Nome fantasia (Empresa)"),
    empresa_cnpj: colAny(row, colMap, "CNPJ (Empresa)"),
    empresa_cidade: colAny(row, colMap, "Endereço - Cidade (Empresa)", "Endereco - Cidade (Empresa)"),
    empresa_uf: colAny(row, colMap, "Endereço - Estado (UF) (Empresa)", "Endereco - Estado (UF) (Empresa)"),
    empresa_segmento: colAny(row, colMap, "Segmento (Empresa)"),
    especialidade: colAny(row, colMap, "Especialidade", "Especialidade principal"),
    area_atuacao: colAny(row, colMap, "Área de Atuação", "ÁREA DE ATUAÇÃO", "Área de atuação", "Area de Atuacao"),
    produto_interesse: colAny(row, colMap, "Produto de interesse", "Produto de interesse (auto)"),
    tem_impressora: colAny(row, colMap, "Tem impressora"),
    tem_scanner: colAny(row, colMap, "Tem scanner"),
  };

  let proposal: ProposalData | null = null;
  if (proposalId) {
    proposal = {
      proposal_id: proposalId,
      proposal_link: colAny(row, colMap, "Link"),
      proposal_sigla: colAny(row, colMap, "Sigla"),
      status: colAny(row, colMap, "Status"),
      created_at: colAny(row, colMap, "Data de de criação", "Data de criação", "Data de criacao"),
      valor_ps: parseBRL(colAny(row, colMap, "Valor P&S")),
      valor_mrr: parseBRL(colAny(row, colMap, "Valor MRR")),
      parcelas: parseInt(colAny(row, colMap, "Forma de pgto P&S - Nro de parcelas")) || 0,
      tipo_frete: colAny(row, colMap, "Tipo de frete"),
      valor_frete: parseBRL(colAny(row, colMap, "Valor de frete")),
      vendedor: colAny(row, colMap, "Vendedor da proposta"),
      items: [],
    };
  }

  let item: ProposalItem | null = null;
  if (itemId && itemName) {
    item = {
      item_id: itemId,
      nome: itemName,
      tipo: colAny(row, colMap, "Tipo do item (Item)"),
      qtd: parseQty(colAny(row, colMap, "Quantidade (Item)")),
      unit: parseBRL(colAny(row, colMap, "Valor unitário (Item)", "Valor unitario (Item)")),
      total: parseBRL(colAny(row, colMap, "Total de P&S (Item)")),
      categoria: colAny(row, colMap, "Categoria (Item)"),
    };
  }

  return { dealId, proposalId, deal, item, proposal };
}

/* ─── Background processing function ─── */
async function processCSVInBackground(csvText: string) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const lines = csvText.split("\n").filter((l) => l.trim().length > 0);
    const headerFields = parseCSVLine(lines[0]);
    const colMap = buildColumnMap(headerFields);

    // Debug: log first 20 column names to identify mismatches
    const sampleCols = headerFields.slice(0, 30).map((h, i) => `${i}: "${h.replace(/^"|"$/g, "").trim()}"`);
    console.log(`[import-bg] Header sample: ${sampleCols.join(" | ")}`);

    // Debug: log all (Oportunidade) columns
    const oppCols = Object.keys(colMap).filter(k => k.includes("(Oportunidade)") || k.includes("(oportunidade)"));
    console.log(`[import-bg] Oportunidade columns: ${JSON.stringify(oppCols.slice(0, 20))}`);
    const hashCol = colMap["Hash (Oportunidade)"] ?? colMap[normalizeColName("Hash (Oportunidade)")];
    console.log(`[import-bg] "Hash (Oportunidade)" column index: ${hashCol}`);

    console.log(`[import-bg] Parsing ${lines.length - 1} rows, ${headerFields.length} columns`);

    // STEP 1: Group rows by deal_id (O(1) indices to avoid repeated linear scans)
    const dealMap = new Map<string, DealData>();
    const proposalIndexByDeal = new Map<string, Map<string, ProposalData>>();
    const itemIndexByProposal = new Map<string, Set<string>>();

    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      const parsed = parseDealFromRow(row, colMap);
      if (!parsed) continue;

      const { dealId, proposalId, deal, proposal, item } = parsed;

      if (!dealMap.has(dealId)) {
        dealMap.set(dealId, deal);
        proposalIndexByDeal.set(dealId, new Map<string, ProposalData>());
      }

      const existingDeal = dealMap.get(dealId)!;
      const proposalMap = proposalIndexByDeal.get(dealId)!;

      let targetProposal: ProposalData | undefined;
      if (proposal) {
        targetProposal = proposalMap.get(proposal.proposal_id);
        if (!targetProposal) {
          existingDeal.proposals.push(proposal);
          proposalMap.set(proposal.proposal_id, proposal);
          targetProposal = proposal;
        }
      }

      if (item && proposalId) {
        if (!targetProposal) {
          targetProposal = proposalMap.get(proposalId);
        }
        if (targetProposal) {
          const proposalKey = `${dealId}::${proposalId}`;
          let seenItems = itemIndexByProposal.get(proposalKey);
          if (!seenItems) {
            seenItems = new Set<string>();
            itemIndexByProposal.set(proposalKey, seenItems);
          }
          if (!seenItems.has(item.item_id)) {
            seenItems.add(item.item_id);
            targetProposal.items.push(item);
          }
        }
      }
    }

    console.log(`[import-bg] ${dealMap.size} unique deals parsed`);

    // STEP 2: Group deals by person
    interface PersonGroup {
      emails: string[];
      phone: string | null;
      pessoa_id: string;
      deals: DealData[];
    }

    const personMap = new Map<string, PersonGroup>();

    for (const deal of dealMap.values()) {
      const emails = extractEmails(deal.pessoa_email);
      const primaryEmail = emails[0] || "";
      const phone = normalizePhone(deal.pessoa_telefone);
      const groupKey = primaryEmail || (deal.pessoa_id ? `pessoa_${deal.pessoa_id}` : `deal_${deal.deal_id}`);

      if (!personMap.has(groupKey)) {
        personMap.set(groupKey, { emails: [...emails], phone, pessoa_id: deal.pessoa_id, deals: [] });
      } else if (emails.length) {
        const group = personMap.get(groupKey)!;
        group.emails = Array.from(new Set([...group.emails, ...emails]));
      }
      personMap.get(groupKey)!.deals.push(deal);
    }

    console.log(`[import-bg] ${personMap.size} unique persons/groups`);

    // STEP 3a: Collect unique identifiers from personMap (Sets avoid duplicate work)
    const emailSet = new Set<string>();
    const phoneSet = new Set<string>();
    const pessoaIdSet = new Set<number>();
    const dealIdSet = new Set<string>();

    for (const person of personMap.values()) {
      if (person.email && !person.email.includes("@import.local")) emailSet.add(person.email);
      if (person.phone) phoneSet.add(person.phone);
      if (person.pessoa_id) {
        const parsed = parseInt(person.pessoa_id);
        if (!isNaN(parsed)) pessoaIdSet.add(parsed);
      }
      for (const deal of person.deals) {
        if (deal.deal_id) dealIdSet.add(deal.deal_id);
      }
    }

    const allEmails = Array.from(emailSet);
    const allPhones = Array.from(phoneSet);
    const allPessoaIds = Array.from(pessoaIdSet);
    const allDealIds = Array.from(dealIdSet);

    console.log(`[import-bg] Identifiers: ${allEmails.length} emails, ${allPhones.length} phones, ${allPessoaIds.length} pessoa_ids, ${allDealIds.length} deal_ids`);

    // STEP 3b: Bulk queries with per-column chunking
    type LeadRow = {
      id: string;
      email: string | null;
      telefone_normalized: string | null;
      pessoa_piperun_id: number | null;
      piperun_id: string | null;
      piperun_deals_history: any;
    };

    const CHUNK_BY_COLUMN: Record<string, number> = {
      email: 500,
      telefone_normalized: 500,
      pessoa_piperun_id: 500,
      piperun_id: 100, // IDs hash deixam a URL do .in() muito grande
    };

    const allLeads = new Map<string, LeadRow>(); // id → lead

    async function bulkFetch(column: string, values: (string | number)[]) {
      if (!values.length) return;

      const unique = [...new Set(values)];
      const chunkSize = CHUNK_BY_COLUMN[column] ?? 500;

      for (let i = 0; i < unique.length; i += chunkSize) {
        const chunk = unique.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from("lia_attendances")
          .select("id, email, telefone_normalized, pessoa_piperun_id, piperun_id, piperun_deals_history")
          .in(column, chunk);

        if (error) {
          console.error(`[import-bg] Bulk fetch ${column} error: ${error.message}`);
          continue;
        }

        if (data) {
          for (const row of data) {
            allLeads.set(row.id, row as LeadRow);
          }
        }
      }
    }

    await Promise.all([
      bulkFetch("email", allEmails),
      bulkFetch("telefone_normalized", allPhones),
      bulkFetch("pessoa_piperun_id", allPessoaIds),
      bulkFetch("piperun_id", allDealIds),
    ]);

    console.log(`[import-bg] Bulk loaded ${allLeads.size} unique leads`);

    // STEP 3c: Build in-memory lookup maps
    const emailMap = new Map<string, LeadRow>();
    const phoneMap = new Map<string, LeadRow>();
    const pessoaIdMap = new Map<number, LeadRow>();
    const dealIdMap = new Map<string, LeadRow>();

    for (const lead of allLeads.values()) {
      if (lead.email) emailMap.set(lead.email.toLowerCase(), lead);
      if (lead.telefone_normalized) phoneMap.set(lead.telefone_normalized, lead);
      if (lead.pessoa_piperun_id) pessoaIdMap.set(lead.pessoa_piperun_id, lead);
      if (lead.piperun_id) dealIdMap.set(String(lead.piperun_id), lead);
    }

    // STEP 3d: Match in memory + aggregate by lead (reduce writes)
    let matched = 0;
    let enriched = 0;
    let skippedCount = 0;
    let errorCount = 0;

    interface PendingLeadUpdate {
      lead: LeadRow;
      deals: DealData[];
      refDeal: DealData;
      phone: string | null;
    }

    const pendingByLeadId = new Map<string, PendingLeadUpdate>();

    for (const person of personMap.values()) {
      let existingLead: LeadRow | undefined;

      // CASCADE: email → phone → pessoa_id → deal_id (all in-memory)
      if (!existingLead && person.email && !person.email.includes("@import.local")) {
        existingLead = emailMap.get(person.email);
      }
      if (!existingLead && person.phone) {
        existingLead = phoneMap.get(person.phone);
      }
      if (!existingLead && person.pessoa_id) {
        existingLead = pessoaIdMap.get(parseInt(person.pessoa_id));
      }
      if (!existingLead) {
        for (const deal of person.deals) {
          existingLead = dealIdMap.get(deal.deal_id);
          if (existingLead) break;
        }
      }

      if (!existingLead) {
        skippedCount++;
        continue;
      }

      matched++;

      const pending = pendingByLeadId.get(existingLead.id);
      if (pending) {
        pending.deals.push(...person.deals);
        if (!pending.phone && person.phone) pending.phone = person.phone;
      } else {
        pendingByLeadId.set(existingLead.id, {
          lead: existingLead,
          deals: [...person.deals],
          refDeal: person.deals[0],
          phone: person.phone,
        });
      }
    }

    console.log(
      `[import-bg] Matched groups=${matched}, unique leads to update=${pendingByLeadId.size}, skipped=${skippedCount}`
    );

    const updates: Record<string, any>[] = [];

    for (const pending of pendingByLeadId.values()) {
      try {
        const currentHistory = Array.isArray(pending.lead.piperun_deals_history)
          ? [...pending.lead.piperun_deals_history]
          : [];

        const historyIndex = new Map<string, number>();
        for (let i = 0; i < currentHistory.length; i++) {
          const dealId = currentHistory[i]?.deal_id;
          if (dealId !== undefined && dealId !== null) {
            historyIndex.set(String(dealId), i);
          }
        }

        for (const deal of pending.deals) {
          const snapshot = buildDealSnapshot(deal);
          const key = String(deal.deal_id);
          const existingIdx = historyIndex.get(key);

          if (existingIdx !== undefined) {
            currentHistory[existingIdx] = snapshot;
          } else {
            historyIndex.set(key, currentHistory.length);
            currentHistory.push(snapshot);
          }
        }

        const refDeal = pending.refDeal || pending.deals[0];
        const updatePayload: Record<string, any> = {
          id: pending.lead.id,
          piperun_deals_history: currentHistory,
          updated_at: new Date().toISOString(),
        };

        if (refDeal.pessoa_id) updatePayload.pessoa_piperun_id = parseInt(refDeal.pessoa_id);
        if (refDeal.empresa_id) updatePayload.empresa_piperun_id = parseInt(refDeal.empresa_id);
        if (refDeal.empresa_nome) updatePayload.empresa_nome = refDeal.empresa_nome;
        if (refDeal.empresa_cnpj) updatePayload.empresa_cnpj = refDeal.empresa_cnpj;
        if (refDeal.empresa_cidade) updatePayload.empresa_cidade = refDeal.empresa_cidade;
        if (refDeal.empresa_uf) updatePayload.empresa_uf = refDeal.empresa_uf;
        if (refDeal.empresa_segmento) updatePayload.empresa_segmento = refDeal.empresa_segmento;
        if (refDeal.pessoa_cidade) updatePayload.cidade = refDeal.pessoa_cidade;
        if (refDeal.pessoa_uf) updatePayload.uf = refDeal.pessoa_uf;
        if (refDeal.especialidade) updatePayload.especialidade = refDeal.especialidade;
        if (refDeal.area_atuacao) updatePayload.area_atuacao = refDeal.area_atuacao;
        if (refDeal.produto_interesse) updatePayload.produto_interesse = refDeal.produto_interesse;
        if (refDeal.motivo_perda) updatePayload.motivo_perda = refDeal.motivo_perda;
        if (refDeal.comentario_perda) updatePayload.comentario_perda = refDeal.comentario_perda;
        if (pending.phone) updatePayload.telefone_normalized = pending.phone;

        updatePayload.proposals_total_value = currentHistory.reduce(
          (s: number, d: any) => s + (d.value || 0),
          0
        );

        updates.push(updatePayload);
      } catch (e) {
        errorCount++;
        console.error(`[import-bg] Build update error for lead ${pending.lead.id}: ${e}`);
      }
    }

    const BATCH_SIZE = 50;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      const { error: batchErr } = await supabase
        .from("lia_attendances")
        .upsert(batch, { onConflict: "id" });

      if (batchErr) {
        errorCount += batch.length;
        console.error(
          `[import-bg] Batch upsert error (${i}-${i + batch.length - 1}): ${batchErr.message}`
        );
      } else {
        enriched += batch.length;
      }
    }

    console.log(`[import-bg] DONE: matched=${matched} enriched=${enriched} skipped=${skippedCount} errors=${errorCount}`);
  } catch (err) {
    console.error("[import-bg] Fatal:", err);
  }
}

/* ─── Main handler — returns immediately, processes in background ─── */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Read CSV
    const contentType = req.headers.get("content-type") || "";
    let csvText: string;
    if (contentType.includes("application/json")) {
      const body = await req.json();
      if (body.url) {
        const csvResp = await fetch(body.url);
        const rawBytes = new Uint8Array(await csvResp.arrayBuffer());
        csvText = new TextDecoder("latin1").decode(rawBytes);
      } else {
        csvText = body.csv || "";
      }
    } else {
      const rawBytes = new Uint8Array(await req.arrayBuffer());
      csvText = new TextDecoder("latin1").decode(rawBytes);
    }

    if (!csvText || csvText.length < 100) {
      return new Response(JSON.stringify({ error: "CSV text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lineCount = csvText.split("\n").filter((l) => l.trim().length > 0).length - 1;
    console.log(`[import-proposals] Received CSV with ~${lineCount} rows. Starting background processing...`);

    // Start background processing (non-blocking)
    EdgeRuntime.waitUntil(processCSVInBackground(csvText));

    // Return immediately
    return new Response(JSON.stringify({
      success: true,
      message: `Importação iniciada em background com ~${lineCount} linhas. Acompanhe os logs da Edge Function.`,
      total_csv_rows: lineCount,
      status: "processing",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[import-proposals] Fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
