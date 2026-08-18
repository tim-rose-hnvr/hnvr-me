// Baut aus dem gebauten Verzeichnis `dist/` eine einzige, in sich
// geschlossene HTML-Datei.
//
// Wozu: die Seite soll sichtbar sein, bevor ein Server und eine
// Domain stehen. Eine Datei ohne jeden äußeren Abruf lässt sich
// überall hinlegen — als Artefakt, als Anhang, auf einen Stick.
//
// Die Regel des Hauses gilt hier doppelt: nichts wird von außen
// geholt. Schriften und Bilder wandern als Daten-URI in die Datei,
// die sieben Seiten werden zu sieben Abschnitten, und die Wege
// dazwischen laufen über den Anker in der Adresse.
//
// Aufruf:  node skripte/eine-datei.mjs [ziel.html]
// Erwartet ein frisches `dist/` (npm run build).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';

const wurzel = resolve(import.meta.dirname, '..');
const dist = resolve(wurzel, 'dist');
const ziel = resolve(process.argv[2] ?? resolve(wurzel, 'pnkt-me.html'));

if (!existsSync(resolve(dist, 'index.html'))) {
  console.error('dist/index.html fehlt — erst `npm run build`.');
  process.exit(1);
}

// Reihenfolge zählt: sie bestimmt, welcher Abschnitt zuerst im
// Dokument steht, und damit auch, was ohne Anker zu sehen ist.
const seiten = [
  { id: 'start', weg: '/', datei: 'index.html' },
  { id: 'werkstatt', weg: '/werkstatt', datei: 'werkstatt/index.html' },
  { id: 'strecken', weg: '/strecken', datei: 'strecken/index.html' },
  { id: 'vorlagen', weg: '/vorlagen', datei: 'vorlagen/index.html' },
  { id: 'studio', weg: '/studio', datei: 'studio/index.html', stattdessen: true },
  { id: 'preise', weg: '/preise', datei: 'preise/index.html' },
  { id: 'lesbarkeit', weg: '/lesbarkeit', datei: 'lesbarkeit/index.html' },
  { id: 'massenanlage', weg: '/massenanlage', datei: 'massenanlage/index.html' },
  { id: 'schnittstelle', weg: '/schnittstelle', datei: 'schnittstelle/index.html' },
  { id: 'datenschutz', weg: '/datenschutz', datei: 'datenschutz/index.html' },
  { id: 'impressum', weg: '/impressum', datei: 'impressum/index.html' },
];
const nachWeg = new Map(seiten.map((s) => [s.weg, s.id]));

