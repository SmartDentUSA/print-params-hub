
# Polimento da Mensagem de Boas-vindas com Menu de Roteamento

## Situação atual

O menu de roteamento foi implementado com sucesso. O chat exibe:

1. A mensagem: *"Olá! 👋 Sou a Dra. L.I.A., especialista em odontologia digital da SmartDent. Como posso ajudar você hoje?"*
2. Os 4 botões abaixo: 🖨️ Parâmetros, 💼 Comercial, 🔬 Produtos, 🛠️ Suporte

## O que precisa melhorar

A mensagem de boas-vindas ainda é genérica ("Como posso ajudar você hoje?") e **não convida explicitamente o usuário a clicar nos botões**. O ideal é que a mensagem já direcione o olhar para o menu, como sugerido na conversa:

> "Olá! Sou a Dra. L.I.A., especialista da SmartDent sobre odontologia digital. Me diga como posso te ajudar: Parametrização (A), Informações comerciais (B), Dúvidas sobre produtos (C), Suporte técnico (D)?"

## Mudanças propostas

### 1. `src/locales/pt.json` — Atualizar `welcome_message`

Substituir o texto atual por uma versão que apresenta o menu diretamente:

```
"welcome_message": "Olá! 👋 Sou a **Dra. L.I.A.**, especialista em odontologia digital da SmartDent.\n\nSobre o que você quer conversar hoje? Selecione uma opção abaixo:"
```

A quebra de linha `\n\n` cria separação visual antes dos botões. O texto "Selecione uma opção abaixo:" prepara o usuário para os botões que aparecem logo em seguida.

### 2. `src/locales/en.json` e `src/locales/es.json` — Atualizar nos outros idiomas

Manter consistência multilíngue:

- **EN:** `"welcome_message": "Hello! 👋 I'm **Dr. L.I.A.**, SmartDent's digital dentistry specialist.\n\nWhat would you like to talk about today? Select an option below:"`
- **ES:** `"welcome_message": "¡Hola! 👋 Soy la **Dra. L.I.A.**, especialista en odontología digital de SmartDent.\n\nSobre ¿qué quieres hablar hoy? Selecciona una opción abajo:"`

### 3. `src/components/DraLIA.tsx` — Separador visual entre texto e botões (opcional, polimento)

Atualmente os botões ficam diretamente abaixo do balão de mensagem. Para deixar mais claro que os botões fazem parte da seleção, adicionar um pequeno separador textual dentro do grid dos botões:

```tsx
{msg.id === 'welcome' && !topicSelected && !isLoading && (
  <div className="mt-3">
    <div className="grid grid-cols-2 gap-2">
      {TOPIC_OPTIONS.map((opt) => (
        <button ...>
          ...
        </button>
      ))}
    </div>
    <p className="text-center text-[10px] text-gray-400 mt-2">
      Ou digite sua dúvida livremente abaixo ↓
    </p>
  </div>
)}
```

Essa linha final ("Ou digite sua dúvida livremente abaixo ↓") comunica ao usuário que os botões são opcionais — ele pode ignorar e digitar diretamente, sem perder a funcionalidade atual.

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/locales/pt.json` | `welcome_message` atualizado para convidar ao menu |
| `src/locales/en.json` | `welcome_message` atualizado em inglês |
| `src/locales/es.json` | `welcome_message` atualizado em espanhol |
| `src/components/DraLIA.tsx` | + linha "Ou digite livremente" abaixo dos botões |

Nenhuma mudança no backend. Nenhuma migração SQL.

## Resultado esperado

```
┌─────────────────────────────────────────────────┐
│ 🦷 Dra. L.I.A.          Assistente SmartDent    │
├─────────────────────────────────────────────────┤
│                                                  │
│  Olá! 👋 Sou a Dra. L.I.A., especialista em     │
│  odontologia digital da SmartDent.               │
│                                                  │
│  Sobre o que você quer conversar hoje?           │
│  Selecione uma opção abaixo:                     │
│                                                  │
│  ┌─────────────┐  ┌─────────────┐               │
│  │ 🖨️ Parâmetros│  │ 💼 Comercial│               │
│  │ de Impressão│  │             │               │
│  └─────────────┘  └─────────────┘               │
│  ┌─────────────┐  ┌─────────────┐               │
│  │ 🔬 Produtos │  │ 🛠️ Suporte  │               │
│  │ e Resinas   │  │ Técnico     │               │
│  └─────────────┘  └─────────────┘               │
│                                                  │
│   Ou digite sua dúvida livremente abaixo ↓       │
│                                                  │
├─────────────────────────────────────────────────┤
│  [ Digite sua dúvida...              ] [ ➤ ]    │
└─────────────────────────────────────────────────┘
```
