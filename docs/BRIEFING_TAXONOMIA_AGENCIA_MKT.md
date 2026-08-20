# Briefing — Taxonomia SmartDent para a Plataforma da Agência de MKT

**Objetivo**: cadastrar na plataforma da agência a árvore oficial de **Categorias e Subcategorias** da SmartDent 3D, alinhada ao fluxo de 7 etapas da odontologia digital e ao Workflow Portfolio 7×3 do CRM.

**Fontes de verdade** (consultadas em 20/08/2026):
- **Sistema A** — `products_repository` (123 produtos ativos) + `categories_config`
- **Sistema B** — `system_a_catalog` (156 itens comerciais: `product`, `resin`, `Resinas`, `consumables`, `Serviços`)
- **Workflow Portfolio 7×3** — 25 células canônicas (`workflow_stage_target`)

**Escopo deste briefing**: apenas categorias e subcategorias. Produtos individuais **não** entram nesta rodada.

**Nomenclatura**: híbrida — a **etapa do fluxo** é a categoria-pai (linguagem do CRM/comercial) e o **nome comercial** é a subcategoria (linguagem do cliente e do anúncio).

---

## 1. Por que a estrutura é essa

A SmartDent não vende produtos avulsos: vende um **fluxo digital completo**. Cada cliente entra por uma etapa e é ampliado nas demais. A taxonomia de marketing precisa espelhar essa jornada, porque:

1. **Cada etapa é um estágio de maturidade digital do cliente.** Quem está na Etapa 1 (só escaneia) é público de Etapa 2 e 3. Quem já imprime (Etapa 3) é público de Etapa 4, 5 e 7.
2. **O CRM já classifica o lead nessas 7 etapas.** Toda célula do Workflow Portfolio marca se o lead tem produto SmartDent (`ativo`), produto concorrente (`conc`), interesse declarado (`sdr`) ou mapeamento (`mapeamento`). Se a agência usar a mesma taxonomia, campanha e pipeline falam a mesma língua sem tradução.
3. **A cauda de receita está nas etapas 4, 5 e 7** (consumo recorrente: resinas, caracterização, cimentos, blocos), enquanto as etapas 1 e 3 são as de ticket alto e ciclo longo (scanner, impressora). Separar isso na plataforma é o que permite orçamento e criativo distintos.

---

## 2. Árvore oficial — 7 categorias-pai + 35 subcategorias

Legenda da coluna **Prod.**: nº de produtos ativos hoje na base. `0` = subcategoria estrutural (existe no fluxo e/ou já configurada no Sistema A, ainda sem SKU ativo) — **deve ser criada mesmo assim**, para não reabrir a árvore depois.

### 1. Captura Digital · Scanners 3D  `slug: captura-digital`
| # | Subcategoria | Slug | Célula CRM (`workflow_stage_target`) | Prod. |
|---|---|---|---|---|
| 1.1 | Scanner Intraoral (IOS) | `scanner-intraoral-ios` | `1_captura_digital__scanner_intraoral` | 5 |
| 1.2 | Scanner de Bancada (DSS) | `scanner-bancada-dss` | `1_captura_digital__scanner_bancada` | 2 |
| 1.3 | Notebook / Workstation | `notebook-workstation` | `1_captura_digital__notebook` | 0 |
| 1.4 | Acessórios de Scanner | `acessorios-scanner` | `1_captura_digital__acessorios` | 2 |
| 1.5 | Peças e Partes | `pecas-partes-scanner` | `1_captura_digital__pecas_e_partes` | 0 |

### 2. CAD · Softwares de Projeto  `slug: cad-softwares`
| # | Subcategoria | Slug | Célula CRM | Prod. |
|---|---|---|---|---|
| 2.1 | Software CAD (exocad DentalCAD / exoplan) | `software-cad` | `2_cad__software` | 3 |
| 2.2 | Créditos de IA (exocad) | `creditos-ia` | `2_cad__credito_ia` | 1 |
| 2.3 | Serviço de Projetos CAD (terceirização) | `servico-cad` | `2_cad__servicos` | 1 |

