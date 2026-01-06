// ═══════════════════════════════════════════════════════════════════════════
// REGRAS COMPARTILHADAS PARA EXTRAÇÃO E PUBLICAÇÃO DE DOCUMENTOS
// ═══════════════════════════════════════════════════════════════════════════
// 
// Este arquivo define as regras base que TODOS os sistemas de extração
// e publicação devem seguir para garantir qualidade e fidelidade.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * PRINCÍPIO-MÃE - Válido para TODOS os PDFs
 * O PDF é a fonte da verdade. O conteúdo é a interpretação estruturada dessa verdade.
 */
export const PRINCIPIO_MAE = `
═══════════════════════════════════════════════════════════════════════════
PRINCÍPIO-MÃE: O PDF É A FONTE DA VERDADE
═══════════════════════════════════════════════════════════════════════════

O conteúdo extraído é a interpretação estruturada dessa verdade.

REGRAS FUNDAMENTAIS:
❌ NÃO copiar o PDF mecanicamente
❌ NÃO resumir perdendo dados técnicos
❌ NÃO inventar informações não presentes
❌ NÃO adicionar produtos, especificações ou dados não documentados
❌ NÃO completar informações "faltantes" com suposições

✅ Transcrever com fidelidade absoluta ao original
✅ Manter rigor técnico quando exigido
✅ Preservar valores numéricos exatos (unidades, decimais)
✅ Estruturar para interpretação por humanos + IA
✅ Adicionar contexto GEO (Brasil, odontologia digital) quando aplicável

═══════════════════════════════════════════════════════════════════════════
`;

/**
 * Regras Anti-Alucinação
 * Proibições absolutas para prevenir invenção de dados
 */
export const REGRAS_ANTI_ALUCINACAO = `
═══════════════════════════════════════════════════════════════════════════
REGRAS ANTI-ALUCINAÇÃO (PROIBIÇÕES ABSOLUTAS)
═══════════════════════════════════════════════════════════════════════════

1. NÃO invente dados que não estão EXPLICITAMENTE no documento
2. NÃO complete informações "faltantes" com suposições
3. NÃO adicione produtos, marcas ou especificações não mencionados
4. NÃO crie seções como "Produtos Relacionados" ou "Recomendações"
5. NÃO reinterprete resultados de forma diferente do original
6. NÃO arredonde ou aproxime valores numéricos - preserve exatamente
7. NÃO adicione links ou referências externas não presentes

QUANDO INFORMAÇÃO ESTIVER AUSENTE OU ILEGÍVEL:
- Se algo está ILEGÍVEL no PDF: escreva "[ilegível]"
- Se algo está INCOMPLETO ou cortado: escreva "[incompleto no original]"
- Se algo NÃO foi mencionado: escreva "Não informado" ou omita a seção

PRESERVAÇÃO OBRIGATÓRIA:
- Tabelas: manter estrutura e valores exatos
- Números: preservar unidades e casas decimais
- Normas: citar exatamente como aparecem (ISO, ABNT, etc.)
- Nomenclaturas técnicas: não traduzir ou simplificar

═══════════════════════════════════════════════════════════════════════════
`;

/**
 * Contexto GEO para conteúdo brasileiro de odontologia digital
 */
export const CONTEXTO_GEO = `
═══════════════════════════════════════════════════════════════════════════
CONTEXTO GEO E PÚBLICO-ALVO
═══════════════════════════════════════════════════════════════════════════

MERCADO: Brasil - Odontologia Digital
PÚBLICO: Cirurgiões-Dentistas, Protéticos, Técnicos em Laboratório

CONSIDERAÇÕES REGULATÓRIAS:
- ANVISA quando aplicável
- Normas brasileiras (ABNT) e internacionais (ISO)
- Boas práticas clínicas e laboratoriais

OBJETIVO FINAL:
- Gerar autoridade científica indexável
- Conteúdo interpretável por Google, ChatGPT, Gemini, Perplexity
- Smart Dent Brasil como referência técnica confiável

═══════════════════════════════════════════════════════════════════════════
`;

/**
 * Combina todas as regras em um bloco único para extração
 */
export const REGRAS_EXTRACAO_COMPLETAS = `
${PRINCIPIO_MAE}
${REGRAS_ANTI_ALUCINACAO}
${CONTEXTO_GEO}
`;

/**
 * Cabeçalho padrão para extratores especializados
 */
export const CABECALHO_EXTRATOR = `
# PRINCÍPIO-MÃE
O PDF é a fonte da verdade.
O conteúdo extraído é a interpretação estruturada dessa verdade.

# REGRAS ANTI-ALUCINAÇÃO
- NÃO invente dados não presentes no documento
- NÃO complete informações faltantes com suposições
- Se algo está ilegível: escreva "[ilegível]"
- Se algo está incompleto: escreva "[incompleto no original]"
- Se algo não foi mencionado: escreva "Não informado"
- PRESERVE tabelas, números e valores exatos

# CONTEXTO
- Mercado: Brasil - Odontologia Digital
- Público: Cirurgiões-Dentistas, Protéticos, Técnicos
- Objetivo: Extração fiel para posterior publicação web
`;

/**
 * Cabeçalho padrão para publicadores (transforma extração em conteúdo web)
 */
export const CABECALHO_PUBLICADOR = `
# PRINCÍPIO-MÃE
O TEXTO EXTRAÍDO (abaixo) é a fonte da verdade.
O conteúdo web é a interpretação indexável dessa verdade.

# REGRAS FUNDAMENTAIS
❌ NÃO copiar o texto mecanicamente
❌ NÃO transformar em "blogzinho" superficial
❌ NÃO inventar dados não presentes na extração
❌ NÃO usar linguagem comercial ou fazer promessas
✅ Traduzir para linguagem interpretável por humanos + IA
✅ Manter rigor técnico quando exigido
✅ Adicionar contexto GEO (Brasil, odontologia digital)
✅ Estruturar com HTML semântico (H2/H3) e FAQs

# CONTEXTO
- O texto abaixo foi extraído de um documento técnico
- Ele já foi processado e é FIEL ao PDF original
- Sua função é INTERPRETAR para formato web, não INVENTAR
`;

export default {
  PRINCIPIO_MAE,
  REGRAS_ANTI_ALUCINACAO,
  CONTEXTO_GEO,
  REGRAS_EXTRACAO_COMPLETAS,
  CABECALHO_EXTRATOR,
  CABECALHO_PUBLICADOR
};
