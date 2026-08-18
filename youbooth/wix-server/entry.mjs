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

/* ---------------------------------------------------------------- */
/* Das Downloadzentrum                                                */
/* ---------------------------------------------------------------- */

import { DOWNLOADS as downloads } from './downloads.mjs';

/**
 * `/dl/…` liefert die Installationsprogramme — von youbooth.me, nicht von
 * einer fremden Adresse. Wer die Software holt, soll nicht beim ersten Klick
 * erfahren, wo sie zufällig liegt.
 *
 * Der Umweg dahin ist gemessen, nicht gewählt: Die Medienverwaltung nimmt
 * keine `.exe` an —
 *
 *   UNSUPPORTED_FILE_FORMAT · Unsupported file extension exe
 *
 * `.zip` nimmt sie. Und weil das ZIP OHNE Verdichtung geschrieben ist, liegt
 * das Installationsprogramm darin unverändert ab einem festen Byte. Die
 * Auslieferung beherrscht Bereichsanfragen (gemessen: 206, byte-gleich), also
 * holt dieser Wegweiser genau diesen Bereich und reicht ihn durch. Am Ende
 * kommt beim Betreiber dasselbe an, was der Bau erzeugt hat — nachgeprüft
 * über SHA-512 und die Kennung `MZ`.
 *
 * `latest.yml` entsteht hier aus denselben Angaben. Zwei Listen derselben
 * Sache laufen auseinander; eine Box, die auf eine Fassung zeigt, die es
 * nicht gibt, lädt ins Leere.
 */
async function ausDemDownloadzentrum(request, pfad) {
  const name = decodeURIComponent(pfad.slice('/dl/'.length));

  if (name === 'latest.yml' || name === '' || name === 'stand.json') {
    const fassung = downloads.aktuell;
    const w = downloads.fassungen[fassung]?.windows;
    if (!w) return nichtGefunden('Keine Fassung hinterlegt.');

    if (name === 'stand.json') {
      return new Response(
        JSON.stringify({
          aktuell: fassung,
          erschienen: downloads.fassungen[fassung].erschienen,
          windows: { datei: w.datei, groesse: w.groesse, adresse: `/dl/${w.datei}` },
          neuerungen: downloads.neuerungen?.[fassung] ?? [],
        }),
        { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' } }
      );
    }

    // Genau das Format, das `electron-updater` erwartet.
    const yml =
      `version: ${fassung}\n` +
      `files:\n` +
      `  - url: ${w.datei}\n` +
      `    sha512: ${w.sha512}\n` +
      `    size: ${w.groesse}\n` +
      `path: ${w.datei}\n` +
      `sha512: ${w.sha512}\n` +
      `releaseDate: '${downloads.fassungen[fassung].erschienen}T00:00:00.000Z'\n`;
    return new Response(yml, {
      headers: {
        'content-type': 'text/yaml; charset=utf-8',
        // Kurz: Eine neue Fassung soll nicht stundenlang unsichtbar bleiben.
        'cache-control': 'public, max-age=120',
      },
    });
  }

  const eintrag = Object.values(downloads.fassungen)
    .map((f) => f.windows)
    .find((w) => w && w.datei === name);
  if (!eintrag) return nichtGefunden('Diese Datei gibt es nicht.');

  /* Eine Bereichsanfrage des Anrufers wird auf das ZIP umgerechnet.
     `electron-updater` lädt Aktualisierungen stückweise — ohne diese
     Umrechnung bekäme es den falschen Ausschnitt. */
  const gewuenscht = request.headers.get('range');
  let von = 0;
  let bis = eintrag.groesse - 1;
  let teilweise = false;
  if (gewuenscht) {
    const treffer = /^bytes=(\d*)-(\d*)$/.exec(gewuenscht.trim());
    if (treffer) {
      teilweise = true;
      if (treffer[1]) {
        von = Number(treffer[1]);
        if (treffer[2]) bis = Math.min(Number(treffer[2]), eintrag.groesse - 1);
      } else if (treffer[2]) {
        von = Math.max(0, eintrag.groesse - Number(treffer[2]));
      }
    }
  }
  if (von > bis || von >= eintrag.groesse) {
    return new Response('Bereich außerhalb der Datei', {
      status: 416,
      headers: { 'content-range': `bytes */${eintrag.groesse}` },
    });
  }

  const antwort = await fetch(eintrag.quelle, {
    headers: { range: `bytes=${eintrag.versatz + von}-${eintrag.versatz + bis}` },
  });
  if (!antwort.ok && antwort.status !== 206) {
    return nichtGefunden('Die Datei ist gerade nicht erreichbar.');
  }

  const kopf = {
    'content-type': 'application/octet-stream',
    'content-length': String(bis - von + 1),
    'content-disposition': `attachment; filename="${eintrag.datei}"`,
    'accept-ranges': 'bytes',
    // Eine Fassung ändert sich nie — nur eine neue kommt dazu.
    'cache-control': 'public, max-age=31536000, immutable',
  };
  if (teilweise) kopf['content-range'] = `bytes ${von}-${bis}/${eintrag.groesse}`;

  return new Response(antwort.body, { status: teilweise ? 206 : 200, headers: kopf });
}

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

    /* Das Downloadzentrum vor allem anderen: Es liefert Dateien, und die
       Regel gleich darunter würde jede Datei als „gibt es nicht" abtun. */
    if (pfad === '/dl' || pfad.startsWith('/dl/')) {
      try {
        return await ausDemDownloadzentrum(request, pfad === '/dl' ? '/dl/' : pfad);
      } catch {
        return nichtGefunden('Das Downloadzentrum antwortet gerade nicht.');
      }
    }

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