### 3. Impressão 3D · Impressoras e Resinas  `slug: impressao-3d`
| # | Subcategoria | Slug | Célula CRM | Prod. |
|---|---|---|---|---|
| 3.1 | Resinas 3D — Biocompatíveis | `resinas-3d-biocompativeis` | `3_impressao__resinas` | 5 |
| 3.2 | Resinas 3D — Uso Geral | `resinas-3d-uso-geral` | `3_impressao__resinas` | 9 |
| 3.3 | Software CAM / Slicer | `software-cam-slicer` | `3_impressao__software` | 2 |
| 3.4 | Impressora 3D Odontológica | `impressora-3d-odontologica` | `3_impressao__impressora_3d` | 4 |
| 3.5 | Impressora 3D Desktop | `impressora-3d-desktop` | `3_impressao__impressora_3d` | 1 |
| 3.6 | Acessórios de Impressão | `acessorios-impressao` | `3_impressao__acessorios` | 1 |
| 3.7 | Peças e Partes | `pecas-partes-impressao` | `3_impressao__pecas_e_partes` | 0 |

### 4. Pós-Impressão · Cura e Acabamento  `slug: pos-impressao`
| # | Subcategoria | Slug | Célula CRM | Prod. |
|---|---|---|---|---|
| 4.1 | Equipamentos de Cura | `equipamentos-cura` | `4_pos_impressao__equipamentos` | 4 |
| 4.2 | Limpeza e Acabamento | `limpeza-acabamento` | `4_pos_impressao__limpeza_e_acabamento` | 5 |

### 5. Finalização · Caracterização, Instalação e Dentística  `slug: finalizacao`
| # | Subcategoria | Slug | Célula CRM | Prod. |
|---|---|---|---|---|
| 5.1 | Caracterização SmartMake | `caracterizacao-smartmake` | `5_finalizacao__caracterizacao` | 18 |
| 5.2 | Caracterização SmartGum | `caracterizacao-smartgum` | `5_finalizacao__caracterizacao` | 9 |
| 5.3 | Instalação — Cimentos | `instalacao-cimentos` | `5_finalizacao__instalacao` | 13 |
| 5.4 | Instalação — Adesivos | `instalacao-adesivos` | `5_finalizacao__instalacao` | 1 |
| 5.5 | Dentística — Resinas Compostas | `dentistica-resinas-compostas` | `5_finalizacao__destistica_orto` | 32 |
| 5.6 | Ortodontia — Placas de Acetato | `ortodontia-placas-acetato` | `5_finalizacao__destistica_orto` | 0 |
| 5.7 | Equipamentos de Dentística | `equipamentos-dentistica` | `5_finalizacao__destistica_orto` | 0 |

### 6. Cursos · Educação  `slug: cursos`
| # | Subcategoria | Slug | Célula CRM | Prod. |
|---|---|---|---|---|
| 6.1 | Cursos Presenciais | `cursos-presencial` | `6_cursos__presencial` | 1 |
| 6.2 | Cursos Online | `cursos-online` | `6_cursos__online` | 1 |
| 6.3 | Cursos Gratuitos | `cursos-gratuitos` | `6_cursos__online` | 0 |

### 7. Fresagem · CAD/CAM Subtrativo  `slug: fresagem`
| # | Subcategoria | Slug | Célula CRM | Prod. |
|---|---|---|---|---|
| 7.1 | Fresadoras (Equipamentos) | `fresadoras` | `7_fresagem__equipamentos` | 0 |
| 7.2 | Software CAM de Fresagem | `software-fresagem` | `7_fresagem__softwares` | 0 |
| 7.3 | Serviços de Fresagem | `servicos-fresagem` | `7_fresagem__servicos` | 0 |
| 7.4 | Insumos — Cerômero (ATOS Block) | `insumos-ceromero` | `7_fresagem__acessorios` | 12 |
| 7.5 | Insumos — Zircônia | `insumos-zirconia` | `7_fresagem__acessorios` | 0 |
| 7.6 | Insumos — Dissilicato | `insumos-dissilicato` | `7_fresagem__acessorios` | 0 |
| 7.7 | Fresas | `fresas` | `7_fresagem__acessorios` | 0 |
| 7.8 | Peças e Partes | `pecas-partes-fresagem` | `7_fresagem__pecas_e_partes` | 0 |

