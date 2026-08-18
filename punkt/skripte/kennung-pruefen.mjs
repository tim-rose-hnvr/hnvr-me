/**
 * Prüft, ob die Kennungen in wix.config.json stehen.
 *
 * Die `siteId` ist bekannt — sie steht in der veröffentlichten Seite und
 * im Wix-Konto. Die `appId` nicht: sie entsteht beim Anlegen des
 * Projekts und liegt nur in dessen Ordner. Es gibt keine Schnittstelle,
 * über die man sie abfragen könnte, und das CLI kann einen bestehenden
 * Projektstand nicht herunterladen.
 *
 * Ohne sie bricht diese Prüfung ab, statt einen Bau zu starten, der
 * zwanzig Sekunden später mit einer unverständlichen Meldung endet —
 * oder, schlimmer, an der falschen Stelle landet.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const datei = resolve(import.meta.dirname, '..', 'wix.config.json');
const config = JSON.parse(readFileSync(datei, 'utf8'));
const platzhalter = /HIER-DIE-APP-ID/;

if (!config.appId || platzhalter.test(config.appId)) {
  console.error(`
In ${datei} fehlt die appId.

Sie steht in der wix.config.json des bestehenden PUNKT-Projekts — der
Ordner, aus dem heraus die Seite punkt-954d3e9b-hnvrme.wix-site-host.com
bisher ausgeliefert wurde. Zwei Zeilen, kein Geheimnis:

  { "appId": "…", "siteId": "710946fa-e37e-43d7-9f1e-0db6bec22300" }

Den Wert der appId hier eintragen, dann läuft der Rest von allein.
`.trim());
  process.exit(1);
}

if (config.siteId !== '710946fa-e37e-43d7-9f1e-0db6bec22300') {
  console.error(`Die siteId zeigt nicht auf „QR Code" (710946fa-…), sondern auf ${config.siteId}.
Das ist entweder Absicht — dann diese Prüfung anpassen — oder ein Ausliefern
auf die falsche Site, und das merkt man erst, wenn eine fremde Seite ersetzt ist.`);
  process.exit(1);
}

console.log('Kennungen stehen: Site „QR Code", App ' + config.appId.slice(0, 8) + '…');
