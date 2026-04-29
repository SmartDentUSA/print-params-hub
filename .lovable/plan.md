# Geração de Certificados de Treinamento

## Parte 1 — Edge Function `generate-certificate`

**Criar:** `supabase/functions/generate-certificate/index.ts` com o conteúdo TypeScript fornecido (pdf-lib + fontkit, template + Italianno + Alef do bucket `training-certificates/_assets/`, escreve PDF em `generated/{turma_id}/{type}_{id}.pdf`, persiste `certificate_pdf_path` + `certificate_generated_at` em `smartops_course_enrollments` / `smartops_enrollment_companions`, retorna signed URLs com TTL 30 dias).

**Config (`supabase/config.toml`):** adicionar entrada `[functions.generate-certificate]` com `verify_jwt = false`.

Justificativa: o código entregue não chama `getClaims()` nem valida JWT. Com `verify_jwt = true` (default Lovable) o gateway barra a invocação antes do código rodar, mas o handler depende exclusivamente do `SERVICE_ROLE_KEY` interno (não usa o token do chamador). Ficar com `verify_jwt = false` mantém comportamento idêntico ao código fornecido. Como o `SmartOpsCourses` já exige sessão admin no frontend, o botão só é exposto para usuários autenticados — risco aceitável e consistente com o restante das funções administrativas do projeto (`smart-ops-*` usam `verify_jwt = false`).

**Deploy:** automático ao salvar (Lovable). O comando `supabase functions deploy ...` da especificação não é executado — não é necessário.

**Pré-requisitos no bucket** (responsabilidade do usuário, já confirmado): `training-certificates/_assets/template.pdf`, `Italianno-Regular.ttf`, `Alef-Regular.ttf`.

## Parte 2 — Botão "Gerar certificado" na aba Inscrições

**Arquivo:** `src/components/SmartOpsCourses.tsx`, função `InscricoesTab` (linha 751).

### Mudanças

1. **Imports**: adicionar `Award`, `Loader2` em `lucide-react`; adicionar `Tooltip, TooltipContent, TooltipProvider, TooltipTrigger` de `@/components/ui/tooltip`.

2. **SELECT** (linha ~774): adicionar campos `certificate_pdf_path, certificate_generated_at` à string de colunas.

3. **Estado local** dentro de `InscricoesTab`: `const [certLoadingId, setCertLoadingId] = useState<string | null>(null);`

4. **Handler `handleGenerateCertificate(enrollment)`**: chama `supabase.functions.invoke('generate-certificate', { body: { turma_id, enrollment_ids: [id], include_companions: false, regenerate: false } })`, abre `signed_url` em nova aba, toast de sucesso/erro, invalida `["smartops_enrollments"]` para refetch.

5. **Coluna Ações** (linha ~898): inserir o botão Award **entre** Editar (Pencil) e Deletar (Trash2):
   - Ícone verde se `r.certificate_pdf_path` existe, cinza caso contrário; `Loader2` animando enquanto `certLoadingId === r.id`.
   - Tooltip: "Abrir/Gerar certificado".
   - `Button variant="ghost" size="sm"` (mesmo padrão dos vizinhos).
   - Disabled durante loading.

### Comportamento

- Sem certificado → EF gera, salva no Storage + DB, retorna signed URL, abre em nova aba, ícone vira verde após refetch.
- Com certificado → EF retorna signed URL do PDF existente (sem regenerar, pois `regenerate: false`), abre em nova aba.
- Erro → toast destructive com a mensagem da EF.

## Restrições respeitadas

- Não toca `LeadDetailPanel`, `lead_activity_log`, RLS, integrações PipeRun/SellFlux/Meta, Sistema A.
- Não cria migration (colunas `certificate_pdf_path` e `certificate_generated_at` já existem).
- Não modifica os botões Editar/Deletar nem o resto da tabela.
- Apenas: 1 arquivo novo (EF), 1 entrada no `config.toml`, 1 botão + 1 handler + 2 campos no SELECT em `SmartOpsCourses.tsx`.

## Validação pós-implementação

- Confirmar log da EF na primeira invocação real (verifica que `template.pdf` + fontes carregam do bucket).
- Confirmar que o ícone fica verde após refetch.
