/**
 * Legt die 22 gezeichneten Vorlagen im Katalog an.
 *
 * Sie kommen aus dem alten System, wo ihr Schmuck nicht als Bild vorlag,
 * sondern als Zeichenbefehl. Die Formen stehen jetzt in `src/deko.ts`; hier
 * entsteht nur die Feldaufteilung — und zwar maßstabsgetreu zur alten
 * Komposition, damit ein Betreiber, der beide Stände kennt, dasselbe Blatt
 * wiedererkennt: Streifen mit 6 % Rand und 14 % Fuß, Foto mit 15 % Leiste.
 *
 *   node tools/deko-vorlagen.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';

const KATALOG = new URL('../vorlagen-katalog.json', import.meta.url);

/* Maße aus dem alten Renderer, unverändert. Wer sie ändert, ändert das
   Blatt — deshalb stehen sie hier als Zahlen und nicht als „ungefähr". */
const STREIFEN = { breite: 600, hoehe: 1800, randAnteil: 0.06, fussAnteil: 0.14 };
const FOTO = { breite: 1800, hoehe: 1200, leisteAnteil: 0.15 };

/** Mittiges Textfeld aus Grundlinie und Schriftgröße. */
function textFeld(id, grundlinie, groesse, hoehe, rest) {
  // Der Renderer setzt Text auf die Mitte des Feldes, das alte System auf
  // die Grundlinie. Der Versatz ist etwa 35 % der Schriftgröße.
  const mitte = (grundlinie - groesse * 0.35) / hoehe;
  const h = (groesse * 1.2) / hoehe;
  return { id, art: 'text', y: Number((mitte - h / 2).toFixed(4)), h: Number(h.toFixed(4)), groesse: Math.round(groesse), ...rest };
}

function streifenFelder(n, titel, unten) {
  const { breite: W, hoehe: H, randAnteil, fussAnteil } = STREIFEN;
  const M = W * randAnteil;
  const fuss = H * fussAnteil;
  const zellH = (H - fuss - M * (n + 1)) / n;
  const felder = [];
  for (let i = 0; i < n; i++) {
    felder.push({
      id: 'b' + (i + 1),
      art: 'bild',
      x: Number((M / W).toFixed(4)),
      y: Number(((M + i * (zellH + M)) / H).toFixed(4)),
      b: Number(((W - M * 2) / W).toFixed(4)),
      h: Number((zellH / H).toFixed(4)),
    });
  }
  felder.push(
    textFeld('t1', H - fuss * 0.55, H * 0.045, H, {
      x: 0.06, b: 0.88, text: titel, gewicht: 600, schrift: 'serif', ausrichtung: 'mitte',
    })
  );
  if (unten) {
    felder.push(
      textFeld('t2', H - fuss * 0.2, H * 0.024, H, {
        x: 0.06, b: 0.88, text: unten, gewicht: 400, schrift: 'sans', ausrichtung: 'mitte', farbe: '@akzent',
      })
    );
  }
  return felder;
}

function fotoFelder(titel, unten) {
  const { hoehe: H, leisteAnteil } = FOTO;
  const leiste = H * leisteAnteil;
  const felder = [
    { id: 'b1', art: 'bild', x: 0, y: 0, b: 1, h: Number(((H - leiste) / H).toFixed(4)) },
    textFeld('t1', H - leiste * 0.32, leiste * 0.42, H, {
      x: 0.05, b: 0.55, text: titel, gewicht: 600, schrift: 'serif', ausrichtung: 'links',
    }),
  ];
  if (unten) {
    felder.push(
      textFeld('t2', H - leiste * 0.34, leiste * 0.28, H, {
        x: 0.55, b: 0.4, text: unten, gewicht: 400, schrift: 'sans', ausrichtung: 'rechts', farbe: '@akzent',
      })
    );
  }
  return felder;
}

/* Die 22 Vorlagen. Farben und Schmuck stammen aus dem alten Stand; die acht
   `eigen-*`-Blätter von damals bleiben draußen — dort war eine fremde Marke
   ins Papier gebrannt. */
