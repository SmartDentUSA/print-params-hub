import assert from 'node:assert/strict';

const origin = (process.env.PUBLIC_ORIGIN || 'https://www.smartdent.com.br').replace(/\/$/, '');
const fetchText = async (path) => {
  const response = await fetch(`${origin}${path}`, { redirect: 'follow' });
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  assert.match(response.headers.get('content-type') || '', /text\/plain|application\/xml|text\/xml/i, `${path}: invalid content type`);
  const body = await response.text();
  assert.ok(body.trim(), `${path}: empty response`);
  return { body, headers: response.headers };
};

const paths = ['/robots.txt', '/llms.txt', '/llms-index.txt', '/llms-full.txt', '/llms-resinas.txt', '/llms-equipamentos.txt', '/llms-clinico-cad.txt', '/sitemap-index.xml'];
const docs = Object.fromEntries(await Promise.all(paths.map(async (path) => [path, await fetchText(path)])));
const { body: robots } = docs['/robots.txt'];
const { body: short, headers: shortHeaders } = docs['/llms.txt'];
const { body: index, headers: indexHeaders } = docs['/llms-index.txt'];
const { body: full, headers: fullHeaders } = docs['/llms-full.txt'];

// RFC 9309-compatible groups: explicit AI crawlers have the same public access
// and private-area protection as the general group.
for (const agent of ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) {
  const start = robots.indexOf(`User-agent: ${agent}`);
  assert.notEqual(start, -1, `missing robots group for ${agent}`);
  const group = robots.slice(start, robots.indexOf('\n\n', start) < 0 ? undefined : robots.indexOf('\n\n', start));
  for (const path of ['/llms.txt', '/llms-index.txt', '/llms-full.txt', '/llms-resinas.txt', '/llms-equipamentos.txt', '/llms-clinico-cad.txt', '/base-conhecimento/']) {
    assert.ok(group.includes(`Allow: ${path}`), `${agent} cannot crawl ${path}`);
  }
  for (const path of ['/admin/', '/smartops/', '/social/', '/suporte-tecnico/', '/api/']) {
    assert.ok(group.includes(`Disallow: ${path}`), `${agent} can crawl private path ${path}`);
  }
}
assert.match(robots, /^User-agent: \*$/m);
assert.match(robots, /^Sitemap: https:\/\/www\.smartdent\.com\.br\/sitemap-index\.xml$/m);

// Short manifest is deliberately small and routes to authoritative sources.
assert.match(short, /^# Smart Dent$/m);
assert.match(short, /^> .+/m);
assert.match(short, /^## Identity and disambiguation$/m);
assert.match(short, /Marcelo Del Guerra and Marcelo Cestari/);
assert.match(short, /not a founder/);
assert.match(short, /K260152/);
assert.match(short, /llms-index\.txt/);
assert.ok(Buffer.byteLength(short, 'utf8') <= 3_500, `llms.txt is ${Buffer.byteLength(short, 'utf8')} bytes; target is <= 3.5 KB`);
assert.match(index, /^# Smart Dent — Índice Temático$/m);
for (const path of ['/llms-resinas.txt', '/llms-equipamentos.txt', '/llms-clinico-cad.txt', '/llms-full.txt']) assert.ok(index.includes(path), `index is missing ${path}`);

const declared = Number(full.match(/^> Total de artigos: (\d+)$/m)?.[1]);
assert.ok(Number.isInteger(declared) && declared > 0, 'missing or invalid article count');
const canonicals = [...full.matchAll(/^- \*\*URL Canônica:\*\* (https?:\/\/\S+)$/gm)].map((m) => m[1]);
assert.equal(canonicals.length, declared, `declares ${declared} articles but includes ${canonicals.length} canonical URLs`);
assert.equal(new Set(canonicals).size, canonicals.length, 'duplicate canonical URLs');
for (const canonical of canonicals) {
  const url = new URL(canonical);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'www.smartdent.com.br');
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
}

// Reject known export defects, including the old generated company footer.
for (const [pattern, message] of [
  [/\/produtos\/(?:null|undefined)(?:[\/?#\s)]|$)/i, 'broken product URL'],
  [/class="text-primary\s+underline\s+internal-link"/i, 'raw rich-text fragment'],
  [/\[\[[A-Z0-9_-]+\]\]/i, 'unexpanded author/template token'],
  [/\b(?:null|undefined|NaN),\s*(?:null|undefined|NaN)\b/i, 'null event location'],
  [/\b(?:TESTE KOL|Evento Teste)\b/i, 'test event leaked'],
  [/httphttps:|https?:\/\/[^\s)]*\/s:\/\//i, 'malformed URL'],
  [/\b(?:nulls|undefineds)\b/i, 'null technical value'],
  [/MMTech Projetos Tecnol[oó]gicos Importa[cç][aã]o e Exporta[cç][aã]o Ltda\.?\s+Smart Dent\s+10\.736\.894\/0001-36\s+2009-03-19\s+899849957\s+3027526455\s+Q139535514/i, 'repeated corporate footer'],
]) assert.doesNotMatch(full, pattern, message);

for (const [path, expectedTitle] of [
  ['/llms-resinas.txt', 'Resinas e materiais'],
  ['/llms-equipamentos.txt', 'Equipamentos e scanners'],
  ['/llms-clinico-cad.txt', 'Fluxos clínicos e CAD/CAM'],
]) {
  const { body } = docs[path];
  assert.match(body, new RegExp(`^# Smart Dent — ${expectedTitle}`, 'm'), `${path}: incorrect topic heading`);
  const topicCount = Number(body.match(/^> Total de artigos: (\d+)$/m)?.[1]);
  assert.ok(topicCount > 0 && topicCount <= declared, `${path}: invalid article count ${topicCount}`);
  assert.ok(Buffer.byteLength(body, 'utf8') < Buffer.byteLength(full, 'utf8'), `${path}: topic file is not smaller than the full corpus`);
}

for (const [name, headers] of [['llms.txt', shortHeaders], ['llms-index.txt', indexHeaders], ['llms-full.txt', fullHeaders]]) {
  assert.match(headers.get('link') || '', /rel="describedby"; type="text\/markdown"/i, `${name}: missing Link describedby header`);
}
assert.match(docs['/sitemap-index.xml'].body, /<sitemapindex\b/);

console.log(JSON.stringify({
  status: 'PASS', origin,
  llmsBytes: Buffer.byteLength(short, 'utf8'),
  fullCorpusBytes: Buffer.byteLength(full, 'utf8'),
  articles: declared,
  topicBytes: Object.fromEntries(['/llms-resinas.txt', '/llms-equipamentos.txt', '/llms-clinico-cad.txt'].map((path) => [path, Buffer.byteLength(docs[path].body, 'utf8')])),
  robotsAiGroups: 5,
  sitemap: 'PASS',
}, null, 2));

