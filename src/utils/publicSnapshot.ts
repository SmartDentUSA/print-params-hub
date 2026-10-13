interface SnapshotRecord { url: string; body: string; contentType: string; status: number }
interface SnapshotData { responses: SnapshotRecord[]; article: boolean }
/** Hand over the original rendered DOM only after the existing React app has loaded. */
export function preparePublicSnapshot(): HTMLElement {
  const root = document.getElementById('root')!;
  const node = document.getElementById('__smartdent_public_data');
  if (!node) return root;
  let data: SnapshotData;
  try { data = JSON.parse(node.textContent || ''); } catch { return root; }
  // Captured Radix scroll/pointer locks must not become the live app's initial state.
  document.body.removeAttribute('data-scroll-locked');
  document.body.style.removeProperty('pointer-events');
  document.body.style.removeProperty('overflow');
  const fetchOriginal = window.fetch.bind(window);
  const records = new Map((data.responses || []).map(r => [r.url,r]));
  const snapshotNodes = Array.from(document.body.children).filter(el => !['SCRIPT','STYLE','LINK'].includes(el.tagName));
  const expectedHeading = document.querySelector('h1')?.textContent?.trim();
  root.id = '__smartdent_snapshot';
  snapshotNodes.forEach(el => el.setAttribute('data-public-snapshot','true'));
  const live = document.createElement('div');
  live.id = 'root';
  live.style.cssText = 'position:absolute;inset:0;visibility:hidden;pointer-events:none';
  document.body.appendChild(live);
  let pending = 0, lastActivity = Date.now(), completed = false;
  window.fetch = async (input, init) => {
    const request = new Request(input, init);
    const isData = request.url.includes('/rest/v1/');
    if (isData) { pending++; lastActivity = Date.now(); }
    try {
      const record = request.method === 'GET' ? records.get(request.url) : undefined;
      let authenticated = false;
      try { authenticated = Boolean(localStorage.getItem('sb-okeogjgqijbfkudfjadz-auth-token')); } catch { /* storage may be disabled */ }
      if (record && !authenticated) {
        records.delete(request.url);
        return new Response(record.body,{ status:record.status,headers:{'Content-Type':record.contentType} });
      }
      return await fetchOriginal(input,init);
    } finally { if (isData) { pending--; lastActivity = Date.now(); } }
  };
  const finish = () => {
    if (completed) return;
    completed = true;
    clearInterval(poll); clearTimeout(timeout);
    snapshotNodes.forEach(el => el.remove());
    node.remove();
    live.removeAttribute('style');
    // Restore only our wrapper; avoid replacing a later instrumented fetch.
    window.fetch = fetchOriginal;
  };
  const poll = window.setInterval(() => {
    const heading = live.querySelector('h1')?.textContent?.trim();
    const articleReady = !data.article || Array.from(document.querySelectorAll('[role="dialog"]')).some(el => !el.closest('[data-public-snapshot]') && (el.textContent || '').length > 200);
    if (heading && (!expectedHeading || heading === expectedHeading) && articleReady && pending === 0 && Date.now()-lastActivity > 700) finish();
  },100);
  const timeout = window.setTimeout(finish,15000);
  return live;
}