const typen = {
  // wasm und js sind neu: die Werkstatt bringt den Go-Kern mit. Beides
  // wandert wie alles andere als Daten-URI in die Datei — ob der
  // Betrachter WebAssembly ausfuehren darf, entscheidet seine Umgebung;
  // kann er es nicht, sagt die Seite das im Klartext.
  '.wasm': 'application/wasm',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const eingebettet = new Map();
function datenURI(pfad) {
  if (eingebettet.has(pfad)) return eingebettet.get(pfad);
  const datei = resolve(dist, pfad.replace(/^\//, ''));
  if (!existsSync(datei)) throw new Error(`Anhang fehlt: ${pfad}`);
  const typ = typen[extname(pfad).toLowerCase()];
  if (!typ) throw new Error(`Unbekannte Art: ${pfad}`);
  const uri = `data:${typ};base64,${readFileSync(datei).toString('base64')}`;
  eingebettet.set(pfad, uri);
  return uri;
}

const lies = (d) => readFileSync(resolve(dist, d), 'utf8');

// ─── Stil ───────────────────────────────────────────────────────────
// Astro teilt den Stil in einen gemeinsamen Brocken und je Seite einen
// eigenen. Die eigenen tragen ihre Marke (data-astro-cid-…) und stören
// sich nicht; doppelt eingebundene werden nur einmal genommen.
//
// Zwei Quellen, nicht eine: Astro legt kleine Stilbloecke direkt in den
// Kopf der Seite statt in eine Datei (inlineStylesheets: 'auto'). Wer
// nur die <link>-Zeilen einsammelt, baut eine Datei, in der genau die
// kleineren Seiten ungestaltet sind — und das faellt beim Bauen nicht
// auf, weil nichts fehlschlaegt.
const stilwege = [];
const stilbloecke = new Set();
for (const s of seiten) {
  const text = lies(s.datei);
  const kopf = text.slice(0, text.indexOf('<body'));
  for (const m of kopf.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)) {
    if (!stilwege.includes(m[1])) stilwege.push(m[1]);
  }
  for (const m of kopf.matchAll(/<style>([\s\S]*?)<\/style>/g)) stilbloecke.add(m[1]);
}
let stil = [...stilwege.map((w) => lies(w.replace(/^\//, ''))), ...stilbloecke].join('\n');
stil = stil.replace(/url\((\/(?:schrift|assets)\/[^)]+)\)/g, (_, p) => `url(${datenURI(p)})`);

// ─── Rumpf ──────────────────────────────────────────────────────────
// Schneidet ein Element samt Inhalt heraus. Die schließende Marke wird
// gezählt, nicht gesucht: `</header>` steht auch mitten im Seiteninhalt,
// und die letzte Fundstelle liegt irgendwo weit hinter dem Kopf.
function element(text, marke, tag) {
  const a = text.indexOf(marke);
  if (a < 0) throw new Error(`Marke nicht gefunden: ${marke}`);
  const paare = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
  paare.lastIndex = a;
  let tiefe = 0;
  for (let m; (m = paare.exec(text)); ) {
    if (m[0][1] === '/') {
      if (--tiefe === 0) return text.slice(a, m.index + m[0].length);
    } else tiefe++;
  }
  throw new Error(`Kein Ende für ${marke}`);
}

const startseite = lies('index.html');
const kopf = element(startseite, '<header class="kopf"', 'header');
const fuss = element(startseite, '<footer class="fuss"', 'footer');
const riegel = startseite.includes('vorschauriegel')
  ? element(startseite, '<div class="vorschauriegel"', 'div')
  : '';

// Die Werkstatt kommt hier NICHT mit. Sie ist kein Text, sondern ein
// Programm: sie braucht den nach WebAssembly übersetzten Go-Kern (3,4 MB)
// und die Skripte, die ihn bedienen. Diese Datei sammelt nur den Inhalt
// von <main> ein — die Skripte blieben draußen, und die Seite stünde als
// stummes Gerüst da. Ein Regler, der nichts tut, ist schlimmer als ein
// ehrlicher Hinweis.
const ersatzWerkstatt = `
  <section class="spur">
    <h1 class="titel-seite">Die Werkstatt fehlt in dieser Datei</h1>
    <p class="fliess">
      Sie ist als einzige Seite kein Text, sondern ein Programm: der Kern von
      pnkt läuft dort im Browser, übersetzt nach WebAssembly, 3,4 MB.
      Diese Einzeldatei sammelt Seiten ein, keine Programme — deshalb steht
      hier ein Hinweis und kein Gerüst aus Reglern, die nichts tun.
    </p>
    <p class="fliess">
      Die Werkstatt läuft unter
      <b>punkt-954d3e9b-hnvrme.wix-site-host.com/studio</b>.
    </p>
  </section>`;

const abschnitte = seiten
  .map((s) => {
    const inhalt = s.stattdessen
      ? ersatzWerkstatt
      : element(lies(s.datei), '<main id="inhalt">', 'main')
          .replace(/^<main id="inhalt">/, '')
          .replace(/<\/main>$/, '');
    return `<section class="blatt" data-blatt="${s.id}" hidden>${inhalt}</section>`;
  })
  .join('\n');

let rumpf = `${riegel}\n${kopf}\n<main id="inhalt">\n${abschnitte}\n</main>\n${fuss}`;

// Bilder einbetten.
rumpf = rumpf.replace(/src="(\/assets\/[^"]+)"/g, (_, p) => `src="${datenURI(p)}"`);

// Wege umschreiben: aus /werkstatt#serie wird ein Anker, den der
// kleine Umschalter unten liest. Was nicht in der Liste steht, bleibt
// wie es ist — dann fällt es beim Prüfen auf.
rumpf = rumpf.replace(/href="(\/[a-z]*)(?:#([a-z0-9-]+))?"/g, (ganz, weg, anker) => {
  const id = nachWeg.get(weg);
  if (!id) return ganz;
  const marke = anker ? `${id}~${anker}` : id;
  return `href="#${marke}" data-blattziel="${id}"${anker ? ` data-anker="${anker}"` : ''}`;
});

// Das aria-current der gebauten Seite gilt nur für die Startseite; der
// Umschalter setzt es neu. Die vorgebackene Auszeichnung muss weg,
// sonst stehen zwei Wege gleichzeitig als aktuell da.
rumpf = rumpf.replace(/ class="weg weg-aktiv"/g, ' class="weg"').replace(/ aria-current="page"/g, '');

const uebrig = [...rumpf.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]);
if (uebrig.length) {
  console.error('Nicht aufgelöste Verweise:', [...new Set(uebrig)].join(', '));
  process.exit(1);
}

const titel = 'pnkt.me';

const schalter = `
<script>
  // Sieben Seiten in einem Dokument. Sichtbar ist genau eine; welche,
  // steht im Anker der Adresse — so bleiben Zurück und Vorwärts heil
  // und ein Verweis auf eine Unterseite lässt sich weitergeben.
  (function () {
    var blaetter = document.querySelectorAll('.blatt');
    var wege = document.querySelectorAll('[data-blattziel]');
    var bekannt = {};
    blaetter.forEach(function (b) { bekannt[b.dataset.blatt] = b; });

    function zeige(id, anker, springen) {
      if (!bekannt[id]) id = 'start';
      blaetter.forEach(function (b) { b.hidden = b.dataset.blatt !== id; });
      document.querySelectorAll('.weg').forEach(function (a) {
        var ist = a.dataset.blattziel === id;
        a.classList.toggle('weg-aktiv', ist);
        if (ist) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
      var ziel = anker && document.getElementById(anker);
      if (ziel) ziel.scrollIntoView({ behavior: 'auto', block: 'start' });
      else if (springen) window.scrollTo(0, 0);
    }

    function ausAnker(springen) {
      var roh = decodeURIComponent(location.hash.replace(/^#/, ''));
      // Sprungmarken der Seite selbst (etwa #inhalt) sind keine Wege.
      if (roh && !bekannt[roh.split('~')[0]]) return;
      var teile = roh.split('~');
      zeige(teile[0] || 'start', teile[1], springen);
    }

    window.addEventListener('hashchange', function () { ausAnker(true); });
    // Ein Klick auf den schon offenen Weg löst kein hashchange aus —
    // deshalb wird zusätzlich von Hand geschaltet.
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-blattziel]');
      if (!a) return;
      e.preventDefault();
      var marke = a.getAttribute('href').replace(/^#/, '');
      if (location.hash.replace(/^#/, '') === marke) ausAnker(true);
      else location.hash = marke;
    });

    ausAnker(false);
  })();
</script>`;

const aus = `<title>${titel}</title>
<style>
${stil}
.blatt[hidden] { display: none; }
</style>
${rumpf}
${schalter}
`;

writeFileSync(ziel, aus);
const mb = (Buffer.byteLength(aus) / 1048576).toFixed(2);
console.log(`${ziel} — ${mb} MB, ${seiten.length} Abschnitte, ${eingebettet.size} Anhänge eingebettet`);
