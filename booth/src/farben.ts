/**
 * Die Gestaltungsfarben für Zeichenflächen.
 *
 * CSS-Variablen gelten für Elemente, nicht für `canvas`: Wer dort etwas
 * zeichnet, gibt eine Farbe als Zeichenkette an. Genau daran ist die
 * Gestaltung schon zweimal auseinandergelaufen — im Video eines
 * gesprochenen Grußes stand ein Amber, das mit dem Amber der Oberfläche
 * nichts mehr zu tun hatte, weil jemand `tokens.css` geändert hatte und die
 * Zeichenfläche davon nichts wusste.
 *
 * Deshalb wird hier NACHGESEHEN statt abgeschrieben: `getComputedStyle`
 * liefert genau den Wert, der auch für jedes andere Element gilt. Einmal je
 * Aufruf gelesen und gemerkt — die Werte ändern sich zur Laufzeit nicht.
 */

const gemerkt = new Map<string, string>();

/**
 * Der Wert eines Gestaltungsmerkmals, so wie ihn der Browser sieht.
 *
 * `deckung` mischt die Farbe mit Durchsichtigkeit — dasselbe, was in CSS
 * `color-mix(… , transparent)` tut, nur für die Zeichenfläche.
 */
export function farbe(name: string, deckung = 1): string {
  const roh =
    gemerkt.get(name) ??
    (() => {
      const wert = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      gemerkt.set(name, wert);
      return wert;
    })();

  if (!roh) return '#000000';
  if (deckung >= 1) return roh;

  const [r, g, b] = alsZahlen(roh);
  return `rgba(${r}, ${g}, ${b}, ${deckung})`;
}

/** `#rrggbb`, `#rgb` oder `rgb(…)` als drei Zahlen. */
function alsZahlen(wert: string): [number, number, number] {
  if (wert.startsWith('#')) {
    const kurz = wert.length === 4;
    const teil = (i: number) =>
      kurz
        ? parseInt(wert[1 + i]! + wert[1 + i]!, 16)
        : parseInt(wert.slice(1 + i * 2, 3 + i * 2), 16);
    return [teil(0), teil(1), teil(2)];
  }
  const zahlen = wert.match(/[\d.]+/g);
  if (!zahlen || zahlen.length < 3) return [0, 0, 0];
  return [Number(zahlen[0]), Number(zahlen[1]), Number(zahlen[2])];
}

/**
 * Die Schriftfamilien, ebenfalls aus der Gestaltung gelesen.
 *
 * Eine Zeichenfläche verlangt eine vollständige Kurzschreibweise
 * (`600 22px …`), deshalb kommt die Familie hier und die Größe vom Aufrufer.
 */
export function schrift(groesse: number, gewicht = 500, art: 'mono' | 'text' = 'mono'): string {
  const familie = farbe(art === 'mono' ? '--mono' : '--schrift');
  return `${gewicht} ${groesse}px ${familie}`;
}
