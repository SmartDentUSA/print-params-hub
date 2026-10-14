CREATE SEQUENCE IF NOT EXISTS public.kol_contract_number_seq START 1;

INSERT INTO public.kol_contract_templates (version, body_md, active)
VALUES ('2026.10-1', $kol$
## CONTRATO DE COOPERAÇÃO COMERCIAL – KOL – {{contrato.numero}}
**Versão do modelo:** {{contrato.versao_modelo}}

### CONTRATANTE – MMTECH

MMTECH PROJETOS TECNOLOGICOS IMPORTAÇÃO E EXPORTAÇÃO LTDA., sociedade empresária regularmente constituída, inscrita no CNPJ sob nº 10.736.894/0001-36, com sede na cidade de São Carlos-SP, na Rua Procópio de Toledo Malta, nº 62, Morada dos Deuses, CEP 13.562-291, neste ato representada por seu sócio administrador, MARCELO DEL GUERRA, denominada doravante simplesmente de MMtech.

### CONTRATADA – KEY OPINION LEADER (KOL)

{{#if kol.tipo_pessoa == "PJ"}}
{{kol.razao_social}}, inscrita no CNPJ sob nº {{kol.documento}}, com escritório à {{kol.endereco_completo}}, na cidade de {{kol.cidade}} – CEP {{kol.cep}}, neste ato representada por seu sócio administrador {{kol.representante_nome}}, CPF {{kol.representante_cpf}}, denominada doravante simplesmente de KOL;
{{/if}}
{{#if kol.tipo_pessoa == "PF"}}
{{kol.nome}}, cirurgião(ã)-dentista inscrito(a) no CRO sob nº {{kol.cro}}, CPF nº {{kol.documento}}, com endereço profissional à {{kol.endereco_completo}}, na cidade de {{kol.cidade}} – CEP {{kol.cep}}, denominado(a) doravante simplesmente de KOL;
{{/if}}

E-mail: {{kol.email}}
Telefone / WhatsApp cadastrado (credencial de acesso ao Portal do KOL): {{kol.celular_formatado}}

### PROPÓSITOS

1. A MMTECH é empresa atuante no ramo de produtos e insumos para o mercado odontológico em geral, compreendendo radiologia, clínica e laboratório.

2. O KOL, a seu turno, {{#if PJ}}é empresa jurídica constituída, administrativamente estabelecida e, comercialmente atuante{{/if}}{{#if PF}}é profissional liberal estabelecido e atuante{{/if}} no mercado odontológico, possuindo infraestrutura necessária para atender a demanda da MMTECH, sem necessidade de investimentos adicionais em recursos humanos e/ou materiais.

3. Desta forma, resolvem celebrar o presente Contrato de Cooperação Comercial, que se regerá pelas seguintes cláusulas e condições.

---

### CLÁUSULA 1 – OBJETO

1.1. Constitui objeto do presente contrato a indicação, pelo KOL, de potenciais clientes interessados na aquisição de equipamentos da MMTECH, nas condições aqui definidas e nas que forem implementadas ao longo do vínculo.

1.2. Integram ainda este contrato, nos termos das cláusulas e anexos próprios: (a) a Tabela de Comissionamento (Anexo I); (b) a participação do KOL em palestras, presença em estande e treinamentos (Cláusula 6); (c) a criação e publicação de cursos do KOL na plataforma da MMTECH (Cláusula 7); (d) {{#if equipamentos}}o comodato de equipamentos de apoio (Cláusula 8 e Anexo II){{else}}o comodato de equipamentos de apoio, que somente existirá se formalizado por Termo de Comodato complementar{{/if}}; e (e) a autorização de uso de imagem, voz e nome (Cláusula 9 e Anexo III).

---

### CLÁUSULA 2 – COMISSIONAMENTO E FORMA DE PAGAMENTO

2.1. Pelas indicações de clientes que resultarem em vendas, o KOL receberá comissão incidente sobre o valor líquido das mercadorias vendidas (Cláusula 2.6.1), conforme os percentuais da **Tabela de Comissionamento (Anexo I)** vigentes na data da venda, devidos somente após o recebimento do valor da venda pela MMTECH, na forma do art. 27, "f" da Lei 4.886/65.

2.2. Considera-se indicação atribuída ao KOL a venda cujo cliente tenha sido indicado por um dos meios de rastreio da Cláusula 3.1: registro de indicação feito a partir do grupo de WhatsApp do KOL, formulário de indicação próprio ou cupom de benefício próprio no e-commerce, todos conforme o Anexo I e as regras de atribuição da Cláusula 3.1.1.

2.3. Para as vendas realizadas em Feiras e grandes eventos, a comissão será tratada a critério da MMTECH, considerando fatores como custos logísticos, locação de espaços, investimentos em infraestrutura, etc.

2.4. Nenhuma comissão ou indenização será devida ao KOL nos casos em que o pedido não for aceito e, sendo aceito, não puder a MMTECH dar cumprimento ao pedido em razão de força maior ou caso fortuito.

2.5. Fica facultado à MMTECH o direito de desfazer o negócio e suspender a entrega dos produtos objeto do pedido, por tempo indeterminado, nos casos em que considerar duvidosa a liquidação do preço, por parte do comprador, não sendo devida nenhuma comissão ao KOL, neste caso.

2.6. O KOL fará jus às comissões devidas a partir da emissão da nota fiscal e após o respectivo pagamento das mercadorias pelos compradores.

2.6.1. A comissão incide sobre o valor líquido das mercadorias, isto é, o valor efetivamente pago pelo cliente pelas mercadorias, após deduzido o desconto do cupom ou outro abatimento concedido pela MMTECH.

2.7. A apuração dos valores referentes às indicações será feita mensalmente pela MMTECH, com base nas vendas comprovadamente advindas de indicações do KOL. O extrato mensal, com cada venda, base de cálculo, percentual aplicado e situação, ficará disponível no Portal do KOL.

2.8. O KOL, após aprovar os valores apurados, deverá enviar à MMTECH a Nota Fiscal de Serviços até o 15º dia do mês subsequente, sendo o pagamento da Nota Fiscal em questão realizado até o 20º dia do mês subsequente, mediante recebimento da Nota Fiscal de Prestação de Serviços.

2.9. Caso a Nota Fiscal não seja enviada até o dia 15, o pagamento será realizado no 20º dia do mês subsequente.

2.10. Havendo devolução, cancelamento, estorno ou desfazimento da venda após o pagamento da comissão, o valor correspondente será compensado nas apurações seguintes ou, não havendo comissões futuras, devolvido pelo KOL em até 30 (trinta) dias da comunicação.

2.11. Alterações na Tabela de Comissionamento valerão apenas para vendas realizadas a partir da data de vigência informada, não retroagirão, e serão comunicadas ao KOL pelo Portal do KOL e pelo WhatsApp cadastrado, dependendo de novo aceite eletrônico do KOL para entrarem em vigor.

2.12. Os dados de pagamento do KOL (chave PIX / conta bancária) são os informados em seu cadastro: {{kol.dados_pagamento_resumo}}. Alterações somente serão processadas pela equipe da MMTECH após confirmação direta com o KOL.

---

### CLÁUSULA 3 – OBRIGAÇÕES DO KOL

Compete ao KOL:

3.1. Informar a MMTECH, com máxima brevidade, os dados dos potenciais clientes, a fim de que a equipe comercial possa atendê-los de forma eficaz. A indicação será feita por um ou mais dos canais abaixo, todos registrados no sistema da MMTECH:

a) **Grupo de WhatsApp do KOL:** grupo criado pela MMTECH reunindo o KOL e o vendedor responsável {{#if vendedor}}({{vendedor.nome}}){{/if}}{{#if grupo}}, identificado como "{{grupo.nome}}"{{/if}}, no qual o KOL informa nome, telefone/WhatsApp e interesse do potencial cliente, e o vendedor confirma o recebimento e informa o andamento;

b) **Formulários de indicação gerados pelo sistema da MMTECH**, listados no Anexo I, cujos leads ficam atribuídos automaticamente ao KOL;

c) **Cupons de benefício no e-commerce da MMTECH**, listados no Anexo I, cujas compras ficam atribuídas automaticamente ao KOL.

3.1.1. A indicação por WhatsApp considera-se registrada na data e hora da mensagem do KOL que contiver os dados mínimos do potencial cliente (nome e telefone/WhatsApp) e será lançada no sistema pelo vendedor responsável. Não gera comissão a indicação de cliente que, no momento do registro, já esteja em negociação ativa com a MMTECH ou tenha sido indicado por outro canal ou KOL nos últimos {{contrato.janela_atribuicao_dias}} dias. Havendo mais de um meio de rastreio sobre a mesma venda, prevalece o registro mais antigo.

3.1.2. O KOL declara que só repassará dados de pessoas que tenham autorizado o contato pela MMTECH, e responde pela veracidade dessa declaração, nos termos da Cláusula 10.

3.1.3. O vendedor responsável é o ponto único de contato comercial do KOL. A troca do vendedor ou do grupo será comunicada pela MMTECH no próprio grupo e no Portal do KOL.

3.1.4. O KOL concorda que as mensagens do grupo sobre indicações, o formulário e o cupom utilizados, e o andamento comercial serão registrados no histórico do KOL e do cliente indicado no sistema da MMTECH, como prova de atribuição para fins de comissão.

3.2. Atender com agilidade, qualidade e eficiência as solicitações de informações e sanar dúvidas dos potenciais clientes.

3.3. Sempre que for solicitado, prestar à MMTECH todas as informações sobre suas atividades exercidas relacionadas com o presente instrumento.

3.4. Colaborar com a MMTECH para a obtenção de informações de mercado, necessárias para o êxito dos programas de venda definidos para a sua área de atuação.

3.5. O presente contrato não gera nenhum outro direito ao KOL, ainda que o KOL venha praticar atos de apoio e/ou mera colaboração à MMTECH.

3.6. O KOL, em nenhuma circunstância, poderá firmar contratos ou compromissos em nome da MMTECH ou obrigá-la a qualquer responsabilidade que não esteja incluída neste instrumento.

3.7. Salvo autorização por escrito e especificada da MMTECH, o KOL não poderá conceder abatimentos, descontos ou dilação de prazos, nem agir em desacordo com as instruções da MMTECH.

3.8. Observar as normas éticas e de publicidade aplicáveis à Odontologia, inclusive as do Conselho Federal de Odontologia, em toda comunicação que faça sobre produtos e serviços da MMTECH, sendo vedada a promessa de resultado e o uso de informação técnica não aprovada pela MMTECH.

3.9. **Conteúdo em redes sociais.** O KOL produzirá e publicará, em seus perfis profissionais nas redes sociais, no mínimo {{contrato.conteudo_minimo_mes}} ({{contrato.conteudo_minimo_mes_extenso}}) conteúdos por mês civil que **marquem o perfil oficial da Smart Dent ({{marca.perfil_instagram}})**, nos formatos {{contrato.conteudo_formatos}}, tratando de produtos, soluções, casos clínicos com produtos Smart Dent, cursos ou eventos da Smart Dent.

3.9.1. Cada conteúdo deverá (a) permanecer publicado por no mínimo {{contrato.conteudo_dias_no_ar}} dias, (b) identificar a parceria comercial com a MMTECH de forma clara, conforme as normas de publicidade aplicáveis, e (c) observar a Cláusula 3.8 e o Anexo III, especialmente quanto ao uso de imagens de pacientes, que dependem de autorização própria do paciente, de responsabilidade do KOL.

3.9.2. O KOL registrará no Portal do KOL o endereço (link) de cada conteúdo publicado. A MMTECH poderá verificar o conteúdo, e somente os conteúdos verificados contam para a meta mensal. Conteúdo que cite cupom de benefício do KOL conta também como divulgação de cupom, para os fins da Cláusula 13.5.

3.10. **Influência de mercado.** Para ampliar o alcance dos produtos e soluções da MMTECH, o KOL participará de ações de brand awareness e utilizará suas redes sociais e canais digitais para esse fim, com o objetivo de educar, engajar e converter leads e clientes por meio de conteúdo, observadas as Cláusulas 3.8 e 3.9 e o Anexo III.

3.11. **Divulgação do ecossistema profissional.** O KOL poderá divulgar, em sua comunicação, seu próprio ecossistema profissional (plataforma de cursos, treinamentos e eventos de que participe), desde que sem prejuízo das obrigações deste contrato, sem uso indevido da marca Smart Dent e observada a Cláusula 7.

---

### CLÁUSULA 4 – OBRIGAÇÕES DA MMTECH

Compete à MMTECH:

4.1. Responsabilizar-se por quaisquer reivindicações, reclamações ou representações que digam respeito à origem ou qualidade dos produtos por ela industrializados, desde que o fato ocorra dentro do prazo de garantia.

4.2. Dar ao KOL todos os elementos necessários para que o mesmo possa cumprir fielmente o presente Contrato de Cooperação.

4.3. Responder perante os compradores pela qualidade dos produtos vendidos.

4.4. Disponibilizar ao KOL o Portal do KOL, que funciona também como **Portal de Transparência** (Cláusula 5.6), com acesso a: informações do contrato, tabela de comissionamento, lista de indicações e conversões, comissões mês a mês, cursos, equipamentos e eventos.

4.5. Fornecer ou ceder ao KOL o uso de produtos para demonstrações clínicas e produção de conteúdo, na forma da Cláusula 8 e do Anexo II, e prestar suporte técnico e materiais promocionais para as ações de marketing do KOL previstas neste contrato.

4.6. Convidar o KOL, quando conveniente à MMTECH, para eventos nacionais e internacionais patrocinados pela MMTECH, nos termos da Cláusula 6.

4.7. Dar destaque ao nome e à imagem do KOL em campanhas de marketing e eventos, incluindo mídias digitais no Brasil e no exterior, nos limites e condições do Anexo III.

4.8. Divulgar o ecossistema profissional do KOL (plataforma de cursos, treinamentos e eventos de que ele participe), nos canais e formatos que a MMTECH entender adequados e mediante aprovação, na forma das Cláusulas 6 e 7.

4.9. **Desconto especial.** Durante a vigência deste contrato, o KOL terá direito a {{contrato.desconto_insumos_pct}}% ({{contrato.desconto_insumos_pct_extenso}} por cento) de desconto sobre o valor de tabela para compras de insumos da marca SMART DENT, para uso próprio em sua atividade profissional, sendo vedada a revenda. O desconto cessa com o encerramento do contrato e não se acumula com outras promoções, salvo autorização da MMTECH. Compras feitas pelo próprio KOL com este desconto não geram comissão.

---

### CLÁUSULA 5 – PORTAL DO KOL (PORTAL DE TRANSPARÊNCIA) E ACEITE ELETRÔNICO

5.1. O acesso ao Portal do KOL é feito exclusivamente pelo telefone celular/WhatsApp cadastrado, constante do preâmbulo, que funciona como credencial pessoal e intransferível do KOL.

5.2. O KOL é responsável por manter o número cadastrado sob seu controle, por comunicar de imediato à MMTECH qualquer perda, troca ou uso indevido do número, e por todos os atos praticados no Portal por meio dele.

5.3. A MMTECH poderá bloquear temporariamente o acesso após tentativas incorretas, comunicará ao KOL por WhatsApp o acesso a partir de novo aparelho ou endereço, e poderá desbloquear o acesso a pedido do KOL.

5.4. As partes reconhecem como válido e suficiente, para todos os fins, o aceite eletrônico deste contrato, de seus anexos e aditivos realizado no Portal do KOL, dispensada assinatura manuscrita ou certificado digital, nos termos do art. 10, §2º da Medida Provisória nº 2.200-2/2001. O registro do aceite (data e hora, endereço IP, aparelho, código de integridade do texto aceito e celular utilizado) constitui prova do consentimento e integra este contrato.

5.5. Enquanto o contrato não for aceito, o Portal permanece limitado à leitura e aprovação do texto proposto. Os demais recursos são liberados após o aceite.

5.6. **Portal de Transparência.** O Portal do KOL é o canal de transparência da relação entre as partes. Após o aceite, o KOL pode consultar nele, a qualquer momento e sem custo:

a) o contrato aceito, seus anexos e aditivos, com data, hora e versão do aceite;

b) a Tabela de Comissionamento vigente e o histórico de suas alterações;

c) cada indicação registrada (data, canal, cliente indicado em dados mínimos e situação) e cada venda atribuída, com o motivo da atribuição (grupo de WhatsApp, formulário ou cupom);

d) o extrato mensal de comissões, com valor bruto da venda, desconto, base de cálculo, percentual, valor da comissão, situação (a receber, aprovada, paga, estornada) e datas previstas e efetivas de pagamento;

e) os estornos, compensações e ajustes, com o motivo;

f) o histórico de eventos, palestras, estande e treinamentos, com as horas registradas;

g) os cursos cadastrados e sua situação de análise e publicação;

h) os equipamentos em comodato, com datas de liberação e de devolução;

