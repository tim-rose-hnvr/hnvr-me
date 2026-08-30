/* Vollprüfung — jede Fähigkeit der Oberfläche einmal anfassen.

   Aufruf:  node werkzeuge/vollpruefung.mjs
   Ergänzt pruefen.mjs: dort steht das Ergebnis in der Datei im Vordergrund,
   hier die Bedienung — Zoom, Tafeln, Werkzeuge, Dialoge, Tastatur.

   Diese Datei ist nur noch die Reihenfolge. Der Aufbau steht in
   `pruefstand.mjs`, die Prüfungen in `pruefungen/`. Die Reihenfolge ist Teil
   der Sache: alle Gruppen teilen sich **eine** Seite und bauen aufeinander
   auf — wer eine neue einhängt, hängt sie dorthin, wo der Zustand passt, den
   sie erwartet.

   Eine einzelne Gruppe laufen lassen:
       node werkzeuge/vollpruefung.mjs gestaltung */

import { starte, abschluss } from './pruefstand.mjs';

const GRUPPEN = [
  '01-bedienung', '02-dokument', '03-wege', '04-dialoge',
  '05-gestaltung', '06-messen', '07-befehle', '08-anmeldung', '10-felderkennung', '11-bedienbarkeit', '09-einrichten',
];

const gewaehlt = process.argv.slice(2);
const laufen = gewaehlt.length
  ? GRUPPEN.filter((g) => gewaehlt.some((w) => g.includes(w)))
  : GRUPPEN;

if (!laufen.length) {
  console.error(`Keine Gruppe zu „${gewaehlt.join(' ')}" — es gibt: ${GRUPPEN.join(', ')}`);
  process.exit(2);
}

const stand = await starte();
console.log(`${stand.befehle.length} Befehle registriert`);

for (const gruppe of laufen) {
  const { default: pruefeGruppe } = await import(`./pruefungen/${gruppe}.mjs`);
  await pruefeGruppe(stand);
}

await abschluss(stand);
