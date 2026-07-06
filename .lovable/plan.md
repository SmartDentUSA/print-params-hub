## Normalização de `area_atuacao` + `especialidade` em `lia_attendances`

Duas colunas, dois vocabulários controlados. Backfill único via `insert-tool`.

### Vocabulário `area_atuacao` (9 canônicos)
`CLÍNICA OU CONSULTÓRIO` · `LABORATÓRIO DE PRÓTESE` · `RADIOLOGIA ODONTOLÓGICA` · `PLANNING CENTER` · `EMPRESA DE ALINHADORES` · `GESTOR DE REDE DE CLÍNICAS` · `GESTOR DE FRANQUIAS` · `CENTRAL DE IMPRESSÕES` · `EDUCAÇÃO`

### Vocabulário `especialidade` (13 canônicos)
`CLÍNICO GERAL` · `DENTÍSTICA` · `IMPLANTODONTISTA` · `PROTESISTA` · `ORTODONTISTA` · `ODONTOPEDIATRIA` · `PERIODONTISTA` · `RADIOLOGISTA` · `CIRURGIA BUCO MAXILO FACIAL` · `TÉCNICO EM RADIOLOGIA` · `TÉCNICO EM PRÓTESE ODONTOLÓGICA` · `ENDODONTISTA` · `OUTROS`

---

### Regras de mapeamento — `area_atuacao`

| Canônico | Variantes que serão convertidas (case/acento-insensitive) |
|---|---|
| `CLÍNICA OU CONSULTÓRIO` | Clínica ou Consultório, CLÍNICA CONSULTÓRIO, Clínica / Consultório, Clínica, CLINICA, Consultório, Consultorio, Clínica Odontológica, Clinica (consultorio), Clinica (dentista), Clínicia, Clínico, Clínica/Consultório, Instituto e Clínica Odontológica, Consultório Odontológico, Clínica Radiológica |
| `LABORATÓRIO DE PRÓTESE` | Laboratório de Prótese/Próteses/protese, Laboratório, Laboratorio, LABORATORIO, Lab de protese, Laboratório Ortopédico, laboratório_de_prótese |
| `RADIOLOGIA ODONTOLÓGICA` | Radiologia, RADIOLOGIA, Radiologia Odontológica, RADIOLOGIA E IMAGINOLOGIA |
| `GESTOR DE REDE DE CLÍNICAS` | Gestor de Rede, GESTOR DE REDE, Gestor de rede de clínicas |
| `GESTOR DE FRANQUIAS` | Gestor de Franquias, Gestor de franquias |
| `CENTRAL DE IMPRESSÕES` | Central de impressão 3D |
| `PLANNING CENTER` | (só o próprio) |
| `EMPRESA DE ALINHADORES` | Empresa de Alinhadores |
| `EDUCAÇÃO` | Educação, PROFESSOR, Professor, ALUNOS DE GRADUAÇÃO, Estudante, Estagiário, ESTUDO, Escola, Universidade de Caxias do Sul-UCS |

**Movimento cross-coluna** (valores hoje em `area_atuacao` que são especialidades): IMPLANTODONTISTA, ORTODONTISTA, CLÍNICO GERAL, DENTISTA/CD/Cirurgião Dentista, ENDODONTISTA, PERIODONTISTA, PROTESISTA, TÉCNICO EM PRÓTESE ODONTOLÓGICA, DENTÍSTICA, CIRURGIA BUCOMAXILOFACIAL, RADIOLOGISTA, TÉCNICO EM RADIOLOGIA, ODONTOPEDIATRIA e combos (`IMPLANTODONTISTA, PROTESISTA` etc.) →
- `area_atuacao` = `CLÍNICA OU CONSULTÓRIO` (ou `LABORATÓRIO DE PRÓTESE` quando for TPD/PROTESISTA/PROTÉTICO isolados)
- `especialidade` = valor canônico correspondente (**só sobrescreve se `especialidade` estiver NULL/vazio** para preservar dados já preenchidos)

**Combos clínica+laboratório** (`Clinica e Laboratório`, `Laboratório e Clínica`, `clínica/mini laboratório`, `Clínica e Laboratório de prótese`) → `area_atuacao = CLÍNICA OU CONSULTÓRIO` (perfil principal); NÃO mexemos em outros campos.

