/**
 * Der Rundgang — jede Oberfläche der Box einmal von vorn.
 *
 * Die anderen Proben messen je ein Modul in der Tiefe. Diese hier geht in die
 * Breite: Sie öffnet jede Seite, sieht jedes Bild an, folgt jedem Verweis und
 * drückt jeden Knopf. Gesucht wird das, was einzelne Modulproben systematisch
 * übersehen:
 *
 *   · eine Seite, die beim Laden einen Fehler wirft
 *   · ein Bild, das nicht lädt — im Quelltext steht es, am Bildschirm fehlt es
 *   · ein Verweis, der auf eine Seite zeigt, die es nicht gibt
 *   · ein Knopf, der beim Drücken einen Fehler auslöst
 *   · eine Seite, die leer bleibt
 *
 * Was NICHT gedrückt wird: alles, was löscht, zurücksetzt oder entwickelt.
 * Eine Probe, die aufräumt, was ein Betreiber gerade aufgebaut hat, ist
 * schlimmer als keine.
 *
 *   node tools/rundgang-probe.mjs
 */

import { chromium } from 'playwright-core';
import { BASIS, alsBetreiber, angemeldeterKontext } from './betreiber.mjs';

let bestanden = 0;
let gefallen = 0;
const pruefe = (satz, wahr, zusatz = '') => {
  if (wahr) { bestanden++; console.log(`  ✓ ${satz}`); }
  else { gefallen++; console.log(`  ✗ ${satz}${zusatz ? ' — ' + zusatz : ''}`); }
};

/* Knöpfe, die etwas unwiderruflich tun. Ihre Wirkung prüfen die Modulproben;
   hier würden sie nur die Box des Betreibers ausräumen. */
const FINGER_WEG =
  /löschen|entfernen|verwerfen|zurücksetzen|entwickeln|abmelden|drucken|löschfrist|neu laden|beenden|reparieren|zurücksetz/i;

/* Jede Seite mit dem, was sie braucht: eine Anmeldung, eine Kamera, ein
   Mikrofon. Wer das nicht mitgibt, misst eine Fehlermeldung statt einer
   Oberfläche. */
const SEITEN = [
  { pfad: '/', name: 'Booth', wurzel: '#booth, .buehne, #app', kamera: true },
  { pfad: '/zentrale.html', name: 'Startzentrum', wurzel: '#zentrale' },
  { pfad: '/cockpit.html', name: 'Cockpit', wurzel: '#cockpit', anmeldung: true },
  { pfad: '/galerie.html', name: 'Galerie', wurzel: '#galerie' },
  { pfad: '/wand.html', name: 'Foto-Wall', wurzel: '#wand' },
  { pfad: '/diashow.html', name: 'Diashow', wurzel: '#diashow', nurBild: true },
  { pfad: '/editor.html', name: 'Vorlagen-Editor', wurzel: '#editor', anmeldung: true },
  { pfad: '/portal.html', name: 'Portal', wurzel: '#portal', anmeldung: true },
  { pfad: '/einrichtung.html', name: 'Einrichtung', wurzel: '#einrichtung', anmeldung: true },
  { pfad: '/buchen.html', name: 'Buchen', wurzel: '#buchen' },
  { pfad: '/gaestebuch.html', name: 'Gästebuch', wurzel: '#gaestebuch' },
  { pfad: '/zettelwand.html', name: 'Zettelwand', wurzel: '#zettelwand' },
  { pfad: '/gastkamera.html', name: 'Web-Kamera', wurzel: '#gastkamera', kamera: true },
  { pfad: '/film', name: 'Einwegkamera', wurzel: '#film', kamera: true },
  { pfad: '/stimme', name: 'Gesprochene Grüße', wurzel: '#stimme', mikrofon: true },
  { pfad: '/zeitlupe.html', name: 'Zeitlupe', wurzel: '#zeitlupe', kamera: true },
  { pfad: '/fern.html', name: 'Fernauslöser', wurzel: '#fern' },
  { pfad: '/anmelden.html', name: 'Anmeldung', wurzel: '#anmelden' },
];

const sitzung = await alsBetreiber();
const vorher = await fetch(BASIS + '/api/settings').then((r) => r.json());

/* Alle Module an, sonst zeigen die halben Seiten nur „ist nicht
   eingeschaltet" — und genau die Oberflächen dahinter sollen geprüft werden.
   Vor JEDER Seite erneut: Der Rundgang drückt im Cockpit auch die
   Modulschalter, und danach wären die Modulseiten aus. Dass dieser Umweg
   nötig ist, beweist nebenbei, dass die Schalter wirken. */
const alleModuleAn = () =>
  sitzung.anDieBox('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({
      einweg: { enabled: true },
      stimme: { enabled: true },
      zeitlupe: { enabled: true },
    }),
  });
