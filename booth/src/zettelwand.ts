/**
 * Die Zettelwand — was der Saal vom Gästebuch sieht.
 *
 * Für Beamer und Fernseher: Vollbild, keine Bedienelemente, nichts zum
 * Antippen. Wer daran vorbeigeht, soll lesen können, nicht bedienen.
 *
 * Neue Zettel kommen über den Draht und werden einmal groß gezeigt, bevor
 * sie sich einreihen. Das ist derselbe Gedanke wie bei der Foto-Wall: Ein
 * Gast, der gerade geschrieben hat, dreht sich um und will sehen, dass es
 * angekommen ist.
 */

import './stil.css';
import './gaestebuch.css';
import './zettelwand.css';
import { amDraht, istNeuladen } from './draht';
import { zettel } from './gaestebuch';

type Eintrag = {
  id: string;
  name: string;
  message: string;
  farbe?: number;
  color?: string;
  time: string;
};

/* Der Draht meldet jeden Zettel sofort. Der Takt ist nur der Rückfall für
   den Fall, dass die Verbindung gerade weg ist — eine Wand, die im
   Sekundentakt fragt, bremst die Box beim Drucken aus. */
const TAKT = 20000;
const GROSS_MS = 5200;

const wurzel = document.getElementById('zettelwand');
if (wurzel) void starte(wurzel);

async function starte(ziel: HTMLElement): Promise<void> {
  const flaeche = tag('div', 'zwflaeche');
  const raster = tag('div', 'zwraster');
  const leer = tag('div', 'zwleer');
  leer.textContent = 'Noch kein Eintrag. Der erste Zettel hängt gleich hier.';
  const buehne = tag('div', 'zwbuehne');
  buehne.hidden = true;

  flaeche.append(raster, leer, buehne);
  ziel.replaceChildren(flaeche);

  let bekannt = new Set<string>();
  let erstesMal = true;

  const zeichne = (eintraege: Eintrag[]): void => {
    leer.hidden = eintraege.length > 0;
    raster.replaceChildren(...eintraege.slice(0, 30).map(zettel));
    /* Wie viele Spalten sinnvoll sind, hängt an der Zahl der Zettel: Drei
       Zettel auf sechs Spalten sehen verloren aus, dreißig auf drei Spalten
       werden unlesbar klein. */
    /* Spaltenzahl nach Menge: Drei Zettel auf sechs Spalten sehen verloren
       aus, dreißig auf zwei werden unlesbar lang. Gemessen an einer
       16:9-Wand aus vier Metern Abstand. */
    const spalten =
      eintraege.length <= 2 ? 2 : eintraege.length <= 6 ? 3 : eintraege.length <= 12 ? 4 : 5;
    raster.style.setProperty('--spalten', String(spalten));
  };

  const zeigeGross = (e: Eintrag): void => {
    buehne.replaceChildren(zettel(e));
    buehne.hidden = false;
    window.setTimeout(() => {
      buehne.hidden = true;
    }, GROSS_MS);
  };

  const hole = async (): Promise<void> => {
    const eintraege = await lade();
    const neue = eintraege.filter((e) => !bekannt.has(e.id));
    bekannt = new Set(eintraege.map((e) => e.id));
    zeichne(eintraege);
    /* Beim ersten Laden ist alles „neu" — dann aber nichts groß zeigen,
       sonst blitzt beim Einschalten der Wand ein alter Zettel auf. */
    if (!erstesMal && neue[0]) zeigeGross(neue[0]);
    erstesMal = false;
  };

  await hole();
  window.setInterval(() => void hole(), TAKT);

  amDraht('wand', (nachricht) => {
    if (istNeuladen(nachricht, 'wand')) {
      location.reload();
      return;
    }
    if (nachricht.type === 'guestbook') void hole();
  });
}

async function lade(): Promise<Eintrag[]> {
  try {
    const antwort = await fetch('/api/guestbook');
    if (!antwort.ok) return [];
    const daten = (await antwort.json()) as Eintrag[];
    return Array.isArray(daten) ? daten : [];
  } catch {
    return [];
  }
}

function tag(name: string, klasse: string): HTMLElement {
  const el = document.createElement(name);
  el.className = klasse;
  return el;
}