i) a medição de sua atividade (indicações, leads, vendas, uso de cupom e conteúdos verificados no mês) e o acompanhamento de qualquer aviso de inatividade;

j) o registro das principais ações feitas em seu nome no sistema (aceites, aprovações, avisos e comunicações), em linha do tempo.

5.6.1. O KOL poderá contestar, pelo próprio Portal ou pelo vendedor responsável, qualquer atribuição, valor ou registro que considere incorreto, em até 30 (trinta) dias da data em que o item ficou visível no Portal. A MMTECH responderá pelo Portal e a resposta ficará registrada. A contestação não impede a continuidade do pagamento das parcelas não contestadas.

5.6.2. Os dados exibidos referem-se ao próprio KOL. Dados pessoais de clientes indicados são limitados ao mínimo necessário, nos termos da Cláusula 10.

---

### CLÁUSULA 6 – PALESTRAS, PRESENÇA EM ESTANDE E TREINAMENTOS

6.1. A MMTECH poderá convidar o KOL, pelo sistema, para participar de eventos como palestrante e/ou como apoio no estande da MMTECH. O convite fica disponível no Portal do KOL, que o poderá aceitar ou recusar.

6.2. Aceito o convite, o KOL escolhe os horários de palestra e de presença no estande diretamente na agenda do evento, respeitados os intervalos e limites definidos pela MMTECH. As horas efetivamente realizadas são registradas no histórico do KOL.

