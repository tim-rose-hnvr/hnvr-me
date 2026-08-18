/**
 * Wegweiser für das Hosting bei Wix.
 *
 * Wix liefert hochgeladene Dateien wörtlich aus: `/module/index.html` kommt an,
 * `/module/` nicht. Gemessen, nicht vermutet — nach dem ersten Veröffentlichen
 * antwortete genau eine Seite, die Startseite, und alle 49 anderen mit 404.
 *
 * Astro baut mit `format: 'directory'`, weil das die sauberen Adressen gibt
 * (`/preise/` statt `/preise.html`). Diese Datei schließt die Lücke: Sie
 * bekommt nur die Anfragen, die die statische Schicht nicht selbst beantwortet
 * hat, und holt dafür die passende `index.html` nach.
 *
 * Drei Dinge, die je einen Anlauf gekostet haben und deshalb hier stehen:
 *
 * 1. Der Astro-Adapter für Cloudflare wäre laut Handbuch der Weg gewesen. Wix
 *    lädt das Modul aber in einer Node-Umgebung und kann dessen
 *    `cloudflare:`-Importe nicht auflösen:
 *    `ERR_UNSUPPORTED_ESM_URL_SCHEME — Received protocol 'cloudflare:'`.
 *    Hier steht deshalb nur, was jede Web-Laufzeit kennt.
 *
 * 2. `new URL(request.url).origin` ist **http**, nicht https — und über http
 *    beantwortet Wix den Rückgriff mit 500 und leerem Rumpf. Das Ziel wird
 *    deshalb ausdrücklich mit `https://` und dem `host`-Kopf gebaut.
 *
 * 3. Ein Umlenken auf den Schrägstrich (`/preise` → `/preise/`) sieht nach
 *    sauberen Adressen aus und ist unter der eigenen Domain tödlich: Dort
 *    streift Wix den Schrägstrich ab, wir hängten ihn wieder an — 50 Runden,
 *    dann gibt der Browser auf. Beide Schreibweisen liefern deshalb dasselbe
 *    Blatt, ohne jede Umleitung.
 *
 * 4. Eine Schleife entsteht nicht: Vorhandene Dateien werden vor diesem Modul
 *    ausgeliefert. Nachgemessen, während hier ein fehlerhafter Stand lief und
 *    `/module/index.html` trotzdem mit 200 antwortete, `/module/` dagegen mit
 *    dem Fehler.
 */

/** Hat der Weg eine Dateiendung? Dann ist keine Seite gemeint. */
const istDatei = (pfad) => /\.[a-z0-9]+$/i.test(pfad);

const nichtGefunden = (text) =>
  new Response(text, {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const pfad = url.pathname;

    // Dateien beantwortet die statische Schicht. Kommt eine hier an, gibt es
    // sie nicht — dann ist 404 richtig und keine HTML-Seite.
    if (istDatei(pfad)) return nichtGefunden('Nicht gefunden');

    /* KEINE Umleitung auf den Schrägstrich. Sie war der naheliegende Weg zu
       einer kanonischen Adresse — und unter der eigenen Domain die Ursache
       einer Endlosschleife: Dort streift Wix den Schrägstrich ab, hier wurde
       er wieder angehängt, und der Browser gab nach 50 Runden auf. Gemessen
       am 18.08. an `www.youbooth.me/vorlagen/`.
       Beide Schreibweisen liefern jetzt dasselbe Blatt aus. */
    const host = request.headers.get('host') || url.host;
    // `/preise` und `/preise/` führen beide zu `/preise/index.html`.
    const rumpf = pfad.replace(/\/+$/, '');
    const ziel = `https://${host}${rumpf}/index.html`;

    try {
      const antwort = await fetch(ziel);
      if (antwort.ok) {
        return new Response(antwort.body, {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            // Kurz zwischenspeichern: Jede Seite kostet sonst zwei Wege.
            'cache-control': 'public, max-age=300',
          },
        });
      }
    } catch {
      return nichtGefunden('Die Seite ist gerade nicht erreichbar.');
    }

    return nichtGefunden('Diese Seite gibt es nicht.');
  },
};
