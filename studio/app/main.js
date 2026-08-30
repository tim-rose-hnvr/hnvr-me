/* Anschlusspunkt. Lädt den PDF-Motor und startet die Oberfläche. */

import { sage, $, zustand } from './kern.js';
import { starteMotor } from './dokument.js';
import { starteOberflaeche, befehle, fuehreAus } from './oberflaeche.js';
import { frageAnmeldung, zeigeSchranke } from './anmeldung.js';

async function start() {
  try {
    await starteMotor();
  } catch (fehler) {
    console.error(fehler);
    $('#empfang').innerHTML = '<div class="empfang-karte"><h1>Motor fehlt</h1>'
      + '<p class="leise">Die PDF-Bibliothek unter <code>fremd/</code> ließ sich nicht laden. '
      + 'Das Studio muss über einen Webserver laufen (<code>python3 -m http.server</code>), nicht per Doppelklick als <code>file://</code>.</p></div>';
    return;
  }
  starteOberflaeche();
  document.documentElement.classList.add('ist-bereit');

  /* Startbefehle aus der Adresse — die Verknüpfungen der installierten
     Anwendung landen hier: „Datei öffnen", „Beispiel ansehen". */
  const adresse = new URLSearchParams(location.search);
  const tun = adresse.get('tun');
  if (tun === 'oeffnen') fuehreAus('datei:oeffnen');
  if (tun === 'beispiel') $('#knopf-beispiel')?.click();

  /* Ein Werkzeug, eine Adresse: `?werkzeug=zusammenfuegen` führt direkt
     dorthin, ohne den Umweg über die ganze Werkbank. Gibt es das Werkzeug
     nicht, bleibt es beim gewohnten Empfang — eine falsche Adresse soll eine
     Anwendung nicht ins Leere führen. */
  const werkzeugId = adresse.get('werkzeug');
  if (werkzeugId) {
    const { zeigeEinzelwerkzeug } = await import('./einzelwerkzeuge.js');
    if (!zeigeEinzelwerkzeug(werkzeugId)) {
      sage(`Das Werkzeug „${werkzeugId}" gibt es nicht.`, { art: 'warn', dauer: 6000 });
    }
  }

  /* Erst die Oberfläche, dann die Frage nach der Anmeldung. In dieser
     Reihenfolge, weil das Studio auch dann startklar sein muss, wenn die
     Auskunft lange braucht oder gar nicht kommt. */
  const anmeldung = await frageAnmeldung();
  if (anmeldung.noetig && !anmeldung.angemeldet) {
    zeigeSchranke({ ohneNetz: anmeldung.ausDemGedaechtnis });
  } else if (anmeldung.ausDemGedaechtnis) {
    /* Angemeldet laut Merkzettel, nicht laut Server. Das gehört gesagt —
       einmal, leise, mit der Zahl, damit niemand vom Ablauf überrascht wird. */
    sage(`Ohne Verbindung angemeldet — die Anmeldung hält noch ${anmeldung.tage} Tage.`,
      { dauer: 8000 });
  }
  // Zugang für Prüfläufe und für die Werkstatt: alles, was die Oberfläche
  // kann, ist hier auch ohne Mausweg erreichbar.
  globalThis.studio = { zustand, befehle, fuehreAus };
}

start().catch((fehler) => {
  console.error(fehler);
  sage(`Start gescheitert: ${fehler.message}`, { art: 'fehler', dauer: 0 });
});
