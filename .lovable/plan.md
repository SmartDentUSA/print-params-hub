## Objetivo
Reescrever `product_category` / `product_subcategory` em `system_a_catalog` (linhas `category='product'`) para a taxonomia final abaixo, em MAIÚSCULO e numerada.

## Taxonomia final (exata)
```
1. SCAN
  1.1 SCANNER INTRAORAL
  1.2 SCANNER BANCADA
  1.3 ACESSÓRIOS
2. CAD
  2.1 SOFTWARE
  2.2 SERVIÇO
3. IMPRESSÃO 3D
  3.1 RESINAS 3D - BIOCOMPATÍVEIS
  3.2 RESINAS 3D - USO GERAL
  3.3 SOFTWARE
  3.4 IMPRESSORA 3D - ODONTOLÓGICA
  3.5 IMPRESSORA 3D - DESKTOP
  3.6 ACESSÓRIOS
4. PÓS-IMPRESSÃO
  4.1 EQUIPAMENTOS
  4.2 LIMPEZA/ACABAMENTO
5. CARACTERIZAÇÃO
  5.1 CARACTERIZAÇÃO SMARTMAKE
  5.2 CARACTERIZAÇÃO SMARTGUM
6. DENTÍSTICA, ESTÉTICA E ORTODONTIA
  6.1 ADESIVOS
  6.2 CIMENTOS
  6.3 RESINAS COMPOSTAS
7. INSUMOS LABORATÓRIO
  7.1 CERÔMERO
```

## Mapeamento por produto

**1. SCAN**
- `1.1 SCANNER INTRAORAL`: Chair Side Print 4.0 - Combo Scanner intraoral BLZ INO200; Scanner Intraoral BLZ INO200; BLZ Leap 500; MEDIT i600; i700; i700 Wireless; i900
- `1.2 SCANNER BANCADA`: Scanner de Bancada BLZ LS100; Medit T310
- `1.3 ACESSÓRIOS`: Dispositivo BLZ Dental DMC; ioConnect TruAbutment

**2. CAD**
- `2.1 SOFTWARE`: Assinatura mensal DentalCAD Ultimate Lab Bundle - RMS; Ativação DentalCAD Ultimate Lab Bundle - RMS; Crédito Exocad DentalCAD I.A.; DentalCAD - Software CAD da exocad; exoplan

**3. IMPRESSÃO 3D**
- `3.1 RESINAS 3D - BIOCOMPATÍVEIS`: Bio Bite Splint +Flex; Bio Bite Splint Clear; Bio Denture; Bio Denture Translúcida; Bio Temp B1; Bio Vitality; Gengiva; Try-In Calcinável; Bio Clear Guide; Bio Direct Aligner; Bio GOWhite
- `3.2 RESINAS 3D - USO GERAL`: Model Plus; Modelo Ocre; Modelo Precision; Modelo Universal (Salmão); Modelo Láqua
- `3.3 SOFTWARE`: SmartSlicer I.A.
- `3.4 IMPRESSORA 3D - ODONTOLÓGICA`: Asiga MAX 2; Asiga Ultra; Miicraft Alpha; Rayshape Edge Mini
- `3.5 IMPRESSORA 3D - DESKTOP`: Elegoo Mars 5 Ultra
- `3.6 ACESSÓRIOS`: (vazio hoje)

**4. PÓS-IMPRESSÃO**
- `4.1 EQUIPAMENTOS`: Asiga Cure; Cuba Ultrassônica; Elegoo Wash & Cure Mercury 2-in-1 V2.0; Equipamento UV ShapeCure D; Magna Box EDG; Misturador de Resinas Smart Dent; Pionext UV-02
- `4.2 LIMPEZA/ACABAMENTO`: GlazeON - Splint; NanoClean; NanoClean PoD™

**5. CARACTERIZAÇÃO**
- `5.1 CARACTERIZAÇÃO SMARTMAKE`: Kit Completo SmartMake; SmartMake Base (Clear); Efeito Mamelon; Godê; Intensivo Brown/Mahogany/Ocre; kit básico SmartMake; Seal Glaze; SHADE A/B/C/D; SmartWash; Stain Black/Blue/Violet/White
- `5.2 CARACTERIZAÇÃO SMARTGUM`: Kit Completo SmartGum; SmartGum Black/Cream/Intense Red/Orange/Pink/Ruby; Smart Base Clear/White

**6. DENTÍSTICA, ESTÉTICA E ORTODONTIA**
- `6.1 ADESIVOS`: (vazio hoje)
- `6.2 CIMENTOS`: todos "Cimento UNIKK Veneer *" + Kit Cimento Unikk Veneer
- `6.3 RESINAS COMPOSTAS`: todas "Atos Resina Composta Direta *"; Atos Unichroma; ATOS Smart Ortho; Kit Resina Atos Academic; Resina Atos Academic (todas as cores)

**7. INSUMOS LABORATÓRIO**
- `7.1 CERÔMERO`: (vazio hoje)

## Produtos fora do escopo (permanecem como estão)
- Cursos (Curso ON-Line, Imersão 3 Dias Chairside Print)
- ATOS Block - caixa com 5 unidades (fresagem)
- Chair Side Print 4.0 BLZ INO100 Plus, Chair Side Print BLZ INO200 High-End (SOLUÇÔES)

Serão reclassificados numa próxima rodada quando o usuário mapear.

## Execução
Uma única chamada `supabase--insert` com blocos `UPDATE system_a_catalog SET product_category=..., product_subcategory=... WHERE id IN (...)` — um bloco por par (categoria, subcategoria). Sem migration, sem alteração de código, sem tocar em `resins`, `products_catalog`, `dealer_price_items`, RLS ou triggers.

## Critério de aceitação
- Em `/admin` → Gestão de Catálogo, produtos ativos aparecem exatamente nos pares acima.
- SmartSlicer I.A. em `3. IMPRESSÃO 3D / 3.3 SOFTWARE`.
- Elegoo Mars 5 Ultra em `3.5 IMPRESSORA 3D - DESKTOP`; demais impressoras em `3.4 IMPRESSORA 3D - ODONTOLÓGICA`.
- Todos os rótulos em MAIÚSCULO com prefixo numérico.
