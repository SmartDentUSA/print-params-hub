export const kbShellStyles = `
.kbs-root{display:flex;min-height:100vh;background:#EEF1F6;color:#0F172A;}
.kbs-side{width:248px;flex-shrink:0;background:#fff;border-right:1px solid #E5E7EB;display:flex;flex-direction:column;position:sticky;top:0;height:100vh;}
.kbs-side-logo{padding:20px 20px 16px;}
.kbs-side-logo img{height:32px;width:auto;}
.kbs-side-scroll{flex:1;overflow-y:auto;padding:8px 12px 16px;}
.kbs-side-label{font-size:11px;font-weight:600;letter-spacing:.08em;color:#94A3B8;text-transform:uppercase;padding:14px 10px 6px;}
.kbs-nav-btn{width:100%;display:flex;align-items:center;gap:12px;padding:10px 12px;margin-bottom:2px;border:none;background:none;color:#334155;font-size:14px;font-weight:500;border-radius:10px;cursor:pointer;text-align:left;transition:background .15s,color .15s;}
.kbs-nav-btn:hover{background:#F1F5F9;color:#0F172A;}
.kbs-nav-btn.on{background:#0F172A;color:#fff;font-weight:600;}
.kbs-nav-btn.on .kbs-count{background:rgba(255,255,255,.14);color:#fff;}
.kbs-nav-btn.cat{font-size:12.5px;padding:7px 10px;gap:10px;}
.kbs-nav-btn.cat .kbs-count{font-size:10.5px;padding:1px 7px;min-width:20px;}
.kbs-nav-btn.cat.on{background:#E2E8F0;color:#0F172A;font-weight:600;}
.kbs-nav-btn.cat.on .kbs-count{background:#0F172A;color:#fff;}
.kbs-nav-btn svg{width:17px;height:17px;flex-shrink:0;stroke-width:1.75;}
.kbs-count{margin-left:auto;font-size:11px;background:#EEF2F7;color:#475569;padding:2px 9px;border-radius:12px;font-weight:600;min-width:24px;text-align:center;}
.kbs-cta{margin:12px;padding:20px 16px;border-radius:14px;background:linear-gradient(160deg,#1E3A5F 0%,#0F172A 100%);color:#fff;}
.kbs-cta h4{font-size:14px;font-weight:700;margin:0 0 6px;line-height:1.25;}
.kbs-cta p{font-size:11.5px;line-height:1.45;margin:0 0 12px;opacity:.85;}
.kbs-cta a{display:inline-flex;align-items:center;gap:6px;background:#fff;color:#0F172A;font-size:12px;font-weight:600;padding:7px 12px;border-radius:8px;text-decoration:none;}
.kbs-main{flex:1;min-width:0;display:flex;flex-direction:column;}
.kbs-topbar{display:flex;align-items:center;gap:10px;padding:12px 24px;background:#fff;border-bottom:1px solid #E5E7EB;}
.kbs-toptabs{display:flex;align-items:center;gap:6px;flex:1;overflow-x:auto;scrollbar-width:none;}
.kbs-toptabs::-webkit-scrollbar{display:none;}
.kbs-toptab{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;font-size:13px;font-weight:500;color:#475569;background:none;border:none;border-radius:10px;cursor:pointer;white-space:nowrap;transition:background .15s,color .15s;}
.kbs-toptab:hover{background:#F1F5F9;color:#0F172A;}
.kbs-toptab.on{background:#0F172A;color:#fff;}
.kbs-toptab svg{width:15px;height:15px;}
.kbs-topright{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.kbs-content{padding:24px 28px 48px;max-width:1400px;width:100%;margin:0 auto;}
.kbs-content > *{position:relative;}
.kbs-content > .kbs-hero + *{margin-top:-38px;z-index:3;position:relative;}
.kbs-hero{position:relative;background:#fff;border-radius:18px;padding:40px 44px 76px;margin-bottom:20px;overflow:hidden;min-height:240px;display:flex;align-items:center;}
.kbs-hero-text{max-width:560px;position:relative;z-index:2;}
.kbs-hero-text h1{font-size:48px;line-height:1.05;margin:0 0 10px;font-weight:800;color:#0F172A;letter-spacing:-.025em;}
.kbs-hero-text p{font-size:15px;color:#64748B;margin:0;}
.kbs-hero-art{position:absolute;inset:0;background-size:cover;background-repeat:no-repeat;background-position:center right;pointer-events:none;z-index:0;}
.kbs-hero-art::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#fff 0%,rgba(255,255,255,0.92) 42%,rgba(255,255,255,0.35) 70%,rgba(255,255,255,0) 100%);}
.kbs-mobile-btn{display:none;}
@media (max-width: 960px){
  .kbs-side{position:fixed;left:0;top:0;bottom:0;transform:translateX(-100%);transition:transform .2s;z-index:60;box-shadow:0 10px 40px rgba(0,0,0,.15);}
  .kbs-side.open{transform:translateX(0);}
  .kbs-mobile-btn{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:8px;background:#F1F5F9;border:none;cursor:pointer;margin-right:auto;}
  .kbs-topbar{padding:10px 14px;}
  .kbs-content{padding:16px;}
  .kbs-hero{padding:20px 20px 48px;min-height:auto;}
  .kbs-hero-text h1{font-size:24px;}
  .kbs-hero-art{opacity:.35;}
  .kbs-content > .kbs-hero + *{margin-top:-28px;}
  .kbs-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.4);z-index:55;}
}
`;