### Transversal (não é etapa) · Soluções  `slug: solucoes`
| Subcategoria | Slug | Observação |
|---|---|---|
| Chair Side Print (combos) | `chair-side-print` | 3 combos que atravessam as etapas 1+2+3 (scanner + notebook + impressora). No catálogo de produtos são **agrupadores**, não SKUs. Na plataforma de MKT devem existir como **linha de solução/campanha**, e a atribuição de lead entra pela célula `1_captura_digital__scanner_intraoral`. |

---

## 3. Divergências encontradas entre as bases (normalizações aplicadas)

Estas são decisões de produto tomadas para esta árvore. Elas **não alteram** os bancos — servem para o cadastro na plataforma da agência.

| # | Divergência | Onde | Decisão adotada |
|---|---|---|---|
| 1 | Duas categorias numeradas “6.” no Sistema B: `6. Cursos` e `6. DENTÍSTICA, ESTÉTICA E ORTODONTIA` | Sistema B | Dentística vai para a **Etapa 5 (Finalização)**; Cursos permanece na **Etapa 6**. É o que o Workflow 7×3 já define. |
| 2 | `INSUMOS LABORATÓRIO` (Sistema A) × `7. Fresagem` (Sistema B) para o mesmo ATOS Block | A × B | Consolidado em **Etapa 7 — Fresagem**, subcategorias `7.4`–`7.7`. |
| 3 | `RESINAS 3D` é categoria-pai no Sistema A e subcategoria de `3. IMPRESSÃO 3D` no Sistema B | A × B | Fica como **subcategoria da Etapa 3**, dividida em Biocompatíveis / Uso Geral. |
| 4 | Elegoo Mars 5 Ultra classificada como “odontológica” no A e “desktop” no B | A × B | Mantida a separação do B: `3.4` odontológica (4) e `3.5` desktop (1). |
| 5 | Smart Slice / SmartSlicer I.A. aparecem ora em `2.1 SOFTWARE` (CAD) ora em `3.3 SOFTWARE` | Sistema B | Regra: **CAD → Etapa 2, CAM/Slicer → Etapa 3**. Slicers ficam em `3.3`. |
| 6 | Erro de digitação `SCANNER INTRAOAL (IOS)` (falta o “R”) | Sistema A | Cadastrar corrigido: **Scanner Intraoral (IOS)**. |
| 7 | Erro de digitação `SOLUÇÔES` (circunflexo) | Sistema A | Cadastrar corrigido: **Soluções**. |
| 8 | `5_finalizacao__destistica_orto` — a chave do CRM tem erro de digitação | Sistema B | A chave é **usada literalmente** em integração (não corrigir no banco). No rótulo visível ao público, escrever **Dentística/Ortodontia**. |
| 9 | `store_category` nulo em 99 de 123 produtos | Sistema A | Não usar `store_category` como fonte. A fonte é `category` + `subcategory`. |
| 10 | Fresagem não tem célula “insumos” nas 25 células do Workflow | Workflow 7×3 | Insumos (7.4–7.7) mapeiam para `7_fresagem__acessorios` até que uma célula própria exista. **Premissa a validar com o comercial.** |

---

## 4. Regras de ouro do cadastro

1. **Não inventar categoria ou subcategoria.** Só o que está na seção 2.
2. **Não excluir nem renomear** nada que já exista na plataforma sem apontar antes. Duplicata provável → registrar e perguntar.
3. **Criar também as subcategorias com 0 produtos.** Elas são estruturais.
4. **Acentuação e caixa exatamente como na tabela.** Slug sem acento, minúsculo, hifenizado.
5. **Hierarquia de 2 níveis.** Se a plataforma não suportar pai/filho, criar item único com prefixo: `1. Captura Digital > Scanner Intraoral (IOS)`.
6. **A célula CRM não é campo público.** Só preencher em campo interno/oculto (código, referência externa, tag interna). Se não houver campo assim, não inventar um — apenas reportar.
7. **Nada de preço, estoque ou produto** nesta rodada.

---

## 5. Prompt pronto para colar no Claude no Chrome

> Cole o bloco abaixo em uma aba já autenticada na plataforma da agência.

