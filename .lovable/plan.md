Atualizar a constante `msg_text` na função `fn_social_post_to_wa_campaign()` para reforçar que o grupo é de colaboradores e orientar o engajamento completo na postagem.

## Mudança

**Arquivo:** `supabase/migrations/20260619030931_24fe0742-1c49-4a41-85b2-9c3b59c82230.sql`

**Mensagem atual:**
```
Conteúdo postado!
Galera, curta - salva - compartilha com clientes - e comenta o CTA.
```

**Nova mensagem:**
```
Conteúdo postado no ar!

Pessoal, esse grupo é de colaboradores — preciso da força de todos:
1. Entrem no post
2. Curtam
3. Salvem
4. Compartilhem com clientes
5. Comentem o CTA

Bora engajar!
```

A alteração é apenas no texto da constante `msg_text` na função PostgreSQL. Nenhuma outra lógica muda.