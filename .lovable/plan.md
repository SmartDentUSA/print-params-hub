

## Fix: Add missing brand color properties to SmartOpsForm interface

**File:** `src/components/SmartOpsFormBuilder.tsx`

**Change:** Add three properties before the closing brace of the `SmartOpsForm` interface (line 66):

```typescript
brand_color_h: number | null;
brand_color_s: number | null;
brand_color_l: number | null;
```

This resolves the TS2739 build error and the commit to main will automatically trigger a Vercel deployment.

