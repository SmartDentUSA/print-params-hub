## Problema

O detector automático em `emailSections.ts` está encontrando **25 itens de FAQ** (perguntas individuais) em vez das grandes seções do email (hero, oferta, benefícios, bloco de FAQ inteiro, rodapé). A BFS atual escolhe o container com **mais** filhos de conteúdo — e um `<ul>` de FAQ com 25 `<li>` sempre vence contra o wrapper de nível superior com 4-6 blocos.

## Fix (`src/components/smartops/emailSections.ts` → `parseAuto`)

Trocar o critério de "mais filhos" por "**mais próximo do topo, dentro de uma faixa saudável de blocos**":

1. Definir faixa alvo: `MIN_KIDS = 2`, `MAX_KIDS = 12` (emails reais raramente têm >12 seções de topo).
2. Na BFS, considerar como candidato apenas containers com `kids.length` em `[MIN_KIDS, MAX_KIDS]`.
3. Entre candidatos, escolher:
   - **menor profundidade** primeiro (mais perto do topo do body);
   - em empate, o com **mais** filhos.
4. Se nenhum container ficar na faixa (ex.: email é uma coluna única), cair no fallback atual: seção única "Conteúdo" não removível.

Isso garante que o FAQ inteiro apareça como **um único bloco** ("Bloco FAQ" ou nomeado pelo heading `Perguntas frequentes`), não 25 blocos.

## Fora de escopo

- Detectar sub-seções dentro do FAQ (usuário quer o oposto: agrupar).
- Aba Visual / HTML / preview / envio.
- Passos 1 e 3.

## Validação

`/admin?sub=criar&tab=campanhas` → Passo 2 → aba **Seções** no email do Ultimate Bundle:
- 4-8 blocos listados (Hero, Oferta, Benefícios/Diferenciais, FAQ, Rodapé etc.), não 25.
- Rótulos usam o heading real de cada bloco (já implementado).
- Desmarcar um bloco remove todo o grupo do preview.