## Diagnóstico

O card 🧪 Pré/Pós-Processamento na Base de Conhecimento lê `resins.processing_instructions` **diretamente** (`KbTabCatalogo.tsx`, linha 441-442) — sem cache intermediário. Quando o idioma da página é EN ou ES, o hook `useCardTranslations` mostra o valor da coluna `processing_instructions_en` / `_es` se ela **não estiver vazia**; só chama a Edge Function `translate-card-row` quando a coluna traduzida está nula.

Consultando o banco, várias resinas foram atualizadas em 30/06 mas as colunas traduzidas continuam com o texto antigo (ex.: *Smart Print Bio Bite Splint +Flex* → PT=2001 chars, EN=1291 chars, ES=1425 chars; *Smart Print Try-in Calcinavel* → PT=3679, EN=2215, ES=2467). Ou seja: em EN/ES o KB mostra a tradução obsoleta. Em PT o card também não reflete se a página estiver com cache do bundle antigo, mas o problema estrutural é o cache das traduções.

O `updateResin` (`src/hooks/useSupabaseCRUD.ts:152`) grava apenas o PT — nada limpa `_en/_es`, então a tradução velha “trava” eternamente.

## Objetivo

Sempre que um campo traduzível de `resins` mudar em PT, invalidar automaticamente as colunas `_en/_es` correspondentes para que o `useCardTranslations` re-traduza no próximo acesso. Aplicar cleanup pontual para as resinas já editadas em 2026-06.

## O que fazer

1. **Invalidar traduções no update (frontend, `useSupabaseCRUD.updateResin`)**
   - Antes do `.update(dbUpdates)`, carregar a linha atual da resina.
   - Para cada campo traduzível listado abaixo, se o novo valor PT diferir do atual, adicionar `<campo>_en = null` e `<campo>_es = null` ao payload do update.
   - Campos traduzíveis considerados: `name`, `processing_instructions`, `technical_specs`, `cta_1_label`, `cta_2_label`, `cta_3_label`, `cta_4_label` (mesma lista já usada em `KbTabCatalogo` / `useCardTranslations`).
   - Idempotente: nenhum efeito quando o PT não mudou.

2. **Cleanup pontual dos dados já stale (migration/insert SQL)**
   - `UPDATE public.resins SET processing_instructions_en = NULL, processing_instructions_es = NULL WHERE processing_instructions IS NOT NULL AND updated_at >= '2026-06-01' AND (processing_instructions_en IS NOT NULL OR processing_instructions_es IS NOT NULL);`
   - Só o campo Pré/Pós — evita retraduzir massivamente conteúdos que o usuário não tocou. Nas próximas edições, o passo 1 mantém isso limpo automaticamente.

3. **Sem mudanças de UI** — o card já lê o campo correto; a correção é só na camada de dados / cache de tradução.

## Fora de escopo

- Não alterar `system_a_catalog`, `resin_documents` ou o Painel Admin.
- Não mexer em outros campos além dos traduzíveis listados.
- Não forçar re-tradução em massa (respeita a política atual on-demand).

## Como validar

- Editar Pré/Pós de uma resina em PT no Painel Admin → abrir o KB em PT (deve mostrar texto novo na hora), depois trocar para EN/ES (deve disparar `translate-card-row` e, após concluir, exibir o texto novo traduzido).
- Conferir no console do navegador o log `[useCardTranslations]` para a resina editada quando em EN/ES.
