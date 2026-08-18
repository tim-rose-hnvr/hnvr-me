/**
 * Cockpit — die Betreiber-Ansicht auf dieser Box.
 *
 * Was hier steht, kommt aus der Box selbst: Aufnahmen, Zähler, Einstellungen.
 * Der Mehrbox-Betrieb (Puls, Fernauftrag, Moderation über mehrere Geräte)
 * braucht den Dienst dazwischen — die Stelle ist unten offen benannt, statt
 * mit erfundenen Boxen gefüllt zu werden.
 */

import './stil.css';
import './cockpit.css';
import { holeEinstellungen, ladeEinstellungen, sichereEinstellungen } from './einstellungen';
import { alle, raeumeAuf, type Aufnahme } from './speicher';
import { druckeInLetzterStunde } from './ausgabe';
import { amDraht } from './draht';
import { abmelden, verlangeAnmeldung } from './anmeldung';

const wurzel = document.getElementById('cockpit');

if (wurzel) {
  void zeichne(wurzel);

  /* Neu zeichnen, wenn die Box etwas meldet — aber nicht, während jemand in
     einem Feld tippt. Ein Formular unter den Fingern neu aufzubauen löscht
     die halbe Eingabe. */
  amDraht('cockpit', (n) => {
    if (n.type !== 'photo' && n.type !== 'remove' && n.type !== 'settings') return;
    const aktiv = document.activeElement;
    if (aktiv instanceof HTMLInputElement || aktiv instanceof HTMLTextAreaElement) return;
    void zeichne(wurzel);
  });
}

async function zeichne(ziel: HTMLElement): Promise<void> {
  /* Die Tür zuerst: Das Cockpit zeigt Kundennamen und Zähler des Betreibers. */
  if (!(await verlangeAnmeldung())) return;

  /* Dann den Stand der Box: Was das Cockpit hier bearbeitet, gehört dem
     Gerät — es muss die unvermischten Werte sehen, sonst schriebe ein Sichern
     die Eventwerte dauerhaft in die Box. */
  await holeEinstellungen(true);
  const einstellungen = ladeEinstellungen();
  let aufnahmen: Aufnahme[] = [];
  let ablageFehler = false;

  try {
    aufnahmen = await alle();
  } catch {
    ablageFehler = true;
  }

  const heute = new Date().setHours(0, 0, 0, 0);
  const heutige = aufnahmen.filter((a) => a.zeit >= heute);

  ziel.replaceChildren(
    kopf(einstellungen.box, einstellungen.event),
    kacheln([
      { wert: String(heutige.length), text: 'Sessions heute' },
      { wert: String(aufnahmen.length), text: 'Aufnahmen gesamt' },
      { wert: String(druckeInLetzterStunde()), text: 'Drucke diese Stunde' },
      { wert: `${einstellungen.loeschfristTage} Tage`, text: 'Löschfrist' },
    ]),
    aufnahmenbereich(aufnahmen, ablageFehler),
    eventbereich(einstellungen, ziel),
    offenerBereich()
  );
}

function kopf(box: string, event: string): HTMLElement {
  const leiste = tag('header', 'ckopf');

  const links = tag('div', 'ckopf__marke');
  const titel = document.createElement('h1');
  titel.textContent = 'Cockpit';
  links.append(titel, mono(`${box} · ${event}`));

  // Alle Oberflächen der Box an einer Stelle — sonst kennt sie nur, wer die
  // Adressen auswendig kann.
  const rechts = tag('div', 'ckopf__aktionen');
  const wege: { ziel: string; text: string; betont?: boolean }[] = [
    { ziel: './wand.html', text: 'Foto-Wall' },
    { ziel: './galerie.html', text: 'Galerie' },
    { ziel: './editor.html', text: 'Editor' },
    { ziel: './portal.html', text: 'Portal' },
    { ziel: './einrichtung.html', text: 'Einrichtung' },
    { ziel: './index.html', text: 'Booth öffnen', betont: true },
  ];
  wege.forEach((w) => {
    const glied = tag('a', `cknopf${w.betont ? ' cknopf--amber' : ''}`) as HTMLAnchorElement;
    glied.href = w.ziel;
    glied.textContent = w.text;
    rechts.append(glied);
  });

  const raus = tag('button', 'cknopf');
  raus.textContent = 'Abmelden';
  raus.addEventListener('click', () => void abmelden());
  rechts.append(raus);

  leiste.append(links, rechts);
  return leiste;
}

function kacheln(werte: { wert: string; text: string }[]): HTMLElement {
  const raster = tag('section', 'ckacheln');
  werte.forEach((w) => {
    const kachel = tag('article', 'ckachel');
    const zahl = tag('b', 'ckachel__zahl');
    zahl.textContent = w.wert;
    kachel.append(zahl, mono(w.text));
    raster.append(kachel);
  });
  return raster;
}

