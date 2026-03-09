

# Smart Flow Analytics — Simulador ROI Odontológico Granular

## Objetivo
Criar **nova aba "ROI"** no Smart Ops com simulador interativo que compara **Fluxo Fragmentado (Manual)** vs **Fluxo Smart Dent (IA/High-End)** com cálculos em tempo real, gráfico de break-even e captura de leads.

## Arquitetura

### 1. Novo Componente `SmartOpsSmartFlowAnalytics.tsx`

**Motor de Dados (6 Etapas):**
```typescript
const WORKFLOW_STAGES = [
  { id: 'scan', name: 'Escaneamento', manual: { time_min: 15 }, smartdent: { time_min: 5 }, asb_delegable: true },
  { id: 'cad', name: 'CAD/Planejamento', manual: { time_min: 20, cost: 50 }, smartdent: { time_min: 4, cost: 8 }, asb_delegable: false },
  { id: 'print', name: 'CAM & Impressão', manual: { time_min: 15, waste_pct: 20 }, smartdent: { time_min: 0.5, waste_pct: 0 }, asb_delegable: true },
  { id: 'clean', name: 'Limpeza', manual: { time_min: 10 }, smartdent: { time_min: 0.67 }, asb_delegable: true },
  { id: 'cure', name: 'Pós-Cura', manual: { time_min: 15 }, smartdent: { time_min: 5 }, asb_delegable: true },
  { id: 'finish', name: 'Finalização (Make)', manual: { time_min: 30 }, smartdent: { time_min: 9 }, asb_delegable: true }
];
```

**Interface:**
- **Cards por Etapa**: Mostra tempo Manual vs Smart com delta verde
- **Sliders**: Coroas (0-100), Placas (0-50), Hora Clínica (R$150-600)
- **Dashboard**: Horas Recuperadas, Economia de Resina, Lucro Kit Inicial
- **Gráfico Break-Even**: Recharts com ponto de intersecção no elemento #97
- **Lead Gate**: Modal para captura (Nome, Clínica, WhatsApp) → salva em `lia_attendances`

**Cálculos:**
```typescript
// Horas recuperadas
horasRecuperadas = (totalMinManual - totalMinSmart) / 60 * volumeTotal;

// Economia de resina (suportes 20% mais leves)
economiaResina = gramasPorPeca * 0.20 * precoGrama * volumeTotal;

// Lucro do kit (R$128.524 - R$77.900)
lucroKit = 50624.82;

// Break-even no elemento #97
breakEvenElementos = investimento / faturamentoPorElemento;
```

**Delegação ASB**: Se `asb_delegable: true`, custo de hora clínica é ignorado no fluxo Smart (operado por assistente).

### 2. Integração no SmartOpsTab.tsx
- Adicionar `TabsTrigger value="roi"` com label "ROI"
- Adicionar `TabsContent` renderizando `<SmartOpsSmartFlowAnalytics />`

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/components/SmartOpsSmartFlowAnalytics.tsx` | **Novo** — Componente completo |
| `src/components/SmartOpsTab.tsx` | Adicionar aba ROI |

## Resultado
- Nova aba **ROI** com simulador interativo visual
- Comparativo Manual vs Smart Dent por etapa
- Dashboard com cálculos em tempo real
- Gráfico de break-even com Recharts
- Lead gate para conversão

