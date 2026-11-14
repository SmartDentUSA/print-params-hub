import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GROUP_LINK_SECTIONS,
  isSimulatorShortLink,
  simulatorOnly,
  sectionsToFetch,
} from './groupLinkSections';

test('the group-link field offers only the WhatsApp simulator list', () => {
  assert.deepEqual(GROUP_LINK_SECTIONS, ['simulator']);
});

test('form and landing-page short links are never simulator links', () => {
  assert.equal(isSimulatorShortLink({ default_target: 'whatsapp' }), true);
  assert.equal(isSimulatorShortLink({ default_target: 'form' }), false);
  assert.equal(isSimulatorShortLink({ default_target: 'landing_page' }), false);
});

test('only simulator rows survive the filter', () => {
  const rows = [
    { name: 'Simulador A', default_target: 'whatsapp' },
    { name: 'Formulário B', default_target: 'form' },
    { name: 'Landing C', default_target: 'landing_page' },
    { name: 'Simulador D', default_target: 'whatsapp' },
  ];
  assert.deepEqual(simulatorOnly(rows).map((r) => r.name), ['Simulador A', 'Simulador D']);
});

test('the simulator-only picker loads no other list', () => {
  assert.deepEqual(sectionsToFetch(GROUP_LINK_SECTIONS), {
    disparo: false,
    shortLinks: true,
    chat: false,
    courses: false,
    groups: false,
  });
});

test('the full picker still loads every list', () => {
  assert.deepEqual(
    sectionsToFetch(['disparopro', 'manual', 'forms', 'landing', 'simulator', 'groups', 'chat', 'courses']),
    { disparo: true, shortLinks: true, chat: true, courses: true, groups: true },
  );
});
