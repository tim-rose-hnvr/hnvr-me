/**
 * Vorschaltdatei: die einzige Brücke zwischen Hülle und Oberfläche.
 *
 * Absichtlich schmal. Die Oberfläche braucht von der Hülle nur zu WISSEN, dass
 * es sie gibt — alles Fachliche geht über den Server der Box, denselben Weg,
 * den auch das Handy im WLAN nimmt. Was hier nicht steht, kann die Oberfläche
 * nicht anrichten.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('youboothHuelle', {
  fassung: process.env.npm_package_version || require('../package.json').version,
  system:
    process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux',

  /* Vollbild auf Zuruf. Die Box startet im Fenster — für den Abend gehört sie
     ins Vollbild, für die Einrichtung nicht. Beides muss die Oberfläche
     auslösen können, sonst bliebe nur F11, und das findet nicht jeder. */
  vollbild: (an) => ipcRenderer.invoke('huelle:vollbild', an),
  istVollbild: () => ipcRenderer.invoke('huelle:ist-vollbild'),
});
