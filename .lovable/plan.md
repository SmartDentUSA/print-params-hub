

## Apply Split Layout to PublicFormPage

### File: `src/pages/PublicFormPage.tsx`

**Single change** — replace lines 320-507 (the `<div className="w-full max-w-lg mt-1">` wrapper and its contents) with a two-column grid:

**Outer wrapper** changes from:
```
<div className="w-full max-w-lg mt-1">
```
to:
```
<div className="w-full max-w-5xl mt-1 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start">
```

**Left column** — wrap media + title/subtitle/description in:
```html
<div className="md:sticky md:top-8 space-y-6">
  <!-- video/image hero (remove mb-6 from each) -->
  <!-- title/subtitle/description block (remove mb-6) -->
</div>
```

**Right column** — wrap `<form>` in:
```html
<div>
  <form onSubmit={handleSubmit} className="space-y-5">
    <!-- all field renderers unchanged -->
  </form>
</div>
```

### Summary of class changes
| Element | Before | After |
|---|---|---|
| Outer container | `max-w-lg` | `max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start` |
| Left column (new wrapper) | — | `md:sticky md:top-8 space-y-6` |
| Media elements | `mb-6` | removed (spacing handled by parent `space-y-6`) |
| Title block | `mb-6 space-y-2` | `space-y-2` (no mb-6) |
| Right column (new wrapper) | — | plain `<div>` |
| Form + fields | unchanged | unchanged |

No logic, state, or submission changes. Mobile stacks vertically as before.

