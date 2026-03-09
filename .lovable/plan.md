

# Ajustar Card ROI para Corresponder ao Layout da Imagem

## Diferenças Identificadas (Imagem vs Código Atual)

### 1. Workflow tem 7 etapas, não 6
A imagem mostra 7 colunas de workflow:
- **Escaneamento** | **CAD Planejamento** | **CAM Impressão** | **Impressão** | **Limpeza Pós impressão** | **Pós cura** | **Finalização**

O código atual tem 6 (CAM e Impressão unificados como "Impressão"). Preciso separar "CAM Impressão" como etapa independente.

### 2. Nova coluna `cam_*` no `roi_cards`
Adicionar campos `cam_time_manual`, `cam_time_smart`, `asb_cam` para a etapa CAM separada da Impressão.

### 3. Renomear etapas para corresponder à imagem
- "CAD/Planejamento" → "CAD Planejamento"
- "CAM & Impressão" (antigo print) → dividir em "CAM Impressão" e "Impressão"
- "Limpeza" → "Limpeza Pós impressão"
- "Pós-Cura" → "Pós cura"

### 4. Workflow exibe horizontalmente (colunas por etapa)
Na imagem, cada etapa é uma coluna com descrição, tempo e operador empilhados. O código atual usa linhas. Ajustar para layout de colunas no workflow descriptions.

## Alterações

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | `ALTER TABLE roi_cards ADD COLUMN cam_impression_time_manual NUMERIC DEFAULT 0, cam_impression_time_smart NUMERIC DEFAULT 0.5, asb_cam_impression BOOLEAN DEFAULT true` |
| `SmartOpsROICardsManager.tsx` | Atualizar STAGES para 7 etapas, renomear labels, adicionar campos CAM Impressão separados |
| `ROICalculatorPage.tsx` | Atualizar `buildStages` para 7 etapas na vitrine pública |
| `types.ts` | Atualizar com novos campos |

