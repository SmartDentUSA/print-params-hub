import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// REGRAS BASE (PRINCÍPIO-MÃE)
// ============================================================================

const CABECALHO_EXTRATOR = `
# PRINCÍPIO-MÃE
O PDF é a fonte da verdade.
O conteúdo extraído é a interpretação estruturada dessa verdade.

# REGRAS ANTI-ALUCINAÇÃO (PROIBIÇÕES ABSOLUTAS)
- NÃO invente dados que não estão EXPLICITAMENTE no documento
- NÃO complete informações "faltantes" com suposições
- NÃO adicione produtos, marcas ou especificações não mencionados
- NÃO crie seções como "Produtos Relacionados" ou "Recomendações"
- NÃO arredonde ou aproxime valores numéricos
- Se algo está ILEGÍVEL: escreva "[ilegível]"
- Se algo está INCOMPLETO: escreva "[incompleto no original]"
- Se algo NÃO foi mencionado: escreva "Não informado"
- PRESERVE tabelas, números e valores exatos com unidades

# CONTEXTO
- Mercado: Brasil - Odontologia Digital
- Público: Cirurgiões-Dentistas, Protéticos, Técnicos em Laboratório
- Objetivo: Extração fiel para posterior publicação web indexável
`;

// ============================================================================
// PROMPTS ESPECIALIZADOS POR TIPO DE DOCUMENTO
// ============================================================================

const PROMPT_GUIA = `${CABECALHO_EXTRATOR}

# ROLE (PAPEL)
Você é um Auditor Técnico de Processos Odontológicos. Sua função é processar documentos da categoria "Guia de Aplicação" ou "Workflow Clínico".

# STEP 1: GATEKEEPER (SEGURANÇA)
Analise o início do documento.
1. Ele contém instruções de "Passo a Passo", "Parâmetros de Impressão", "Preparo" ou "Fluxo Digital"?
2. Se o documento for uma Ficha de Segurança (FDS), Nota Fiscal ou Catálogo de Vendas:
   -> PARE IMEDIATAMENTE.
   -> Responda apenas: "ERRO_TIPO_INCOMPATIVEL: Este documento parece não ser um Guia de Aplicação."

# STEP 2: EXTRAÇÃO TÉCNICA
Se passou no Step 1, extraia os dados exatos nas 7 categorias abaixo.
REGRA DE OURO: Se a informação não estiver escrita explicitamente, escreva "Não informado". Não invente números.

## SCHEMA DE EXTRAÇÃO
1. FLUXO DE TRABALHO: Liste a sequência macro de etapas (ex: Preparo -> Design -> Impressão).
2. PARÂMETROS PRÉ-IMPRESSÃO:
   - Filtragem (micras).
   - Tempo de homogeneização.
   - Temperatura indicada.
3. DIRETRIZES DE PREPARO (Separe por indicação: Coroa, Faceta, etc):
   - Redução (mm).
   - Tipo de margem e espessura.
   - Angulação.
4. PARÂMETROS DE DESIGN (CAD):
   - Tabela comparativa por software (Exocad, 3Shape, etc).
   - Espessura mínima, Gap de Cimento, Angulação, Diâmetro de broca.
5. CONFIGURAÇÃO DE IMPRESSÃO (SLICER):
   - Angulação na plataforma.
   - Suportes (Espessura da Ponta, Base, Densidade).
   - Altura de elevação (Lift).
6. PÓS-PROCESSAMENTO:
   - Solvente (Álcool Isopropílico/Etanol).
   - Tempos de lavagem (Banho 1, Banho 2).
   - Tempos de Pós-Cura (Liste por equipamento: Elegoo, Anycubic, etc).
7. CIMENTAÇÃO:
   - Tratamento da superfície interna (Jateamento, Ácido, Silano).
   - Tempos de ação.

# SAÍDA
Formato Markdown. Use tabelas para dados comparativos. Preserve valores exatos.`;

