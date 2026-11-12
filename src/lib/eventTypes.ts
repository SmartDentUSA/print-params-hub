// Tipo de evento (smartops_events.event_type). Define a narrativa que a IA usa na
// geração de posts: um evento pode ser feira/congresso, evento presencial com
// parceiros ou campanha promocional (ex.: Black Friday é cadastrada como evento,
// mas a narrativa é de campanha promocional, sem estande nem visita presencial).
export type EventType = "feira_congresso" | "presencial_parceiros" | "campanha_promocional";

export const DEFAULT_EVENT_TYPE: EventType = "feira_congresso";

export const EVENT_TYPE_OPTIONS: { value: EventType; label: string; hint: string }[] = [
  { value: "feira_congresso", label: "Feiras e congressos", hint: "Smart Dent expõe em estande; convite para visitar." },
  { value: "presencial_parceiros", label: "Eventos presenciais com parceiros", hint: "Encontro, curso ou demonstração organizada com parceiros." },
  { value: "campanha_promocional", label: "Campanhas promocionais", hint: "Período de ofertas (ex.: Black Friday); sem estande nem local." },
];

export function normalizeEventType(value: unknown): EventType {
  return EVENT_TYPE_OPTIONS.some((o) => o.value === value) ? (value as EventType) : DEFAULT_EVENT_TYPE;
}

export function eventTypeLabel(value: unknown): string {
  const t = normalizeEventType(value);
  return EVENT_TYPE_OPTIONS.find((o) => o.value === t)!.label;
}

/** Usa local/estande como fato do post? Campanha promocional não tem presença física. */
export function eventUsesVenue(value: unknown): boolean {
  return normalizeEventType(value) !== "campanha_promocional";
}

export type EventNarrative = {
  /** Cabeçalho do contexto enviado à IA. */
  header: string;
  /** Tempo verbal e intenção. */
  tense: string;
  /** CTA obrigatório. */
  cta: string;
  /** Estrutura obrigatória da legenda. */
  structure: string[];
};

const COMMON_RULES =
  'REGRAS: não invente datas, números, local, estande, condições comerciais, descontos, cupons, produtos, palestrantes, @perfis ou características técnicas; nada de superlativos sem dado; preserve nomes de marcas, produtos e eventos; emojis com equilíbrio; sem preços; sem barras invertidas ou marcação. Entregue somente a legenda final pronta para publicar.';

const HASHTAG_RULE = (topic: string) =>
  `NÃO escreva hashtags dentro da legenda: elas vão SOMENTE no campo "hashtags" (8 a 12, relacionadas à empresa, ${topic}, ao público e às tecnologias citadas).`;

