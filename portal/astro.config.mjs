// @ts-check
import { defineConfig, envField } from 'astro/config';

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
  /* HNVR_CLIENT_ID: die Kennung des Zugangs „PDF Studio" im Wix-Projekt von
     www.hnvr.me. Über ihn meldet das Studio mit dem hnvr.me-Konto an
     (src/hnvr.js). Sie ist nicht geheim — eine Client-Kennung steht in jedem
     Anmeldelink —, aber sie ist Pflicht: ohne sie bricht der Bau ab. Eine
     Fassung, die veröffentlicht wird und dann niemanden anmelden kann, soll
     es nicht geben.

     Setzen: in .env (örtlich) oder mit `npx wix env set --key HNVR_CLIENT_ID
     --value …` für den Bau über die Wix-CLI. */
  env: {
    schema: {
      HNVR_CLIENT_ID: envField.string({ context: 'server', access: 'public' }),
    },
  },
  integrations: [react(), wix()],
  adapter: wixHostingAdapter(),

  image: {
    domains: ['static.wixstatic.com'],
  },

  output: 'server',
});