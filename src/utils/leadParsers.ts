/**
 * Client-side lead parsers — normalize each source's columns
 * into the lia_attendances schema before sending to import-leads-csv edge function.
 */

type RawRow = Record<string, unknown>;
type NormalizedLead = Record<string, unknown>;

/* ─── Phone helpers ─── */
export function cleanPhone(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  let s = String(v);
  // Scientific notation fix (e.g. 5.51399E+12)
  if (s.includes("E+") || s.includes("e+")) {
    s = Number(s).toFixed(0);
  }
  const digits = s.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

export function cleanEmail(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  if (s === "#n/a" || s === "n/a" || s === "-" || s === "" || !s.includes("@")) return null;
  return s;
}

export function cleanMoney(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

export function cleanStr(v: unknown): string | null {
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

/* ─── Company fallback helpers ─── */
function emailWithFallback(r: RawRow): string | null {
  return cleanEmail(r["E-mail (Pessoa)"] || r["Email (Pessoa)"] || r["Email"])
    || cleanEmail(r["E-mail de contato (Empresa)"])
    || cleanEmail(r["Email de contato (Empresa)"]);
}

function phoneWithFallback(r: RawRow): string | null {
  return cleanPhone(r["Telefone Principal (Pessoa)"] || r["Telefone (Pessoa)"])
    || cleanPhone(r["Whatsapp"] || r["WHATSAPP"] || r["WhatsApp"])
    || cleanPhone(r["Telefone principal (Empresa)"] || r["Telefones (Empresa)"]);
}

function cityWithFallback(r: RawRow): string | null {
  return cleanStr(r["Endereço - Cidade (Pessoa)"])
    || cleanStr(r["Endereço - Cidade (Empresa)"]);
}

function ufWithFallback(r: RawRow): string | null {
  return cleanStr(r["Endereço - Estado (UF) (Pessoa)"])
    || cleanStr(r["Endereço - Estado (UF) (Empresa)"]);
}

function cleanDealName(titulo: string | null): string {
  if (!titulo) return "Sem Nome";
  return titulo.split(" - 20")[0]?.trim() || titulo;
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
    const nomePessoa = cleanStr(r["Nome completo (Pessoa)"]);
    const nome = nomePessoa || cleanDealName(titulo);
    const funil = cleanStr(r["Funil"]);
    const etapa = cleanStr(r["Etapa"] || r["Etapa atual"]);
    const status = cleanStr(r["Status"]);
    return {
      nome,
      email: emailWithFallback(r),
      telefone_raw: phoneWithFallback(r),
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
      cidade: cityWithFallback(r),
      uf: ufWithFallback(r),
      tags_crm: r["Tags"] ? String(r["Tags"]).split(",").map((t) => t.trim()).filter(Boolean) : null,
      itens_proposta_crm: cleanStr(r["Itens da proposta"]),
      ultima_etapa_comercial: cleanStr(etapa),
    };
  });
}

/* ─── PARSER: piperun_cs (Funil CS Onboarding) ─── */
function parsePiperunCS(rows: RawRow[]): NormalizedLead[] {
  const csStageMap: Record<string, string> = {
    "CS - Em espera": "cs_em_espera",
    "CS - Sem data (Agendar)": "cs_sem_data_agendar",
    "CS - Sem Data": "cs_sem_data_agendar",
    "CS - Sem Data (Agendar)": "cs_sem_data_agendar",
    "CS - Agendado": "cs_treinamento_agendado",
    "CS - Treinamento Agendado": "cs_treinamento_agendado",
    "CS - Treinamento realizado": "cs_treinamento_realizado",
    "CS - Não quer imersão": "cs_nao_quer_imersao",
    "CS - Enviar imp3D": "cs_enviar_imp3d",
    "CS - Equipamentos entregues": "cs_equipamentos_entregues",
    "CS - Acompanhamento 15 dias": "cs_acompanhamento_15d",
    "CS - Acompanhamento finalizado": "cs_finalizado",
    "Auxiliar E-mail": "cs_auxiliar_email",
    "CS - Sem Retorno": "cs_sem_retorno",
  };

  // Training tag → cs_treinamento value
  const TRAINING_STARTED = ["cursos-onboarding", "plataforma-confirmada"];
  const TRAINING_DONE = ["cursos-lives", "cursos-caracterizacao", "cursos-kit-imp"];
  const TRAINING_PENDING = ["bot-treinamento"];

  function deriveCsTreinamento(tags: string[]): string {
    const lower = tags.map((t) => t.toLowerCase().trim());
    if (lower.some((t) => TRAINING_DONE.includes(t))) return "realizado";
    if (lower.some((t) => TRAINING_STARTED.includes(t))) return "iniciado";
    if (lower.some((t) => TRAINING_PENDING.includes(t))) return "pendente";
    return "pendente";
  }

  return rows.map((r) => {
    const titulo = cleanStr(r["Titulo"] || r["Título"]);
    const nomePessoa = cleanStr(r["Nome completo (Pessoa)"]);
    const nome = nomePessoa || cleanDealName(titulo);
    const etapa = cleanStr(r["Etapa"] || r["Etapa atual"]);
    const rawTagsStr = String(r["Tags"] || "");
    const rawTags = rawTagsStr.split(",").map((t) => t.trim()).filter(Boolean);
    const { tags: migratedTags, fields: extractedFields } = migrateSellFluxTags(rawTags);
    const status = cleanStr(r["Status"]);

    return {
      nome,
      email: emailWithFallback(r),
      telefone_raw: phoneWithFallback(r),
      source: "piperun",
      lead_status: (etapa && csStageMap[etapa]) || "cs_em_espera",
      proprietario_lead_crm: cleanStr(r["Nome do dono da oportunidade"]),
      piperun_id: cleanStr(r["ID"]),
      piperun_link: cleanStr(r["Link"]),
      funil_entrada_crm: "CS Onboarding",
      ultima_etapa_comercial: cleanStr(etapa),
      cs_treinamento: deriveCsTreinamento(rawTags),
      tags_crm: migratedTags.length > 0 ? migratedTags : null,

      // CS-specific fields
      id_cliente_smart: cleanStr(r["Banco de Dados ID"] || r["BANCO DE DADOS ID"]),
      data_contrato: cleanStr(r["CÓDIGO CONTRATO"] || r["Código Contrato"] || r["DATA TREINAMENTO"] || r["Data Treinamento"]),

      // Standard fields with company fallback
      produto_interesse: cleanStr(r["Produto de interesse"]),
      area_atuacao: extractedFields.area_atuacao || cleanStr(r["Área de Atuação"] || r["ÁREA DE ATUAÇÃO"] || r["Area de Atuação"]),
      especialidade: cleanStr(r["Especialidade principal"] || r["Especialidade"]),
      tem_impressora: extractedFields.tem_impressora || cleanStr(r["Tem impressora"]),
      tem_scanner: extractedFields.tem_scanner || cleanStr(r["Tem scanner"]),
      valor_oportunidade: cleanMoney(r["Valor de P&S"] || r["Valor"]),
      status_oportunidade: status ? status.toLowerCase() : "aberta",
      motivo_perda: cleanStr(r["(MP) Motivo de perda"]),
      comentario_perda: cleanStr(r["(MP) Comentário"]),
      temperatura_lead: cleanStr(r["Temperatura"]),
      lead_timing_dias: r["Lead-Timing"] != null ? Number(r["Lead-Timing"]) || null : null,
      cidade: cityWithFallback(r),
      uf: ufWithFallback(r),
      itens_proposta_crm: cleanStr(r["Itens da proposta"]),
      software_cad: cleanStr(r["Software CAD"] || r["SOFTWARE CAD"]),
      impressora_modelo: cleanStr(r["Impressora Modelo"] || r["IMPRESSORA MODELO"]),
    };
  });
}

/* ─── LEGACY TAG MIGRATION (SellFlux → standardized) ─── */
const LEGACY_TAG_MAP_CLIENT: Record<string, string[]> = {
  "compra-realizada": ["EC_PAGAMENTO_APROVADO", "J04_COMPRA"],
  "pedido-pago": ["EC_PAGAMENTO_APROVADO"],
  "cancelado": ["EC_PEDIDO_CANCELADO"],
  "pedido-cancelado": ["EC_PEDIDO_CANCELADO"],
  "aguardando-pagamento": ["EC_INICIOU_CHECKOUT"],
  "gerou-boleto": ["EC_GEROU_BOLETO"],
  "gerouboleto": ["EC_GEROU_BOLETO"],
  "iniciou-pagamento-cartao": ["EC_INICIOU_CHECKOUT"],
  "cancelado-cartao-credito": ["EC_PEDIDO_CANCELADO"],
  "cancelado-boleto": ["EC_BOLETO_VENCIDO"],
  "bought-resin-auto": ["EC_PROD_RESINA"],
  "resina-comprado": ["EC_PROD_RESINA"],
  "ios-comprado": ["Q_TEM_SCANNER"],
  "smartmakegum-comprado": ["EC_PROD_SMARTMAKE"],
  "cliente-smart": ["J05_RETENCAO"],
  "plataforma-confirmada": ["CS_ONBOARDING_INICIO"],
  "chatbot-client-enviado": ["LIA_ATENDEU"],
};

const LEGACY_TAG_FIELD_CLIENT: Record<string, Record<string, string>> = {
  "clinica-consul": { area_atuacao: "Clínica" },
  "labproteses": { area_atuacao: "Laboratório" },
  "outras-areas": { area_atuacao: "Outras" },
  "professor": { area_atuacao: "Professor" },
  "sem-imp": { tem_impressora: "não" },
  "sem-scanner": { tem_scanner: "não" },
};

function migrateSellFluxTags(rawTags: string[]): { tags: string[]; fields: Record<string, string> } {
  const standardized = new Set<string>();
  const fields: Record<string, string> = {};
  for (const tag of rawTags) {
    const t = tag.trim().toLowerCase();
    if (!t) continue;
    if (LEGACY_TAG_MAP_CLIENT[t]) { for (const s of LEGACY_TAG_MAP_CLIENT[t]) standardized.add(s); continue; }
    if (LEGACY_TAG_FIELD_CLIENT[t]) { Object.assign(fields, LEGACY_TAG_FIELD_CLIENT[t]); continue; }
    if (/^estagnados?-/i.test(tag) || /\d+stagnant$/i.test(tag)) { standardized.add(tag.includes("15") ? "A_ESTAGNADO_15D" : "A_ESTAGNADO_7D"); continue; }
    if (/^produto-\d+$/i.test(tag)) { standardized.add("EC_PROD_INSUMO"); continue; }
    if (/^compra-realizada-\d+$/i.test(tag)) { standardized.add("EC_PAGAMENTO_APROVADO"); continue; }
    if (/^cancelado-?\d+$/i.test(tag) || /^canceladoboleto\d+$/i.test(tag)) { standardized.add("EC_PEDIDO_CANCELADO"); continue; }
    if (/^aguardando-pagamento-\d+$/i.test(tag)) { standardized.add("EC_INICIOU_CHECKOUT"); continue; }
    if (/^lead-/i.test(tag) || /-enviado$/i.test(tag) || /^webhook-/i.test(tag)) continue;
    if (/^(J0|EC_|Q_|C_|CS_|LIA_|A_)/.test(tag)) { standardized.add(tag); continue; }
    standardized.add(tag);
  }
  return { tags: [...standardized].sort(), fields };
}

/* ─── PARSER: sellflux (Export CSV from SellFlux) ─── */
function parseSellFlux(rows: RawRow[]): NormalizedLead[] {
  return rows.map((r) => {
    const rawTagsStr = String(r["Tags"] || r["tags"] || "");
    const rawTags = rawTagsStr.split(",").map((t) => t.trim()).filter(Boolean);
    const { tags: migratedTags, fields: extractedFields } = migrateSellFluxTags(rawTags);
    const hasLojaTag = rawTags.some((t) => t.toLowerCase().includes("loja") || t.toLowerCase().includes("integrada"));
    const boughtResin = cleanStr(r["bought-resin"] || r["Bought Resin"]);
    let leadStatus = "novo";
    if (migratedTags.includes("EC_PAGAMENTO_APROVADO") || migratedTags.includes("J04_COMPRA")) leadStatus = "contato_feito";
    else if (migratedTags.includes("J05_RETENCAO")) leadStatus = "contato_feito";
    else if (migratedTags.some((t) => t.startsWith("A_ESTAGNADO"))) leadStatus = "est_etapa1";
    return {
      nome: cleanStr(r["Name"] || r["name"] || r["Nome"]) || "Sem Nome",
      email: cleanEmail(r["Email"] || r["email"]),
      telefone_raw: cleanPhone(r["Phone"] || r["phone"] || r["Telefone"]),
      source: hasLojaTag ? "loja_integrada" : "sellflux",
      lead_status: leadStatus,
      tags_crm: migratedTags.length > 0 ? migratedTags : null,
      resina_interesse: boughtResin || null,
      piperun_id: cleanStr(r["atual-id-pipe"] || r["Atual Id Pipe"]) || null,
      proprietario_lead_crm: cleanStr(r["proprietario"] || r["Proprietario"]) || null,
      area_atuacao: extractedFields.area_atuacao || null,
      tem_impressora: extractedFields.tem_impressora || null,
      tem_scanner: extractedFields.tem_scanner || null,
      ativo_insumos: migratedTags.includes("EC_PAGAMENTO_APROVADO") || migratedTags.includes("EC_PROD_RESINA"),
    };
  });
}

/* ─── PARSER: auto_detect (fuzzy column matching) ─── */
export function findColumn(headers: string[], patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const found = headers.find((h) => p.test(h.toLowerCase()));
    if (found) return found;
  }
  return null;
}

