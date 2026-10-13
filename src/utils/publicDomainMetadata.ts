import { PUBLIC_ORIGIN, publicUrl } from './publicDomain.mjs';
export function installPublicDomainMetadata() {
  if (!['www.smartdent.com.br','smartdent.com.br'].includes(location.hostname) && !location.hostname.endsWith('.vercel.app')) return;
  if (/^\/(?:admin|smartops|social|painel-comercial|suporte-tecnico|entrar|reset-password)(?:\/|$)/.test(location.pathname)) return;
  let timer: number | undefined;
  const clean=()=> {
    const path=location.pathname;
    const search=new URLSearchParams(location.search);
    for(const key of Array.from(search.keys())) if(key.startsWith('utm_') || ['__public','_vercel_share','x-vercel-protection-bypass','x-vercel-set-bypass-cookie','gclid','fbclid','_cb'].includes(key))search.delete(key);
    const canonical=PUBLIC_ORIGIN+path+(search.size?'?'+search.toString():'');
    document.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]').forEach(el=>{if(el.href!==canonical)el.href=canonical;});
    document.querySelectorAll<HTMLMetaElement>('meta[property="og:url"]').forEach(el=>{if(el.content!==canonical)el.content=canonical;});
    document.querySelectorAll<HTMLAnchorElement|HTMLLinkElement>('a[href],link[rel="alternate"][href]').forEach(el=>{
      const next=publicUrl(el.href);if(next!==el.href)el.href=next;
    });
  };
  const observer=new MutationObserver(records=>{
    if(records.some(r=>r.type==='childList' || (r.target instanceof Element && r.target.matches('a,link,meta')))) {
      clearTimeout(timer);timer=window.setTimeout(clean,100);
    }
  });
  clean();observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['href','content']});
}
