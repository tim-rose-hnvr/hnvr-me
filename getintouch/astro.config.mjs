import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

/**
 * Astro 5 — Version 6 unterstützt die Wix-Anbindung nicht.
 *
 * Der Node-Adapter ist die Übergangslösung für Entwicklung und `npm run build`
 * ohne Wix-Konto. Sobald das Projekt mit
 *
 *     npm create @wix/new@latest headless link
 *
 * verbunden wird, trägt Wix seine eigene Anbindung ein und übernimmt Adapter
 * und Authentifizierung. Der Node-Adapter kann dann raus.
 *
 * `output: 'server'` ist Absicht: Profile kommen später aus dem CMS und müssen
 * sofort nach dem Anlegen erreichbar sein, nicht erst nach dem nächsten
 * Veröffentlichen. Seiten, die sich nicht ändern, tragen `export const
 * prerender = true`.
 */
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  site: process.env.GETINTOUCH_SITE ?? 'https://hnvr.me',
  trailingSlash: 'never',
  build: {
    inlineStylesheets: 'always',
  },
  vite: {
    build: {
      // Die Seite soll auch auf schlechter Verbindung im Saal-WLAN eines
      // Kunden schnell stehen. Ein einziges kleines Bündel schlägt viele.
      assetsInlineLimit: 4096,
      rollupOptions: {
        // Das Wix-SDK wird erst geladen, wenn GETINTOUCH_WIX_COLLECTION gesetzt
        // ist. Solange das Projekt nicht mit Wix verbunden ist, ist das Paket
        // nicht installiert — der Bündler soll es deshalb in Ruhe lassen statt
        // den Bau abzubrechen.
        external: ['@wix/data'],
      },
    },
    ssr: {
      external: ['@wix/data'],
    },
  },
});
