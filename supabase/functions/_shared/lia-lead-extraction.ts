/**
 * LIA Lead Extraction — implicit data extraction from conversation text.
 * Detects: UF, equipment, scanner/printer models, CAD software, volume,
 * applications, product interest (NLP), and competitor mentions.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SupabaseClient = ReturnType<typeof createClient>;

export async function extractImplicitLeadData(
  supabaseClient: SupabaseClient,
  email: string,
  conversationText: string
): Promise<void> {
  const text = conversationText.toLowerCase();
  const updates: Record<string, unknown> = {};

  // UF detection
  const ufMap: Record<string, string> = {
    "são paulo": "SP", "rio de janeiro": "RJ", "minas gerais": "MG",
    "bahia": "BA", "paraná": "PR", "rio grande do sul": "RS",
    "santa catarina": "SC", "goiás": "GO", "pernambuco": "PE",
    "ceará": "CE", "pará": "PA", "maranhão": "MA",
    "mato grosso do sul": "MS", "mato grosso": "MT", "distrito federal": "DF",
    "espírito santo": "ES", "amazonas": "AM", "paraíba": "PB",
    "sergipe": "SE", "alagoas": "AL", "piauí": "PI",
    "rio grande do norte": "RN", "tocantins": "TO", "rondônia": "RO",
    "acre": "AC", "amapá": "AP", "roraima": "RR",
  };
  for (const [nome, sigla] of Object.entries(ufMap)) {
    if (text.includes(nome)) { updates.uf = sigla; break; }
  }
  const ufMatch = text.match(/\b(?:sou de|moro em|estou em|atendo em)\s+([A-Z]{2})\b/i);
  if (ufMatch && !updates.uf) updates.uf = ufMatch[1].toUpperCase();

  // Equipment detection
  if (/\b(?:tenho|comprei|possuo|uso|adquiri)\b.{0,30}\b(?:impressora|printer)\b/i.test(text)) {
    updates.tem_impressora = "sim";
  }
  if (/\b(?:tenho|comprei|possuo|uso|adquiri)\b.{0,30}\b(?:scanner|escaner|escâner)\b/i.test(text)) {
    updates.tem_scanner = "sim";
  }

  // Specific printer models
  const impressoraModels = ["phrozen", "anycubic", "elegoo", "rayshape", "asiga", "formlabs", "prusa", "creality", "miicraft", "blz", "envisiontec", "bego", "dentsply"];
  for (const m of impressoraModels) {
    if (text.includes(m)) { updates.impressora_modelo = m.charAt(0).toUpperCase() + m.slice(1); break; }
  }

  // Specific scanner models
  const scannerModels = ["medit", "3shape", "trios", "itero", "primescan", "aoralscan", "shining3d"];
  for (const m of scannerModels) {
    if (text.includes(m)) { updates.como_digitaliza = m.charAt(0).toUpperCase() + m.slice(1); break; }
  }

  // Software CAD detection
  const cadSoftware = ["exocad", "3shape", "blender", "meshmixer", "dental system", "ceramill", "zirkonzahn", "hyperdent", "dental cad"];
  for (const sw of cadSoftware) {
    if (text.includes(sw)) { updates.software_cad = sw.charAt(0).toUpperCase() + sw.slice(1); break; }
  }

  // Monthly volume detection
  const volumeMatch = text.match(/\b(?:faço|imprimo|produzo|fabrico)\b.{0,30}(\d+)\s*(?:peças?|unidades?|trabalhos?|casos?)\b/i);
  if (volumeMatch) {
    const qty = parseInt(volumeMatch[1]);
    if (qty <= 10) updates.volume_mensal_pecas = "até 10 peças/mês";
    else if (qty <= 50) updates.volume_mensal_pecas = "10-50 peças/mês";
    else if (qty <= 100) updates.volume_mensal_pecas = "50-100 peças/mês";
    else updates.volume_mensal_pecas = "100+ peças/mês";
  }
  if (!updates.volume_mensal_pecas) {
    if (/\b(?:muito|bastante|grande volume|alta produção|produção alta)\b/i.test(text)) updates.volume_mensal_pecas = "alto volume";
    if (/\b(?:pouco|poucos?|baixo volume|começ|iniciando)\b/i.test(text)) updates.volume_mensal_pecas = "baixo volume";
  }

  // Primary application detection
  const appPatterns: [RegExp, string][] = [
    [/\b(?:provisórios?|provisorio|temporári|temporario|temp crown)\b/i, "provisórios"],
    [/\b(?:guias? cir[úu]rgic|surgical guide)\b/i, "guias cirúrgicos"],
    [/\b(?:modelos? de estudo|modelo diagnóstico|study model)\b/i, "modelos de estudo"],
    [/\b(?:placa.{0,10}miorrelaxante|placa.{0,10}bruxismo|night guard|splint)\b/i, "placas miorrelaxantes"],
    [/\b(?:coroas? definitiv|prótese fixa|permanent crown)\b/i, "próteses definitivas"],
    [/\b(?:alinhador|clear aligner|ortodont)\b/i, "alinhadores"],
    [/\b(?:moldeira|tray|cubeta)\b/i, "moldeiras individuais"],
  ];
  for (const [pattern, app] of appPatterns) {
    if (pattern.test(text)) { updates.principal_aplicacao = app; break; }
  }

  // Product interest detection (NLP)
  const productPatterns: [RegExp, string][] = [
    [/\brayshape\b/i, "RayShape"], [/\bmiicraft\b/i, "MiiCraft"],
    [/\bphrozen\b/i, "Phrozen"], [/\banycubic\b/i, "Anycubic"],
    [/\belegoo\b/i, "Elegoo"], [/\bformlabs\b/i, "Formlabs"],
    [/\bblz\s*dental\b/i, "BLZ Dental"], [/\basiga\b/i, "Asiga"],
    [/\bprusa\b/i, "Prusa"], [/\bcreality\b/i, "Creality"],
    [/\bmedit\b/i, "Medit"], [/\b3shape\b/i, "3Shape"],
    [/\btrios\b/i, "TRIOS"], [/\bitero\b/i, "iTero"],
    [/\bprimescan\b/i, "Primescan"], [/\baoralscan\b/i, "Aoralscan"],
    [/\bexocad\b/i, "exocad"], [/\bexoplan\b/i, "Exoplan"],
    [/\bsmart\s*slice\b/i, "Smart Slice"],
    [/\bchair\s*side\b/i, "Chair Side Print"],
    [/\bsmart\s*lab\b/i, "Smart Lab"],
    [/\bnanoclean\b/i, "NanoClean"],
    [/\bcurador[a]?\b|\bfotopolimerizador\b|\bcuring\s*unit\b/i, "Pós-processamento"],
  ];
  const detectedProducts: string[] = [];
  for (const [pattern, product] of productPatterns) {
    if (pattern.test(text)) detectedProducts.push(product);
  }
  if (detectedProducts.length > 0) {
    updates.produto_interesse = detectedProducts.slice(0, 3).join(", ");
  }

  // Competitor detection
  const rawUpdates: Record<string, unknown> = {};
  const concorrentes = [
    "formlabs", "nextdent", "keystone", "bego", "detax", "gc", "dentsply",
    "voxelprint", "voxel print", "sprintray", "dentca", "asiga", "ackuretta",
    "graphy", "desktop health", "liqcreate", "shining3d", "uniz", "stratasys",
    "envisiontec", "saremco", "kulzer", "dmg", "vlc", "amann girrbach",
    "ivoclar", "huge dental", "yucera", "harz labs", "dreve"
  ];
  const found = concorrentes.filter(c => text.includes(c));
  if (found.length > 0) rawUpdates.marcas_concorrentes = found;

  if (/\b(?:sozinho|trabalho sozinho|atendo sozinho)\b/i.test(text)) rawUpdates.estrutura_consultorio = "sozinho";
  if (/\b(?:equipe|parceiro|sócio|sócia|associado)\b/i.test(text)) rawUpdates.estrutura_consultorio = "equipe";
  if (/\b(?:já conheço|conheço a smart|uso smart|cliente smart)\b/i.test(text)) rawUpdates.conhece_smart_dent = true;
  if (/\b(?:nunca usei|parei de usar|deixei de|não uso mais)\b/i.test(text)) rawUpdates.motivo_nao_usa_smart = "mencionou que parou/nunca usou";

  const imprime = text.match(/\b(?:imprimo|faço|produzo)\b.{0,30}\b(placas?|guias?|provisórios?|modelos?|próteses?|coroas?)\b/i);
  if (imprime) rawUpdates.o_que_imprime = imprime[1];
  const querImprimir = text.match(/\b(?:quero imprimir|gostaria de|pretendo)\b.{0,30}\b(placas?|guias?|provisórios?|modelos?|próteses?|coroas?)\b/i);
  if (querImprimir) rawUpdates.o_que_quer_imprimir = querImprimir[1];

  if (Object.keys(rawUpdates).length > 0) updates.raw_payload = rawUpdates;
  if (Object.keys(updates).length === 0) return;

  // Fetch current record, apply COALESCE logic
  const { data: current } = await (supabaseClient as any)
    .from("lia_attendances")
    .select("uf, tem_impressora, tem_scanner, impressora_modelo, como_digitaliza, raw_payload, software_cad, volume_mensal_pecas, principal_aplicacao, produto_interesse")
    .eq("email", email)
    .maybeSingle();

  if (!current) return;

  const safeUpdates: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(updates)) {
    if (field === "raw_payload") {
      safeUpdates.raw_payload = { ...(current.raw_payload as Record<string, unknown> || {}), ...(value as Record<string, unknown>) };
    } else if ((current as Record<string, unknown>)[field] === null || (current as Record<string, unknown>)[field] === undefined) {
      safeUpdates[field] = value;
    }
  }

  if (Object.keys(safeUpdates).length === 0) return;

  await (supabaseClient as any).from("lia_attendances")
    .update({ ...safeUpdates, updated_at: new Date().toISOString() })
    .eq("email", email);

  console.log(`[extractImplicit] Updated ${Object.keys(safeUpdates).join(", ")} for ${email}`);
}
