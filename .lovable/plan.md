
## Objetivo

Hoje a nota 7×3 lista stack, lacunas, combo e 5 bullets soltos. O vendedor não consegue, em 10 segundos, ver:

1. **Onde o lead está hoje** (situação + papel/volume)
2. **Quais dores ele provavelmente tem** com esse setup
3. **Por que essas dores importam** (impacto clínico/financeiro)
4. **Por que o produto de interesse resolve** (ponte explícita)
5. **O que perguntar** para confirmar essas hipóteses (SPIN real)

Vou reformatar a saída de `_shared/workflow-diagnosis.ts` em um bloco SPIN consultivo, mantendo todo o pipeline existente (mapping 7×3, RAG, idempotência da nota, WhatsApp).

## Escopo (somente apresentação + prompt LLM, zero mudança de regra de negócio)

### 1. Novo schema interno `SpinBriefing`

Gerado em paralelo ao `WorkflowDiagnosis`, alimentado pelo Gemini (`google/gemini-3-flash-preview`, já em uso) via `Output.object` / JSON estruturado para garantir formato:

```text
{
  situacao: string        // 1-2 frases: papel + stack-chave + intenção
  dores_provaveis: [      // 2-4 itens, derivadas de lacunas + concorrentes
    { dor: string, evidencia: string }
  ],
  implicacoes: [          // 2-3 itens: tempo perdido / retrabalho / ROI / risco clínico
    string
  ],
  ponte_produto: string,  // 1-2 frases: como o PRODUTO DE INTENÇÃO resolve essas dores específicas (usa RAG)
  perguntas_spin: {
    situacao:  [string],  // 1 pergunta — confirmar contexto que ainda está vago
    problema:  [string, string], // 2 perguntas — provocar consciência da dor
    implicacao:[string, string], // 2 perguntas — quantificar impacto
    necessidade:[string]  // 1 pergunta — convidar à solução (gancho do produto)
  },
  alerta_lacuna?: string  // só se houver lacuna real de fluxo (ex: quer impressora sem scanner)
}
```

### 2. Novo prompt Gemini (substitui o atual de 5 bullets)

- Continua recebendo: stack, concorrentes, intent, lacunas, combo, dossiês RAG (intent + Rayshape quando impressora envolvida).
- Instrução muda para: "Você é coach SPIN de um vendedor consultivo. Use a stack do lead e o dossiê RAG para gerar um briefing SPIN específico **deste lead**. Perguntas devem citar o que ele JÁ TEM (não genéricas). Implicações devem ser concretas (peças/mês, hora-cadeira, retrabalho, garantia). PROIBIDO inventar specs/preços; usar só o dossiê RAG."
- Mantém as travas duras existentes: nunca cruzar marcas, nunca sugerir outro produto da mesma etapa, marca do lead nunca é "concorrente".
- Output via JSON estruturado (não bullets soltos), parsed com fallback soft: se Gemini falhar, cai no formato atual de 5 bullets (back-compat).

### 3. Heurística determinística (sem LLM) para `dores_provaveis` e `implicacoes`

Funciona como **fallback e seed do prompt** — garante que mesmo sem LLM já temos um esqueleto SPIN:

- Concorrente impressora detectado → dor "calibração/perfil de resina instável", implicação "horas perdidas e retrabalho de peças odontológicas".
- Concorrente scanner detectado → dor "alinhamento e exportação STL", implicação "atraso no envio ao CAD/laboratório".
- Lacuna em etapa anterior à intenção (ex: quer Rayshape mas não tem scanner) → dor "fluxo quebrado a montante", implicação "equipamento parado".
- Intent é resina + tem impressora genérica → dor "perfil não validado para a marca da impressora dele", implicação "rejeição clínica".
- Intent etapa 6 (cursos) + nenhum equipamento → dor "curva de aprendizado", implicação "investimento parado sem produzir caso clínico".

Essas regras alimentam o prompt como contexto E aparecem na nota mesmo quando o LLM falha.

### 4. Renderers atualizados

**`renderDiagnosisHTML` (nota PipeRun)** — substitui o bloco atual por:

```text
🧭 Diagnóstico SPIN (Fluxo Digital 7×3)

📍 SITUAÇÃO
{situacao em 1-2 frases}
Stack: {etapas com dados resumidas}
Intenção: {produto} → {etapa-alvo}  [≈ {produto_mapeado}]

⚠️ DORES PROVÁVEIS (a confirmar)
• {dor 1} — evidência: {ex: usa Anycubic + interesse em resina dental}
• {dor 2} — evidência: ...

💸 IMPLICAÇÕES
• {impacto 1}
• {impacto 2}

🎯 PONTE PARA O PRODUTO DE INTERESSE
{como {produto} resolve essas dores específicas, com 1 spec do RAG}

📋 PERGUNTAS SPIN (na ordem)
S → {1 pergunta de situação}
P → {2 perguntas de problema}
I → {2 perguntas de implicação}
N → {1 pergunta de necessidade}

🛒 Combo natural (após confirmar necessidade)
{mantém o combo atual: etapa-alvo · próxima etapa · curso}

🚨 {alerta_lacuna se houver}
```

**`renderDiagnosisWhatsApp`** — versão enxuta (8-10 linhas):
```text
🧭 SPIN — {nome lead}
Situação: {1 linha}
Dor #1: {dor 1}
Impacto: {implicação chave}
Ponte: {produto} resolve porque {benefício RAG}
Pergunte (SPIN):
  S- {…}
  P- {…}
  I- {…}
  N- {…}
```

**`renderDiagnosisForPrompt`** (entra no prompt da Dra. LIA / cognitive) — versão texto plano do mesmo briefing, ancorando o `recommended_approach` em SPIN ao invés de só listar stack/lacunas.

### 5. Compatibilidade

- A interface `WorkflowDiagnosis` ganha campo opcional `spin?: SpinBriefing`. `llm_script` continua existindo como fallback.
- `smart-ops-preview-seller-note` passa a retornar `diagnosis.spin` no JSON para validação rápida via curl.
- `buildSellerDealSummaryHTML` continua usando `renderDiagnosisHTML` — nenhuma mudança no `lia-assign` ou no posting PipeRun.
- Hash de idempotência da nota (`last_seller_note_hash`) continua válido — o novo conteúdo simplesmente gera um hash diferente na primeira execução pós-deploy (1 nova nota por deal, esperado).

## Arquivos alterados

- `supabase/functions/_shared/workflow-diagnosis.ts` — novo schema `SpinBriefing`, heurística determinística, novo prompt Gemini com JSON estruturado, renderers HTML/WhatsApp/Prompt reescritos, fallback para o formato antigo.
- `mem/smart-ops/seller-note-workflow-diagnosis.md` — atualizar a memória para refletir SPIN como saída principal.

Nenhuma migration, nenhuma mudança em `lia-assign`, `cognitive-analysis`, `seller-summary` ou frontend.

## Validação

1. `curl smart-ops-preview-seller-note?email=danilohen@gmail.com` — conferir `diagnosis.spin` populado, ponte produto cita IoConnect+Medit, perguntas SPIN mencionam o scanner i900 dele.
2. Rodar com lead sem intent reconhecido — confirmar que SITUAÇÃO/PERGUNTAS aparecem mesmo assim (sem PONTE).
3. Forçar LLM off (`enableLLM: false`) — confirmar que a heurística determinística ainda renderiza Dor/Implicação/Perguntas a partir das lacunas+concorrentes.
4. Comparar hash da nota antes/depois para garantir que rodou só 1 vez por deal.