function parseAutoDetect(rows: RawRow[]): NormalizedLead[] {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);

  const nameCol = findColumn(headers, [
    /^nome$/i, /^name$/i, /nome\s*completo/i, /full\s*name/i,
    /^titulo$/i, /^título$/i, /^cliente$/i, /^contact/i,
    /nome.*pessoa/i, /nome.*contato/i, /razao\s*social/i,
  ]);
  const emailCol = findColumn(headers, [
    /^e-?mail$/i, /e-?mail.*pessoa/i, /e-?mail.*contato/i,
  ]);
  const phoneCol = findColumn(headers, [
    /^telefone$/i, /^phone$/i, /^whatsapp$/i, /^celular$/i,
    /telefone.*pessoa/i, /telefone.*principal/i, /^fone$/i,
  ]);
  const cidadeCol = findColumn(headers, [/cidade/i, /city/i]);
  const ufCol = findColumn(headers, [/estado.*uf/i, /^uf$/i, /^estado$/i, /^state$/i]);
  const produtoCol = findColumn(headers, [/produto/i, /product/i, /interesse/i]);
  const valorCol = findColumn(headers, [/^valor/i, /value/i, /amount/i]);
  const proprietarioCol = findColumn(headers, [/proprietario/i, /proprietário/i, /dono/i, /owner/i, /vendedor/i]);
  const statusCol = findColumn(headers, [/^status$/i, /etapa/i, /stage/i]);
  const tagsCol = findColumn(headers, [/^tags$/i, /rótulos/i, /labels/i]);
  const areaCol = findColumn(headers, [/area.*atua/i, /área.*atua/i, /segmento/i]);
  const especCol = findColumn(headers, [/especialidade/i, /specialty/i]);

  console.log("[auto_detect] Detected columns:", {
    name: nameCol, email: emailCol, phone: phoneCol,
    cidade: cidadeCol, uf: ufCol, produto: produtoCol,
  });

  return rows.map((r) => ({
    nome: (nameCol ? cleanStr(r[nameCol]) : null) || "Sem Nome",
    email: emailCol ? cleanEmail(r[emailCol]) : null,
    telefone_raw: phoneCol ? cleanPhone(r[phoneCol]) : null,
    source: "csv_import",
    lead_status: statusCol ? (cleanStr(r[statusCol]) || "novo") : "novo",
    cidade: cidadeCol ? cleanStr(r[cidadeCol]) : null,
    uf: ufCol ? cleanStr(r[ufCol]) : null,
    produto_interesse: produtoCol ? cleanStr(r[produtoCol]) : null,
    valor_oportunidade: valorCol ? cleanMoney(r[valorCol]) : null,
    proprietario_lead_crm: proprietarioCol ? cleanStr(r[proprietarioCol]) : null,
    tags_crm: tagsCol && r[tagsCol] ? String(r[tagsCol]).split(",").map((t) => t.trim()).filter(Boolean) : null,
    area_atuacao: areaCol ? cleanStr(r[areaCol]) : null,
    especialidade: especCol ? cleanStr(r[especCol]) : null,
    raw_payload: r,
  }));
}

