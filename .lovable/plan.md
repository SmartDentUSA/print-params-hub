## Causa-raiz

As hashtags aparecem duplicadas porque há **duas fontes** alimentando o mesmo lugar:

1. **`training-factory-trigger`** instrui o LLM (linha 201) a **terminar a caption do Instagram** com:
   `#odontologiadigital #smartdent #chairsideprint #impressao3d #ino200 #odontologia`
2. **Logo depois**, o código salva exatamente as **mesmas hashtags** no array `hashtags[]` do asset (linhas 257–264).
3. Na hora de publicar, **`social-publish-worker`** (linha 128–133) faz:
   ```
   content = caption + "\n\n" + hashtags.join(" ")
   ```
   → o Instagram recebe as hashtags duas vezes.

No diálogo Factory você vê o mesmo efeito: as hashtags aparecem **no textarea da caption** e **nos chips abaixo** — porque ambos vêm do mesmo asset, mas de campos diferentes.

## Correção (três camadas, complementares)

### 1. `social-publish-worker` — dedup defensivo (fix imediato para dados existentes)

Antes de concatenar, remover do final da caption qualquer bloco de hashtags que já esteja em `hashtags[]`. Algo como:

```ts
const tagSet = new Set((post.hashtags ?? []).map(h => h.toLowerCase().replace(/^#/, "")));
const cleanCaption = (post.caption ?? "")
  .replace(/(?:\s*#[\p{L}\p{N}_]+)+\s*$/u, (match) => {
    // Mantém só hashtags que NÃO estão no array
    const kept = match.trim().split(/\s+/).filter(h => !tagSet.has(h.replace(/^#/, "").toLowerCase()));
    return kept.length ? "\n" + kept.join(" ") : "";
  })
  .trimEnd();
```

Resultado: posts já gerados (turma #144 inclusa) deixam de duplicar imediatamente, sem precisar regerar nada.

### 2. `training-factory-trigger` — prompt limpo (evita repetir o problema no futuro)

No prompt do Instagram, **remover a linha que pede para terminar com as hashtags literais** e **instruir o LLM a NÃO incluir hashtags** ("o sistema de publicação anexa as hashtags automaticamente"). O array `hashtags[]` continua sendo a única fonte estruturada.

### 3. `TurmaFactoryDialog` — preview consistente

Manter os chips de hashtags abaixo (já existem), mas como a caption agora não terá hashtags embutidas, o preview fica claro: caption no textarea, hashtags como chips, sem repetição visual.

## Fora do escopo

- Não vou regerar os assets existentes — a correção (1) já neutraliza o problema na publicação.
- Não vou mexer na lógica do LinkedIn (o prompt dele já pede "no máximo 3–4 hashtags ao final" e o array `hashtags[]` não duplica nesse asset, pois lá está vazio).