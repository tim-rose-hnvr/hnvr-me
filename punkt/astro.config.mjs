import { defineConfig } from 'astro/config';
import wixHostingAdapter from '@wix/astro-wix-hosting-adapter';

/**
 * PUNKT auf Wix-Hosting.
 *
 * Der Kern dieser Datei sind die beiden Zeilen `srcDir` und `publicDir`:
 * sie zeigen nach ../website. Die Seiten werden NICHT hierher kopiert.
 *
 * Der Grund steht in der Projektanweisung: ein Programm, keine
 * Sonderzweige. Zwei Kopien derselben Seite laufen auseinander, und man
 * merkt es erst, wenn die ausgelieferte Fassung etwas anderes sagt als
 * die, an der man arbeitet. Hier gibt es genau eine Quelle, und dieses
 * Verzeichnis ist nur die Hülle, die Wix zum Ausliefern braucht.
 *
 * `output: 'static'`, weil die Seite je Besucher nichts Eigenes zeigt.
 * Sie fragt nichts ab, sie rechnet nichts — sie liegt fertig da. Das ist
 * auch der schnellste Fall und der einzige, der ohne laufenden Prozess
 * überlebt.
 *
 * Astro 5 — Version 6 unterstützt die Wix-Anbindung nicht. Der Adapter
 * gehört auf den obersten `adapter`-Schlüssel, nicht in `integrations`:
 * in der Liste läuft der Bau scheinbar durch und bricht erst beim
 * Ausliefern mit `NoAdapterInstalled` ab.
 */
export default defineConfig({
  srcDir: '../website/src',
  publicDir: '../website/public',
  output: 'static',
  adapter: wixHostingAdapter(),
  // Ohne die Anbindung `wix()`. Sie bringt CMS, Mitglieder und Warenkorb
  // mit und verlangt dafuer WIX_CLIENT_ID — die Marketingseite braucht
  // nichts davon. Was nicht eingebunden ist, kann auch nichts nachladen:
  // die ausgelieferte Seite bleibt dieselbe, die hier gebaut wird.
  site: process.env.SEITE ?? 'https://punkt-954d3e9b-hnvrme.wix-site-host.com',
});
