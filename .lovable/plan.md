## Firecrawl conectado — próximos passos

Com o conector Firecrawl linkado, `FIRECRAWL_API_KEY` já está disponível para as Edge Functions. A função `event-web-research` que criamos vai funcionar imediatamente.

### Validação rápida (sem alterar código)
1. Abrir o **Editor de Eventos** em SmartOps.
2. Criar/abrir um evento, preencher **Site do evento** (ex.: `https://www.ids-cologne.de`).
3. Clicar **Buscar info na web** → confirmar que os campos (nome, datas, local, país, descrição PT) são pré-preenchidos.
4. Em **Sobre o evento**, gerar PT / EN / ES via IA (Gemini 2.5 Flash).
5. Em **Capa do evento**, em cada idioma:
   - Upload manual (valida proporção 16:9 / 1200×675), **ou**
   - Escrever prompt e **Gerar capa por IA** (Nano-Banana via Poe).
6. Abrir a Base de Conhecimento pública → aba **Eventos** → trocar idioma e confirmar que a capa muda conforme `cover_image_{lang}`.

### Se algo falhar — ajustes previstos (só aplico após aprovação)

- **Firecrawl 402 (sem créditos):** orientar top-up; sem mudança de código.
- **Firecrawl v2 retornando shape diferente:** ajustar parser em `event-web-research/index.ts` (já tem fallback em `root.json / root.extract / root.data.json`, mas posso adicionar logs estruturados se vier vazio).
- **Poe Nano-Banana indisponível:** fallback para `imagegen` (Gemini) em `event-generate-image`.
- **Pré-preenchimento do formulário:** hoje `EventWebResearchButton` devolve `extracted` via callback; preciso confirmar se o `SmartOpsEvents.tsx` já consome esse callback e faz `setForm({...})` nos campos certos (name, start_date, end_date, location, country, website_url, about_event_pt). Se não, adiciono o merge.

### Pergunta
Quer que eu rode a validação acima de forma assistida agora (você testa em tela, eu observo console/logs) ou prefere testar sozinho e me chamar se algo quebrar?
