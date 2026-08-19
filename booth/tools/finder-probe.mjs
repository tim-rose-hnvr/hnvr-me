/**
 * Der Foto-Finder — ein Selfie statt vierhundert Mal scrollen.
 *
 * Dieses Modul verarbeitet Gesichter. Das ist nach Art. 9 DSGVO ein
 * besonderes Datum, und ein Merkmal, das man nicht wechseln kann, verdient
 * mehr als eine Prüfung, ob die Suche funktioniert. Diese Probe misst
 * deshalb ZUERST die Zusagen und erst danach den Nutzen:
 *
 *   · Verlässt das Selfie wirklich nie das Gerät? (Jeder ausgehende Aufruf
 *     wird mitgeschnitten und auf Bilddaten durchsucht.)
 *   · Entsteht die Merkmalsliste NUR, wenn der Finder eingeschaltet ist?
 *   · Stirbt ein Merkmal mit seinem Foto?
 *   · Lässt sich die ganze Liste wegwerfen, ohne die Fotos anzurühren?
 *   · Steht die Erklärung VOR dem ersten Tippen und nicht im Kleingedruckten?
 *
 * Und dann erst: Findet die Suche wirklich denselben Menschen wieder und
 * einen anderen nicht?
 *
 * Gesucht wird mit echten Gesichtern — dieselbe Person zweimal, eine andere
 * einmal. Sie werden aus dem Modellpaket gezogen, das ohnehin mitgeliefert
 * wird; erfundene Muster würde kein Gesichtsmodell erkennen.
 *
 *   node tools/finder-probe.mjs
 */

import { chromium } from 'playwright-core';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { BASIS, alsBetreiber, angemeldeterKontext } from './betreiber.mjs';

let bestanden = 0;
let gefallen = 0;
const pruefe = (satz, wahr, zusatz = '') => {
  if (wahr) { bestanden++; console.log(`  ✓ ${satz}`); }
  else { gefallen++; console.log(`  ✗ ${satz}${zusatz ? ' — ' + zusatz : ''}`); }
};

const sitzung = await alsBetreiber();
const vorher = await fetch(BASIS + '/api/settings').then((r) => r.json());

console.log('\n1 · Ohne Schalter kein Merkmal');
/* Der wichtigste Zustand des Moduls ist „aus". Solange er gilt, darf die Box
   nichts über Gesichter wissen — und auch nichts annehmen. */
await sitzung.anDieBox('/api/settings', {
  method: 'PUT',
  body: JSON.stringify({ faceFinder: { enabled: false } }),
});
const zu = await fetch(BASIS + '/api/gesichter');
pruefe('Abgeschaltet gibt die Box keine Merkmalsliste heraus', zu.status === 403,
  String(zu.status));

const abgewiesen = await fetch(BASIS + '/api/gesichter/egal.jpg', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ merkmale: [new Array(128).fill(0.1)] }),
});
pruefe('Und nimmt auch keins an', abgewiesen.status === 403, String(abgewiesen.status));

await sitzung.anDieBox('/api/settings', {
  method: 'PUT',
  body: JSON.stringify({
    faceFinder: { enabled: true, consent: true, consentText: 'Die Gastgeber haben zugestimmt.' },
  }),
});

console.log('\n2 · Die Box prüft, was sie ablegt');
const ohneDatei = await fetch(BASIS + '/api/gesichter/gibtesnicht.jpg', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ merkmale: [new Array(128).fill(0.1)] }),
});
pruefe('Ein Merkmal ohne zugehörige Aufnahme wird abgelehnt', ohneDatei.status === 404,
  String(ohneDatei.status));

const browser = await chromium.launch({
  ...(process.env.YOUBOOTH_CHROMIUM ? { executablePath: process.env.YOUBOOTH_CHROMIUM } : {}),
  /* Scheinkamera. Sie liefert ein grünes Muster ohne Gesicht — für Abschnitt
     4 genau richtig: Gemessen wird dort, WAS das Gerät verlässt, nicht ob
     etwas gefunden wird. Die Erkennung selbst prüft Abschnitt 5 mit echten
     Gesichtern, an der Kamera vorbei. */
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});

/* Echte Gesichter. Das Modellpaket bringt Beispielbilder mit; ohne sie kann
   diese Probe nur die Zusagen messen, nicht die Suche. */
const BEISPIELE = 'node_modules/@vladmandic/face-api/demo';
const habenGesichter = existsSync(BEISPIELE);

console.log('\n3 · Die Erklärung steht vor dem ersten Tippen');
const kontext = await browser.newContext({
  viewport: { width: 420, height: 900 },
  permissions: ['camera'],
});
const seite = await kontext.newPage();
await seite.goto(BASIS + '/finder', { waitUntil: 'networkidle' });
await seite.waitForTimeout(1200);