6.3. O KOL poderá cancelar ou ajustar horários pela agenda. Cancelamentos de última hora, que prejudiquem a programação do evento, deverão ser comunicados diretamente à equipe da MMTECH.

6.4. {{contrato.eventos_remuneracao_texto}}

6.5. A participação do KOL em treinamentos da MMTECH (Smart Dent Academy e demais) como instrutor, quando houver, será registrada no histórico do KOL, com as horas dedicadas, e seguirá as condições ajustadas por escrito para cada treinamento.

---

### CLÁUSULA 7 – CURSOS DO KOL

7.1. O KOL poderá cadastrar, pelo Portal do KOL, cursos próprios para divulgação na plataforma da MMTECH. O curso cadastrado fica em rascunho, é enviado para análise e somente é publicado após aprovação da MMTECH, que poderá devolver ou recusar o conteúdo.

7.2. O KOL é o único responsável pelo conteúdo, pela execução, pelo preço, pelas vagas, pela entrega do certificado e pelo atendimento aos alunos de seus cursos, e declara possuir os direitos sobre o material utilizado, isentando a MMTECH de reclamações de terceiros a esse respeito.

7.3. A MMTECH não é parte da relação entre o KOL e seus alunos, salvo quando o curso for expressamente promovido como treinamento da MMTECH.

