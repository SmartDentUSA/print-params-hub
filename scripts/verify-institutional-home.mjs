import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function moduleUrl(relative, replacements = {}) {
  let source = await readFile(new URL(relative, import.meta.url), 'utf8');
  for (const [from, to] of Object.entries(replacements)) source = source.replace(from, to);
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}
const hostUrl = await moduleUrl('../src/utils/institutionalHost.ts');
const copyUrl = await moduleUrl('../src/content/institutional.ts');
const schemaUrl = await moduleUrl('../src/utils/productSchema.ts');
const htmlUrl = await moduleUrl('../src/utils/institutionalHomepage.ts', { '../content/institutional.js': copyUrl, './productSchema.js': schemaUrl });
const handlerUrl = await moduleUrl('../api/seo-proxy.ts', { '../src/utils/institutionalHost.js': hostUrl, '../src/utils/institutionalHomepage.js': htmlUrl });
const { isInstitutionalHost } = await import(hostUrl);
const { default: handler } = await import(handlerUrl);
assert.ok(isInstitutionalHost('www.smartdent.com.br'));
assert.ok(isInstitutionalHost('smartdent.com.br'));
for (const host of ['admin.smartdent.com.br', 'parametros.smartdent.com.br', 'www.smartdent.com.br.example.org']) assert.equal(isInstitutionalHost(host), false);
const originalFetch = globalThis.fetch;
let upstreamCalls = 0;
const product = { name: 'Produto Teste', slug: 'produto-teste', price: 10, canonical_url: 'https://loja.smartdent.com.br/produto-teste', cta_1_url: 'https://loja.smartdent.com.br/velho-404' };
let catalogCalls = 0;
globalThis.fetch = async (url) => {
  if (String(url).includes('/rest/v1/system_a_catalog')) { catalogCalls++; return Response.json([product]); }
  upstreamCalls++; return new Response('existing proxy response');
};
try {
  const response = await handler(new Request('https://www.smartdent.com.br/api/seo-proxy?originalPath=/'));
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /canonical" href="https:\/\/www.smartdent.com.br\/"/);
  assert.match(html, /Inovação e tecnologia/);
  assert.match(html, /tab=catalogo&amp;cat=resinas_3d/);
  assert.equal(upstreamCalls, 0);
  assert.equal(catalogCalls, 1);
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  const prod = ld['@graph'].find(n => n['@type'] === 'Product');
  assert.equal(prod.url, 'https://loja.smartdent.com.br/produto-teste');
  assert.equal(prod.offers.url, prod.url);
  assert.equal(prod.offers.price, 10);
  for(const url of ['https://parametros.smartdent.com.br/api/seo-proxy?originalPath=/', 'https://admin.smartdent.com.br/api/seo-proxy?originalPath=/', 'https://www.smartdent.com.br/api/seo-proxy?originalPath=/base-conhecimento']) {
    assert.equal(await (await handler(new Request(url))).text(), 'existing proxy response');
  }
  assert.equal(upstreamCalls, 3);
} finally { globalThis.fetch = originalFetch; }
// falha do catálogo não derruba a home
globalThis.fetch = async () => new Response('x', { status: 500 });
const degraded = await (await handler(new Request('https://www.smartdent.com.br/api/seo-proxy?originalPath=/'))).text();
assert.match(degraded, /canonical" href="https:\/\/www.smartdent.com.br\/"/);
globalThis.fetch = originalFetch;
console.log('PASS: www institutional homepage, canonical, Product schema and existing-domain isolation');
