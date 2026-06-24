## Diagnóstico

`src/lib/social/mediaValidation.ts` aceita apenas `video/mp4` e `video/quicktime`. Arquivos `.webm` são barrados com a mensagem "Formato de vídeo não suportado (use MP4 ou MOV)".

## Solução mínima

Adicionar `video/webm` à lista de MIME types de vídeo permitidos em `src/lib/social/mediaValidation.ts`.

### Mudança
```ts
const VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm'];
```

Nenhuma outra alteração será feita no fluxo de upload, no componente de mídia, no schema, no backend, no Vite config ou em qualquer outro arquivo. O upload de WebM passará a ser aceito na UI da mesma forma que MP4/MOV.

## Fora de escopo

- Conversão de vídeo (WebM → MP4).
- Edge function de transcodificação.
- Alteração de mensagens de erro, progresso ou componentes visuais.
- Alterações no schema de postagens, buckets de storage ou APIs de publicação.