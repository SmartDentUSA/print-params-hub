import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SYSTEM_SUPER_PROMPT } from '../_shared/system-prompt.ts';
import { aiComplete } from '../_shared/ai-router.ts';

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

    const pdfSizeKB = Math.round(pdfBase64.length / 1024);
    const requestId = Date.now();
    const pdfHash = pdfBase64.substring(0, 30);
    console.log(`[${requestId}] 🔑 PDF Hash: ${pdfHash}...`);
    console.log(`[${requestId}] 📄 Processing PDF: ${pdfSizeKB}KB`);

    console.log('Etapa 1/2: Limpando e organizando texto do PDF...');

    // Usar formato multimodal para enviar PDF ao modelo de visão
    const extractionPrompt = `**INSTRUÇÃO PRINCIPAL: EXTRAÇÃO, ESTRUTURAÇÃO E FIDELIDADE ABSOLUTA**

**Objetivo:** Transcrever o conteúdo integral do PDF fornecido, estruturando-o em um formato hierárquico, claro e de fácil leitura, garantindo a fidelidade completa a 100% das informações contidas no documento.

**Regras Essenciais de Saída (Output Structure):**

1. **Identificação Central (Obrigatória):** Inicie a resposta identificando o produto principal e o fabricante (Ex: "O produto é [NOME DO PRODUTO] da [FABRICANTE]").
2. **Estrutura de Títulos:** Utilize títulos de primeiro nível (\`##\`) para replicar as seções principais do documento exatamente como aparecem no PDF.
3. **Formato de Lista:** Converta todas as listas (vantagens, instruções, cuidados) em **bullet points (\`*\`)**.
4. **Formato de Tabela:** Preserve o formato de **tabela** quando o PDF apresentar dados tabulares.
5. **Destaques:** Use **negrito (\`**...**\`)** para enfatizar termos-chave e resultados conforme aparecem no documento original.
6. **Instruções Sequenciais:** Liste os passos ou instruções de forma sequencial e numerada, se presentes no documento.
7. **Restrição de Conteúdo:** Informações de contato (endereços, telefone, websites) e Adendos de Personalização/Contexto DE FORMA ALGUMA DEVEM SER INCLUÍDAS na saída final.

**Regras Anti-Alucinação e Fidelidade (CRÍTICAS):**

A. **Transcrição Literal:** Transcreva o texto de forma **literal** e **íntegra**. Não parafraseie, resuma, invente ou complete informações.
B. **Invenção Proibida:** Se um dado estiver ambíguo ou incompleto no PDF, transcreva-o exatamente como está no PDF e **NÃO O MODIFIQUE OU DEDUZA**.
C. **Sem Conteúdo Externo:** NÃO adicione informações que não estejam no PDF. NÃO use conhecimento prévio sobre produtos. APENAS extraia o que está no documento.
D. **Sem Exemplos:** NÃO use exemplos de outros produtos. Extraia APENAS o conteúdo do PDF fornecido.

**Fluxo Esperado (Garantia de Fidelidade):**

* Identificação do Produto conforme aparece no PDF.
* Linha horizontal (\`---\`).
* Título principal do documento.
* Seções principais conforme aparecem no PDF (Ex: \`## 1. DESCRIÇÃO\`, \`## 2. VANTAGENS\`, \`## 3. ESPECIFICAÇÕES\`).
* Linha horizontal (\`---\`) entre seções principais.
* Tabelas e instruções preservadas no formato original.
* **IMPORTANTE:** Use APENAS o conteúdo do PDF. NÃO invente, NÃO complete, NÃO use exemplos de outros produtos.

Extraia TODO o conteúdo do PDF anexo seguindo estas regras.`;

    const r = await aiComplete({
      task: 'pdf_extract',
      functionName: 'extract-pdf-text',
      maxTokens: 12000,
      messages: [
        { role: 'system', content: SYSTEM_SUPER_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: extractionPrompt },
            {
              type: 'file',
              file: {
                filename: 'document.pdf',
                file_data: `data:application/pdf;base64,${pdfBase64}`,
              },
            },
          ],
        },
      ],
    });

    if (!r.ok) {
      console.error(`[${requestId}] ❌ AI router failed`, r.error_code, r.attempts);
      const status = r.error_code === 'credits_exhausted' ? 402
        : r.error_code === 'rate_limited' ? 429
        : 500;
      const msg = r.error_code === 'credits_exhausted'
        ? 'Créditos esgotados em todos os provedores de IA. Adicione créditos ou configure fallback no painel AI Routing.'
        : r.error_code === 'rate_limited'
        ? 'Limite de requisições atingido em todos os provedores. Aguarde e tente novamente.'
        : `Falha ao processar PDF: ${r.error}`;
      return new Response(
        JSON.stringify({ error: msg, error_code: r.error_code, attempts: r.attempts }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const extractedText = r.text;
    console.log(`[${requestId}] ✅ Provider used: ${r.provider_used}/${r.model_used}`);

    if (!extractedText) {
      console.error(`[${requestId}] ❌ No text extracted from AI response`);
      return new Response(
        JSON.stringify({ error: 'Não foi possível extrair texto do PDF' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firstChars = extractedText.substring(0, 200).replace(/\n/g, ' ');
    console.log(`[${requestId}] ✅ Extracted ${extractedText.length} chars`);
    console.log(`[${requestId}] 📝 Text preview: "${firstChars}..."`);
    console.log(`[${requestId}] Texto limpo extraído:`, extractedText.length, 'caracteres');

    return new Response(
      JSON.stringify({ extractedText, provider_used: r.provider_used, model_used: r.model_used }),
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