**Não classificáveis** (`Cargo não informado`, códigos Omie `49-Sócio-Administrador`, `22-Sócio`, `65-Titular…`, `Outros`, `Não Definido`, `Não sou da área…`, `SEM INFORMAÇÃO`, `Proprietário`, `CEO`, `Compras`, `Distribuidor`, `Joalheria`, `Ourives`, lixo tipo `X`, `valeu`, `en español por favor`, nomes de pessoas, frases soltas) → `area_atuacao = NULL`.

### Regras de mapeamento — `especialidade`

- Case/acento e wrappers `["…"]` normalizados (ex.: `["IMPLANTODONTISTA"]` → `IMPLANTODONTISTA`).
- **Multi-especialidade** (`IMPLANTODONTISTA, PROTESISTA`, `["IMPLANTODONTISTA","ORTODONTISTA"]`, etc.) → mantém string CSV canônica em ordem alfabética: `IMPLANTODONTISTA, PROTESISTA`. Isso preserva a informação e permite `ILIKE '%PROTESISTA%'` em queries.
- Mapeamentos especiais:
  - `PROTESE E ESTÉTICA` (320) → `PROTESISTA`
  - `Protético` / `PROTÉTICO` → `TÉCNICO EM PRÓTESE ODONTOLÓGICA`
  - `Endodontia` → `ENDODONTISTA`
  - `Ortodontia Implante e Prótese` → `IMPLANTODONTISTA, ORTODONTISTA, PROTESISTA`
  - `Periodontista / Implantodontista` → `IMPLANTODONTISTA, PERIODONTISTA`
  - `Ortodontia/ Clínica geral` → `CLÍNICO GERAL, ORTODONTISTA`
  - `Prótese Total` → `PROTESISTA`
  - `CIRURGIA BUCOMAXILOFACIAL` → `CIRURGIA BUCO MAXILO FACIAL` (padrão do vocabulário)
  - `["OUTRA"]`, `[]`, valores que são perguntas de formulário (`Preciso de suporte…`, `Quero saber mais sobre…`, `parametros para resina…`) → `OUTROS`
  - `Dentista/ TPD/ Implante` → `IMPLANTODONTISTA, TÉCNICO EM PRÓTESE ODONTOLÓGICA`

---

### Execução

1. **UPDATE massivo** via insert-tool com `CASE WHEN` sobre `LOWER(UNACCENT(TRIM(area_atuacao)))` e `LOWER(UNACCENT(TRIM(especialidade)))`. Rodo os dois em uma transação única. Também pinto `especialidade` (quando NULL) a partir do que estava mal-alocado em `area_atuacao`.
2. **Verificação**: rodo `GROUP BY area_atuacao` e `GROUP BY especialidade` pós-UPDATE — expectativa = 9 valores + NULL em uma, ~13 valores + CSVs canônicos + NULL na outra.
3. **Sem alterações de schema, sem trigger, sem código de frontend** neste plano — só backfill de dados.

### Contadores estimados pós-normalização
- `area_atuacao = CLÍNICA OU CONSULTÓRIO`: ~14.700
- `area_atuacao = LABORATÓRIO DE PRÓTESE`: ~4.470
- `area_atuacao = RADIOLOGIA ODONTOLÓGICA`: ~170
- `area_atuacao = EDUCAÇÃO`: ~155
- `area_atuacao = GESTOR DE REDE DE CLÍNICAS`: ~60
- `area_atuacao = GESTOR DE FRANQUIAS`: ~20
- `area_atuacao = PLANNING CENTER`: 6
- `area_atuacao = CENTRAL DE IMPRESSÕES`: 4
- `area_atuacao = EMPRESA DE ALINHADORES`: 1
- `area_atuacao = NULL`: ~1.900 (não classificáveis)

### Fora do escopo
- Trigger `BEFORE INSERT/UPDATE` para normalizar novas escritas — proponho como Fase 2 se você aprovar após ver o resultado do backfill.
- UI de dropdown com opções canônicas nos formulários — proponho Fase 3.
