import { defineConfig } from 'vite';

// Der Booth laeuft im Browser und — gleich verpackt — als Desktop-App.
// Kein externer Abruf: alles wird gebuendelt ausgeliefert.
export default defineConfig({
  server: {
    port: 4400,
    strictPort: true,
    /* Im Entwicklungsbetrieb laufen zwei Dinge: Vite mit dem Neuladen beim
       Tippen und der Box-Server mit Fotos, Einstellungen und Vorlagen. Alles,
       was zum Server gehört, geht von hier dorthin — so ist die Adresse im
       Browser dieselbe wie später im Betrieb, wo der Server allein ausliefert. */
    proxy: {
      '/api': { target: 'http://localhost:3377', changeOrigin: true },
      '/photos': { target: 'http://localhost:3377', changeOrigin: true },
      '/ws': { target: 'ws://localhost:3377', ws: true },
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // Zwei Oberflaechen: Booth fuer Gaeste, Cockpit fuer Betreiber.
      input: {
        booth: 'index.html',
        cockpit: 'cockpit.html',
        wand: 'wand.html',
        galerie: 'galerie.html',
        einrichtung: 'einrichtung.html',
        editor: 'editor.html',
        portal: 'portal.html',
      },
    },
  },
  clearScreen: false,
});
