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
const htmlUrl = await moduleUrl('../src/utils/institutionalHomepage.ts', { '../content/institutional': copyUrl });
const handlerUrl = await moduleUrl('../api/seo-proxy.ts', { '../src/utils/institutionalHost': hostUrl, '../src/utils/institutionalHomepage': htmlUrl });
const { isInstitutionalHost } = await import(hostUrl);
const { default: handler } = await import(handlerUrl);
assert.ok(isInstitutionalHost('www.smartdent.com.br'));
for (const host of ['admin.smartdent.com.br', 'parametros.smartdent.com.br', 'smartdent.com.br', 'www.smartdent.com.br.example.org']) assert.equal(isInstitutionalHost(host), false);
const originalFetch = globalThis.fetch;
let upstreamCalls = 0;
globalThis.fetch = async () => { upstreamCalls++; return new Response('existing proxy response'); };
try {
  const response = await handler(new Request('https://www.smartdent.com.br/api/seo-proxy?originalPath=/'));
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /canonical" href="https:\/\/www.smartdent.com.br\/"/);
  assert.match(html, /Inovação e tecnologia/);
  assert.match(html, /tab=catalogo&amp;cat=resinas_3d/);
  assert.equal(upstreamCalls, 0);
  for(const url of ['https://parametros.smartdent.com.br/api/seo-proxy?originalPath=/', 'https://admin.smartdent.com.br/api/seo-proxy?originalPath=/', 'https://www.smartdent.com.br/api/seo-proxy?originalPath=/base-conhecimento']) {
    assert.equal(await (await handler(new Request(url))).text(), 'existing proxy response');
  }
  assert.equal(upstreamCalls, 3);
} finally { globalThis.fetch = originalFetch; }
console.log('PASS: www institutional homepage, canonical and existing-domain isolation');
