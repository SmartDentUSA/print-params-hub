/**
 * Banco oficial de ganchos (hooks) Smart Dent — "Tecnologia Invisível".
 * Usado para ancorar copy de capas/descrições de lives e artes de campanha.
 *
 * Regra: o gancho NUNCA fala de especificação técnica ("nivelamento automático",
 * "resolução XY", "velocidade de impressão"). Ele fala da DOR do dia a dia
 * (fragmentação, retrabalho, dependência do operador, tempo clínico perdido) e
 * do GANHO sistêmico (fluxo que funciona, previsibilidade, delegação, resultado).
 */

export const SMARTDENT_HOOKS: string[] = [
  // Dor da fragmentação
  "O problema da odontologia digital não é a falta de tecnologia. É a tecnologia sem fluxo.",
  "A impressora parada é o sintoma. A fragmentação é a causa.",
  "Fora do fluxo, a tecnologia vira estoque.",
  "Não compre peças soltas. Implemente capacidade clínica.",
  "Comprar tecnologia é fácil. Fazer tudo funcionar é o verdadeiro desafio.",
  // Solução / sistema
  "Sua clínica não precisa de mais tecnologia. Precisa de um fluxo que funcione.",
  "Você não precisa de mais tecnologia. Precisa que a tecnologia que já comprou funcione como sistema.",
  "Não basta ter tecnologia. É preciso ter fluxo do primeiro escaneamento ao resultado final.",
  "O futuro é de quem fizer a tecnologia funcionar melhor, não de quem tiver mais tecnologia.",
  // Diferenciação
  "O seu concorrente vende equipamento. A Smart Dent entrega operação.",
  "O problema não é imprimir. É imprimir com previsibilidade.",
  "Digital não é ter um scanner. É conseguir produzir com segurança.",
  "O equipamento não é o fluxo.",
  // Custo oculto
  "Você investiu em tecnologia para lucrar mais e ganhou uma segunda profissão não remunerada?",
  "O custo oculto da odontologia digital não está na fatura do equipamento. Está na sua agenda.",
  "Por que a tecnologia que deveria libertar o dentista o aprisiona na cadeira de produção?",
  "Se você para o atendimento para resolver problema técnico, você não usa tecnologia: paga pedágio.",
  "O pedágio tecnológico que ninguém te contou na hora da venda.",
  // Filosofia
  "Tecnologia que aparece é tecnologia que falhou.",
  "Um fluxo digital onde a ferramenta desaparece e o que resta é o resultado.",
  "Inovação não é ter mais funcionalidades. É exigir menos presença mental do operador.",
  "Não vendemos equipamentos. Entregamos resultados validados.",
  "Fazer a tecnologia desaparecer para que o dentista apareça.",
  // Autonomia / delegação
  "Pare de ser o integrador técnico da sua própria clínica.",
  "Delegação real: qualquer pessoa da sua equipe consegue operar seu fluxo digital?",
  "Se o fluxo depende só de você, você não tem um sistema. Você tem uma dependência.",
  "O maior medo não é a tecnologia. É o consultório voltar ao zero se o operador for embora.",
  "Você investiu anos para ser um grande dentista. Não vire técnico de máquinas.",
  "O mercado vende peça solta. O paciente quer o dente pronto.",
  // Responsabilidade / evidência
  "O mercado fragmenta a culpa quando falha. Nós assumimos a responsabilidade de ponta a ponta.",
  "Evidência não vem depois do lançamento. Ela vem antes.",
  "Você prefere ser pioneiro com base científica ou cobaia de promessa comercial?",
];

/** Bloco de regras + repertório para injetar no prompt de copy. */
export function renderHooksForPrompt(limit = 18): string {
  const pick = SMARTDENT_HOOKS.slice(0, limit);
  return [
    "### REPERTÓRIO OFICIAL DE GANCHOS (use como referência de TOM e ÂNGULO, não copie literalmente)",
    ...pick.map((h) => `- ${h}`),
    "",
    "### REGRAS DO GANCHO (obrigatórias)",
    "- O gancho nasce de uma PERGUNTA ou AFIRMAÇÃO sobre a dor do dia a dia do consultório/laboratório",
    "  (retrabalho, reimpressão, fragmentação, suporte que joga a culpa, dependência de um único operador,",
    "  tempo clínico perdido, agenda travada, resultado imprevisível).",
    "- É PROIBIDO usar linguagem de especificação/feature: nivelamento automático, resolução, micras,",
    "  velocidade de impressão, potência de LED, tipo de tela, número de eixos, marca de componente.",
    "- O ganho é sistêmico e humano: fluxo que funciona, previsibilidade, delegação, entrega no mesmo dia,",
    "  menos operação e mais odontologia, menos variabilidade e mais produção previsível.",
    "- Frases curtas, alta tensão, zero clickbait falso, zero preço, zero número inventado.",
  ].join("\n");
}
