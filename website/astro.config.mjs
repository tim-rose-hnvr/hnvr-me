import { defineConfig } from 'astro/config';

// Statische Seiten. Die Marketingseite braucht keinen Server: sie zeigt
// nichts, was sich je Besucher unterscheidet. Was einen Server braucht —
// Weiterleitung, Werkstatt, Zentrale — liegt woanders.
//
// SEITE und BASIS kommen aus der Umgebung, damit derselbe Quellstand
// unter pnkt.me und in einem Unterverzeichnis laeuft. Ohne beides gilt
// der Zielstand: eigener Rechnername, Wurzelpfad.
export default defineConfig({
  site: process.env.SEITE ?? 'https://pnkt.me',
  base: process.env.BASIS ?? '/',
  output: 'static',
  build: { inlineStylesheets: 'auto' },
});
