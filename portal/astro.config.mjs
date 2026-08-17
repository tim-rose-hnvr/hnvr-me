// @ts-check
import { defineConfig } from 'astro/config';

/* Astro 5 — Voraussetzung für „npm create @wix/new@latest -- headless link".
   Der Link-Befehl ergänzt hier selbst den Wix-Adapter und die Integration;
   bis dahin baut das Projekt als statische Seite und lässt sich örtlich
   ansehen (npm run dev). */
export default defineConfig({
  site: 'https://werkbank.example',
  build: { format: 'directory' },
});
