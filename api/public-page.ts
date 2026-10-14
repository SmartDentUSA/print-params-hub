import type { VercelRequest, VercelResponse } from '@vercel/node';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { PUBLIC_ORIGIN, publicLocation, cleanStructuredData, safeJson } from '../server/public-site.mjs';

export const config = { maxDuration: 60 };
const dist = resolve(process.cwd(), 'dist');
const types: Record<string,string> = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};

export default async function handler(req: VercelRequest,res: VercelResponse) {
  if (!['GET','HEAD'].includes(req.method || 'GET')) return res.status(405).setHeader('Allow','GET, HEAD').end();
  const path = publicLocation(typeof req.query.path === 'string' ? req.query.path : '/');
  if (!path) return res.status(404).setHeader('Content-Type','text/html; charset=utf-8').send('<!doctype html><html lang="pt-BR"><title>404</title><h1>Página não encontrada</h1></html>');
  const screenshot = req.query.format === 'png' && process.env.VERCEL_ENV !== 'production';
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    const entry = await readFile(resolve(dist,'index.html'),'utf8');
    browser = await puppeteer.launch({args:chromium.args,defaultViewport:{width:1365,height:900},executablePath:await chromium.executablePath(),headless:true});
    const page = await browser.newPage();
    if (screenshot && req.query.viewport === 'mobile') await page.setViewport({width:390,height:844});
    await page.evaluateOnNewDocument(() => { (window as any).__SMARTDENT_PRERENDER__ = true; });
    const responses: Array<{url:string;body:string;status:number;contentType:string}> = [];
    let responseSize = 0, missing = false, dataFailed = false;
    const captures: Promise<void>[] = [];
    page.on('response', response => {
      const url = new URL(response.url());
      if (!url.hostname.endsWith('.supabase.co') || !url.pathname.startsWith('/rest/v1/') || response.request().method() !== 'GET') return;
      captures.push((async () => {
        const body = await response.text().catch(() => '');
        const originalUrl = (response.request() as any).__originalPublicUrl || response.url();
        const slug = url.searchParams.get('slug');
        if (slug && url.pathname.match(/\/(knowledge_contents|system_a_catalog)$/)) {
          if (response.status() === 406 || body === 'null' || body === '[]') missing = true;
        }
        if (response.status() >= 500 || [401,403].includes(response.status())) dataFailed = true;
        if (response.ok() && body && responseSize + Buffer.byteLength(body) < 1000000) {
          responseSize += Buffer.byteLength(body);
          responses.push({url:originalUrl,body,status:response.status(),contentType:response.headers()['content-type'] || 'application/json'});
        }
      })());
    });
    await page.setRequestInterception(true);
    page.on('request', request => {
      void (async () => {
        try {
          const url = new URL(request.url());
          const readOnlyRpc = request.method() === 'POST' && url.hostname === 'okeogjgqijbfkudfjadz.supabase.co' && url.pathname === '/rest/v1/rpc/fn_public_course_professionals';
          if (!['GET','HEAD'].includes(request.method()) && !readOnlyRpc) return request.respond({status:204,body:''});
          if (url.origin === PUBLIC_ORIGIN) {
            let file = request.resourceType() === 'document' ? resolve(dist,'index.html') : resolve(dist,decodeURIComponent(url.pathname).replace(/^\//,''));
            if (!file.startsWith(dist + sep)) return request.abort();
            const body = file.endsWith('index.html') ? Buffer.from(entry) : await readFile(file);
            return request.respond({status:200,contentType:types[extname(file)] || 'application/octet-stream',body});
          }
          if (url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/')) {
            const original = request.url();
            if (/\/knowledge_contents$/.test(url.pathname)) url.searchParams.set('active','eq.true');
            if (/\/system_a_catalog$/.test(url.pathname)) {
              url.searchParams.set('active','eq.true');
              // The company profile is a public source record selected by the
              // About page itself. Additional catalog visibility filters can
              // hide that record and leave the route stuck on its loading UI.
              if (url.searchParams.get('category') !== 'eq.company_info') {
                url.searchParams.set('approved','eq.true');url.searchParams.set('visible_in_ui','eq.true');
              }
            }
            (request as any).__originalPublicUrl = original;
            return request.continue({url:url.toString()});
          }
          if (request.resourceType() === 'image' && !screenshot) return request.abort();
          // No trackers, authentication, arbitrary APIs, or embedded third-party scripts.
          if (['image','font','stylesheet'].includes(request.resourceType()) && /^(?:https):$/.test(url.protocol)) return request.continue();
          return request.abort();
        } catch { if (!request.isInterceptResolutionHandled()) await request.abort().catch(() => {}); }
      })();
    });
    const location = PUBLIC_ORIGIN + path;
    await page.goto(location,{waitUntil:'domcontentloaded',timeout:25000});
    // Wait for the routed React page, not the static noscript fallback or a
    // loading/error boundary. Those can contain plenty of text but are not
    // useful, indexable page content.
    await page.waitForFunction(() => {
      const root = document.querySelector('#root');
      const heading = root?.querySelector('h1')?.textContent?.trim() || '';
      return heading.length > 2 && !/atualizando para a versão mais recente|carregando/i.test(heading);
    },{timeout:18000});
    await page.waitForNetworkIdle({idleTime:900,timeout:15000}).catch(() => {});
    await Promise.all(captures);
    if (missing) return res.status(404).setHeader('Content-Type','text/html; charset=utf-8').setHeader('Cache-Control','no-store').send('<!doctype html><html lang="pt-BR"><title>404</title><h1>Página não encontrada</h1></html>');
    if (dataFailed) throw new Error('Public content data unavailable');
    const article = /^\/(?:base-conhecimento|en\/knowledge-base|es\/base-conocimiento)\/[^/]+\/[^/?]+/.test(path) && !path.includes('calculadora-roi');
    if (article) await page.waitForFunction(() => (document.querySelector('[role="dialog"]')?.textContent || '').length > 200,{timeout:10000});
    await page.evaluate((path) => {
      const url = new URL(path, 'https://www.smartdent.com.br');
      if (['/','/institucional'].includes(url.pathname) || (url.pathname === '/base-conhecimento' && url.searchParams.get('tab') === 'institucional')) { url.pathname='/';url.search=''; }
      else if (url.pathname.split('/').length > 3 || url.pathname.startsWith('/produtos/')) url.search='';
      else { const tab=url.searchParams.get('tab');url.search='';if(tab)url.searchParams.set('tab',tab); }
      const canonical=url.toString();
      document.querySelectorAll('link[rel="canonical"]').forEach(el=>el.remove());
      const link=document.createElement('link');link.rel='canonical';link.href=canonical;document.head.append(link);
      document.querySelectorAll('meta[property="og:url"]').forEach(el=>el.setAttribute('content',canonical));
      const robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
      if (robots) robots.content='index, follow';
      // Snapshot rendering must not leave an open, session-specific dialog or an inspector.
      document.querySelectorAll('[data-lovable-preview],[data-inspector]').forEach(el=>el.remove());
    },path);
    if (screenshot) {
      await page.evaluate(() => document.fonts.ready);
      const image=await page.screenshot({type:'png',fullPage:true});
      return res.status(200).setHeader('Content-Type','image/png').setHeader('Cache-Control','no-store').send(image);
    }
    let html=cleanStructuredData(await page.content());
    const data='<script>window.__SMARTDENT_PUBLIC_PAGE__=true;</script><script id="__smartdent_public_data" type="application/json">'+safeJson({responses,article})+'</script>';
    html=html.replace('</head>',data+'</head>');
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','public, max-age=0, s-maxage=120, stale-while-revalidate=120');
    res.setHeader('X-Public-Renderer','original-react-components');
    if (process.env.VERCEL_ENV !== 'production') res.setHeader('X-Robots-Tag','noindex');
    return res.status(200).send(req.method === 'HEAD' ? '' : html);
  } catch (error) {
    console.error('[public-page]',error instanceof Error ? error.message : 'render failed');
    return res.status(503).setHeader('Content-Type','text/html; charset=utf-8').setHeader('Cache-Control','no-store').setHeader('Retry-After','30').send('<!doctype html><html lang="pt-BR"><title>Temporariamente indisponível</title><h1>Conteúdo temporariamente indisponível</h1><p>Tente novamente em instantes.</p></html>');
  } finally { await browser?.close().catch(()=>{}); }
}
