/**
 * Echte Blätter für die Website — gezeichnet, nicht gezeichnet nachempfunden.
 *
 *   npm run dev            (in einem zweiten Fenster)
 *   node tools/vorlagen-bilder.mjs
 *
 * Auf der Website standen bisher sechzehn CSS-Nachbauten und die Zahl 240.
 * Beides war erfunden. Was hier herauskommt, ist derselbe Renderer, der auch
 * druckt: Wenn ein Blatt auf der Website so aussieht, kommt es so aus dem
 * Drucker — und wenn sich der Katalog ändert, ändert sich die Galerie mit.
 *
 * Die Beispielaufnahmen sind bewusst keine Fotos: weiche Verläufe in vier
 * Stimmungen. Ein erfundenes Hochzeitspaar auf einer Vorlagenseite verspricht
 * einen Abzug, den niemand geliefert hat.
 */

import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const BROWSER = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
const ADRESSE = process.env.BOOTH_URL || 'http://localhost:4400';
const BILDER = path.join(HIER, '..', '..', 'youbooth', 'public', 'vorlagen');
const LISTE = path.join(HIER, '..', '..', 'youbooth', 'src', 'daten', 'vorlagenbilder.json');

/* Der Anlass steht nicht als Feld im Katalog — er steckt in der Kennung, die
   die Vorlage aus ihrer Herkunft mitbringt. Bewusst die Kennung und nicht der
   Name: Namen werden umbenannt, Kennungen nie — an ihnen hängen eingestellte
   Vorlagen auf laufenden Boxen. */
const ANLAESSE = [
  [/wedding|together-forever|streifen-klassisch|streifen-dunkel|foto-klassisch|foto-rand/, 'Hochzeit'],
  [/birth-?day|baby/, 'Geburtstag'],
  [/graduation/, 'Abschluss'],
  [/summer|after-party|uptown|elegant-deco|party/, 'Feier'],
  [/marble|gold|purple|pink|woven|floral|rustic|brushed|chic/, 'Firmenevent'],
];

const anlassVon = (id) => (ANLAESSE.find(([r]) => r.test(id)) ?? [null, 'Feier'])[1];

const browser = await chromium.launch({ executablePath: BROWSER });
const seite = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
seite.on('pageerror', (e) => console.log('Seitenfehler:', String(e).slice(0, 160)));

await seite.goto(ADRESSE + '/editor.html', { waitUntil: 'networkidle' });
await seite.waitForTimeout(600);

