## Contexto
O avatar da Dra. L.I.A. está atualmente em `src/assets/dra-lia-avatar.gif` com **11MB**. Ele é renderizado em dois locais no componente `DraLIA.tsx` em tamanhos pequenos (24px e 32px de largura, circular). Um GIF de 11MB para um avatar de 32px é extremamente ineficiente em banda.

## Objetivo
Reduzir o peso do avatar de 11MB para **menos de 500KB**, mantendo a identidade visual da Dra. L.I.A.

## Plano

### 1. Gerar nova imagem estática otimizada
- Criar um avatar da Dra. L.I.A. (personagem assistente IA dental) como PNG, dimensões adequadas para exibição em 32px (ex: 128x128 ou 256x256)
- Estilo: profissional, amigável, alinhado à identidade da marca SmartDent
- Salvar em `src/assets/dra-lia-avatar.png`

### 2. Atualizar importação no componente
- Em `src/components/DraLIA.tsx`, trocar:
  ```
  import draLiaGif from '@/assets/dra-lia-avatar.gif';
  ```
  por:
  ```
  import draLiaAvatar from '@/assets/dra-lia-avatar.png';
  ```
- Atualizar as duas referências (`<img src={draLiaGif}...`) para usar a nova variável `draLiaAvatar`

### 3. Remover arquivo antigo
- Remover `src/assets/dra-lia-avatar.gif` do repositório

## Resultado Esperado
- Avatar carregado em menos de 500KB (redução de ~95%+ no peso)
- Nenhuma mudança visual perceptível para o usuário final
- Melhora imediata no LCP (Largest Contentful Paint) e consumo de dados móveis

## Notas
- O arquivo gerado será inspecionado para confirmar qualidade e tamanho antes de aplicar.
- Se o PNG gerado ainda estiver acima de 500KB, será comprimido/adotado WebP automaticamente.