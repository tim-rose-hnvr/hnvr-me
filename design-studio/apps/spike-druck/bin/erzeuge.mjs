/**
 * Erzeugt das Prüf-PDF und meldet das Urteil.
 *
 * Laeuft ueber Nodes Typenstripping, damit derselbe TypeScript-Quelltext ohne
 * Bauschritt benutzbar ist: node --experimental-strip-types
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const hier = dirname(fileURLToPath(import.meta.url));
const { pruefentwurf, PRUEF_SCHRIFT } = await import('../src/beispiel.ts');
const { setzeUndVermesse } = await import('../src/browser.ts');
const { erzeugePdfX } = await import('../src/pdfx.ts');
const { pruefePdfX, nurFehler, leseGegenprobe, findeVeraPdf } = await import('../src/pruefung.ts');

const SCHRIFTEN = [
  { datei: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', gewicht: 400, kursiv: false },
  { datei: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', gewicht: 700, kursiv: false },
];

const entwurf = pruefentwurf();
const ausgabe = join(hier, '..', 'ausgabe');
mkdirSync(ausgabe, { recursive: true });

// Eine Liste fuer Browser und PDF — Abweichungen dazwischen waeren fatal.
const schriften = SCHRIFTEN.map((s) => ({
  familie: PRUEF_SCHRIFT,
  gewicht: s.gewicht,
  kursiv: s.kursiv,
  daten: new Uint8Array(readFileSync(s.datei)),
}));

console.log('Setze im Browser …');
const { messung, abzug, html } = await setzeUndVermesse(entwurf, { schriften, abzug: true });

const ersatz = messung.texte.filter((t) => !t.schriftVerfuegbar);
if (ersatz.length > 0) {
  console.error(`  ABBRUCH: ${ersatz.length} Textlauf/-laeufe in Ersatzschrift gesetzt.`);
  process.exit(1);
}
writeFileSync(join(ausgabe, 'entwurf.html'), html);
writeFileSync(join(ausgabe, 'abzug.png'), abzug);

const glyphen = messung.texte.reduce((n, t) => n + t.glyphen.length, 0);
console.log(`  ${messung.texte.length} Textlaeufe, ${glyphen} Glyphen, ${messung.flaechen.length} Flaechen`);

console.log('Schreibe PDF/X-4 …');
const pdf = await erzeugePdfX({
  entwurf,
  messung,
  schriften,
  schnittmarken: true,
});
const pdfPfad = join(ausgabe, 'spike.pdf');
writeFileSync(pdfPfad, pdf);
console.log(`  ${(pdf.length / 1024).toFixed(1)} kB -> ${pdfPfad}`);

const pt = (px) => (px / entwurf.masse.dpi) * 72;
const an = entwurf.anschnitt;
const trimBox = [pt(an.links), pt(an.unten), pt(an.links + entwurf.masse.breite), pt(an.unten + entwurf.masse.hoehe)];

console.log('PDF/X-Pruefung …');
const befunde = pruefePdfX(pdf, { trimBox });
if (befunde.length === 0) console.log('  ohne Befund');
else for (const b of befunde) console.log(`  ${b.schwere === 'fehler' ? 'FEHLER ' : 'hinweis'} [${b.regel}] ${b.meldung}`);

const fehler = nurFehler(befunde);
console.log(fehler.length === 0 ? '\nURTEIL: PDF/X-4-Struktur vollstaendig.' : `\nURTEIL: ${fehler.length} Fehler.`);

if (findeVeraPdf() === null) {
  console.log('veraPDF nicht installiert — Gegenprobe entfaellt.');
} else {
  const vera = await leseGegenprobe(pdfPfad);
  console.log(`Gegenprobe veraPDF: gelesen=${vera.gelesen}, Profil="${vera.profil}"`);
}
