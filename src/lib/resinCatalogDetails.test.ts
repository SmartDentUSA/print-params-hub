import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogResinShades, basicResinSpecs } from './resinCatalogDetails';

test('only registered colors are displayed and Classic excludes HT variants', () => {
  assert.deepEqual(catalogResinShades(['A2 Classic A2 HT B1 HT'], 'Bio Vitality Classic').map(s => s.label), ['A2 Classic']);
  assert.deepEqual(catalogResinShades([], 'Bio Vitality HT'), []);
});
test('HT excludes Classic and duplicate shades are collapsed', () => {
  assert.deepEqual(catalogResinShades(['A2 Classic A2 HT', 'A2 HT', 'BL1 HT'], 'Bio Vitality HT').map(s => s.code), ['A2-HT', 'BL1-HT']);
});
test('Bio Vitality HT offers only BL1-HT, B1-HT and A2-HT', () => {
  assert.deepEqual(catalogResinShades(['BL1 HT', 'B1 HT', 'A2 HT', 'A3 HT'], 'Resina 3D Smart Print Bio Vitality HT').map(s => s.code), ['BL1-HT', 'B1-HT', 'A2-HT']);
});
test('Guide does not display the rejected orange color', () => {
  assert.deepEqual(catalogResinShades(['Laranja'], 'Resina Smart 3D Print Bio Clear Guide'), []);
});
test('available translucency is selected in Portuguese, English and Spanish without inventing missing values', () => {
  for (const label of ['Translucidez', 'Translucency', 'Translucencia']) {
    assert.deepEqual(basicResinSpecs([{ label, value: '35%' }]), [{ label, value: '35%' }]);
    assert.deepEqual(basicResinSpecs([{ label, value: '45%' }]), [{ label, value: '45%' }]);
    assert.deepEqual(basicResinSpecs([{ label, value: '' }]), []);
  }
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