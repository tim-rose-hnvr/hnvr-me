import { defineConfig } from 'vite';

// Der Booth laeuft im Browser und — gleich verpackt — als Desktop-App.
// Kein externer Abruf: alles wird gebuendelt ausgeliefert.
export default defineConfig({
  server: { port: 4400, strictPort: true },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // Zwei Oberflaechen: Booth fuer Gaeste, Cockpit fuer Betreiber.
      input: { booth: 'index.html', cockpit: 'cockpit.html' },
    },
  },
  clearScreen: false,
});