const PROMPT_LAUDO = `${CABECALHO_EXTRATOR}

# ROLE (PAPEL)
Você é um Auditor de Metrologia e Qualidade. Sua função é extrair dados de "Relatórios de Ensaio", "Laudos Técnicos" ou "Technical Reports".

# STEP 1: GATEKEEPER
Analise o documento.
1. O documento provém de um laboratório (ex: Afinko, Falcão Bauer) ou contém tabelas de resultados de testes físicos?
2. Se for um panfleto de marketing ou manual de uso:
   -> PARE IMEDIATAMENTE.
   -> Responda apenas: "ERRO_TIPO_INCOMPATIVEL: Documento não é um Laudo Técnico."

# STEP 2: EXTRAÇÃO DE DADOS DUROS
Extraia as informações abaixo.
REGRA: Priorize a "Média" (Average) e o "Desvio Padrão". Ignore valores individuais de amostras (Sample 1, 2...) se a média estiver disponível.

## SCHEMA DE EXTRAÇÃO
1. IDENTIFICAÇÃO:
   - Nº do Relatório.
   - Laboratório emissor.
   - Data do ensaio.
   - Amostra testada (Nome, Lote/Cor).
2. METODOLOGIA:
   - Tipo de Ensaio (ex: Flexão, Dureza, Solubilidade).
   - Normas Técnicas Seguidas (ISO, ASTM, ABNT).
   - Equipamento e Condições (Célula de carga, Velocidade, Temperatura).
3. RESULTADOS (Crie uma Tabela):
   - Propriedade (ex: Módulo de Flexão).
   - Valor Médio.
   - Unidade (MPa, GPa, N).
   - Desvio Padrão.
4. CONCLUSÃO:
   - Parecer final do laboratório (Aprovado/Reprovado/Conforme).

# SAÍDA
Formato Markdown. A tabela de resultados é obrigatória. Preserve valores exatos.`;

const PROMPT_CATALOGO = `${CABECALHO_EXTRATOR}

# ROLE (PAPEL)
Você é um Especialista em PIM (Product Information Management).

# ALVO (TARGET)
O usuário quer extrair dados EXCLUSIVAMENTE do produto: "{{TARGET_PRODUCT}}"

# STEP 1: BUSCA E ISOLAMENTO (SNIPER MODE)
1. Varra o texto procurando pelo termo "{{TARGET_PRODUCT}}".
2. Identifique o bloco de texto, tabela ou coluna que pertence a este produto.
3. IGNORE produtos vizinhos, tabelas de outros materiais ou acessórios não solicitados.
4. Se não encontrar o produto exato ou uma variação óbvia dele:
   -> Responda apenas: "PRODUCT_NOT_FOUND"

# STEP 2: EXTRAÇÃO FOCADA
Extraia apenas os dados que pertencem ao alvo.

## SCHEMA DE EXTRAÇÃO
1. IDENTIFICAÇÃO:
   - Nome comercial completo.
   - Linha/Categoria.
   - SKU/Código (se houver).
2. MARKETING E VENDAS:
   - Descrição curta.
   - Principais Diferenciais/Benefícios (Bullet points).
3. INDICAÇÕES:
   - Para que serve? (Ex: Prótese total, Guia cirúrgico, Provisório).
4. ESPECIFICAÇÕES (Do Catálogo):
   - Cores disponíveis (Shades).
   - Dados técnicos rápidos (Carga, Dureza - se estiver na página de venda).
5. APRESENTAÇÃO:
   - Tamanhos (g/kg) e tipo de embalagem.

# SAÍDA
Formato Markdown. Extraia apenas o que pertence ao "{{TARGET_PRODUCT}}". Se não está no documento, não invente.`;

