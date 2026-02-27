

## Diagnostico e Plano de Correcao

### Problema
22.200 leads foram importados com `nome = "Sem Nome"` e `email = "import_XXX@placeholder.local"`. Isso aconteceu porque os nomes das colunas do CSV nao batiam com os mapeamentos do parser selecionado (provavelmente `piperun_full` ou `master`).

### Causa Raiz
Cada parser tem mapeamentos fixos de colunas (ex: `r["NOME"]`, `r["Titulo"]`, `r["Nome do contato"]`). Se o CSV exportado do PipeRun usou colunas com nomes diferentes (ex: `"Nome completo"`, `"Contact Name"`, etc.), o parser retorna null e o fallback gera "Sem Nome" + email placeholder.

### Plano

#### 1. Limpar os 22.200 registros lixo
- DELETE dos 22.200 registros com `nome = 'Sem Nome'` AND `email LIKE '%placeholder%'` AND `created_at > '2026-02-27 06:00:00'`

#### 2. Adicionar parser "Auto-Detect" inteligente
- Novo parser que faz fuzzy matching nos nomes das colunas do CSV
- Busca colunas de nome por patterns: qualquer coluna contendo "nome", "name", "titulo", "contact", "cliente"
- Busca colunas de email: qualquer coluna contendo "email", "e-mail", "mail"
- Busca colunas de telefone: qualquer coluna contendo "telefone", "phone", "whatsapp", "celular"
- Adicionar como primeira opcao no `PARSER_OPTIONS`

#### 3. Guardar raw_payload em todos os parsers
- Quando o parser nao consegue extrair nome/email, salvar a row original em `raw_payload` para debug
- Atualizar `import-leads-csv` para rejeitar leads sem nome E sem email E sem telefone (atualmente so pula sem os 3)

#### 4. Mostrar preview com alertas
- No `SmartOpsLeadImporter`, se o preview mostrar 3+ leads com "Sem Nome", exibir alerta vermelho: "Colunas de nome nao detectadas! Verifique o parser selecionado."
- Bloquear importacao se >50% dos leads parseados tiverem "Sem Nome"

### Arquivos a Modificar

| # | Arquivo | Acao |
|---|---------|------|
| 1 | `lia_attendances` (data) | DELETE dos 22.200 registros lixo |
| 2 | `src/utils/leadParsers.ts` | Adicionar parser `auto_detect` com fuzzy column matching |
| 3 | `src/components/SmartOpsLeadImporter.tsx` | Adicionar validacao pre-import e alerta de "Sem Nome" |
| 4 | `supabase/functions/import-leads-csv/index.ts` | Rejeitar leads sem identificadores validos |

