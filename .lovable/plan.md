

## Plano: Seletor de DDI com Bandeiras no Campo Telefone

### O que será feito

Criar um componente `PhoneInputWithDDI` que combina um seletor de código de país (com bandeira emoji) + campo de telefone. Será usado no `PublicFormPage` quando `field_type === "phone"`.

### Componente: `src/components/PhoneInputWithDDI.tsx`

- Dropdown/select com ~30 países mais relevantes (todos continentes), usando emoji flags (🇧🇷🇺🇸🇦🇷 etc.) em vez de imagens PNG — mais leve e universal
- Lista inclui: Brasil, EUA, Portugal, Argentina, Chile, Colômbia, México, Uruguai, Paraguai, Peru, Espanha, Itália, Alemanha, França, UK, Japão, China, Índia, Canadá, Austrália, Israel, etc.
- **Padrão: Brasil (+55)**
- Layout: `[🇧🇷 +55 ▾] [_________telefone_________]` em linha
- O valor armazenado no state concatena DDI + número (ex: `5519992612348`)
- Usa Popover + Command (cmdk) para busca por nome do país

### Mudança em `PublicFormPage.tsx`

Substituir o `<Input type="tel">` do caso `field_type === "phone"` pelo novo `<PhoneInputWithDDI>`.

O `handleChange` recebe o valor já com DDI concatenado.

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/PhoneInputWithDDI.tsx` | Novo componente |
| `src/pages/PublicFormPage.tsx` | Importar e usar no campo phone |

