import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function loadModule(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const { seoTerms } = await loadModule('../src/utils/seoText.ts');
assert.deepEqual(seoTerms('Odontologia digital, ImpressÃ£o 3D; Resinas\nResinas'), ['Odontologia digital', 'ImpressÃ£o 3D', 'Resinas']);
assert.deepEqual(seoTerms(['Resinas', null, 12, ' Resinas ', '']), ['Resinas']);
assert.deepEqual(seoTerms(null), []);

const { fetchAllRows } = await loadModule('../src/utils/fetchAllRows.ts');
const source = Array.from({ length: 640 }, (_, id) => ({ id }));
const ranges = [];
const all = await fetchAllRows(async (from, to) => {
  ranges.push([from, to]);
  return { data: source.slice(from, to + 1), error: null };
});
assert.deepEqual(all.data, source);
assert.deepEqual(ranges, [[0, 199], [200, 399], [400, 599], [600, 799]]);
const failure = await fetchAllRows(async from => from === 0
  ? { data: source.slice(0, 200), error: null }
  : { data: null, error: { message: 'API unavailable' } });
assert.equal(failure.data, null, 'Never present a partial result as a complete list');
assert.equal(failure.error.message, 'API unavailable');
let calls = 0;
await fetchAllRows(async () => { calls++; return { data: [], error: null }; }, () => true);
assert.equal(calls, 0);
console.log('PASS: schema terms, 640-row pagination, error propagation and cancellation');

const { articleText } = await loadModule('../supabase/functions/_shared/article-text.ts');
assert.equal(articleText('<style>.red { color: red }</style><h2>Título</h2><p>Resina &amp; cura</p><script type="application/ld+json">{"hidden":"schema"}</script>'), 'Título Resina & cura');
assert.equal(articleText(null), '');
assert.equal(articleText('&amp;lt; &amp;quot; &lt; &AMP;'), '&lt; &quot; < &');
console.log('PASS: server article text excludes CSS and JSON-LD');
