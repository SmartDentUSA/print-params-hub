/**
 * Premissas estratégicas oficiais da Smart Dent — "Tecnologia Invisível".
 * Fonte: Documento Estratégico Corporativo Smart Dent (2026, São Carlos-SP).
 *
 * Usado para ancorar copy de marketing gerada por IA (descrições e capas de
 * lives no YouTube, artes de campanha) na tese e no posicionamento oficiais.
 * NUNCA incluir preços ou valores comerciais em conteúdo gerado.
 */

export const SMARTDENT_STRATEGY_PREMISES = `
### PREMISSAS ESTRATÉGICAS OFICIAIS DA SMART DENT (Tecnologia Invisível)

TESE CENTRAL
A Smart Dent identifica gargalos ao longo do fluxo digital odontológico,
transforma sinais do mercado em soluções e transfere progressivamente
complexidade operacional do usuário para o sistema.

LÓGICA QUE SE REPETE
GARGALO → SOLUÇÃO → COMPLEXIDADE RETIRADA → CLIENTE AVANÇA → NOVO GARGALO.

PRINCÍPIO CORPORATIVO
Toda tecnologia madura transfere complexidade do operador para o sistema.
A complexidade deve estar no sistema, não no operador.

CONCEITO "TECNOLOGIA INVISÍVEL"
Quanto mais madura a tecnologia, menos atenção operacional ela exige.
Não é menos tecnologia: é mais inteligência embarcada, mais integração,
mais previsibilidade e menos dependência de conhecimento operacional
transitório.

DEFINIÇÃO CORPORATIVA
A Smart Dent é uma empresa de fluxo digital odontológico que transforma
etapas fragmentadas em sistemas mais simples, previsíveis, integrados e
produtivos. Impressão 3D é uma etapa, não a empresa inteira.

AS 7 ETAPAS DO FLUXO (mapa oficial)
1. Captura Digital — transformar paciente/objeto em informação digital confiável.
2. CAD — transformar informação em projeto clínico ou protético.
3. Impressão 3D — transformar projeto em objeto por manufatura aditiva.
4. Pós-Impressão — limpar, curar e estabilizar a peça de forma previsível.
5. Finalização — converter a peça em resultado clínico ou protético.
6. Cursos / Educação — transferir o conhecimento necessário para adoção e evolução.
7. Fresagem — transformar projeto em objeto por manufatura subtrativa.

DOIS PÚBLICOS, UM PRINCÍPIO
- Clínicas / dentistas: valor = autonomia, delegação, tempo clínico, entrega,
  rentabilidade. Risco = o fluxo depender do proprietário/dentista.
  Custo invisível = tempo clínico, tentativa e erro, frustração.
  Tradução: "Menos operação. Mais odontologia."
- Laboratórios de prótese: valor = padronização, repetibilidade, produtividade,
  escala, menos retrabalho. Risco = o resultado depender do operador mais
  experiente. Custo invisível = variabilidade, reimpressão, ociosidade, turnover.
  Tradução: "Menos variabilidade. Mais produção previsível."

COMO ISSO GUIA A COPY
- Sempre partir de uma DOR REAL de fluxo (retrabalho, reimpressão, dependência
  do operador, tempo clínico perdido, imprevisibilidade) e prometer o GANHO de
  complexidade retirada.
- Falar de sistema e previsibilidade, não de especificação isolada.
- Nunca prometer resultado que o produto não entrega; usar apenas os dados dos
  dossiês de produto fornecidos.
- Proibido: preços, valores, descontos, margens, fornecedores internos,
  estrutura societária ou racional competitivo interno.
`.trim();

/** Bloco compacto (para prompts de imagem, onde o espaço importa). */
export const SMARTDENT_STRATEGY_SHORT = `
POSICIONAMENTO SMART DENT (Tecnologia Invisível): a complexidade deve estar no
sistema, não no operador. O gancho deve nascer de uma dor real de fluxo digital
(retrabalho, reimpressão, dependência do operador, tempo clínico perdido,
imprevisibilidade) e prometer complexidade retirada — clínica: "menos operação,
mais odontologia"; laboratório: "menos variabilidade, mais produção previsível".
Sem preços, sem números inventados, sem promessa fora do dossiê do produto.
`.trim();

export function renderStrategyForPrompt(short = false): string {
  return short ? SMARTDENT_STRATEGY_SHORT : SMARTDENT_STRATEGY_PREMISES;
}
