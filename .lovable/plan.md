

# Plano: Resolver 404 da Astron ao validar URL do postback

## Problema

O gateway do Supabase exige o header `apikey` em **todas** as requisicoes para edge functions, mesmo com `verify_jwt = false`. A Astron faz um GET simples sem esse header, resultando em 404 (a pagina de erro do Supabase que aparece no screenshot).

## Solucao

Incluir o `apikey` como query parameter na URL. O Supabase aceita a anon key via query string `?apikey=...`.

## URL correta para colar no painel da Astron

```
https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/astron-postback?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZW9namdxaWpiZmt1ZGZqYWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzE5MDgsImV4cCI6MjA3MjQ0NzkwOH0.OGdtvsJNdEqAfUoDA4O9OcnD69Titu69TsXS38TaVtk
```

## Nenhuma alteracao de codigo necessaria

A edge function ja trata GET corretamente (retorna `{"status":"ok"}`). O unico problema e a falta da `apikey` na chamada da Astron.

## Seguranca

A anon key e publica por design (ja e usada no frontend). A seguranca real esta no `ASTRON_POSTBACK_TOKEN` que valida os POSTs.

