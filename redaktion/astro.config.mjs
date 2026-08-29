import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

/**
 * Astro 5, Server-Ausgabe, Node-Adapter.
 *
 * Der Node-Adapter ist eine Entscheidung, keine Bequemlichkeit. Das Versprechen
 * dieses Produkts ist, dass ein Kunde es selbst betreiben kann — auf einem
 * Server in der EU, in einem Container, ohne dass beim Versand einer Kampagne
 * ein fremder Dienst mitliest. Ein Adapter, der nur bei einem Anbieter läuft,
 * würde genau das aufgeben.
 *
 * `output: 'server'` ist ebenfalls Absicht: ein Redaktionsplan ist für jeden
 * Betrachter ein anderer, und eine Freigabe, die erst nach dem nächsten Bau
 * sichtbar wird, ist keine.
 */
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),

  site: process.env.REDAKTION_SITE ?? 'http://localhost:4321',
  trailingSlash: 'never',

  build: {
    // Ein Redaktionswerkzeug wird den ganzen Tag benutzt. Jeder eingesparte
    // Rundlauf zum Server ist ein gesparter Wimpernschlag mal tausend.
    inlineStylesheets: 'always',
  },

  vite: {
    build: { assetsInlineLimit: 4096 },
  },
});
