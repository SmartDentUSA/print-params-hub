

## Plano: Esconder Cards de Rota Antes da Qualificação Completa

### Problema Identificado

Dois problemas simultâneos:

1. **Cards de rota aparecem antes da qualificação**: Na linha 731 de `DraLIA.tsx`, os topic cards são exibidos quando `!topicSelected && !isLoading`, mas **não verificam** `leadCollected`. Isso significa que durante o onboarding (pedindo email, nome, área, especialidade), os cards já aparecem abaixo da última mensagem do assistente.

2. **Regex de detecção desatualizada**: As mensagens de confirmação foram alteradas na última implementação (de "Agora sim, estou pronta" para "Acesso validado, seu token é o..."), mas os regex fallback nas linhas 442, 634 e 1000 ainda procuram pelas mensagens antigas. Isso impede que `leadCollected` seja ativado via fallback textual (embora o `ui_action: show_topics` do backend já resolva isso na maioria dos casos).

### Correções

**Arquivo: `src/components/DraLIA.tsx`**

**Correção 1 — Linha 731**: Adicionar `&& leadCollected` à condição de exibição dos topic cards:

```
// ANTES
return msg.id === lastAssistantId && !topicSelected && !isLoading;

// DEPOIS
return msg.id === lastAssistantId && !topicSelected && !isLoading && leadCollected;
```

Isso garante que os cards de rota só aparecem após a qualificação completa (email → nome → área → especialidade → confirmação com `show_topics`).

**Correção 2 — Linhas 442, 634, 1000**: Atualizar os regex fallback para incluir as novas mensagens de confirmação:

```
// ANTES
/Agora sim, estou pronta|Now I'm ready|Ahora sí, estoy lista|Que bom te ver de novo|...|/i

// DEPOIS (adicionar novas mensagens)
/Acesso validado|Access validated|Acceso validado|Que bom te ver por aqui novamente|Great to see you again|Qué bueno verte de nuevo|Agora sim, estou pronta|Now I'm ready|Ahora sí, estoy lista|Que bom te ver de novo|Que bom que voltou|Great to have you back|Qué bueno que volviste/i
```

### Resumo

```
MODIFICAR:
  src/components/DraLIA.tsx
    - Linha 731: adicionar && leadCollected na condição dos topic cards
    - Linhas 442, 634, 1000: atualizar regex com novas mensagens
```

Duas alterações cirúrgicas que resolvem o problema sem afetar nenhuma outra lógica.