```
Você vai cadastrar a árvore oficial de categorias e subcategorias da SmartDent 3D
nesta plataforma. Trabalhe apenas nesta aba e apenas na área de categorias.

CONTEXTO
A SmartDent 3D vende o fluxo completo de odontologia digital, organizado em 7 etapas.
A categoria-pai é a etapa do fluxo; a subcategoria é o nome comercial do produto.

ANTES DE COMEÇAR
1. Localize a área de cadastro de categorias/taxonomia e me diga o caminho que encontrou.
2. Liste o que JÁ existe cadastrado, antes de criar qualquer coisa.
3. Verifique se a plataforma aceita hierarquia pai/filho. Se não aceitar, avise e use o
   formato de item único com prefixo: "1. Captura Digital > Scanner Intraoral (IOS)".
4. Só depois disso comece a criar.

REGRAS
- Crie SOMENTE o que está na lista abaixo. Não invente, não traduza, não abrevie.
- Não exclua nem renomeie nada existente. Se encontrar uma possível duplicata, pare de
  criar aquele item, registre e siga para o próximo.
- Crie também as subcategorias marcadas [0 produtos]. Elas são estruturais.
- Respeite acentuação e maiúsculas. O slug vai sem acento, minúsculo, com hífen.
- Se houver campo interno/oculto de código ou referência externa, preencha com a
  "célula CRM" indicada. Se não houver, ignore — não crie campo novo.
- Não cadastre produtos, preços ou estoque nesta tarefa.

ÁRVORE A CADASTRAR

1. Captura Digital · Scanners 3D  [slug: captura-digital]
   1.1 Scanner Intraoral (IOS)        | scanner-intraoral-ios   | CRM: 1_captura_digital__scanner_intraoral
   1.2 Scanner de Bancada (DSS)       | scanner-bancada-dss     | CRM: 1_captura_digital__scanner_bancada
   1.3 Notebook / Workstation  [0]    | notebook-workstation    | CRM: 1_captura_digital__notebook
   1.4 Acessórios de Scanner          | acessorios-scanner      | CRM: 1_captura_digital__acessorios
   1.5 Peças e Partes  [0]            | pecas-partes-scanner    | CRM: 1_captura_digital__pecas_e_partes

2. CAD · Softwares de Projeto  [slug: cad-softwares]
   2.1 Software CAD (exocad DentalCAD / exoplan) | software-cad | CRM: 2_cad__software
   2.2 Créditos de IA (exocad)                   | creditos-ia  | CRM: 2_cad__credito_ia
   2.3 Serviço de Projetos CAD (terceirização)   | servico-cad  | CRM: 2_cad__servicos

3. Impressão 3D · Impressoras e Resinas  [slug: impressao-3d]
   3.1 Resinas 3D — Biocompatíveis    | resinas-3d-biocompativeis  | CRM: 3_impressao__resinas
   3.2 Resinas 3D — Uso Geral         | resinas-3d-uso-geral       | CRM: 3_impressao__resinas
   3.3 Software CAM / Slicer          | software-cam-slicer        | CRM: 3_impressao__software
   3.4 Impressora 3D Odontológica     | impressora-3d-odontologica | CRM: 3_impressao__impressora_3d
   3.5 Impressora 3D Desktop          | impressora-3d-desktop      | CRM: 3_impressao__impressora_3d
   3.6 Acessórios de Impressão        | acessorios-impressao       | CRM: 3_impressao__acessorios
   3.7 Peças e Partes  [0]            | pecas-partes-impressao     | CRM: 3_impressao__pecas_e_partes

4. Pós-Impressão · Cura e Acabamento  [slug: pos-impressao]
   4.1 Equipamentos de Cura           | equipamentos-cura     | CRM: 4_pos_impressao__equipamentos
   4.2 Limpeza e Acabamento           | limpeza-acabamento    | CRM: 4_pos_impressao__limpeza_e_acabamento

5. Finalização · Caracterização, Instalação e Dentística  [slug: finalizacao]
   5.1 Caracterização SmartMake       | caracterizacao-smartmake     | CRM: 5_finalizacao__caracterizacao
   5.2 Caracterização SmartGum        | caracterizacao-smartgum      | CRM: 5_finalizacao__caracterizacao
   5.3 Instalação — Cimentos          | instalacao-cimentos          | CRM: 5_finalizacao__instalacao
   5.4 Instalação — Adesivos          | instalacao-adesivos          | CRM: 5_finalizacao__instalacao
   5.5 Dentística — Resinas Compostas | dentistica-resinas-compostas | CRM: 5_finalizacao__destistica_orto
   5.6 Ortodontia — Placas de Acetato [0] | ortodontia-placas-acetato | CRM: 5_finalizacao__destistica_orto
   5.7 Equipamentos de Dentística [0] | equipamentos-dentistica      | CRM: 5_finalizacao__destistica_orto

6. Cursos · Educação  [slug: cursos]
   6.1 Cursos Presenciais             | cursos-presencial | CRM: 6_cursos__presencial
   6.2 Cursos Online                  | cursos-online     | CRM: 6_cursos__online
   6.3 Cursos Gratuitos  [0]          | cursos-gratuitos  | CRM: 6_cursos__online

7. Fresagem · CAD/CAM Subtrativo  [slug: fresagem]
   7.1 Fresadoras (Equipamentos) [0]  | fresadoras           | CRM: 7_fresagem__equipamentos
   7.2 Software CAM de Fresagem  [0]  | software-fresagem    | CRM: 7_fresagem__softwares
   7.3 Serviços de Fresagem      [0]  | servicos-fresagem    | CRM: 7_fresagem__servicos
   7.4 Insumos — Cerômero (ATOS Block)| insumos-ceromero     | CRM: 7_fresagem__acessorios
   7.5 Insumos — Zircônia        [0]  | insumos-zirconia     | CRM: 7_fresagem__acessorios
   7.6 Insumos — Dissilicato     [0]  | insumos-dissilicato  | CRM: 7_fresagem__acessorios
   7.7 Fresas                    [0]  | fresas               | CRM: 7_fresagem__acessorios
   7.8 Peças e Partes            [0]  | pecas-partes-fresagem| CRM: 7_fresagem__pecas_e_partes

TRANSVERSAL (só criar se a plataforma tiver área de "soluções", "linhas" ou "campanhas";
NÃO criar como oitava etapa):
   Soluções > Chair Side Print | chair-side-print | CRM: 1_captura_digital__scanner_intraoral

ORDEM DE EXECUÇÃO
Crie etapa por etapa, na ordem 1 a 7. Ao terminar cada etapa, confirme na tela que a
categoria-pai e todas as subcategorias dela aparecem, e só então siga para a próxima.

AO FINAL, ME ENTREGUE
- Tabela: item | criado / já existia / falhou | motivo da falha
- Total criado: esperado 7 categorias-pai + 35 subcategorias
- Campos obrigatórios que a plataforma pediu e que não estavam neste briefing
- Qualquer categoria pré-existente que conflite com esta árvore
Não corrija conflito por conta própria: relate e espere instrução.
```

