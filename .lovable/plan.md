
# Adicionar "Calculadora de ROI" nas category pills públicas

## Problema Identificado
O usuário quer que apareça uma opção "Calculadora de ROI" nas category pills públicas da base de conhecimento (junto com A • Vídeos Tutoriais, B • Falhas, etc.), não apenas no admin.

## Análise do Código
- `KnowledgeCategoryPills`: Mostra apenas categorias do banco de dados (`categories.filter(c => c.enabled)`)
- `SmartOpsROICalculators`: Componente admin que gerencia calculadoras (salva no localStorage)
- Não existe rota pública para calculadoras ROI
- Não existem keys de localização para ROI

## Alterações Necessárias

### 1. Adicionar keys de localização
**src/locales/pt.json, en.json, es.json:**
```json
"knowledge": {
  "roi_calculator": "Calculadora de ROI",
  "roi_calculator_description": "Calcule o retorno de investimento dos seus equipamentos"
}
```

### 2. Criar página pública ROICalculator
**src/pages/ROICalculatorPage.tsx (novo):**
- Lista calculadoras publicadas (status: "publicado") do localStorage
- Permite ao usuário inserir valores e ver resultados
- Interface pública amigável (não é admin)
- Suporte multilingual

### 3. Adicionar rotas para calculadora
**src/App.tsx:**
- `/base-conhecimento/calculadora-roi`
- `/en/knowledge-base/roi-calculator`  
- `/es/base-conocimiento/calculadora-roi`

### 4. Modificar KnowledgeCategoryPills
**src/components/KnowledgeCategoryPills.tsx:**
- Adicionar pill hardcodado "F • Calculadora de ROI" após as categorias do banco
- Ao clicar, navegar para rota da calculadora
- Manter visual consistente com outras pills

### 5. Ajustar KnowledgeBase
**src/pages/KnowledgeBase.tsx:**
- Tratar caso especial quando categoryLetter === "calculadora-roi"
- Renderizar conteúdo da calculadora em vez do viewer padrão

## Resultado
- Pill "F • Calculadora de ROI" visível nas category pills públicas
- Usuários podem acessar calculadoras publicadas
- Interface pública separada da gestão admin
- Suporte multilingual completo
