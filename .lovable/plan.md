## Objetivo

Transformar o badge estático de plataforma (hoje mostra só "Instagram") em um **seletor de rede social** que, ao mudar, atualiza automaticamente o **tom de voz** e o **objetivo do post** no campo de instruções da IA. Cada rede tem seu próprio prompt otimizado (formato, audiência e objetivo de conversão diferentes).

## Mudanças

**Arquivo único:** `src/components/social/editor/steps/StepContent.tsx`

### 1. Nova matriz de prompts (Plataforma × Tom)

Substituir o `TONE_PROMPTS: Record<string, string>` (4 tons) por `PLATFORM_TONE_PROMPTS: Record<platform, Record<tone, string>>` cobrindo as redes que o usuário pode selecionar:

- **instagram** — feed/reels visual, hashtags, CTA "salve/compartilhe", 1ª linha gancho
- **facebook** — texto mais longo aceitável, foco em comunidade/grupo, link clicável
- **linkedin** — tom corporativo, autoridade B2B (clínicas/laboratórios), storytelling profissional, sem hashtags excessivas
- **youtube** — descrição de vídeo, timestamps mentais, CTA "inscreva-se", SEO no início
- **tiktok** — gancho em 1s, linguagem direta, trending, sem jargão pesado
- **pinterest** — descrição rica em keywords visuais, foco em "salvar para depois"

Cada uma com as 4 variações de tom (Profissional, Educativo, Direto, Inspirador) — totalizando uma matriz com objetivos comerciais distintos (ex.: LinkedIn Profissional foca em ROI clínico/lab; TikTok Direto foca em viralização).

### 2. Selector de plataforma (substitui o `<Badge>` da linha 495)

- Trocar `const platform = value.channels?.[0]?.platform || 'instagram'` por estado local `selectedPlatform` inicializado com o 1º canal de `value.channels`.
- Renderizar um `<Select>` (mesmo padrão visual do select de tom) com as plataformas presentes em `value.channels` (dedupe). Se nenhum canal foi escolhido, fallback para `['instagram']`.
- Mostrar ícone da rede ao lado do nome (Instagram/Facebook/Youtube/Linkedin/Music2 do lucide-react já importado em outros arquivos do projeto).

### 3. Atualização automática do prompt ao mudar plataforma OU tom

Refatorar `handleToneChange` e adicionar `handlePlatformChange`:
- Ambos chamam um helper `applyPreset(platform, tone)` que setta `aiInstructions = PLATFORM_TONE_PROMPTS[platform][tone]`.
- Manter a regra de não sobrescrever se o usuário já digitou texto customizado (lógica `isPreset` atual estendida para checar todos os presets da matriz).

### 4. Botão "Aplicar prompt do tom" passa a aplicar o prompt do par (plataforma + tom).

### 5. Geração da IA usa a plataforma selecionada

A chamada `generate` continua usando `platform`, mas agora vem do `selectedPlatform` (não mais do `value.channels[0]`). Isso garante que, se o usuário tem 3 canais escolhidos, ele pode gerar copy específica para cada um trocando a plataforma e regerando.

## Fora de escopo

- Não altera StepChannels nem a edge function `social-caption-generator` (ela já aceita `platform` como parâmetro).
- Não persiste a escolha de plataforma no `PostInput` — é apenas contexto de geração; a copy final é editada manualmente pelo usuário.
- Não muda o trigger do WhatsApp.