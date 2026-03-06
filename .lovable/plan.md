

# Ativar SmartOpsReports no SmartOpsTab

## Mudancas (1 arquivo: `src/components/SmartOpsTab.tsx`)

**1. Import (linha 20, apos o ultimo import):**
```typescript
import { SmartOpsReports } from "./SmartOpsReports";
```
Nota: o componente usa `export function SmartOpsReports()` (named export), entao o import precisa de chaves `{}`.

**2. TabsTrigger (linha 77, apos "Logs"):**
```tsx
<TabsTrigger value="reports">Relatórios</TabsTrigger>
```

**3. TabsContent (linha 103, apos o TabsContent de "logs"):**
```tsx
<TabsContent value="reports">
  <SmartOpsReports key={`reports-${refreshKey}`} />
</TabsContent>
```

Total: 4 linhas inseridas, 0 alteradas/removidas.

