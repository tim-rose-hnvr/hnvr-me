/**
 * Das Gästebuch — die Seite, auf der ein Gast schreibt.
 *
 * Die Box nimmt Einträge seit Langem entgegen (`POST /api/guestbook`), es
 * gab nur nichts, worin man schreiben konnte. Genau das ist der Unterschied
 * zwischen „die Box kann es" und „der Gast kann es".
 *
 * Sie läuft auf zwei Geräten und sieht auf beiden gleich aus: am Touch der
 * Box und auf dem Handy, das den QR-Code abfotografiert hat. Deshalb große
 * Felder, wenige Wörter und kein Konto — wer auf einer Feier ein Kennwort
 * vergeben soll, schreibt nichts.
 *
 * Bewusst ohne Bild: Der Server nimmt bei einem Eintrag Text und Namen. Ein
 * Feld für ein Foto anzubieten, das nirgends ankommt, wäre schlimmer als
 * keines.
 */

import './stil.css';
import './gaestebuch.css';
import { amDraht } from './draht';

type Eintrag = {
  id: string;
  name: string;
  message: string;
  /** Nummer 0–4; welche Farbe das ist, steht im Gestaltungssystem. */
  farbe?: number;
  /** Ältere Einträge führen noch einen Hexwert. */
  color?: string;
  time: string;
};

const wurzel = document.getElementById('gaestebuch');
if (wurzel) void starte(wurzel);

async function starte(ziel: HTMLElement): Promise<void> {
  const kasten = tag('div', 'gbwurzel');

  const kopf = tag('header', 'gbkopf');
  const titel = document.createElement('h1');
  titel.textContent = 'Schreibt uns etwas';
  const unter = tag('p', 'gbunter');
  unter.textContent =
    'Ein paar Zeilen genügen. Sie erscheinen gleich auf der Wand — und bleiben danach.';
  kopf.append(titel, unter);

  /* --- Das Formular --- */
  const form = document.createElement('form');
  form.className = 'gbform';
  form.noValidate = true;

  const name = feld('Dein Name', 'text', 'Wie heißt du?');
  name.eingabe.maxLength = 60;
  name.eingabe.autocomplete = 'name';

  const text = document.createElement('textarea');
  text.className = 'gbtext';
  text.rows = 5;
  text.maxLength = 500;
  text.placeholder = 'Was möchtest du sagen?';
  text.setAttribute('aria-label', 'Deine Nachricht');

  const zaehler = tag('span', 'gbzaehler');
  const setzeZaehler = (): void => {
    zaehler.textContent = `${text.value.length} / 500`;
  };
  text.addEventListener('input', setzeZaehler);
  setzeZaehler();

  const meldung = tag('p', 'gbmeldung');
  meldung.setAttribute('role', 'status');
  meldung.hidden = true;

  const senden = document.createElement('button');
  senden.type = 'submit';
  senden.className = 'knopf knopf--amber knopf--gross gbsenden';
  senden.textContent = 'Eintragen';

  form.append(name.zeile, text, zaehler, senden, meldung);

  /* --- Was schon dasteht --- */
  const bisher = tag('section', 'gbbisher');
  const bisherTitel = tag('h2', 'gbbishertitel');
  bisherTitel.textContent = 'Schon eingetragen';
  const liste = tag('div', 'gbliste');
  bisher.append(bisherTitel, liste);

  kasten.append(kopf, form, bisher);
  ziel.replaceChildren(kasten);

  const zeige = (eintraege: Eintrag[]): void => {
    bisher.hidden = eintraege.length === 0;
    liste.replaceChildren(...eintraege.slice(0, 12).map(zettel));
  };

  zeige(await hole());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inhalt = text.value.trim();
    if (!inhalt) {
      sage(meldung, 'Schreib bitte noch etwas — ein leerer Zettel hilft niemandem.', 'fehler');
      text.focus();
      return;
    }

    senden.disabled = true;
    senden.textContent = 'Wird eingetragen …';

    const ok = await schicke(name.eingabe.value.trim(), inhalt);

    senden.disabled = false;
    senden.textContent = 'Eintragen';

    if (!ok) {
      /* Nichts leeren: Wer gerade fünf Zeilen geschrieben hat, soll sie nicht
         verlieren, weil das WLAN kurz weg war. */
      sage(meldung, 'Das kam nicht an. Noch einmal versuchen?', 'fehler');
      return;
    }

    text.value = '';
    setzeZaehler();
    sage(meldung, 'Danke. Dein Zettel hängt.', 'gut');
    zeige(await hole());
  });

  /* Neue Einträge anderer Gäste erscheinen, ohne dass jemand neu lädt. */
  amDraht('gaestebuch', (nachricht) => {
    if (nachricht.type === 'guestbook') void hole().then(zeige);
  });
}

async function hole(): Promise<Eintrag[]> {
  try {
    const antwort = await fetch('/api/guestbook');
    if (!antwort.ok) return [];
    const daten = (await antwort.json()) as Eintrag[];
    return Array.isArray(daten) ? daten : [];
  } catch {
    return [];
  }
}

async function schicke(name: string, message: string): Promise<boolean> {
  try {
    const antwort = await fetch('/api/guestbook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, message }),
    });
    return antwort.ok;
  } catch {
    return false;
  }
}

export function zettel(e: Eintrag): HTMLElement {
  const z = tag('article', 'gbzettel');
  /* Der Server vergibt eine Nummer, nicht eine Farbe — dieselbe Nachricht
     sieht dadurch auf Handy und Wand gleich aus, und welche Farbe das ist,
     entscheidet das Gestaltungssystem. Einträge von früher führen noch einen
     Hexwert; der gilt weiter, damit eine gewachsene Wand nicht umfärbt. */
  const nummer = typeof e.farbe === 'number' ? e.farbe % 5 : null;
  z.style.setProperty('--zettelfarbe', nummer !== null ? `var(--zettel-${nummer})` : e.color || 'var(--zettel-0)');
  /* Ein leichter Dreh je Zettel — aus der Kennung, nicht aus Zufall: Sonst
     springt die Wand bei jedem Neuzeichnen. */
  const dreh = ((e.id.charCodeAt(2) || 0) % 7) - 3;
  z.style.setProperty('--dreh', `${dreh}deg`);

  const spruch = tag('p', 'gbspruch');
  spruch.textContent = e.message;

  const von = tag('span', 'gbvon');
  von.textContent = e.name;

  z.append(spruch, von);
  return z;
}

function feld(marke: string, art: string, platzhalter: string) {
  const zeile = document.createElement('label');
  zeile.className = 'gbzeile';
  const beschriftung = tag('span', 'gbmarke');
  beschriftung.textContent = marke;
  const eingabe = document.createElement('input');
  eingabe.type = art;
  eingabe.className = 'gbeingabe';
  eingabe.placeholder = platzhalter;
  zeile.append(beschriftung, eingabe);
  return { zeile, eingabe };
}

function sage(kasten: HTMLElement, text: string, art: 'gut' | 'fehler'): void {
  kasten.textContent = text;
  kasten.className = `gbmeldung gbmeldung--${art}`;
  kasten.hidden = false;
}

function tag(name: string, klasse: string): HTMLElement {
  const el = document.createElement(name);
  el.className = klasse;
  return el;
}