export function eventNarrative(type: unknown, name: string, isPast: boolean): EventNarrative {
  const t = normalizeEventType(type);
  if (t === "campanha_promocional") {
    return {
      header: `CONTEXTO — CAMPANHA PROMOCIONAL: "${name}". Isto NÃO é feira, congresso nem evento presencial: é um período de ofertas da Smart Dent. Nunca fale em estande, visita, palestra ou local.`,
      tense: isPast
        ? "A campanha já terminou: escreva no PASSADO (agradecimento e convite para acompanhar as próximas ofertas)."
        : "Escreva no PRESENTE/FUTURO com urgência real do período da campanha (datas exatas), gerando desejo de aproveitar.",
      cta: 'CTA obrigatório: "Comente QUERO e receba as condições da campanha" + "link na bio".',
      structure: [
        "ESTRUTURA OBRIGATÓRIA DA LEGENDA (siga na ordem, parágrafos curtos, tom comercial, empolgante e confiável, pt-BR):",
        '1) Abertura com o nome da campanha e o período exato: "🔥 {campanha} Smart Dent: de {data início} a {data fim}!".',
        "2) Parágrafo curto sobre a oportunidade para o público (o que a campanha permite fazer no fluxo digital).",
        "3) Lista dos destaques (produtos selecionados), um emoji DIFERENTE por item, com o benefício clínico/laboratorial de cada um.",
        "4) Se houver faixas de datas/condições informadas no contexto, cite-as exatamente como informadas; sem condições informadas, não cite percentuais.",
        "5) CTA de comentário com a palavra-chave em MAIÚSCULAS.",
        '6) Fechamento: "⏳ Condições válidas somente no período da campanha." / "📲 Compartilhe com um colega." / "🔗 Saiba mais no link da bio."',
        `7) ${HASHTAG_RULE("à campanha")}`,
        COMMON_RULES,
      ],
    };
  }
  if (t === "presencial_parceiros") {
    return {
      header: `CONTEXTO — EVENTO PRESENCIAL COM PARCEIROS: "${name}". É um encontro organizado pela Smart Dent junto com parceiros (clínica, laboratório, distribuidor ou marca); não é feira com estande.`,
      tense: isPast
        ? "Escreva no PASSADO (recapitulação, agradecimento aos parceiros e participantes)."
        : "Escreva no FUTURO, convidando a participar presencialmente do encontro.",
      cta: 'CTA obrigatório: "Comente EVENTO e receba todas as informações para participar" + "link na bio".',
      structure: [
        "ESTRUTURA OBRIGATÓRIA DA LEGENDA (siga na ordem, parágrafos curtos, tom próximo, técnico e humano, pt-BR):",
        '1) Abertura com o encontro, a cidade e a data: "🤝 {evento} em {cidade}!".',
        "2) Parágrafo com quem organiza junto (marcas/parceiros informados) e o que o participante vai vivenciar.",
        '3) Programação: "🎤 {Nome} (@ig) — {tema}" com data e horário, quando houver.',
        "4) Lista dos destaques (produtos selecionados), um emoji DIFERENTE por item, ligados à prática mostrada no encontro.",
        "5) CTA de comentário com a palavra-chave em MAIÚSCULAS.",
        '6) Fechamento: "📍 Vagas presenciais limitadas." / "📲 Compartilhe com um colega." / "🔗 Saiba mais no link da bio." + marcações dos perfis (evento, palestrantes e parceiros).',
        `7) ${HASHTAG_RULE("ao encontro")}`,
        COMMON_RULES,
      ],
    };
  }
  return {
    header: `CONTEXTO — FEIRA/CONGRESSO: "${name}".`,
    tense: isPast
      ? "Escreva no PASSADO (retrospectiva, agradecimento a quem visitou o estande)."
      : "Escreva no FUTURO, convidando a visitar o estande Smart Dent.",
    cta: 'CTA obrigatório: "Comente CONGRESSO e receba condições especiais, descontos mesmo não participando presencialmente".',
    structure: [
      "ESTRUTURA OBRIGATÓRIA DA LEGENDA (siga na ordem, parágrafos curtos, tom profissional, convidativo, tecnológico e humano, pt-BR):",
      '1) Abertura impactante sobre futuro/transformação: "🚀 O futuro da {área} chega a {cidade} no {evento}!".',
      "2) Parágrafo com a participação da Smart Dent, datas, público do evento e tema principal.",
      '3) Convite ao estande: "📍 Visite o Estande {número} e conheça soluções que unem {benefício 1}, {benefício 2} e {benefício 3}:".',
      "4) Lista dos destaques (produtos selecionados), um emoji DIFERENTE por item (🔬 📸 💻 ✔️ 💡).",
      '5) Bloco de palestrantes/demonstrações (quando houver): "🎤 {Nome} (@ig) — {tema}" com data e horário.',
      "6) Parágrafo curto explicando como essas soluções melhoram resultados técnicos, clínicos ou comerciais das áreas e especialidades do público presente.",
      "7) CTA de comentário com a palavra-chave em MAIÚSCULAS.",
      '8) Fechamento: "💾 Salve este post para não perder nossa localização." / "📲 Compartilhe com um colega que precisa {ação} em {ano}." / "🔗 Saiba mais no link da bio." + marcações dos perfis (evento, palestrantes e marcas parceiras).',
      `9) ${HASHTAG_RULE("ao congresso")}`,
      COMMON_RULES,
    ],
  };
}
