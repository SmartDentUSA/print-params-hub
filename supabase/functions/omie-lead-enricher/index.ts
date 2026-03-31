import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }

// ─── Omie API — somente leitura ───────────────────────────────────────────────
async function omieGet(endpoint: string, call: string, params: object) {
  const res = await fetch(`https://app.omie.com.br/api/v1${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_key:    Deno.env.get("OMIE_APP_KEY"),
      app_secret: Deno.env.get("OMIE_APP_SECRET"),
      call,
      param: [params]
    })
  })
  if (!res.ok) throw new Error(`Omie HTTP ${res.status} em ${call}`)
  return res.json()
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Identity resolution: omie_id → CNPJ → email ─────────────────────────────
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
    const { data } = await supabase
      .from("lia_attendances").select("id")
      .eq("omie_codigo_cliente", codigoCliente)
      .is("merged_into", null).maybeSingle()
    if (data) return data
  }

  const cnpjCpf = (
    event.cCNPJCPF              ||
    event.cnpj_cpf              ||
    pedidoCabecalho?.cnpj_cpf_cliente
  )
  if (cnpjCpf) {
    const { data } = await supabase
      .from("lia_attendances").select("id")
      .eq("cnpj", cnpjCpf.replace(/\D/g, ""))
      .is("merged_into", null).maybeSingle()
    if (data) return data
  }

  const email = (
    event.cEmail                          ||
    pedidoCabecalho?.email_cliente        ||
    pedidoCabecalho?.utilizar_emails      ||
    event.utilizar_emails
  )?.split(",")[0]?.toLowerCase()?.trim()

  if (email) {
    const { data } = await supabase
      .from("lia_attendances").select("id")
      .eq("email", email).is("merged_into", null).maybeSingle()
    if (data) return data
  }

  console.warn("Lead não encontrado:", { codigoCliente, cnpjCpf, email })
  return null
}

// ─── Detecta equipamento pelo nome do produto ─────────────────────────────────
function detectEquipField(desc: string): "equip_impressora" | "equip_scanner" | "equip_cad" | null {
  const d = desc.toUpperCase()
  if (
    d.includes("VITALITY") || d.includes("IMPRESSORA") || d.includes("BIO") ||
    d.includes("MIICRAFT") || d.includes("EDGEMINI")  || d.includes("IOCONNECT") ||
    d.includes("ELEGOO")   || d.includes("PIONEXT")   || d.includes("HALOT") ||
    d.includes("MARS ")    || d.includes("IMPRESS 3D")|| d.includes("WASH AND CURE") ||
    d.includes("BAND. IMPRESS") || d.includes("IMPRESSORA 3D")
  ) return "equip_impressora"
  if (
    d.includes("SCANNER") || d.includes("MEDIT") || d.includes("INTRAORAL") ||
    d.includes("I600")     || d.includes("I700") || d.includes("TRIOS") ||
    d.includes("INO")      || d.includes("BLZ")
  ) return "equip_scanner"
  if (
    d.includes("EXOCAD") || d.includes("CAD") ||
    d.includes("SOFTWARE") || d.includes("LICEN")
  ) return "equip_cad"
  return null
}

// ─── Mapeamento de eventos Omie → erp_status (tudo lowercase) ────────────────
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

// ─── updateErpStatus com race condition guard e idempotência ─────────────────
async function updateErpStatus(
  supabase: ReturnType<typeof createClient>,
  leadId: string, newStatus: string, eventName: string
) {
  if (!leadId) return
  const now = new Date().toISOString()

  const { data: updated } = await supabase
    .from("lia_attendances")
    .update({ erp_status: newStatus, erp_last_event: eventName, erp_updated_at: now })
    .eq("id", leadId)
    .or(`erp_updated_at.is.null,erp_updated_at.lt.${now}`)
    .select("id").maybeSingle()

  if (!updated) {
    console.warn(`Race condition erp: ${eventName} ignorado para ${leadId}`)
    return
  }

  const since = new Date(Date.now() - 86_400_000).toISOString()
  const { count } = await supabase.from("deal_status_history")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId).eq("event_name", eventName)
    .eq("status", newStatus).gte("created_at", since)

  if ((count ?? 0) === 0) {
    await supabase.from("deal_status_history")
      .insert({ lead_id: leadId, source: "erp", status: newStatus, event_name: eventName })
  }
  console.log(`✓ erp_status → ${newStatus} (${eventName}) | ${leadId}`)
}

// ─── Status anterior para reversão ───────────────────────────────────────────
async function getPreviousErpStatus(
  supabase: ReturnType<typeof createClient>, leadId: string
): Promise<string> {
  const { data } = await supabase.from("deal_status_history")
    .select("status").eq("lead_id", leadId).eq("source", "erp")
    .neq("status", "PAGO").order("created_at", { ascending: false }).limit(2)
  return data?.[1]?.status || data?.[0]?.status || "ORCADO"
}

// ─── Frete: extração com campos reais da API ──────────────────────────────────
function mapFreteType(modalidade: string | undefined): string {
  return ({ "0":"CIF","1":"FOB","2":"TERCEIROS","9":"SEM_FRETE" })[modalidade ?? "9"] ?? "SEM_FRETE"
}

function extractFreteData(pedido: any) {
  const frete = pedido?.frete ?? {}
  const tipo  = mapFreteType(String(frete.modalidade ?? "9"))
  if (tipo === "SEM_FRETE" || tipo === "FOB") {
    return {
      frete_status: "NONE", frete_transportadora: null as string | null,
      frete_codigo_rastreio: null as string | null, frete_link_rastreio: null as string | null,
      frete_valor: null as number | null, frete_tipo: tipo, frete_previsao_entrega: null as string | null
    }
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

  const { data: updated } = await supabase
    .from("lia_attendances").update(patch).eq("id", leadId)
    .or(`frete_updated_at.is.null,frete_updated_at.lt.${now}`)
    .select("id").maybeSingle()

  if (!updated) { console.warn(`Race condition frete ignorado: ${leadId}`); return }

  const since = new Date(Date.now() - 86_400_000).toISOString()
  const { count } = await supabase.from("deal_status_history")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId).eq("event_name", eventName)
    .eq("status", `FRETE:${newStatus}`).gte("created_at", since)

  if ((count ?? 0) === 0) {
    await supabase.from("deal_status_history").insert({
      lead_id: leadId, source: "erp", status: `FRETE:${newStatus}`, event_name: eventName
    })
  }
  console.log(`✓ frete_status → ${newStatus} | ${leadId}`)
}

// ─── Extração de seriais do texto livre da NF ─────────────────────────────────
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
    if (campo) seriais[campo] = serial
    else seriais["serial_eq_1"] = serial
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

// ─── parseOmieDate DD/MM/YYYY → Date ─────────────────────────────────────────
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
      omie_pedido_id:   cab.codigo_pedido   ? Number(cab.codigo_pedido)  : null,
      omie_titulo_id:   p.nCodTitulo        ? Number(p.nCodTitulo)       : null,
      omie_titulo_repet:p.nCodTitRepet      ? Number(p.nCodTitRepet)     : null,
      nfe_chave:        nfeChave            ?? null,
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

  const { error } = await supabase.from("omie_parcelas")
    .upsert(rows, { onConflict: "omie_pedido_id,numero_parcela", ignoreDuplicates: false })
  if (error) console.error("upsertParcelas:", error.message)
  else console.log(`✓ ${rows.length} parcelas | lead ${leadId}`)
}

// ─── marcarParcelaPaga ────────────────────────────────────────────────────────
async function marcarParcelaPaga(
  supabase: ReturnType<typeof createClient>,
  tituloId: number, valorPago?: number
) {
  const { data: parcela } = await supabase.from("omie_parcelas")
    .select("id, lead_id").eq("omie_titulo_id", tituloId).maybeSingle()
  if (!parcela) return

  await supabase.from("omie_parcelas").update({
    status: "PAGO", valor_pago: valorPago ?? null,
    data_pagamento: new Date().toISOString().split("T")[0]
  }).eq("id", parcela.id)

  const { data: pendentes } = await supabase.from("omie_parcelas")
    .select("id").eq("lead_id", parcela.lead_id).in("status", ["PENDENTE","VENCIDO"])
  if ((pendentes?.length ?? 0) === 0) {
    await updateErpStatus(supabase, parcela.lead_id, "PAGO", "financeiro.quitado")
  }
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
    await supabase.from("deal_items")
      .upsert(dealItems, { onConflict: "lead_id,nfe_number,product_code", ignoreDuplicates: true })
  }

  const seriais = extractSeriaisFromNF(pedido)

  const { data: allItems } = await supabase
    .from("deal_items").select("total_value").eq("lead_id", leadId)
  const newLtv = (allItems ?? []).reduce((s: number, i: any) => s + (i.total_value ?? 0), 0)

  const { data: cur } = await supabase.from("lia_attendances")
    .select("equip_impressora,equip_scanner,equip_cad,omie_nf_count")
    .eq("id", leadId).single()

  const patch: Record<string, any> = {
    ltv_total:             newLtv,
    proposals_total_value: newLtv,
    status_oportunidade:   "ganha",
    omie_last_sync:        new Date().toISOString(),
    omie_nf_count:         (cur?.omie_nf_count ?? 0) + 1,
    omie_codigo_cliente:   pedido.cabecalho?.codigo_cliente ?? undefined,
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

  await supabase.from("lia_attendances").update(patch).eq("id", leadId)
  await upsertParcelas(supabase, leadId, pedido)

  const freteData = extractFreteData(pedido)
  if (freteData.frete_tipo !== "SEM_FRETE" && freteData.frete_tipo !== "FOB") {
    await updateFreteStatus(supabase, leadId, freteData.frete_status, {
      ...freteData, event_name: "pedido.faturado.frete"
    })
  } else {
    await supabase.from("lia_attendances")
      .update({ frete_status: "NONE", frete_tipo: freteData.frete_tipo }).eq("id", leadId)
  }

  try { await supabase.rpc("calculate_lead_intelligence_score", { p_lead_id: leadId }) }
  catch (e) { console.warn("Score RPC:", e) }

  console.log(`✓ Lead ${leadId} | LTV R$${newLtv.toFixed(2)} | itens: ${dealItems.length}`)
}

// ─── Cobranças automáticas via SellFlux ──────────────────────────────────────
async function dispararCobrancas(supabase: ReturnType<typeof createClient>) {
  console.log("Verificando cobranças...")
  const janelas = [1, 3, 7, 15, 30]
  let total = 0

  for (const dias of janelas) {
    const dataAlvo = new Date()
    dataAlvo.setDate(dataAlvo.getDate() - dias)
    const dataStr  = dataAlvo.toISOString().split("T")[0]

    const { data: parcelas } = await supabase.from("omie_parcelas")
      .select("id,lead_id,valor,data_vencimento,numero_parcela,total_parcelas,cobranca_count")
      .eq("status","VENCIDO").eq("data_vencimento", dataStr)
      .lt("cobranca_count", 3).limit(50)

    for (const p of parcelas ?? []) {
      const { data: lead } = await supabase.from("lia_attendances")
        .select("email,telefone_normalized,nome").eq("id", p.lead_id).single()
      if (!lead?.email) continue

      try {
        const url = Deno.env.get("SELLFLUX_WEBHOOK_URL")
        if (url) {
          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: lead.email, telefone: lead.telefone_normalized, nome: lead.nome,
              tag: `cobranca_${dias}dias`, valor_parcela: p.valor,
              data_vencimento: p.data_vencimento, numero_parcela: p.numero_parcela,
              total_parcelas: p.total_parcelas, dias_vencido: dias,
            })
          })
        }
        await supabase.from("omie_parcelas").update({
          cobranca_enviada_em: new Date().toISOString(),
          cobranca_canal: "sellflux",
          cobranca_count: (p.cobranca_count ?? 0) + 1
        }).eq("id", p.id)
        await supabase.from("deal_status_history").insert({
          lead_id: p.lead_id, source: "erp",
          status: `COBRANCA:${dias}d`, event_name: `cobranca.automatica.${dias}dias`
        })
        total++
        await sleep(200)
      } catch (e) { console.warn(`Erro cobrança ${p.lead_id}:`, e) }
    }
  }
  console.log(`Cobranças enviadas: ${total}`)
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
      }
    } catch (e) { console.warn("NF consulta:", e) }
    return
  }

  if (
    topic === "vendaproduto.cancelada" || topic === "nfe.cancelada"  ||
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
    await supabase.from("omie_parcelas")
      .update({ status: "CANCELADO" })
      .eq("lead_id", lead.id).in("status", ["PENDENTE","VENCIDO"])
    return
  }

  if (topic === "financas.contareceber.baixarealizada" || topic === "financas.contareceber.baixa") {
    const tituloId = event.nCodTitulo || event.codigo_titulo
    if (tituloId) {
      await marcarParcelaPaga(supabase, Number(tituloId), parseFloat(event.nValorTitulo ?? 0) || undefined)
    } else {
      const lead = await resolveLeadByOmieEvent(supabase, event)
      if (lead) await updateErpStatus(supabase, lead.id, "PAGO", topic)
    }
    return
  }

  if (topic === "financas.contareceber.baixacancelada") {
    const tituloId = event.nCodTitulo || event.codigo_titulo
    if (tituloId) {
      await supabase.from("omie_parcelas").update({
        status: "PENDENTE", valor_pago: 0, data_pagamento: null
      }).eq("omie_titulo_id", Number(tituloId))
    }
    const lead = await resolveLeadByOmieEvent(supabase, event)
    if (lead) {
      const prev = await getPreviousErpStatus(supabase, lead.id)
      await updateErpStatus(supabase, lead.id, prev, topic)
    }
    return
  }

  if (topic === "remessaproduto.incluida" || topic === "remessa.incluida") {
    const lead = await resolveLeadByOmieEvent(supabase, event)
    if (!lead) return
    const rastreio = event.cCodRastreio || null
    await updateFreteStatus(supabase, lead.id, rastreio ? "EM_TRANSITO" : "DESPACHADO", {
      frete_codigo_rastreio: rastreio,
      frete_transportadora:  event.cTransportadora || null,
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
    if (!email) return
    const { data: lead } = await supabase.from("lia_attendances")
      .select("id,cidade,estado").eq("email", email).is("merged_into", null).maybeSingle()
    if (!lead) return
    const patch: Record<string, any> = {
      omie_codigo_cliente: event.codigo_cliente_omie,
      omie_last_sync: new Date().toISOString()
    }
    if (!lead.cidade && cliente.cidade) patch.cidade = cliente.cidade
    if (!lead.estado && cliente.estado) patch.estado = cliente.estado
    await supabase.from("lia_attendances").update(patch).eq("id", lead.id)
    return
  }
}

// ─── runBackfill ──────────────────────────────────────────────────────────────
async function runBackfill(supabase: ReturnType<typeof createClient>) {
  console.log("Backfill Omie iniciado...")
  let totalClientes = 0, totalPedidos = 0, totalEntregas = 0
  let pagina = 1

  // Fase A: dados cadastrais
  while (true) {
    const data = await omieGet("/geral/clientes/", "ListarClientes", {
      pagina, registros_por_pagina: 50
    })
    for (const c of data.clientes_cadastro ?? []) {
      const email = c.email?.toLowerCase()?.trim()
      if (!email) continue
      const { data: lead } = await supabase.from("lia_attendances")
        .select("id,cidade,estado")
        .eq("email", email).is("merged_into", null).maybeSingle()
      if (!lead) continue
      const patch: Record<string, any> = {
        omie_codigo_cliente: c.codigo_cliente_omie,
        omie_last_sync: new Date().toISOString()
      }
      if (!lead.cidade && c.cidade) patch.cidade = c.cidade
      if (!lead.estado && c.estado) patch.estado = c.estado
      await supabase.from("lia_attendances").update(patch).eq("id", lead.id)
      totalClientes++
    }
    if (pagina >= (data.total_de_paginas ?? 1)) break
    pagina++
    await sleep(280)
  }
  console.log(`Fase A: ${totalClientes} clientes`)

  // Fase B: pedidos faturados (etapa=60)
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
          await supabase.from("omie_parcelas")
            .update({ status: "CANCELADO" })
            .eq("lead_id", lead.id).in("status", ["PENDENTE","VENCIDO"])
          await sleep(100); continue
        }
        if (info.devolvido === "S") {
          await updateErpStatus(supabase, lead.id, "DEVOLVIDO", "backfill.devolvido")
          await sleep(100); continue
        }
        if (info.faturado !== "S") { await sleep(100); continue }

        await updateErpStatus(supabase, lead.id, "FATURADO", "backfill.faturado")
        await enrichFromPedido(supabase, lead.id, pedido, String(resumo.cabecalho.numero_pedido ?? ""))
        totalPedidos++
      } catch (e) { console.warn("Erro pedido B:", e) }
      await sleep(300)
    }
    console.log(`Fase B - p${pagina}/${data.total_de_paginas ?? 1}: ${totalPedidos} pedidos`)
    if (pagina >= (data.total_de_paginas ?? 1)) break
    pagina++
    await sleep(280)
  }
  console.log(`Fase B concluída: ${totalPedidos} pedidos`)

  // Fase C: pedidos entregues (etapa=70)
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
            frete_transportadora:  pedido.frete?.codigo_transportadora
              ? String(pedido.frete.codigo_transportadora) : null,
            event_name: "backfill.etapa70.entregue"
          })
          totalEntregas++
        }
      }
      await sleep(200)
    }
    console.log(`Fase C - p${pagina}/${entregues.total_de_paginas ?? 1}: ${totalEntregas} entregas`)
    if (pagina >= (entregues.total_de_paginas ?? 1)) break
    pagina++
    await sleep(300)
  }
  console.log(`Fase C concluída: ${totalEntregas} entregas`)

  // Fase D: atualiza parcelas vencidas no banco
  await supabase.rpc("fn_atualizar_parcelas_vencidas")
  console.log("Fase D: parcelas vencidas atualizadas")

  return { totalClientes, totalPedidos, totalEntregas }
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