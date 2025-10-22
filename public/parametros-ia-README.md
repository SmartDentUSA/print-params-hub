# 🤖 JSON de Parâmetros para IA de Atendimento

## 📍 Acesso ao JSON

O arquivo JSON está disponível em:
- **Edge Function (sempre atualizada):** `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/export-parametros-ia`
- **Arquivo estático:** `https://seu-dominio.com/parametros-ia.json` (requer atualização manual)

## 🎯 Como Usar na sua IA

### 1️⃣ Prompt System para a IA

```
Você é um assistente especializado em parâmetros de impressão 3D odontológica da Smart Dent.

Quando o usuário perguntar sobre parâmetros de impressão, siga este fluxo:

1. Identifique qual resina o cliente quer usar
   Exemplo: "Vitality", "Clear Guide", "Bio Temp", etc.

2. Pergunte: "Qual a marca da sua impressora?"
   Espere resposta como: Anycubic, Elegoo, Creality, Phrozen, etc.

3. Pergunte: "Qual o modelo da impressora?"
   Espere resposta como: Mono X, Mars 3, Halot One, etc.

4. Busque no JSON usando os campos normalizados:
   - marca_normalizada (tudo minúsculo, sem acentos)
   - modelo_normalizado (tudo minúsculo, sem acentos)
   - resina_normalizada (tudo minúsculo, sem acentos)

5. Retorne o campo "resposta_formatada" do resultado encontrado

IMPORTANTE:
- Use SEMPRE os campos *_normalizada para busca
- Normalize a entrada do usuário antes de buscar (lowercase, sem acentos)
- Se não encontrar match exato, sugira opções similares do indices_busca
```

### 2️⃣ Exemplo de Fluxo Conversacional

**Usuário:** "Quais os parâmetros da resina Vitality?"

**IA:** "Qual a marca da sua impressora?"

**Usuário:** "Elegoo"

**IA:** "Qual o modelo?"

**Usuário:** "Mars 3"

**IA busca:**
```javascript
// Normalizar entrada
const marca = "elegoo".toLowerCase();
const modelo = "mars 3".toLowerCase().replace(/[áàãâ]/g, 'a');
const resina = "vitality".toLowerCase();

// Buscar no JSON
const resultado = json.parametros.find(p => 
  p.marca_normalizada === marca &&
  p.modelo_normalizado === modelo &&
  p.resina_normalizada.includes(resina)
);

// Retornar resposta formatada
return resultado?.resposta_formatada;
```

### 3️⃣ Estrutura do JSON

```json
{
  "metadata": {
    "versao": "1.0",
    "ultima_atualizacao": "2025-01-23T10:00:00Z",
    "total_parametros": 150,
    "fonte": "https://parametros.smartdent.com.br"
  },
  
  "instrucoes_ia": {
    "fluxo_conversacional": [...],
    "formato_resposta": "...",
    "dica_busca": "..."
  },
  
  "parametros": [
    {
      "id": "uuid",
      "marca": "Anycubic",
      "marca_normalizada": "anycubic",
      "modelo": "Mono X",
      "modelo_normalizado": "mono x",
      "resina": "Smart Print Bio Vitality",
      "resina_normalizada": "smart print bio vitality",
      "fabricante_resina": "Smart Dent",
      
      "camadas_normais": {
        "altura_camada_mm": "0,05",
        "tempo_cura_seg": "1,1",
        "espera_antes_cura_seg": "3",
        "espera_apos_cura_seg": "3",
        "intensidade_luz_pct": "100",
        "ajuste_x_pct": "100",
        "ajuste_y_pct": "100"
      },
      
      "camadas_inferiores": {
        "tempo_adesao_seg": "30",
        "camadas_base": "6",
        "espera_apos_elevacao_seg": "0"
      },
      
      "observacoes": null,
      "resposta_formatada": "Os parâmetros da Resina..."
    }
  ],
  
  "indices_busca": {
    "marcas": ["Anycubic", "Elegoo", ...],
    "resinas": ["Smart Print Bio Vitality", ...],
    "fabricantes": ["Smart Dent", ...]
  }
}
```

## 🔄 Atualização dos Dados

### Opção 1: Usar Edge Function (Recomendado)
A Edge Function sempre retorna os dados mais atualizados do banco:
```
GET https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/export-parametros-ia
```

