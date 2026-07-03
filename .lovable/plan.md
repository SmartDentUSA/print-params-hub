## Objetivo
1. Trocar o campo **Tom da mensagem** por uma lista pronta de tons.
2. Corrigir o email quebrado (acentos sumindo — "Alta Precis o" — e tags soltas tipo `</td` no corpo).

---

## 1) Lista de Tons (dropdown)

No `EmailComposer.tsx`, substituir o `<Input>` livre por um `<Select>` com estas opções curadas para o público odontológico Smart Dent:

| Valor | Rótulo | Uso ideal |
|---|---|---|
| `consultivo` | 🎓 Consultivo | Fluxo padrão B2B — orienta sem pressionar |
| `tecnico` | 🔬 Técnico especialista | Laboratórios / dentistas avançados |
| `educativo` | 📚 Educativo | Base de conhecimento, artigos, casos clínicos |
| `direto_comercial` | 🎯 Direto & Comercial | Leads quentes prontos para conversão |
| `storytelling` | 📖 Storytelling clínico | Casos reais, jornada de transformação digital |
| `urgencia_soft` | ⏰ Urgência suave | Reativação, últimas vagas de curso |
| `celebrativo` | 🎉 Celebrativo | Lançamentos, novidades, marcos |
| `reativacao_amigavel` | 🤝 Reativação amigável | Leads frios — reconecta sem cobrar |
| `pos_venda_cs` | ✅ Pós-venda / CS | Onboarding, suporte, satisfação |
| `evento_convite` | 🎫 Convite p/ evento | Cursos, webinars, feiras |
| `custom` | ✏️ Personalizado… | Libera campo de texto livre |

Só aparece o input livre quando `tom === "custom"`. O valor selecionado vai para o edge `smart-ops-generate-email-ai` no campo `tom` (já existente). No prompt do sistema, expandir cada preset em uma diretriz curta (ex.: `tecnico` → "Vocabulário técnico odontológico, foco em precisão, ISO/fluxo digital, sem hype").

---

## 2) Corrigir o email quebrado

Diagnóstico do print do usuário:
- **"Alta Precis o:"** → o "ã" foi corrompido no transporte.
- **`</td`** vazando no final → HTML gerado pela IA está fragmentado / sem `<html><body>` wrapper.

### Causa raiz A — codificação base64
Em `supabase/functions/smart-ops-send-gmail/index.ts`, o corpo RFC 2822 usa `Content-Transfer-Encoding: base64` mas é codificado com `b64url()` (URL-safe, troca `+`→`-`, `/`→`_`). Gmail decodifica **base64 padrão**, então bytes UTF-8 que caem em `+` ou `/` são destruídos → acentos somem.

**Correção:** usar duas funções separadas:
- `b64std(s)` = base64 padrão (com `+/=`) — para o **corpo** do RFC 2822 e para o **subject** encoded-word (`=?UTF-8?B?...?=`).
- `b64url(s)` = URL-safe — usada **só** no envelope final do parâmetro `raw` do endpoint `messages/send` (é o que a API do Gmail exige).

### Causa raiz B — HTML fragmentado da IA
A IA às vezes devolve trechos como `<td>...</td>` sem tabela mãe, ou fecha tags fora de ordem, e o wrapper do preheader é concatenado em cima disso → clientes de email renderizam texto solto e mostram `</td` como literal.

**Correção em 3 camadas:**
1. **No prompt** (`smart-ops-generate-email-ai`): reforçar "retorne HTML **completo** começando em `<!doctype html><html><body>` e terminando em `</body></html>`. NUNCA use `<table>` / `<td>` avulsos sem envolver em `<table>...</table>`."
2. **Sanitizador leve** em `smart-ops-send-gmail` antes de enviar:
   - Se não houver `<body`, envolver todo o HTML em `<!doctype html><html><body style="…">…</body></html>`.
   - Regex para remover tags de tabela órfãs no fim do documento (`</td>`, `</tr>`, `</table>` sem par).
   - Garantir cabeçalho `<meta charset="UTF-8">` dentro de `<head>` para acentos.
3. **Preview no composer**: mostrar aviso amarelo se o HTML gerado não contiver `<body>` ou tiver contagem desbalanceada de tags principais, com botão "Regerar".

### Ajustes menores no envio
- Adicionar `Content-Language: pt-BR` no cabeçalho RFC 2822.
- Confirmar `Content-Type: text/html; charset="UTF-8"` (já está).
- Line-wrap do base64 do corpo em 76 chars usando `\r\n` (não `\n`) — alguns servidores intermediários quebram com LF puro.

---

## Arquivos alterados

- `src/components/smartops/EmailComposer.tsx` — dropdown de tom + campo livre condicional.
- `supabase/functions/smart-ops-generate-email-ai/index.ts` — mapa de presets de tom + prompt reforçado exigindo HTML completo.
- `supabase/functions/smart-ops-send-gmail/index.ts` — split `b64std` / `b64url`, sanitizador de HTML, `\r\n` no wrap.

## Fora do escopo
- Editor visual WYSIWYG (fica para iteração seguinte).
- Anexos / imagens inline via CID.
- Templates salvos por tom (mem: só a lista agora).