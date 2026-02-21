

# Atualizar mensagem de boas-vindas e botoes de topico da Dra. LIA

## Alteracoes

### 1. Mensagem de boas-vindas (`src/locales/pt.json`, linha 224 + `src/locales/en.json` equivalente)

De:
```
Olá! 👋 Sou a **Dra. L.I.A.**, especialista em odontologia digital da SmartDent.
Sobre o que você quer conversar hoje? Selecione uma opção abaixo:
```

Para:
```
Olá! Que bom ter você por aqui. Para que eu possa te atender com agilidade, escolha uma das opções abaixo: 👇
```

### 2. Botoes de topico (`src/components/DraLIA.tsx`, linhas 41-70)

| Campo | Antes | Depois |
|-------|-------|--------|
| **parameters** emoji | `🖨️` | `🎯` |
| **parameters** label | Parâmetros de Impressão | Quero acertar na Impressão! |
| **parameters** description | Configurações de resinas e impressoras 3D | Configurações ideais para sua impressora e nossa resina |
| **commercial** emoji | `💼` | `💰` |
| **commercial** label | Informações Comerciais | Quero transformar minha vida profissional e dos meus pacientes! |
| **commercial** description | Preços, pedidos, contato e parceiros | Tudo sobre nossos equipamentos, softwares e sistemas completos |
| **products** emoji | `🔬` | `🔬` |
| **products** label | Produtos e Resinas | Quero conhecer mais dos produtos |
| **products** description | Catálogo, características e indicações | Catálogo completo, resinas e indicações técnicas e certificados |
| **support** emoji | `🛠️` | `🛠️` |
| **support** label | Suporte Técnico | Preciso de uma Mãozinha! |
| **support** description | Problemas com equipamentos ou materiais | Suporte técnico e ajuda com equipamentos ou materiais |

Os `userMessage` (mensagem enviada ao clicar) serao ajustados para combinar com os novos labels.

### 3. Traducao em ingles (`src/locales/en.json`)

Atualizar a `welcome_message` equivalente para manter consistencia.

