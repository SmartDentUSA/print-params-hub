import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
if (process.env.VERCEL) {
  const original=await readFile('dist/index.html','utf8');
  const originalScripts=original.match(/<script\b[\s\S]*?<\/script>/gi)||[];
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json'};
  const browser=await puppeteer.launch({args:chromium.args,executablePath:await chromium.executablePath(),headless:true,defaultViewport:{width:1440,height:1000}});
  try {
    const page=await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request',async request=>{
      try {
        const url=new URL(request.url());
        if(url.hostname==='www.smartdent.com.br'){
          let file=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
          const resolved=path.resolve('dist',file);
          if(!resolved.startsWith(path.resolve('dist')+path.sep))return request.abort();
          try {return await request.respond({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body:await readFile(resolved)});}
          catch{return await request.respond({status:404,body:''});}
        }
        if(!['GET','HEAD'].includes(request.method()) || /google-analytics|googletagmanager|facebook\.com|tiktok|doubleclick/.test(url.hostname))return await request.abort();
        return await request.continue();
      } catch {if(!request.isInterceptResolutionHandled())await request.abort();}
    });
    await page.goto('https://www.smartdent.com.br/',{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForFunction(()=>document.querySelector('h1')?.textContent?.includes('Inovação'),{timeout:30000});
    await page.waitForNetworkIdle({idleTime:500,timeout:10000}).catch(()=>{});
    const summary=await page.evaluate(()=>({h1:document.querySelector('h1')?.textContent,text:document.querySelector('#root')?.textContent?.length||0,canonical:document.querySelector('link[rel="canonical"]')?.getAttribute('href')}));
    if(summary.text<1500 || summary.canonical!=='https://www.smartdent.com.br/')throw new Error('Homepage prerender validation failed: '+JSON.stringify(summary));
    await page.evaluate(()=>{
      document.querySelectorAll('script:not([type="application/ld+json"])').forEach(s=>s.remove());
      document.querySelectorAll('noscript').forEach(n=>{if((n.textContent || '').includes('<h1'))n.remove();});
    });
    const html=(await page.content()).replace('</head>',originalScripts.join('')+'</head>');
    if(!html.includes('id="root"') || !html.includes('Inovação'))throw new Error('Rendered React root missing');
    await writeFile('dist/_public-home.html',html,'utf8');
    console.log('PASS public home prerender',JSON.stringify(summary));
  } finally {await browser.close();}
}
