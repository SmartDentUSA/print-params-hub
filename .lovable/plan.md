## Problemas observados

1. **Só 2 blocos detectados** no email da imagem que visualmente tem 4-5 seções (hero, oferta/preço, benefícios, CTA, rodapé). O drill do heurístico para no primeiro container com >1 filho e ignora blocos aninhados mais fundo (comum em emails de tabela: `<table><tr><td><table>...</table></td></tr></table>`).
2. **Preview/envio "em branco" após desligar seções**: quando o container real está aninhado, o shell reconstruído pode preservar a estrutura externa mas não os wrappers intermediários dos blocos, e desligar sections zera o conteúdo visível.
3. **Warning tiptap `Duplicate extension names found: ['link']`** — o StarterKit v3 já inclui Link; nosso `Link.configure(...)` extra causa duplicata.

## Plano

**1. Heurística de segmentação mais robusta (`emailSections.ts`)**
- Após escolher o container, **achatar recursivamente** wrappers de 1 filho: se um dos filhos é uma table/div wrapper com >1 filho semântico, expandir para os netos.
- Estratégia: coletar candidatos varrendo em profundidade limitada, preferindo o **nível mais profundo** que tenha pelo menos 3 blocos "de conteúdo" (com heading, imagem grande, parágrafo longo ou anchor).
- Fallback: se ainda encontrar < 3 blocos, aceitar 2; se 1, tratar como bloco único.

**2. Serialização mais resiliente**
- Guardar não só o shell externo (`before`/`after`) mas também um **wrapper por seção** (o próprio `outerHTML` do bloco já inclui isso, então basta juntar em ordem original, com separador `\n`).
- Quando **todas** as sections estiverem desligadas, retornar `head + bodyOpen + shell + bodyClose` só com um comentário `<!-- todas as seções desligadas -->` para não enviar HTML vazio invisível.
- Adicionar aviso na UI: "Você desligou todas as seções — o email ficará vazio" se `sections.filter(s=>s.enabled).length === 0`.

**3. Fix warning tiptap duplicado**
- Em `EmailRichEditor.tsx`, remover `Link.configure(...)` da lista (StarterKit v3 já traz Link) OU desativar Link no StarterKit (`StarterKit.configure({ link: false })`) e manter só o nosso — decisão: **desativar no StarterKit** para preservar nosso `openOnClick:false` e `HTMLAttributes` customizados.

**4. Melhorar rotulagem**
- Adicionar detecção de "revendedor oficial", "oportunidade", "exclusivo" → "Hero / Abertura".
- Detecção de "bundle", "assinatura", "mensalidade" → "Oferta / Preço" (além do R$).

## Fora de escopo

- Editor visual por seção individual.
- Reordenação (já existente, não muda).

## Validação

- Abrir o email da imagem → aba Seções deve listar 4+ blocos rotulados (Hero, Oferta, CTA/Benefícios, Rodapé).
- Desligar 1 seção → preview mantém o resto visível.
- Desligar todas → aviso amarelo na UI, preview mostra vazio.
- Console sem warning "Duplicate extension names".