/* ─── Export map ─── */
export const PARSER_MAP: Record<string, (rows: RawRow[]) => NormalizedLead[]> = {
  auto_detect: parseAutoDetect,
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
  piperun_cs: parsePiperunCS,
  sellflux: parseSellFlux,
};

export const PARSER_OPTIONS = [
  { key: "auto_detect", label: "🔍 Auto-Detect (detecta colunas)", override: false },
  { key: "piperun_full", label: "PipeRun Export Completo", override: false },
  { key: "piperun_cs", label: "PipeRun Funil CS Onboarding", override: false },
  { key: "master", label: "Master Leads (PipeRun)", override: false },
  { key: "piperun_estagnados", label: "PipeRun Funil Estagnados", override: false },
  { key: "sellflux", label: "SellFlux Export (CSV)", override: false },
  { key: "manychat", label: "ManyChat", override: false },
  { key: "facebook", label: "Facebook Ads (DH/Edge/IoConnect)", override: false },
  { key: "involveme", label: "InvolveMe (Ebook/Orçamento)", override: false },
  { key: "resin_clients", label: "Clientes Resina (XLSX)", override: false },
  { key: "scanner_owners", label: "Proprietários Scanner", override: false },
  { key: "facebook_kommo", label: "Facebook Cadastros (Kommo)", override: false },
  { key: "hadron_vendas", label: "Vendas Hadron (ERP)", override: true },
  { key: "omie_vendas", label: "Vendas Omie (ERP 2025)", override: true },
];

