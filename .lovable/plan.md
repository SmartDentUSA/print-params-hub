## Resposta curta
Hoje, sim — existe risco. O prompt da IA já contém a lista canônica dos 15 módulos e das 25 FAQs, mas ainda depende do modelo obedecer. Se ele resumir/cortar, o conteúdo volta a aparecer incompleto ao "Regenerar com IA".

## Correção proposta (garantia 100%)
Fazer o backend **sobrescrever** módulos e FAQs após a geração, sempre que o input for sobre exocad / DentalCAD / RMS / Ultimate Lab Bundle. Assim, independente do que o LLM devolver, o JSON salvo terá exatamente os 15 módulos e as 25 FAQs canônicas.

### Mudanças
1. **`supabase/functions/landing-page-generator/index.ts`**
   - Após receber o JSON do modelo, detectar se o tópico é exocad/RMS (regex em `input`/`title`: `exocad|dentalcad|rms|ultimate lab bundle`).
   - Se sim: substituir `content.modules.items` pelos 15 módulos canônicos e `content.faq.items` pelas 25 FAQs canônicas (usando as mesmas constantes já existentes no arquivo, convertidas para arrays estruturados).
   - Preservar título/subtítulo/eyebrow que o modelo gerou para essas seções (só troca os `items`).

2. **Sem mudanças no frontend** — o `PremiumLandingTemplate` continua renderizando o que vier no JSON.

### O que acontece na prática
- Clicar em "Regenerar com IA" numa LP do exocad → volta com 15 módulos e 25 FAQs, sempre.
- LPs de outros temas (não-exocad) → seguem 100% pela IA, sem override.

### Validação
- Regenerar a LP atual e conferir contagens (`modules.items = 15`, `faq.items = 25`).
- `bunx tsgo --noEmit` na edge function.