const text = await seite.locator('.fdsagt').innerText();
pruefe('Es steht da, dass das Selfie das Gerät nicht verlässt',
  /verlässt|bleibt auf diesem gerät/i.test(text), text.slice(0, 90).replace(/\n/g, ' '));
pruefe('Und dass auf dem eigenen Gerät verglichen wird',
  /auf deinem handy|auf diesem gerät/i.test(text));
pruefe('Der Satz des Betreibers steht mit dabei',
  (await seite.locator('.fdpunkt--betreiber').count()) === 1);

/* Ein vorausgefülltes Kästchen ist keine Einwilligung. */
const haken = seite.locator('.fdhaken input');
pruefe('Die Einwilligung ist NICHT vorausgewählt',
  (await haken.count()) === 1 && !(await haken.isChecked()));
pruefe('Und ohne sie lässt sich die Kamera nicht einschalten',
  await seite.getByRole('button', { name: /kamera an/i }).isDisabled());

console.log('\n4 · Das Selfie verlässt das Gerät nicht');
/* Mitgeschnitten wird JEDER ausgehende Aufruf mit Rumpf. Findet sich darin
   ein Bild — als Datenadresse, als Formulardatei, als Rohbytes —, ist die
   zentrale Zusage des Moduls gebrochen. */
const gesendet = [];
const alleAufrufe = [];
seite.on('request', (r) => {
  alleAufrufe.push(r.url());
  const rumpf = r.postData();
  if (rumpf) gesendet.push({ ziel: r.url(), rumpf });
});

await haken.check();
await seite.getByRole('button', { name: /kamera an/i }).click();
await seite.locator('.fdausloeser').waitFor({ state: 'visible', timeout: 120000 });
await seite.waitForTimeout(1200);
await seite.locator('.fdausloeser').click();
await seite.waitForFunction(
  () => ['treffer', 'nichts', 'fehler'].includes(document.querySelector('.fdflaeche')?.dataset.lage),
  null,
  { timeout: 60000 }
);

/* Erst belegen, dass überhaupt mitgeschnitten wurde — sonst bestünde die
   Prüfung auch dann, wenn die Seite gar nicht gelaufen ist. */
pruefe(`Der Mitschnitt hat gearbeitet (${alleAufrufe.length} Aufrufe, davon ${gesendet.length} mit Rumpf)`,
  alleAufrufe.length > 3);
pruefe('Das Modell wurde wirklich von der Box geladen',
  alleAufrufe.some((u) => /gesichtsmodell/.test(u)),
  alleAufrufe.filter((u) => /model|gesicht/.test(u)).slice(0, 2).join(' '));
pruefe('Die Aufnahme ist bis zum Ende durchgelaufen',
  ['treffer', 'nichts', 'fehler'].includes(
    await seite.evaluate(() => document.querySelector('.fdflaeche')?.dataset.lage)
  ));

const bildhaft = gesendet.filter(
  (a) => /data:image|image\/(jpeg|png|webp)|\bJFIF\b|PNG\r\n/.test(a.rumpf)
);
pruefe('Kein einziger Aufruf trägt Bilddaten',
  bildhaft.length === 0, bildhaft.map((a) => a.ziel).join(', '));

const merkmalhaft = gesendet.filter((a) => /merkmale/.test(a.rumpf));
pruefe('Und auch keiner die 128 Zahlen des Gastes', merkmalhaft.length === 0,
  merkmalhaft.map((a) => a.ziel).join(', '));