function aufnahmenbereich(aufnahmen: Aufnahme[], fehler: boolean): HTMLElement {
  const bereich = tag('section', 'cbereich');
  const kopfzeile = tag('div', 'cbereich__kopf');
  const titel = document.createElement('h2');
  titel.textContent = 'Letzte Aufnahmen';
  kopfzeile.append(titel, mono(`${aufnahmen.length} in der Ablage`));
  bereich.append(kopfzeile);

  if (fehler) {
    bereich.append(hinweis('Die Ablage ist nicht erreichbar. Aufnahmen liegen dann nur im Ergebnis-Screen.'));
    return bereich;
  }

  if (aufnahmen.length === 0) {
    bereich.append(hinweis('Noch keine Aufnahme. Der Booth legt jede Aufnahme hier ab, bevor er sie zeigt.'));
    return bereich;
  }

  const raster = tag('div', 'cbilder');
  aufnahmen.slice(0, 12).forEach((a) => {
    const kachel = tag('figure', 'cbild');
    const bild = document.createElement('img');
    bild.src = a.url;
    bild.alt = '';
    bild.loading = 'lazy';

    const zeile = document.createElement('figcaption');
    zeile.append(
      mono(new Date(a.zeit).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })),
      mono(a.art)
    );

    const laden = tag('a', 'cknopf cknopf--klein') as HTMLAnchorElement;
    laden.href = bild.src;
    laden.download = a.id;
    laden.textContent = 'Sichern';

    kachel.append(bild, zeile, laden);
    raster.append(kachel);
  });

  bereich.append(raster);
  return bereich;
}

function eventbereich(
  einstellungen: ReturnType<typeof ladeEinstellungen>,
  ziel: HTMLElement
): HTMLElement {
  const bereich = tag('section', 'cbereich');
  const titel = document.createElement('h2');
  titel.textContent = 'Event';
  bereich.append(titel);

  const formular = tag('div', 'cformular');

  const feld = (marke: string, wert: string, setze: (v: string) => void) => {
    const zeile = tag('label', 'czeile');
    const eingabe = document.createElement('input');
    eingabe.className = 'ceingabe';
    eingabe.value = wert;
    eingabe.addEventListener('input', () => setze(eingabe.value));
    zeile.append(mono(marke), eingabe);
    formular.append(zeile);
  };

  feld('Eventname', einstellungen.event, (v) => (einstellungen.event = v));
  feld('Attract-Titel', einstellungen.attractTitel, (v) => (einstellungen.attractTitel = v));
  feld('Box', einstellungen.box, (v) => (einstellungen.box = v));
  feld('Ausgabe-Adresse', einstellungen.ausgabeBasis, (v) => (einstellungen.ausgabeBasis = v));

  const sichern = tag('button', 'cknopf cknopf--amber');
  sichern.textContent = 'Sichern';
  sichern.addEventListener('click', async () => {
    sichern.textContent = 'Sichere …';
    const gut = await sichereEinstellungen(einstellungen);
    sichern.textContent = gut ? 'Sichern' : 'Die Box hat nicht angenommen';
    if (gut) await zeichne(ziel);
  });

  const aufraeumen = tag('button', 'cknopf');
  aufraeumen.textContent = 'Löschfrist jetzt anwenden';
  aufraeumen.addEventListener('click', async () => {
    const weg = await raeumeAuf(einstellungen.loeschfristTage);
    aufraeumen.textContent = `${weg} Aufnahmen gelöscht`;
    window.setTimeout(() => void zeichne(ziel), 1200);
  });

  const knoepfe = tag('div', 'creihe');
  knoepfe.append(sichern, aufraeumen);

  bereich.append(formular, knoepfe);
  return bereich;
}

function offenerBereich(): HTMLElement {
  const bereich = tag('section', 'cbereich cbereich--offen');
  const titel = document.createElement('h2');
  titel.textContent = 'Was noch nicht hier steht';
  bereich.append(
    titel,
    hinweis(
      'Puls und Fernauftrag mehrerer Boxen, Moderation über Geräte hinweg und die Cloud-Galerie ' +
        'brauchen den Dienst zwischen den Boxen. Diese Ansicht zeigt bewusst nur, was diese Box ' +
        'selbst weiß — lieber wenig Echtes als viel Erfundenes.'
    )
  );
  return bereich;
}

// --- Helfer -------------------------------------------------------------

function tag(name: string, klasse: string): HTMLElement {
  const el = document.createElement(name);
  el.className = klasse;
  return el;
}

function mono(text: string): HTMLElement {
  const el = tag('span', 'cmono');
  el.textContent = text;
  return el;
}

function hinweis(text: string): HTMLElement {
  const el = tag('p', 'chinweis');
  el.textContent = text;
  return el;
}
