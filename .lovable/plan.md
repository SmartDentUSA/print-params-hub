

# Plan: Fix ROI Card Image Upload + Restructure Public ROI Page + Clean SmartFlow UI

## Issues Identified

1. **Image upload broken**: The `catalog-images` bucket INSERT policy is restricted to `service_role` only. Admin users (authenticated) get permission denied.
2. **`/base-conhecimento/calculadora-roi` page** reads from localStorage instead of Supabase `roi_cards`, and shows a generic calculator form instead of a card gallery.
3. **SmartOpsSmartFlowAnalytics** has a full simulator UI (sliders, stage cards, charts, lead gate) that the user wants removed -- keep only the ROI cards gallery + admin panel.

## Changes

### 1. Migration: Fix storage policy for `catalog-images`

Add an INSERT policy allowing authenticated admins to upload to `catalog-images`:

```sql
CREATE POLICY "Admins can upload catalog images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'catalog-images' AND is_admin(auth.uid()));
```

### 2. Rewrite `ROICalculatorPage.tsx` — Public vitrine of ROI cards

- Fetch published `roi_cards` from Supabase (not localStorage)
- Display cards as a visual gallery grid with images
- When user clicks a card image, expand the calculator section below it (using `selectedCardId` state)
- The expanded section shows the workflow stage comparison + key metrics from that card's data
- No admin controls on this page

### 3. Simplify `SmartOpsSmartFlowAnalytics.tsx`

Remove from the UI:
- Volume sliders (Configuração de Volume)
- Stage comparison cards (Escaneamento, CAD, etc.)
- Dashboard metrics cards (Horas Recuperadas, Economia Resina, etc.)
- Break-Even chart
- Lead gate modal

Keep only:
- Header with "⚙ Gerenciar Cards" button
- The `SmartOpsROICardsManager` admin panel
- The gallery of published cards (for admin preview)

### 4. Save `image_url` on card save

The `handleUpload` sets `form.image_url` in state but the `saveMutation` already persists it. The only issue is the storage policy -- fix in step 1 resolves this.

## Files Changed

| File | Change |
|------|--------|
| Supabase migration | Add admin INSERT policy for `catalog-images` bucket |
| `src/pages/ROICalculatorPage.tsx` | Full rewrite: fetch from Supabase, card vitrine with expandable calculator |
| `src/components/SmartOpsSmartFlowAnalytics.tsx` | Strip down to admin-only: keep card manager + card gallery preview |

