/* Dienst — der Service Worker des Studios.

   Er macht aus der Seite eine Anwendung, die man installiert: eigenes Fenster,
   Symbol im Dock oder Startmenü, und vor allem — es läuft ohne Netz.

   Das ist keine Bequemlichkeit, sondern Leitprinzip 2. Ein Studio, die im
   Zug oder im abgeschotteten Netz nicht aufgeht, ist keine.

   Zwei Sorten Dateien, mit Absicht verschieden behandelt:

   **Kern** — was jeder Start braucht: das Gerüst, alle Module, die Schriften,
   der PDF-Motor. Rund 4 MB, beim Einrichten in einem Rutsch geholt. Wer die
   PDF Studio installiert, hat es danach vollständig.

   **Nachschub** — was nur mancher braucht: Texterkennung (5,6 MB), qpdf für
   Kennwörter (1,3 MB), die CJK-Zeichentabellen (1,7 MB), node-forge fürs
   Signieren. Beim ersten Gebrauch geholt und dann behalten. Wer nie eine
   Texterkennung laufen lässt, lädt sie nie. Wer alles vorab will, drückt in
   den Einstellungen „Alles für offline sichern".

   Was **nie** in den Zwischenspeicher kommt: alles unter `/api/`. Die Frage
   nach der Anmeldung muss den Server erreichen oder scheitern — eine
   zwischengespeicherte Antwort wäre eine Lüge.

   Der Kern wird von `vollpruefung.mjs` gegen das Verzeichnis gegengelesen:
   fehlt hier ein Modul, das es in `app/` gibt, scheitert der Prüflauf. Sonst
   wäre diese Liste nach dem zweiten neuen Modul falsch. */

const FASSUNG = 'studio-v1';
const KERN_LAGER = `${FASSUNG}-kern`;
const NACHSCHUB_LAGER = `${FASSUNG}-nachschub`;

const KERN = [
  './',
  'index.html',
  'manifest.json',
  'app/stil.css',
  'app/absaetze.js', 'app/anmeldung.js', 'app/anmerkungen.js', 'app/ansicht.js',
  'app/aufdruck.js',
  'app/ausgabe.js',
  'app/barrierefrei.js', 'app/dialoge.js', 'app/dokument.js', 'app/einlesen.js',
  'app/excel.js', 'app/felderkennen.js', 'app/formulare.js', 'app/installieren.js',
  'app/kern.js',
  'app/main.js', 'app/mappen.js', 'app/menue.js', 'app/messen.js',
  'app/mitdenken.js', 'app/oberflaeche.js', 'app/ordnen.js', 'app/schutz.js',
  'app/seiten.js', 'app/signieren.js', 'app/stapel.js', 'app/suche.js',
  'app/tafeln.js', 'app/texterkennung.js', 'app/unterschrift.js',
  'app/vergleich.js', 'app/word.js', 'app/zip.js',
  'fremd/pdf.mjs', 'fremd/pdf.worker.mjs', 'fremd/pdf-lib.mjs',
  'fremd/schrift/plex-sans-400.woff2', 'fremd/schrift/plex-sans-500.woff2',
  'fremd/schrift/plex-sans-600.woff2', 'fremd/schrift/plex-serif-400.woff2',
  'fremd/schrift/plex-serif-400-italic.woff2', 'fremd/schrift/plex-serif-600.woff2',
  'fremd/schrift/plex-mono-400.woff2', 'fremd/schrift/plex-mono-500.woff2',
  'symbole/symbol-192.png', 'symbole/symbol-512.png', 'symbole/symbol-maskable-512.png',
];

/* Der Nachschub, den „Alles für offline sichern" vorab holt. Die
   pdf.js-Standardschriften stehen hier und nicht im Kern: sie werden nur für
   PDFs gebraucht, die ihre Schrift nicht mitbringen. */
