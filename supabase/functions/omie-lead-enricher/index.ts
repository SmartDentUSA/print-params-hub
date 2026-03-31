// redeployed 2026-03-31T20:00Z — fix cnpj→empresa_cnpj, add CPF fallback, action=sync
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }

// ─── Omie API somente leitura ─────────────────────────────────────────────────
async function omieGet(endpoint: string, call: string, params: object) {
  const res = await fetch(`https://app.omie.com.br/api/v1${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_key:    Deno.env.get("OMIE_APP_KEY"),
      app_secret: Deno.env.get("OMIE_APP_SECRET"),
      call, param: [params]
    })
  })
  if (!res.ok) throw new Error(`Omie HTTP ${res.status} em ${call}`)
  return res.json()
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Set de leads para enriquecimento com debounce ────────────────────────────
const leadsToEnrich = new Set<string>()

function queueEnrich(leadId: string) {
  leadsToEnrich.add(leadId)
}

// ─── enrichLead: chama SQL function — score calculado APENAS em SQL ───────────
async function enrichLead(
  supabase: ReturnType<typeof createClient>, leadId: string
) {
  try {
    await (supabase as any).rpc("fn_enrich_lead_from_omie", { p_lead_id: leadId })
  } catch (e) {
    console.warn(`fn_enrich_lead_from_omie failed ${leadId}:`, e)
  }
  try {
    const { error } = await (supabase as any).rpc("calculate_lead_intelligence_score",
      { p_lead_id: leadId })
    if (error?.code === "PGRST202") { /* função não existe */ }
  } catch (_) { /* opcional */ }
}

// ─── Processa a fila de enriquecimento ───────────────────────────────────────
async function flushEnrichQueue(
  supabase: ReturnType<typeof createClient>, label = "flush"
) {
  const ids = [...leadsToEnrich]
  leadsToEnrich.clear()
  console.log(`${label}: enriquecendo ${ids.length} leads...`)
  let count = 0
  for (const id of ids) {
    await enrichLead(supabase, id)
    count++
    if (count % 50 === 0) {
      console.log(`  ${label}: ${count}/${ids.length}`)
      await sleep(50)
    }
  }
  console.log(`${label}: ${count} leads enriquecidos`)
  return count
}

// ─── Normalizar telefone ──────────────────────────────────────────────────────
function normalizePhone(ddd?: string, numero?: string): string | null {
  if (!ddd || !numero) return null
  return `+55${ddd}${numero}`.replace(/\D/g, "").replace(/^\+/, "+")
}

// ─── Identity resolution: omie_id → CNPJ → email → telefone ─────────────────
async function resolveLeadByOmieEvent(
  supabase: ReturnType<typeof createClient>,
  event: any,
  pedidoCabecalho?: any
): Promise<{ id: string } | null> {
  const codigoCliente =
    event.nCodCliente         ||
    event.codigo_cliente_omie ||
    event.nCodCli             ||
    pedidoCabecalho?.codigo_cliente

  if (codigoCliente) {
    const { data } = await (supabase as any)
      .from("lia_attendances").select("id")
      .eq("omie_codigo_cliente", codigoCliente)
      .is("merged_into", null).maybeSingle()
    if (data) return data
  }

  const cnpjCpf = (
    event.cCNPJCPF || event.cnpj_cpf ||
    pedidoCabecalho?.cnpj_cpf_cliente
  )
  if (cnpjCpf) {
    const cnpjCpfNorm = cnpjCpf.replace(/\D/g, "")
    // Busca por CNPJ (empresa_cnpj)
    const { data: byCnpj } = await (supabase as any)
      .from("lia_attendances").select("id")
      .eq("empresa_cnpj", cnpjCpfNorm)
      .is("merged_into", null).maybeSingle()
    if (byCnpj) return byCnpj
    // Fallback: busca por CPF (pessoa_cpf) — PF
    const { data: byCpf } = await (supabase as any)
      .from("lia_attendances").select("id")
      .eq("pessoa_cpf", cnpjCpfNorm)
      .is("merged_into", null).maybeSingle()
    if (byCpf) return byCpf
  }

  const email = (
    event.cEmail                     ||
    pedidoCabecalho?.email_cliente   ||
    pedidoCabecalho?.utilizar_emails ||
    event.utilizar_emails
  )?.split(",")[0]?.toLowerCase()?.trim()

  if (email) {
    const { data } = await (supabase as any)
      .from("lia_attendances").select("id")
      .eq("email", email).is("merged_into", null).maybeSingle()
    if (data) return data
  }

  // Fallback: telefone normalizado
  const ddd    = event.cTelefone1DDD  || pedidoCabecalho?.telefone1_ddd
  const numero = event.cTelefone1Num  || pedidoCabecalho?.telefone1_numero
  const tel = normalizePhone(ddd, numero)
  if (tel) {
    const { data } = await (supabase as any)
      .from("lia_attendances").select("id")
      .eq("telefone_normalized", tel)
      .is("merged_into", null).maybeSingle()
    if (data) return data
  }

  console.warn("Lead não encontrado:", { codigoCliente, cnpjCpf, email })
  return null
}

// ─── Detecta equipamento ──────────────────────────────────────────────────────
function detectEquipField(desc: string): "equip_impressora" | "equip_scanner" | "equip_cad" | null {
  const d = desc.toUpperCase()
  if (
    d.includes("VITALITY") || d.includes("IMPRESSORA") || d.includes("BIO")       ||
    d.includes("MIICRAFT") || d.includes("EDGEMINI")  || d.includes("IOCONNECT") ||
    d.includes("ELEGOO")   || d.includes("PIONEXT")   || d.includes("HALOT")     ||
    d.includes("MARS ")    || d.includes("IMPRESS 3D")|| d.includes("WASH AND CURE") ||
    d.includes("BAND. IMPRESS") || d.includes("IMPRESSORA 3D")
  ) return "equip_impressora"
  if (
    d.includes("SCANNER") || d.includes("MEDIT") || d.includes("INTRAORAL") ||
    d.includes("I600")    || d.includes("I700")  || d.includes("TRIOS")     ||
    d.includes("INO")     || d.includes("BLZ")
  ) return "equip_scanner"
  if (
    d.includes("EXOCAD") || d.includes("CAD") ||
    d.includes("SOFTWARE") || d.includes("LICEN")
  ) return "equip_cad"
  return null
}

// ─── Mapeamento de eventos Omie → erp_status ─────────────────────────────────
function mapOmieEventToErpStatus(topic: string): string | null {
  const map: Record<string, string> = {
    "vendaproduto.faturada":                      "FATURADO",
    "nfe.autorizada":                             "FATURADO",
    "nfe.notaautorizada":                         "FATURADO",
    "pedido.faturado":                            "FATURADO",
    "vendaproduto.cancelada":                     "CANCELADO",
    "nfe.cancelada":                              "CANCELADO",
    "nfe.notacancelada":                          "CANCELADO",
    "financas.contareceber.baixarealizada":       "PAGO",
    "financas.contareceber.baixa":                "PAGO",
    "financas.contareceber.baixacancelada":       "__REVERTER__",
    "vendaproduto.incluida":                      "ORCADO",
    "pedido.incluido":                            "ORCADO",
    "vendaproduto.devolvida":                     "DEVOLVIDO",
    "remessaproduto.devolvida":                   "DEVOLVIDO",
  }
  return map[topic] ?? null
}

// ─── updateErpStatus com race condition guard ─────────────────────────────────
async function updateErpStatus(
  supabase: ReturnType<typeof createClient>,
  leadId: string, newStatus: string, eventName: string
) {
  if (!leadId) return
  const now = new Date().toISOString()
  const { data: updated } = await (supabase as any)
    .from("lia_attendances")
    .update({ erp_status: newStatus, erp_last_event: eventName, erp_updated_at: now })
    .eq("id", leadId)
    .or(`erp_updated_at.is.null,erp_updated_at.lt.${now}`)
    .select("id").maybeSingle()
  if (!updated) { console.warn(`Race condition: ${eventName} ignorado ${leadId}`); return }
  const since = new Date(Date.now() - 86_400_000).toISOString()
  const { count } = await (supabase as any).from("deal_status_history")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId).eq("event_name", eventName)
    .eq("status", newStatus).gte("created_at", since)
  if ((count ?? 0) === 0) {
    await (supabase as any).from("deal_status_history")
      .insert({ lead_id: leadId, source: "erp", status: newStatus, event_name: eventName })
  }
}

async function getPreviousErpStatus(
  supabase: ReturnType<typeof createClient>, leadId: string
): Promise<string> {
  const { data } = await (supabase as any).from("deal_status_history")
    .select("status").eq("lead_id", leadId).eq("source", "erp")
    .neq("status", "PAGO").order("created_at", { ascending: false }).limit(2)
  return data?.[1]?.status || data?.[0]?.status || "ORCADO"
}

// ─── Frete ────────────────────────────────────────────────────────────────────
function mapFreteType(modalidade: string | undefined): string {
  return ({ "0":"CIF","1":"FOB","2":"TERCEIROS","9":"SEM_FRETE" })[modalidade ?? "9"] ?? "SEM_FRETE"
}

function extractFreteData(pedido: any) {
  const frete = pedido?.frete ?? {}
  const tipo  = mapFreteType(String(frete.modalidade ?? "9"))
  if (tipo === "SEM_FRETE" || tipo === "FOB") {
    return { frete_status:"NONE", frete_transportadora:null as string|null, frete_codigo_rastreio:null as string|null,
             frete_link_rastreio:null as string|null, frete_valor:null as number|null, frete_tipo:tipo, frete_previsao_entrega:null as string|null }
  }
  const rastreio = frete.codigo_rastreio || null
  return {
    frete_status:           rastreio ? "EM_TRANSITO" : "AGUARDANDO_DESPACHO",
    frete_transportadora:   frete.codigo_transportadora ? String(frete.codigo_transportadora) : null,
    frete_codigo_rastreio:  rastreio,
    frete_link_rastreio:    frete.link_rastreio || null,
    frete_valor:            parseFloat(frete.valor_frete ?? 0) || null,
    frete_tipo:             tipo,
    frete_previsao_entrega: frete.previsao_entrega || null
  }
}

async function updateFreteStatus(
  supabase: ReturnType<typeof createClient>,
  leadId: string, newStatus: string, extra: Record<string, any> = {}
) {
  if (!leadId) return
  const now       = new Date().toISOString()
  const eventName = extra.event_name ?? "frete.update"
  const patch     = { frete_status: newStatus, frete_updated_at: now, ...extra }
  delete patch.event_name
  const { data: updated } = await (supabase as any)
    .from("lia_attendances").update(patch).eq("id", leadId)
    .or(`frete_updated_at.is.null,frete_updated_at.lt.${now}`)
    .select("id").maybeSingle()
  if (!updated) { console.warn(`Race condition frete: ${leadId}`); return }
  const since = new Date(Date.now() - 86_400_000).toISOString()
  const { count } = await (supabase as any).from("deal_status_history")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId).eq("event_name", eventName)
    .eq("status", `FRETE:${newStatus}`).gte("created_at", since)
  if ((count ?? 0) === 0) {
    await (supabase as any).from("deal_status_history").insert({
      lead_id: leadId, source: "erp", status: `FRETE:${newStatus}`, event_name: eventName
    })
  }
}

// ─── Serial extraction ────────────────────────────────────────────────────────
function extractSeriaisFromNF(pedido: any): Record<string, string> {
  const texto: string = pedido?.informacoes_adicionais?.dados_adicionais_nf ?? ""
  const seriais: Record<string, string> = {}
  if (!texto) return seriais
  let m: RegExpExecArray | null
  const rx1 = /NUMERO\s+DE\s+SERIE\s+DO\s+EQUIP[^:]*:\s*([A-Z0-9]{5,})/gi
  while ((m = rx1.exec(texto)) !== null) {
    const serial = m[1].trim()
    const ctx    = texto.substring(Math.max(0, m.index - 80), m.index + m[0].length).toUpperCase()
    const campo  = detectEquipField(ctx)
    seriais[campo ?? "serial_eq_1"] = serial
  }
  const sl = texto.match(/SERIAL\s{2,}(.+?)(?:\.|$)/i)
  if (sl) {
    sl[1].split(/\s+/).filter(t => /^[A-Z0-9]{5,}$/i.test(t)).forEach((token, idx) => {
      if (/[A-Z]/i.test(token) && /[0-9]/.test(token) && !Object.values(seriais).includes(token)) {
        seriais[idx === 0 ? "serial_eq_1" : `serial_eq_${idx + 1}`] = token
      }
    })
  }
  const rx3 = /(?:S\/N|SERIAL\s*N[°º]?)\s*[:\-]\s*([A-Z0-9]{6,})/gi
  while ((m = rx3.exec(texto)) !== null) {
    const s = m[1].trim()
    if (!Object.values(seriais).includes(s)) seriais["serial_sn"] = s
  }
  return seriais
}

// ─── parseOmieDate DD/MM/YYYY ─────────────────────────────────────────────────
function parseOmieDate(dateStr: string): Date | null {
  if (!dateStr || !dateStr.includes("/")) return null
  const [d, mo, y] = dateStr.split("/")
  const dt = new Date(`${y}-${mo.padStart(2,"0")}-${d.padStart(2,"0")}`)
  return isNaN(dt.getTime()) ? null : dt
}

// ─── mapTipoDocumento ─────────────────────────────────────────────────────────
function mapTipoDocumento(raw: string | undefined): string {
  return ({ BOL:"BOL",BOLETO:"BOL",PIX:"PIX",CRT:"CRT",CARTAO:"CRT",
            CHQ:"CHQ",CHEQUE:"CHQ",NFE:"NFE",DOC:"DOC",TED:"DOC"
          })[(raw ?? "BOL").toUpperCase()] ?? "BOL"
}

// ─── upsertParcelas ───────────────────────────────────────────────────────────
async function upsertParcelas(
  supabase: ReturnType<typeof createClient>,
  leadId: string, pedido: any, nfeChave?: string
) {
  const cab      = pedido.cabecalho ?? {}
  const titulos  = pedido.titulos ?? []
  const parcelas = pedido.lista_parcelas?.parcela ?? []
  const fonte    = titulos.length > 0 ? titulos : parcelas
  if (!fonte.length) return

  const hoje = new Date()
  const rows = fonte.map((p: any, idx: number) => {
    const fromTitulo = titulos.length > 0
    const dataVenc   = parseOmieDate(p.dDtVenc ?? p.data_vencimento ?? "")
    if (!dataVenc) return null
    return {
      lead_id:          leadId,
      omie_pedido_id:   cab.codigo_pedido   ? Number(cab.codigo_pedido) : null,
      omie_titulo_id:   p.nCodTitulo        ? Number(p.nCodTitulo)      : null,
      omie_titulo_repet:p.nCodTitRepet      ? Number(p.nCodTitRepet)    : null,
      nfe_chave:        nfeChave ?? null,
      numero_pedido:    cab.numero_pedido   ?? null,
      numero_parcela:   fromTitulo ? (p.nParcela ?? idx + 1) : (p.numero_parcela ?? idx + 1),
      total_parcelas:   fromTitulo ? (p.nTotParc ?? fonte.length) : fonte.length,
      valor:            parseFloat(p.nValorTitulo ?? p.valor ?? 0),
      data_vencimento:  dataVenc.toISOString().split("T")[0],
      tipo_documento:   mapTipoDocumento(p.cDoc ?? p.tipo_documento),
      status:           dataVenc < hoje ? "VENCIDO" : "PENDENTE",
      source:           "omie",
    }
  }).filter(Boolean)

  if (!rows.length) return
  const { error } = await (supabase as any).from("omie_parcelas")
    .upsert(rows, { onConflict: "omie_pedido_id,numero_parcela", ignoreDuplicates: false })
  if (error) console.error("upsertParcelas:", error.message)
}

// ─── marcarParcelaPaga ────────────────────────────────────────────────────────
async function marcarParcelaPaga(
  supabase: ReturnType<typeof createClient>,
  tituloId: number, valorPago?: number
) {
  const { data: parcela } = await (supabase as any).from("omie_parcelas")
    .select("id,lead_id").eq("omie_titulo_id", tituloId).maybeSingle()
  if (!parcela) return
  await (supabase as any).from("omie_parcelas").update({
    status: "PAGO", valor_pago: valorPago ?? null,
    data_pagamento: new Date().toISOString().split("T")[0]
  }).eq("id", parcela.id)
  const { data: pendentes } = await (supabase as any).from("omie_parcelas")
    .select("id").eq("lead_id", parcela.lead_id).in("status", ["PENDENTE","VENCIDO"])
  if ((pendentes?.length ?? 0) === 0) {
    await updateErpStatus(supabase, parcela.lead_id, "PAGO", "financeiro.quitado")
  }
  // Webhook: enriquecer imediatamente
  await enrichLead(supabase, parcela.lead_id)
}

// ─── enrichFromPedido ─────────────────────────────────────────────────────────
async function enrichFromPedido(
  supabase: ReturnType<typeof createClient>,
  leadId: string, pedido: any, nfNumber: string | null
) {
  const dealItems: object[] = []
  const equipUpd: Record<string, string> = {}

  for (const item of pedido.det ?? []) {
    const p = item.produto
    dealItems.push({
      lead_id:       leadId,
      source:        "omie",
      product_name:  p.descricao,
      product_code:  String(p.codigo ?? p.codigo_produto ?? ""),
      quantity:      parseFloat(p.quantidade ?? 1),
      unit_value:    parseFloat(p.valor_unitario ?? 0),
      total_value:   parseFloat(p.valor_total ?? 0),
      serial_number: null,
      nfe_number:    nfNumber,
      proposal_id:   'omie-direct',
      synced_at:     new Date().toISOString()
    })
    const campo = detectEquipField(p.descricao)
    if (campo) equipUpd[`${campo}_fill_if_null`] = p.descricao
  }

  if (dealItems.length > 0) {
    await (supabase as any).from("deal_items")
      .upsert(dealItems, { onConflict: "lead_id,nfe_number,product_code", ignoreDuplicates: true })
  }

  const seriais = extractSeriaisFromNF(pedido)
  const { data: cur } = await (supabase as any).from("lia_attendances")
    .select("equip_impressora,equip_scanner,equip_cad,omie_nf_count")
    .eq("id", leadId).single()

  const patch: Record<string, any> = {
    omie_nf_count:       (cur?.omie_nf_count ?? 0) + 1,
    omie_codigo_cliente: pedido.cabecalho?.codigo_cliente ?? undefined,
  }
  for (const [campo, valor] of Object.entries(equipUpd)) {
    if (campo.endsWith("_fill_if_null")) {
      const rc = campo.replace("_fill_if_null","")
      if (!cur?.[rc]) patch[rc] = valor
    }
  }
  for (const [campo, serial] of Object.entries(seriais)) {
    if (!campo.startsWith("serial_")) patch[`${campo}_serial`] = serial
  }
  await (supabase as any).from("lia_attendances").update(patch).eq("id", leadId)
  await upsertParcelas(supabase, leadId, pedido)

  const freteData = extractFreteData(pedido)
  if (freteData.frete_tipo !== "SEM_FRETE" && freteData.frete_tipo !== "FOB") {
    await updateFreteStatus(supabase, leadId, freteData.frete_status, {
      ...freteData, event_name: "pedido.faturado.frete"
    })
  } else {
    await (supabase as any).from("lia_attendances")
      .update({ frete_status: "NONE", frete_tipo: freteData.frete_tipo }).eq("id", leadId)
  }

  // Webhook: enriquecer imediatamente
  await enrichLead(supabase, leadId)
}

// ─── Cobranças automáticas ────────────────────────────────────────────────────
async function dispararCobrancas(supabase: ReturnType<typeof createClient>) {
  const janelas = [1, 3, 7, 15, 30]
  let total = 0
  for (const dias of janelas) {
    const dataAlvo = new Date()
    dataAlvo.setDate(dataAlvo.getDate() - dias)
    const dataStr = dataAlvo.toISOString().split("T")[0]
    const { data: parcelas } = await (supabase as any).from("omie_parcelas")
      .select("id,lead_id,valor,data_vencimento,numero_parcela,total_parcelas,cobranca_count")
      .eq("status","VENCIDO").eq("data_vencimento", dataStr)
      .lt("cobranca_count", 3).limit(50)
    for (const p of parcelas ?? []) {
      const { data: lead } = await (supabase as any).from("lia_attendances")
        .select("email,telefone_normalized,nome,omie_score,omie_classificacao").eq("id", p.lead_id).single()
      if (!lead?.email) continue
      try {
        const url = Deno.env.get("SELLFLUX_WEBHOOK_URL")
        if (url) {
          await fetch(url, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: lead.email, telefone: lead.telefone_normalized, nome: lead.nome,
              tag: `cobranca_${dias}dias`, valor_parcela: p.valor,
              data_vencimento: p.data_vencimento, numero_parcela: p.numero_parcela,
              total_parcelas: p.total_parcelas, dias_vencido: dias,
              omie_score: lead.omie_score,
              omie_classificacao: lead.omie_classificacao,
            })
          })
        }
        await (supabase as any).from("omie_parcelas").update({
          cobranca_enviada_em: new Date().toISOString(),
          cobranca_canal: "sellflux",
          cobranca_count: (p.cobranca_count ?? 0) + 1
        }).eq("id", p.id)
        await (supabase as any).from("deal_status_history").insert({
          lead_id: p.lead_id, source: "erp",
          status: `COBRANCA:${dias}d`, event_name: `cobranca.automatica.${dias}dias`
        })
        total++
        await sleep(200)
      } catch (e) { console.warn(`Erro cobrança ${p.lead_id}:`, e) }
    }
  }
  return total
}

// ─── handleWebhook ────────────────────────────────────────────────────────────
async function handleWebhook(
  supabase: ReturnType<typeof createClient>, body: any
) {
  const topic: string = (body.topic ?? "").toLowerCase()
  const event = body.event ?? body
  console.log(`Webhook: ${topic}`)

  if (topic === "vendaproduto.faturada" || topic === "pedido.faturado") {
    const pedido = await omieGet("/produtos/pedido/", "ConsultarPedido", {
      nCodPed: event.nCodPed || event.codigo_pedido
    })
    const lead = await resolveLeadByOmieEvent(supabase, event, pedido?.cabecalho)
    if (!lead) return
    await updateErpStatus(supabase, lead.id, "FATURADO", topic)
    await enrichFromPedido(supabase, lead.id, pedido, String(event.nCodNF ?? ""))
    return
  }

  if (topic === "nfe.autorizada" || topic === "nfe.notaautorizada") {
    try {
      const nfData = await omieGet("/faturamento/nfe/", "ConsultarNF", {
        nIdNF: event.nIdNF || event.codigo_nf
      })
      const nf   = nfData?.nfCadastro ?? nfData
      const lead = await resolveLeadByOmieEvent(supabase, {
        nCodCli: nf?.nfDestInt?.nCodCli, cCNPJCPF: nf?.nfDestInt?.cnpj_cpf
      })
      if (lead) {
        await updateErpStatus(supabase, lead.id, "FATURADO", topic)
        if (nf?.titulos?.length) {
          await upsertParcelas(supabase, lead.id,
            { cabecalho: {}, lista_parcelas: { parcela: [] }, titulos: nf.titulos },
            nf?.compl?.cChaveNFe
          )
        }
        await enrichLead(supabase, lead.id)
      }
    } catch (e) { console.warn("NF consulta:", e) }
    return
  }

  if (
    topic === "vendaproduto.cancelada" || topic === "nfe.cancelada" ||
    topic === "nfe.notacancelada"      || topic === "vendaproduto.devolvida" ||
    topic === "remessaproduto.devolvida"
  ) {
    const lead = await resolveLeadByOmieEvent(supabase, event)
    if (!lead) return
    const novoStatus = topic.includes("devolv") ? "DEVOLVIDO" : "CANCELADO"
    await updateErpStatus(supabase, lead.id, novoStatus, topic)
    if (novoStatus === "DEVOLVIDO") {
      await updateFreteStatus(supabase, lead.id, "DEVOLVIDO", { event_name: topic })
    }
    await (supabase as any).from("omie_parcelas").update({ status: "CANCELADO" })
      .eq("lead_id", lead.id).in("status", ["PENDENTE","VENCIDO"])
    await enrichLead(supabase, lead.id)
    return
  }

  if (topic === "financas.contareceber.baixarealizada" || topic === "financas.contareceber.baixa") {
    const tituloId = event.nCodTitulo || event.codigo_titulo
    if (tituloId) {
      await marcarParcelaPaga(supabase, Number(tituloId),
        parseFloat(event.nValorTitulo ?? 0) || undefined)
    } else {
      const lead = await resolveLeadByOmieEvent(supabase, event)
      if (lead) {
        await updateErpStatus(supabase, lead.id, "PAGO", topic)
        await enrichLead(supabase, lead.id)
      }
    }
    return
  }

  if (topic === "financas.contareceber.baixacancelada") {
    const tituloId = event.nCodTitulo || event.codigo_titulo
    if (tituloId) {
      await (supabase as any).from("omie_parcelas").update({
        status: "PENDENTE", valor_pago: 0, data_pagamento: null
      }).eq("omie_titulo_id", Number(tituloId))
    }
    const lead = await resolveLeadByOmieEvent(supabase, event)
    if (lead) {
      const prev = await getPreviousErpStatus(supabase, lead.id)
      await updateErpStatus(supabase, lead.id, prev, topic)
      await enrichLead(supabase, lead.id)
    }
    return
  }

  if (topic === "remessaproduto.incluida" || topic === "remessa.incluida") {
    const lead = await resolveLeadByOmieEvent(supabase, event)
    if (!lead) return
    const rastreio = event.cCodRastreio || null
    await updateFreteStatus(supabase, lead.id, rastreio ? "EM_TRANSITO" : "DESPACHADO", {
      frete_codigo_rastreio: rastreio,
      frete_transportadora: event.cTransportadora || null,
      event_name: topic
    })
    return
  }

  if (topic === "vendaproduto.incluida" || topic === "pedido.incluido") {
    const lead = await resolveLeadByOmieEvent(supabase, event)
    if (!lead) return
    await updateErpStatus(supabase, lead.id, "ORCADO", topic)
    return
  }

  if (topic === "cliente.alterado") {
    const cliente = await omieGet("/geral/clientes/", "ConsultarCliente", {
      codigo_cliente_omie: event.codigo_cliente_omie
    })
    const email = cliente?.email?.toLowerCase()?.trim()
    const cnpjCpfNorm = cliente?.cnpj_cpf?.replace(/\D/g, "")
    // Resolve lead: email → CNPJ → CPF
    let lead: { id: string; cidade?: string; estado?: string; empresa_cnpj?: string } | null = null
    if (email) {
      const { data } = await (supabase as any).from("lia_attendances")
        .select("id,cidade,estado,empresa_cnpj")
        .eq("email", email).is("merged_into", null).maybeSingle()
      lead = data
    }
    if (!lead && cnpjCpfNorm) {
      const { data } = await (supabase as any).from("lia_attendances")
        .select("id,cidade,estado,empresa_cnpj")
        .eq("empresa_cnpj", cnpjCpfNorm).is("merged_into", null).maybeSingle()
      lead = data
    }
    if (!lead && cnpjCpfNorm) {
      const { data } = await (supabase as any).from("lia_attendances")
        .select("id,cidade,estado,empresa_cnpj")
        .eq("pessoa_cpf", cnpjCpfNorm).is("merged_into", null).maybeSingle()
      lead = data
    }
    if (!lead) return
    const patch: Record<string, any> = {
      omie_codigo_cliente:  event.codigo_cliente_omie,
      omie_last_sync:       new Date().toISOString(),
      omie_tipo_pessoa:     cliente.pessoa_fisica === "S" ? "PF" : "PJ",
    }
    if (!lead.cidade && cliente.cidade)          patch.cidade            = cliente.cidade
    if (!lead.estado && cliente.estado)          patch.estado            = cliente.estado
    if (!lead.empresa_cnpj && cnpjCpfNorm)       patch.empresa_cnpj      = cnpjCpfNorm
    if (cliente.razao_social)                     patch.omie_razao_social  = cliente.razao_social
    if (cliente.tags?.length)                     patch.omie_segmento      = cliente.tags[0]
    await (supabase as any).from("lia_attendances").update(patch).eq("id", lead.id)
    return
  }
}

// ─── runSync — Fase A incremental (para cron leve) ───────────────────────────
async function runSync(supabase: ReturnType<typeof createClient>) {
  const startTime = Date.now()
  const TIMEOUT_MS = 50_000 // 50s guard
  console.log("Sync incremental Omie — apenas Fase A (clientes)")
  leadsToEnrich.clear()
  let totalClientes = 0
  let pagina = 1

  // Recuperar cursor salvo
  const { data: cursorRow } = await (supabase as any).from("omie_sync_cursors")
    .select("cursor_value").eq("cursor_key", "sync_clientes_pagina").maybeSingle()
  if (cursorRow?.cursor_value) {
    pagina = parseInt(cursorRow.cursor_value) || 1
  }

  while (true) {
    if (Date.now() - startTime > TIMEOUT_MS) {
      console.log(`Timeout guard: parando na página ${pagina}`)
      // Salvar cursor para retomar
      await (supabase as any).from("omie_sync_cursors")
        .upsert({ cursor_key: "sync_clientes_pagina", cursor_value: String(pagina), updated_at: new Date().toISOString() },
          { onConflict: "cursor_key" })
      break
    }
    const data = await omieGet("/geral/clientes/", "ListarClientes", {
      pagina, registros_por_pagina: 50
    })
    for (const c of data.clientes_cadastro ?? []) {
      const email    = c.email?.toLowerCase()?.trim()
      const cnpjNorm = c.cnpj_cpf?.replace(/\D/g,"")
      if (!email && !cnpjNorm) continue

      let lead: { id: string } | null = null
      if (email) {
        const { data: r } = await (supabase as any).from("lia_attendances").select("id")
          .eq("email", email).is("merged_into", null).maybeSingle()
        lead = r
      }
      if (!lead && cnpjNorm) {
        const { data: r } = await (supabase as any).from("lia_attendances").select("id")
          .eq("empresa_cnpj", cnpjNorm).is("merged_into", null).maybeSingle()
        lead = r
      }
      if (!lead && cnpjNorm) {
        const { data: r } = await (supabase as any).from("lia_attendances").select("id")
          .eq("pessoa_cpf", cnpjNorm).is("merged_into", null).maybeSingle()
        lead = r
      }
      if (!lead && c.telefone1_ddd && c.telefone1_numero) {
        const tel = normalizePhone(c.telefone1_ddd, c.telefone1_numero)
        if (tel) {
          const { data: r } = await (supabase as any).from("lia_attendances").select("id")
            .eq("telefone_normalized", tel).is("merged_into", null).maybeSingle()
          lead = r
        }
      }
      if (!lead) continue

      const { data: cur } = await (supabase as any).from("lia_attendances")
        .select("cidade,estado,empresa_cnpj").eq("id", lead.id).single()
      const patch: Record<string, any> = {
        omie_codigo_cliente:  c.codigo_cliente_omie,
        omie_last_sync:       new Date().toISOString(),
        omie_tipo_pessoa:     c.pessoa_fisica === "S" ? "PF" : "PJ",
      }
      if (!cur?.cidade       && c.cidade)  patch.cidade            = c.cidade
      if (!cur?.estado       && c.estado)  patch.estado            = c.estado
      if (!cur?.empresa_cnpj && cnpjNorm)  patch.empresa_cnpj      = cnpjNorm
      if (c.razao_social)                  patch.omie_razao_social  = c.razao_social
      if (c.tags?.length)                  patch.omie_segmento      = c.tags[0]
      await (supabase as any).from("lia_attendances").update(patch).eq("id", lead.id)
      queueEnrich(lead.id)
      totalClientes++
    }
    if (pagina >= (data.total_de_paginas ?? 1)) {
      // Completou — resetar cursor
      await (supabase as any).from("omie_sync_cursors")
        .upsert({ cursor_key: "sync_clientes_pagina", cursor_value: "1", updated_at: new Date().toISOString() },
          { onConflict: "cursor_key" })
      break
    }
    pagina++
    await sleep(280)
  }
  console.log(`Sync: ${totalClientes} clientes vinculados`)

  // Fase D rápida: atualizar parcelas vencidas
  try { await (supabase as any).rpc("fn_atualizar_parcelas_vencidas") } catch (_) {}

  const scoreCount = await flushEnrichQueue(supabase, "Sync score")
  return { totalClientes, scoreCount }
}

// ─── runBackfill — 6 fases com debounce ──────────────────────────────────────
async function runBackfill(supabase: ReturnType<typeof createClient>) {
  console.log("Backfill Omie iniciado — 6 fases")
  leadsToEnrich.clear()
  let totalClientes = 0, totalPedidos = 0, totalEntregas = 0
  let totalContasReceber = 0, totalNFe = 0
  let pagina = 1

  // ── Fase A: clientes (matching expandido) ──
  while (true) {
    const data = await omieGet("/geral/clientes/", "ListarClientes", {
      pagina, registros_por_pagina: 50
    })
    for (const c of data.clientes_cadastro ?? []) {
      const email    = c.email?.toLowerCase()?.trim()
      const cnpjNorm = c.cnpj_cpf?.replace(/\D/g,"")
      if (!email && !cnpjNorm) continue

      let lead: { id: string } | null = null
      if (email) {
        const { data: r } = await (supabase as any).from("lia_attendances").select("id")
          .eq("email", email).is("merged_into", null).maybeSingle()
        lead = r
      }
      if (!lead && cnpjNorm) {
        const { data: r } = await (supabase as any).from("lia_attendances").select("id")
          .eq("empresa_cnpj", cnpjNorm).is("merged_into", null).maybeSingle()
        lead = r
      }
      if (!lead && cnpjNorm) {
        // Fallback: busca por CPF (pessoa física)
        const { data: r } = await (supabase as any).from("lia_attendances").select("id")
          .eq("pessoa_cpf", cnpjNorm).is("merged_into", null).maybeSingle()
        lead = r
      }
      if (!lead && c.telefone1_ddd && c.telefone1_numero) {
        const tel = normalizePhone(c.telefone1_ddd, c.telefone1_numero)
        if (tel) {
          const { data: r } = await (supabase as any).from("lia_attendances").select("id")
            .eq("telefone_normalized", tel)
            .is("merged_into", null).maybeSingle()
          lead = r
        }
      }
      if (!lead) continue

      const { data: cur } = await (supabase as any).from("lia_attendances")
        .select("cidade,estado,empresa_cnpj").eq("id", lead.id).single()
      const patch: Record<string, any> = {
        omie_codigo_cliente:  c.codigo_cliente_omie,
        omie_last_sync:       new Date().toISOString(),
        omie_tipo_pessoa:     c.pessoa_fisica === "S" ? "PF" : "PJ",
      }
      if (!cur?.cidade       && c.cidade)  patch.cidade            = c.cidade
      if (!cur?.estado       && c.estado)  patch.estado            = c.estado
      if (!cur?.empresa_cnpj && cnpjNorm)  patch.empresa_cnpj      = cnpjNorm
      if (c.razao_social)             patch.omie_razao_social  = c.razao_social
      if (c.tags?.length)             patch.omie_segmento      = c.tags[0]
      await (supabase as any).from("lia_attendances").update(patch).eq("id", lead.id)
      queueEnrich(lead.id)
      totalClientes++
    }
    if (pagina >= (data.total_de_paginas ?? 1)) break
    pagina++
    await sleep(280)
  }
  console.log(`Fase A: ${totalClientes} clientes`)

  // ── Fase B: pedidos faturados (etapa=60) ──
  pagina = 1
  while (true) {
    const data = await omieGet("/produtos/pedido/", "ListarPedidos", {
      pagina, registros_por_pagina: 20, etapa: "60", status_pedido: "FATURADO"
    })
    for (const resumo of data.pedido_venda_produto ?? []) {
      try {
        const pedido = await omieGet("/produtos/pedido/", "ConsultarPedido", {
          nCodPed: resumo.cabecalho.codigo_pedido
        })
        const info = pedido.infoCadastro ?? {}
        const lead = await resolveLeadByOmieEvent(supabase, resumo.cabecalho, pedido?.cabecalho)
        if (!lead) { await sleep(100); continue }
        if (info.cancelado === "S") {
          await updateErpStatus(supabase, lead.id, "CANCELADO", "backfill.cancelado")
          await (supabase as any).from("omie_parcelas").update({ status: "CANCELADO" })
            .eq("lead_id", lead.id).in("status", ["PENDENTE","VENCIDO"])
          queueEnrich(lead.id)
          await sleep(100); continue
        }
        if (info.devolvido === "S") {
          await updateErpStatus(supabase, lead.id, "DEVOLVIDO", "backfill.devolvido")
          queueEnrich(lead.id)
          await sleep(100); continue
        }
        if (info.faturado !== "S") { await sleep(100); continue }
        await updateErpStatus(supabase, lead.id, "FATURADO", "backfill.faturado")

        // Batch: upsert items + queue (NÃO enriquecer agora)
        const dealItems: object[] = []
        for (const item of pedido.det ?? []) {
          const p = item.produto
          dealItems.push({
            lead_id: lead.id, source: "omie",
            product_name: p.descricao,
            product_code: String(p.codigo ?? ""),
            quantity:    parseFloat(p.quantidade ?? 1),
            unit_value:  parseFloat(p.valor_unitario ?? 0),
            total_value: parseFloat(p.valor_total ?? 0),
            nfe_number:  String(resumo.cabecalho.numero_pedido ?? ""),
            proposal_id: 'omie-direct',
            synced_at:   new Date().toISOString()
          })
        }
        if (dealItems.length > 0) {
          await (supabase as any).from("deal_items")
            .upsert(dealItems, { onConflict: "lead_id,nfe_number,product_code", ignoreDuplicates: true })
        }
        await upsertParcelas(supabase, lead.id, pedido)
        const freteData = extractFreteData(pedido)
        if (freteData.frete_tipo !== "SEM_FRETE" && freteData.frete_tipo !== "FOB") {
          await updateFreteStatus(supabase, lead.id, freteData.frete_status, {
            ...freteData, event_name: "backfill.frete"
          })
        }
        queueEnrich(lead.id)
        totalPedidos++
      } catch (e) { console.warn("Erro pedido B:", e) }
      await sleep(300)
    }
    console.log(`Fase B p${pagina}/${data.total_de_paginas ?? 1}: ${totalPedidos}`)
    if (pagina >= (data.total_de_paginas ?? 1)) break
    pagina++
    await sleep(280)
  }
  console.log(`Fase B: ${totalPedidos} pedidos`)

  // ── Fase C: pedidos entregues (etapa=70) ──
  pagina = 1
  while (true) {
    const entregues = await omieGet("/produtos/pedido/", "ListarPedidos", {
      pagina, registros_por_pagina: 50, etapa: "70", status_pedido: "FATURADO"
    })
    for (const pedido of entregues?.pedido_venda_produto ?? []) {
      const info = pedido.infoCadastro ?? {}
      const cab  = pedido.cabecalho   ?? {}
      const lead = await resolveLeadByOmieEvent(supabase, { nCodCliente: cab.codigo_cliente }, cab)
      if (!lead) { await sleep(150); continue }
      if (info.cancelado === "S") {
        await updateErpStatus(supabase, lead.id, "CANCELADO", "backfill.etapa70.cancelado")
      } else if (info.devolvido === "S") {
        await updateErpStatus(supabase, lead.id, "DEVOLVIDO", "backfill.etapa70.devolvido")
        await updateFreteStatus(supabase, lead.id, "DEVOLVIDO", { event_name: "backfill.etapa70" })
      } else if (info.faturado === "S") {
        const rastreio = pedido.frete?.codigo_rastreio || null
        if (rastreio) {
          await updateFreteStatus(supabase, lead.id, "ENTREGUE", {
            frete_codigo_rastreio: rastreio,
            frete_transportadora: pedido.frete?.codigo_transportadora
              ? String(pedido.frete.codigo_transportadora) : null,
            event_name: "backfill.etapa70.entregue"
          })
          totalEntregas++
        }
      }
      queueEnrich(lead.id)
      await sleep(200)
    }
    console.log(`Fase C p${pagina}/${entregues.total_de_paginas ?? 1}: ${totalEntregas}`)
    if (pagina >= (entregues.total_de_paginas ?? 1)) break
    pagina++
    await sleep(300)
  }
  console.log(`Fase C: ${totalEntregas} entregas`)

  // ── Fase D: parcelas vencidas ──
  await (supabase as any).rpc("fn_atualizar_parcelas_vencidas")
  console.log("Fase D: parcelas vencidas atualizadas")

  // ── Fase E: Contas a Receber ──
  pagina = 1
  while (true) {
    const data = await omieGet("/financas/contareceber/", "ListarContasReceber", {
      pagina, registros_por_pagina: 100, apenas_importado_api: "N"
    })
    const titulos: any[] = data.conta_receber_cadastro ?? []
    if (!titulos.length && pagina === 1) {
      console.warn("Fase E: array key não encontrado. Keys:", Object.keys(data))
      break
    }
    for (const titulo of titulos) {
      try {
        const codigoCliente = titulo.codigo_cliente_fornecedor
        if (!codigoCliente) continue
        const lead = await resolveLeadByOmieEvent(supabase, { nCodCliente: codigoCliente })
        if (!lead) continue
        const dataVenc = parseOmieDate(titulo.data_vencimento)
        if (!dataVenc) continue
        const statusParcela = (() => {
          const s = (titulo.status_titulo ?? "").toUpperCase().trim()
          if (["RECEBIDO","LIQUIDADO","BAIXADO"].includes(s)) return "PAGO"
          if (["ATRASADO","VENCIDO"].includes(s))             return "VENCIDO"
          if (s === "CANCELADO")                              return "CANCELADO"
          return dataVenc < new Date() ? "VENCIDO" : "PENDENTE"
        })()
        const tituloId = titulo.codigo_lancamento_omie || titulo.nCodTitulo
        if (!tituloId) continue
        await (supabase as any).from("omie_parcelas").upsert([{
          lead_id:         lead.id,
          omie_titulo_id:  Number(String(tituloId)),
          numero_pedido:   titulo.numero_titulo ?? null,
          numero_parcela:  parseInt(titulo.codigo_parcela ?? "1") || 1,
          total_parcelas:  1,
          valor:           parseFloat(titulo.valor_documento ?? 0),
          data_vencimento: dataVenc.toISOString().split("T")[0],
          tipo_documento:  mapTipoDocumento(titulo.tipo_documento),
          status:          statusParcela,
          valor_pago:      statusParcela === "PAGO"
                             ? parseFloat(titulo.valor_documento ?? 0) : 0,
          data_pagamento:  statusParcela === "PAGO"
                             ? parseOmieDate(titulo.data_previsao)?.toISOString().split("T")[0] ?? null
                             : null,
          source:          "omie_cr",
        }], { onConflict: "omie_titulo_id", ignoreDuplicates: false })
        queueEnrich(lead.id)
        totalContasReceber++
      } catch (e) { console.warn("Erro CR:", e) }
    }
    console.log(`Fase E p${pagina}/${data.total_de_paginas ?? 1}: ${totalContasReceber}`)
    if (pagina >= (data.total_de_paginas ?? 1)) break
    pagina++
    await sleep(280)
  }
  console.log(`Fase E: ${totalContasReceber} contas a receber`)

  // ── Fase F: NF-e ──
  pagina = 1
  while (true) {
    const data = await omieGet("/faturamento/nfe/", "ListarNF", {
      pagina, registros_por_pagina: 50, tpNF: "1"
    })
    const nfes: any[] =
      data.list_nfce ?? data.nfce ?? data.nfe ?? data.list_nfe ?? []
    if (!nfes.length && pagina === 1) {
      console.warn("Fase F: array key não encontrado. Keys:", Object.keys(data))
      break
    }
    for (const nf of nfes) {
      try {
        if (nf.ide?.tpNF !== "1") continue
        const chaveNFe: string = nf.compl?.cChaveNFe ?? ""
        if (!chaveNFe || chaveNFe.length !== 44) continue
        const lead = await resolveLeadByOmieEvent(supabase, {
          nCodCli: nf.nfDestInt?.nCodCli, cCNPJCPF: nf.nfDestInt?.cnpj_cpf
        })
        if (!lead) continue
        const dataEmissao = parseOmieDate(nf.ide?.dEmi)
        const nfNumber    = nf.ide?.nNF ?? chaveNFe.slice(-9)
        const dealItems: object[] = []
        for (const det of nf.det ?? []) {
          const p = det.prod ?? {}
          if (!p.xProd) continue
          dealItems.push({
            lead_id:       lead.id,
            source:        "omie_nfe",
            product_name:  p.xProd,
            product_code:  String(p.cProd ?? ""),
            quantity:      parseFloat(p.qCom ?? 1),
            unit_value:    parseFloat(p.vUnCom ?? 0),
            total_value:   parseFloat(p.vProd ?? 0),
            serial_number: null,
            nfe_number:    String(nfNumber),
            nfe_chave:     chaveNFe,
            proposal_id:   'omie-direct',
            synced_at:     dataEmissao?.toISOString() ?? new Date().toISOString()
          })
        }
        if (dealItems.length > 0) {
          await (supabase as any).from("deal_items")
            .upsert(dealItems, { onConflict: "lead_id,nfe_number,product_code", ignoreDuplicates: true })
        }
        if (nf.titulos?.length) {
          await upsertParcelas(supabase, lead.id,
            { cabecalho: {}, lista_parcelas: { parcela: [] }, titulos: nf.titulos },
            chaveNFe
          )
        }
        // Atualiza omie_ultima_nf_emitida se for mais recente
        if (dataEmissao) {
          const dataStr = dataEmissao.toISOString().split("T")[0]
          await (supabase as any).from("lia_attendances")
            .update({ omie_ultima_nf_emitida: dataStr })
            .eq("id", lead.id)
            .or(`omie_ultima_nf_emitida.is.null,omie_ultima_nf_emitida.lt.${dataStr}`)
        }
        queueEnrich(lead.id)
        totalNFe++
        await sleep(150)
      } catch (e) { console.warn("Erro NF-e F:", e) }
    }
    console.log(`Fase F p${pagina}/${data.total_de_paginas ?? 1}: ${totalNFe}`)
    if (pagina >= (data.total_de_paginas ?? 1)) break
    pagina++
    await sleep(280)
  }
  console.log(`Fase F: ${totalNFe} NF-e`)

  // ── Flush: enriquece TODOS os leads tocados — 1x cada ──
  const scoreCount = await flushEnrichQueue(supabase, "Backfill score")

  return { totalClientes, totalPedidos, totalEntregas, totalContasReceber, totalNFe, scoreCount }
}

// ─── Entry point ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )
    const url    = new URL(req.url)
    const action = url.searchParams.get("action")
    const body   = req.method === "POST" ? await req.json().catch(() => null) : null

    if (action === "cobrancas") {
      const total = await dispararCobrancas(supabase)
      return new Response(JSON.stringify({ ok: true, cobradas: total }), { headers: CORS })
    }
    if (action === "enrich") {
      const leadId = url.searchParams.get("lead_id")
      if (!leadId) return new Response(JSON.stringify({ error: "lead_id required" }), { status: 400, headers: CORS })
      await enrichLead(supabase, leadId)
      return new Response(JSON.stringify({ ok: true }), { headers: CORS })
    }
    if (action === "sync") {
      const result = await runSync(supabase)
      return new Response(JSON.stringify({ ok: true, ...result }), { headers: CORS })
    }
    if (body?.topic) {
      await handleWebhook(supabase, body)
      return new Response(JSON.stringify({ ok: true }), { headers: CORS })
    }
    const result = await runBackfill(supabase)
    return new Response(JSON.stringify({ ok: true, ...result }), { headers: CORS })
  } catch (err) {
    console.error("Erro:", err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS })
  }
})
