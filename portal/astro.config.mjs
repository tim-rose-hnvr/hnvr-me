// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import wix from '@wix/astro';
import wixHostingAdapter from '@wix/astro-wix-hosting-adapter';

/* Astro 5 — Voraussetzung für „npm create @wix/new@latest -- headless link".
   Der Link-Befehl hat hier den Wix-Adapter und die Integration ergänzt. */
export default defineConfig({
  site: 'https://werkbank-b2ce6ab2-hnvrme.wix-site-host.com',
  build: { format: 'directory' },

  /* Die Werkbank liegt als unveränderte Dateien in public/werkbank und geht
     nicht durch Astro. Das Wix-Hosting liefert dort kein Verzeichnisregister
     aus: /werkbank/ allein ergibt 404. Diese beiden Umleitungen fangen das ab,
     damit auch eine von Hand eingegebene Adresse ankommt. */
  redirects: {
    '/werkbank': '/werkbank/index.html',
    '/werkbank/': '/werkbank/index.html',
  },
  integrations: [react(), wix()],
  adapter: wixHostingAdapter(),

  image: {
    domains: ['static.wixstatic.com'],
  },

  output: 'server',
});