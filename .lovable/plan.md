## Objetivo

Na aba **Base de Conhecimento → Catálogo**, cada card deve exibir a foto cadastrada em **Painel Admin → Gestão de Catálogo de Produtos** (`system_a_catalog.image_url`) como fonte de verdade. Hoje, quando o produto casa com uma resina, a imagem da tabela `resins` sobrescreve silenciosamente a foto do catálogo — o que impede o admin de trocar a imagem pelo editor do catálogo.

## Mudança

Arquivo: `src/components/knowledge/KbTabCatalogo.tsx` (linha ~882)

Inverter a precedência de imagem:

```ts
// antes
const cardImage = resin?.image_url || p.image_url || null;

// depois
const cardImage = p.image_url || resin?.image_url || null;
```

Assim:
1. Foto oficial vem do `system_a_catalog.image_url` (Gestão de Catálogo)
2. Fallback: `resins.image_url` (apenas quando o card não tem imagem no catálogo)
3. Fallback final: placeholder gradiente com 📦

## Escopo / não-escopo

- Só altera a origem da imagem do card no KB Catálogo.
- Não mexe em CTAs, specs técnicos, FDS/IFU, apresentações, nem no matching de resina — que continuam como estão.
- Não altera queries nem edge functions.
- Sem mudanças em `resins` ou no admin.

## Validação

Após o deploy, abrir `/base-conhecimento?tab=catalogo`, trocar a imagem de uma resina em **Admin → Gestão de Catálogo** e confirmar que o card reflete a nova foto (após refresh).
