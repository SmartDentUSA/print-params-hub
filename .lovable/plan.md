# Correção: botão Criar curso deve salvar qualquer modalidade

## Objetivo

Fazer o botão **Criar curso** realmente criar o curso, independente da modalidade selecionada.

## O que será alterado

Em `src/components/smartops/CourseCreateModal.tsx`:

1. **Garantir que o botão chame `handleSave`**
   - Manter o botão `Criar curso` ligado diretamente à função de salvamento.
   - Evitar qualquer dependência de modalidade para disparar o salvamento.

2. **Deixar o botão sempre acessível**
   - Ajustar o footer do modal para ficar visível no final da janela/modal, sem depender de rolar até o fim do formulário.
   - Isso evita a sensação de que “não faz nada” quando o botão fica fora da área visível.

3. **Não bloquear criação por modalidade**
   - Presencial, Online ao Vivo, Online, Workshop/Webinar devem passar pelo mesmo fluxo base de criação.
   - Campos extras continuam opcionais e não devem impedir o cadastro.

4. **Melhorar feedback se der erro real**
   - Se o Supabase retornar erro, mostrar mensagem clara no toast.
   - Se salvar com sucesso, fechar o modal e atualizar a lista como já acontece.

## Fora do escopo

- Não vou criar novas regras de inscrição pública.
- Não vou alterar banco de dados.
- Não vou mexer em NPS, WhatsApp, lembretes ou captura de lead.
- Não vou mudar regras comerciais por modalidade.