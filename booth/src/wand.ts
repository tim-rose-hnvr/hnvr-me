/**
 * Foto-Wall für Beamer und TV.
 *
 * Betriebsart „nur Booth": An der Wand erscheint ausschließlich, was durch
 * die Box gelaufen ist. Deshalb gibt es hier keinen Upload-Aufruf und nichts
 * zu moderieren — und keine Bedienelemente, die Gäste antippen könnten.
 *
 * Die Wand fragt die Ablage in Abständen ab; neue Aufnahmen erscheinen von
 * selbst und werden einmal groß gezeigt, damit Gäste sich wiederfinden.
 */

import './stil.css';
import './wand.css';
import { alle, type Aufnahme } from './speicher';
import { ladeEinstellungen } from './einstellungen';

const TAKT = 4000;
const GROSS_MS = 4200;

const wurzel = document.getElementById('wand');

if (wurzel) {
  void starte(wurzel);
}

async function starte(ziel: HTMLElement): Promise<void> {
  const einstellungen = ladeEinstellungen();
  const gezeigt = new Map<string, string>();
  let letzteId = '';

  const kopf = bauKopf(einstellungen.event, einstellungen.attractTitel);
  const raster = tag('div', 'wraster');
  const buehne = tag('div', 'wbuehne');
  const leer = tag('p', 'wleer');
  leer.textContent = 'Noch keine Aufnahme. Die Wand füllt sich, sobald die Box läuft.';

  ziel.replaceChildren(kopf.leiste, raster, leer, buehne);

  const aktualisiere = async () => {
    let aufnahmen: Aufnahme[] = [];
    try {
      aufnahmen = await alle();
    } catch {
      return;
    }

    kopf.zaehler.textContent = `${aufnahmen.length} Aufnahmen`;
    leer.hidden = aufnahmen.length > 0;

    // Neue Aufnahmen nach vorn, alte bleiben stehen — kein Neuaufbau.
    aufnahmen
      .slice()
      .reverse()
      .forEach((a) => {
        if (gezeigt.has(a.id)) return;
        const adresse = URL.createObjectURL(a.blob);
        gezeigt.set(a.id, adresse);

        const kachel = tag('figure', 'wkachel');
        const bild = document.createElement('img');
        bild.src = adresse;
        bild.alt = '';
        kachel.append(bild);
        raster.prepend(kachel);
      });

    // Die neueste einmal groß zeigen.
    const neueste = aufnahmen[0];
    if (neueste && neueste.id !== letzteId) {
      letzteId = neueste.id;
      zeigeGross(buehne, gezeigt.get(neueste.id) ?? URL.createObjectURL(neueste.blob));
    }
  };

  await aktualisiere();
  window.setInterval(() => void aktualisiere(), TAKT);
}

function bauKopf(event: string, titel: string): { leiste: HTMLElement; zaehler: HTMLElement } {
  const leiste = tag('header', 'wkopf');

  const links = tag('div', 'wkopf__text');
  const name = document.createElement('h1');
  name.textContent = event;
  const zeile = tag('span', 'wmono');
  zeile.textContent = titel;
  links.append(name, zeile);

  const rechts = tag('div', 'wkopf__zustand');
  const marke = tag('span', 'wmono wmono--amber');
  marke.textContent = 'Nur Booth-Aufnahmen';
  const zaehler = tag('span', 'wmono');
  zaehler.textContent = '0 Aufnahmen';
  rechts.append(marke, zaehler);

  leiste.append(links, rechts);
  return { leiste, zaehler };
}

/** Zeigt die neueste Aufnahme kurz groß über der Wand. */
function zeigeGross(buehne: HTMLElement, adresse: string): void {
  const bild = document.createElement('img');
  bild.src = adresse;
  bild.alt = '';
  bild.className = 'wgross';

  buehne.replaceChildren(bild);
  buehne.classList.add('an');

  window.setTimeout(() => {
    buehne.classList.remove('an');
    window.setTimeout(() => buehne.replaceChildren(), 600);
  }, GROSS_MS);
}

function tag(name: string, klasse: string): HTMLElement {
  const el = document.createElement(name);
  el.className = klasse;
  return el;
}