const NACHSCHUB = [
  'fremd/tesseract.mjs', 'fremd/tesseract-arbeiter.js',
  'fremd/tesseract-core-simd-lstm.js', 'fremd/tesseract-core-simd-lstm.wasm',
  'fremd/sprachen/deu.traineddata.gz', 'fremd/sprachen/eng.traineddata.gz',
  'fremd/qpdf.mjs', 'fremd/qpdf.js', 'fremd/qpdf.wasm',
  'fremd/forge.mjs', 'fremd/browser.js',
  'fremd/schriften/FoxitDingbats.pfb', 'fremd/schriften/FoxitFixed.pfb',
  'fremd/schriften/FoxitFixedBold.pfb', 'fremd/schriften/FoxitFixedBoldItalic.pfb',
  'fremd/schriften/FoxitFixedItalic.pfb', 'fremd/schriften/FoxitSerif.pfb',
  'fremd/schriften/FoxitSerifBold.pfb', 'fremd/schriften/FoxitSerifBoldItalic.pfb',
  'fremd/schriften/FoxitSerifItalic.pfb', 'fremd/schriften/FoxitSymbol.pfb',
  'fremd/schriften/LiberationSans-Bold.ttf', 'fremd/schriften/LiberationSans-BoldItalic.ttf',
  'fremd/schriften/LiberationSans-Italic.ttf', 'fremd/schriften/LiberationSans-Regular.ttf',
];

self.addEventListener('install', (ereignis) => {
  ereignis.waitUntil((async () => {
    const lager = await caches.open(KERN_LAGER);
    /* Einzeln statt `addAll`: eine fehlende Datei darf nicht die ganze
       Einrichtung umwerfen. Was fehlt, wird beim Gebrauch nachgeholt. */
    await Promise.all(KERN.map((weg) => lager.add(new Request(weg, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (ereignis) => {
  ereignis.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (!name.startsWith(FASSUNG)) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

/* „Alles für offline sichern" aus den Einstellungen. Meldet den Fortschritt
   zurück, damit der Knopf nicht stumm dasteht. */
self.addEventListener('message', (ereignis) => {
  if (ereignis.data?.art !== 'nachschub-holen') return;
  ereignis.waitUntil((async () => {
    const lager = await caches.open(NACHSCHUB_LAGER);
    let fertig = 0;
    for (const weg of NACHSCHUB) {
      try { await lager.add(new Request(weg, { cache: 'reload' })); } catch { /* beim Gebrauch erneut */ }
      fertig += 1;
      ereignis.source?.postMessage({ art: 'nachschub-stand', fertig, gesamt: NACHSCHUB.length });
    }
    ereignis.source?.postMessage({ art: 'nachschub-fertig', fertig, gesamt: NACHSCHUB.length });
  })());
});

const istApi = (url) => url.pathname.includes('/api/');

self.addEventListener('fetch', (ereignis) => {
  const anfrage = ereignis.request;
  if (anfrage.method !== 'GET') return;
  const url = new URL(anfrage.url);
  if (url.origin !== self.location.origin) return;
  /* Die Anmeldung fragt den Server, nicht den Zwischenspeicher. */
  if (istApi(url)) return;

  /* Das Gerüst: erst das Netz, damit eine neue Fassung sofort ankommt; ohne
     Netz das, was liegt. Ein Programm, das erst beim zweiten Start aktuell
     wird, verwirrt mehr, als der eine Netzweg kostet. */
  if (anfrage.mode === 'navigate') {
    ereignis.respondWith((async () => {
      try {
        const frisch = await fetch(anfrage);
        const lager = await caches.open(KERN_LAGER);
        lager.put('index.html', frisch.clone());
        return frisch;
      } catch {
        return (await caches.match('index.html')) || (await caches.match('./'))
          || new Response('Das Studio ist noch nicht für offline eingerichtet.',
            { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  /* Alles andere: was liegt, wird genommen — die Dateien tragen ihre Fassung
     im Namen des Lagers, nicht im Pfad, also räumt `activate` sie ab. */
  ereignis.respondWith((async () => {
    const liegt = await caches.match(anfrage, { ignoreSearch: true });
    if (liegt) return liegt;
    const frisch = await fetch(anfrage);
    if (frisch.ok && frisch.type === 'basic') {
      const lager = await caches.open(NACHSCHUB_LAGER);
      lager.put(anfrage, frisch.clone());
    }
    return frisch;
  })());
});
