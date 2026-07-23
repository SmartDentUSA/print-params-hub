export const kbStyles = `
.kb-root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 28px 24px 64px;
  font-family: 'Host Grotesk', 'Inter', system-ui, -apple-system, sans-serif;
  color: #1C1E23;
}
.kb-root *,
.kb-root *::before,
.kb-root *::after { box-sizing: border-box; }

@keyframes kbFadeIn { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: translateY(0); } }
@keyframes kbShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* Chips + list controls on same row */
.kb-chips-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.kb-chips-row > .kb-cw { flex: 1 1 auto; margin: 0; }
.kb-chips-row > .kb-lc { margin: 0; flex: 0 0 auto; }

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
.kb-tab-btn.on { background: #363E56; color: #FFFFFF; box-shadow: 0 2px 8px rgba(54,62,86,0.28); }

/* Section header */
.kb-section-header { text-align: center; margin-bottom: 24px; }
.kb-section-header h1 { font-size: 24px; font-weight: 600; margin: 0 0 5px; color: #1C1E23; }
.kb-section-header p { font-size: 14px; color: #5F6368; margin: 0; }

/* Search */
.kb-sw { position: relative; width: 33.333%; min-width: 320px; margin: 0 auto 20px 0; }
.kb-si { position: absolute; left: 18px; top: 50%; transform: translateY(-50%); color: #5F6368; pointer-events: none; display: inline-flex; }
.kb-si-in {
  width: 100%; padding: 13px 20px 13px 50px;
  border: 1px solid rgba(255,255,255,0.5); border-radius: 40px;
  font-size: 15px; color: #1C1E23; background: rgba(255,255,255,0.35);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04); outline: none;
  transition: border-color 0.15s, background 0.15s;
  font-family: inherit;
}
.kb-si-in::placeholder { color: #9AA0A6; font-size: 15px; }
.kb-si-in:hover { border-color: rgba(255,255,255,0.75); background: rgba(255,255,255,0.55); }
.kb-si-in:focus { border-color: #DE6E37; background: rgba(255,255,255,0.65); box-shadow: 0 0 0 3px rgba(222,110,55,0.15); }

/* Chips */
.kb-cw { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; }
.kb-cw--right {
  width: fit-content;
  max-width: 72%;
  margin-left: auto;
}
@media (max-width: 768px) {
  .kb-cw--right { width: 100%; max-width: 100%; }
}
.kb-chip {
  padding: 6px 16px; border-radius: 20px;
  border: 1px solid rgba(0,0,0,0.13); background: transparent;
  font-size: 13px; font-weight: 500; color: #5F6368;
  white-space: nowrap; cursor: pointer; transition: all 0.15s;
  font-family: inherit;
}
.kb-chip:hover:not(.on) { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.20); color: #1C1E23; }
.kb-chip.on { background: #363E56; border-color: #363E56; color: #FFFFFF; }

/* Result count */
.kb-count { text-align: center; font-size: 12px; color: #9AA0A6; margin: -6px 0 14px; }

/* List controls (sort + view toggle) */
.kb-lc { display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin: 4px 0 14px; }
.kb-lc-sort { position: relative; }
.kb-lc-sort-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; border-radius: 20px;
  border: 1px solid rgba(0,0,0,0.13); background: #FFFFFF;
  font-size: 13px; font-weight: 500; color: #1C1E23;
  cursor: pointer; font-family: inherit; transition: all 0.15s;
}
.kb-lc-sort-btn:hover { background: #F6F8FB; border-color: rgba(0,0,0,0.22); }
.kb-lc-sort-menu {
  position: absolute; right: 0; top: calc(100% + 6px); z-index: 40;
  min-width: 180px; background: #FFFFFF;
  border: 1px solid rgba(0,0,0,0.08); border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0,0,0,0.12); padding: 6px;
}
.kb-lc-sort-item {
  display: block; width: 100%; text-align: left;
  padding: 8px 10px; border-radius: 8px; border: none; background: transparent;
  font-size: 13px; color: #1C1E23; cursor: pointer; font-family: inherit;
}
.kb-lc-sort-item:hover { background: #F6F8FB; }
.kb-lc-sort-item.on { background: rgba(54,62,86,0.08); color: #363E56; font-weight: 600; }
.kb-lc-view {
  display: inline-flex; background: #FFFFFF;
  border: 1px solid rgba(0,0,0,0.13); border-radius: 20px; padding: 3px;
}
.kb-lc-view-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 28px; border-radius: 16px;
  border: none; background: transparent; color: #5F6368; cursor: pointer;
  transition: all 0.15s;
}
.kb-lc-view-btn:hover { color: #1C1E23; background: #F6F8FB; }
.kb-lc-view-btn.on { background: #363E56; color: #FFFFFF; }

/* List view */
.kb-grid.kb-list {
  display: flex; flex-direction: column; gap: 10px;
}
.kb-grid.kb-list .kb-card {
  flex-direction: row; align-items: stretch;
}
.kb-grid.kb-list .kb-cthumb-wrap {
  width: 240px; flex-shrink: 0;
}
.kb-grid.kb-list .kb-cthumb { height: 100%; aspect-ratio: auto; min-height: 130px; }
.kb-grid.kb-list .kb-cthumb-fallback { min-height: 130px; }
.kb-grid.kb-list .kb-cbody { padding: 14px 18px; }
.kb-grid.kb-list .kb-title { -webkit-line-clamp: 2; font-size: 15px; }
.kb-grid.kb-list .kb-excerpt { -webkit-line-clamp: 3; font-size: 13px; }
@media (max-width: 640px) {
  .kb-grid.kb-list .kb-card { flex-direction: column; }
  .kb-grid.kb-list .kb-cthumb-wrap { width: 100%; }
  .kb-grid.kb-list .kb-cthumb { aspect-ratio: 16 / 9; min-height: 0; }
}

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
  border: 1px solid rgba(84,96,133,0.14);
  box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
  overflow: hidden; display: flex; flex-direction: column;
  animation: kbFadeIn 0.28s ease both;
  transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
}
.kb-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 28px rgba(0,0,0,.13);
  border-color: rgba(84,96,133,0.35);
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
  border-top: 1px solid rgba(84,96,133,0.14);
  display: flex; justify-content: space-between; align-items: center; gap: 6px;
}
.kb-date { font-size: 11px; color: #9AA0A6; }
.kb-action-btn {
  font-size: 11px; font-weight: 500; color: #363E56;
  padding: 4px 10px;
  border: 1px solid rgba(54,62,86,0.30); border-radius: 16px;
  background: transparent; cursor: pointer;
  text-decoration: none; display: inline-flex; align-items: center; gap: 4px;
  font-family: inherit; transition: all 0.15s;
}
.kb-action-btn:hover { background: rgba(54,62,86,0.08); border-color: #363E56; }

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
  border: 1px solid rgba(84,96,133,0.14);
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
  border-bottom: 1px solid rgba(84,96,133,0.14);
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
.kb-model-item.on { border-left-color: #363E56; background: rgba(84,96,133,0.08); }
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
  background: #FFFFFF; border: 1px solid rgba(84,96,133,0.14);
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
  overflow: hidden;
  animation: kbFadeIn 0.22s ease both;
  transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
}
.kb-rcard:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,.08);
  border-color: rgba(84,96,133,0.35);
  transform: translateY(-2px);
}
.kb-rcard-top {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid rgba(84,96,133,0.14);
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
  border-top: 1px solid rgba(84,96,133,0.14);
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 6px;
}
.kb-aa-badge { font-size: 11px; font-weight: 500; padding: 3px 8px; border-radius: 5px; }

.kb-rnotes {
  padding: 8px 16px 12px;
  border-top: 1px solid rgba(84,96,133,0.14);
  background: #F6F8FB;
  font-size: 11px; color: #5F6368; line-height: 1.4;
}

/* Scrollbar (scoped) */
.kb-root ::-webkit-scrollbar { width: 5px; }
.kb-root ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.13); border-radius: 3px; }
`;