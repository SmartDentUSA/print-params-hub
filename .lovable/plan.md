## Mover "Ficha do Profissional" para aba própria no Admin

Hoje a Ficha está como sub-aba dentro de **Treinamentos** (SmartOpsCourses). Vou remover de lá e criar uma entrada dedicada na sidebar do Admin, logo abaixo de **Stripe / Pagamentos**.

### Alterações

1. **`src/components/SmartOpsCourses.tsx`**
   - Remover `TabsTrigger value="ficha"` e o `TabsContent` correspondente.
   - Remover o import `CoursesProfessionalProfile`.

2. **`src/components/AdminSidebar.tsx`**
   - Adicionar novo item no grupo Smart Ops logo após `so-stripe`:
     ```
     { id: "so-ficha-profissional", title: "Ficha do Profissional", icon: UserCircle }
     ```

3. **`src/pages/AdminViewSecure.tsx`**
   - Adicionar `lazy import` de `CoursesProfessionalProfile`.
   - Adicionar `case 'so-ficha-profissional'` no switch de renderização.

### Escopo

- O componente `src/components/smartops/CoursesProfessionalProfile.tsx` permanece inalterado (só muda o ponto de montagem).
- Nenhuma alteração em backend, schema ou dados.
