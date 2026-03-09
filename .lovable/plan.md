

# Fix: Garantir coleta completa antes de RAG/rotas

## Problema
Quando um lead real chega pelo WhatsApp, o `dra-lia-whatsapp` faz pre-seed da sessão com `lead_id`, `lead_name`, `lead_email` mas **sem flags `awaiting_phone/area/specialty`**. O `detectLeadCollectionState` retorna `from_session` e o lead vai direto para o RAG/rotas sem completar o cadastro.

O mesmo acontece se uma sessão web for restaurada de um estado anterior onde as flags não foram definidas.

## Solução
Adicionar verificação de perfil completo no bloco `from_session` (linha 3960 de `dra-lia/index.ts`). Antes de seguir para o RAG, buscar o `lia_attendances` do lead e verificar se `telefone_normalized`, `area_atuacao` e `especialidade` estão preenchidos. Se não, setar as flags `awaiting_*` e redirecionar para o interceptor correto.

## Alteração

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/dra-lia/index.ts` | Expandir o bloco `from_session` (linha 3960) para verificar perfil e forçar coleta de dados faltantes antes de prosseguir |

### Lógica

```text
if (leadState.state === "from_session") {
  currentLeadId = leadState.leadId;
  
  // Buscar perfil no lia_attendances
  const { data: profile } = await supabase.from("lia_attendances")
    .select("telefone_normalized, area_atuacao, especialidade")
    .eq("email", leadState.email)
    .maybeSingle();
  
  const missingPhone = !profile?.telefone_normalized;
  const missingArea = !profile?.area_atuacao;
  const missingSpecialty = !profile?.especialidade;
  
  if (missingPhone || missingArea || missingSpecialty) {
    // Atualizar sessão com flags e redirecionar
    // missingPhone → pedir telefone
    // !missingPhone && missingArea → pedir área  
    // !missingArea && missingSpecialty → pedir especialidade
    // Retornar resposta sem ir para RAG
  }
}
```

Isso garante que **todo lead** — web, WhatsApp, embed — passe pela sequência completa (email → nome → telefone → área → especialidade) antes de ver qualquer card de rota ou resposta do RAG.