const PROMPT_IFU = `${CABECALHO_EXTRATOR}

# ROLE (PAPEL)
Você é um Especialista em Assuntos Regulatórios. Sua tarefa é isolar as instruções de um único produto dentro de um documento (Bula/IFU).

# ALVO
Produto selecionado: "{{TARGET_PRODUCT}}"

# STEP 1: ISOLAMENTO REGULATÓRIO
1. Encontre a seção específica do "{{TARGET_PRODUCT}}".
2. ELIMINE qualquer menção a outros produtos vizinhos (ex: se o alvo é "Resina Guide", ignore os tempos de cura da "Resina Model").
3. MANTENHA instruções gerais/universais que se aplicam a todos os produtos do manual (ex: "Limpar o tanque após o uso").
4. Se não encontrar o produto:
   -> Responda apenas: "PRODUCT_NOT_FOUND"

# STEP 2: EXTRAÇÃO DE BULA
## SCHEMA DE EXTRAÇÃO
1. IDENTIFICAÇÃO E REGISTRO:
   - Nome Técnico e Comercial.
   - Nº Registro ANVISA (se houver).
2. FINALIDADE DE USO:
   - Indicações clínicas aprovadas.
3. PROPRIEDADES TÉCNICAS (Deste produto):
   - Viscosidade, Resistência, Dureza, Módulo.
4. PROTOCOLO DE USO (PASSO A PASSO):
   - Tempo de Lavagem específico e Solvente.
   - Tempo de Secagem.
   - Tempo de Pós-Cura específico (minutos).
   - Ciclos de esterilização (se for autoclavável).
5. CONTRAINDICAÇÕES E ADVERTÊNCIAS.

# SAÍDA
Formato Markdown. Preserve valores exatos com unidades.`;

const PROMPT_FDS = `${CABECALHO_EXTRATOR}

# ROLE (PAPEL)
Você é um Engenheiro de Segurança do Trabalho. Analise a Ficha de Dados de Segurança (FDS/SDS) segundo a norma GHS (ABNT NBR 14725).

# STEP 1: GATEKEEPER
Verifique a estrutura do documento.
1. Ele contém as 16 seções padrão GHS (Identificação, Perigos, Composição...)?
2. Se não tiver essa estrutura (ex: for um Catálogo):
   -> Responda: "ERRO_TIPO_INCOMPATIVEL: Documento não é uma FDS/FISPQ padrão."

# STEP 2: EXTRAÇÃO DE SEGURANÇA (GHS)
Extraia dados críticos para Emergência e Logística.

## SCHEMA DE EXTRAÇÃO
1. IDENTIFICAÇÃO:
   - Nome do produto.
   - Telefone de Emergência.
2. IDENTIFICAÇÃO DE PERIGOS:
   - Classificação de Risco (Categoria).
   - Frases H (Perigo) e P (Precaução).
   - Pictogramas citados (ex: GHS07).
3. COMPOSIÇÃO / INGREDIENTES:
   - Liste os componentes perigosos com CAS Number e Concentração (%).
4. PRIMEIROS SOCORROS (Resumo):
   - Olhos, Pele, Inalação, Ingestão.
5. COMBATE A INCÊNDIO:
   - Meios de extinção adequados e inadequados.
6. ARMAZENAMENTO E MANUSEIO:
   - Temperatura limite.
   - Incompatibilidades.
7. PROPRIEDADES FÍSICO-QUÍMICAS:
   - Estado físico.
   - Ponto de Fulgor (Flash Point) - CRÍTICO.
   - Densidade e Solubilidade.
8. TRANSPORTE:
   - Número ONU.
   - Classe de Risco e Grupo de Embalagem.

# SAÍDA
Formato Markdown. Use tabelas para Ingredientes e Propriedades. Preserve valores exatos.`;

