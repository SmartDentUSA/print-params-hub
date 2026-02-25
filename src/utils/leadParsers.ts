/**
 * Client-side lead parsers — normalize each source's columns
 * into the lia_attendances schema before sending to import-leads-csv edge function.
 */

type RawRow = Record<string, unknown>;
type NormalizedLead = Record<string, unknown>;

/* ─── Phone helpers ─── */
function cleanPhone(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  let s = String(v);
  // Scientific notation fix (e.g. 5.51399E+12)
  if (s.includes("E+") || s.includes("e+")) {
    s = Number(s).toFixed(0);
  }
  const digits = s.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

function cleanEmail(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  if (s === "#n/a" || s === "n/a" || s === "-" || s === "" || !s.includes("@")) return null;
  return s;
}

function cleanMoney(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function cleanStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s === "#N/A" || s === "-" ? null : s;
}

/* ─── PARSER: master (PipeRun 60+ columns) ─── */
function parseMaster(rows: RawRow[]): NormalizedLead[] {
  return rows.map((r) => ({
    nome: cleanStr(r["NOME"] || r["nome"] || r["Nome do contato"] || r["Titulo"]) || "Sem Nome",
    email: cleanEmail(r["EMAIL"] || r["email"] || r["Email"]),
    telefone_raw: cleanPhone(r["TELEFONE"] || r["telefone"] || r["Telefone"]),
    source: "piperun",
    lead_status: cleanStr(r["Status"] || r["STATUS"] || r["Etapa atual"]) || "novo",
    proprietario_lead_crm: cleanStr(r["Proprietário"] || r["proprietario"] || r["Dono"]),
    piperun_id: cleanStr(r["ID"] || r["id"] || r["Id da oportunidade"]),
    status_oportunidade: cleanStr(r["Status da oportunidade"] || r["status_oportunidade"]),
    valor_oportunidade: cleanMoney(r["Valor"] || r["valor"] || r["Valor da oportunidade"]),
    produto_interesse: cleanStr(r["Produto de interesse"] || r["produto_interesse"]),
    temperatura_lead: cleanStr(r["Temperatura"] || r["temperatura_lead"]),
    funil_entrada_crm: cleanStr(r["Funil"] || r["funil_entrada_crm"]),
    ultima_etapa_comercial: cleanStr(r["Etapa atual"] || r["ultima_etapa_comercial"]),
    cidade: cleanStr(r["Cidade"] || r["cidade"]),
    uf: cleanStr(r["Estado"] || r["UF"] || r["uf"]),
    tags_crm: r["Tags"] ? String(r["Tags"]).split(",").map((t) => t.trim()).filter(Boolean) : null,
    data_fechamento_crm: cleanStr(r["Data de fechamento"] || r["data_fechamento_crm"]),
    itens_proposta_crm: cleanStr(r["Itens da proposta"] || r["itens_proposta_crm"]),
    piperun_link: cleanStr(r["Link PipeRun"] || r["piperun_link"]),
    motivo_perda: cleanStr(r["Motivo de perda"] || r["motivo_perda"]),
    comentario_perda: cleanStr(r["Comentário de perda"] || r["comentario_perda"]),
    area_atuacao: cleanStr(r["Área de atuação"] || r["area_atuacao"]),
    especialidade: cleanStr(r["Especialidade"] || r["especialidade"]),
    utm_source: cleanStr(r["utm_source"]),
    utm_medium: cleanStr(r["utm_medium"]),
    utm_campaign: cleanStr(r["utm_campaign"]),
    origem_campanha: cleanStr(r["Origem"] || r["origem_campanha"]),
  }));
}

/* ─── PARSER: manychat ─── */
function parseManychat(rows: RawRow[]): NormalizedLead[] {
  return rows.map((r) => ({
    nome: cleanStr(r["Full Name"] || r["First Name"]) || "Sem Nome",
    email: cleanEmail(r["Email"]),
    telefone_raw: cleanPhone(r["Phone"]),
    source: "manychat",
    tags_crm: r["Tags"] ? String(r["Tags"]).split(",").map((t) => t.trim()).filter(Boolean) : null,
    lead_status: "novo",
  }));
}

/* ─── PARSER: facebook (Ads API) ─── */
function parseFacebook(rows: RawRow[]): NormalizedLead[] {
  return rows.map((r) => {
    const formName = cleanStr(r["form_name"] || r["Form Name"] || r["Formulário"]);
    let produto = cleanStr(r["produto_interesse"]);
    if (!produto && formName) {
      const fl = formName.toLowerCase();
      if (fl.includes("resina") || fl.includes("vitality")) produto = "Resinas";
      else if (fl.includes("edgemini")) produto = "EdgeMini";
      else if (fl.includes("ioconnect")) produto = "IoConnect";
    }
    return {
      nome: cleanStr(r["full_name"] || r["Nome"] || r["nome"]) || "Sem Nome",
      email: cleanEmail(r["email"] || r["Email"]),
      telefone_raw: cleanPhone(r["phone_number"] || r["Telefone"]),
      source: "facebook_ads",
      form_name: formName,
      produto_interesse: produto,
      area_atuacao: cleanStr(r["AREA_ATUACAO"] || r["area_atuacao"] || r["Área de atuação?"]),
      como_digitaliza: cleanStr(r["COMO DIGITALIZA"] || r["como_digitaliza"]),
      tem_impressora: cleanStr(r["UTILIZA IMPRESSÕES 3D"] || r["tem_impressora"]),
      especialidade: cleanStr(r["Especialidade"] || r["especialidade"]),
      lead_status: "novo",
    };
  });
}

/* ─── PARSER: involveme ─── */
function parseInvolveme(rows: RawRow[]): NormalizedLead[] {
  return rows.map((r) => ({
    nome: cleanStr(r["Nome"] || r["name"] || r["Full Name"]) || "Sem Nome",
    email: cleanEmail(r["Email"] || r["email"]),
    telefone_raw: cleanPhone(r["Telefone"] || r["phone"] || r["WhatsApp"]),
    source: "involveme",
    produto_interesse: cleanStr(r["Qual equipamento"] || r["produto_interesse"]),
    area_atuacao: cleanStr(r["Área de atuação"] || r["area_atuacao"]),
    especialidade: cleanStr(r["Especialidade"] || r["especialidade"]),
    lead_status: "novo",
    raw_payload: r,
  }));
}

/* ─── PARSER: resin_clients ─── */
function parseResinClients(rows: RawRow[]): NormalizedLead[] {
  return rows.map((r) => {
    const nome = cleanStr(r["CLIENTES"] || r["Cliente"] || r["Nome"]);
    return {
      nome: nome || "Sem Nome",
      email: cleanEmail(r["Email"] || r["email"]),
      telefone_raw: cleanPhone(r["Telefone"] || r["telefone"]),
      source: "resin_clients",
      valor_oportunidade: cleanMoney(r["Valor"] || r["valor"]),
      proprietario_lead_crm: cleanStr(r["Vendedor"] || r["vendedor"]),
      cidade: cleanStr(r["Cidade"] || r["cidade"]),
      uf: cleanStr(r["Estado"] || r["estado"] || r["UF"]),
      lead_status: "contato_feito",
      produto_interesse: "Resinas",
      ativo_insumos: true,
    };
  });
}

/* ─── PARSER: scanner_owners ─── */
function parseScannerOwners(rows: RawRow[]): NormalizedLead[] {
  return rows.map((r) => ({
    nome: cleanStr(r["NOME"] || r["Nome"]) || "Sem Nome",
    email: cleanEmail(r["EMAIL"] || r["Email"]),
    telefone_raw: cleanPhone(r["TELEFONE"] || r["Telefone"]),
    source: "scanner_owners",
    como_digitaliza: cleanStr(r["DESCRICAO"] || r["Descrição"]),
    produto_interesse: cleanStr(r["MODELO"] || r["Modelo"]) || "Scanner",
    tem_scanner: "sim",
    ativo_scan: true,
    lead_status: "contato_feito",
  }));
}

/* ─── PARSER: facebook_kommo ─── */
function parseFacebookKommo(rows: RawRow[]): NormalizedLead[] {
  const stageMap: Record<string, string> = {
    "Inicial": "novo",
    "Negociação": "negociacao",
    "Decisão": "fechamento",
    "Compra": "fechamento",
    "Pós-venda": "contato_feito",
  };
  return rows.map((r) => {
    const stage = cleanStr(r["Estágio"] || r["Estagio"]);
    const labels = cleanStr(r["Rótulos"] || r["Rotulos"]);
    return {
      nome: cleanStr(r["Nome"] || r["nome"]) || "Sem Nome",
      email: cleanEmail(r["Email"] || r["email"]),
      telefone_raw: cleanPhone(r["Telefone"] || r["telefone"]),
      source: cleanStr(r["Fonte"] || r["fonte"]) || "facebook_kommo",
      form_name: cleanStr(r["Formulário"] || r["Formulario"]),
      proprietario_lead_crm: cleanStr(r["Proprietário"] || r["Proprietario"]),
      lead_status: (stage && stageMap[stage]) || "novo",
      tags_crm: labels ? labels.split(",").map((t) => t.trim()).filter(Boolean) : null,
      produto_interesse: "Resinas",
    };
  });
}

/* ─── PARSER: hadron_vendas (ERP — aggregate by email client-side) ─── */
function parseHadronVendas(rows: RawRow[]): NormalizedLead[] {
  // Group by email
  const groups: Record<string, NormalizedLead> = {};

  for (const r of rows) {
    const email = cleanEmail(r["EMAIL"] || r["Email"] || r["email"]);
    const nome = cleanStr(r["CLIENTE"] || r["Cliente"] || r["Nome"]);
    const key = email || nome || "";
    if (!key) continue;

    if (!groups[key]) {
      groups[key] = {
        nome: nome || "Sem Nome",
        email: email,
        telefone_raw: cleanPhone(r["TELEFONE"] || r["Telefone"]),
        source: "hadron_vendas",
        lead_status: "contato_feito",
        valor_oportunidade: 0,
        status_oportunidade: "ganha",
      };
    }

    // Sum values
    const val = cleanMoney(r["VALOR TOTAL"] || r["Valor Total"] || r["valor"]);
    if (val) (groups[key].valor_oportunidade as number) += val;

    // Detect product flags from NOME GRUPO
    const grupo = cleanStr(r["NOME GRUPO"] || r["Nome Grupo"] || r["Grupo"])?.toLowerCase() || "";
    if (grupo.includes("scan")) groups[key].ativo_scan = true;
    if (grupo.includes("notebook")) groups[key].ativo_notebook = true;
    if (grupo.includes("cad") && !grupo.includes("cad_ia")) groups[key].ativo_cad = true;
    if (grupo.includes("cad_ia") || grupo.includes("cadia")) groups[key].ativo_cad_ia = true;
    if (grupo.includes("smart") || grupo.includes("slice")) groups[key].ativo_smart_slice = true;
    if (grupo.includes("print") || grupo.includes("impressora")) groups[key].ativo_print = true;
    if (grupo.includes("cura")) groups[key].ativo_cura = true;
    if (grupo.includes("resina") || grupo.includes("insumo")) groups[key].ativo_insumos = true;
  }

  return Object.values(groups);
}

/* ─── PARSER: omie_vendas (ERP 2025 — aggregate by nome) ─── */
function parseOmieVendas(rows: RawRow[]): NormalizedLead[] {
  // Fill-down vendedor
  let lastVendedor = "";
  const filled = rows.map((r) => {
    const vend = cleanStr(r["Vendedor"] || r["vendedor"]);
    if (vend) lastVendedor = vend.replace(/^\d+\s*-\s*/, "").trim(); // "1 - MMTECH" → "MMTECH"
    return { ...r, _vendedor: lastVendedor };
  });

  // Group by client name
  const groups: Record<string, NormalizedLead> = {};
  for (const r of filled) {
    const nome = cleanStr(r["Cliente"] || r["cliente"] || r["Nome"]);
    if (!nome) continue;
    const key = nome.toLowerCase();

    if (!groups[key]) {
      groups[key] = {
        nome,
        email: cleanEmail(r["Email"] || r["email"]),
        source: "omie_vendas",
        lead_status: "contato_feito",
        proprietario_lead_crm: r._vendedor || null,
        valor_oportunidade: 0,
        status_oportunidade: "ganha",
      };
    }

    const val = cleanMoney(r["Valor Total"] || r["valor_total"] || r["Valor"]);
    if (val) (groups[key].valor_oportunidade as number) += val;
  }

  return Object.values(groups);
}

/* ─── PARSER: piperun_estagnados (Funil Estagnados export) ─── */
function parsePiperunEstagnados(rows: RawRow[]): NormalizedLead[] {
  const stageMap: Record<string, string> = {
    "Etapa 01 - Reativação": "est_etapa1",
    "Etapa 01 - Reativção": "est_etapa1",  // typo in source
    "Etapa 02 - Reativação": "est_etapa2",
    "Etapa 02 - Reativção": "est_etapa2",
    "Etapa 03 - Reativação": "est_etapa3",
    "Etapa 03 - Reativção": "est_etapa3",
    "Etapa 04 - Reativação": "est_etapa4",
    "Etapa 04 - Reativção": "est_etapa4",
    "Proposta Enviada - Estag": "est_proposta",
    "Proposta Enviada - Estagnado": "est_proposta",
  };

  return rows.map((r) => {
    const titulo = cleanStr(r["Titulo"] || r["Título"]);
    // Extract name from "Nome - 2026-02-01 ..." pattern
    const nome = titulo?.split(" - 20")[0]?.trim() || titulo || "Sem Nome";
    const etapa = cleanStr(r["Etapa"]);
    const leadTiming = r["Lead-Timing"];

    return {
      nome,
      email: cleanEmail(r["E-mail (Pessoa)"] || r["Email (Pessoa)"]),
      telefone_raw: cleanPhone(r["Telefone (Pessoa)"] || r["Telefone Principal (Pessoa)"]),
      source: "piperun",
      lead_status: (etapa && stageMap[etapa]) || "est_etapa1",
      proprietario_lead_crm: cleanStr(r["Nome do dono da oportunidade"]),
      piperun_id: cleanStr(r["ID"]),
      piperun_link: cleanStr(r["Link"]),
      lead_timing_dias: leadTiming != null ? Number(leadTiming) || null : null,
      funil_entrada_crm: "Funil Estagnados",
      produto_interesse: cleanStr(r["Produto de interesse"]),
      area_atuacao: cleanStr(r["Área de Atuação"] || r["ÁREA DE ATUAÇÃO"] || r["Area de Atuação"]),
      especialidade: cleanStr(r["Especialidade"] || r["Especialidade principal"]),
      valor_oportunidade: cleanMoney(r["Valor de P&S"]),
      cidade: cleanStr(r["Endereço - Cidade (Pessoa)"]),
      uf: cleanStr(r["Endereço - Estado (UF) (Pessoa)"]),
    };
  });
}

/* ─── PARSER: piperun_full (Export completo — todos os funis) ─── */
function parsePiperunFull(rows: RawRow[]): NormalizedLead[] {
  function resolveStatus(funil: string | null, etapa: string | null): string {
    if (!funil || !etapa) return "novo";
    const fl = funil.trim();
    const el = etapa.trim();
    const vendasMap: Record<string, string> = {
      "Sem contato": "sem_contato", "Contato Feito": "contato_feito",
      "Em Contato": "em_contato", "Apresentação/Visita": "apresentacao",
      "Proposta Enviada": "proposta_enviada", "Negociação": "negociacao",
      "Fechamento": "fechamento",
    };
    if (fl.toLowerCase().includes("vendas")) return vendasMap[el] || "novo";
    if (fl.toLowerCase().includes("estagnado") || fl.toLowerCase().includes("stagnado")) {
      if (el.startsWith("Etapa 01")) return "est_etapa1";
      if (el.startsWith("Etapa 02")) return "est_etapa2";
      if (el.startsWith("Etapa 03")) return "est_etapa3";
      if (el.startsWith("Etapa 04")) return "est_etapa4";
      if (el.toLowerCase().includes("proposta")) return "est_proposta";
      if (el.toLowerCase().includes("apresenta")) return "est_apresentacao";
      return "est_etapa1";
    }
    if (fl.includes("CS") || fl.toLowerCase().includes("onboarding")) {
      if (el.toLowerCase().includes("espera")) return "cs_em_espera";
      return "cs_agendar";
    }
    if (fl.toLowerCase().includes("e-book") || fl.toLowerCase().includes("ebook")) return "ebook";
    return "novo";
  }

  return rows.map((r) => {
    const titulo = cleanStr(r["Titulo"] || r["Título"]);
    const nome = titulo?.split(" - 20")[0]?.trim() || titulo || "Sem Nome";
    const funil = cleanStr(r["Funil"]);
    const etapa = cleanStr(r["Etapa"] || r["Etapa atual"]);
    const status = cleanStr(r["Status"]);
    return {
      nome,
      email: cleanEmail(r["E-mail (Pessoa)"] || r["Email (Pessoa)"] || r["Email"]),
      telefone_raw: cleanPhone(r["Telefone Principal (Pessoa)"] || r["Telefone (Pessoa)"]),
      source: "piperun",
      lead_status: resolveStatus(funil, etapa),
      proprietario_lead_crm: cleanStr(r["Nome do dono da oportunidade"]),
      piperun_id: cleanStr(r["ID"]),
      piperun_link: cleanStr(r["Link"]),
      produto_interesse: cleanStr(r["Produto de interesse"]),
      area_atuacao: cleanStr(r["ÁREA DE ATUAÇÃO"] || r["Área de Atuação"] || r["area_atuacao"]),
      especialidade: cleanStr(r["Especialidade principal"] || r["Especialidade"]),
      valor_oportunidade: cleanMoney(r["Valor de P&S"] || r["Valor"]),
      status_oportunidade: status ? status.toLowerCase() : "aberta",
      motivo_perda: cleanStr(r["(MP) Motivo de perda"]),
      comentario_perda: cleanStr(r["(MP) Comentário"]),
      temperatura_lead: cleanStr(r["Temperatura"]),
      funil_entrada_crm: funil,
      lead_timing_dias: r["Lead-Timing"] != null ? Number(r["Lead-Timing"]) || null : null,
      cidade: cleanStr(r["Endereço - Cidade (Pessoa)"]),
      uf: cleanStr(r["Endereço - Estado (UF) (Pessoa)"]),
      tags_crm: r["Tags"] ? String(r["Tags"]).split(",").map((t) => t.trim()).filter(Boolean) : null,
      itens_proposta_crm: cleanStr(r["Itens da proposta"]),
      ultima_etapa_comercial: cleanStr(etapa),
    };
  });
}

/* ─── Export map ─── */
export const PARSER_MAP: Record<string, (rows: RawRow[]) => NormalizedLead[]> = {
  master: parseMaster,
  manychat: parseManychat,
  facebook: parseFacebook,
  involveme: parseInvolveme,
  resin_clients: parseResinClients,
  scanner_owners: parseScannerOwners,
  facebook_kommo: parseFacebookKommo,
  hadron_vendas: parseHadronVendas,
  omie_vendas: parseOmieVendas,
  piperun_estagnados: parsePiperunEstagnados,
  piperun_full: parsePiperunFull,
};

export const PARSER_OPTIONS = [
  { key: "piperun_full", label: "PipeRun Export Completo", override: false },
  { key: "master", label: "Master Leads (PipeRun)", override: false },
  { key: "piperun_estagnados", label: "PipeRun Funil Estagnados", override: false },
  { key: "manychat", label: "ManyChat", override: false },
  { key: "facebook", label: "Facebook Ads (DH/Edge/IoConnect)", override: false },
  { key: "involveme", label: "InvolveMe (Ebook/Orçamento)", override: false },
  { key: "resin_clients", label: "Clientes Resina (XLSX)", override: false },
  { key: "scanner_owners", label: "Proprietários Scanner", override: false },
  { key: "facebook_kommo", label: "Facebook Cadastros (Kommo)", override: false },
  { key: "hadron_vendas", label: "Vendas Hadron (ERP)", override: true },
  { key: "omie_vendas", label: "Vendas Omie (ERP 2025)", override: true },
];
