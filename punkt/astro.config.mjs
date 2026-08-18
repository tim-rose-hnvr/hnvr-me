import { defineConfig } from 'astro/config';
import wixHostingAdapter from '@wix/astro-wix-hosting-adapter';
import wix from '@wix/astro';

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
 * `output: 'server'` wie bei Get in Touch, dem einzigen Projekt hier,
 * das nachweislich ausliefert. Inhaltlich wäre `'static'` richtiger —
 * die Seite zeigt je Besucher dasselbe —, aber der Wix-Bau ist an
 * dieser Stelle nicht erprobt, und ein Deploy ist der falsche Ort für
 * einen Versuch. Umstellen, wenn einmal etwas steht.
 *
 * Astro 5 — Version 6 unterstützt die Wix-Anbindung nicht. Der Adapter
 * gehört auf den obersten `adapter`-Schlüssel, nicht in `integrations`:
 * in der Liste läuft der Bau scheinbar durch und bricht erst beim
 * Ausliefern mit `NoAdapterInstalled` ab.
 */
/**
 * Die dynamischen Wege gibt es nur hier.
 *
 * `website/` bleibt eine statische Seite, die überall liegen kann — auf
 * GitHub Pages, auf einem Stick, in einer einzigen Datei. Eine Route
 * wie /r/{kürzel} braucht dagegen eine Laufzeit, die antwortet. Beides
 * im selben Verzeichnis würde den statischen Bau brechen: Astro
 * verlangt dort `getStaticPaths`, und das gibt es für ein Kürzel nicht,
 * das erst morgen entsteht.
 *
 * `injectRoute` löst genau das: die Dateien liegen außerhalb von
 * `src/pages`, und nur dieses Projekt hängt sie ein.
 */
function dynamischeWege() {
  return {
    name: 'pnkt-dynamisch',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        injectRoute({ pattern: '/r/[kuerzel]', entrypoint: './dynamisch/weiterleitung.ts' });
        injectRoute({ pattern: '/anmelden', entrypoint: './dynamisch/anmelden.astro' });
        injectRoute({ pattern: '/zentrale', entrypoint: './dynamisch/zentrale.astro' });
        injectRoute({ pattern: '/zahlen', entrypoint: './dynamisch/zahlen.astro' });
        injectRoute({ pattern: '/api/anmelden', entrypoint: './dynamisch/api-anmelden.ts' });
        injectRoute({ pattern: '/api/abmelden', entrypoint: './dynamisch/api-abmelden.ts' });
        injectRoute({ pattern: '/api/ziel', entrypoint: './dynamisch/api-ziel.ts' });
        injectRoute({ pattern: '/api/registrieren', entrypoint: './dynamisch/api-registrieren.ts' });
        injectRoute({ pattern: '/api/neu', entrypoint: './dynamisch/api-neu.ts' });
        injectRoute({ pattern: '/api/stand', entrypoint: './dynamisch/api-stand.ts' });
        injectRoute({ pattern: '/api/name', entrypoint: './dynamisch/api-name.ts' });
        injectRoute({ pattern: '/api/kuerzel', entrypoint: './dynamisch/api-kuerzel.ts' });
      },
    },
  };
}

export default defineConfig({
  srcDir: '../website/src',
  publicDir: '../website/public',
  output: 'server',
  adapter: wixHostingAdapter(),
  // Die Anbindung `wix()` muss mit, obwohl die Seite keine einzige
  // Wix-Funktion benutzt. Ohne sie laesst sich nicht ausliefern:
  //
  //   `wix release` verlangt .wix/build-metadata.json, und geschrieben
  //   wird diese Datei im Hook `astro:build:done` von @wix/astro.
  //   Ohne die Anbindung baut es sauber durch und `release` bricht ab
  //   mit „Project build output is missing".
  //
  // Der Preis: sie liest beim Bauen WIX_CLIENT_ID. Deshalb steht im
  // Workflow ein `wix env pull` — der Bau laeuft nicht mehr ohne
  // Anmeldung. Beides ist nachgesehen und nicht geraten.
  integrations: [wix(), dynamischeWege()],
  site: process.env.SEITE ?? 'https://punkt-954d3e9b-hnvrme.wix-site-host.com',
});
