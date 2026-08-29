// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import wix from '@wix/astro';
import wixHostingAdapter from '@wix/astro-wix-hosting-adapter';

/* Astro 5 — Voraussetzung für „npm create @wix/new@latest -- headless link".
   Der Link-Befehl hat hier den Wix-Adapter und die Integration ergänzt. */
export default defineConfig({
  /* Die Adresse, unter der die Seite wirklich erreichbar ist. Der Produktname
     ist „PDF Studio", die vorgesehene Adresse `pdf-studio.me` — aber sie ist
     noch nicht angemeldet und zeigt nirgendwohin. Hier steht deshalb weiter
     der Wix-Wirt: `site` bestimmt die kanonischen Adressen und die Sitemap,
     und eine Sitemap, die auf eine tote Adresse zeigt, ist schlimmer als
     keine. Sobald `pdf-studio.me` im Wix-Verwaltungsbereich angeschlossen ist,
     wird aus dieser Zeile `site: 'https://pdf-studio.me'` — und sonst nichts. */
  site: 'https://werkbank-b2ce6ab2-hnvrme.wix-site-host.com',
  build: { format: 'directory' },

  /* Das Studio liegt als unveränderte Dateien in public/studio und geht
     nicht durch Astro. Das Wix-Hosting liefert dort kein Verzeichnisregister
     aus: /studio/ allein ergibt 404. Diese beiden Umleitungen fangen das ab,
     damit auch eine von Hand eingegebene Adresse ankommt. */
  redirects: {
    '/studio': '/studio/index.html',
    '/studio/': '/studio/index.html',
  },
  integrations: [react(), wix()],
  adapter: wixHostingAdapter(),

  image: {
    domains: ['static.wixstatic.com'],
  },

  output: 'server',
});