7.4. O número de inscritos exibido no curso é controlado pelo sistema da MMTECH e não pode ser alterado pelo KOL.

7.5. O KOL autoriza a exibição, no card do curso, de seu nome, foto, minicurrículo e redes sociais, nos limites do Anexo III. O uso da marca Smart Dent em materiais do curso depende de aprovação prévia da MMTECH.

---

### CLÁUSULA 8 – EQUIPAMENTOS EM COMODATO
{{#if equipamentos}}

8.1. A MMTECH entrega ao KOL, em comodato (empréstimo gratuito, arts. 579 a 585 do Código Civil), os equipamentos de apoio relacionados no **Anexo II**, com indicação de modelo, número de série, valor, data de liberação e data prevista de devolução.

8.2. Os equipamentos permanecem de propriedade exclusiva da MMTECH. O KOL os utilizará somente para as atividades deste contrato (demonstrações, aulas, palestras e atendimento a clientes indicados), não podendo emprestá-los, cedê-los, alugá-los, dá-los em garantia, deslocá-los para fora do endereço informado sem aviso, ou permitir reparo por terceiros não autorizados.

8.3. O KOL zelará pela guarda e conservação dos equipamentos como se seus fossem, arcando com despesas de uso e conservação ordinárias. O uso de acessórios, consumíveis e softwares segue as orientações da MMTECH.

8.4. Em caso de perda, furto, roubo, dano ou uso indevido, o KOL comunicará a MMTECH imediatamente e responderá pelo valor de reposição constante do Anexo II, ou pelo custo do reparo, quando houver dano reparável, salvo desgaste natural de uso.

8.5. O KOL devolverá os equipamentos, em bom estado e com todos os acessórios, na data prevista no Anexo II, no prazo de 15 (quinze) dias após notificação da MMTECH, inclusive a notificação por inatividade da Cláusula 13.5, ou no encerramento deste contrato, o que ocorrer primeiro. A devolução será registrada no sistema com data e condição do equipamento.

8.6. Em caso de atraso na devolução, o KOL pagará à MMTECH, a título de aluguel-pena (art. 582 do Código Civil), valor mensal arbitrado pela MMTECH, não superior a {{contrato.comodato_aluguel_pena_pct_mes}}% do valor do equipamento por mês de atraso, sem prejuízo das perdas e danos e da reintegração de posse.

8.7. Equipamentos incluídos após a assinatura deste contrato serão formalizados por Termo de Comodato complementar (aditivo), com novo aceite eletrônico do KOL, passando a integrar o Anexo II.
{{else}}

8.1. Este contrato não prevê, na data do aceite, equipamentos em comodato. Se a MMTECH vier a entregar equipamentos ao KOL, isso será formalizado por Termo de Comodato complementar, com aceite eletrônico do KOL, nos termos dos arts. 579 a 585 do Código Civil.
{{/if}}

---

### CLÁUSULA 9 – IMAGEM, VOZ E NOME

9.1. O KOL autoriza a MMTECH a captar e utilizar sua imagem, voz e nome nas condições, finalidades e limites do **Termo de Autorização de Uso de Imagem, Voz e Nome (Anexo III)**, que integra este contrato.

9.2. A autorização do Anexo III segue o regime próprio de vigência e revogação ali previsto, e não se confunde com a vigência deste contrato.

---

### CLÁUSULA 10 – CONFIDENCIALIDADE, DADOS PESSOAIS E CONDUTA

10.1. As partes se comprometem a manter sigilo absoluto sobre informações comerciais, estratégicas e técnicas obtidas durante a vigência do contrato. Em especial, o KOL manterá sigilo sobre informações comerciais, técnicas, preços, condições, listas de clientes e estratégias da MMTECH a que tiver acesso, durante o contrato e por 2 (dois) anos após seu término, usando-as somente para as finalidades deste contrato.

10.2. Os dados de clientes e leads indicados serão tratados por ambas as partes conforme a Lei nº 13.709/2018 (LGPD), para as finalidades de atendimento, venda, apuração de comissão e cumprimento deste contrato. O KOL não usará esses dados para finalidade própria diversa nem os compartilhará com terceiros.

10.3. Os dados pessoais do KOL (identificação, contato, dados de pagamento, histórico de atividades e dados de acesso ao Portal) serão tratados pela MMTECH para execução do contrato, cumprimento de obrigações legais e exercício regular de direitos. O KOL pode exercer seus direitos de titular pelo e-mail contato@smartdent.com.br.

10.4. As partes repudiam qualquer pagamento, oferta ou vantagem indevida a agentes públicos ou privados para obtenção de negócios, e cumprirão a legislação anticorrupção aplicável.

---

### CLÁUSULA 11 – NATUREZA DA RELAÇÃO

11.1. O fato de o KOL prestar colaboração excepcional a pedido da MMTECH ou espontaneamente, realizando atividades diversas, incluindo mas não se limitando a assistência a clientes, acompanhamento de entregas, recolocação de mercadorias, relatórios mensais, não descaracteriza a relação de Cooperação Comercial em outra atividade, nem enseja o pagamento de qualquer indenização adicional.

11.2. Este contrato não cria vínculo empregatício, societário ou de representação entre as partes. O KOL atua com autonomia, sem subordinação, exclusividade, jornada ou controle de horário, e responde por seus próprios tributos, encargos e despesas.

---

### CLÁUSULA 12 – VIGÊNCIA

12.1. O presente contrato é firmado por prazo indeterminado, passando a vigorar a partir da data do aceite eletrônico, podendo ser rescindido por qualquer das partes.

---

### CLÁUSULA 13 – RESCISÃO

13.1. O presente contrato poderá ser rescindido por qualquer uma das partes, mediante notificação à outra, por escrito, com prazo mínimo de 30 (trinta) dias de antecedência.

13.2. O contrato poderá ser rescindido em caso de violação de quaisquer das cláusulas deste contrato, pela parte prejudicada, mediante denúncia imediata, sem prejuízo de eventual indenização cabível.

13.3. Qualquer tolerância das partes quanto ao descumprimento das cláusulas do presente contrato constituirá mera liberalidade, não configurando renúncia ou novação do contrato ou de suas cláusulas, que poderão ser exigidos a qualquer tempo.

13.4. Encerrado o contrato: (a) o acesso do KOL ao Portal passa a modo somente leitura de extratos; (b) as comissões de vendas atribuídas antes do encerramento e ainda não pagas continuam devidas, nos prazos da Cláusula 2; (c) os equipamentos em comodato serão devolvidos nos termos da Cláusula 8; (d) cursos publicados poderão ser despublicados pela MMTECH, respeitadas as turmas já abertas; e (e) o uso de imagem, voz e nome segue o Anexo III.

13.5. **Rescisão por inatividade.** Se, durante {{contrato.periodo_inatividade_dias}} dias consecutivos, o KOL não realizar nenhuma das atividades abaixo, a MMTECH poderá rescindir este contrato e solicitar a devolução dos equipamentos em comodato, se houver, mediante **aviso prévio por escrito de 15 (quinze) dias**, que prevalece, neste caso, sobre o prazo de 30 dias do item 13.1:

a) indicar clientes pelos canais da Cláusula 3.1;
b) gerar leads (por grupo de WhatsApp, formulário de indicação ou cupom);
c) realizar vendas atribuídas ao KOL; ou
d) divulgar cupons de desconto de sua titularidade, comprovadamente (conteúdo verificado ou uso registrado do cupom).

