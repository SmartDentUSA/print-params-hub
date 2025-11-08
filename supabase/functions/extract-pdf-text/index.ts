import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SYSTEM_SUPER_PROMPT } from '../_shared/system-prompt.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64 } = await req.json();

    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ error: 'PDF base64 data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Etapa 1/2: Limpando e organizando texto do PDF...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: SYSTEM_SUPER_PROMPT
          },
          {
            role: 'user',
            content: `**INSTRUÇÃO PRINCIPAL: EXTRAÇÃO, ESTRUTURAÇÃO E FIDELIDADE ABSOLUTA**

**Objetivo:** Transcrever o conteúdo integral do PDF fornecido, estruturando-o em um formato hierárquico, claro e de fácil leitura, garantindo a fidelidade completa a 100% das informações contidas no documento.

**Regras Essenciais de Saída (Output Structure):**

1. **Identificação Central (Obrigatória):** Inicie a resposta identificando o produto principal e o fabricante (Ex: "O produto é X da Y").
2. **Estrutura de Títulos:** Utilize títulos de primeiro nível (\`##\`) para replicar as seções principais do documento (Ex: "## 1. DESCRIÇÃO DO PRODUTO", "## 2. VANTAGENS DO GLAZE ON").
3. **Formato de Lista:** Converta todas as listas (vantagens, instruções, cuidados) em **bullet points (\`*\`)**.
4. **Formato de Tabela:** Preserve o formato de **tabela** para a seção de \`PARÂMETROS MÍNIMOS VALIDADOS DE FOTOPOLIMERIZAÇÃO\`.
5. **Destaques:** Use **negrito (\`**...**\`)** para enfatizar termos-chave e resultados (Ex: resistência, brilho superior, 10,5% RESISTÊNCIA MPa).
6. **Instruções Sequenciais:** Liste os passos de aplicação (Passos 7 a 11) de forma sequencial e numerada.
7. **Restrição de Conteúdo:** Informações de contato (endereços, telefone, websites) e Adendos de Personalização/Contexto DE FORMA ALGUMA DEVEM SER INCLUÍDAS na saída final.

**Regras Anti-Alucinação e Fidelidade (Obrigatórias):**

A. **Transcrição Literal:** Transcreva o texto de forma **literal** e **íntegra**. Não parafraseie, resuma, invente ou complete informações.
B. **Invenção Proibida:** Se um dado estiver ambíguo ou incompleto no PDF, transcreva-o exatamente como está no PDF e **NÃO O MODIFIQUE OU DEDUZA**.
C. **Busca Externa:** A busca na web só deve ser acionada em caso de necessidade de validar termos técnicos ou especificações de segurança. **SE ACIONADA, o resultado da busca DEVE SER APENAS USADO PARA VALIDAÇÃO INTERNA E NÃO DEVE SER INCLUÍDO NA SAÍDA FINAL**, a menos que o usuário solicite explicitamente a informação externa.

**Fluxo Esperado (Garantia de Fidelidade):**

* Identificação do Produto.
* Linha horizontal (\`---\`).
* Título principal do Ebook.
* Seção \`## 1. DESCRIÇÃO DO PRODUTO\`.
* Linha horizontal (\`---\`).
* Seção \`## 2. VANTAGENS DO GLAZE ON\` (em bullet points).
* ... (Continuação de todas as seções, Tabelas e Instruções de Aplicação, com o conteúdo fiel, SEM incluir contato ou adendos).

Conteúdo do PDF (base64):
${pdfBase64.substring(0, 100000)}`
          }
        ],
        max_completion_tokens: 12000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições atingido. Aguarde alguns segundos e tente novamente.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos Lovable AI esgotados. Adicione créditos em Settings → Workspace → Usage.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Erro ao processar PDF. Verifique se o arquivo não está corrompido.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content;

    if (!extractedText) {
      console.error('No text extracted from AI response');
      return new Response(
        JSON.stringify({ error: 'Não foi possível extrair texto do PDF' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Texto limpo extraído:', extractedText.length, 'caracteres');

    return new Response(
      JSON.stringify({ extractedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-pdf-text function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido ao processar PDF' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
