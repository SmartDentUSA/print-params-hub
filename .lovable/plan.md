

# Plano: Criar Edge Function `astron-postback` para receber webhooks da Astron em tempo real

## Contexto

A Astron Members oferece um sistema de Postbacks (webhooks push) que envia eventos em tempo real para uma URL externa via HTTP POST. Isso complementa o `sync-astron-members` (pull em lote) com notificacoes instantaneas de: novo usuario, progresso de curso, novo comentario e novo ticket de suporte.

## O que sera criado

### 1. Secret: `ASTRON_POSTBACK_TOKEN`

Token de autenticacao que sera configurado tanto no painel da Astron quanto na edge function para validar que os POSTs vem realmente da Astron (campo "Token" na interface de postbacks).

### 2. Edge Function: `supabase/functions/astron-postback/index.ts`

Endpoint POST publico que recebe eventos da Astron e faz upsert em `lia_attendances`.

```typescript
// Estrutura principal
Deno.serve(async (req) => {
  // 1. CORS + aceitar apenas POST
  // 2. Validar token (header X-Token ou campo no body)
  const token = req.headers.get("x-token") || body?.token;
  if (expectedToken && token !== expectedToken) → 401

  // 3. Extrair evento
  const { event_type, user } = body;
  // event_type: "new_user" | "course_progress" | "new_comment" | "new_ticket"

  // 4. Normalizar email do aluno
  const email = user.email.trim().toLowerCase();

  // 5. Montar campos para upsert
  const astronFields = {
    astron_user_id: user.id,
    astron_status: user.status,
    astron_nome: user.name,
    astron_email: email,
    astron_phone: user.phone,
    astron_synced_at: new Date().toISOString(),
    // Para "course_progress": atualizar astron_courses_completed
    // Para "new_user": inserir com source = "astron_postback"
  };

  // 6. Upsert: buscar por email → update ou insert
  const { data: existing } = await supabase
    .from("lia_attendances")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    await supabase.from("lia_attendances")
      .update(astronFields).eq("id", existing.id);
  } else {
    await supabase.from("lia_attendances")
      .insert({ email, source: "astron_postback", lead_status: "aluno", ...astronFields });
  }

  // 7. Logar evento para auditoria
  console.log(`[astron-postback] ${event_type} for ${email}`);

  return Response 200 { received: true, event_type, email }
});
```

### 3. Config: `supabase/config.toml`

```toml
[functions.astron-postback]
verify_jwt = false   # Astron envia sem JWT, validacao via token proprio
```

### 4. Tratamento por tipo de evento

| Evento | Acao no `lia_attendances` |
|--------|--------------------------|
| `new_user` | Insert (ou update se email ja existe). `source = "astron_postback"`, `lead_status = "aluno"` |
| `course_progress` | Update `astron_courses_completed`, `astron_courses_total` se disponivel |
| `new_comment` | Update `astron_synced_at` + log (sem campo especifico) |
| `new_ticket` | Update `astron_synced_at` + log (sem campo especifico) |

### 5. URL para colar no painel da Astron

Apos deploy:
```
https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/astron-postback
```

### Seguranca

- Token validado em cada request (rejeita 401 se invalido)
- Sem JWT pois a Astron nao envia tokens Supabase
- Usa `SUPABASE_SERVICE_ROLE_KEY` internamente para upsert
- Reutiliza `normalizePhone()` do sync para consistencia

