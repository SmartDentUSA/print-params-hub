## Goal
Add a third "Evolution API" toggle to the automation rule modal in `SmartOpsCSRules.tsx`, mirroring the ManyChat/WaLeads pattern, with optional fallback message. Columns `evolution_ativo` and `mensagem_evolution` already exist in `cs_automation_rules`.

## Edits in `src/components/SmartOpsCSRules.tsx`

**1. `Rule` interface (~line 28)** — add:
```ts
evolution_ativo: boolean;
mensagem_evolution: string | null;
```

**2. `defaultForm` (~line 66)** — add:
```ts
evolution_ativo: false,
mensagem_evolution: "",
```

**3. `openEdit` (~line 110)** — hydrate:
```ts
evolution_ativo: r.evolution_ativo ?? false,
mensagem_evolution: r.mensagem_evolution || "",
```

**4. `handleSave` payload (~line 152)** — include:
```ts
evolution_ativo: form.evolution_ativo,
mensagem_evolution: form.mensagem_evolution || null,
```

**5. Modal — new section after WaLeads block (~line 458)**, matching ManyChat/WaLeads visual pattern (Separator + flex header with Switch + conditional Textarea):
```tsx
<Separator />
<div className="space-y-2">
  <div className="flex items-center justify-between">
    <Label className="font-semibold">Evolution API</Label>
    <Switch checked={form.evolution_ativo}
      onCheckedChange={(v) => setForm({ ...form, evolution_ativo: v })} />
  </div>
  {form.evolution_ativo && (
    <div>
      <Label className="text-xs">Mensagem Evolution</Label>
      <Textarea
        value={form.mensagem_evolution}
        onChange={(e) => setForm({ ...form, mensagem_evolution: e.target.value })}
        placeholder="Deixe vazio para usar a mesma mensagem do WaLeads"
        rows={4}
      />
    </div>
  )}
</div>
```
Final order in modal: ManyChat → WaLeads → Evolution API.

**6. `renderRuleCard` (~line 216)** — add badge after WaLeads block, same `text-primary text-[11px]` styling:
```tsx
{r.evolution_ativo && (
  <span className="text-primary">✓ Evolution</span>
)}
```
Update the "Nenhum canal ativo" guard at line 242 to also check `!r.evolution_ativo`.

## Out of scope
- No DB migration (columns already exist).
- No edge function / processor changes — modal UI + persistence only.