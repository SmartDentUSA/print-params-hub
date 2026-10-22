import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { pandaCounters, pandaRetention } from './metrics.ts';

Deno.test('Panda views use provider snapshot without adding plays or previous totals', () => {
  assertEquals(pandaCounters({ total: { view: 43, unique_view: 16, play: 9, unique_play: 7 } }), { views: 43, unique_views: 16, plays: 9, unique_plays: 7 });
});
Deno.test('invalid Panda response cannot reset stored view counts', () => {
  assertEquals(pandaCounters({ error: 'unavailable' }), null);
  assertEquals(pandaCounters({ total: { view: -1 } }), null);
});
Deno.test('a genuine zero-view snapshot is valid', () => {
  assertEquals(pandaCounters({ total: { view: 0 } })?.views, 0);
});
Deno.test('retention failure is distinct from zero retention', () => {
  assertEquals(pandaRetention(null), null);
  assertEquals(pandaRetention({ retention: { '0': 10, '1': 5 } }), 75);
});