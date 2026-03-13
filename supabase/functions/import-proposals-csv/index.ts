import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ─── Parse BRL currency string to number ─── */
function parseBRL(raw: string | undefined): number {
  if (!raw) return 0;
  // "R$ 1.859,00" → 1859.00
  const cleaned = raw.replace(/R\$\s*/g, "").replace(/\./g, "").replace(",", ".").trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

/* ─── Parse quantity (Brazilian decimal) ─── */
function parseQty(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(",", ".").trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

/* ─── Phone normalizer ─── */
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

/* ─── Normalize column name for fuzzy matching ─── */
function normalizeColName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^\x20-\x7E]/g, "") // strip non-ASCII
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

/* ─── Column name → index mapping (with normalized keys) ─── */
function buildColumnMap(headerFields: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (let i = 0; i < headerFields.length; i++) {
    const raw = headerFields[i].replace(/^"|"$/g, "").trim();
    map[raw] = i;
    // Also store normalized version
    const norm = normalizeColName(raw);
    if (norm && !map[norm]) map[norm] = i;
  }
  return map;
}

function col(row: string[], colMap: Record<string, number>, name: string): string {
  let idx = colMap[name];
  if (idx === undefined) {
    // Try normalized version
    idx = colMap[normalizeColName(name)];
  }
  if (idx === undefined || idx >= row.length) return "";
  return row[idx]?.replace(/^"|"$/g, "").trim() || "";
}

