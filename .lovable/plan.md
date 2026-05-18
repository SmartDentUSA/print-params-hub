## Objetivo

O documento "Declaração de Comparecimento à Imersão e Retirada" deve ser **preenchido ao máximo** com tudo que o sistema já sabe — não apenas com o que foi digitado no agendamento.

## Cascata de fontes (prioridade do mais "verdadeiro" para o mais genérico)

| Campo do documento | 1ª fonte | 2ª fonte | 3ª fonte |
|---|---|---|---|
| Declarante (nome) | `enrollment.person_name` | `lia.nome` | — |
| CPF/CNPJ declarante (formatado) | `lia.pessoa_cpf` | `enrollment.empresa_cnpj` | `lia.empresa_cnpj` |
| Empresa (razão social) | `lia.empresa_razao_social` | `lia.empresa_nome` | `omie_nf.cliente_nome` |
| Endereço | `enrollment.empresa_endereco` | `lia.empresa_endereco` | `lia.pessoa_endereco` |
| Cidade | `enrollment.empresa_cidade` | `lia.empresa_cidade` | `lia.cidade` |
| UF | `enrollment.empresa_estado` | `lia.empresa_uf` | `lia.uf` |
| Contrato | `enrollment.numero_contrato` | `enrollment.numero_proposta` | — |
| NF 1 / NF 2 | `enrollment.numero_nf` (split) | **`omie_notas_fiscais` por `lead_id` ou `cliente_cpf_cnpj`** (até 2 mais recentes) | — |
| Data início imersão | range `DD/MM a DD/MM/YYYY` em `turma.label` | **primeira `DD/MM/YYYY`** em `turma.label` | `turma.launch_date` |
| Data fim imersão | range no label | `start + 2 dias` (imersão = 3 dias) | — |
| Participante 4.1 nome | `companion.name` (se companionId) ou `enrollment.person_name` | `lia.nome` | — |
| Participante 4.1 CPF | `companion.cpf` se existir | `lia.pessoa_cpf` (titular) | — |
| Participante 4.1 Profissão (Cargo = Especialidade) | `companion.especialidade` ou `enrollment.especialidade` | `lia.pessoa_cargo` | `lia.especialidade` |

> **Acompanhantes (4.2 / 4.3)**: ao gerar o doc do **titular**, preencher 4.2 e 4.3 automaticamente com os primeiros 2 acompanhantes da inscrição (nome + cpf + especialidade). Ao gerar o doc de um acompanhante específico, só ele aparece em 4.1.

## Mudanças

**Único arquivo:** `supabase/functions/smartops-gerar-comprovante-imersao/index.ts`

1. Ampliar `SELECT` em `lia_attendances` para incluir: `nome, pessoa_cpf, pessoa_cargo, pessoa_endereco, especialidade, empresa_nome, empresa_razao_social, empresa_cnpj, empresa_endereco, empresa_cidade, empresa_uf, cidade, uf` (filtro `merged_into IS NULL` mantido).
2. Buscar `smartops_enrollment_companions` da inscrição (todos), para uso em 4.2/4.3 quando for o doc do titular.
3. Buscar até 2 NFs em `omie_notas_fiscais` por `lead_id` (ou `cliente_cpf_cnpj` formatado) ordenado por `data_emissao DESC`.
4. Implementar cascata acima em helper `pickFirst(...vals)`.
5. Formatador `formatDoc(value)` → CPF `XXX.XXX.XXX-XX` (11 dígitos) ou CNPJ `XX.XXX.XXX/XXXX-XX` (14 dígitos), senão devolve cru.
6. **Parser de data robusto** em `parseTurmaLabel`:
   - range `DD/MM a DD/MM/YYYY` → mantém
   - extrai **primeira** `DD/MM/YYYY` em qualquer posição (cobre `"15/05/2026"`, `"dede — 13/05/2026"`)
   - fallback `launch_date`
   - se só tem início, `end = start + 2 dias`
7. Preencher `empresa` no `buildDocx` (hoje hardcoded `""`).
8. Re-deploy (`supabase--deploy_edge_functions`) e validar com `supabase--curl_edge_functions` numa inscrição de teste.

## Fora de escopo

- Buscar endereço no Omie Cliente (não há tabela `omie_clientes` — só NF tem cliente_nome/cpf_cnpj).
- Layout do documento (mantém o atual).
- Botão de certificado e função `smartops-gerar-doc-turma` permanecem intocados.
