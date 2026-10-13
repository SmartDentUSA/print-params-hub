import { cleanSchema, safeJson, publicCanonical, publicUrl } from '../../server/public-site.mjs';
import { isInstitutionalHost } from './institutionalHost';
/** Repair only machine-readable metadata; preserve the visible document and listeners. */
export function installPublicMetadata() {
  if (!isInstitutionalHost(window.location.hostname)) return;
  let timer:number | undefined;
  const clean=()=> {
    const canonical=publicCanonical(window.location.pathname+window.location.search);
    const links=Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]'));
    const link=links.shift() || document.createElement('link');
    links.forEach(el=>el.remove());link.rel='canonical';if(link.href!==canonical)link.href=canonical;
    if (!link.isConnected) document.head.append(link);
    document.querySelectorAll<HTMLMetaElement>('meta[property="og:url"]').forEach(el=>{if(el.content!==canonical)el.content=canonical;});
    document.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]').forEach(el=>{const href=publicUrl(el.href);if(el.href!==href)el.href=href;});
    document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]').forEach(el=>{
      try {
        const schema=cleanSchema(JSON.parse(el.textContent || ''));
        if (!schema) {el.remove();return;}
        const text=safeJson(schema);if(el.textContent!==text)el.textContent=text;
      } catch {el.remove();}
    });
  };
  const observer=new MutationObserver(records=>{
    if(records.some(r=>r.target instanceof Element && (r.target.matches('script,meta,link') || Array.from(r.addedNodes).some(n=>n instanceof Element && (n.matches('script,meta,link') || n.querySelector('script[type="application/ld+json"]')))))) {
      clearTimeout(timer);timer=window.setTimeout(clean,50);
    }
  });
  clean();observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['href','content']});
}
