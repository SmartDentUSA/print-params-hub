

# Mensagens WaLeads com Variaveis e Preview de Midia

## Problema atual

O campo de mensagem WaLeads e um simples Textarea ou Input de URL, sem:
- Variaveis do lead (ex: `{{nome}}`, `{{produto_interesse}}`)
- Preview de midia (imagem, audio, video, documento) inline
- Orientacao sobre quais campos estao disponiveis

## Solucao proposta

### 1. Variaveis de template no texto

Adicionar barra de variaveis clicaveis acima do Textarea. Ao clicar, a variavel e inserida na posicao do cursor.

Variaveis disponiveis (campos reais de `lia_attendances`):

| Variavel | Campo | Exemplo |
|---|---|---|
| `{{nome}}` | nome | "Dr. Carlos" |
| `{{produto_interesse}}` | produto_interesse | "Vitality" |
| `{{especialidade}}` | especialidade | "Ortodontia" |
| `{{cidade}}` | cidade | "Sao Paulo" |
| `{{uf}}` | uf | "SP" |
| `{{area_atuacao}}` | area_atuacao | "Clinica" |
| `{{proprietario}}` | proprietario_lead_crm | "Joao Silva" |

### 2. Preview de midia inline

Quando o tipo de mensagem nao e "text", mostrar preview da midia ao lado do campo URL:
- **Imagem**: thumbnail da URL inserida (tag `<img>`)
- **Video**: player embutido (`<video>`) ou thumbnail
- **Audio**: player de audio (`<audio>`)
- **Documento**: icone de arquivo + nome extraido da URL

### 3. Layout do card de mensagem melhorado

O card de cada regra no listing tambem mostrara:
- Preview compacto da midia (thumbnail 48px para imagens)
- Texto com variaveis destacadas em badge (ex: `Ola {{nome}}!` mostra "nome" em destaque)

---

## Alteracoes tecnicas

### Arquivo: `src/components/SmartOpsCSRules.tsx`

**Secao WaLeads no Dialog (linhas 339-370)**:

Substituir o Textarea simples por um componente com:

```
Secao WaLeads (quando ativo)
├── Tipo de Mensagem [Select: Texto | Imagem | Audio | Video | Documento]
│
├── Se "text":
│   ├── Barra de variaveis: [nome] [produto] [cidade] [uf] [especialidade] [area] [proprietario]
│   │   (cada badge e clicavel e insere {{variavel}} no cursor do textarea)
│   ├── Textarea com mensagem
│   └── Preview: texto renderizado com variaveis em destaque (badges coloridos)
│
└── Se midia (image/audio/video/document):
    ├── Input URL da midia
    ├── Legenda (Input texto opcional, suporta variaveis)
    └── Preview inline:
        ├── image: <img> com fallback
        ├── audio: <audio controls>
        ├── video: <video controls> (max 200px)
        └── document: icone + nome do arquivo
```

**Secao do renderRuleCard (linhas 161-205)**:

Atualizar para mostrar:
- Variaveis no texto destacadas com cor
- Thumbnail compacto para midia

### Migracao SQL

Adicionar coluna para legenda de midia:

```sql
ALTER TABLE cs_automation_rules
  ADD COLUMN IF NOT EXISTS waleads_media_caption TEXT;
```

Isso permite enviar legendas junto com imagens/videos/docs (a API WaLeads suporta campo `caption` nos endpoints de midia).

### Constantes de variaveis

```typescript
const LEAD_VARIABLES = [
  { key: "nome", label: "Nome" },
  { key: "produto_interesse", label: "Produto" },
  { key: "especialidade", label: "Especialidade" },
  { key: "cidade", label: "Cidade" },
  { key: "uf", label: "UF" },
  { key: "area_atuacao", label: "Area" },
  { key: "proprietario_lead_crm", label: "Proprietario" },
];
```

### Funcao de insercao de variavel

```typescript
const insertVariable = (varKey: string) => {
  const textarea = textareaRef.current;
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = form.mensagem_waleads;
  const newText = text.substring(0, start) + `{{${varKey}}}` + text.substring(end);
  setForm({ ...form, mensagem_waleads: newText });
};
```

---

## Arquivos afetados

| Arquivo | Acao |
|---|---|
| Migration SQL | Criar -- coluna `waleads_media_caption` |
| `src/components/SmartOpsCSRules.tsx` | Editar -- barra de variaveis, preview de midia, caption, renderRuleCard melhorado |

