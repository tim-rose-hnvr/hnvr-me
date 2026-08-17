import { defineConfig } from 'astro/config';

// Statische Seiten. Die Marketingseite braucht keinen Server: sie zeigt
// nichts, was sich je Besucher unterscheidet. Was einen Server braucht —
// Weiterleitung, Werkstatt, Zentrale — liegt woanders.
export default defineConfig({
  site: 'https://pnkt.me',
  output: 'static',
  build: { inlineStylesheets: 'auto' },
});