await alleModuleAn();

const browser = await chromium.launch({
  ...(process.env.YOUBOOTH_CHROMIUM ? { executablePath: process.env.YOUBOOTH_CHROMIUM } : {}),
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});

const gesamt = { fehler: [], bilder: [], verweise: [], knoepfe: [] };
const gesehen = new Set();

/* Der Rundgang drückt Knöpfe, und manche legen etwas an — im Editor etwa
   „Kopieren". Was dabei entsteht, gehört hinterher weggeräumt: Eine Probe,
   die bei jedem Lauf zwei Vorlagen mehr im Katalog des Betreibers
   hinterlässt, ist nach zehn Läufen selbst das Problem. */
const vorlagenVorher = new Set(
  (((await sitzung.anDieBox('/api/templates')).daten?.templates) || []).map((v) => v.id)
);

for (const seite of SEITEN) {
  const kontext = seite.anmeldung
    ? await angemeldeterKontext(browser, sitzung, {
        viewport: { width: 1440, height: 900 },
        permissions: rechte(seite),
      })
    : await browser.newContext({
        viewport: { width: 1440, height: 900 },
        permissions: rechte(seite),
      });

  const s = await kontext.newPage();
  const fehler = [];
  s.on('pageerror', (e) => fehler.push('Ausnahme: ' + String(e).split('\n')[0].slice(0, 110)));
  s.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    /* Eine abgelehnte Anfrage ist KEIN Fehler der Oberfläche: Wer auf
       „Anmelden" ohne Kennwort drückt, bekommt zu Recht ein 401, und der
       Browser schreibt es ins Protokoll. Gesucht sind Ausnahmen im Code —
       ein Knopf, der die Seite zerlegt. */
    if (/Failed to load resource/i.test(text)) return;
    fehler.push(text.slice(0, 120));
  });

  console.log(`\n· ${seite.name} (${seite.pfad})`);
  await alleModuleAn();
  await s.goto(BASIS + seite.pfad, { waitUntil: 'networkidle' }).catch(() => undefined);
  await s.waitForTimeout(1600);

  /* 1. Steht überhaupt etwas da? Eine weiße Seite ohne Fehler im Protokoll
        ist der Fall, den man ohne Hinsehen nie findet. */
  const inhalt = await s.evaluate(() => ({
    text: document.body.innerText.trim().length,
    knoten: document.body.querySelectorAll('*').length,
    aus: /nicht eingeschaltet/i.test(document.body.innerText),
  }));
  /* Die Schwelle ist bewusst niedrig: Der Fernauslöser IST eine Überschrift,
     ein Satz und ein Knopf. Gesucht wird die weiße Seite, nicht die knappe.
     Reine Bildflächen (Diashow) tragen zu Recht gar keinen Text — dort zählt
     nur, dass etwas gezeichnet ist. */
  pruefe(`  ${seite.name}: die Seite ist nicht leer`,
    inhalt.knoten > 3 && (seite.nurBild || inhalt.text > 10), JSON.stringify(inhalt));
  /* Ein Modul, das „nicht eingeschaltet" meldet, obwohl es eingeschaltet
     wurde, ist genau der Fehler, den man im Betrieb erst beim Gast merkt. */
  pruefe(`  ${seite.name}: zeigt die Oberfläche, nicht „ist abgeschaltet"`, !inhalt.aus);

  /* 2. Jedes Bild wirklich geladen — nicht „im Quelltext vorhanden". */
  /* Erst einmal durch die ganze Seite scrollen: Bilder mit `loading="lazy"`
     laden sonst nie, und die Probe hielte jedes von ihnen für kaputt. */
  await s.evaluate(async () => {
    const hoehe = document.documentElement.scrollHeight;
    for (let y = 0; y < hoehe; y += window.innerHeight * 0.8) {
      window.scrollTo(0, y);
      await new Promise((f) => setTimeout(f, 120));
    }
    window.scrollTo(0, 0);
  });
  await s.waitForTimeout(700);

  const bilder = await s.evaluate(() =>
    [...document.querySelectorAll('img')]
      .filter((b) => b.offsetParent !== null || b.closest('.glightbox'))
      .map((b) => ({
        quelle: (b.currentSrc || b.src || '').slice(0, 90),
        breit: b.naturalWidth,
        fertig: b.complete,
      }))
  );
  /* Kaputt heißt: fertig geladen UND null Punkte breit. Ein Bild, das noch
     lädt, ist nicht kaputt — es ist noch nicht da. */
  const kaputt = bilder.filter((b) => b.quelle && b.fertig && b.breit === 0);
  pruefe(`  ${seite.name}: alle ${bilder.length} sichtbaren Bilder sind geladen`,
    kaputt.length === 0, kaputt.map((b) => b.quelle).join(', '));
  if (kaputt.length) gesamt.bilder.push(`${seite.name}: ${kaputt.map((b) => b.quelle).join(', ')}`);

  /* 3. Jeder Verweis auf eine Seite dieser Box muss existieren. */
  const verweise = await s.evaluate(() =>
    [...document.querySelectorAll('a[href]')]
      .map((a) => a.getAttribute('href'))
      .filter((h) => h && !/^(https?:|mailto:|tel:|#|data:|blob:)/.test(h))
  );
  const tot = [];
  for (const ziel of new Set(verweise)) {
    const adresse = new URL(ziel, BASIS + seite.pfad).toString();
    if (gesehen.has(adresse)) continue;
    gesehen.add(adresse);
    const antwort = await fetch(adresse, { method: 'GET' }).catch(() => null);
    if (!antwort || antwort.status >= 400) tot.push(`${ziel} (${antwort?.status ?? 'weg'})`);
  }
  pruefe(`  ${seite.name}: alle ${new Set(verweise).size} Verweise führen irgendwohin`,
    tot.length === 0, tot.join(', '));
  if (tot.length) gesamt.verweise.push(`${seite.name}: ${tot.join(', ')}`);

  /* 4. Jeden ungefährlichen Knopf einmal drücken. Geprüft wird nicht, WAS er
        tut — das prüfen die Modulproben —, sondern dass er nicht in einen
        Fehler läuft. Ein Knopf, der beim Drücken die Oberfläche zerlegt, ist
        auf einer Feier schlimmer als ein fehlender Knopf. */
  const beschriftungen = await s.evaluate(() =>
    [...document.querySelectorAll('button')]
      .filter((b) => b.offsetParent !== null && !b.disabled)
      .map((b) => (b.textContent || b.getAttribute('aria-label') || '').trim())
  );
  const gedrueckt = [];
  for (const text of beschriftungen) {
    if (!text || FINGER_WEG.test(text)) continue;
    const knopf = s.locator('button', { hasText: text }).first();
    if ((await knopf.count()) === 0) continue;
    if (!(await knopf.isVisible().catch(() => false))) continue;
    await knopf.click({ timeout: 2500 }).catch(() => undefined);
    gedrueckt.push(text.slice(0, 22));
    await s.waitForTimeout(320);
    // Zurück auf die Ausgangsseite, falls der Knopf woandershin geführt hat.
    if (!s.url().includes(seite.pfad.replace(/^\//, '')) && seite.pfad !== '/') {
      await s.goto(BASIS + seite.pfad, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
      await s.waitForTimeout(500);
    }
  }
  pruefe(`  ${seite.name}: ${gedrueckt.length} Knöpfe gedrückt, keiner läuft in einen Fehler`,
    fehler.length === 0, fehler.slice(0, 2).join(' | '));
  if (fehler.length) gesamt.fehler.push(`${seite.name}: ${fehler.slice(0, 2).join(' | ')}`);
  if (gedrueckt.length) console.log(`    gedrückt: ${gedrueckt.join(' · ')}`);

  await kontext.close();
}

function rechte(seite) {
  const r = [];
  if (seite.kamera) r.push('camera');
  if (seite.mikrofon) r.push('microphone');
  return r;
}

// Was der Rundgang unterwegs angelegt hat, wieder wegräumen.
const vorlagenNachher = ((await sitzung.anDieBox('/api/templates')).daten?.templates) || [];
const angelegt = vorlagenNachher.filter((v) => !vorlagenVorher.has(v.id));
for (const v of angelegt) {
  await sitzung.anDieBox('/api/templates/' + encodeURIComponent(v.id), { method: 'DELETE' });
}
pruefe(`Der Rundgang räumt hinter sich auf (${angelegt.length} Vorlagen)`,
  ((await sitzung.anDieBox('/api/templates')).daten?.templates || []).length === vorlagenVorher.size,
  angelegt.map((v) => v.name).join(', '));

// Einstellungen zurück auf den vorgefundenen Stand.
await sitzung.anDieBox('/api/settings', {
  method: 'PUT',
  body: JSON.stringify({
    einweg: { enabled: vorher.einweg.enabled },
    stimme: { enabled: vorher.stimme.enabled },
    zeitlupe: { enabled: vorher.zeitlupe.enabled },
  }),
});

await browser.close();

console.log('\n── Rundgang ──────────────────────────────────────────');
if (gesamt.fehler.length) console.log('Fehler:\n  ' + gesamt.fehler.join('\n  '));
if (gesamt.bilder.length) console.log('Bilder:\n  ' + gesamt.bilder.join('\n  '));
if (gesamt.verweise.length) console.log('Verweise:\n  ' + gesamt.verweise.join('\n  '));
console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
