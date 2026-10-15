import type { VercelRequest,VercelResponse } from '@vercel/node';
import { PUBLIC_ORIGIN, DATA_ORIGIN, publicText, xmlEscape } from '../server/public-site.mjs';
const feeds: Record<string,{slug:string;type:string;query?:string}> = {
  'llms.txt':{slug:'seo-llms-txt',type:'text/plain'},
  'llms-full.txt':{slug:'llms-full-txt',type:'text/plain'},
  'llms-full-en.txt':{slug:'llms-full-txt',type:'text/plain',query:'lang=en'},
  'llms-full-es.txt':{slug:'llms-full-txt',type:'text/plain',query:'lang=es'},
  'llms-resinas.txt':{slug:'llms-full-txt',type:'text/plain',query:'topic=resinas'},
  'llms-equipamentos.txt':{slug:'llms-full-txt',type:'text/plain',query:'topic=equipamentos'},
  'llms-clinico-cad.txt':{slug:'llms-full-txt',type:'text/plain',query:'topic=clinico-cad'},
  'sitemap.xml':{slug:'generate-sitemap',type:'application/xml'},
  'sitemap-conhecimento-pt.xml':{slug:'generate-knowledge-sitemap',type:'application/xml'},
  'sitemap-conhecimento-en.xml':{slug:'generate-knowledge-sitemap-en',type:'application/xml'},
  'sitemap-conhecimento-es.xml':{slug:'generate-knowledge-sitemap-es',type:'application/xml'},
  'sitemap-documentos.xml':{slug:'generate-documents-sitemap',type:'application/xml'},
  'video-sitemap.xml':{slug:'video-sitemap',type:'application/xml'},
  'rss.xml':{slug:'rss-feed',type:'application/rss+xml'},
};
export default async function handler(req:VercelRequest,res:VercelResponse) {
  if (!['GET','HEAD'].includes(req.method || 'GET')) return res.status(405).setHeader('Allow','GET, HEAD').end();
  const name=typeof req.query.file === 'string' ? req.query.file : '';
  let body:string,type='text/plain';
  if (name === 'robots.txt') {
    const aiAgents=['GPTBot','OAI-SearchBot','ClaudeBot','PerplexityBot','Google-Extended'];
    const privateRules='Disallow: /admin/\nDisallow: /smartops/\nDisallow: /social/\nDisallow: /suporte-tecnico/\nDisallow: /api/';
    const aiGroups=aiAgents.map(agent=>`User-agent: ${agent}\nAllow: /llms.txt\nAllow: /llms-index.txt\nAllow: /llms-full.txt\nAllow: /llms-resinas.txt\nAllow: /llms-equipamentos.txt\nAllow: /llms-clinico-cad.txt\nAllow: /base-conhecimento/\nAllow: /produtos/\nAllow: /distribuidores/\nAllow: /eventos\n${privateRules}`).join('\n\n');
    body=aiGroups+'\n\nUser-agent: *\nAllow: /\n'+privateRules+'\n\nSitemap: '+PUBLIC_ORIGIN+'/sitemap-index.xml\n\n# Documentação para agentes: os comentários são informativos; consulte as URLs diretamente.\n# '+PUBLIC_ORIGIN+'/llms.txt\n# '+PUBLIC_ORIGIN+'/llms-index.txt\n# '+PUBLIC_ORIGIN+'/llms-full.txt\n';
  } else if(name === 'llms-index.txt') {
    body=`# Smart Dent — Índice Temático

> Escolha o menor corpus que atenda à consulta. Use o corpus completo quando o tema atravessar áreas. O catálogo público e as páginas canônicas prevalecem para nomes e dados atuais.

## Coleções temáticas
- [Resinas e materiais](${PUBLIC_ORIGIN}/llms-resinas.txt): linhas de resina, indicações, propriedades e laudos vinculados.
- [Equipamentos e scanners](${PUBLIC_ORIGIN}/llms-equipamentos.txt): impressoras, scanners e protocolos de pós-cura.
- [Fluxos clínicos e CAD/CAM](${PUBLIC_ORIGIN}/llms-clinico-cad.txt): exocad, fluxos chairside, captura, desenho e fabricação.

## Corpus e fontes públicas
- [Corpus completo](${PUBLIC_ORIGIN}/llms-full.txt): artigos públicos, portfólio atual, distribuidores e agenda pública.
- [Sitemap index](${PUBLIC_ORIGIN}/sitemap-index.xml): URLs canônicas e mapas de vídeo.
- [Base de Conhecimento](${PUBLIC_ORIGIN}/base-conhecimento): páginas pré-renderizadas para leitura humana e crawlers.
`;
  } else if(name === 'sitemap-index.xml') {
    type='application/xml';
    body='<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+Object.keys(feeds).filter(n=>n.endsWith('.xml') && n!=='rss.xml').map(n=>'<sitemap><loc>'+xmlEscape(PUBLIC_ORIGIN+'/'+n)+'</loc></sitemap>').join('')+'</sitemapindex>';
  } else {
    const feed=feeds[name];
    if(!feed)return res.status(404).end();
    try {
      const response=await fetch(DATA_ORIGIN+'/functions/v1/'+feed.slug+(feed.query?'?'+feed.query:''),{signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error('Feed unavailable');
      body=publicText(await response.text());type=feed.type;
      if(type.includes('xml') && !/^\s*(?:<\?xml[^>]*>\s*)?<(?:urlset|sitemapindex|rss|feed)\b/.test(body))throw new Error('Invalid feed response');
      if(type==='text/plain' && /^\s*<!doctype html/i.test(body))throw new Error('HTML returned for text feed');
    } catch {return res.status(503).setHeader('Cache-Control','no-store').setHeader('Retry-After','30').send('Conteúdo temporariamente indisponível');}
  }
  res.setHeader('Content-Type',type+'; charset=utf-8');
  res.setHeader('Link','<https://www.smartdent.com.br/llms.txt>; rel="describedby"; type="text/markdown"');
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=120, stale-while-revalidate=120');
  return res.status(200).send(req.method==='HEAD'?'':body);
}

