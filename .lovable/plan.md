
# Mover o Alimentador de Cérebro da L.I.A. para Estatísticas

## Diagnóstico

O `AdminApostilaImporter` está renderizado em **dois lugares**:

1. **Aba "Docs Sistema"** — `AdminViewSecure.tsx` linha 255-258:
   ```tsx
   <TabsContent value="documents" className="space-y-6">
     <AdminApostilaImporter />   ← a remover daqui
     <AdminDocumentsList />
   </TabsContent>
   ```

2. **Dentro de `AdminDraLIAStats`** — aba interna "🧠 Alimentador" (linha 722-725 e 1582-1584):
   ```tsx
   <TabsTrigger value="alimentador">
     <Brain /> Alimentador
   </TabsTrigger>
   ...
   <TabsContent value="alimentador">
     <AdminApostilaImporter />   ← já existe aqui!
   </TabsContent>
   ```

O componente **já vive em Estatísticas → 🤖 Dra. L.I.A. → aba Alimentador**. Só falta removê-lo da aba "Docs Sistema".

---

## O que muda

### Arquivo único: `src/pages/AdminViewSecure.tsx`

**Mudança 1 — Remover `<AdminApostilaImporter />` da aba "documents"** (linha 256):
```tsx
// ANTES:
<TabsContent value="documents" className="space-y-6">
  <AdminApostilaImporter />
  <AdminDocumentsList />
</TabsContent>

// DEPOIS:
<TabsContent value="documents" className="space-y-6">
  <AdminDocumentsList />
</TabsContent>
```

**Mudança 2 — Remover o import de `AdminApostilaImporter`** (linha 29), já que ele não será mais usado diretamente em `AdminViewSecure.tsx` (continuará importado e usado dentro de `AdminDraLIAStats.tsx`):
```tsx
// REMOVER linha 29:
import { AdminApostilaImporter } from "@/components/AdminApostilaImporter";
```

---

## Resultado após a mudança

| Aba | Conteúdo |
|---|---|
| Docs Sistema | Apenas `AdminDocumentsList` (lista de PDFs/docs do sistema) |
| Estatísticas → 🤖 Dra. L.I.A. → aba Alimentador | `AdminApostilaImporter` completo com as 4 abas (Apostila, Cérebro da L.I.A., Upload, Cérebro Externo) |

- Zero risco: o `AdminApostilaImporter` continua existindo e funcional — só muda onde o usuário o acessa no painel
- Nenhum outro arquivo precisa ser alterado
- A aba "Docs Sistema" continua existindo, apenas mais focada
