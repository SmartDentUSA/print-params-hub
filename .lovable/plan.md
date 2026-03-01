

## Pendência: Atualizar o tom da resposta da LIA

O handoff funciona perfeitamente, mas a LIA ainda responde com frases de "confissão de ignorância" em vez do tom proativo aprovado.

### O que falta implementar

**Arquivo: `supabase/functions/dra-lia/index.ts`**

1. **System Prompt (regras 21-24)**: Substituir as frases de segurança:
   - DE: "Não tenho essa informação específica cadastrada no momento"
   - PARA: "Já entendi sua dúvida! 😊 Estou acionando um especialista do nosso time que vai te chamar no WhatsApp e explicar cada detalhe sobre {tema}. Possui alguma outra dúvida além dessa?"

2. **FALLBACK_MESSAGES**: Atualizar PT/EN/ES com o mesmo tom proativo

3. **IDK_PATTERNS**: Adicionar os novos padrões (`/acionando um especialista/i`, `/vai te chamar no WhatsApp/i`) para continuar disparando o handoff

### Classificação de Leads (aprovado anteriormente)

Adicionar lógica de classificação automática no `notifySellerHandoff`:
- **LIA_LEAD_NOVO**: lead não existia antes
- **LIA_LEAD_REATIVADO**: lead existia + inativo >30d ou status estagnado/perdido
- **LIA_LEAD_ATIVADO**: lead existia + ativo

Atualizar `origem_campanha` e `tags_crm` com o tipo detectado, e incluir nota no PipeRun com contexto de reativação.

### Arquivos alterados
| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/dra-lia/index.ts` | System prompt, FALLBACK_MESSAGES, IDK_PATTERNS, classificação de lead no handoff |

