

# Plano: FAQs por IA sempre acrescenta +10

## Problema atual
Quando o usuario clica "Gerar 10 FAQs por IA", as FAQs existentes sao substituidas pelas novas. O usuario quer que sempre **acrescente** +10 FAQs ao que ja existe.

## Mudancas

### 1. Backend — `supabase/functions/ai-metadata-generator/index.ts`

**Linha 140-142:** Mudar de substituicao para concatenacao:
```typescript
if (type === 'faqs') {
  faqs = [...faqs, ...aiRes.value];  // append instead of replace
  console.log('✅ Generated FAQs (appended):', faqs.length);
}
```

### 2. Frontend — `src/components/AdminKnowledge.tsx`

**Linha 3897-3904:** Concatenar as FAQs existentes com as novas:
```typescript
setFormData(prev => ({
  ...prev,
  faqs: [...(prev.faqs || []), ...data.faqs]
}));

toast({
  title: '✅ +10 FAQs adicionados!',
  description: `Total: ${(formData.faqs?.length || 0) + data.faqs.length} FAQs`,
});
```

**Linha 3861:** Atualizar texto descritivo:
```
"Acrescente +10 FAQs baseadas no conteúdo do artigo"
```

**Linha 3919:** Atualizar label do botao:
```
'🪄 Gerar +10 FAQs por IA'
```

### Arquivos alterados
1. `supabase/functions/ai-metadata-generator/index.ts` — append em vez de replace
2. `src/components/AdminKnowledge.tsx` — concatenar FAQs, atualizar textos