13.5.1. Também poderá ser aplicado o aviso de 15 dias quando o KOL deixar de publicar o conteúdo mínimo da Cláusula 3.9 por {{contrato.meses_sem_conteudo}} meses consecutivos.

13.5.2. O aviso será enviado pelo Portal do KOL, pelo WhatsApp e pelo e-mail cadastrados, e conta a partir do dia do envio. A atividade qualificada registrada pelo KOL dentro do prazo do aviso não impede a rescisão, que poderá ser mantida ou cancelada a critério da MMTECH. Findo o prazo, os equipamentos deverão estar devolvidos nos termos da Cláusula 8, e o Portal passa ao modo somente leitura (13.4).

13.5.3. A apuração da atividade é feita pelo sistema da MMTECH, que registra indicações, leads, vendas, uso de cupom e conteúdos, e cujos dados o KOL poderá consultar no Portal.

---

### CLÁUSULA 14 – CONDIÇÕES GERAIS

14.1. Os casos omissos serão resolvidos pelo Código Civil e pelos princípios gerais do direito, julgando-se as controvérsias que surgirem através da Justiça Comum, para o que as partes contratantes elegem o foro desta Comarca de São Carlos-SP, para dirimir as questões oriundas deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.

14.2. As comunicações entre as partes poderão ser feitas pelo Portal do KOL, pelo WhatsApp e pelo e-mail cadastrados, considerando-se válidas as enviadas para os contatos constantes do preâmbulo, até comunicação de alteração.

