/**
 * Derselbe Spike als Custom Element — für die Messung im Seitenkontext.
 *
 * Das ist nicht doppelte Arbeit, sondern der eigentliche Punkt: die CSP eines
 * Wix-HTML-Embeds (abgeschottetes iFrame, fremde Herkunft) hat mit der CSP der
 * Wix-Seite selbst nichts zu tun. Nur die Messung im Seitenkontext sagt etwas
 * über den geplanten Auslieferungsweg aus — das HTML-Embed ist bloß die
 * Vergleichsprobe.
 *
 * Einbau nach der Anleitung für Custom Elements in der Wix CLI:
 * https://dev.wix.com/docs/build-apps/develop-your-app/develop-an-app-with-the-cli/supported-extensions/site/custom-elements/add-a-custom-element-extension-with-the-wix-cli
 *
 * Das Ergebnis liegt anschließend unter `window.spikeErgebnis` und wird
 * zusätzlich als `spike-fertig`-Ereignis am Element gemeldet.
 */

const WASM_KOPF = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
const A4_300 = { breite: 2480, hoehe: 3508 };

const pruefungen = [
  {
    name: 'WebAssembly.compile',
    kritisch: true,
    async lauf() {
      await WebAssembly.compile(WASM_KOPF);
      return 'kompiliert';
    },
  },
  {
    name: 'WebAssembly.instantiate',
    kritisch: true,
    async lauf() {
      const { instance } = await WebAssembly.instantiate(WASM_KOPF, {});
      return instance ? 'instanziiert' : 'keine Instanz';
    },
  },
  {
    name: 'OffscreenCanvas',
    kritisch: true,
    async lauf() {
      if (typeof OffscreenCanvas === 'undefined') throw new Error('nicht vorhanden');
      const leinwand = new OffscreenCanvas(64, 64);
      const stift = leinwand.getContext('2d');
      if (!stift) throw new Error('kein 2d-Kontext');
      stift.fillRect(0, 0, 64, 64);
      const blob = await leinwand.convertToBlob({ type: 'image/png' });
      return `${blob.size} Byte PNG`;
    },
  },
  {
    name: 'Canvas in Druckgröße',
    kritisch: true,
    async lauf() {
      const leinwand = document.createElement('canvas');
      leinwand.width = A4_300.breite;
      leinwand.height = A4_300.hoehe;
      const stift = leinwand.getContext('2d');
      if (!stift) throw new Error('kein 2d-Kontext');
      stift.fillStyle = '#0a4';
      stift.fillRect(0, 0, 400, 400);
      if (stift.getImageData(10, 10, 1, 1).data[3] === 0) {
        throw new Error('Zeichnung kam nicht an — Größe vermutlich gedeckelt');
      }
      return `${leinwand.width}×${leinwand.height} beschreibbar`;
    },
  },
  {
    name: 'Schrift aus data:-URI',
    kritisch: true,
    async lauf() {
      if (typeof FontFace === 'undefined') throw new Error('FontFace nicht vorhanden');
      const schrift = new FontFace('SpikeProbe', 'url(data:font/woff2;base64,d09GMgABAAAAAAAM)');
      try {
        await schrift.load();
        return 'geladen';
      } catch (fehler) {
        const meldung = String(fehler?.message ?? fehler);
        if (/csp|content security|violat|refus|block/i.test(meldung)) throw fehler;
        return 'data:-URI erreichbar (Parserfehler erwartet)';
      }
    },
  },
  {
    name: 'Worker aus Blob-URL',
    kritisch: false,
    async lauf() {
      const quelle = URL.createObjectURL(
        new Blob(['self.onmessage=()=>self.postMessage("da")'], { type: 'text/javascript' }),
      );
      try {
        const arbeiter = new Worker(quelle);
        const antwort = await new Promise((loese, brich) => {
          const uhr = setTimeout(() => brich(new Error('Zeitüberschreitung')), 3000);
          arbeiter.onmessage = (e) => { clearTimeout(uhr); loese(e.data); };
          arbeiter.onerror = (e) => { clearTimeout(uhr); brich(new Error(e.message || 'Worker-Fehler')); };
          arbeiter.postMessage('los');
        });
        arbeiter.terminate();
        return String(antwort);
      } finally {
        URL.revokeObjectURL(quelle);
      }
    },
  },
];

async function messe() {
  const bericht = [];
  for (const pruefung of pruefungen) {
    try {
      bericht.push({ name: pruefung.name, kritisch: pruefung.kritisch, bestanden: true, ausgabe: await pruefung.lauf() });
    } catch (fehler) {
      bericht.push({
        name: pruefung.name,
        kritisch: pruefung.kritisch,
        bestanden: false,
        ausgabe: String(fehler?.message ?? fehler),
      });
    }
  }
  return {
    umgebung: {
      adresse: location.href,
      herkunft: location.origin,
      imRahmen: window.self !== window.top,
      sichererKontext: window.isSecureContext,
      browser: navigator.userAgent,
      gemessenAm: new Date().toISOString(),
    },
    pruefungen: bericht,
  };
}

class SpikeElement extends HTMLElement {
  connectedCallback() {
    this.textContent = 'Messung läuft …';
    void messe().then((ergebnis) => {
      globalThis.spikeErgebnis = ergebnis;
      const gescheitert = ergebnis.pruefungen.filter((p) => p.kritisch && !p.bestanden);
      const zeilen = ergebnis.pruefungen
        .map((p) => `${p.bestanden ? '✓' : p.kritisch ? '✗' : '·'} ${p.name}: ${p.ausgabe}`)
        .join('\n');
      const fazit =
        gescheitert.length === 0
          ? 'Druckexport ist in dieser Umgebung möglich.'
          : `Druckexport hier NICHT möglich — es fehlt: ${gescheitert.map((p) => p.name).join(', ')}.`;

      // Kein innerHTML: der Spike soll unter jeder CSP laufen, auch ohne unsafe-inline.
      const kasten = document.createElement('pre');
      kasten.style.font = '12px/1.5 ui-monospace, Menlo, monospace';
      kasten.style.whiteSpace = 'pre-wrap';
      kasten.textContent = `${fazit}\n\n${zeilen}`;
      this.textContent = '';
      this.append(kasten);

      this.dispatchEvent(new CustomEvent('spike-fertig', { detail: ergebnis, bubbles: true }));
    });
  }
}

if (!customElements.get('studio-csp-spike')) {
  customElements.define('studio-csp-spike', SpikeElement);
}
