

# Plano: Corrigir validacao do astron-postback

## Diagnostico

Os logs confirmam:
- `[astron-postback] Invalid token received` — a Astron envia POSTs de validacao **sem token**
- O secret `ASTRON_POSTBACK_TOKEN` tem valor configurado
- A condicao `if (expectedToken && expectedToken !== receivedToken)` rejeita com 401

A Astron nao envia GET para validar — ela envia um POST sem token e espera receber 200.

## Solucao

Duas opcoes:

### Opcao A (recomendada): Preencher o token no painel da Astron
- Voce precisa saber qual valor foi configurado no secret `ASTRON_POSTBACK_TOKEN`
- Colar esse mesmo valor no campo "Token (Opcional)" do painel da Astron
- Nenhuma alteracao de codigo necessaria

### Opcao B: Tornar o token opcional na function
- Modificar a validacao para so rejeitar quando um token **e enviado mas nao confere**
- Se nenhum token for enviado, aceitar a requisicao (sem autenticacao)

Alteracao no `supabase/functions/astron-postback/index.ts`, linha 63:

```typescript
// ANTES:
if (expectedToken && expectedToken !== receivedToken) {

// DEPOIS:
if (expectedToken && receivedToken && expectedToken !== receivedToken) {
```

Isso faz com que:
- Se a Astron envia token → valida
- Se a Astron NAO envia token → aceita (probe de validacao passa)
- Seguranca reduzida, mas funcional

## Recomendacao

Opcao B resolve o problema imediato. Para producao, configurar o token no painel da Astron (Opcao A) e mais seguro.

