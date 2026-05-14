## Objetivo

Permitir gerar/abrir o certificado PDF de **cada acompanhante** (`smartops_enrollment_companions`) no mesmo padrão do participante principal — o backend já suporta (`generate-certificate` com `include_companions: true` e a coluna `certificate_pdf_path` já existe na tabela de companions). Falta apenas a UI em `SmartOpsCourses.tsx`.

## Mudanças (apenas `src/components/SmartOpsCourses.tsx`)

### 1. Query — trazer estado do certificado dos acompanhantes
No `select` da query `smartops_enrollments`, expandir o embed de companions:

```ts
companions:smartops_enrollment_companions(
  id, name, email, phone, especialidade, area_atuacao,
  certificate_pdf_path, certificate_generated_at
)
```

### 2. Novo handler `handleGenerateCompanionCertificate`
Espelho de `handleGenerateCertificate`, mas:
- Chama `generate-certificate` com `enrollment_ids: [enrollment.id]` e `include_companions: true`
- Filtra `data.certificates` por `type === 'companion' && id === companion.id` para pegar o `signed_url` correto
- Mesmo fluxo de abrir em nova aba + copiar URL para clipboard + toast
- Loading state com `certCompanionLoadingId` (novo state, chave = companion.id)
- `qc.invalidateQueries(['smartops_enrollments'])` no fim para refletir `certificate_pdf_path`

### 3. UI — expor acompanhantes na linha da tabela
Cada inscrição com `companions.length > 0` ganha uma sub-seção compacta (linha expandida abaixo da principal) listando cada acompanhante com:
- Nome (+ especialidade pequena)
- Botão Award idêntico (verde se `certificate_pdf_path`, neutro caso contrário) com tooltip "Gerar certificado" / "Abrir certificado"
- Loader durante chamada

Implementação enxuta: adicionar `<TableRow>` extra logo após cada linha de inscrição quando `r.companions?.length > 0`, com `colSpan={7}` contendo um pequeno bloco indentado:

```tsx
{r.companions?.length > 0 && (
  <TableRow className="bg-muted/30">
    <TableCell colSpan={7} className="py-2">
      <div className="pl-8 space-y-1">
        <div className="text-xs text-muted-foreground mb-1">Acompanhantes:</div>
        {r.companions.map((c: any) => (
          <div key={c.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1">{c.name}{c.especialidade && <span className="text-muted-foreground"> · {c.especialidade}</span>}</span>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" disabled={certCompanionLoadingId === c.id}
                    onClick={() => handleGenerateCompanionCertificate(r, c)}>
                    {certCompanionLoadingId === c.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Award className={`w-3.5 h-3.5 ${c.certificate_pdf_path ? 'text-green-600' : 'text-muted-foreground'}`} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{c.certificate_pdf_path ? 'Abrir certificado' : 'Gerar certificado'}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ))}
      </div>
    </TableCell>
  </TableRow>
)}
```

## Fora de escopo

- **Não toco em `supabase/functions/generate-certificate/index.ts`** — já trata companions corretamente (gera, faz upload em `generated/{turmaId}/companion_{id}.pdf`, atualiza `certificate_pdf_path` e devolve `signed_url` no array).
- Sem migrations (a coluna `certificate_pdf_path` em `smartops_enrollment_companions` já existe e é atualizada pela edge function).
- Sem alterações no `EnrollmentModal` ou em outros componentes.