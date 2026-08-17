/**
 * Das Aussehen des Editors, als Zeichenkette statt als CSS-Datei.
 *
 * Grund: der Editor soll als Custom Element in fremde Seiten gehen. Eine
 * separate CSS-Datei wäre dort ein zusätzlicher Abruf und eine zusätzliche
 * Fehlerquelle; eingebettet ist sie immer da.
 */
export const EDITOR_STIL = `
.studio-editor{position:relative;display:flex;align-items:center;justify-content:center;
  width:100%;height:100%;overflow:hidden;background:var(--studio-grund,#eceef2);
  touch-action:none;user-select:none}
.studio-buehne{position:relative;transform-origin:50% 50%;box-shadow:0 6px 28px rgba(0,0,0,.18)}
.studio-blatt{position:absolute;inset:0}
.studio-ebene{position:absolute;inset:0;pointer-events:none}
.studio-linie{position:absolute;pointer-events:none}
.studio-endformat{outline:1px dashed rgba(0,0,0,.35);outline-offset:0}
.studio-sicherheit{outline:1px dashed rgba(0,120,255,.5)}
.studio-rahmen{position:absolute;outline:2px solid #2b7fff;pointer-events:none}
.studio-rahmen.studio-gesperrt{outline-color:#b3261e;outline-style:dashed}
.studio-griff{position:absolute;transform:translate(-50%,-50%);background:#fff;
  border:2px solid #2b7fff;border-radius:2px;pointer-events:auto}
.studio-schloss{position:absolute;left:0;top:-1.6em;font:600 12px/1 system-ui;color:#b3261e;
  background:#fff;padding:2px 5px;border-radius:3px;white-space:nowrap}
.studio-blatt [data-typ]{cursor:default}
.studio-blatt [data-typ]:not([data-typ="hintergrund"]){cursor:move}
.studio-blatt [data-gesperrt="1"]{cursor:not-allowed}
.studio-blatt [contenteditable="true"]{outline:2px solid #2b7fff;cursor:text}
`;