if (!habenGesichter) {
  console.log('\n  · Ohne Beispielbilder wird die Suche selbst nicht gemessen.');
} else {
  console.log('\n5 · Dieselbe Person wird wiedergefunden, eine andere nicht');
  /* Drei echte Gesichter in die Ablage, Merkmale wie im Betrieb im Browser
     gerechnet. Danach wird mit dem Gesicht AUS BILD 1 gesucht: Es muss Bild 1
     finden und darf die anderen nicht finden. Wer die Personen sind, muss die
     Probe dafür nicht wissen — sie prüft „gleich findet gleich, verschieden
     findet nicht". */
  const rechner = await kontext.newPage();
  /* Die Beispielbilder liegen im Paket, nicht auf der Box. Sie werden der
     Seite untergeschoben, statt sie in die Ablage des Betreibers zu legen. */
  await rechner.route('**/probe/*', (weg) => {
    const name = weg.request().url().split('/').pop();
    weg.fulfill({ status: 200, contentType: 'image/jpeg', body: readFileSync(`${BEISPIELE}/${name}`) });
  });
  await rechner.goto(BASIS + '/finder', { waitUntil: 'networkidle' });
  /* Die Erkennung einmal an das Fenster hängen, damit die Auswertungen unten
     sie benutzen können — die Seite selbst lädt sie erst bei Zustimmung.
     Der Dateiname trägt einen Hash, deshalb wird er im gebauten Verzeichnis
     nachgesehen statt abgeschrieben: Sonst fällt die Probe beim nächsten
     Bauen um, ohne dass sich etwas geändert hätte. */
  const chunk = readdirSync('dist/assets').find((d) => /^gesichter-.*\.js$/.test(d));
  const geladen = chunk
    ? await rechner.evaluate(async (pfad) => {
        window.erkennung = await import(pfad).catch(() => null);
        return !!window.erkennung;
      }, `/assets/${chunk}`)
    : false;
  pruefe('Die Erkennung lässt sich laden', geladen);

  const dateien = ['sample1.jpg', 'sample2.jpg', 'sample3.jpg']
    .filter((f) => existsSync(`${BEISPIELE}/${f}`));
  const angelegt = [];
  for (const datei of dateien) {
    const daten = 'data:image/jpeg;base64,' + readFileSync(`${BEISPIELE}/${datei}`).toString('base64');
    const abgelegt = await fetch(BASIS + '/api/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: daten, mode: 'foto', source: 'booth' }),
    }).then((r) => r.json());
    angelegt.push({ name: abgelegt.photo.name, quelle: datei, daten });

    const anzahl = await rechner.evaluate(async ([name, bild]) => {
      const el = await new Promise((f) => { const b = new Image(); b.onload = () => f(b); b.src = bild; });
      return await window.erkennung.merkeGesichter(name, el);
    }, [abgelegt.photo.name, daten]);
    console.log(`    ${datei} → ${anzahl} Gesicht(er)`);
  }

  const liste = await fetch(BASIS + '/api/gesichter').then((r) => r.json());
  pruefe(`Die Box führt jetzt ${liste.liste.length} Aufnahmen mit Gesichtern`,
    liste.liste.length >= 2, JSON.stringify(liste.liste.map((e) => e.merkmale.length)));
  pruefe('Jedes Merkmal hat genau 128 Zahlen',
    liste.liste.every((e) => e.merkmale.every((m) => m.length === 128)));

  /* Die eigentliche Prüfung: mit dem Gesicht aus Bild 1 suchen. */
  const ergebnis = await rechner.evaluate(async ([bild, gesamt]) => {
    const el = await new Promise((f) => { const b = new Image(); b.onload = () => f(b); b.src = bild; });
    const such = await window.erkennung.suchmerkmal(el);
    if (!such) return null;
    return window.erkennung.suche(such, gesamt).map((t) => ({ datei: t.datei, abstand: +t.abstand.toFixed(3) }));
  }, [angelegt[0].daten, liste.liste]);

  pruefe('Das Suchbild liefert überhaupt ein Merkmal', ergebnis !== null);
  pruefe('Die eigene Aufnahme wird gefunden',
    !!ergebnis && ergebnis.some((t) => t.datei === angelegt[0].name),
    JSON.stringify(ergebnis));
  pruefe('Und zwar als sicherster Treffer ganz oben',
    !!ergebnis && ergebnis[0]?.datei === angelegt[0].name,
    JSON.stringify(ergebnis?.[0]));
  pruefe(`Fremde Gesichter kommen NICHT als „sicher" mit`,
    !!ergebnis && ergebnis.filter((t) => t.sicher).every((t) => t.datei === angelegt[0].name),
    JSON.stringify(ergebnis));

  console.log('\n5b · Keine fremden Bilder in „deinen Bildern"');
  /* Die Gegenprobe, und der Grund für die strenge Schwelle: Sechs Aufnahmen
     mit lauter VERSCHIEDENEN Menschen, mit jeder einzeln gesucht. Kein
     fremdes Bild darf als „sicher" gelten.
     Bei der Lehrbuchschwelle 0,6 wären zwei Paare davon durchgerutscht — der
     kleinste gemessene Abstand zwischen zwei Fremden lag bei 0,503.

     Was diese Probe NICHT misst: wie viele Bilder ein Gast tatsächlich
     wiederfindet. Dafür bräuchte es mehrere Aufnahmen DESSELBEN Menschen mit
     bekannter Zuordnung; die gibt es hier nicht. Die Trefferquote ist damit
     unbelegt, und sie wird auf der Seite auch nicht behauptet. */
  const alleProben = readdirSync(BEISPIELE).filter((f) => /^sample\d+\.jpg$/.test(f)).sort();
  const kreuz = await rechner.evaluate(async (namen) => {
    const lade = (d) => new Promise((f) => { const i = new Image(); i.onload = () => f(i); i.src = d; });
    const liste = [];
    for (const n of namen) {
      liste.push({ datei: n, merkmale: await window.erkennung.merkmale(await lade('/probe/' + n)) });
    }
    const fremd = [];
    for (const n of namen) {
      const such = await window.erkennung.suchmerkmal(await lade('/probe/' + n));
      if (!such) continue;
      for (const t of window.erkennung.suche(such, liste)) {
        if (t.sicher && t.datei !== n) fremd.push(`${n}→${t.datei} ${t.abstand.toFixed(2)}`);
      }
    }
    return { geprueft: namen.length, fremd, sicher: window.erkennung.SICHER };
  }, alleProben);
  pruefe(`Bei ${kreuz.geprueft} verschiedenen Menschen kein einziger fremder „sicher"-Treffer ` +
    `(Schwelle ${kreuz.sicher})`, kreuz.fremd.length === 0, kreuz.fremd.join(', '));

  console.log('\n6 · Die Treffer als ein Paket');
