/**
 * Anmeldung — und beim ersten Mal die Einrichtung.
 *
 * Eine frische Box gehört niemandem. Wer sie zuerst am Gerät selbst öffnet,
 * richtet sie ein: Name, E-Mail, Kennwort, dazu die Firmendaten und das Logo,
 * die danach auf Abzügen, Angeboten und Event-Seiten stehen. Ab da kommt
 * niemand mehr ohne Anmeldung an Cockpit und Portal.
 *
 * Dass die Ersteinrichtung nur am Gerät selbst geht, entscheidet die Box —
 * sonst machte sich im Gäste-WLAN der Erste zum Betreiber der Box.
 */

import './stil.css';
import './anmelden.css';
import { betreiberstand } from './anmeldung';

const wurzel = document.getElementById('anmelden');
if (wurzel) void starte(wurzel);

function weiterZu(): string {
  const wunsch = new URLSearchParams(location.search).get('weiter') || './cockpit.html';
  // Nur eigene Wege: Ein `weiter=https://…` wäre eine offene Weiterleitung.
  return wunsch.startsWith('/') || wunsch.startsWith('./') ? wunsch : './cockpit.html';
}

async function starte(ziel: HTMLElement): Promise<void> {
  const stand = await betreiberstand();

  if (!stand) {
    ziel.replaceChildren(
      karte('Die Box antwortet nicht', [
        absatz('Läuft der Dienst der Box? Ohne ihn gibt es weder Anmeldung noch Aufnahmen.'),
      ])
    );
    return;
  }

  if (stand.angemeldet) {
    location.replace(weiterZu());
    return;
  }

  ziel.replaceChildren(stand.angelegt ? anmeldeschirm() : einrichtungsschirm());
}

/* ------------------------------------------------------------------ */
/* Anmelden                                                            */
/* ------------------------------------------------------------------ */

function anmeldeschirm(): HTMLElement {
  const meldung = tag('p', 'ameldung');
  meldung.setAttribute('role', 'status');

  const email = feld('E-Mail', 'email');
  const kennwort = feld('Kennwort', 'password');

  const knopf = tag('button', 'aknopf aknopf--amber') as HTMLButtonElement;
  knopf.type = 'submit';
  knopf.textContent = 'Anmelden';

  const form = document.createElement('form');
  form.className = 'aformular';
  form.noValidate = true;
  form.append(email.zeile, kennwort.zeile, knopf);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    knopf.disabled = true;
    meldung.className = 'ameldung';
    meldung.textContent = 'Prüfe …';

    const antwort = await schicke('/api/anmelden', {
      email: email.eingabe.value.trim(),
      kennwort: kennwort.eingabe.value,
    });
    knopf.disabled = false;

    if (antwort.ok) {
      location.replace(weiterZu());
      return;
    }
    meldung.className = 'ameldung ameldung--fehler';
    meldung.textContent = antwort.fehler;
    kennwort.eingabe.value = '';
    kennwort.eingabe.focus();
  });

  queueMicrotask(() => email.eingabe.focus());

  return karte('Anmelden', [
    absatz('Cockpit und Portal gehören dem Betreiber — deshalb steht hier eine Tür.'),
    form,
    meldung,
  ]);
}

/* ------------------------------------------------------------------ */
/* Einrichten                                                          */
/* ------------------------------------------------------------------ */

function einrichtungsschirm(): HTMLElement {
  const meldung = tag('p', 'ameldung');
  meldung.setAttribute('role', 'status');

  const name = feld('Euer Name', 'text');
  const email = feld('E-Mail', 'email');
  const kennwort = feld('Kennwort', 'password', 'mindestens zehn Zeichen');
  const wieder = feld('Kennwort wiederholen', 'password');

  const firma = feld('Firma', 'text');
  const strasse = feld('Straße und Hausnummer', 'text');
  const plz = feld('PLZ', 'text');
  const ort = feld('Ort', 'text');
  const telefon = feld('Telefon', 'tel');
  const web = feld('Website', 'url', 'https://…');
  const steuer = feld('Steuer- oder USt-IdNr.', 'text');

  const { bereich: logobereich, holeLogo } = logofeld();

  const knopf = tag('button', 'aknopf aknopf--amber') as HTMLButtonElement;
  knopf.type = 'submit';
  knopf.textContent = 'Box einrichten';

  const form = document.createElement('form');
  form.className = 'aformular';
  form.noValidate = true;
  form.append(
    unterschrift('Zugang'),
    name.zeile,
    email.zeile,
    kennwort.zeile,
    wieder.zeile,
    unterschrift('Firma'),
    firma.zeile,
    strasse.zeile,
    plz.zeile,
    ort.zeile,
    telefon.zeile,
    web.zeile,
    steuer.zeile,
    unterschrift('Marke'),
    logobereich,
    knopf
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (kennwort.eingabe.value !== wieder.eingabe.value) {
      meldung.className = 'ameldung ameldung--fehler';
      meldung.textContent = 'Die beiden Kennwörter sind nicht gleich.';
      return;
    }

    knopf.disabled = true;
    meldung.className = 'ameldung';
    meldung.textContent = 'Richte ein …';

    /* Zuerst der Zugang: Erst wenn die Box einen Betreiber hat, nimmt sie die
       Firmendaten überhaupt an — vorher wären sie ungeschützt. */
    const zugang = await schicke('/api/betreiber/einrichten', {
      name: name.eingabe.value.trim(),
      email: email.eingabe.value.trim(),
      kennwort: kennwort.eingabe.value,
    });

    if (!zugang.ok) {
      knopf.disabled = false;
      meldung.className = 'ameldung ameldung--fehler';
      meldung.textContent = zugang.fehler;
      return;
    }

    const firmendaten = await schicke(
      '/api/betreiber',
      {
        firma: firma.eingabe.value.trim(),
        strasse: strasse.eingabe.value.trim(),
        plz: plz.eingabe.value.trim(),
        ort: ort.eingabe.value.trim(),
        telefon: telefon.eingabe.value.trim(),
        web: web.eingabe.value.trim(),
        steuernummer: steuer.eingabe.value.trim(),
        logo: holeLogo(),
      },
      'PUT'
    );

    if (!firmendaten.ok) {
      // Der Zugang steht schon — das ist der Teil, der zählt. Den Rest kann
      // der Betreiber im Cockpit nachtragen, statt hier festzuhängen.
      meldung.className = 'ameldung ameldung--fehler';
      meldung.textContent = `Zugang steht, Firmendaten nicht: ${firmendaten.fehler}`;
      window.setTimeout(() => location.replace('./cockpit.html'), 2500);
      return;
    }

    location.replace(weiterZu());
  });

  queueMicrotask(() => name.eingabe.focus());

  return karte('Diese Box gehört noch niemandem', [
    absatz(
      'Richtet sie jetzt ein. Danach kommt niemand mehr ohne Anmeldung an Cockpit und Portal — ' +
        'und was ihr hier eintragt, steht später auf Abzügen, Angeboten und Event-Seiten.'
    ),
    form,
    meldung,
  ]);
}