/* ─── AUTO_DETECT_PATTERNS — exported for manual mapping UI ─── */
export const AUTO_DETECT_PATTERNS: Record<string, RegExp[]> = {
  nome: [/^nome$/i, /^name$/i, /nome\s*completo/i, /full\s*name/i, /^titulo$/i, /^título$/i, /^cliente$/i, /^contact/i, /nome.*pessoa/i, /nome.*contato/i, /razao\s*social/i],
  email: [/^e-?mail$/i, /e-?mail.*pessoa/i, /e-?mail.*contato/i, /^correio/i],
  telefone_raw: [/^telefone$/i, /^phone$/i, /^whatsapp$/i, /^celular$/i, /telefone.*pessoa/i, /telefone.*principal/i, /^fone$/i, /^mobile$/i],
  cidade: [/cidade/i, /city/i],
  uf: [/estado.*uf/i, /^uf$/i, /^estado$/i, /^state$/i],
  produto_interesse: [/produto/i, /product/i, /interesse/i],
  valor_oportunidade: [/^valor/i, /value/i, /amount/i],
  proprietario_lead_crm: [/proprietario/i, /proprietário/i, /dono/i, /owner/i, /vendedor/i],
  lead_status: [/^status$/i, /etapa/i, /stage/i],
  tags_crm: [/^tags$/i, /rótulos/i, /labels/i],
  area_atuacao: [/area.*atua/i, /área.*atua/i, /segmento/i],
  especialidade: [/especialidade/i, /specialty/i],
  empresa_nome: [/empresa/i, /company/i, /razao.*social/i],
  empresa_cnpj: [/cnpj/i],
  piperun_id: [/^id$/i, /piperun.*id/i],
  origem_campanha: [/origem/i, /origin/i, /campanha/i, /campaign/i],
  utm_source: [/utm_source/i],
  utm_medium: [/utm_medium/i],
  utm_campaign: [/utm_campaign/i],
  form_name: [/formulario/i, /formulário/i, /form.*name/i],
  impressora_modelo: [/impressora/i, /printer/i],
  software_cad: [/software.*cad/i, /cad.*software/i],
  como_digitaliza: [/digitaliza/i, /scan.*method/i],
  tem_impressora: [/tem.*impressora/i, /has.*printer/i, /utiliza.*impress/i],
  tem_scanner: [/tem.*scanner/i, /has.*scanner/i],
  pais_origem: [/pais/i, /país/i, /country/i],
  funil_entrada_crm: [/funil/i, /funnel/i, /pipeline/i],
  motivo_perda: [/motivo.*perda/i, /loss.*reason/i],
  comentario_perda: [/comentario.*perda/i, /comment.*loss/i],
  temperatura_lead: [/temperatura/i, /temperature/i],
  codigo_contrato: [/codigo.*contrato/i, /código.*contrato/i, /contract/i],
  insumos_adquiridos: [/insumos/i, /supplies/i],
  volume_mensal_pecas: [/volume.*mensal/i, /monthly.*volume/i],
  principal_aplicacao: [/principal.*aplica/i, /main.*application/i],
};

