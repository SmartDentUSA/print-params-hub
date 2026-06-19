## Objetivo
Localizar, em todas as publicações de `knowledge_contents` que mencionam "Vitality", trechos com protocolo de pré/pós-processamento **diferente** do canônico (ex.: ASIGA Composer, IPA 90%, 50 microns, inclinação 45°, "3 coroas simultâneas", agitação ultrassônica genérica) e substituí-los pelo bloco oficial vindo de `resins.processing_instructions` da Vitality.

## Fonte da verdade
- Tabela: `resins` (`slug = resina-3d-smart-print-bio-vitality-longa-duracao`)
- Coluna: `processing_instructions` (markdown — PRÉ, PÓS, Pós-cura UV, Tratamento térmico, Acabamento, SmartMake, Pré-instalação)

## Edge function nova: `audit-vitality-protocol`

### Entrada
```json
{ "dry_run": true, "limit": 100, "slug": "opcional-para-teste-unitario" }
```

### Fluxo
1. **Carrega protocolo canônico** uma vez:
   - `SELECT processing_instructions FROM resins WHERE slug='resina-3d-smart-print-bio-vitality-longa-duracao'`
   - Converte markdown → HTML (mesmo parser usado pelo restante do projeto) para inserção em `content_html`.

2. **Seleciona artigos candidatos**:
   ```sql
   SELECT id, slug, title, content_html
   FROM knowledge_contents
   WHERE active = true
     AND content_html ILIKE '%vitality%'
     AND (
       content_html ~* '(pós[- ]?processamento|pós[- ]?cura|lavagem|pre[- ]?processamento|pré[- ]?processamento)'
     )
   ```

3. **Para cada artigo**, chama Lovable AI Gateway (`google/gemini-3-flash-preview`) com:
   - **System**: "Você é auditor técnico do protocolo Smart Print Bio Vitality. Detecte se o artigo descreve um protocolo de pré/pós-processamento DIVERGENTE do canônico. Sinais de alucinação: menção a ASIGA Composer, IPA isopropílico %, 'microns' de camada, inclinação de suportes, tempos de impressão por coroa, agitação ultrassônica como método oficial, valores fabricados de tempo/temperatura. NÃO marcar como alucinação: menções genéricas a Vitality sem descrever protocolo, ou referências corretas ao NanoClean Pod + Elegoo/Anycubic/ShapeCure."
   - **Output estruturado (zod/JSON schema)**:
     ```json
     {
       "has_hallucinated_protocol": boolean,
       "hallucinated_html_block": string | null,  // HTML literal do <section>/<h2>/<p>...</p> a remover
       "reason": string,
       "confidence": number  // 0..1
     }
     ```

4. **Substituição** (quando `has_hallucinated_protocol && confidence >= 0.75`):
   - Localiza `hallucinated_html_block` em `content_html` (busca literal; se falhar, normaliza espaços e tenta de novo).
   - Substitui pelo HTML do protocolo canônico envolvido em `<section data-source="resins.vitality.canonical">…</section>`.
   - Em `dry_run=false`: `UPDATE knowledge_contents SET content_html = …, updated_at = now() WHERE id = …`.
   - Sempre registra antes/depois em `system_health_logs` (`function_name = 'audit-vitality-protocol'`).

5. **Salvaguardas**:
   - Confirma que o bloco a remover **não** representa >40% do artigo (evita apagar artigos inteiros que sejam só sobre o protocolo).
   - Se substituição falhar (bloco não encontrado), grava em `system_health_logs` com severity=warning e segue para o próximo artigo.
   - Rate limit: 1 req/s para o Gateway (delay 1s entre artigos).

### Saída da função
```json
{
  "scanned": 42, "flagged": 7, "updated": 6, "skipped_low_confidence": 1,
  "results": [{ "slug": "...", "confidence": 0.92, "updated": true, "reason": "..." }]
}
```

## Operação
1. Deploy da função.
2. Rodar **dry-run** primeiro (`{ "dry_run": true }`) — você revisa o relatório de candidatos e razões.
3. Rodar com `dry_run=false` para aplicar.
4. Logs em `system_health_logs` permitem rollback manual via `content_html` antigo (também salvo no log `details.before_html`).

## Não-mexer
- Não altera `resins.processing_instructions` (fonte canônica).
- Não toca em artigos sem `vitality` no `content_html`.
- Não altera artigos que apenas citam Vitality sem protocolo (IA filtra).
- Mantém o restante do artigo intacto — só substitui o bloco do protocolo.