14.3. Este contrato substitui qualquer ajuste anterior sobre o mesmo objeto. Seus anexos e aditivos aceitos eletronicamente fazem parte dele.

---

### ACEITE ELETRÔNICO

Local: São Carlos/SP    Data e hora do aceite: {{aceite.data_hora}}

**KOL:** {{kol.nome_legal}} – {{kol.documento}} – celular {{kol.celular_formatado}} – IP {{aceite.ip}} – aparelho {{aceite.aparelho}}

**MMTECH:** MMTECH PROJETOS TECNOLOGICOS IMPORTAÇÃO E EXPORTAÇÃO LTDA. – CNPJ 10.736.894/0001-36 – por seu sócio administrador MARCELO DEL GUERRA

Código de integridade do texto aceito (SHA-256): {{aceite.hash}}

Versão do modelo: {{contrato.versao_modelo}}   Contrato nº {{contrato.numero}}

---

## ANEXO I – TABELA DE COMISSIONAMENTO

Tabela de comissionamento do cadastro do profissional no sistema da MMTECH (aba Comissão do editor de profissionais), aceita pelo KOL em {{comissao.aceita_em}} (versão {{comissao.versao}}). Cada regra vale a partir da data indicada.

| Produto / categoria | Subcategoria | Comissão (%) | Vigência a partir de |
|---|---|---|---|
{{#each comissao.regras}}
| {{produto_ou_categoria}} | {{subcategoria}} | {{percent}}% | {{active_from}} |
{{/each}}

**Meios de rastreio (Cláusulas 2.2 e 3.1):**

Vendedor responsável: {{vendedor.nome}}{{#if vendedor.celular}} – {{vendedor.celular}}{{/if}}
{{#if grupo}}Grupo de WhatsApp do KOL: {{grupo.nome}}{{/if}}
{{#if cupons}}Cupons de benefício no e-commerce: {{#each cupons}}{{code}} (benefício ao cliente: {{beneficio}}; comissão do KOL {{commission_percent}}%; válido de {{valid_from}} a {{valid_until}}) {{/each}}{{/if}}
{{#if formularios}}Formulários de indicação: {{#each formularios}}{{name}} ({{url}}) {{/each}}{{/if}}
{{#if link_indicacao}}Link de indicação: {{link_indicacao}}{{/if}}

Produto ou categoria sem regra nesta tabela não gera comissão, até que seja incluído por aditivo (Cláusula 2.11).

Base de cálculo: valor das mercadorias da venda atribuída, **já descontado o desconto concedido ao cliente** (cupom ou qualquer abatimento), excluídos frete e impostos não incidentes sobre a mercadoria, conforme Cláusula 2.

---

{{#if equipamentos}}
## ANEXO II – EQUIPAMENTOS EM COMODATO

| Item | Portfólio / modelo | Nº de série | Valor de reposição (R$) | Data de liberação | Devolução prevista | Condição na entrega |
|---|---|---|---|---|---|---|
{{#each equipamentos}}
| {{n}} | {{produto_nome}} ({{produto_sku}}) | {{serial_number}} | {{value_brl}} | {{released_at}} | {{return_due_at}} | {{condicao_entrega}} |
{{/each}}

Local de guarda e uso: {{kol.endereco_completo}}.

Valor total dos equipamentos: R$ {{equipamentos.total_value}}.

Devolução efetiva (preenchida pelo sistema na devolução): data {{returned_at}}, condição {{condicao_devolucao}}.
{{/if}}

---

## ANEXO III – TERMO DE AUTORIZAÇÃO DE USO DE IMAGEM, VOZ E NOME

Este termo estabelece as condições de captação e uso de imagem, voz e nome do(a) AUTORIZANTE nas atividades e nos materiais de comunicação da Smart Dent descritos abaixo.

**1. Identificação das partes**

EMPRESA AUTORIZADA: MMTech Projetos Tecnológicos Importação e Exportação Ltda., identificada neste termo como SMART DENT.
CNPJ: 10.736.894/0001-36
Endereço: Rua Doutor Procópio de Toledo Malta, 62, Morada dos Deuses, São Carlos/SP, CEP 13562-291.
Telefone e WhatsApp: (16) 3415-0530
Canal para solicitações e revogação: contato@smartdent.com.br

AUTORIZANTE: {{kol.nome}} {{#if PJ}}(sócio(a) administrador(a) de {{kol.razao_social}}){{/if}}
CPF: {{kol.documento_pessoa_fisica}}    CRO: {{kol.cro}}    Função: Key Opinion Leader (KOL) da Smart Dent
Data de início do vínculo: {{contrato.data_aceite}}

**2. Objeto e abrangência**

Autorizo, de forma livre, informada e gratuita, a SMART DENT a captar e utilizar minha imagem, voz e nome em fotografias, vídeos, áudios, entrevistas e depoimentos relacionados às suas atividades profissionais e institucionais.

A captação abrange feiras, congressos, eventos, treinamentos, demonstrações de produtos, visitas a clientes, reuniões, entrevistas e transmissões vinculados à SMART DENT, durante meu vínculo profissional, a partir da assinatura deste termo.

Registros anteriores abrangidos por esta autorização, se houver, deverão ser identificados por evento, data ou material no campo abaixo. Se o campo permanecer em branco, registros anteriores não estarão incluídos.

Registros anteriores incluídos: {{imagem.registros_anteriores}}

**3. Finalidades e meios de divulgação**

Os registros poderão ser utilizados para apresentar a empresa e sua equipe, divulgar seus produtos, serviços e eventos, promover ações comerciais e publicitárias e produzir conteúdos educacionais e treinamentos, inclusive da Smart Dent Academy.

A divulgação poderá ocorrer em sites, redes sociais, plataformas de vídeo, anúncios, catálogos, apresentações, cursos, materiais impressos e comunicações com clientes, distribuidores e parceiros, no Brasil e no exterior, observada a legislação aplicável. Também fica autorizado o uso do nome, da foto e do minicurrículo do KOL (a) na página pública de profissionais e nos cards de cursos e eventos da Smart Dent, e (b) em cupons, formulários e links de indicação que levem seu nome. Anúncios pagos que apareçam como se publicados pelo perfil do KOL dependem de aprovação específica e prévia do KOL, por escrito ou pelo Portal.

**4. Edição e limites de uso**

São permitidos cortes, legendas, traduções, ajustes de imagem e som, adaptações de formato e inclusão de elementos gráficos, desde que preservados o sentido das declarações, a dignidade, a honra e a reputação do(a) autorizante. Não são autorizadas alterações que simulem falas ou condutas não realizadas, nem o uso para finalidades diferentes das descritas neste termo.

**5. Gratuidade e liberdade de escolha**

Esta autorização é gratuita e não prevê pagamento específico, royalties ou participação financeira pelo uso dos registros dentro dos limites aqui definidos. Não representa renúncia a direitos ou a eventual reparação por uso indevido. A recusa ou revogação não poderá resultar em penalidade ou prejuízo ao vínculo profissional. A gratuidade diz respeito ao uso de imagem, voz e nome e não afeta as comissões devidas ao KOL pelo contrato principal.

**6. Vigência e encerramento do vínculo**

A autorização entra em vigor na data da assinatura e permanece válida até sua revogação. O encerramento do vínculo profissional impede novas captações com base neste termo, mas não encerra automaticamente a autorização de uso dos registros obtidos durante o vínculo, que continuará sujeita às finalidades, aos limites e ao direito de revogação aqui previstos.

**7. Dados pessoais e revogação**

A SMART DENT tratará a imagem, a voz e o nome para as finalidades descritas neste termo e os dados de identificação e assinatura para registrar e comprovar a autorização. CPF e assinatura não serão divulgados em materiais publicitários.

Os registros poderão ser compartilhados com prestadores responsáveis pela produção, edição e divulgação dos conteúdos, sob orientação da SMART DENT, e com as plataformas utilizadas para publicação. O acesso deverá se limitar ao necessário para essas atividades, com medidas de proteção dos dados e observância da Lei nº 13.709/2018, a Lei Geral de Proteção de Dados Pessoais.

O(A) autorizante poderá revogar o consentimento a qualquer momento, gratuitamente, mediante solicitação expressa ao canal informado na identificação da empresa, e exercer os direitos previstos na legislação, incluindo acesso, correção e eliminação, quando aplicáveis.

Recebida a revogação, a SMART DENT interromperá novos usos baseados neste consentimento e providenciará a retirada dos conteúdos dos canais sob seu controle, em até {{imagem.prazo_retirada_dias}} dias, observadas as hipóteses legais de conservação. A revogação não torna ilícitos os usos anteriores regularmente realizados. A empresa não poderá garantir a retirada de cópias já distribuídas ou republicadas por terceiros fora de seu controle, mas adotará as medidas cabíveis ao seu alcance.

Os registros serão conservados enquanto necessários às finalidades autorizadas. A comprovação da autorização e outros dados poderão ser mantidos pelo período necessário ao cumprimento de obrigações legais ou ao exercício regular de direitos, sem justificar novas publicações após a revogação.

**8. Declaração**

Declaro que li e compreendi este termo, tive oportunidade de esclarecer dúvidas e concordo livremente com as condições de uso da minha imagem, voz e nome. Receberei uma cópia do documento aceito. *(Aceite em caixa de seleção própria, separada do contrato principal. O aceite do contrato não é condicionado ao aceite deste termo.)*

---

## RESUMO DO CONTRATO (informativo)

*Este resumo facilita a leitura e não substitui as cláusulas. Em caso de dúvida, vale o texto das cláusulas e dos anexos.*

### O que a Smart Dent (MMTECH) oferece

- **Comissão** sobre as vendas atribuídas às suas indicações, conforme a tabela do Anexo I, calculada sobre o valor das mercadorias já descontado o desconto do cliente (Cláusulas 2 e 2.6.1).
- **Pagamento mensal:** apuração mensal, extrato com cada venda no Portal, e pagamento até o 20º dia do mês seguinte à aprovação e ao envio da nota fiscal (Cláusulas 2.7 a 2.9).
- **Canais de indicação prontos:** grupo de WhatsApp com o vendedor responsável, formulários gerados pelo sistema e cupons de benefício no e-commerce (Cláusula 3.1).
- **Portal de Transparência**, com acesso pelo celular cadastrado: contrato aceito, tabela de comissão, cada indicação e venda atribuída, extrato mensal (bruto, desconto, base, percentual e comissão), estornos, eventos e horas, cursos, equipamentos, medição de atividade e linha do tempo das ações. O KOL pode contestar qualquer registro em até 30 dias (Cláusulas 4.4, 5.6 e 5.6.1).
- **Desconto especial de {{contrato.desconto_insumos_pct}}%** sobre o valor de tabela em insumos SMART DENT, para uso próprio, durante o contrato (Cláusula 4.9).
- **Produtos para demonstração e conteúdo, suporte técnico e materiais promocionais** (Cláusula 4.5).
- **Destaque do seu nome e imagem** em campanhas e eventos no Brasil e no exterior, e divulgação do seu ecossistema profissional (Cláusulas 4.7 e 4.8).
- **Convites para eventos** como palestrante e/ou no estande, com agenda própria e registro das suas horas (Cláusula 6).
- **Divulgação dos seus cursos** na plataforma da MMTECH, após aprovação (Cláusula 7).
- **Equipamentos em comodato** (empréstimo gratuito), quando houver, listados no Anexo II (Cláusula 8).
- **Suporte comercial e produtos:** a MMTECH dá os elementos necessários ao trabalho, responde pela qualidade e origem dos produtos e atende os clientes indicados (Cláusula 4).
- **Liberdade contratual:** relação sem exclusividade e sem vínculo empregatício (Cláusula 11).

### O que a Smart Dent (MMTECH) espera do KOL

- **Indicar clientes** por um dos canais oficiais, apenas de pessoas que autorizaram o contato (Cláusulas 3.1 e 3.1.2).
- **Seguir as orientações da MMTECH:** não conceder descontos ou prazos por conta própria (Cláusula 3.7) e respeitar a regra de publicidade e conduta (Cláusulas 3.8 e 10).
- **Influência de mercado:** participar de ações de brand awareness e usar suas redes e canais digitais para educar, engajar e converter leads e clientes (Cláusula 3.10).
- **Publicar conteúdo:** no mínimo {{contrato.conteudo_minimo_mes}} conteúdos por mês nas redes sociais marcando a SmartDent, informando o link no Portal (Cláusula 3.9).
- **Manter atividade:** indicar, gerar leads, vender ou divulgar cupom. A falta de atividade por {{contrato.periodo_inatividade_dias}} dias permite rescisão com aviso de 15 dias (Cláusula 13.5).
- **Cuidar dos equipamentos** e devolvê-los em 15 dias após notificação ou no fim do contrato (Cláusula 8).
- **Cumprir os eventos** que aceitar e avisar a equipe em caso de cancelamento de última hora (Cláusula 6).
- **Proteger dados e confidencialidade**, conforme a LGPD (Cláusula 10).

### O que o KOL oferece

- **Indicações qualificadas** de clientes e a divulgação dos produtos e soluções da MMTECH à sua audiência.
- **Presença e autoridade:** palestras, atuação no estande e treinamentos, com horas registradas.
- **Conteúdo mensal** em redes sociais com a marca SmartDent.
- **Uso de imagem, voz e nome** nos limites do Anexo III.
- **Cursos próprios** que ampliam a oferta educacional da plataforma, sob sua responsabilidade (Cláusula 7).

### O que o KOL espera da Smart Dent (MMTECH)

- **Comissão justa e transparente:** regras do Anexo I, sem retroação de mudanças, extrato mensal no Portal de Transparência e pagamento no prazo, com direito de contestar (Cláusulas 2.6 a 2.11 e 5.6).
- **Atribuição correta** das suas indicações, com histórico registrado no sistema como prova (Cláusulas 2.2 e 3.1.4).
- **Atendimento comercial** pelo vendedor responsável, ponto único de contato (Cláusula 3.1.3).
- **Produtos de qualidade** e responsabilidade da MMTECH pela origem e garantia (Cláusula 4).
- **Dados pessoais e imagem protegidos**, usados somente nos limites combinados (Cláusulas 9 e 10 e Anexo III).
- **Aviso prévio** para rescisão (30 dias; 15 dias na rescisão por inatividade) e comissões já geradas mantidas após o encerramento (Cláusula 13).
- **Clareza no uso dos equipamentos** e respeito à agenda e às regras dos eventos e dos cursos (Cláusulas 6, 7 e 8).
$kol$, true)
ON CONFLICT (version) DO UPDATE SET body_md = EXCLUDED.body_md, active = true, updated_at = now();