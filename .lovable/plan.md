## Correções cirúrgicas em 3 arquivos do Social Publisher

### 1. `src/components/StrategicCarouselPreview.tsx`
- `StrategicSlideRender`: máscara com `zIndex: 2` (deixa de cobrir o conteúdo).
- Propagar `fontFamily` e `fontSize` para `Slide1Hook` … `Slide6CTA`, `generateSlidePNG` e `generateStrategicSlideVideo`.
- `CarouselLogosOverlay`: trocar `filter: drop-shadow(...)` por `box-shadow`.
- `SlideWrapper`: priorizar `videoStorageUrl || videoSrc`.
- `waitForDomMedia`: timeout 80ms → 250ms.

### 2. `src/components/EngagementCarouselPreview.tsx`
Em `drawSlideFrameWithVideo`:
- Slide 1: badge no topo (`top:40, right:48`).
- Slide 6: `titleFontSize = 44`, `bodyFontSize = 26`.
- Slide 1: gradiente começa em `H*0.30`; texto vertical calculado a partir de `bottom:340`.
- `drawOrder` sempre `'video-under-overlay'`.
- `LogoOverlay`: trocar `filter: drop-shadow` por `box-shadow`.
- Slides 2–5: `overflow: hidden` + `maxHeight` no body.
- `setTimeout(resolve, 80)` → `setTimeout(resolve, 250)`.

### 3. `src/components/InstagramCopyGenerator.tsx`
- Passar `fontFamily` e `fontSize` (já no state) nas 4 chamadas de export (`generateSlidePNG` e `generateStrategicSlideVideo`, tanto no ZIP quanto no SmartOps).

### Verificação
Confirmar que os 3 arquivos existem, ler cada um para localizar os trechos exatos, aplicar as edições e checar build.