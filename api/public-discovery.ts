import type { VercelRequest,VercelResponse } from '@vercel/node';
import { PUBLIC_ORIGIN, DATA_ORIGIN, publicText, xmlEscape } from '../server/public-site.mjs';
const feeds: Record<string,{slug:string;type:string;query?:string}> = {
  'llms.txt':{slug:'seo-llms-txt',type:'text/plain'},
  'llms-full.txt':{slug:'llms-full-txt',type:'text/plain'},
  'llms-full-en.txt':{slug:'llms-full-txt',type:'text/plain',query:'lang=en'},
  'llms-full-es.txt':{slug:'llms-full-txt',type:'text/plain',query:'lang=es'},
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
    body='User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /smartops/\nDisallow: /social/\nDisallow: /suporte-tecnico/\nDisallow: /api/\n\nSitemap: '+PUBLIC_ORIGIN+'/sitemap-index.xml\n\n# Índice complementar para agentes de IA\n# '+PUBLIC_ORIGIN+'/llms.txt\n# '+PUBLIC_ORIGIN+'/llms-full.txt\n';
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
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=120, stale-while-revalidate=120');
  return res.status(200).send(req.method==='HEAD'?'':body);
}
