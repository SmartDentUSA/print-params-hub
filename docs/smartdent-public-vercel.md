# Publicação Smart Dent pela Vercel

A versão pública reutiliza os componentes e os dados existentes. Não muda o layout, o conteúdo editorial, o banco, RLS ou os destinos operacionais.

## Entrega
- www.smartdent.com.br é a origem canônica proposta. O domínio sem www redireciona preservando caminho e parâmetros.
- Uma função Node renderiza os componentes React existentes em navegador isolado e retorna HTML completo a visitantes e rastreadores.
- A renderização usa sessão anônima, bloqueia escritas e não encaminha cookies do solicitante. Conteúdo indisponível falha com 503, sem simular uma página válida.
- O navegador assume as interações existentes depois de carregar o aplicativo. Uma cópia limitada de respostas públicas de leitura evita repetir carregamentos.
- A CDN mantém HTML por 120 segundos e pode revalidar por mais 120 segundos. Conteúdo novo fica disponível sem republicar o código. A retirada urgente exige invalidar o cache ou aguardar sua expiração.
- Áreas administrativas permanecem fora do renderer. Identificadores de domínio não substituem autorização.
- Canonical, MIME, JSON-LD, índice de sitemaps e arquivos LLM são normalizados na entrega pública.
- Ofertas sem preço real, avaliações padrão e condições comerciais não comprovadas não são fabricadas. Dados faltantes continuam pendências editoriais.

## Preparação
1. Executar npm ci, node scripts/verify-public-site.mjs e npm run build.
2. Criar preview da branch no projeto print-params-hub; manter a proteção de implantação.
3. Testar home, todas as abas, artigos, produtos, idiomas, PDFs, vídeo, layouts móvel/desktop e interações.
4. Comparar texto e layout com a versão de referência publicada no Lovable.
5. Verificar as URLs legadas preservadas, redirects, autenticação e serviços existentes.
6. Medir latência de renderização fria/quente e cache; ajustar a arquitetura se a experiência não cumprir os critérios.
7. Conferir o cadastro real de marca, avaliações, identidade e registros regulatórios; HTML correto não torna fatos incorretos válidos.

## Aprovação e troca
A branch/preview não autorizam a troca de DNS. Depois da aprovação do ambiente e da matriz de URLs:
- publicar o commit validado no projeto Vercel;
- conectar www e apex e seguir os registros exatos indicados para cada domínio;
- alterar somente os registros web na KingHost; manter NS, MX, TXT e demais serviços;
- conferir certificados, versão pública, arquivos de descoberta e Search Console;
- manter backup Hostinger e valores anteriores recuperáveis.

A reversão precisa considerar caches DNS e CDN. Não apagar a hospedagem antiga nem desativar rotinas de outros domínios. A fonte Git, as tabelas e a hospedagem devem ter estado de publicação conciliado. O corte só conclui após as verificações públicas.
