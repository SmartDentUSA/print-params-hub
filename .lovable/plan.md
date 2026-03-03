

## Análise: Campos faltantes no Formulário Base

Comparei os 27 `db_column` do `BASE_FORM_FIELDS` com as ~120 colunas da tabela `lia_attendances`. Muitas colunas são de sistema (piperun_*, lojaintegrada_*, astron_*, cognitive_*, scores, timestamps) e **não devem** estar no formulário. Porém, existem **12 campos preenchíveis pelo lead** que estão na base de dados mas **faltam no formulário padrão**:

### Campos faltantes (preenchíveis por formulário)

| # | db_column | Label sugerido | Tipo |
|---|---|---|---|
| 1 | `empresa_cnpj` | CNPJ | text |
| 2 | `empresa_razao_social` | Razão Social | text |
| 3 | `empresa_segmento` | Segmento da empresa | select |
| 4 | `pessoa_cpf` | CPF | text |
| 5 | `pessoa_genero` | Gênero | select |
| 6 | `sdr_marca_impressora_param` | Marca da impressora (parâmetros) | text |
| 7 | `sdr_modelo_impressora_param` | Modelo da impressora (parâmetros) | text |
| 8 | `sdr_resina_param` | Resina (parâmetros) | text |
| 9 | `sdr_suporte_equipamento` | Equipamento (suporte) | text |
| 10 | `sdr_suporte_tipo` | Tipo de suporte | select |
| 11 | `sdr_suporte_descricao` | Descrição do suporte | textarea |
| 12 | `origem_campanha` | Origem / Campanha | text |

### Campos auto-capturados (hidden, não formulário visível)
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `ip_origem`, `pais_origem` — devem ser capturados automaticamente via URL params, não exibidos ao lead.

### Plano de implementação

**Arquivo:** `src/components/SmartOpsFormBuilder.tsx`

Adicionar os 12 campos faltantes ao array `BASE_FORM_FIELDS`, organizados nas categorias existentes:
- **Profissional**: empresa_cnpj, empresa_razao_social, empresa_segmento, pessoa_cpf, pessoa_genero
- **SDR Parâmetros**: sdr_marca_impressora_param, sdr_modelo_impressora_param, sdr_resina_param
- **SDR Suporte**: sdr_suporte_equipamento, sdr_suporte_tipo, sdr_suporte_descricao
- **Marketing**: origem_campanha

O total passará de 27 para 39 campos no formulário base.

