# Página institucional da Base de Conhecimento — reorganização

## 1. Hero
- Botão "Falar com especialista" passa a abrir https://s.smartdent.com.br/7nr3gv (também no bloco final da página).

## 2. Cards de soluções
- **Resinas 3D** vira o card principal: sozinho na primeira linha, largura total, imagem à esquerda e texto/botões à direita (no celular, empilhado).
- Os outros 5 cards (Softwares, Scanners, Impressoras, Pós-cura, Cimentação) ficam **sem imagem**, em grade, com ícone, título e descrição.
- Todos os cards trocam os links por botões:
  - **Ver catálogo** (catálogo da Base de Conhecimento, categoria do card)
  - **Comprar online** (categoria correspondente na loja)
  - **Fale conosco** com símbolo do WhatsApp -> https://s.smartdent.com.br/7nr3gv
- Sai o link "Solicitar proposta".

## 3. Distribuição
- "Quero ser distribuidor" -> https://s.smartdent.com.br/wi7ygf
- "Ver a rede atual" (Distribuidores) -> https://www.smartdent.com.br/r/rk82ex

## 4. Ciência aplicada à odontologia
- Novo botão **Acesse as certificações** -> https://www.smartdent.com.br/r/rsdwru

## 5. Presença nos Estados Unidos
- Novo botão que leva à aba Artigos já filtrada na categoria **Ciência e tecnologia**.

## 6. Perguntas frequentes (SEO/GEO, pronta para IAs)
Reescrita em blocos, nesta ordem, com respostas diretas na primeira frase e palavras-chave de odontologia digital:
1. **Empresa** — o que é a Smart Dent, origem USP/2009, EUA, certificações, atendimento no Brasil, suporte e treinamento, financiamento.
2. **Resinas 3D** — o que são resinas 3D odontológicas biocompatíveis, aplicações (provisórios, definitivos, guias, modelos, placas), certificações ISO 10993/ANVISA/FDA, parâmetros por impressora.
3. **Scanners intraorais** — o que é escaneamento intraoral, modelos (Medit i600/i700, BLZ INO200), vantagens sobre moldagem convencional, integração CAD.
4. **Impressoras 3D** — quais impressoras odontológicas, ChairSide Print, impressão no consultório x laboratório, pós-cura.
5. **Soluções integradas** — fluxo digital completo (escanear, planejar no exocad, imprimir, caracterizar, cimentar), para quem serve, como começar.
- Sem preços e sem dados inventados: só fatos que já estão no site/catálogo.
- Mesmo conteúdo em português, inglês e espanhol.
- Perguntas visíveis na página e marcadas como FAQ estruturado para buscadores e IAs.

## Detalhes técnicos
- Arquivos: `src/content/institutional.ts` (textos/FAQ por idioma, agrupados por tema) e `src/components/knowledge/KbTabInstitucional.tsx` (layout, botões, links, JSON-LD FAQPage existente atualizado).
- Card destaque via classe própria em grid (`grid-column: 1 / -1`, layout 2 colunas), demais cards sem `sdi-card-img`.
- Link de Artigos: `?tab=artigos` com a categoria de Ciência e tecnologia usada hoje na aba (confirmar a chave no código ao implementar).
- Nenhuma mudança em formulários, CRM ou banco.
