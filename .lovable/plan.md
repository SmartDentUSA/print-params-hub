

# Plan: WhatsApp group link in enrollment messages

## What changes

The `{{grupo_whatsapp}}` variable currently renders as a plain line with the raw URL. The user wants it to render as an invitation CTA with the link, e.g.:

```
📱 *Entre no grupo de WhatsApp do seu treinamento:*
👉 https://chat.whatsapp.com/abc123
```

There is no URL shortener in the project. Adding one (Bitly, TinyURL, etc.) would require an API key and add a failure point to enrollment. Instead, the improvement is purely cosmetic — better copy around the existing link.

## Changes

**File: `src/lib/courseWhatsapp.ts`**

### 1. Update DEFAULT_ENROLLMENT_TEMPLATE (line 15)

Change the `{{grupo_whatsapp}}` placeholder position/context in the default template to be more explicit:

```
{{cronograma}}

{{grupo_whatsapp}}

Qualquer dúvida, estou à disposição!
```

No structural change needed here — the template already has the variable in the right place.

### 2. Update `interpolateTemplate` (line 58)

Change the `grupoLine` construction from:
```ts
const grupoLine = vars.grupo_whatsapp ? `📱 Grupo da turma: ${vars.grupo_whatsapp}` : '';
```
To:
```ts
const grupoLine = vars.grupo_whatsapp
  ? `📱 *Entre no grupo de WhatsApp do seu treinamento:*\n👉 ${vars.grupo_whatsapp}`
  : '';
```

This produces a two-line block with a clear CTA and the link on its own line (WhatsApp will auto-linkify it).

### 3. Update TEMPLATE_VARIABLES description (line 33)

Update the description for `{{grupo_whatsapp}}` from `'Link do grupo WA'` to `'CTA + link do grupo WhatsApp'` so editors understand the variable now renders as a multi-line block.

**Single file modified:** `src/lib/courseWhatsapp.ts`

