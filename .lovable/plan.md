## Plano

1. **Corrigir a altura real do modal**
   - Ajustar o `DialogContent` da landing page para ter altura fixa controlada (`h-[95vh]`) além do `max-h`, garantindo que os filhos com `overflow-y-auto` tenham uma área rolável real.

2. **Liberar rolagem do preview**
   - Trocar o container do preview para um layout com altura mínima estável e rolagem explícita.
   - Garantir que a prévia da landing page role dentro do painel direito, sem depender da rolagem da página por trás do modal.

3. **Liberar rolagem das ferramentas de edição**
   - Ajustar o painel esquerdo (`EditorSidebar`) para ficar com `overflow-hidden` no container externo e `overflow-y-auto` somente na área dos campos.
   - Manter os botões rápidos no topo, mas sem bloquear a rolagem até seções como **Condições**, **Benefícios**, **FAQ**, **CTA final** e **Rodapé**.

4. **Fallback para telas menores**
   - Em larguras menores, permitir que editor e preview empilhem com rolagem funcional em vez de travar o grid.

5. **Validação**
   - Testar no preview abrindo o modal em `/admin`, entrando em **Editar & publicar**, e confirmar que:
     - o painel esquerdo rola até os cards de condições;
     - o preview direito rola a landing page inteira;
     - os botões de atalho continuam levando às seções corretas.