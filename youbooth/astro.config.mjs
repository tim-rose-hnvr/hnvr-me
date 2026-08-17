import { defineConfig } from 'astro/config';

// Statische Auslieferung. Interaktive Seiten laufen als Inseln im Browser,
// der Rest ist vorgerendertes HTML — kein Server noetig.
export default defineConfig({
  site: 'https://youbooth.me',
  build: { format: 'directory' },
});
