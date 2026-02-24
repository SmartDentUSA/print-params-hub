

## Fluxo de Qualificação da LIA — IMPLEMENTADO ✅

### Fluxo Completo (4 etapas sequenciais)

1. **E-mail** — primeira coisa pedida ✅
2. **Nome** — se lead novo (não encontrado no banco) ✅
3. **Área de Atuação** — grade de botões via `ui_action: "show_area_grid"` ✅
4. **Especialidade** — grade de botões via `ui_action: "show_specialty_grid"` (filtrada por área) ✅

### Arquivos Modificados

| Arquivo | Mudanças |
|---------|----------|
| `supabase/functions/dra-lia/index.ts` | Novos estados `needs_area` e `needs_specialty` em `LeadCollectionState` e `detectLeadCollectionState`; handlers com `ui_action`; persistência em `lia_attendances` e `leads` |
| `src/components/DraLIA.tsx` | Renderização de `AreaGrid` e `SpecialtyGrid` via `ui_action`; handlers de clique que enviam seleção ao backend |

### Opções de Área de Atuação
- Clínica Odontológica
- Laboratório de Prótese
- Universidade/Docência
- Indústria/Pesquisa
- Estudante

### Especialidades por Área
- **Clínica**: Implantodontia, Prótese Dentária, Ortodontia, Endodontia, Dentística/Estética, Clínica Geral, Cirurgia
- **Laboratório**: Prótese Fixa, Prótese Removível, Prótese sobre Implante, Ortodontia, Estética
- **Universidade**: Implantodontia, Prótese Dentária, Ortodontia, Materiais Dentários, Cirurgia, Outras
- **Indústria**: P&D, Controle de Qualidade, Produção, Outras
- **Estudante**: Graduação, Especialização, Mestrado/Doutorado

### Comportamento
- Para leads **NOVOS**: Email → Nome → Área (grid) → Especialidade (grid) → Tópicos
- Para leads **RETORNANTES** (já têm area/especialidade): pula direto para Tópicos
- Dados persistidos imediatamente em `lia_attendances` (`area_atuacao`, `especialidade`) e `leads` (`specialty`)