---

## 6. Checklist de validação (após o Claude no Chrome terminar)

- [ ] 7 categorias-pai criadas, na ordem 1 → 7
- [ ] 35 subcategorias criadas, cada uma sob a etapa correta
- [ ] Nenhuma categoria pré-existente foi excluída ou renomeada
- [ ] Subcategorias com 0 produtos existem (estruturais)
- [ ] Slugs sem acento, minúsculos, hifenizados
- [ ] Rótulo público usa "Dentística/Ortodontia" (a chave `destistica_orto` só existe no back)
- [ ] Chair Side Print **não** virou uma oitava etapa
- [ ] Conflitos e campos extras foram relatados, não resolvidos por conta própria

---

## 7. Premissas a validar com o comercial

1. **Insumos de fresagem** (`7.4`–`7.7`) estão mapeados em `7_fresagem__acessorios` por falta de célula própria no Workflow 7×3. Se o comercial quiser acompanhar insumo separado de acessório, é preciso criar uma 26ª célula.
2. **Notebook / Workstation** (`1.3`) não tem SKU avulso — hoje só existe dentro dos combos Chair Side Print. Manter como subcategoria de campanha ou não?
3. **Cursos Gratuitos** (`6.3`) existe como configuração no Sistema A sem produto. Confirmar se entra no MKT como isca de topo de funil.