/* ─── Interfaces ─── */
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
  // Person
  pessoa_id: string;
  pessoa_nome: string;
  pessoa_cpf: string;
  pessoa_email: string;
  pessoa_telefone: string;
  pessoa_cidade: string;
  pessoa_uf: string;
  // Company
  empresa_id: string;
  empresa_nome: string;
  empresa_cnpj: string;
  empresa_cidade: string;
  empresa_uf: string;
  empresa_segmento: string;
  // Custom fields
  especialidade: string;
  area_atuacao: string;
  produto_interesse: string;
  tem_impressora: string;
  tem_scanner: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Accept CSV as text body or JSON with { csv: "..." }
    // Handle Latin-1/Windows-1252 encoding from PipeRun export
    const contentType = req.headers.get("content-type") || "";
    let csvText: string;
    if (contentType.includes("application/json")) {
      const body = await req.json();
      csvText = body.csv || "";
    } else {
      // Try to decode as Latin-1 first (PipeRun exports use this encoding)
      const rawBytes = new Uint8Array(await req.arrayBuffer());
      try {
        csvText = new TextDecoder("latin1").decode(rawBytes);
      } catch {
        csvText = new TextDecoder("utf-8").decode(rawBytes);
      }
    }

    if (!csvText || csvText.length < 100) {
      return new Response(JSON.stringify({ error: "CSV text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse CSV
    const lines = csvText.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return new Response(JSON.stringify({ error: "CSV must have header + data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headerFields = parseCSVLine(lines[0]);
    const colMap = buildColumnMap(headerFields);

    console.log(`[import-proposals] Parsed ${lines.length - 1} rows, ${headerFields.length} columns`);

    // Group rows by deal (Oportunidade ID)
    const dealMap = new Map<string, DealData>();

    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      const dealId = col(row, colMap, "ID (Oportunidade)");
      if (!dealId) continue;

      const proposalId = col(row, colMap, "ID");

      if (!dealMap.has(dealId)) {
        dealMap.set(dealId, {
          deal_id: dealId,
          deal_link: col(row, colMap, "Link (Oportunidade)"),
          funil: col(row, colMap, "Funil (Oportunidade)"),
          etapa: col(row, colMap, "Etapa (Oportunidade)"),
          lead_timing: col(row, colMap, "Lead-Timing (Oportunidade)"),
          dono_email: col(row, colMap, "Dono da oportunidade (Oportunidade)"),
          dono_nome: col(row, colMap, "Nome do dono da oportunidade (Oportunidade)"),
          origem: col(row, colMap, "Origem (Oportunidade)"),
          data_cadastro: col(row, colMap, "Data de cadastro (Oportunidade)"),
          data_fechamento: col(row, colMap, "Data de fechamento (Oportunidade)"),
          titulo: col(row, colMap, "Titulo (Oportunidade)"),
          status: col(row, colMap, "Status (Oportunidade)"),
          situacao: col(row, colMap, "Situação (Oportunidade)"),
          valor_ps_opp: parseBRL(col(row, colMap, "Valor de P&S (Oportunidade)")),
          valor_mrr_opp: parseBRL(col(row, colMap, "Valor de MRR (Oportunidade)")),
          tags: col(row, colMap, "Tags (Oportunidade)"),
          motivo_perda: col(row, colMap, "(MP) Motivo de perda (Oportunidade)"),
          comentario_perda: col(row, colMap, "(MP) Comentário (Oportunidade)"),
          proposals: [],
          pessoa_id: col(row, colMap, "ID (Pessoa)"),
          pessoa_nome: col(row, colMap, "Nome completo (Pessoa)"),
          pessoa_cpf: col(row, colMap, "CPF (Pessoa)"),
          pessoa_email: col(row, colMap, "E-mail (Pessoa)"),
          pessoa_telefone: col(row, colMap, "Telefone Principal (Pessoa)"),
          pessoa_cidade: col(row, colMap, "Endereço - Cidade (Pessoa)"),
          pessoa_uf: col(row, colMap, "Endereço - Estado (UF) (Pessoa)"),
          empresa_id: col(row, colMap, "ID (Empresa)"),
          empresa_nome: col(row, colMap, "Nome fantasia (Empresa)"),
          empresa_cnpj: col(row, colMap, "CNPJ (Empresa)"),
          empresa_cidade: col(row, colMap, "Endereço - Cidade (Empresa)"),
          empresa_uf: col(row, colMap, "Endereço - Estado (UF) (Empresa)"),
          empresa_segmento: col(row, colMap, "Segmento (Empresa)"),
          especialidade: col(row, colMap, "Especialidade") || col(row, colMap, "Especialidade principal"),
          area_atuacao: col(row, colMap, "Área de Atuação") || col(row, colMap, "ÁREA DE ATUAÇÃO") || col(row, colMap, "Área de atuação"),
          produto_interesse: col(row, colMap, "Produto de interesse") || col(row, colMap, "Produto de interesse (auto)"),
          tem_impressora: col(row, colMap, "Tem impressora"),
          tem_scanner: col(row, colMap, "Tem scanner"),
        });
      }

      const deal = dealMap.get(dealId)!;

      // Add proposal (dedup by proposal_id)
      if (proposalId && !deal.proposals.some((p) => p.proposal_id === proposalId)) {
        const proposal: ProposalData = {
          proposal_id: proposalId,
          proposal_link: col(row, colMap, "Link"),
          proposal_sigla: col(row, colMap, "Sigla"),
          status: col(row, colMap, "Status"),
          created_at: col(row, colMap, "Data de de criação"),
          valor_ps: parseBRL(col(row, colMap, "Valor P&S")),
          valor_mrr: parseBRL(col(row, colMap, "Valor MRR")),
          parcelas: parseInt(col(row, colMap, "Forma de pgto P&S - Nro de parcelas")) || 0,
          tipo_frete: col(row, colMap, "Tipo de frete"),
          valor_frete: parseBRL(col(row, colMap, "Valor de frete")),
          vendedor: col(row, colMap, "Vendedor da proposta"),
          items: [],
        };
        deal.proposals.push(proposal);
      }

      // Add item to proposal
      const itemId = col(row, colMap, "ID do item (Item)");
      const itemName = col(row, colMap, "Nome do item (Item)");
      if (itemId && itemName && proposalId) {
        const proposal = deal.proposals.find((p) => p.proposal_id === proposalId);
        if (proposal && !proposal.items.some((it) => it.item_id === itemId)) {
          proposal.items.push({
            item_id: itemId,
            nome: itemName,
            tipo: col(row, colMap, "Tipo do item (Item)"),
            qtd: parseQty(col(row, colMap, "Quantidade (Item)")),
            unit: parseBRL(col(row, colMap, "Valor unitário (Item)")),
            total: parseBRL(col(row, colMap, "Total de P&S (Item)")),
            categoria: col(row, colMap, "Categoria (Item)"),
          });
        }
      }
    }

    console.log(`[import-proposals] ${dealMap.size} unique deals found`);

    // Process each deal: match to lia_attendances and enrich
    let matched = 0;
    let created = 0;
    let enriched = 0;
    let notFound = 0;
    const errors: { deal_id: string; error: string }[] = [];

    for (const [dealId, deal] of dealMap) {
      try {
        // Calculate total value from proposals
        const totalProposalsValue = deal.proposals.reduce((sum, p) => sum + p.valor_ps, 0);
        const totalFreight = deal.proposals.reduce((sum, p) => sum + p.valor_frete, 0);
        const totalMRR = deal.proposals.reduce((sum, p) => sum + p.valor_mrr, 0);

        // Determine main product from items
        const allItems = deal.proposals.flatMap((p) => p.items);
        let mainProduct: string | null = null;
        if (allItems.length > 0) {
          // Product with highest total value
          const sorted = [...allItems].sort((a, b) => b.total - a.total);
          mainProduct = sorted[0]?.nome || null;
        }

        // Build deal snapshot for piperun_deals_history
        const dealSnapshot = {
          deal_id: dealId,
          pipeline_name: deal.funil,
          stage_name: deal.etapa,
          status: deal.status || "Aberta",
          value: totalProposalsValue || deal.valor_ps_opp || 0,
          value_products: totalProposalsValue - totalFreight,
          value_freight: totalFreight,
          value_mrr: totalMRR || deal.valor_mrr_opp || 0,
          product: mainProduct,
          owner_name: deal.dono_nome,
          created_at: deal.data_cadastro || null,
          closed_at: deal.data_fechamento || null,
          synced_at: new Date().toISOString(),
          proposals: deal.proposals.map((p) => ({
            id: p.proposal_id,
            sigla: p.proposal_sigla,
            valor_ps: p.valor_ps,
            valor_mrr: p.valor_mrr,
            parcelas: p.parcelas,
            tipo_frete: p.tipo_frete,
            valor_frete: p.valor_frete,
            items: p.items.map((it) => ({
              nome: it.nome,
              qtd: it.qtd,
              unit: it.unit,
              total: it.total,
            })),
          })),
        };

        // ─── Match cascade: piperun_id → pessoa_piperun_id → email → phone ───
        let existingLead: { id: string; piperun_deals_history: any } | null = null;

        // 1) By piperun_id (deal ID)
        const { data: byDeal } = await supabase
          .from("lia_attendances")
          .select("id, piperun_deals_history")
          .eq("piperun_id", dealId)
          .maybeSingle();
        if (byDeal) existingLead = byDeal;

        // 2) By pessoa_piperun_id
        if (!existingLead && deal.pessoa_id) {
          const { data: byPerson } = await supabase
            .from("lia_attendances")
            .select("id, piperun_deals_history")
            .eq("pessoa_piperun_id", parseInt(deal.pessoa_id))
            .limit(1)
            .maybeSingle();
          if (byPerson) existingLead = byPerson;
        }

        // 3) By email
        const email = deal.pessoa_email?.toLowerCase().trim();
        if (!existingLead && email) {
          const { data: byEmail } = await supabase
            .from("lia_attendances")
            .select("id, piperun_deals_history")
            .eq("email", email)
            .limit(1)
            .maybeSingle();
          if (byEmail) existingLead = byEmail;
        }

        // 4) By phone
        const phone = normalizePhone(deal.pessoa_telefone);
        if (!existingLead && phone) {
          const { data: byPhone } = await supabase
            .from("lia_attendances")
            .select("id, piperun_deals_history")
            .eq("telefone_normalized", phone)
            .limit(1)
            .maybeSingle();
          if (byPhone) existingLead = byPhone;
        }

        if (existingLead) {
          matched++;

          // Merge deal into history (dedup by deal_id)
          const currentHistory = Array.isArray(existingLead.piperun_deals_history)
            ? existingLead.piperun_deals_history
            : [];
          const existingIdx = currentHistory.findIndex(
            (d: any) => String(d.deal_id) === String(dealId)
          );
          if (existingIdx >= 0) {
            currentHistory[existingIdx] = dealSnapshot;
          } else {
            currentHistory.push(dealSnapshot);
          }

          // Build enrichment payload
          const updatePayload: Record<string, any> = {
            piperun_deals_history: currentHistory,
            updated_at: new Date().toISOString(),
          };

          // Enrich identity fields (COALESCE — only set if currently null)
          if (deal.pessoa_id) updatePayload.pessoa_piperun_id = parseInt(deal.pessoa_id);
          if (deal.empresa_id) updatePayload.empresa_piperun_id = parseInt(deal.empresa_id);
          if (deal.empresa_nome) updatePayload.empresa_nome = deal.empresa_nome;
          if (deal.empresa_cnpj) updatePayload.empresa_cnpj = deal.empresa_cnpj;
          if (deal.empresa_cidade) updatePayload.empresa_cidade = deal.empresa_cidade;
          if (deal.empresa_uf) updatePayload.empresa_uf = deal.empresa_uf;
          if (deal.empresa_segmento) updatePayload.empresa_segmento = deal.empresa_segmento;
          if (deal.pessoa_cidade) updatePayload.cidade = deal.pessoa_cidade;
          if (deal.pessoa_uf) updatePayload.uf = deal.pessoa_uf;
          if (deal.especialidade) updatePayload.especialidade = deal.especialidade;
          if (deal.area_atuacao) updatePayload.area_atuacao = deal.area_atuacao;
          if (deal.produto_interesse) updatePayload.produto_interesse = deal.produto_interesse;
          if (deal.motivo_perda) updatePayload.motivo_perda = deal.motivo_perda;
          if (deal.comentario_perda) updatePayload.comentario_perda = deal.comentario_perda;
          if (phone) updatePayload.telefone_normalized = phone;

          // Proposals aggregate
          updatePayload.proposals_total_value = currentHistory.reduce(
            (s: number, d: any) => s + (d.value || 0), 0
          );

          const { error: updateErr } = await supabase
            .from("lia_attendances")
            .update(updatePayload)
            .eq("id", existingLead.id);

          if (updateErr) {
            errors.push({ deal_id: dealId, error: updateErr.message });
          } else {
            enriched++;
          }
        } else {
          // Create new lead from proposal data
          const nome = deal.pessoa_nome || deal.titulo || `Deal #${dealId}`;
          const insertPayload: Record<string, any> = {
            nome,
            email: email || `piperun_deal_${dealId}@import.local`,
            telefone_normalized: phone,
            piperun_id: dealId,
            source: "piperun_proposals_csv",
            piperun_deals_history: [dealSnapshot],
            pessoa_piperun_id: deal.pessoa_id ? parseInt(deal.pessoa_id) : null,
            empresa_piperun_id: deal.empresa_id ? parseInt(deal.empresa_id) : null,
            empresa_nome: deal.empresa_nome || null,
            empresa_cnpj: deal.empresa_cnpj || null,
            empresa_cidade: deal.empresa_cidade || null,
            empresa_uf: deal.empresa_uf || null,
            empresa_segmento: deal.empresa_segmento || null,
            cidade: deal.pessoa_cidade || null,
            uf: deal.pessoa_uf || null,
            especialidade: deal.especialidade || null,
            area_atuacao: deal.area_atuacao || null,
            produto_interesse: deal.produto_interesse || null,
            proprietario_lead_crm: deal.dono_email || null,
            proposals_total_value: totalProposalsValue,
          };

          const { error: insertErr } = await supabase
            .from("lia_attendances")
            .insert(insertPayload);

          if (insertErr) {
            if (insertErr.code === "23505") {
              // Duplicate — try update by email
              const { error: updateErr } = await supabase
                .from("lia_attendances")
                .update({
                  piperun_deals_history: [dealSnapshot],
                  piperun_id: dealId,
                  updated_at: new Date().toISOString(),
                })
                .eq("email", insertPayload.email);
              if (!updateErr) { matched++; enriched++; }
              else errors.push({ deal_id: dealId, error: updateErr.message });
            } else {
              errors.push({ deal_id: dealId, error: insertErr.message });
            }
          } else {
            created++;
          }
          notFound++;
        }
      } catch (e) {
        errors.push({ deal_id: dealId, error: String(e) });
      }
    }

    const result = {
      success: true,
      total_csv_rows: lines.length - 1,
      total_deals: dealMap.size,
      matched,
      enriched,
      created,
      not_found: notFound - created,
      errors_count: errors.length,
      errors: errors.slice(0, 20),
    };

    console.log(`[import-proposals] Result:`, JSON.stringify(result));

    return new Response(JSON.stringify(result), {
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
