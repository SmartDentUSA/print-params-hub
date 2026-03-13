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

/* ─── CSV parser (semicolon, handles quoted fields) ─── */
function parseCSVLine(line: string): string[] {
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
    if (norm && !map[norm]) map[norm] = i;
  }
  return map;
}

function col(row: string[], colMap: Record<string, number>, name: string): string {
  let idx = colMap[name];
  if (idx === undefined) idx = colMap[normalizeColName(name)];
  if (idx === undefined || idx >= row.length) return "";
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

    // Check if key column exists
    const dealIdCol = colMap["ID (Oportunidade)"] ?? colMap[normalizeColName("ID (Oportunidade)")];
    console.log(`[import-bg] "ID (Oportunidade)" column index: ${dealIdCol}`);
    if (dealIdCol === undefined) {
      // Try to find it by partial match
      const candidates = Object.keys(colMap).filter(k => k.toLowerCase().includes("oportunidade") && k.toLowerCase().includes("id"));
      console.log(`[import-bg] Candidate deal ID columns: ${JSON.stringify(candidates)}`);
    }

    console.log(`[import-bg] Parsing ${lines.length - 1} rows, ${headerFields.length} columns`);

    // STEP 1: Group rows by deal_id
    const dealMap = new Map<string, DealData>();

    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      const parsed = parseDealFromRow(row, colMap);
      if (!parsed) continue;

      const { dealId, proposalId, deal, proposal, item } = parsed;

      if (!dealMap.has(dealId)) {
        dealMap.set(dealId, deal);
      }

      const existingDeal = dealMap.get(dealId)!;

      if (proposal && !existingDeal.proposals.some((p) => p.proposal_id === proposal.proposal_id)) {
        existingDeal.proposals.push(proposal);
      }

      if (item && proposalId) {
        const targetProposal = existingDeal.proposals.find((p) => p.proposal_id === proposalId);
        if (targetProposal && !targetProposal.items.some((it) => it.item_id === item.item_id)) {
          targetProposal.items.push(item);
        }
      }
    }

    console.log(`[import-bg] ${dealMap.size} unique deals parsed`);

    // STEP 2: Group deals by person
    interface PersonGroup {
      email: string;
      phone: string | null;
      pessoa_id: string;
      deals: DealData[];
    }

    const personMap = new Map<string, PersonGroup>();

    for (const deal of dealMap.values()) {
      const email = deal.pessoa_email?.toLowerCase().trim() || "";
      const phone = normalizePhone(deal.pessoa_telefone);
      const groupKey = email || (deal.pessoa_id ? `pessoa_${deal.pessoa_id}` : `deal_${deal.deal_id}`);

      if (!personMap.has(groupKey)) {
        personMap.set(groupKey, { email, phone, pessoa_id: deal.pessoa_id, deals: [] });
      }
      personMap.get(groupKey)!.deals.push(deal);
    }

    console.log(`[import-bg] ${personMap.size} unique persons/groups`);

    // STEP 3: Match and enrich in batches
    let matched = 0;
    let enriched = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const [groupKey, person] of personMap) {
      try {
        let existingLead: { id: string; piperun_deals_history: any } | null = null;

        // CASCADE: email → phone → pessoa_piperun_id → piperun_id
        if (!existingLead && person.email && !person.email.includes("@import.local")) {
          const { data } = await supabase
            .from("lia_attendances")
            .select("id, piperun_deals_history")
            .eq("email", person.email)
            .limit(1)
            .maybeSingle();
          if (data) existingLead = data;
        }

        if (!existingLead && person.phone) {
          const { data } = await supabase
            .from("lia_attendances")
            .select("id, piperun_deals_history")
            .eq("telefone_normalized", person.phone)
            .limit(1)
            .maybeSingle();
          if (data) existingLead = data;
        }

        if (!existingLead && person.pessoa_id) {
          const { data } = await supabase
            .from("lia_attendances")
            .select("id, piperun_deals_history")
            .eq("pessoa_piperun_id", parseInt(person.pessoa_id))
            .limit(1)
            .maybeSingle();
          if (data) existingLead = data;
        }

        if (!existingLead) {
          for (const deal of person.deals) {
            const { data } = await supabase
              .from("lia_attendances")
              .select("id, piperun_deals_history")
              .eq("piperun_id", deal.deal_id)
              .maybeSingle();
            if (data) { existingLead = data; break; }
          }
        }

        if (!existingLead) {
          skippedCount++;
          continue;
        }

        matched++;

        // Merge deals into piperun_deals_history
        const currentHistory = Array.isArray(existingLead.piperun_deals_history)
          ? [...existingLead.piperun_deals_history]
          : [];

        for (const deal of person.deals) {
          const snapshot = buildDealSnapshot(deal);
          const existingIdx = currentHistory.findIndex(
            (d: any) => String(d.deal_id) === String(deal.deal_id)
          );
          if (existingIdx >= 0) {
            currentHistory[existingIdx] = snapshot;
          } else {
            currentHistory.push(snapshot);
          }
        }

        const refDeal = person.deals[0];
        const updatePayload: Record<string, any> = {
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
        if (person.phone) updatePayload.telefone_normalized = person.phone;

        updatePayload.proposals_total_value = currentHistory.reduce(
          (s: number, d: any) => s + (d.value || 0), 0
        );

        const { error: updateErr } = await supabase
          .from("lia_attendances")
          .update(updatePayload)
          .eq("id", existingLead.id);

        if (updateErr) {
          errorCount++;
          console.error(`[import-bg] Update error for ${groupKey}: ${updateErr.message}`);
        } else {
          enriched++;
        }
      } catch (e) {
        errorCount++;
        console.error(`[import-bg] Error for ${groupKey}: ${e}`);
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
