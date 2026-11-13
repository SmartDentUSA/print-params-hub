/**
 * Camada visual "vidro premium" da Base de Conhecimento — mesma linguagem da
 * página institucional (KbTabInstitucional): fundo gelo com halos marinho/laranja,
 * superfícies translúcidas com blur, borda clara e realce interno.
 * Escopo sempre em `.kbs-root` para não afetar estilos compartilhados (cursos,
 * agenda/lives) fora da Base de Conhecimento. Somente apresentação.
 */
export const kbGlassStyles = `
.kbs-root{--g-ink:#363E56;--g-mut:#546085;--g-or:#E56838;
  --g-s1:rgba(255,255,255,.26);--g-s2:rgba(255,255,255,.5);--g-s3:rgba(255,255,255,.82);
  --g-line:rgba(255,255,255,.85);--g-hair:rgba(54,62,86,.08);
  --g-sh:0 1px 2px rgba(54,62,86,.06),0 24px 60px -34px rgba(54,62,86,.45);
  --g-sh-h:0 2px 4px rgba(54,62,86,.06),0 40px 80px -36px rgba(54,62,86,.55);
  position:relative;isolation:isolate;color:var(--g-ink);
  background:radial-gradient(70% 45% at 85% -5%,#ffffff 0%,transparent 60%),linear-gradient(180deg,#E3E8F2 0%,#EDF0F7 45%,#E6EAF3 100%);
  background-attachment:fixed}
.kbs-root:before,.kbs-root:after{content:"";position:fixed;z-index:-1;border-radius:50%;filter:blur(80px);pointer-events:none}
.kbs-root:before{width:560px;height:560px;left:120px;top:38%;background:radial-gradient(circle,rgba(54,62,86,.22),transparent 68%)}
.kbs-root:after{width:480px;height:480px;right:-120px;bottom:-80px;background:radial-gradient(circle,rgba(229,104,56,.18),transparent 68%)}

/* Barra lateral */
.kbs-root .kbs-side{background:linear-gradient(180deg,rgba(255,255,255,.66) 0%,rgba(255,255,255,.4) 100%);
  border-right:1px solid var(--g-line);-webkit-backdrop-filter:blur(22px) saturate(160%);backdrop-filter:blur(22px) saturate(160%);
  box-shadow:inset -1px 0 0 rgba(54,62,86,.05),14px 0 44px -36px rgba(54,62,86,.45)}
.kbs-root .kbs-side-label{color:rgba(84,96,133,.62);letter-spacing:.2em;font-size:10.5px}
.kbs-root .kbs-nav-btn{position:relative;color:var(--g-ink);border:1px solid transparent;font-weight:500;transition:background .2s,border-color .2s,box-shadow .2s,color .2s}
.kbs-root .kbs-nav-btn svg{color:var(--g-mut);opacity:.8}
.kbs-root .kbs-nav-btn:hover{background:var(--g-s2);border-color:rgba(255,255,255,.7);color:var(--g-ink)}
.kbs-root .kbs-nav-btn.on{background:var(--g-s3);border-color:#fff;color:var(--g-ink);font-weight:600;
  box-shadow:inset 0 1px 0 #fff,0 10px 24px -14px rgba(54,62,86,.45)}
.kbs-root .kbs-nav-btn.on:before{content:"";position:absolute;left:-1px;top:9px;bottom:9px;width:2px;border-radius:2px;background:var(--g-or)}
.kbs-root .kbs-nav-btn.on svg{color:var(--g-or);opacity:1}
.kbs-root .kbs-count{background:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.8);color:var(--g-mut)}
.kbs-root .kbs-nav-btn.on .kbs-count{background:var(--g-ink);border-color:var(--g-ink);color:#fff}
.kbs-root .kbs-nav-btn.cat{color:var(--g-mut)}
.kbs-root .kbs-nav-btn.cat svg{opacity:.55}
.kbs-root .kbs-nav-btn.cat.on{background:rgba(255,255,255,.6);color:var(--g-ink);box-shadow:inset 0 1px 0 rgba(255,255,255,.9)}
.kbs-root .kbs-nav-btn.cat.on:before{top:7px;bottom:7px}
.kbs-root .kbs-cta{position:relative;overflow:hidden;isolation:isolate;border-radius:18px;
  background:linear-gradient(150deg,rgba(84,96,133,.94) 0%,rgba(54,62,86,.97) 100%);border:1px solid rgba(255,255,255,.22);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 20px 40px -26px rgba(54,62,86,.7)}
.kbs-root .kbs-cta:after{content:"";position:absolute;z-index:-1;right:-60px;top:-60px;width:170px;height:170px;border-radius:50%;background:radial-gradient(circle,rgba(229,104,56,.45),transparent 70%)}
.kbs-root .kbs-cta a{background:rgba(255,255,255,.9);border:1px solid #fff;color:var(--g-ink);border-radius:10px;box-shadow:0 8px 18px -10px rgba(0,0,0,.45);transition:background .2s}
.kbs-root .kbs-cta a:hover{background:#fff}

/* Menu superior */
.kbs-root .kbs-topbar{background:rgba(255,255,255,.46);border-bottom:1px solid var(--g-line);
  -webkit-backdrop-filter:blur(20px) saturate(160%);backdrop-filter:blur(20px) saturate(160%);
  box-shadow:inset 0 -1px 0 rgba(54,62,86,.04),0 12px 32px -28px rgba(54,62,86,.45)}
.kbs-root .kbs-toptab{color:var(--g-mut);border:1px solid transparent;transition:background .2s,border-color .2s,box-shadow .2s,color .2s}
.kbs-root .kbs-toptab svg{opacity:.75}
.kbs-root .kbs-toptab:hover{background:var(--g-s2);border-color:rgba(255,255,255,.75);color:var(--g-ink)}
.kbs-root .kbs-toptab.on{background:var(--g-s3);border-color:#fff;color:var(--g-ink);font-weight:600;
  box-shadow:inset 0 1px 0 #fff,0 8px 20px -12px rgba(54,62,86,.45)}
.kbs-root .kbs-toptab.on svg{color:var(--g-or);opacity:1}
.kbs-root .kbs-mobile-btn{background:var(--g-s2);border:1px solid var(--g-line)}

/* Topo de cada aba */
.kbs-root .kbs-hero{border-radius:26px;
  background:linear-gradient(150deg,rgba(255,255,255,.8) 0%,rgba(255,255,255,.46) 55%,rgba(255,255,255,.32) 100%);
  border:1px solid var(--g-line);-webkit-backdrop-filter:blur(22px) saturate(160%);backdrop-filter:blur(22px) saturate(160%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.95),var(--g-sh)}
.kbs-root .kbs-hero-art:after{background:linear-gradient(90deg,rgba(255,255,255,.9) 0%,rgba(255,255,255,.74) 40%,rgba(255,255,255,.22) 70%,rgba(255,255,255,0) 100%)}
.kbs-root .kbs-hero-text:before{content:"";display:block;width:28px;height:2px;background:var(--g-or);margin-bottom:16px}
.kbs-root .kbs-hero-text h1{color:var(--g-ink);font-weight:600;letter-spacing:-.035em}
.kbs-root .kbs-hero-text p{color:var(--g-mut);font-family:'Poppins','Host Grotesk',system-ui,sans-serif}

/* Superfícies de vidro (cards e painéis das abas) */
.kbs-root .kb-card,.kbs-root .kb-rcard,.kbs-root .kb-glass-tile,
.kbs-root .pp-root .pp-card,.kbs-content .bg-card{
  background:linear-gradient(150deg,rgba(255,255,255,.78) 0%,rgba(255,255,255,.44) 55%,rgba(255,255,255,.32) 100%)!important;
  border:1px solid var(--g-line)!important;-webkit-backdrop-filter:blur(18px) saturate(160%);backdrop-filter:blur(18px) saturate(160%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.95),var(--g-sh)!important}
.kbs-root .kb-card,.kbs-root .kb-rcard,.kbs-root .pp-root .pp-card{border-radius:20px!important}
.kbs-root .kb-glass-tile{border-radius:16px!important}
.kbs-root .kb-card,.kbs-root .kb-rcard,.kbs-root .kb-glass-tile{position:relative;transition:transform .45s cubic-bezier(.2,.7,.2,1),box-shadow .45s,border-color .45s}
.kbs-root .kb-card:after,.kbs-root .kb-rcard:after,.kbs-root .kb-glass-tile:after{content:"";position:absolute;left:0;right:0;top:0;height:1px;z-index:2;pointer-events:none;
  background:linear-gradient(90deg,transparent,rgba(229,104,56,.55),transparent);opacity:0;transition:opacity .45s}
.kbs-root .kb-card:hover,.kbs-root .kb-rcard:hover,.kbs-root .kb-glass-tile:hover,.kbs-root .pp-root .pp-card:hover,.kbs-content a:hover>.bg-card{
  transform:translateY(-4px);border-color:#fff!important;box-shadow:inset 0 1px 0 #fff,var(--g-sh-h)!important}
.kbs-root .kb-card:hover:after,.kbs-root .kb-rcard:hover:after,.kbs-root .kb-glass-tile:hover:after{opacity:1}
.kbs-root .kb-cthumb-wrap{background:rgba(255,255,255,.35)}
.kbs-root .kb-cfoot,.kbs-root .kb-rcard-top,.kbs-root .kb-rfoot,.kbs-root .kb-rnotes,.kbs-root .kb-side-h{border-color:var(--g-hair)}
.kbs-root .kb-rnotes{background:rgba(255,255,255,.35)}
.kbs-root .kb-title,.kbs-root .kb-rcard-name,.kbs-root .kb-pitem-v,.kbs-root .kb-param-h-name,.kbs-root .kb-model-name{color:var(--g-ink)}
.kbs-root .kb-excerpt{color:var(--g-mut)}

/* Painéis de apoio */
.kbs-root .kb-side,.kbs-root .kb-param-empty,.kbs-root .kb-skel-card,.kbs-root .pp-root .pp-empty,.kbs-root .kb-lc-sort-menu{
  background:rgba(255,255,255,.6);border:1px solid var(--g-line);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 18px 44px -30px rgba(54,62,86,.35);border-radius:18px}
.kbs-root .kb-model-item{border-bottom-color:var(--g-hair)}
.kbs-root .kb-model-item:hover:not(.on){background:rgba(255,255,255,.5)}
.kbs-root .kb-model-item.on{background:rgba(255,255,255,.8);border-left-color:var(--g-or)}
.kbs-root .kb-model-thumb,.kbs-root .kb-rcard-img,.kbs-root .kb-param-h-img{background:rgba(255,255,255,.7)}
.kbs-root .kb-shimmer{background:linear-gradient(90deg,rgba(255,255,255,.35) 25%,rgba(255,255,255,.75) 50%,rgba(255,255,255,.35) 75%);background-size:200% 100%}
.kbs-root .kb-lc-sort-item:hover{background:rgba(255,255,255,.7)}
.kbs-root .kb-lc-sort-item.on{background:rgba(54,62,86,.07);color:var(--g-ink)}

/* Botões e filtros — três níveis de transparência */
.kbs-root .kb-chip,.kbs-root .kb-lc-sort-btn,.kbs-root .kb-lc-view,.kbs-root .kb-action-btn,.kbs-root .kb-glass-icon{
  background:var(--g-s1);border:1px solid rgba(255,255,255,.6)!important;color:var(--g-ink);
  -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:inset 0 1px 0 rgba(255,255,255,.55)}
.kbs-root .kb-glass-icon{background:var(--g-s1)!important}
.kbs-root .kb-chip:hover:not(.on),.kbs-root .kb-lc-sort-btn:hover,.kbs-root .kb-action-btn:hover,.kbs-root .kb-glass-icon:hover{
  background:rgba(255,255,255,.72)!important;border-color:#fff!important;color:var(--g-ink)}
.kbs-root .kb-chip.on,.kbs-root .kb-lc-view-btn.on{background:var(--g-s3);border-color:#fff!important;color:var(--g-ink);font-weight:600;
  box-shadow:inset 0 1px 0 #fff,0 6px 16px -10px rgba(54,62,86,.45)}
.kbs-root .kb-lc-view-btn{color:var(--g-mut)}
.kbs-root .kb-lc-view-btn:hover{background:rgba(255,255,255,.5);color:var(--g-ink)}
.kbs-root .kb-lc-view-btn.on svg{color:var(--g-or)}
.kbs-root .kb-action-btn{border-radius:10px;font-weight:600}
.kbs-root .kb-action-btn.pri{background:rgba(255,255,255,.66);border-color:rgba(255,255,255,.9)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 4px 14px -8px rgba(54,62,86,.35)}
.kbs-root .kb-action-btn.pri:before{content:"";width:5px;height:5px;border-radius:50%;background:var(--g-or)}
.kbs-root .kb-switcher{background:rgba(255,255,255,.5);border:1px solid var(--g-line);backdrop-filter:blur(16px);box-shadow:inset 0 1px 0 #fff,0 14px 34px -24px rgba(54,62,86,.4)}
.kbs-root .kb-tab-btn.on{background:var(--g-s3);color:var(--g-ink);box-shadow:inset 0 1px 0 #fff,0 6px 16px -10px rgba(54,62,86,.45)}
.kbs-root [role="group"][aria-label="Idioma"] button[aria-pressed="true"]{--tw-ring-color:rgba(229,104,56,.72)}

@media (max-width:960px){
  .kbs-root .kbs-side{background:rgba(255,255,255,.9)}
  .kbs-root .kbs-hero{border-radius:20px}
}
@media (prefers-reduced-motion:reduce){
  .kbs-root .kb-card,.kbs-root .kb-rcard,.kbs-root .kb-glass-tile{transition:none}
}
`;
