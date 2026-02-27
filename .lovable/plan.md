

## Diagnostico: Por que a LIA nao fez analise cognitiva

### Causa Raiz

A cadeia de eventos esta quebrada no frontend:

```text
Usuario conversa → DraLIA.tsx → fireSummarize() → dra-lia?action=summarize_session → cognitive-lead-analysis
                        ↑
                  FALHA AQUI
```

**O `fireSummarize()` so dispara se:**
1. `sessionStorage('dra_lia_lead_collected')` estiver setado (lead validou email)
2. `sessionStorage('dra_lia_summarized')` NAO estiver setado (evita duplicidade)
3. Usuario ficar 2 min inativo OU fechar aba/trocar de pagina
4. Ter enviado >= 2 mensagens

**Evidencia:** Todos os leads de teste (Deus=16 msgs, Jesuino=30 msgs, Josias=8 msgs) tem `total_messages=0` e `total_sessions=0` no `lia_attendances`. Isso prova que `summarize_session` **nunca executou** para nenhum deles.

**Hipoteses do por que:**
- O flag `dra_lia_lead_collected` nao foi setado (coleta de lead falhou ou resposta da LIA nao teve o texto esperado como "Acesso validado")
- O `sendBeacon` falhou silenciosamente (nao tem feedback ao usuario)
- O timer de 2 min nao disparou (usuario ficou ativo ou fechou antes)

### Plano de Correcao

#### 1. Fallback server-side no `dra-lia/index.ts`
Adicionar logica no handler principal de chat: a cada resposta, verificar se o lead ja tem 5+ interacoes naquela sessao e `summarize_session` nunca rodou. Se sim, disparar `summarize_session` automaticamente como fire-and-forget, sem depender do frontend.

#### 2. Trigger cognitivo independente do summarize
No proprio `dra-lia/index.ts`, apos cada resposta, verificar diretamente no `agent_interactions` se o lead tem 5+ mensagens totais e `cognitive_updated_at` e NULL. Se sim, disparar `cognitive-lead-analysis` diretamente, sem depender do `summarize_session`.

#### 3. Corrigir contadores `total_messages` e `total_sessions`
Adicionar update incremental de `total_messages` no handler de chat (a cada mensagem processada), nao apenas no `summarize_session`. Isso garante que os contadores estejam sempre atualizados.

#### 4. Extrair `produto_interesse` do chat (fix conhecido)
Atualizar `extractImplicitLeadData` para detectar nomes de produtos mencionados no texto (RayShape, Exoplan, MiiCraft, etc.) e salvar em `produto_interesse`.

### Arquivos a Modificar

| # | Arquivo | Acao |
|---|---------|------|
| 1 | `supabase/functions/dra-lia/index.ts` | Adicionar trigger cognitivo + update de contadores no handler de chat |
| 2 | `supabase/functions/dra-lia/index.ts` | Atualizar `extractImplicitLeadData` para extrair `produto_interesse` do texto |

### Ordem de Execucao

```text
1. Adicionar increment de total_messages no chat handler
2. Adicionar trigger cognitivo independente (bypass summarize)
3. Atualizar extractImplicitLeadData com NLP de produtos
4. Deploy + teste com lead novo
```

