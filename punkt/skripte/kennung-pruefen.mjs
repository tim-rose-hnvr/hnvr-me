/**
 * Prüft, ob die Kennungen in wix.config.json stehen.
 *
 * Beide Kennungen stehen. Die `appId` war nicht im Repository und ließ
 * sich auch nicht direkt abfragen — es gibt keinen Aufruf, der die
 * eigenen Apps aufzählt. Ermittelt wurde sie über die auf der Site
 * installierten Apps:
 *
 *   GET /apps-installer-service/v1/app-instances   (je Site)
 *
 * Ein von Wix gebautes App steht auf vielen Sites, das eigene Projekt-App
 * auf genau einer. Auf „QR Code" blieb nach dem Abgleich mit fünf anderen
 * Sites des Kontos genau eine Kennung übrig: 1af487c5-…. Gegenprobe mit
 * Get in Touch, dessen appId bekannt ist — dieselbe Signatur, nur auf
 * seiner eigenen Site.
 *
 * Die Prüfung bleibt trotzdem stehen: sie fängt den Fall ab, dass jemand
 * die Datei leert oder auf eine fremde Site zeigen lässt. Ein Ausliefern
 * an die falsche Stelle merkt man erst, wenn eine fremde Seite ersetzt
 * ist.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const datei = resolve(import.meta.dirname, '..', 'wix.config.json');
const config = JSON.parse(readFileSync(datei, 'utf8'));
const platzhalter = /HIER-DIE-APP-ID/;
const punktApp = '1af487c5-42a5-445d-89fc-65f1aa40cc32';

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
