## Correção

A imagem do card informativo NÃO vai no topo do accordion da resina. Ela entra **dentro do bloco "Instruções de Pré/Pós Processamento"**, logo **após o texto da descrição** (o `<ProcessingInstructionsView />`), no mesmo lugar semântico onde a imagem do produto complementa o texto no card do catálogo.

## Onde exatamente

`src/components/ParameterTable.tsx`, dentro do `AccordionContent value="processing"` (linhas 284-286). Renderizar a imagem logo depois de `<ProcessingInstructionsView instructions={processingInstructions} />`.

## Fluxo de dados (mínimo)

1. **`src/hooks/useSupabaseData.ts`** — no bloco onde `resinData` já é lido (linha ~512), adicionar 3 campos ao objeto da resina:
   - `info_card_url_pt: resinData?.info_card_url_pt || null`
   - `info_card_url_en: resinData?.info_card_url_en || null`
   - `info_card_url_es: resinData?.info_card_url_es || null`

2. **`src/components/ResinAccordion.tsx`**
   - Estender a interface `Resin` com os 3 campos opcionais.
   - Passar `infoCardUrl` já resolvido pelo idioma para o `<ParameterTable>`:
     ```tsx
     import { useLanguage } from "@/contexts/LanguageContext";
     const { language } = useLanguage();
     const pickCard = (r: Resin) =>
       (r as any)[`info_card_url_${language}`] || r.info_card_url_pt || null;
     ```
     Na chamada (linha 282): `infoCardUrl={pickCard(resin)}`.

3. **`src/components/ParameterTable.tsx`**
   - Adicionar prop opcional `infoCardUrl?: string | null`.
   - Dentro do `AccordionContent value="processing"`, após `<ProcessingInstructionsView />`:
     ```tsx
     {infoCardUrl && (
       <a
         href={infoCardUrl}
         target="_blank"
         rel="noopener noreferrer"
         className="block mt-4"
       >
         <img
           src={infoCardUrl}
           alt="Guia de Pré e Pós-Processamento"
           loading="lazy"
           className="w-full max-w-2xl rounded-lg border border-border shadow-sm"
         />
       </a>
     )}
     ```
   - Guard: se `processingInstructions` estiver vazio mas `infoCardUrl` existir, renderizar o accordion mesmo assim, exibindo só a imagem (evita esconder o único conteúdo). Isso é feito trocando o guard atual `if (!hasInstructions) return null;` para `if (!hasInstructions && !infoCardUrl) return null;` e envolvendo `<ProcessingInstructionsView />` em `{hasInstructions && ...}`.

## Fora de escopo

- Nenhuma mudança no `AdminModal`, `ResinCardStudio`, motor de render ou migrations.
- Sem lightbox/zoom; clique abre em nova aba.
- Sem alterações no `KbTabParametros` (base de conhecimento) neste passo.
- Sem novas chaves i18n; o texto "Instruções de Pré/Pós Processamento" que já rotula o accordion basta; o `alt` da imagem é fixo em PT.

## Validação

1. Exportar card PT/EN/ES em `/admin` para uma resina.
2. Abrir `/`, expandir a resina → abrir "Instruções de Pré/Pós Processamento" → imagem aparece abaixo do texto.
3. Trocar idioma para EN/ES → imagem correspondente carrega (fallback silencioso para PT).
4. Resina sem nenhum `info_card_url_*` mas com `processing_instructions` → comporta como hoje (só o texto).
5. Resina sem `processing_instructions` mas com `info_card_url_*` → accordion aparece exibindo somente a imagem.
