Substituir o array `DEFAULT_LP_CONTENT.faq.items` em `src/components/lp/PremiumLandingTemplate.tsx` pelas 28 perguntas fornecidas (mantendo `title: "Perguntas frequentes"`).

Parsing: cada `?` encerra a pergunta; o texto restante até o próximo cabeçalho é a resposta. As FAQs também precisam ser preservadas na landing atual (o `ensureContent` usa `parsed.faq` se já existir — para a LP já salva, o usuário pode clicar em "Restaurar defaults" via edição manual do bloco, ou reaproveitamos: como a LP atual foi criada com o default antigo de 3 itens, atualizamos o default e os novos itens aparecem em novas LPs; se o usuário quiser aplicar retroativamente à LP atual, ele edita manualmente. Não sobrescrevemos dados salvos automaticamente).

### Lista final (28 itens)

1. O que é o exocad RMS?
2. A licença é oficial?
3. A licença será minha para sempre?
4. Preciso ter uma conta my.exocad?
5. Como funciona o pagamento da Ativação Inicial?
6. Qual será o valor da minha mensalidade a partir do segundo mês?
7. O pagamento é seguro?
8. Quem fornece a licença e quem cobra?
9. Quem aparece no extrato do cartão?
10. O que acontece se o cartão falhar na mensalidade?
11. Posso cancelar a assinatura?
12. O Ultimate Bundle inclui todos os produtos da exocad?
13. Existe cobrança por caso ou taxa de exportação (click fees)?
14. Funciona com meu scanner, impressora ou fresadora?
15. Terei direito a atualizações do exocad?
16. A inteligência artificial da exocad está incluída?
17. Ser um assinante Smart Dent traz outros benefícios?
18. Posso usar em mais de um computador?
19. Posso acessar a licença de fora do Brasil?
20. Meu computador é compatível?
21. Preciso estar conectado à internet?
22. Há uso de dongle físico (pen drive)?
23. Acabei de realizar o pagamento da Ativação. E agora?
24. O treinamento está incluído?
25. O suporte técnico está incluído?

## Arquivo afetado
- `src/components/lp/PremiumLandingTemplate.tsx` — atualiza `DEFAULT_LP_CONTENT.faq.items`.

## Observação
LPs já salvas mantêm o FAQ antigo (3 itens). Se você quiser aplicar as 25 perguntas na LP atual do Ultimate Lab Bundle, me avise que faço uma migração pontual atualizando `content.faq.items` do registro correspondente.