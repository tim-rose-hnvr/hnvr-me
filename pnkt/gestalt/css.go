package gestalt

// OrganicCSS ist die Tokenschicht des Handoffs, erweitert um das, was
// die bedienbaren Seiten brauchen. Erzeugt, nicht von Hand gepflegt:
// der obere Teil stammt aus organic.css des Designsystems.
const OrganicCSS = `/* Erzeugt aus dem Handoff. Die Schriften liegen im Binaer, nicht bei
   Google — siehe den Kommentar oben in gestalt.go. */
@font-face{font-family:'Caprasimo';font-style:normal;font-weight:400;font-display:swap;src:url('/gestalt/schrift/caprasimo-400-latin-ext.woff2') format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:'Caprasimo';font-style:normal;font-weight:400;font-display:swap;src:url('/gestalt/schrift/caprasimo-400-latin.woff2') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Figtree';font-style:normal;font-weight:400;font-display:swap;src:url('/gestalt/schrift/figtree-400-latin-ext.woff2') format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:'Figtree';font-style:normal;font-weight:400;font-display:swap;src:url('/gestalt/schrift/figtree-400-latin.woff2') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Figtree';font-style:normal;font-weight:600;font-display:swap;src:url('/gestalt/schrift/figtree-600-latin-ext.woff2') format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:'Figtree';font-style:normal;font-weight:600;font-display:swap;src:url('/gestalt/schrift/figtree-600-latin.woff2') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Figtree';font-style:normal;font-weight:700;font-display:swap;src:url('/gestalt/schrift/figtree-700-latin-ext.woff2') format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:'Figtree';font-style:normal;font-weight:700;font-display:swap;src:url('/gestalt/schrift/figtree-700-latin.woff2') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}

/* Organic — design-system tokens and component classes. This file is the source of truth for the system's look; retune it here and see readme.md. */


:root {
  --color-bg: #f5ead8;
  --color-surface: #ebddc5;
  --color-text: #201e1d;
  --color-accent: #c67139;
  --color-accent-2: #7a8a5e;
  --color-divider: color-mix(in srgb, #201e1d 16%, transparent);

  /* Tonal ramps — generated in OKLCH on one shared lightness scale, so the
     same step of any role matches the others in visual value. */
  --color-neutral-100: #f9f4ed;
  --color-neutral-200: #eee7db;
  --color-neutral-300: #dcd3c4;
  --color-neutral-400: #c0b6a5;
  --color-neutral-500: #a19786;
  --color-neutral-600: #82796a;
  --color-neutral-700: #645c50;
  --color-neutral-800: #474238;
  --color-neutral-900: #2e2b25;

  --color-accent-100: #fff2eb;
  --color-accent-200: #ffe1d0;
  --color-accent-300: #ffc6a5;
  --color-accent-400: #f6a06b;
  --color-accent-500: #d67f48;
  --color-accent-600: #b2622d;
  --color-accent-700: #8c491a;
  --color-accent-800: #643312;
  --color-accent-900: #402310;

  --color-accent-2-100: #f0fae1;
  --color-accent-2-200: #e1eecc;
  --color-accent-2-300: #ccdbb2;
  --color-accent-2-400: #aebf92;
  --color-accent-2-500: #8fa073;
  --color-accent-2-600: #728157;
  --color-accent-2-700: #56633f;
  --color-accent-2-800: #3d472b;
  --color-accent-2-900: #272e1b;

  --font-heading: "Caprasimo", system-ui, sans-serif;
  --font-heading-weight: 400;
  --font-body: "Figtree", system-ui, sans-serif;

  --space-1: 4.4px;
  --space-2: 8.8px;
  --space-3: 13.2px;
  --space-4: 17.6px;
  --space-6: 26.4px;
  --space-8: 35.2px;

  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 28px;

  /* Elevation — derived from the ground: soft ink-tinted shadows on a
     light theme, a hairline edge + ambient darkness on a dark one. */
  --shadow-sm: 0 1px 2px color-mix(in srgb, #2e2b25 14%, transparent);
  --shadow-md: 0 3px 10px color-mix(in srgb, #2e2b25 16%, transparent);
  --shadow-lg: 0 12px 32px color-mix(in srgb, #2e2b25 22%, transparent);
}

body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
}
h1, h2, h3, h4 { font-family: var(--font-heading); font-weight: var(--font-heading-weight); }

.washed{filter:saturate(0.6) contrast(0.85) brightness(1.1) opacity(0.94)}

/* ══════════════════════════════════════════════════════════════════════════
   Components — built with the tokens above. Plain CSS
   on plain HTML: no JavaScript, no build step. Each class is documented in
   readme.md and demonstrated in foundations/ and components/.
   ══════════════════════════════════════════════════════════════════════ */

*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; font-size: 15px; line-height: 1.55; font-weight: 400; }
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading); font-weight: var(--font-heading-weight);
  line-height: 1.12; letter-spacing: -0.015em; margin: 0 0 var(--space-2);
}
h1 { font-size: 42px; }
h2 { font-size: 32px; }
h3 { font-size: 25px; }
h4 { font-size: 20px; }
h5 { font-size: 16px; }
h6 { font-size: 13px; }
h6 { letter-spacing: 0.08em; text-transform: uppercase; }
p { margin: 0 0 var(--space-3); }
a { color: var(--color-accent); text-underline-offset: 3px; }
img { display: block; max-width: 100%; }
figure { margin: 0; }
figcaption {
  font-size: 11px; margin-top: var(--space-1);
  color: color-mix(in srgb, var(--color-text) 55%, transparent);
}
.text-muted { color: color-mix(in srgb, var(--color-text) 55%, transparent); }
:focus { outline: none; }
:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
::selection { background: color-mix(in srgb, var(--color-accent) 30%, transparent); }

/* — rules — */
.hr {
  height: 1px; border: 0; margin: var(--space-4) 0;
  background: var(--color-divider);
}

/* — buttons — */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  cursor: pointer; text-decoration: none;
  font-family: var(--font-heading); font-weight: var(--font-heading-weight);
  font-size: 14px; line-height: 1.2; color: var(--color-text); /* matches the .input's 14px —
     the pair sits side by side in sign-up rows */
  background: transparent; border: 1px solid transparent;
  padding: var(--space-2) calc(var(--space-3) * 1.2);
  border-radius: var(--radius-md);
}
.btn svg { display: block; }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-primary { background: var(--color-accent); color: var(--color-bg); }
.btn-primary:hover { background: var(--color-accent-600); }
.btn-primary:active { background: var(--color-accent-700); }
.btn-secondary { border-color: var(--color-divider); }
.btn-secondary:hover { background: color-mix(in srgb, var(--color-text) 7%, transparent); }
.btn-secondary:active { background: color-mix(in srgb, var(--color-text) 14%, transparent); }
.btn-ghost { color: var(--color-accent); padding-inline: var(--space-1); }
.btn-ghost:hover { background: color-mix(in srgb, var(--color-accent) 10%, transparent); }
.btn-ghost:active { background: color-mix(in srgb, var(--color-accent) 18%, transparent); }
.btn-icon { width: 36px; height: 36px; padding: 0; }
.btn-block { width: 100%; margin-top: var(--space-2); }

/* — forms — */
.field > label {
  display: block; font-size: 12px; margin-bottom: 5px;
  color: color-mix(in srgb, var(--color-text) 70%, transparent);
}
.input {
  width: 100%; min-height: 36px; padding: 6px 10px; font: inherit;
  font-size: 14px; color: var(--color-text); caret-color: var(--color-accent);
  background: var(--color-surface);
  border: 1px solid var(--color-divider); border-radius: var(--radius-md);
}
.input:hover { border-color: color-mix(in srgb, var(--color-text) 45%, transparent); }
.input:focus-visible { border-color: var(--color-accent); outline-offset: 0; }
textarea.input { min-height: 90px; resize: vertical; }
.radio { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; }
.radio input, .seg-opt input {
  position: absolute; opacity: 0; width: 0; height: 0; pointer-events: none;
}
.radio .dot {
  width: 16px; height: 16px; flex: none; border-radius: 50%;
  border: 1.5px solid var(--color-divider);
}
.radio:hover .dot { border-color: var(--color-accent); }
.radio input:checked + .dot {
  border-color: var(--color-accent); background: var(--color-accent);
  box-shadow: inset 0 0 0 4px var(--color-bg);
}
.radio input:focus-visible + .dot { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.seg {
  display: inline-flex; overflow: hidden;
  border: 1px solid var(--color-divider); border-radius: var(--radius-md);
}
.seg-opt {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px; font-size: 13px; cursor: pointer;
}
.seg-opt + .seg-opt { border-left: 1px solid var(--color-divider); }
.seg-opt:has(input:checked) { background: var(--color-accent); color: var(--color-bg); }
.seg-opt:not(:has(input:checked)):hover { background: color-mix(in srgb, var(--color-text) 7%, transparent); }
.seg-opt:has(input:focus-visible) { outline: 2px solid var(--color-accent); outline-offset: -2px; }

/* — cards — */
.card {
  display: flex; flex-direction: column; gap: var(--space-2);
  padding: var(--space-3); border-radius: var(--radius-md); background: var(--color-surface);
}
.card-kicker { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-accent); }
.card-title {
  font-family: var(--font-heading); font-weight: var(--font-heading-weight);
  font-size: 17px; line-height: 1.2;
}
.card-body { margin: 0; font-size: 13px; opacity: 0.8; flex: 1; }
.card-meta {
  display: flex; align-items: center; gap: 6px; font-size: 11px;
  color: color-mix(in srgb, var(--color-text) 50%, transparent);
}
.elev-sm { box-shadow: var(--shadow-sm); }
.elev-md { box-shadow: var(--shadow-md); }
.elev-lg { box-shadow: var(--shadow-lg); }

/* — tags — */
.tag {
  display: inline-flex; align-items: center; font-size: 11px;
  letter-spacing: 0.02em; padding: 3px 10px;
  border-radius: calc(var(--radius-md) * 0.75);
}
.tag-accent { background: var(--color-accent-100); color: var(--color-accent-800); }
.tag-accent-2 { background: var(--color-accent-2-100); color: var(--color-accent-2-800); }
.tag-neutral { background: var(--color-neutral-100); color: var(--color-neutral-800); }
.tag-outline { border: 1px solid var(--color-accent); color: var(--color-accent); }

/* — navigation — */
.nav {
  display: flex; align-items: center; gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-bottom: none;
}
.nav-brand {
  font-family: var(--font-heading); font-weight: var(--font-heading-weight);
  font-size: 18px; margin-right: auto;
}
.nav a { color: inherit; text-decoration: none; font-size: 14px; }
.nav a:hover, .nav a[aria-current='page'] { color: var(--color-accent); }

/* — tables — */
.table { width: 100%; border-collapse: collapse; font-size: 14px; }
.table th {
  text-align: left; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
  color: color-mix(in srgb, var(--color-text) 60%, transparent);
  padding: var(--space-2); border-bottom: 1px solid var(--color-divider);
}
.table td {
  padding: var(--space-2);
  border-bottom: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
}
.table tbody tr:hover { background: color-mix(in srgb, var(--color-text) 4%, transparent); }

/* — dialog — */
.dialog-backdrop {
  position: fixed; inset: 0; display: grid; place-items: center;
  padding: var(--space-4);
  background: color-mix(in srgb, var(--color-neutral-900) 50%, transparent);
}
.dialog {
  width: min(440px, 100%); display: flex; flex-direction: column; gap: var(--space-3);
  padding: var(--space-4); border-radius: var(--radius-lg);
  background: var(--color-surface); box-shadow: var(--shadow-lg);
}
.dialog-title {
  font-family: var(--font-heading); font-weight: var(--font-heading-weight);
  font-size: 20px;
}
.dialog-body { font-size: 14px; opacity: 0.85; }
.dialog-actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-2); }

/* — rounded frame: everything softens, small controls go pill — */
.card, .dialog { border-radius: calc(var(--radius-lg) * 1.15); }
.btn, .tag, .seg, .input { border-radius: 999px; }
.input { padding-inline: 14px; }



/* ══════════════════════════════════════════════════════════════════════
   Anwendungsflaechen — Studio, Zentrale, Produktpass, Hinweisseiten.
   Die Marketingseiten liegen in website/; hier steht, was die
   bedienbaren Seiten darueber hinaus brauchen.
   ══════════════════════════════════════════════════════════════════════ */

*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; -webkit-font-smoothing: antialiased; }

:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.ueberspringen {
  position: absolute; left: -9999px; top: 0; z-index: 20;
  background: var(--color-text); color: var(--color-bg);
  padding: 10px 18px; border-radius: 0 0 var(--radius-md) 0;
}
.ueberspringen:focus { left: 0; }

/* — Marke — */
.marke-lockup { display: flex; align-items: center; gap: 10px; text-decoration: none; color: inherit; }
.marke-zeichen {
  width: 32px; height: 32px; border-radius: 999px; flex: none;
  background: var(--color-accent); display: grid; place-items: center;
}
.marke-punkt { width: 10px; height: 10px; border-radius: 999px; background: var(--color-bg); }
.marke-wort { font-family: var(--font-heading); font-size: 23px; letter-spacing: -0.01em; }
.marke-trenner { color: var(--color-accent); }
.auf-dunkel .marke-punkt { background: var(--color-text); }
.auf-dunkel .marke-trenner { color: var(--color-accent-400); }

/* — Kopfleiste der Anwendung — */
.werkkopf {
  background: var(--color-bg);
  border-bottom: 1px solid color-mix(in srgb, var(--color-text) 10%, transparent);
}
.werkkopf-innen {
  max-width: 1320px; margin: 0 auto; padding: 14px 28px;
  display: flex; align-items: center; gap: 22px; flex-wrap: wrap;
}
.werkwege { display: flex; gap: 18px; align-items: center; margin-right: auto; }
.werkweg {
  display: flex; align-items: center; gap: 7px;
  font-size: 14.5px; font-weight: 500; text-decoration: none;
  color: color-mix(in srgb, var(--color-text) 78%, transparent);
}
.werkweg-aktiv { color: var(--color-accent-700); font-weight: 700; }
.werkweg:hover { color: var(--color-text); }

/* — Flaechen — */
.spur { max-width: 1320px; margin: 0 auto; padding: 26px 28px 56px; }
.tafel {
  background: var(--color-surface);
  border-radius: calc(var(--radius-lg) * 1.15);
  overflow: hidden;
}
.tafel-kopf {
  padding: 12px 18px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-text) 10%, transparent);
  font-family: var(--font-body); font-weight: 600; font-size: 11px;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: color-mix(in srgb, var(--color-text) 62%, transparent);
  display: flex; justify-content: space-between; align-items: baseline; gap: 14px;
}
.tafel-koerper { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
.teller { background: var(--color-bg); border-radius: var(--radius-lg); padding: 16px; }

.kicker {
  font-family: var(--font-body); font-weight: 600; font-size: 11px;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--color-accent-700); margin-bottom: 8px;
}

/* — Befunde: bestanden, Hinweis, Warnung —
   Nie eine Fehlermeldung, immer ein Vorschlag. Steht so im Handoff und
   ist die einzige Art, wie eine Pruefliste beim Gestalten hilft. */
.befund { display: flex; gap: 11px; align-items: flex-start; }
.befund-zeichen {
  width: 26px; height: 26px; border-radius: 999px; flex: none;
  display: grid; place-items: center; color: var(--color-bg);
}
.befund-gut .befund-zeichen { background: var(--color-accent-2); }
.befund-warn .befund-zeichen { background: var(--color-accent-500); }
.befund-schlecht .befund-zeichen { background: #a82e23; }
.befund-titel { font-size: 13.5px; font-weight: 700; }
.befund-grund { font-size: 12.5px; color: color-mix(in srgb, var(--color-text) 65%, transparent); }

/* — Formfelder in der Flaeche — */
label.feld { display: flex; flex-direction: column; gap: 5px; font-size: 12px;
  color: color-mix(in srgb, var(--color-text) 62%, transparent); font-weight: 600;
  letter-spacing: 0.04em; text-transform: uppercase; }
.eingabe {
  font: inherit; font-size: 14px; padding: 9px 12px;
  border: 1px solid color-mix(in srgb, var(--color-text) 22%, transparent);
  border-radius: var(--radius-md);
  background: var(--color-bg); color: var(--color-text);
  width: 100%; min-width: 0;
}
.eingabe:hover { border-color: color-mix(in srgb, var(--color-text) 40%, transparent); }
.eingabe:focus-visible { border-color: var(--color-accent); }

/* — Formwahl: Modulformen, Augen, Farben — */
.wahlreihe { display: flex; flex-wrap: wrap; gap: 6px; }
.wahl {
  font: inherit; font-size: 13px; cursor: pointer;
  padding: 7px 13px; border-radius: 999px;
  border: 1px solid transparent;
  background: var(--color-bg);
  color: color-mix(in srgb, var(--color-text) 70%, transparent);
}
.wahl:hover { color: var(--color-text); }
.wahl[aria-pressed='true'] {
  background: var(--color-accent); color: var(--color-bg); font-weight: 600;
}

/* — Tabellen — */
.liste { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.liste th {
  text-align: left; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;
  font-weight: 700; padding: 10px 16px;
  color: color-mix(in srgb, var(--color-text) 60%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--color-text) 10%, transparent);
}
.liste td {
  padding: 12px 16px; vertical-align: top;
  border-bottom: 1px solid color-mix(in srgb, var(--color-text) 10%, transparent);
}
.liste tr:last-child td { border-bottom: none; }
.einsilbig { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }

.leer { padding: 40px 18px; text-align: center; font-size: 14px;
  color: color-mix(in srgb, var(--color-text) 60%, transparent); }
.meldung {
  padding: 12px 18px; font-size: 13.5px;
  background: #f7e7e5; color: #a82e23;
}

/* — Bewegung —
   Eine je Handlung. Mit prefers-reduced-motion bleibt nur das
   Ueberblenden; alles, was sich fortbewegt, wird still. */
@keyframes sweep { 0% { transform: translateY(-100%); } 100% { transform: translateY(1100%); } }
@keyframes spinslow { to { transform: rotate(360deg); } }
@keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }

.hebt { transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1); }
.hebt:hover { transform: translateY(-5px); }

/* Suchlinie ueber der Vorschau, solange gerechnet wird. Sie sagt genau
   eines: der Server ist dran. Ein Wartezeichen an der Stelle, an der
   sich gleich etwas aendert, wird gelesen — eines in der Ecke nicht. */
.suchlinie {
  position: absolute; left: 0; right: 0; top: 0; height: 8%;
  pointer-events: none; z-index: 3;
  background: linear-gradient(180deg,
    transparent, color-mix(in srgb, var(--color-accent) 40%, transparent), transparent);
  animation: sweep 1.1s cubic-bezier(0.45, 0, 0.55, 1) infinite;
}
.suchlinie[hidden] { display: none; }

/* Der Ring dreht, solange ein Paket gebaut wird. Kein Fortschritt in
   Prozent: der Server kennt ihn nicht, und eine erfundene Zahl, die bei
   90 stehen bleibt, ist schlimmer als keine. */
.laeuft {
  display: inline-block; width: 15px; height: 15px; vertical-align: -2px;
  margin-right: 8px; border-radius: 999px;
  border: 2px solid color-mix(in srgb, currentColor 30%, transparent);
  border-top-color: currentColor;
  animation: spinslow 0.9s linear infinite;
}

/* Das Siegel atmet einmal, wenn das Urteil umschlaegt — nicht bei jedem
   Tastenanschlag. Ausgeloest wird es im Studio, indem die Klasse neu
   gesetzt wird; deshalb keine Endlosschleife. */
.atmet { animation: breathe 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) 1; }

/* — Einschub —
   Faehrt von rechts ein und legt sich vor die Liste, ohne sie zu
   verlassen. Wer einen Code prueft, will danach den naechsten pruefen;
   eine eigene Seite kostet jedes Mal den Weg zurueck.

   Grund und Blatt sind zwei Elemente, weil sie zwei verschiedene
   Bewegungen machen: der Grund blendet auf, das Blatt faehrt. Mit
   prefers-reduced-motion bleibt nur das Aufblenden. */
.einschub-grund {
  position: fixed; inset: 0; z-index: 40;
  background: color-mix(in srgb, var(--color-text) 38%, transparent);
  opacity: 0; transition: opacity 0.24s ease;
}
.einschub-grund[hidden], .einschub[hidden] { display: none; }
.einschub-grund.offen { opacity: 1; }

.einschub {
  position: fixed; top: 0; right: 0; bottom: 0; z-index: 41;
  width: min(460px, 100%); display: flex; flex-direction: column;
  background: var(--color-surface);
  box-shadow: -18px 0 48px color-mix(in srgb, var(--color-text) 22%, transparent);
  transform: translateX(100%);
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  overflow-y: auto;
}
.einschub.offen { transform: translateX(0); }

.einschub-kopf {
  position: sticky; top: 0; z-index: 1;
  display: flex; align-items: flex-start; gap: 14px;
  padding: 18px 20px 14px; background: var(--color-surface);
  border-bottom: 1px solid color-mix(in srgb, var(--color-text) 12%, transparent);
}
.einschub-kopf h2 {
  font-family: var(--font-heading); font-weight: var(--font-heading-weight);
  font-size: 20px; letter-spacing: -0.01em; margin: 0; flex: 1;
}
.einschub-zu {
  font: inherit; font-size: 22px; line-height: 1; cursor: pointer;
  background: none; border: none; color: var(--color-text);
  padding: 2px 6px; border-radius: 999px;
}
.einschub-zu:hover { background: color-mix(in srgb, var(--color-text) 10%, transparent); }
.einschub-koerper { padding: 16px 20px 28px; display: flex; flex-direction: column; gap: 18px; }
.einschub-block > h3 {
  font-size: 11px; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase;
  color: var(--color-accent-700); margin: 0 0 8px;
}

@media (max-width: 560px) {
  /* Auf dem Telefon ist ein 460-px-Blatt die ganze Breite. Dann faehrt
     es von unten — das ist die Geste, die dort gelernt ist. */
  .einschub {
    width: 100%; top: auto; height: 88vh; border-radius: 22px 22px 0 0;
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important; animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .hebt:hover { transform: none; }
  /* Der Einschub steht dann sofort da, statt zu fahren. Sichtbar bleibt
     er — abgeschaltet wird die Bewegung, nicht die Funktion. */
  .einschub { transition: none !important; }
  .suchlinie { display: none !important; }
}

@media (max-width: 760px) {
  .spur { padding: 18px 16px 40px; }
  .werkkopf-innen { padding: 12px 16px; gap: 14px; }
}
`
