## Ajustes na seção Módulos

**1. Editor genérico (reutilizável)**
- Renomear no `LandingPageBuilderModal.tsx`:
  - Título da seção: `"Módulos (Ultimate Lab Bundle)"` → `"Módulos"`
  - Sidebar já é `"Módulos"` (nenhuma mudança).

**2. Defaults do bloco Módulos (para novas LPs do Ultimate Lab Bundle)**

Em `PremiumLandingTemplate.tsx`, ajustar `DEFAULT_LP_CONTENT.modules`:
- `title`: `"O que está incluído no Ultimate Lab Bundle"` (mantém)
- `subtitle`: `"Um pacote para o laboratório inteiro. Apresentado por aplicações comerciais reais, não apenas por nomes técnicos — conforme o portfólio oficial da exocad."`
- `items`: 15 módulos (já estão completos hoje — confirmado):
  1. DentalCAD Core Version
  2. Virtual Articulator
  3. Provisional Module
  4. TruSmile™ Module
  5. ZRS Tooth Library
  6. Implant Module
  7. Bar Module
  8. DICOM Viewer Module
  9. Model Creator Module
  10. Smile Creator Module
  11. Full Denture Module
  12. Inspira™ Denture Tooth Library
  13. PartialCAD Module
  14. Bite Splint Module
  15. Jaw Motion Import Module
- `footnote`: mantém.

**3. LPs já salvas**
- `ensureContent` continua fazendo `parsed.modules ?? DEFAULT` — se a LP atual já tem `modules` salvo com lista incompleta, o editor permite adicionar os que faltarem manualmente. Não sobrescrevemos edições do usuário automaticamente.

## Arquivos
- `src/components/smartops/LandingPageBuilderModal.tsx` — rename da `Section title`.
- `src/components/lp/PremiumLandingTemplate.tsx` — subtitle do default.