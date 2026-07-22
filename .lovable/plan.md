## Diagnóstico

A mesclagem **funcionou** — o log mostra `Cirurgiã Dentista → CLÍNICA OU CONSULTÓRIO` com `updated: 1` às 20:34:35.

O que continua aparecendo na tela é uma string **diferente**: `Cirurgião Dentista` (masculino, com "ão") — 18 caracteres, 1 ocorrência (lead Luigi Linhares Tavares). O `.eq()` do PostgREST bate byte-a-byte, então "Cirurgiã" (feminino) e "Cirurgião" (masculino) são valores distintos e cada variante precisa da própria linha de mapeamento.

O botão **"Sugerir automaticamente"** também não pega esses casos porque compara `slugify(valor)` contra `slugify(opção canônica)`. Nenhuma opção canônica de `area_atuacao` contém "cirurgiao"/"dentista"/"cargo", então nada é sugerido.

## Correção proposta

Adicionar um **dicionário de sinônimos por campo** que o `suggestCanonical` (client) consulta antes de desistir. Assim variações profissionais/cargo caem em `CLÍNICA OU CONSULTÓRIO` num clique, e cada campo pode ganhar seus próprios apelidos com o tempo.

### Escopo

1. **`src/hooks/reactivation/useFieldNormalizer.ts`**
   - Novo mapa `FIELD_SYNONYMS: Record<string, Record<string, string>>` (chave = slug do valor bruto → canônico oficial).
   - `suggestCanonical(raw, options, field?)` — se `field` for passado, tenta o dicionário antes das heurísticas atuais.
   - Sementes iniciais para `area_atuacao` (baseadas nos valores já observados na base):
     - `cirurgiao_dentista`, `cirurgia_dentista`, `cirurgiao-dentista`, `dentista`, `clinico`, `cargo_nao_informado`, `clinica`, `consultorio`, `clinica_consultorio` → `CLÍNICA OU CONSULTÓRIO`
     - `protetico`, `tecnico_em_protese`, `laboratorio` → `LABORATÓRIO DE PRÓTESE`
     - `radiologia`, `radiologista` → `RADIOLOGIA ODONTOLÓGICA`

2. **`src/components/smartops/reactivation/FieldNormalizer.tsx`**
   - Passar `field` para `suggestCanonical` no `autoSuggest`.
   - Após `applyMerge` bem-sucedido, forçar `refetch()` de `useFieldValues` (hoje só invalida — o refetch acontece só quando o React Query decide) para a linha sumir da tabela imediatamente.

3. Mesclar de imediato o resíduo atual: `Cirurgião Dentista → CLÍNICA OU CONSULTÓRIO` (1 linha) via mesma UI, agora que a sugestão automática vai apontar.

### Fora de escopo

- Não alterar `smart-ops-field-normalize` nem o RPC no banco — o merge server-side está correto.
- Não mudar as opções canônicas oficiais (`smartops_form_fields`).
- Não tocar em `especialidade`, `equip_scanner`, etc. neste passo — mesma mecânica, sinônimos vazios por enquanto; adicionamos depois conforme aparecerem casos.

## Detalhes técnicos

- Comparação continua case/acento-insensível via `slugify()`; o dicionário guarda slugs para não depender de grafia.
- Zero migração de banco.
- Sem breaking change no `useFieldNormalizer` — assinatura do `suggestCanonical` fica retrocompatível (`field` opcional).