/* ─── LIA_SYSTEM_FIELDS — all lia_attendances columns for dropdown ─── */
export const LIA_SYSTEM_FIELDS: { value: string; label: string }[] = [
  { value: "area_atuacao", label: "Área de Atuação" },
  { value: "astron_courses_completed", label: "Astron Cursos Completados" },
  { value: "astron_courses_total", label: "Astron Cursos Total" },
  { value: "astron_created_at", label: "Astron Criado Em" },
  { value: "astron_email", label: "Astron Email" },
  { value: "astron_last_login_at", label: "Astron Último Login" },
  { value: "astron_login_url", label: "Astron Login URL" },
  { value: "astron_nome", label: "Astron Nome" },
  { value: "astron_phone", label: "Astron Telefone" },
  { value: "astron_plans_active", label: "Astron Planos Ativos" },
  { value: "astron_status", label: "Astron Status" },
  { value: "astron_synced_at", label: "Astron Sincronizado Em" },
  { value: "astron_user_id", label: "Astron User ID" },
  { value: "ativo_cad", label: "Ativo CAD" },
  { value: "ativo_cad_ia", label: "Ativo CAD IA" },
  { value: "ativo_cura", label: "Ativo Cura" },
  { value: "ativo_insumos", label: "Ativo Insumos" },
  { value: "ativo_notebook", label: "Ativo Notebook" },
  { value: "ativo_print", label: "Ativo Print" },
  { value: "ativo_scan", label: "Ativo Scan" },
  { value: "ativo_smart_slice", label: "Ativo Smart Slice" },
  { value: "automation_cooldown_until", label: "Automation Cooldown Até" },
  { value: "cidade", label: "Cidade" },
  { value: "codigo_contrato", label: "Código Contrato" },
  { value: "cognitive_model_version", label: "Cognitive Model Version" },
  { value: "comentario_perda", label: "Comentário Perda" },
  { value: "como_digitaliza", label: "Como Digitaliza" },
  { value: "confidence_score_analysis", label: "Confidence Score" },
  { value: "crm_lock_source", label: "CRM Lock Source" },
  { value: "crm_lock_until", label: "CRM Lock Até" },
  { value: "cs_treinamento", label: "CS Treinamento" },
  { value: "data_contrato", label: "Data Contrato" },
  { value: "data_fechamento_crm", label: "Data Fechamento CRM" },
  { value: "data_primeiro_contato", label: "Data Primeiro Contato" },
  { value: "data_treinamento", label: "Data Treinamento" },
  { value: "data_ultima_compra_cad", label: "Última Compra CAD" },
  { value: "data_ultima_compra_cad_ia", label: "Última Compra CAD IA" },
  { value: "data_ultima_compra_cura", label: "Última Compra Cura" },
  { value: "data_ultima_compra_insumos", label: "Última Compra Insumos" },
  { value: "data_ultima_compra_notebook", label: "Última Compra Notebook" },
  { value: "data_ultima_compra_print", label: "Última Compra Print" },
  { value: "data_ultima_compra_scan", label: "Última Compra Scan" },
  { value: "data_ultima_compra_smart_slice", label: "Última Compra Smart Slice" },
  { value: "email", label: "Email (chave)" },
  { value: "empresa_cnae", label: "Empresa CNAE" },
  { value: "empresa_cnpj", label: "Empresa CNPJ" },
  { value: "empresa_ie", label: "Empresa IE" },
  { value: "empresa_nome", label: "Empresa Nome" },
  { value: "empresa_piperun_id", label: "Empresa PipeRun ID" },
  { value: "empresa_porte", label: "Empresa Porte" },
  { value: "empresa_razao_social", label: "Empresa Razão Social" },
  { value: "empresa_segmento", label: "Empresa Segmento" },
  { value: "empresa_situacao", label: "Empresa Situação" },
  { value: "empresa_website", label: "Empresa Website" },
  { value: "equip_cad", label: "Equip CAD" },
  { value: "equip_cad_ativacao", label: "Equip CAD Ativação" },
  { value: "equip_cad_serial", label: "Equip CAD Serial" },
  { value: "equip_impressora", label: "Equip Impressora" },
  { value: "equip_impressora_ativacao", label: "Equip Impressora Ativação" },
  { value: "equip_impressora_serial", label: "Equip Impressora Serial" },
  { value: "equip_notebook", label: "Equip Notebook" },
  { value: "equip_notebook_ativacao", label: "Equip Notebook Ativação" },
  { value: "equip_notebook_serial", label: "Equip Notebook Serial" },
  { value: "equip_pos_impressao", label: "Equip Pós-Impressão" },
  { value: "equip_pos_impressao_ativacao", label: "Equip Pós-Impressão Ativação" },
  { value: "equip_pos_impressao_serial", label: "Equip Pós-Impressão Serial" },
  { value: "equip_scanner", label: "Equip Scanner" },
  { value: "equip_scanner_ativacao", label: "Equip Scanner Ativação" },
  { value: "equip_scanner_serial", label: "Equip Scanner Serial" },
  { value: "especialidade", label: "Especialidade" },
  { value: "form_name", label: "Form Name" },
  { value: "funil_entrada_crm", label: "Funil Entrada CRM" },
  { value: "id_cliente_smart", label: "ID Cliente Smart" },
  { value: "impressora_modelo", label: "Impressora Modelo" },
  { value: "informacao_desejada", label: "Informação Desejada" },
  { value: "insumos_adquiridos", label: "Insumos Adquiridos" },
  { value: "interest_timeline", label: "Interest Timeline" },
  { value: "ip_origem", label: "IP Origem" },
  { value: "itens_proposta_crm", label: "Itens Proposta CRM" },
  { value: "lead_stage_detected", label: "Lead Stage Detected" },
  { value: "lead_status", label: "Lead Status" },
  { value: "lead_timing_dias", label: "Lead Timing (dias)" },
  { value: "lojaintegrada_bairro", label: "Loja Integrada Bairro" },
  { value: "lojaintegrada_cep", label: "Loja Integrada CEP" },
  { value: "lojaintegrada_cliente_id", label: "Loja Integrada Cliente ID" },
  { value: "lojaintegrada_cliente_obs", label: "Loja Integrada Obs" },
  { value: "lojaintegrada_complemento", label: "Loja Integrada Complemento" },
  { value: "lojaintegrada_cupom_desconto", label: "Loja Integrada Cupom" },
  { value: "lojaintegrada_data_nascimento", label: "Loja Integrada Data Nasc." },
  { value: "lojaintegrada_endereco", label: "Loja Integrada Endereço" },
  { value: "lojaintegrada_forma_envio", label: "Loja Integrada Forma Envio" },
  { value: "lojaintegrada_forma_pagamento", label: "Loja Integrada Forma Pgto" },
  { value: "lojaintegrada_numero", label: "Loja Integrada Número" },
  { value: "lojaintegrada_referencia", label: "Loja Integrada Referência" },
  { value: "lojaintegrada_sexo", label: "Loja Integrada Sexo" },
  { value: "lojaintegrada_ultimo_pedido_data", label: "LI Último Pedido Data" },
  { value: "lojaintegrada_ultimo_pedido_numero", label: "LI Último Pedido Número" },
  { value: "lojaintegrada_ultimo_pedido_status", label: "LI Último Pedido Status" },
  { value: "lojaintegrada_ultimo_pedido_valor", label: "LI Último Pedido Valor" },
  { value: "lojaintegrada_utm_campaign", label: "LI UTM Campaign" },
  { value: "motivo_perda", label: "Motivo Perda" },
  { value: "nome", label: "Nome" },
  { value: "objection_risk", label: "Objection Risk" },
  { value: "origem_campanha", label: "Origem Campanha" },
  { value: "pais_origem", label: "País Origem" },
  { value: "pessoa_cargo", label: "Pessoa Cargo" },
  { value: "pessoa_cpf", label: "Pessoa CPF" },
  { value: "pessoa_facebook", label: "Pessoa Facebook" },
  { value: "pessoa_genero", label: "Pessoa Gênero" },
  { value: "pessoa_linkedin", label: "Pessoa LinkedIn" },
  { value: "pessoa_nascimento", label: "Pessoa Nascimento" },
  { value: "pessoa_observation", label: "Pessoa Observação" },
  { value: "pessoa_piperun_id", label: "Pessoa PipeRun ID" },
  { value: "piperun_id", label: "PipeRun ID" },
  { value: "piperun_link", label: "PipeRun Link" },
  { value: "primary_motivation", label: "Primary Motivation" },
  { value: "principal_aplicacao", label: "Principal Aplicação" },
  { value: "produto_interesse", label: "Produto Interesse" },
  { value: "produto_interesse_auto", label: "Produto Interesse Auto" },
  { value: "proprietario_lead_crm", label: "Proprietário Lead CRM" },
  { value: "psychological_profile", label: "Psychological Profile" },
  { value: "recommended_approach", label: "Recommended Approach" },
  { value: "resina_interesse", label: "Resina Interesse" },
  { value: "reuniao_agendada", label: "Reunião Agendada" },
  { value: "score", label: "Score" },
  { value: "sdr_caracterizacao_interesse", label: "SDR Caracterização Interesse" },
  { value: "sdr_cursos_interesse", label: "SDR Cursos Interesse" },
  { value: "sdr_dentistica_interesse", label: "SDR Dentística Interesse" },
  { value: "sdr_impressora_interesse", label: "SDR Impressora Interesse" },
  { value: "sdr_insumos_lab_interesse", label: "SDR Insumos Lab Interesse" },
  { value: "sdr_marca_impressora_param", label: "SDR Marca Impressora Param" },
  { value: "sdr_modelo_impressora_param", label: "SDR Modelo Impressora Param" },
  { value: "sdr_pos_impressao_interesse", label: "SDR Pós-Impressão Interesse" },
  { value: "sdr_resina_param", label: "SDR Resina Param" },
  { value: "sdr_scanner_interesse", label: "SDR Scanner Interesse" },
  { value: "sdr_software_cad_interesse", label: "SDR Software CAD Interesse" },
  { value: "sdr_solucoes_interesse", label: "SDR Soluções Interesse" },
  { value: "sdr_suporte_descricao", label: "SDR Suporte Descrição" },
  { value: "sdr_suporte_equipamento", label: "SDR Suporte Equipamento" },
  { value: "sdr_suporte_tipo", label: "SDR Suporte Tipo" },
  { value: "software_cad", label: "Software CAD" },
  { value: "source", label: "Source" },
  { value: "status_oportunidade", label: "Status Oportunidade" },
  { value: "tags_crm", label: "Tags CRM" },
  { value: "telefone_normalized", label: "Telefone Normalizado" },
  { value: "telefone_raw", label: "Telefone Raw" },
  { value: "tem_impressora", label: "Tem Impressora" },
  { value: "tem_scanner", label: "Tem Scanner" },
  { value: "temperatura_lead", label: "Temperatura Lead" },
  { value: "uf", label: "UF" },
  { value: "ultima_etapa_comercial", label: "Última Etapa Comercial" },
  { value: "urgency_level", label: "Urgency Level" },
  { value: "utm_campaign", label: "UTM Campaign" },
  { value: "utm_medium", label: "UTM Medium" },
  { value: "utm_source", label: "UTM Source" },
  { value: "utm_term", label: "UTM Term" },
  { value: "valor_oportunidade", label: "Valor Oportunidade" },
  { value: "volume_mensal_pecas", label: "Volume Mensal Peças" },
];

