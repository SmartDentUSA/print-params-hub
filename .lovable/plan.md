## Objetivo
Substituir `src/components/Footer.tsx` por uma versão 100% estática com os dados fornecidos e renderizá-la globalmente em todas as rotas, exceto `/admin` e `/embed`.

## Mudanças

### 1. Reescrever `src/components/Footer.tsx` (estático)
Remover `useCompanyData`, `useLanguage` e qualquer fetch. Componente puro com dados hardcoded.

Estrutura:
- `<footer className="bg-slate-900 text-slate-300 mt-16">`
- `<div className="container mx-auto px-4 py-12">`
- Grid: `grid grid-cols-1 md:grid-cols-4 gap-8`

**Coluna 1 — Sobre**
- Título "Smart Dent" (`text-white font-semibold text-lg`)
- "CNPJ: 10.736.894/0001-36"
- "São Carlos, SP · Brasil"
- "Charlotte, NC · USA"

**Coluna 2 — Redes Sociais**
- Título "Redes Sociais"
- Linha de ícones lucide (`Instagram`, `Youtube`, `Facebook`, `Linkedin`, `MessageCircle` para WhatsApp), cada um em `<a target="_blank" rel="noopener noreferrer" aria-label="...">` com `transition-colors` e hover por marca:
  - Instagram → `hover:text-pink-500` → `https://www.instagram.com/smartdentbr/`
  - YouTube → `hover:text-red-500` → `https://www.youtube.com/@smartdentbr`
  - Facebook → `hover:text-blue-600` → `https://www.facebook.com/smartdent.br/`
  - LinkedIn → `hover:text-sky-500` → `https://www.linkedin.com/company/smartdent-brasil/`
  - WhatsApp → `hover:text-green-500` → `https://api.whatsapp.com/send?phone=5516993831794`

**Coluna 3 — Links**
- Título "Links"
- Lista vertical (`space-y-2 text-sm`):
  - "Parâmetros 3D" → `<Link to="/">` (interno)
  - "Base de Conhecimento" → `<Link to="/base-conhecimento">` (interno)
  - "Loja Online" → `https://loja.smartdent.com.br` (externo)
  - "smartdent.com.br" → `https://smartdent.com.br` (externo)
  - "Smart Dent USA" → `https://smartdentusa.com` (externo)
- Links externos com `target="_blank" rel="noopener noreferrer"` e `hover:text-white`

**Coluna 4 — Contato**
- Título "Contato"
- Lista (`space-y-2 text-sm`):
  - `<a href="tel:+551634194735">+55 16 3419-4735</a>`
  - `<a href="tel:+17047556220">+1 704-755-6220</a>`
  - `<a href="mailto:contato@smartdent.com.br">contato@smartdent.com.br</a>`
  - "ANVISA: 81835969003" (texto)
  - "FDA: K260152" (texto)

**Barra inferior**
- `<div className="border-t border-slate-700 mt-10 pt-6 text-center text-xs text-slate-400">`
- "© 2026 Smart Dent — MMTech Projetos Tecnológicos"

Sem dependências de hooks. Apenas: `import { Link } from "react-router-dom"` e ícones de `lucide-react`.

### 2. Atualizar `src/App.tsx`
- Importar `Footer` de `./components/Footer`
- Adicionar componente `FooterGlobal` análogo ao `DraLIAGlobal` existente:

```tsx
function FooterGlobal() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin') || pathname.startsWith('/embed')) return null;
  return <Footer />;
}
```

- Renderizar `<FooterGlobal />` dentro do fragment de `App`, logo após `<DraLIAGlobal />`.

### 3. Atualizar memória do projeto
A regra Core "Brand Identity: NO hardcoded company data" entra em conflito direto com este pedido. Vou:
- Atualizar `mem://style/brand-identity-v2` para registrar a exceção: o Footer global usa dados estáticos hardcoded (CNPJ, endereços, contatos, certificações).
- Atualizar `mem://index.md` ajustando a linha Core para: *"Brand: 'Smart Dent | Fluxo Digital'. Footer global usa dados est&aacute;ticos hardcoded; demais componentes carregam dinamicamente do System A catalog."*

### 4. Verificações pós-implementação
- Confirmar via build automático que não há import quebrado.
- Mostrar diff resumido das alterações em `Footer.tsx` e `App.tsx` ao final.

## Pontos técnicos
- O `Index.tsx` já tem um pequeno footer interno de copyright. Fica como está; o novo Footer global aparece abaixo. Se quiser remover o interno depois, é uma etapa adicional.
- O `Header` continua intocado.
- Componentes que dependiam do antigo `Footer` dinâmico: nenhum (verificado — não está importado em lugar nenhum).

## Arquivos afetados
- `src/components/Footer.tsx` — reescrita completa
- `src/App.tsx` — import + `FooterGlobal`
- `mem://style/brand-identity-v2` — exceção do footer
- `mem://index.md` — ajuste da regra Core