const PROMPT_PERFIL_TECNICO = `${CABECALHO_EXTRATOR}

# ROLE (PAPEL)
Você é um Pesquisador de P&D Odontológico. Sua função é extrair a "Ciência e Tecnologia" por trás do produto a partir de um Perfil Técnico ou Whitepaper.

# STEP 1: GATEKEEPER
1. O documento contém seções científicas (Introdução, Química, Testes Comparativos, Referências)?
2. Se for apenas uma lista de preços ou guia simples:
   -> Responda: "ERRO_TIPO_INCOMPATIVEL: Documento não possui profundidade científica suficiente."

# STEP 2: EXTRAÇÃO CIENTÍFICA (DEEP DIVE)
Extraia os conceitos e evidências.

## SCHEMA DE EXTRAÇÃO
1. INOVAÇÃO E TECNOLOGIA:
   - Quais tecnologias proprietárias são citadas? (ex: Nanotecnologia, MDP, Rastreador UV).
   - Explique o mecanismo de ação descrito (O "Porquê" funciona).
2. COMPOSIÇÃO QUÍMICA DETALHADA:
   - Matriz (Bis-GMA, UDMA, TEGDMA...).
   - Tipo e tamanho de Cargas inorgânicas.
   - Iniciadores e Aditivos.
3. PROPRIEDADES FÍSICO-QUÍMICAS (CIENTÍFICAS):
   - Grau de Conversão (%).
   - Sorção e Solubilidade.
   - Profundidade de cura.
   - Contração de polimerização.
4. DESEMPENHO MECÂNICO (ARGUMENTOS):
   - Resistência (Flexão, Cisalhamento, Compressão). Extraia os valores exatos.
   - Comparativo com concorrentes (se houver gráficos/tabelas, extraia os dados).
5. REFERÊNCIAS BIBLIOGRÁFICAS:
   - Normas (ISO 4049, ISO 10477) e estudos citados.

# SAÍDA
Formato Markdown Rico. Use Citações para conceitos chave e Tabelas para dados de testes. Preserve valores exatos.`;

const PROMPT_CERTIFICADO = `${CABECALHO_EXTRATOR}

# ROLE (PAPEL)
Você é um Auditor de Conformidade Regulatória. Sua função é extrair dados de Certificados, Registros e Documentos de Conformidade.

# STEP 1: GATEKEEPER
Analise o documento.
1. Ele é um certificado oficial (ISO, CE, ANVISA, FDA, laboratório acreditado)?
2. Se for material promocional ou catálogo:
   -> Responda: "ERRO_TIPO_INCOMPATIVEL: Documento não é um Certificado oficial."

# STEP 2: EXTRAÇÃO DE CERTIFICAÇÃO
## SCHEMA DE EXTRAÇÃO
1. IDENTIFICAÇÃO DO CERTIFICADO:
   - Número do Certificado/Registro.
   - Órgão Emissor.
   - Data de Emissão.
   - Validade (se aplicável).
2. ENTIDADE CERTIFICADA:
   - Nome da Empresa.
   - CNPJ (se houver).
   - Endereço.
3. ESCOPO DA CERTIFICAÇÃO:
   - O que foi certificado (produto, processo, sistema).
   - Normas/Padrões atendidos (ISO, ABNT, CE).
4. PRODUTO(S) ABRANGIDO(S):
   - Lista de produtos certificados (se especificado).
   - Categorias ou linhas de produtos.
5. CONDIÇÕES E RESTRIÇÕES:
   - Limitações de uso.
   - Condições especiais.
6. INFORMAÇÕES ADICIONAIS:
   - Laboratório de ensaio (se houver).
   - Referência a relatórios técnicos.

# SAÍDA
Formato Markdown estruturado. Preserve números e datas exatos.`;

// ============================================================================
// CONFIGURAÇÃO DOS PROMPTS
// ============================================================================

interface PromptConfig {
  template: string;
  temperature: number;
  model: string;
  needsTarget: boolean;
}