/* ─── applyMappings — transforms raw rows using user-configured field mappings ─── */
export interface FieldMapping {
  csvColumn: string;
  systemField: string;    // lia field, "__ignore__", or "__new__"
  newFieldName: string;
  enabled: boolean;
  samples: string[];
}

const PHONE_FIELDS = new Set(["telefone_raw", "telefone_normalized", "astron_phone"]);
const MONEY_FIELDS = new Set(["valor_oportunidade", "proposals_total_value", "proposals_total_mrr", "piperun_value_mrr", "lojaintegrada_ultimo_pedido_valor"]);

export function applyMappings(
  rawRows: Record<string, unknown>[],
  mappings: FieldMapping[]
): Record<string, unknown>[] {
  const activeMappings = mappings.filter(m => m.enabled && m.systemField !== "__ignore__");

  return rawRows.map((row) => {
    const lead: Record<string, unknown> = {};
    for (const m of activeMappings) {
      const targetField = m.systemField === "__new__" ? m.newFieldName : m.systemField;
      if (!targetField) continue;
      const rawVal = row[m.csvColumn];

      if (targetField === "email") {
        lead[targetField] = cleanEmail(rawVal);
      } else if (PHONE_FIELDS.has(targetField)) {
        lead[targetField] = cleanPhone(rawVal);
      } else if (MONEY_FIELDS.has(targetField)) {
        lead[targetField] = cleanMoney(rawVal);
      } else if (targetField === "tags_crm") {
        lead[targetField] = rawVal ? String(rawVal).split(",").map(t => t.trim()).filter(Boolean) : null;
      } else {
        lead[targetField] = cleanStr(rawVal);
      }
    }
    // Ensure nome fallback
    if (!lead.nome) lead.nome = "Sem Nome";
    // Ensure source
    if (!lead.source) lead.source = "csv_import";
    return lead;
  });
}

/* ─── findColumnByHeader — match a single header against all patterns ─── */
export function findColumnByHeader(header: string): string | null {
  const h = header.toLowerCase().trim();
  for (const [field, patterns] of Object.entries(AUTO_DETECT_PATTERNS)) {
    if (patterns.some(p => p.test(h))) return field;
  }
  return null;
}
