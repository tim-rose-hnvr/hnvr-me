/**
 * Vorschaltdatei: die einzige Brücke zwischen Hülle und Oberfläche.
 *
 * Absichtlich schmal. Die Oberfläche braucht von der Hülle nur zu WISSEN, dass
 * es sie gibt — alles Fachliche geht über den Server der Box, denselben Weg,
 * den auch das Handy im WLAN nimmt. Was hier nicht steht, kann die Oberfläche
 * nicht anrichten.
 */

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('youboothHuelle', {
  fassung: process.env.npm_package_version || require('../package.json').version,
  system:
    process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux',
});
