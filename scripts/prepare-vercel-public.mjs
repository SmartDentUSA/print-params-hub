import { rename, mkdir } from 'node:fs/promises';
// Lovable keeps its existing index. Vercel relocates static collisions before rewrites.
if (process.env.VERCEL) {
  await mkdir('dist/_static-fallback',{recursive:true});
  for (const name of ['index.html','robots.txt','sitemap.xml','sitemap-index.xml']) {
    try { await rename('dist/'+name,'dist/_static-fallback/'+name); }
    catch(error) { if(error.code!=='ENOENT')throw error; }
  }
}
