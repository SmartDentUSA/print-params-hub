

## Problema

Os arrays `AREA_OPTIONS` e `SPECIALTY_MAP` em `dra-lia/index.ts` (linhas 958-972) estao com valores diferentes do que o usuario precisa. Precisam ser corrigidos para os valores corretos.

## Correcoes

### 1. `AREA_OPTIONS` (linha 958-964) — substituir por:

```
"RADIOLOGIA ODONTOLÓGICA"
"CLÍNICA OU CONSULTÓRIO"
"LABORATÓRIO DE PRÓTESE"
"PLANNING CENTER"
"EMPRESA DE ALINHADORES"
"GESTOR DE REDE DE CLÍNICAS"
"GESTOR DE FRANQUIAS"
"CENTRAL DE IMPRESSÕES"
"EDUCAÇÃO"
```

### 2. `SPECIALTY_MAP` (linhas 966-972) — substituir por lista unica para todas as areas:

```
"CLÍNICO GERAL"
"DENTÍSTICA"
"IMPLANTODONTISTA"
"PROTESISTA"
"ODONTOPEDIATRIA"
"ORTODONTISTA"
"PERIODONTISTA"
"RADIOLOGISTA"
"ESTOMATOLOGISTA"
"CIRURGIA BUCO MAXILO FACIAL"
"TÉCNICO EM RADIOLOGIA"
"TÉCNICO EM PRÓTESE ODONTOLÓGICA"
"OUTROS"
```

### 3. Redeploy `dra-lia`

### Arquivos a editar
| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/dra-lia/index.ts` | Atualizar `AREA_OPTIONS` e `SPECIALTY_MAP` com os valores corretos |

