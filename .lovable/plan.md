
# Correção: Proibir Oferta de Vídeos Não Confirmados no RAG

## Diagnóstico Preciso

### O que aconteceu
A conversa tinha 2 turnos:
1. "Preciso saber como é o protocolo de limpeza da resina Vitality" → respondido corretamente (fix de media cards funcionou)
2. "Sim" (confirmando querer saber sobre pós-cura UV) → L.I.A. respondeu com o protocolo de pós-cura correto, **mas finalizou inventando**: *"Também tenho um vídeo detalhando as configurações técnicas para diferentes impressoras se você precisar — quer assistir?"*

### Por que aconteceu
A **Regra 8** do `systemPrompt` em `dra-lia/index.ts` (linha 1112) contém esta permissão:

```
Em todos os outros casos, NO MÁXIMO mencione: "Também temos um vídeo sobre esse tema — quer ver?"
```

Essa cláusula autoriza o LLM a **sugerir espontaneamente** vídeos mesmo quando:
- Nenhum vídeo relevante foi encontrado no RAG
- O contexto atual é de protocolo (não de parâmetros de impressora)
- O usuário não pediu vídeo

O LLM "completou" com conhecimento próprio que "existe um vídeo sobre configurações técnicas para impressoras" — clássica alucinação factual disfarçada de cortesia.

### Por que os media cards não são o problema aqui
O fix anterior eliminou os cards visuais. O problema agora é **texto gerado pelo LLM** que menciona a existência de um vídeo — isso é independente do sistema de cards.

## Solução: 2 Alterações Cirúrgicas no System Prompt

### Alteração 1 — Reformular a Regra 8 para proibir menção espontânea de vídeos

**Antes (linha 1112):**
```
8. Se houver vídeos no contexto, cite-os apenas se forem diretamente relevantes à pergunta. 
Só inclua links de vídeos se o usuário pediu explicitamente (palavras: "vídeo", "video", "assistir", 
"ver", "watch", "tutorial", "mostrar"). Em todos os outros casos, NO MÁXIMO mencione: 
"Também temos um vídeo sobre esse tema — quer ver?"
```

**Depois:**
```
8. Se houver vídeos no contexto, cite-os apenas se forem diretamente relevantes à pergunta.
Só inclua links de vídeos se o usuário pediu explicitamente (palavras: "vídeo", "video", "assistir",
"ver", "watch", "tutorial", "mostrar"). Em todos os outros casos, PROIBIDO mencionar ou sugerir 
a existência de vídeos. NÃO diga "Também temos um vídeo", "temos um tutorial", 
"posso te mostrar um vídeo" — a menos que o RAG tenha retornado explicitamente um vídeo 
com VIDEO_INTERNO ou VIDEO_SEM_PAGINA no contexto desta conversa.
```

### Alteração 2 — Reforçar Regra 14 (Anti-alucinação) para cobrir vídeos

**Acrescentar ao item 14 (linha 1120):**
```
14. NUNCA cite produtos, parâmetros ou vídeos como "exemplos" quando o usuário não mencionou 
aquele produto/marca/impressora específica. Use APENAS os dados diretamente relevantes à pergunta feita.
NUNCA afirme ter um vídeo sobre um tema se não houver VIDEO_INTERNO ou VIDEO_SEM_PAGINA 
nas fontes de contexto desta resposta.
```

## Arquivo Modificado

| Arquivo | Linhas | Ação |
|---|---|---|
| `supabase/functions/dra-lia/index.ts` | 1112 e 1120 | Edição cirúrgica do system prompt |

## Tabela de Validação Pós-deploy

| Cenário | Comportamento esperado |
|---|---|
| "Preciso saber o protocolo de limpeza" → "Sim" | Resposta sobre pós-cura SEM oferta de vídeo inventado |
| "Tem vídeo sobre protocolo de limpeza?" | Só menciona vídeo se RAG retornou VIDEO_INTERNO |
| "Como usar a Anycubic Mono X?" | Responde sem inventar que existe um tutorial |
| "Quero ver um tutorial de pós-cura" | Busca no RAG e só cita se encontrar vídeo real |
| Contexto com VIDEO_INTERNO presente | Mantém comportamento atual — menciona o vídeo com link correto |

## Impacto

- Nenhuma migração de banco
- Nenhuma alteração de lógica de busca
- Deploy automático após edição
- O problema de alucinação de texto é eliminado na raiz — o LLM não terá mais "permissão" para inventar ofertas de vídeo
