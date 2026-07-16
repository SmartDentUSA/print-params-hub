## Escopo desta entrega

Adicionar **upload manual** e **excluir** para cada card de idioma (PT / EN / ES) no `AdminModal`, salvando direto em `resins.info_card_url_pt/en/es`. A imagem enviada aparece imediatamente na pré-visualização e passa a ser servida no card público, sem depender do gerador automático.

O prompt de branding (Host Grotesk, paleta Smart Dent, camadas logo/produto, Nano Banana) fica **registrado para a próxima iteração do gerador** — não faz parte desta entrega.

## Mudanças

### `src/components/AdminModal.tsx` — bloco "Imagens geradas" (linhas ~1464-1495)

Para cada card PT / EN / ES, substituir o tile atual por:

```
┌──────────────────────────┐
│ PT   [abrir] [🗑 excluir] │  ← cabeçalho
├──────────────────────────┤
│                          │
│    <img> ou placeholder  │
│                          │
├──────────────────────────┤
│ [⬆ Enviar imagem PT]     │  ← botão upload (drag&drop opcional)
└──────────────────────────┘
```

Comportamento por idioma:

1. **Enviar imagem** — abre `<input type="file" accept="image/*">`. Ao selecionar:
   - valida ≤ 10 MB (usa `validateFileSize` já existente);
   - faz upload para bucket `model-images`, path `resins/{resin.id}-card-{lang}-{timestamp}.{ext}` (extensão pelo MIME real via `extensionFromMime`);
   - `getPublicUrl` → atualiza `resins.info_card_url_{lang}` via `supabase.from('resins').update(...).eq('id', formData.id)`;
   - atualiza `formData` e `generatedCards` em memória para render imediato;
   - toast de sucesso.

2. **Excluir** — botão lixeira só aparece quando existe URL. Ao clicar:
   - confirma via `window.confirm`;
   - seta `resins.info_card_url_{lang} = null`;
   - limpa `formData[info_card_url_{lang}]` e `generatedCards[lang]`;
   - **não** remove o arquivo do storage (evita quebrar histórico); apenas desatrela.

3. **Guard-rails**:
   - se `!formData.id` → botão de upload desabilitado com tooltip "Salve a resina primeiro" (mesma regra do gerador).
   - erros: toast destrutivo com mensagem.

### Estado / helpers

Adicionar dentro do componente:
- `uploadingLang: 'pt'|'en'|'es'|null` para spinner por idioma;
- função interna `handleUploadCard(lang, file)` e `handleDeleteCard(lang)` (não extrair componente novo para minimizar diff).

Reutiliza:
- `supabase.storage.from('model-images')` — bucket já existe (usado pelo `ImageUpload`);
- `extensionFromMime` de `@/utils/storageImage`;
- `validateFileSize` de `@/utils/security`;
- `toast` já importado.

### Fora deste diff

- Sem migration (colunas `info_card_url_pt/en/es` já existem).
- Sem edge function.
- Sem mudança em `AdminViewSecure`/`AdminViewSupabase` além do modal.
- Sem tocar no fluxo do gerador automático — os dois convivem: upload manual sobrescreve o gerado; excluir volta ao estado "aguardando geração".

## Validação

1. Abrir uma resina existente → aba do card informativo.
2. Clicar "Enviar imagem PT" → escolher PNG local → tile PT mostra a imagem em < 2 s.
3. Recarregar a página → a imagem PT continua no card.
4. Ir na página pública/consumidora e conferir que o card PT mostra a imagem enviada.
5. Clicar 🗑 no PT → confirma → tile volta a "— não gerado —"; recarrega e permanece vazio.
6. Repetir para EN e ES independentemente (uploads não interferem entre si).
7. Tentar upload em resina não salva → botão desabilitado / tooltip aparece.