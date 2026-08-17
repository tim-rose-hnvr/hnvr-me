import { defineConfig } from 'astro/config';
import wixHostingAdapter from '@wix/astro-wix-hosting-adapter';
import react from '@astrojs/react';
import wix from '@wix/astro';

/**
 * Astro 5 — Version 6 unterstützt die Wix-Anbindung nicht.
 *
 * Der Adapter gehört auf den obersten `adapter`-Schlüssel, nicht in
 * `integrations`. Er wird gleich importiert und aufgerufen wie `wix()` oder
 * `react()`, und in der Liste läuft der Bau scheinbar durch — bricht dann aber
 * beim Ausliefern mit `NoAdapterInstalled` ab.
 *
 * `output: 'server'` ist Absicht: Profile kommen aus dem CMS und müssen sofort
 * nach dem Anlegen erreichbar sein, nicht erst nach dem nächsten
 * Veröffentlichen. Seiten, die sich nicht ändern, tragen `export const
 * prerender = true`.
 *
 * React steht hier, weil die Wix-Anbindung es mitbringt. Die Seite selbst
 * benutzt es nicht — sie kommt mit einem einzigen eigenen Skript aus.
 */
export default defineConfig({
  output: 'server',
  adapter: wixHostingAdapter(),
  integrations: [react(), wix()],
  /**
   * Die Adresse, unter der die Seite wirklich liegt — nicht die, unter der sie
   * einmal liegen soll. Aus ihr entstehen Canonical-Angabe, Vorschaukarte und
   * vor allem der QR-Code. Ein QR-Code auf einem Fahrzeug, der ins Leere zeigt,
   * ist teurer als jeder Umzug: sobald eine eigene Domain davorsteht, wird hier
   * eine Zeile geändert und neu ausgeliefert.
   */
  site: process.env.GETINTOUCH_SITE ?? 'https://get-in-tou-35a520f5-hnvrme.wix-site-host.com',
  trailingSlash: 'never',

  build: {
    inlineStylesheets: 'always',
  },

  image: {
    domains: ['static.wixstatic.com'],
  },

  vite: {
    build: {
      // Die Seite soll auch auf schlechter Verbindung im Saal-WLAN eines
      // Kunden schnell stehen. Ein einziges kleines Bündel schlägt viele.
      assetsInlineLimit: 4096,
    },
  },
});