const QUELLE = [
  ['hochzeit-gold', 'Hochzeit Gold', 'streifen', 3, '#1a1408', '#ffc857', '#f6f1e7', 'hochzeit-gold', true],
  ['hochzeit-creme', 'Hochzeit Creme', 'foto', 1, '#f6f1e7', '#3a2f22', '#b8926a', 'botanik', true, 'youbooth.me'],
  ['hochzeit-blush', 'Hochzeit Blush', 'streifen', 3, '#f3e3e0', '#7a4a4a', '#c98f8f', 'blush-blumen', true],
  ['hochzeit-deco', 'Hochzeit Art déco', 'foto', 1, '#12100d', '#ffc857', '#e8d3a0', 'art-deco', false],
  ['hochzeit-herzen', 'Hochzeit Herzen', 'streifen', 3, '#f7ecec', '#8a4a58', '#d98a9a', 'herzen', true],

  ['geburtstag-party', 'Party Vierer', 'streifen', 4, '#12100d', '#ffc857', '#ff5d8f', 'konfetti', false],
  ['geburtstag-bunt', 'Geburtstag Bunt', 'foto', 1, '#fff3d6', '#12100d', '#ff5d8f', 'ballons', true],
  ['geburtstag-sofort', 'Sofortbild', 'foto', 1, '#2a2622', '#f6f1e7', '#ffc857', 'sofortbild', false],

  ['firma-dunkel', 'Firma Dunkel', 'foto', 1, '#14171c', '#f6f1e7', '#8fd3ff', 'firma', false],
  ['firma-klar', 'Firma Klar', 'streifen', 3, '#f6f6f4', '#1a1a1a', '#4a5568', 'reiner-rahmen', false],

  ['silvester-gold', 'Silvester Gold', 'streifen', 3, '#0a0a14', '#ffc857', '#ff5d8f', 'feuerwerk', false],
  ['silvester-glanz', 'Silvester Glanz', 'foto', 1, '#101020', '#f6f1e7', '#ffc857', 'bokeh', true],
  ['silvester-deco', 'Silvester Art déco', 'streifen', 3, '#0a0a14', '#ffc857', '#e8d3a0', 'art-deco', false],

  ['abschluss-gold', 'Abschluss Gold', 'streifen', 3, '#14120c', '#ffc857', '#f6f1e7', 'lorbeer', false],
  ['abschluss-modern', 'Abschluss Modern', 'foto', 1, '#1c2333', '#f6f1e7', '#7ee081', 'firma', true],

  ['taufe-zart', 'Taufe Zart', 'foto', 1, '#eaf2f8', '#3a5a78', '#8fbcd8', 'sanfter-himmel', true],
  ['kommunion-weiss', 'Kommunion Weiß', 'streifen', 3, '#f8f6f0', '#6a6355', '#c9a227', 'botanik', true],

  ['weihnacht-rot', 'Weihnacht Rot', 'streifen', 3, '#2a0d0d', '#f6f1e7', '#7ee081', 'schnee', false],
  ['weihnacht-winter', 'Winter Edel', 'foto', 1, '#0f1a1a', '#f6f1e7', '#8fd3ff', 'schnee', true],

  ['party-neon', 'Neon Nacht', 'streifen', 3, '#12100d', '#ff5d8f', '#ffc857', 'neon', false],
  ['party-klassik', 'Klassik Hell', 'foto', 1, '#f6f1e7', '#12100d', '#6b6355', 'filmkante', false, 'youbooth.me'],
  ['party-minimal', 'Minimal Studio', 'streifen', 3, '#f6f1e7', '#12100d', '#ff5d8f', 'feine-linie', false],
];

const neu = QUELLE.map(([id, name, art, n, papier, tinte, akzent, deko, ecken, zusatz]) => {
  const unten = zusatz ? '{datum} · ' + zusatz : '{datum}';
  const felder = (art === 'streifen' ? streifenFelder(n, '{event}', unten) : fotoFelder('{event}', unten)).map(
    (f) => (f.farbe === '@akzent' ? { ...f, farbe: akzent } : f)
  );
  return {
    id: 'deko-' + id,
    name,
    format: art === 'streifen' ? 'streifen-2x6' : 'postkarte-4x6',
    art,
    aufnahmen: n,
    papier,
    tinte,
    akzent,
    ...(ecken ? { ecken: true } : {}),
    deko,
    felder,
  };
});

const katalog = JSON.parse(readFileSync(KATALOG, 'utf8'));
const ohneAlte = katalog.filter((v) => !String(v.id).startsWith('deko-'));
const zusammen = [...ohneAlte, ...neu];
writeFileSync(KATALOG, JSON.stringify(zusammen, null, 2) + '\n');
console.log(`Katalog: ${ohneAlte.length} bestehende + ${neu.length} gezeichnete = ${zusammen.length}`);