### Opção 2: Atualizar arquivo estático
Para atualizar o `parametros-ia.json`:
1. Acesse a Edge Function
2. Copie o JSON retornado
3. Substitua o conteúdo de `public/parametros-ia.json`

Ou use curl:
```bash
curl https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/export-parametros-ia > public/parametros-ia.json
```

## 🎨 Exemplo de Implementação

### JavaScript/TypeScript
```javascript
// Carregar JSON
const response = await fetch('https://seu-dominio.com/parametros-ia.json');
const data = await response.json();

// Função de normalização
function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Buscar parâmetro
function buscarParametro(marca, modelo, resina) {
  const marcaNorm = normalizar(marca);
  const modeloNorm = normalizar(modelo);
  const resinaNorm = normalizar(resina);
  
  return data.parametros.find(p => 
    p.marca_normalizada === marcaNorm &&
    p.modelo_normalizado === modeloNorm &&
    p.resina_normalizada.includes(resinaNorm)
  );
}

// Uso
const resultado = buscarParametro('Elegoo', 'Mars 3', 'Vitality');
console.log(resultado?.resposta_formatada);
```

### Python
```python
import json
import unicodedata
import requests

# Carregar JSON
response = requests.get('https://seu-dominio.com/parametros-ia.json')
data = response.json()

# Função de normalização
def normalizar(texto):
    texto = texto.lower()
    texto = unicodedata.normalize('NFD', texto)
    texto = ''.join(c for c in texto if unicodedata.category(c) != 'Mn')
    return texto

# Buscar parâmetro
def buscar_parametro(marca, modelo, resina):
    marca_norm = normalizar(marca)
    modelo_norm = normalizar(modelo)
    resina_norm = normalizar(resina)
    
    for param in data['parametros']:
        if (param['marca_normalizada'] == marca_norm and
            param['modelo_normalizado'] == modelo_norm and
            resina_norm in param['resina_normalizada']):
            return param
    return None

# Uso
resultado = buscar_parametro('Elegoo', 'Mars 3', 'Vitality')
if resultado:
    print(resultado['resposta_formatada'])
```

## 📊 Campos Disponíveis

### Campos de Busca
- `marca_normalizada`: Marca em lowercase sem acentos
- `modelo_normalizado`: Modelo em lowercase sem acentos
- `resina_normalizada`: Resina em lowercase sem acentos

### Campos de Dados
- `camadas_normais`: Configurações para camadas normais
- `camadas_inferiores`: Configurações para camadas de base
- `observacoes`: Notas adicionais (pode ser null)

### Campos de Resposta
- `resposta_formatada`: Texto completo pronto para apresentar ao usuário

### Campos de Índice
- `indices_busca.marcas`: Lista de todas as marcas disponíveis
- `indices_busca.resinas`: Lista de todas as resinas disponíveis
- `indices_busca.fabricantes`: Lista de todos os fabricantes

## 🔍 Tratamento de Erros

```javascript
// Buscar com fallback
function buscarComSugestoes(marca, modelo, resina) {
  const resultado = buscarParametro(marca, modelo, resina);
  
  if (resultado) {
    return resultado.resposta_formatada;
  }
  
  // Se não encontrar, sugerir opções
  const marcasDisponiveis = data.indices_busca.marcas
    .filter(m => normalizar(m).includes(normalizar(marca)))
    .join(', ');
    
  return `Não encontrei parâmetros exatos para ${marca} ${modelo} com ${resina}.
Marcas disponíveis similares: ${marcasDisponiveis || 'Nenhuma encontrada'}`;
}
```

## 📈 Estatísticas do JSON

Acesse `metadata` para informações sobre o dataset:
```javascript
console.log(`Total de parâmetros: ${data.metadata.total_parametros}`);
console.log(`Última atualização: ${data.metadata.ultima_atualizacao}`);
console.log(`Marcas disponíveis: ${data.indices_busca.marcas.length}`);
console.log(`Resinas disponíveis: ${data.indices_busca.resinas.length}`);
```

## 🆘 Suporte

Para dúvidas ou problemas:
1. Verifique se está usando a Edge Function ou arquivo atualizado
2. Confirme que está normalizando corretamente as buscas
3. Use os `indices_busca` para validar se marca/modelo/resina existem no dataset
4. Consulte os logs da Edge Function em caso de erros
