export const kbStyles = `
.kb-root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 28px 24px 64px;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  color: #1C1E23;
}
.kb-root *,
.kb-root *::before,
.kb-root *::after { box-sizing: border-box; }

@keyframes kbFadeIn { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: translateY(0); } }
@keyframes kbShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* Switcher */
.kb-switcher-wrap { display: flex; justify-content: center; margin-bottom: 28px; }
.kb-switcher {
  background: #FFFFFF; border-radius: 30px; padding: 5px;
  box-shadow: 0 4px 16px rgba(0,0,0,.08); display: flex; gap: 2px; flex-wrap: wrap;
}
.kb-tab-btn {
  padding: 8px 22px; border-radius: 22px; border: none; background: transparent;
  font-size: 14px; font-weight: 500; color: #5F6368; cursor: pointer;
  display: flex; align-items: center; gap: 7px; white-space: nowrap;
  transition: all 0.18s;
}
.kb-tab-btn:hover:not(.on) { background: #F6F8FB; color: #1C1E23; }
.kb-tab-btn.on { background: #1A73E8; color: #FFFFFF; box-shadow: 0 2px 8px rgba(26,115,232,0.35); }

/* Section header */
.kb-section-header { text-align: center; margin-bottom: 24px; }
.kb-section-header h1 { font-size: 24px; font-weight: 600; margin: 0 0 5px; color: #1C1E23; }
.kb-section-header p { font-size: 14px; color: #5F6368; margin: 0; }

/* Search */
.kb-sw { position: relative; width: 33.333%; min-width: 320px; margin: 0 auto 20px 0; }
.kb-si { position: absolute; left: 18px; top: 50%; transform: translateY(-50%); color: #5F6368; pointer-events: none; display: inline-flex; }
.kb-si-in {
  width: 100%; padding: 13px 20px 13px 50px;
  border: 1px solid #C8CACF; border-radius: 40px;
  font-size: 15px; color: #1C1E23; background: #E8ECF4;
  box-shadow: none; outline: none;
  transition: border-color 0.15s, background 0.15s;
  font-family: inherit;
}
.kb-si-in::placeholder { color: #9AA0A6; font-size: 15px; }
.kb-si-in:hover, .kb-si-in:focus { border-color: #9AA0A6; background: #E2E6EE; }

/* Chips */
.kb-cw { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; }
.kb-chip {
  padding: 6px 16px; border-radius: 20px;
  border: 1px solid rgba(0,0,0,0.13); background: transparent;
  font-size: 13px; font-weight: 500; color: #5F6368;
  white-space: nowrap; cursor: pointer; transition: all 0.15s;
  font-family: inherit;
}
.kb-chip:hover:not(.on) { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.20); color: #1C1E23; }
.kb-chip.on { background: #1A73E8; border-color: #1A73E8; color: #FFFFFF; }

/* Result count */
.kb-count { text-align: center; font-size: 12px; color: #9AA0A6; margin: -6px 0 14px; }

/* Grid */
.kb-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;
}
@media (max-width: 1100px) { .kb-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 768px)  { .kb-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 480px)  { .kb-grid { grid-template-columns: 1fr; } }

/* Distribuidores grid (2 colunas) */
.kb-dgrid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;
}
.kb-dgrid .kb-empty { grid-column: 1 / -1; }
@media (max-width: 768px)  { .kb-dgrid { grid-template-columns: 1fr; } }

/* Card */
.kb-card {
  background: #FFFFFF; border-radius: 14px;
  border: 1px solid rgba(0,0,0,0.07);
  box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
  overflow: hidden; display: flex; flex-direction: column;
  animation: kbFadeIn 0.28s ease both;
  transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
}
.kb-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 28px rgba(0,0,0,.13);
  border-color: rgba(26,115,232,0.20);
}
.kb-cthumb-wrap { position: relative; cursor: pointer; }
.kb-cthumb { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; }
.kb-cthumb-fallback {
  display: flex; align-items: center; justify-content: center;
  font-size: 32px; color: #FFFFFF;
}
.kb-dur-badge {
  position: absolute; bottom: 6px; right: 6px;
  background: rgba(0,0,0,0.72); color: #FFFFFF;
  font-size: 10px; font-weight: 500;
  padding: 2px 6px; border-radius: 4px;
}
.kb-cbody { padding: 13px 15px 15px; display: flex; flex-direction: column; flex: 1; }
.kb-meta { display: flex; align-items: center; gap: 6px; margin-bottom: 7px; flex-wrap: wrap; }
.kb-cat-badge {
  display: inline-flex; align-items: center; justify-content: center;
  width: 19px; height: 19px; border-radius: 5px;
  font-size: 10px; font-weight: 700;
}
.kb-cat-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
.kb-special-badge { font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.5px; }
.kb-title {
  font-size: 13px; font-weight: 600; color: #1C1E23;
  line-height: 1.4; margin: 0 0 6px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.kb-excerpt {
  font-size: 12px; color: #5F6368; line-height: 1.5; margin: 0; flex: 1;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.kb-cfoot {
  margin-top: 10px; padding-top: 9px;
  border-top: 1px solid rgba(0,0,0,0.07);
  display: flex; justify-content: space-between; align-items: center; gap: 6px;
}
.kb-date { font-size: 11px; color: #9AA0A6; }
.kb-action-btn {
  font-size: 11px; font-weight: 500; color: #1A73E8;
  padding: 4px 10px;
  border: 1px solid rgba(26,115,232,0.30); border-radius: 16px;
  background: transparent; cursor: pointer;
  text-decoration: none; display: inline-flex; align-items: center; gap: 4px;
  font-family: inherit; transition: all 0.15s;
}
.kb-action-btn:hover { background: rgba(26,115,232,0.10); border-color: #1A73E8; }

/* Empty state */
.kb-empty {
  grid-column: 1 / -1;
  text-align: center; padding: 60px 20px;
}
.kb-empty-icon { font-size: 44px; margin-bottom: 10px; }
.kb-empty-text { font-size: 14px; color: #9AA0A6; }

/* Skeleton */
.kb-shimmer {
  background: linear-gradient(90deg, #E8ECF2 25%, #F4F6F9 50%, #E8ECF2 75%);
  background-size: 200% 100%;
  animation: kbShimmer 1.4s infinite;
  border-radius: 6px;
}
.kb-skel-card {
  background: #FFFFFF; border-radius: 14px;
  border: 1px solid rgba(0,0,0,0.07);
  box-shadow: 0 1px 3px rgba(0,0,0,.06);
  overflow: hidden;
}
.kb-skel-thumb { width: 100%; aspect-ratio: 16/9; border-radius: 0; }
.kb-skel-body { padding: 13px 15px 15px; display: flex; flex-direction: column; gap: 8px; }
.kb-skel-line { border-radius: 4px; }

/* Parâmetros */
.kb-label {
  text-align: center; font-size: 13px; font-weight: 500;
  color: #5F6368; margin: 0 0 14px;
}
.kb-param-grid {
  display: grid; grid-template-columns: 230px 1fr; gap: 16px; align-items: start;
}
@media (max-width: 700px) { .kb-param-grid { grid-template-columns: 1fr; } }

.kb-side {
  background: #FFFFFF; border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
  overflow: hidden;
}
.kb-side-h {
  padding: 13px 16px 11px;
  border-bottom: 1px solid rgba(0,0,0,0.07);
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.6px; color: #9AA0A6;
}
.kb-side-empty { padding: 20px 14px; font-size: 12px; color: #9AA0A6; text-align: center; }

.kb-model-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; width: 100%; text-align: left;
  cursor: pointer; border: none;
  background: transparent;
  border-left: 3px solid transparent;
  border-bottom: 1px solid rgba(0,0,0,0.04);
  transition: all 0.15s;
  font-family: inherit;
}
.kb-model-item:hover:not(.on) { background: #F6F8FB; }
.kb-model-item.on { border-left-color: #1A73E8; background: rgba(26,115,232,0.05); }
.kb-model-thumb {
  width: 38px; height: 38px; object-fit: contain;
  border-radius: 7px; background: #F6F8FB; flex-shrink: 0;
}
.kb-model-thumb-fallback { display: flex; align-items: center; justify-content: center; font-size: 18px; }
.kb-model-meta { min-width: 0; flex: 1; }
.kb-model-name {
  font-size: 12px; font-weight: 600; color: #1C1E23;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.kb-model-count { font-size: 10px; color: #9AA0A6; }

.kb-param-area { min-height: 400px; }
.kb-param-empty {
  background: #FFFFFF; border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,.06);
  padding: 60px 24px; text-align: center;
}
.kb-param-empty-icon { font-size: 52px; margin-bottom: 10px; }
.kb-param-empty-t { font-size: 15px; font-weight: 500; color: #5F6368; margin-bottom: 4px; }
.kb-param-empty-s { font-size: 13px; color: #9AA0A6; }

.kb-param-h { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
.kb-param-h-img {
  width: 56px; height: 56px; object-fit: contain;
  border-radius: 10px; background: #F6F8FB;
  box-shadow: 0 1px 3px rgba(0,0,0,.06);
}
.kb-param-h-img-fallback { display: flex; align-items: center; justify-content: center; font-size: 28px; }
.kb-param-h-name { font-size: 17px; font-weight: 700; color: #1C1E23; }
.kb-param-h-sub { font-size: 12px; color: #9AA0A6; }

.kb-rgrid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;
}
@media (max-width: 1100px) { .kb-rgrid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px)  { .kb-rgrid { grid-template-columns: 1fr; } }

.kb-rcard {
  background: #FFFFFF; border: 1px solid rgba(0,0,0,0.07);
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
  overflow: hidden;
  animation: kbFadeIn 0.22s ease both;
  transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
}
.kb-rcard:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,.08);
  border-color: rgba(26,115,232,0.22);
  transform: translateY(-2px);
}
.kb-rcard-top {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid rgba(0,0,0,0.07);
}
.kb-rcard-img {
  width: 56px; height: 56px; object-fit: contain;
  border-radius: 8px; background: #F6F8FB; flex-shrink: 0;
}
.kb-rcard-img-fallback { display: flex; align-items: center; justify-content: center; font-size: 28px; }
.kb-rcard-meta { min-width: 0; flex: 1; }
.kb-rcard-name { font-size: 13px; font-weight: 600; color: #1C1E23; line-height: 1.3; margin-bottom: 4px; }
.kb-rcard-badges { display: flex; gap: 4px; flex-wrap: wrap; }
.kb-cert-badge { padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; }

.kb-rparams {
  padding: 14px 16px;
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 8px;
}
.kb-pitem-l {
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.6px; color: #9AA0A6;
}
.kb-pitem-v { font-size: 15px; font-weight: 700; color: #1C1E23; }
.kb-pitem-u { font-size: 9px; color: #9AA0A6; margin-left: 1px; font-weight: 500; }

.kb-rfoot {
  padding: 10px 16px 13px;
  border-top: 1px solid rgba(0,0,0,0.07);
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 6px;
}
.kb-aa-badge { font-size: 11px; font-weight: 500; padding: 3px 8px; border-radius: 5px; }

.kb-rnotes {
  padding: 8px 16px 12px;
  border-top: 1px solid rgba(0,0,0,0.07);
  background: #F6F8FB;
  font-size: 11px; color: #5F6368; line-height: 1.4;
}

/* Scrollbar (scoped) */
.kb-root ::-webkit-scrollbar { width: 5px; }
.kb-root ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.13); border-radius: 3px; }
`;