/**
 * Wer läuft hier schon?
 *
 * Diese vier Fragen entscheiden, ob die Box startet oder ob der Betreiber vor
 * „Die Box startet nicht" steht. Sie stehen deshalb NICHT in `haupt.cjs`:
 * Dort hängen sie an Electron und lassen sich nur von Hand prüfen, indem man
 * auf einem Windows-Rechner eine alte Fassung stehen lässt. Hier lassen sie
 * sich messen — `tools/start-probe.mjs` tut genau das, mit einer echten alten
 * Box auf dem Port.
 */

const http = require('node:http');

/**
 * Antwortet auf diesem Port eine Box? Dann welche Fassung?
 *
 * Ohne diese Frage ist der zweite Start ein Rätsel: Der Serverprozess sagt
 * „läuft bereits" und beendet sich, die Hülle wartet 45 Sekunden auf eine
 * Meldung, die nie kommt, und zeigt „Die Box startet nicht" — obwohl auf
 * demselben Rechner eine völlig gesunde Box läuft.
 */
function frageBox(port, sekunden = 2) {
  return new Promise((fertig) => {
    const uhr = setTimeout(() => {
      anfrage.destroy();
      fertig(null);
    }, sekunden * 1000);
    const anfrage = http.get({ host: '127.0.0.1', port, path: '/api/version', timeout: sekunden * 1000 }, (antwort) => {
      let text = '';
      antwort.on('data', (t) => {
        text += t;
        if (text.length > 8192) anfrage.destroy();
      });
      antwort.on('end', () => {
        clearTimeout(uhr);
        try {
          const daten = JSON.parse(text);
          fertig(daten && daten.version ? { port, version: String(daten.version) } : null);
        } catch {
          fertig(null);
        }
      });
    });
    anfrage.on('error', () => {
      clearTimeout(uhr);
      fertig(null);
    });
    anfrage.on('timeout', () => anfrage.destroy());
  });
}

/** Sucht auf den Ports, auf die die Box ausweichen würde. */
async function sucheLaufendeBox(wunschport, spanne = 10) {
  for (let i = 0; i <= spanne; i++) {
    const gefunden = await frageBox(wunschport + i, i === 0 ? 2 : 0.6);
    if (gefunden) return gefunden;
  }
  return null;
}

/**
 * Bittet eine ältere Box, den Platz zu räumen.
 *
 * Sie stammt aus einer vorigen Installation und ist beim Aktualisieren übrig
 * geblieben. Sie einfach weiterzubenutzen wäre falsch: Sie liefert die alte
 * Oberfläche aus, und der Betreiber sähe von seiner Aktualisierung nichts.
 *
 * Fassungen vor 1.0.4 kennen diesen Weg nicht — dann antwortet niemand, und
 * der Aufrufer muss ausweichen statt zu warten.
 */
function bitteBoxZuBeenden(port) {
  return new Promise((fertig) => {
    const anfrage = http.request(
      { host: '127.0.0.1', port, path: '/api/beenden', method: 'POST', timeout: 3000 },
      (antwort) => {
        antwort.resume();
        antwort.on('end', () => fertig(antwort.statusCode === 200));
      }
    );
    anfrage.on('error', () => fertig(false));
    anfrage.on('timeout', () => {
      anfrage.destroy();
      fertig(false);
    });
    anfrage.end();
  });
}

/** Wartet, bis auf dem Port niemand mehr antwortet. */
async function wartetBisFrei(port, sekunden = 10) {
  for (let i = 0; i < sekunden * 2; i++) {
    if (!(await frageBox(port, 0.5))) return true;
    await new Promise((weiter) => setTimeout(weiter, 500));
  }
  return false;
}

/** Der erste Port, auf dem gar nichts antwortet. */
async function ersterFreierPort(wunschport, spanne = 10) {
  for (let i = 0; i <= spanne; i++) {
    if (!(await frageBox(wunschport + i, 0.6))) return wunschport + i;
  }
  return wunschport;
}

/**
 * Was die Hülle vor dem eigenen Start tun soll. Drei Fälle, drei Antworten —
 * vorher gab es nur einen: aufgeben.
 *
 *   `benutzen`  Es läuft schon dieselbe Fassung. Fenster draufzeigen, fertig.
 *   `starten`   Nichts da (oder die alte hat Platz gemacht). Selbst starten.
 *   `ausweichen` Die alte lässt sich nicht bitten. Selbst starten, aber auf
 *               einem freien Port — sonst übernähme das Fenster die alte
 *               Oberfläche, und die Aktualisierung wäre unsichtbar.
 */
async function wieStarten(wunschport, eigeneFassung, melde = () => {}) {
  const vorhanden = await sucheLaufendeBox(wunschport);
  if (!vorhanden) return { art: 'starten', port: wunschport };

  if (vorhanden.version === eigeneFassung) {
    melde(`Eine Box der Fassung ${vorhanden.version} läuft schon auf Port ${vorhanden.port} — sie wird benutzt.`);
    return { art: 'benutzen', port: vorhanden.port };
  }

  melde(`Auf Port ${vorhanden.port} läuft noch Fassung ${vorhanden.version} — sie wird gebeten aufzuhören.`);
  const gehoert = await bitteBoxZuBeenden(vorhanden.port);
  const frei = await wartetBisFrei(vorhanden.port, gehoert ? 10 : 4);
  if (frei) {
    melde('Der Platz ist frei.');
    return { art: 'starten', port: wunschport };
  }

  const port = await ersterFreierPort(wunschport);
  melde(`Die alte Box antwortet weiter — die neue startet auf Port ${port}.`);
  return { art: 'ausweichen', port };
}

module.exports = { frageBox, sucheLaufendeBox, bitteBoxZuBeenden, wartetBisFrei, ersterFreierPort, wieStarten };
