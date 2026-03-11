

# Copilot IA com Reconhecimento de Voz

## Situação atual
O componente `SmartOpsCopilot.tsx` ainda não foi criado. Vou implementar o Copilot completo **já com reconhecimento de voz nativo** usando a Web Speech API do navegador (gratuita, sem API key extra).

## Reconhecimento de voz

Usarei a **Web Speech API** (`SpeechRecognition`) nativa do navegador:
- Sem custo, sem API key adicional
- Funciona em Chrome, Edge, Safari (cobertura ~95% dos usuários)
- Suporte a português brasileiro (`pt-BR`)
- Botão de microfone no input — pressiona para falar, texto aparece automaticamente no campo

## O que será construído

### 1. Edge Function `smart-ops-copilot`
- DeepSeek `deepseek-chat` com tool calling
- 19 ferramentas: `query_leads`, `update_lead`, `add_tags`, `create_audience`, `send_whatsapp`, `send_to_sellflux`, `call_loja_integrada`, `search_videos`, `search_content`, `ingest_knowledge`, `create_article`, `import_csv`, `unify_leads`, `check_missing_fields`, `describe_table`, `query_table`, `query_stats`, `calculate`, `call_edge_function`
- Streaming SSE para resposta em tempo real
- System prompt com schema completo do banco

### 2. Frontend `SmartOpsCopilot.tsx`
- Interface estilo Gemini com saudação e sugestões rápidas
- **Botão de microfone** no input com indicador visual de gravação (pulso vermelho)
- Streaming token-by-token via SSE
- Renderização de markdown (tabelas, listas)
- Upload de CSV no chat
- Sugestões: "Leads sem follow-up 7 dias", "Relatório vendas mês", etc.

### 3. Registro
- Nova aba "🤖 Copilot" no `SmartOpsTab.tsx`
- Função em `supabase/config.toml`

## Arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/smart-ops-copilot/index.ts` | **Novo** — DeepSeek + 19 tools + SSE |
| `src/components/SmartOpsCopilot.tsx` | **Novo** — Chat UI + voz + streaming + CSV |
| `src/components/SmartOpsTab.tsx` | **Editar** — Adicionar aba Copilot |
| `supabase/config.toml` | **Editar** — Registrar function |

## Detalhe do reconhecimento de voz

```text
[Input de texto] [🎤]
                   │
                   ├─ Click → inicia SpeechRecognition(lang: "pt-BR")
                   ├─ Indicador vermelho pulsante enquanto grava
                   ├─ onresult → texto inserido no input
                   └─ onend → para gravação, usuário pode enviar
```

O botão alterna entre estados: parado (cinza) → gravando (vermelho pulsante). O texto reconhecido é inserido automaticamente no campo de input, podendo ser editado antes de enviar.

