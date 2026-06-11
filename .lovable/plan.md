## Objetivo

Deixar o modal **"Envio pontual (wizard)"** decente: footer sempre visível, scroll interno funcional, sem URL crua poluindo a UI e com layout consistente.

## Arquivos afetados

- `src/components/smartops/wa-groups/WaGroupBlastModal.tsx`
- `src/components/smartops/wa-groups/WaMediaUploader.tsx`

Nada de backend, nada de schema, nada de lógica de envio. Só UI.

## Mudanças

### 1. `WaGroupBlastModal.tsx`

**Estrutura do `DialogContent`**: virar coluna flex com altura máxima e scroll interno.

- `DialogContent`: trocar `max-w-xl` por `max-w-2xl p-0 max-h-[90vh] flex flex-col gap-0`.
- `DialogHeader`: adicionar `px-6 pt-6 pb-4 border-b shrink-0`.
- Wrapper do body (`<div className="space-y-4">`): virar `flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0`.
- Footer (`<div className="flex items-center gap-2 pt-2">`): virar `flex items-center gap-2 px-6 py-4 border-t bg-background shrink-0`. Assim fica colado no rodapé do modal, sempre visível.

**Tipo de mensagem**: `grid-cols-3` continua, mas com `max-w-2xl` agora cabem 3+3 limpos em 2 linhas. Adicionar `gap-2` (já tem) e `min-w-0` no `Label` pra truncar se precisar.

**Indicador de seleção no picker**: já existe "Selecionados: 3 grupos · 2036 membros" dentro do `WaGroupMultiSelect` — não mexer. Mas mostrar no footer também o contador "Enviar para X grupos" (já existe no botão).

### 2. `WaMediaUploader.tsx`

**Linha 76-78** — Quando `fileName` não vem (caso `initial.mediaUrl` de histórico), em vez de mostrar `value.split("/").pop()` (que vira `656834004_18350...jpg?stp=dst-jpg_s720x720&_nc_cat=...`), aplicar helper de limpeza:

```ts
function prettyFileName(url: string, fallback?: string): string {
  if (fallback) return fallback;
  try {
    const u = new URL(url);
    const raw = u.pathname.split("/").pop() ?? "arquivo";
    const decoded = decodeURIComponent(raw);
    // Trunca nomes muito longos preservando extensão
    if (decoded.length > 40) {
      const dot = decoded.lastIndexOf(".");
      const ext = dot > 0 ? decoded.slice(dot) : "";
      return decoded.slice(0, 32) + "…" + ext;
    }
    return decoded;
  } catch {
    return "arquivo";
  }
}
```

Trocar `{fileName || value.split("/").pop()}` por `{prettyFileName(value, fileName)}`.

Também envolver o span com `title={value}` pra mostrar URL completa no hover (sem poluir).

## O que NÃO mudar

- Lógica de `handleSend`, `buildContent`, validações.
- `WaGroupMultiSelect`, `CampaignLinkPicker`, edge function `wa-group-blast`.
- Schemas Supabase, RLS, secrets.
- Outros modais ou páginas.

## Validação

- Abrir modal em `pickerMode` → footer com "Cancelar" + "Enviar para N grupos" sempre visível.
- Scroll funciona quando há muitos grupos / preview de imagem / legenda longa.
- URL crua some, mostra nome amigável (`arquivo.jpg` ou similar).
- Layout no `max-w-2xl` confortável em 1525px (viewport atual) e 1024px.

## Risco

Baixo. Mudanças puramente de CSS/markup + um helper de string. Não toca em estado, validação ou envio.