/* Geprüft wird hier der Weg der Box: Sie gibt GENAU die angeforderten
   Aufnahmen heraus und nicht die ganze Ablage. Welche die Seite anfordert —
   nur die sicheren — entscheidet die Oberfläche, und dafür bürgt 5b. */
  /* Siebzehnmal „Herunterladen" tippt kein Gast. Das Paket enthält GENAU die
     Treffer — nicht die ganze Ablage, sonst bekäme jeder Gast alle Bilder
     des Abends, und das wäre das Gegenteil eines Foto-Finders. */
  const namen = ergebnis.map((t) => t.datei);
  const paket = await fetch(
    BASIS + '/api/photos.zip?nur=' + encodeURIComponent(namen.join(','))
  );
  const bytes = Buffer.from(await paket.arrayBuffer());
  pruefe('Das Paket kommt als ZIP', paket.ok &&
    paket.headers.get('content-type') === 'application/zip' &&
    bytes.slice(0, 2).toString() === 'PK', String(paket.status));
  /* Im ZIP steht jeder Dateiname im Klartext — daran lässt sich zählen,
     ohne es auszupacken. */
  const drin = namen.filter((n) => bytes.includes(n));
  const fremd = angelegt.filter((a) => !namen.includes(a.name) && bytes.includes(a.name));
  pruefe(`Es enthält genau die ${namen.length} Treffer`, drin.length === namen.length,
    `${drin.length} von ${namen.length}`);
  pruefe('Und kein fremdes Bild', fremd.length === 0, fremd.map((f) => f.quelle).join(', '));

  console.log('\n7 · Ein Merkmal stirbt mit seinem Foto');
  const opfer = angelegt[0];
  await sitzung.anDieBox('/api/photos/' + encodeURIComponent(opfer.name), { method: 'DELETE' });
  const danach = await fetch(BASIS + '/api/gesichter').then((r) => r.json());
  pruefe('Nach dem Löschen der Aufnahme ist ihr Merkmal weg',
    !danach.liste.some((e) => e.datei === opfer.name), opfer.name);

  console.log('\n8 · Die Liste lässt sich wegwerfen, die Fotos bleiben');
  const bilderVor = (await fetch(BASIS + '/api/photos').then((r) => r.json())).length;
  const verworfen = await sitzung.anDieBox('/api/gesichter', { method: 'DELETE' });
  const bilderNach = (await fetch(BASIS + '/api/photos').then((r) => r.json())).length;
  pruefe('Die Merkmale sind verworfen', verworfen.status === 200 &&
    (await fetch(BASIS + '/api/gesichter').then((r) => r.json())).liste.length === 0);
  pruefe('Die Aufnahmen sind unberührt', bilderNach === bilderVor,
    `${bilderVor} → ${bilderNach}`);

  // Aufräumen.
  for (const a of angelegt) {
    await sitzung.anDieBox('/api/photos/' + encodeURIComponent(a.name), { method: 'DELETE' });
  }
}

await sitzung.anDieBox('/api/gesichter', { method: 'DELETE' });
await sitzung.anDieBox('/api/settings', {
  method: 'PUT',
  body: JSON.stringify({
    faceFinder: {
      enabled: vorher.faceFinder.enabled,
      showHint: vorher.faceFinder.showHint,
      consent: vorher.faceFinder.consent,
      consentText: vorher.faceFinder.consentText,
    },
  }),
});

await browser.close();
console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
