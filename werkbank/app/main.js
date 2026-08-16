/* Anschlusspunkt. Lädt den PDF-Motor und startet die Oberfläche. */

import { sage, $, zustand } from './kern.js';
import { starteMotor } from './dokument.js';
import { starteOberflaeche, befehle, fuehreAus } from './oberflaeche.js';

async function start() {
  try {
    await starteMotor();
  } catch (fehler) {
    console.error(fehler);
    $('#empfang').innerHTML = '<div class="empfang-karte"><h1>Motor fehlt</h1>'
      + '<p class="leise">Die PDF-Bibliothek unter <code>fremd/</code> ließ sich nicht laden. '
      + 'Die Werkbank muss über einen Webserver laufen (<code>python3 -m http.server</code>), nicht per Doppelklick als <code>file://</code>.</p></div>';
    return;
  }
  starteOberflaeche();
  document.documentElement.classList.add('ist-bereit');
  // Zugang für Prüfläufe und für die Werkstatt: alles, was die Oberfläche
  // kann, ist hier auch ohne Mausweg erreichbar.
  globalThis.werkbank = { zustand, befehle, fuehreAus };
}

start().catch((fehler) => {
  console.error(fehler);
  sage(`Start gescheitert: ${fehler.message}`, { art: 'fehler', dauer: 0 });
});
