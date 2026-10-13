import assert from 'node:assert/strict';
import { publicUrl,publicText } from '../src/utils/publicDomain.mjs';
assert.equal(publicUrl('https://parametros.smartdent.com.br/f/teste?embed=1&channel=kol#passo'),'https://www.smartdent.com.br/f/teste?embed=1&channel=kol#passo');
for(const p of ['/lp/a','/bio/a','/agenda','/inscricao/a','/base-conhecimento/c/a','/produtos/a'])assert.equal(publicUrl('https://parametros.smartdent.com.br'+p),'https://www.smartdent.com.br'+p);
for(const p of ['/smartops','/admin/a','/social','/entrar/token'])assert.equal(publicUrl('https://parametros.smartdent.com.br'+p),'https://parametros.smartdent.com.br'+p);
assert.equal(publicUrl('https://loja.smartdent.com.br/p'),'https://loja.smartdent.com.br/p');
assert.equal(publicUrl('https://parametros.smartdent.com.br.evil.test/f/a'),'https://parametros.smartdent.com.br.evil.test/f/a');
assert.equal(publicUrl('javascript:alert(1)'),'javascript:alert(1)');
assert.ok(publicText('<loc>https://parametros.smartdent.com.br/base-conhecimento</loc>').includes('https://www.smartdent.com.br/base-conhecimento'));
console.log('PASS: public links preserve paths, query strings and fragments; operational routes and external domains preserved');

const { legacyPublicRedirect,LEGACY_CATALOG_DESTINATION }=await import('../src/utils/legacyPublicRoutes.mjs');
for(const path of ['/caracterização','/caracterizacao','/caracteriza%C3%A7%C3%A3o','/CARACTERIZAÇÃO/'])assert.equal(legacyPublicRedirect(path),LEGACY_CATALOG_DESTINATION);
for(const path of ['/anycubic','/elegoo','/phrozen','/turma123','/f/form','/%ZZ'])assert.equal(legacyPublicRedirect(path),null);
console.log('PASS: legacy characterization aliases redirect to the resin catalog; printer brands and course paths remain intact');
