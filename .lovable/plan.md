# Player de áudio ausente no artigo publicado

## Diagnóstico

Consultei o registro do artigo `comparativo-tecnico-malhas-medit-i600-i700-i900-vs-blz-ino200` (id `af33efc0-…`) na tabela `knowledge_contents`:

- `hero_audio_url = NULL`
- `hero_audio_label = NULL`
- `content_html` (29 KB) **não** contém nenhuma tag `<audio>`, referência a `lp-audio/` ou `.mp3`

Ou seja, o front (`KnowledgeContentViewer`) está correto — ele só renderiza `KnowledgeAudioPlayer` quando `content.hero_audio_url` existe (linhas 499-506). Como o campo está `NULL`, o player nunca é montado.

No entanto, no bucket `knowledge-images` existe um upload recente compatível com o horário em que você trabalhou no artigo:

- `lp-audio/1784083366498-60chkd.mp3` criado em **2026-07-15 02:42:55 UTC**
- O artigo foi salvo **~35 min depois**, às **03:17:19 UTC**, sem o campo `hero_audio_url` populado.

Causa provável: o áudio foi enviado no widget `HeroAudioUpload` (que só sobe pro Storage e chama `onChange`), mas depois o modal do editor foi reaberto/recarregado antes do "Salvar", o `loadEditData` sobrescreveu `formData.hero_audio_url` com o valor do banco (`''`), e o save subsequente gravou `NULL`.

## O que fazer

### 1. Reatribuir o áudio já uploadado (rápido)

Rodar um `UPDATE` apontando o campo `hero_audio_url` para o arquivo já existente no Storage e definir um rótulo padrão:

```sql
UPDATE knowledge_contents
SET hero_audio_url  = 'https://<PROJETO>.supabase.co/storage/v1/object/public/knowledge-images/lp-audio/1784083366498-60chkd.mp3',
    hero_audio_label = 'Ouvir explicação'
WHERE id = 'af33efc0-4712-47a0-a2c9-e4b23e12d7d6';
```

Antes de aplicar, confirmar com você:
- **Este `1784083366498-60chkd.mp3` é realmente o áudio deste artigo?** (Caso contrário, você me manda um novo upload / URL correta.)
- Rótulo do player: manter "Ouvir explicação" ou usar outro texto?

### 2. Endurecer o editor para não perder mais uploads (opcional, mesma tela)

Alterações mínimas em `src/components/AdminKnowledge.tsx` / `HeroAudioUpload.tsx`:

- Após `onChange(url)` no upload, disparar auto-save silencioso do campo (mesmo padrão já usado para `content_image_url`) — assim, mesmo que o modal seja fechado sem clicar em "Salvar", o áudio já fica persistido.
- Badge visual "Áudio pronto — não salvo" enquanto `formData.hero_audio_url` ≠ valor no banco, para deixar claro que ainda falta salvar.

Isto é ajuste puro de UI/persistência, não mexe em RLS, tabelas ou lógica de negócio.

## Não vou alterar

- Renderer (`KnowledgeContentViewer`, `KnowledgeAudioPlayer`) — já funciona corretamente.
- Schema de `knowledge_contents` — os campos `hero_audio_url` / `hero_audio_label` já existem.
- Nada relacionado a CDP, leads, PipeRun ou Copilot.

## Pergunta antes de implementar

Confirma que o arquivo `lp-audio/1784083366498-60chkd.mp3` é o áudio deste artigo? Se sim, aplico o UPDATE (passo 1) e, se você quiser, faço também o passo 2 para evitar recorrência.
