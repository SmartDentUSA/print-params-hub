## Regra final

```text
Novo formulário confirmado
├─ Existe deal em CS
│  ├─ NÃO alterar, mover, fechar, enriquecer ou trocar responsável do deal CS
│  └─ Criar um deal separado no Funil de Vendas
└─ Existe deal em Estagnados
   ├─ Fechar somente o deal Estagnados como Perdido
   │  Motivo: "Solicitou novo contato através de formulários"
   └─ Criar um novo deal no Funil de Vendas
```

## Implementação

1. Ajustar o fluxo principal do `smart-ops-lia-assign` para tratar CS como contexto somente de leitura, sem usar o deal CS como alvo de atualização ou como bloqueio para a nova oportunidade comercial.
2. Garantir que um novo formulário confirmado, com CS ativo e sem Vendas aberto, crie um novo deal em Vendas, preservando integralmente todos os deals CS.
3. Manter separada a regra de Estagnados: novo formulário confirmado fecha o Estagnados com o motivo definido e cria um novo deal em Vendas.
4. Corrigir os guards compartilhados que atualmente consideram CS um bloqueio para criação, sem remover as proteções contra duplicidade em Vendas.
5. Validar os cenários combinados: somente CS; somente Estagnados; CS + Estagnados; CS + Vendas aberto; Estagnados + Vendas aberto; e reentrega sem conversão nova confirmada.

## Resultado esperado

- CS nunca sofre alteração automática.
- Estagnados só é fechado quando há novo formulário/conversão confirmado.
- Um novo interesse comercial sempre fica registrado no Funil de Vendas, sem duplicar um Vendas já aberto.