## Diagnóstico

O container pai em `SmartOpsCampaigns.tsx` (linha 1191) usa `max-w-3xl` (~768px), o que espreme todo o wizard "Criar Campanha", incluindo o passo 2 do `EmailCampaignWizard`. Por isso o editor+preview ficam estreitos, mesmo com o card interno em `w-full`.

A tentativa anterior de "furar" o layout com `-ml-[49vw] w-screen` funcionava visualmente mas cobria a sidebar do admin. A solução correta é afrouxar o container apenas no passo em que o wizard de email aparece.

## Mudança

**`src/components/SmartOpsCampaigns.tsx`** (apenas 1 linha)

Trocar:
```tsx
<div className="space-y-6 max-w-3xl">
```
por algo condicional ao passo atual (o `step` local desse componente — 1=Conteúdo, 2=Segmentação, 3=Revisar):
```tsx
<div className={`space-y-6 ${step === 3 ? "max-w-none" : "max-w-3xl"}`}>
```

Isso libera a largura total (dentro do `<main>` do admin, que já tem padding) exclusivamente no passo "Revisar", onde o `EmailCampaignWizard` renderiza. Passos 1 e 2 continuam com a largura confortável de leitura atual.

**`src/components/smartops/EmailCampaignWizard.tsx`** — sem novas mudanças. O card do passo 2 já está em `w-full` e vai preencher naturalmente o espaço liberado.

## Fora de escopo

- Modal "Expandir" (segue igual).
- Estrutura interna do editor/preview.
- Outras abas (Biblioteca, Rascunhos, Histórico, Grupos WA).
- Sidebar do admin (não é tocada — o fix é interno ao `<main>`).

## Validação

1. `/admin?sub=criar&tab=campanhas` → passo 1 e 2 continuam com largura atual (não estica).
2. Avançar até passo 3 (Revisar) → wizard e o passo 2 interno "Revisar & Ajustar" ocupam toda a largura disponível do `<main>`, editor e preview ~50% cada.
3. Sidebar do admin permanece visível e clicável.
4. Botão "Expandir" continua abrindo o modal fullscreen.
