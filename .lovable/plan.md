

# Ativar SmartOpsModelCompare no SmartOpsTab

## Mudancas (1 arquivo: `src/components/SmartOpsTab.tsx`)

**1. Import (linha 21, apos SmartOpsReports):**
```typescript
import { SmartOpsModelCompare } from "./SmartOpsModelCompare";
```

**2. TabsTrigger (linha 79, apos "Relatórios"):**
```tsx
<TabsTrigger value="model-compare">Comparar Modelos</TabsTrigger>
```

**3. TabsContent (linha 108, apos o TabsContent de "reports"):**
```tsx
<TabsContent value="model-compare">
  <SmartOpsModelCompare key={`model-compare-${refreshKey}`} />
</TabsContent>
```

Total: 4 linhas inseridas, 0 alteradas/removidas.