const blaetter = await seite.evaluate(async () => {
  const { mitgelieferteVorlagen } = await import('/src/vorlagen.ts');
  const { ladeZubehoer, zeichneVorlage, werteJetzt } = await import('/src/vorlage.ts');
  const { qrBild } = await import('/src/ausgabe.ts');

  /* Platzhalter statt Fotos: weicher Verlauf, eine angedeutete Person, Korn.
     Ein Blatt mit einer leeren Fläche sieht auf der Website nach Fehler aus,
     ein Blatt mit einem erfundenen Hochzeitspaar verspricht einen Abzug, den
     niemand geliefert hat. Die Silhouette zeigt zugleich, wo der Beschnitt
     sitzt — bei einem Hochformat-Feld sieht man sofort, ob der Kopf drin ist. */
  const stimmungen = [
    { oben: '#f0e4d4', unten: '#b99672', figur: '#7d5f45' },
    { oben: '#e4ecf2', unten: '#8ea3b4', figur: '#4f6274' },
    { oben: '#f2e2e6', unten: '#c398a4', figur: '#7f5a66' },
    { oben: '#e9efe0', unten: '#a3b189', figur: '#5f6d4c' },
  ];

  const muster = stimmungen.map(({ oben, unten, figur }) => {
    const c = document.createElement('canvas');
    c.width = 1280;
    c.height = 960;
    const s = c.getContext('2d');

    const v = s.createLinearGradient(0, 0, 0, c.height);
    v.addColorStop(0, oben);
    v.addColorStop(1, unten);
    s.fillStyle = v;
    s.fillRect(0, 0, c.width, c.height);

    // Kopf und Schultern, weich gezeichnet. Kein Gesicht — sobald Augen und
    // Mund dazukommen, sieht es aus wie eine echte Aufnahme.
    s.save();
    s.filter = 'blur(26px)';
    s.fillStyle = figur;
    s.globalAlpha = 0.55;
    s.beginPath();
    s.ellipse(640, 400, 150, 185, 0, 0, Math.PI * 2);
    s.fill();
    s.beginPath();
    s.ellipse(640, 1010, 400, 400, 0, 0, Math.PI * 2);
    s.fill();
    s.restore();

    // Licht von oben links, wie aus einem Blitz mit Schirm.
    const licht = s.createRadialGradient(430, 180, 30, 640, 480, 900);
    licht.addColorStop(0, 'rgba(255,255,255,0.42)');
    licht.addColorStop(1, 'rgba(255,255,255,0)');
    s.fillStyle = licht;
    s.fillRect(0, 0, c.width, c.height);

    const korn = s.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < korn.data.length; i += 4) {
      const r = (Math.random() - 0.5) * 13;
      korn.data[i] += r;
      korn.data[i + 1] += r;
      korn.data[i + 2] += r;
    }
    s.putImageData(korn, 0, 0);
    return c;
  });

  const werte = werteJetzt('Lena & Jonas', 'Box #1', 128);
  const aus = [];

  /* Nur die mitgelieferten: Was der Betreiber auf seiner Box selbst gebaut
     hat, gehört ihm und nicht auf unsere Website. */
  for (const v of mitgelieferteVorlagen()) {
    try {
      const zubehoer = await ladeZubehoer(v, werte, qrBild);
      const blatt = zeichneVorlage(v, muster, werte, zubehoer);

      // Fürs Netz auf 720 px lange Kante herunterrechnen: Ein 300-dpi-Blatt
      // wiegt sonst mehrere Megabyte, und niemand sieht den Unterschied.
      const faktor = 720 / Math.max(blatt.width, blatt.height);
      const klein = document.createElement('canvas');
      klein.width = Math.round(blatt.width * faktor);
      klein.height = Math.round(blatt.height * faktor);
      const s = klein.getContext('2d');
      s.imageSmoothingQuality = 'high';
      s.drawImage(blatt, 0, 0, klein.width, klein.height);

      aus.push({
        id: v.id,
        name: v.name,
        art: v.art,
        format: v.format,
        aufnahmen: v.aufnahmen ?? 1,
        breite: klein.width,
        hoehe: klein.height,
        bild: klein.toDataURL('image/webp', 0.85),
      });
    } catch (e) {
      aus.push({ id: v.id, fehler: String((e && e.message) || e).slice(0, 160) });
    }
  }
  return aus;
});

await browser.close();

mkdirSync(BILDER, { recursive: true });
for (const alt of readdirSync(BILDER)) rmSync(path.join(BILDER, alt));

const liste = [];
let schlecht = 0;
for (const b of blaetter) {
  if (b.fehler) {
    schlecht++;
    console.log(`✗ ${b.id}: ${b.fehler}`);
    continue;
  }
  const datei = `${b.id}.webp`;
  writeFileSync(path.join(BILDER, datei), Buffer.from(b.bild.split(',')[1], 'base64'));
  liste.push({
    id: b.id,
    name: b.name,
    anlass: anlassVon(b.id),
    art: b.art,
    format: b.format,
    aufnahmen: b.aufnahmen,
    breite: b.breite,
    hoehe: b.hoehe,
    bild: `/vorlagen/${datei}`,
  });
}

writeFileSync(LISTE, JSON.stringify(liste, null, 2) + '\n', 'utf8');
console.log(`${liste.length} Blätter geschrieben, ${schlecht} fehlgeschlagen.`);
console.log('→ ' + path.relative(process.cwd(), BILDER));
console.log('→ ' + path.relative(process.cwd(), LISTE));
