import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogResinShades, basicResinSpecs } from './resinCatalogDetails';

test('only registered colors are displayed and Classic excludes HT variants', () => {
  assert.deepEqual(catalogResinShades(['A2 Classic A2 HT B1 HT'], 'Bio Vitality Classic').map(s => s.label), ['A2 Classic']);
  assert.deepEqual(catalogResinShades([], 'Bio Vitality HT'), []);
});
test('HT excludes Classic and duplicate shades are collapsed', () => {
  assert.deepEqual(catalogResinShades(['A2 Classic A2 HT', 'A2 HT', 'BL1 HT'], 'Bio Vitality HT').map(s => s.code), ['A2', 'BL1']);
});
test('basic specs retain real values in requested order without filling absent properties', () => {
  assert.deepEqual(basicResinSpecs([
    { label: 'Radiopacidade', value: '1.048 mm Al' },
    { label: 'Resistência Flexural', value: '147 MPa' },
    { label: 'Dureza Shore D', value: '>92' },
    { label: 'Viscosidade', value: '' },
    { label: 'Módulo Flexural (GPa)', value: '5.49' },
  ]).map(s => s.value), ['147 MPa', '5.49', '1.048 mm Al']);
});