// Shared intent classifier + topic_context derivation for WhatsApp inbound.
// Used by dra-lia-whatsapp (autonomous LIA) to mirror the site protocol.

import { isSupportQuestion, isProblemReport } from "./lia-guards.ts";

export interface IntentResult {
  intent: string;
  confidence: number;
}

const INTENT_RULES: Array<{ intent: string; patterns: RegExp[]; confidence: number }> = [
  {
    intent: "interesse_imediato",
    patterns: [
      /\b(quero|queremos|fechamos?|fechar|parcela|parcelamento|proposta|quando entrega|comprar|adquirir|envie proposta|vamos fechar|pode mandar)\b/i,
    ],
    confidence: 90,
  },
  {
    intent: "interesse_futuro",
    patterns: [
      /\b(planejando|semestre|ano que vem|futuro|mais pra frente|depois|pensar|avaliar|avaliando|estudando)\b/i,
    ],
    confidence: 75,
  },
  {
    intent: "pedido_info",
    patterns: [
      /\b(catalogo|catálogo|preco|preço|tabela|como funciona|diferenca|diferença|especifica|ficha tecnica|quanto custa|valores|modelos disponíveis)\b/i,
    ],
    confidence: 80,
  },
  {
    intent: "objecao",
    patterns: [
      /\b(caro|muito caro|vou pensar|falar com (meu |o )?socio|sócio|orçamento apertado|não é o momento|momento difícil)\b/i,
    ],
    confidence: 70,
  },
  {
    intent: "sem_interesse",
    patterns: [
      /\b(nao tenho interesse|não tenho interesse|pare|parar|remover|remova|não quero|nao quero|cancelar|sair da lista|descadastrar)\b/i,
    ],
    confidence: 95,
  },
  {
    intent: "suporte",
    patterns: [
      /\b(problema|defeito|troca|garantia|assistencia|assistência|suporte|quebrou|não funciona|nao funciona|com defeito)\b/i,
    ],
    confidence: 85,
  },
];

const SECONDARY_PATTERNS: Array<{ pattern: RegExp; intent: string; confidence: number }> = [
  { pattern: /quanto\s*(custa|vale|é|fica|tá|ta)/i, intent: "pedido_info", confidence: 65 },
  { pattern: /qual\s*(o\s*)?(pre[çc]o|valor|custo)/i, intent: "pedido_info", confidence: 65 },
  { pattern: /tem\s*(algum|esse|esses|aquele|pro|pra)/i, intent: "pedido_info", confidence: 55 },
  { pattern: /como\s*(funciona|seria|é|é\s*isso)/i, intent: "pedido_info", confidence: 60 },
  { pattern: /queria\s*(saber|entender|conhecer|ver)/i, intent: "pedido_info", confidence: 60 },
  { pattern: /me\s*(fala|conta|explica|diz)\s*(mais|sobre)?/i, intent: "pedido_info", confidence: 55 },
  { pattern: /me\s*(manda|envia|passa|encaminha)/i, intent: "interesse_imediato", confidence: 70 },
  { pattern: /pode\s*(me\s*)?(mandar|enviar|passar)/i, intent: "interesse_imediato", confidence: 70 },
  { pattern: /quero\s*(receber|ver|conhecer|saber\s*mais)/i, intent: "interesse_imediato", confidence: 75 },
  { pattern: /vou\s*(pensar|ver|analis|consider)/i, intent: "interesse_futuro", confidence: 60 },
  { pattern: /depois\s*(eu|a\s*gente)\s*(v[eê]|fal|entr)/i, intent: "interesse_futuro", confidence: 55 },
  { pattern: /no\s*(momento|agora)\s*(n[aã]o|to|tô)/i, intent: "interesse_futuro", confidence: 60 },
  { pattern: /t[áa]\s*(caro|salgado|pesado)/i, intent: "objecao", confidence: 70 },
  { pattern: /n[aã]o\s*(tenho|tô\s*com|estou\s*com)\s*(din|grana|verba)/i, intent: "objecao", confidence: 65 },
];

export function classifyMessage(text: string): IntentResult {
  if (!text || text.trim().length < 2) return { intent: "indefinido", confidence: 10 };
  const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const rule of INTENT_RULES) {
    for (const p of rule.patterns) {
      if (p.test(text) || p.test(normalized)) return { intent: rule.intent, confidence: rule.confidence };
    }
  }
  for (const rule of SECONDARY_PATTERNS) {
    if (rule.pattern.test(text) || rule.pattern.test(normalized)) {
      return { intent: rule.intent, confidence: rule.confidence };
    }
  }
  return { intent: "indefinido", confidence: 20 };
}

const PARAMETERS_REGEX = /\b(impressora|printer|resina|resin|modelo de impressora|cura|tempo de exposição|exposure|layer|camada|parametros|parâmetros|param|preset|perfil de impress|chitubox|lychee|nextdent|saremco|phrozen|anycubic|elegoo|moonray|miicraft|asiga)\b/i;

/**
 * Derives topic_context for `dra-lia` from intent + message regex so the WhatsApp
 * flow uses the same routes as the site (commercial / support / parameters).
 * Returns null when no clear route is detected (LIA decides default).
 */
export function deriveTopicContext(message: string, intent: string, hasImage = false): string | null {
  // Images: do NOT force support. The visual classifier in dra-lia decides.
  if (hasImage) return null;

  if (intent === "interesse_imediato" || intent === "interesse_futuro" || intent === "objecao" || intent === "pedido_info") {
    return "commercial";
  }
  if (intent === "suporte" || isSupportQuestion(message) || isProblemReport(message)) {
    return "support";
  }
  if (PARAMETERS_REGEX.test(message)) {
    return "parameters";
  }
  return null;
}