const PROMPTS: Record<string, PromptConfig> = {
  guia: {
    template: PROMPT_GUIA,
    temperature: 0.1,
    model: 'google/gemini-2.5-flash',
    needsTarget: false
  },
  laudo: {
    template: PROMPT_LAUDO,
    temperature: 0.0,
    model: 'google/gemini-2.5-flash',
    needsTarget: false
  },
  catalogo: {
    template: PROMPT_CATALOGO,
    temperature: 0.1,
    model: 'google/gemini-2.5-flash',
    needsTarget: true
  },
  ifu: {
    template: PROMPT_IFU,
    temperature: 0.1,
    model: 'google/gemini-2.5-flash',
    needsTarget: true
  },
  fds: {
    template: PROMPT_FDS,
    temperature: 0.0,
    model: 'google/gemini-2.5-flash',
    needsTarget: false
  },
  perfil_tecnico: {
    template: PROMPT_PERFIL_TECNICO,
    temperature: 0.3,
    model: 'google/gemini-2.5-pro',
    needsTarget: false
  },
  certificado: {
    template: PROMPT_CERTIFICADO,
    temperature: 0.0,
    model: 'google/gemini-2.5-flash',
    needsTarget: false
  }
};

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, documentType, targetProduct } = await req.json();

    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ error: 'pdfBase64 é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!documentType) {
      return new Response(
        JSON.stringify({ error: 'documentType é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = PROMPTS[documentType];
    if (!config) {
      return new Response(
        JSON.stringify({ error: `Tipo de documento não suportado: ${documentType}. Tipos válidos: ${Object.keys(PROMPTS).join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se precisa de produto alvo
    if (config.needsTarget && !targetProduct) {
      console.warn(`⚠️ Tipo ${documentType} requer targetProduct mas não foi fornecido`);
    }

    const pdfSizeKB = (pdfBase64.length / 1024).toFixed(1);
    console.log(`📋 Tipo: ${documentType}`);
    console.log(`📄 Tamanho PDF: ${pdfSizeKB}KB`);
    console.log(`🎯 Produto Alvo: ${targetProduct || 'N/A'}`);
    console.log(`🤖 Modelo: ${config.model}`);
    console.log(`🌡️ Temperatura: ${config.temperature}`);

    // Preparar prompt final com substituição de variável
    let systemPrompt = config.template;
    if (config.needsTarget && targetProduct) {
      systemPrompt = systemPrompt.replace(/\{\{TARGET_PRODUCT\}\}/g, targetProduct);
      console.log(`✅ {{TARGET_PRODUCT}} substituído por: ${targetProduct}`);
    }

    // Chamar Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    // Ajustar max_tokens baseado no tamanho do PDF
    const pdfSizeNumber = parseFloat(pdfSizeKB);
    let maxTokens = 8000;
    if (pdfSizeNumber > 1000) {
      maxTokens = 12000;
    } else if (pdfSizeNumber > 500) {
      maxTokens = 10000;
    }
    console.log(`🔧 max_tokens: ${maxTokens}`);

    console.log('🤖 Chamando Lovable AI Gateway...');
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analise o documento PDF anexado e extraia os dados conforme o schema definido. Lembre-se: o PDF é a fonte da verdade. Não invente dados.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          }
        ],
        temperature: config.temperature,
        max_tokens: maxTokens
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('❌ Erro Lovable AI:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes no Lovable AI.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Erro AI Gateway: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const extractedText = aiData.choices?.[0]?.message?.content || '';
    const tokensUsed = aiData.usage?.total_tokens || Math.ceil(extractedText.length / 4);

    console.log(`📝 Texto extraído: ${extractedText.length} caracteres`);
    console.log(`🔢 Tokens usados: ${tokensUsed}`);

    // Verificar resposta do Gatekeeper
    const isGatekeeperBlock = extractedText.includes('ERRO_TIPO_INCOMPATIVEL');
    const isProductNotFound = extractedText.includes('PRODUCT_NOT_FOUND');

    // Verificar alucinações suspeitas
    const suspiciousSections = [
      '## 🛒 Produtos Relacionados',
      '## Produtos Relacionados',
      '## Recomendações',
    ];
    
    let hasHallucination = false;
    for (const section of suspiciousSections) {
      if (extractedText.includes(section)) {
        console.warn(`⚠️ Possível alucinação: "${section}"`);
        hasHallucination = true;
      }
    }

    if (isGatekeeperBlock) {
      console.warn('🚫 GATEKEEPER bloqueou a extração');
    }
    if (isProductNotFound) {
      console.warn('🔍 Produto não encontrado no documento');
    }

    return new Response(
      JSON.stringify({
        extractedText,
        tokensUsed,
        model: config.model,
        temperature: config.temperature,
        documentType,
        targetProduct: targetProduct || null,
        gatekeeperBlock: isGatekeeperBlock,
        productNotFound: isProductNotFound,
        hasHallucination
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro em extract-pdf-specialized:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