function logofeld(): { bereich: HTMLElement; holeLogo: () => string | null } {
  let logo: string | null = null;

  const bereich = tag('div', 'alogo');
  const vorschau = tag('div', 'alogo__buehne');
  const platzhalter = tag('span', 'amono');
  platzhalter.textContent = 'Noch kein Logo';
  vorschau.append(platzhalter);

  const waehlen = tag('label', 'aknopf aknopf--klein');
  waehlen.textContent = 'Logo wählen';
  const datei = document.createElement('input');
  datei.type = 'file';
  datei.accept = 'image/png,image/jpeg,image/svg+xml,image/webp';
  datei.className = 'anur-vorlese';

  datei.addEventListener('change', () => {
    const gewaehlt = datei.files?.[0];
    // Dieselbe Datei zweimal wählen löst sonst kein zweites `change` aus.
    datei.value = '';
    if (!gewaehlt) return;

    /* Zwei Megabyte sind großzügig für ein Logo und die Grenze der Box. Wer
       ein Foto hochlädt, soll es hier erfahren und nicht beim Speichern. */
    if (gewaehlt.size > 2_000_000) {
      platzhalter.textContent = 'Zu groß — ein Logo sollte unter 2 MB bleiben.';
      return;
    }

    const leser = new FileReader();
    leser.addEventListener('load', () => {
      logo = String(leser.result);
      const bild = document.createElement('img');
      bild.src = logo;
      bild.alt = '';
      vorschau.replaceChildren(bild);
    });
    leser.readAsDataURL(gewaehlt);
  });

  waehlen.append(datei);
  bereich.append(
    vorschau,
    waehlen,
    hinweis('Steht auf Abzügen, Event-Seiten und der Buchungsseite. PNG mit Transparenz ist am besten.')
  );

  return { bereich, holeLogo: () => logo };
}

/* ------------------------------------------------------------------ */
/* Helfer                                                              */
/* ------------------------------------------------------------------ */

async function schicke(
  pfad: string,
  daten: Record<string, unknown>,
  art: 'POST' | 'PUT' = 'POST'
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  try {
    const antwort = await fetch(pfad, {
      method: art,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(daten),
    });
    if (antwort.ok) return { ok: true };
    const text = await antwort.text();
    try {
      const gelesen = JSON.parse(text) as { error?: string };
      return { ok: false, fehler: gelesen.error || `Fehler ${antwort.status}` };
    } catch {
      return { ok: false, fehler: `Fehler ${antwort.status}` };
    }
  } catch {
    return { ok: false, fehler: 'Die Box antwortet nicht.' };
  }
}

function tag(name: string, klasse: string): HTMLElement {
  const el = document.createElement(name);
  el.className = klasse;
  return el;
}

function karte(titel: string, teile: HTMLElement[]): HTMLElement {
  const bereich = tag('section', 'akarte');
  const marke = tag('span', 'amono amono--amber');
  marke.textContent = 'youbooth';
  const h = document.createElement('h1');
  h.textContent = titel;
  bereich.append(marke, h, ...teile);
  return bereich;
}

function absatz(text: string): HTMLElement {
  const el = tag('p', 'afliess');
  el.textContent = text;
  return el;
}

function hinweis(text: string): HTMLElement {
  const el = tag('span', 'ahinweis');
  el.textContent = text;
  return el;
}

function unterschrift(text: string): HTMLElement {
  const el = tag('span', 'amono aunterschrift');
  el.textContent = text;
  return el;
}

function feld(
  marke: string,
  art: string,
  platzhalter = ''
): { zeile: HTMLElement; eingabe: HTMLInputElement } {
  const zeile = tag('label', 'azeile');
  const beschriftung = tag('span', 'amono');
  beschriftung.textContent = marke;
  const eingabe = document.createElement('input');
  eingabe.className = 'aeingabe';
  eingabe.type = art;
  eingabe.placeholder = platzhalter;
  if (art === 'password') eingabe.autocomplete = 'current-password';
  zeile.append(beschriftung, eingabe);
  return { zeile, eingabe };
}
