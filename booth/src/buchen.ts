/**
 * Buchungsseite — die Seite, auf der ein Kunde die Box anfragt.
 *
 * Sie gehört zum Betreiber, nicht zur Feier: Wer sie öffnet, will einen Termin,
 * keinen Booth. Deshalb sieht sie aus wie die Website und nicht wie der
 * Bildschirm im Saal.
 *
 * Alles, was sie zeigt, kommt von der Box: Pakete, gesperrte und belegte Tage.
 * Die Schnittstellen dafür geben ausdrücklich `Access-Control-Allow-Origin: *`
 * frei — sie sind dafür gebaut, dass diese Seite auch woanders liegen kann,
 * etwa unter der eigenen Domain des Betreibers.
 *
 * Der Grundsatz aus dem Portal gilt auch hier: Geprüft wird auf der Box.
 * Diese Seite bietet einen belegten Tag gar nicht erst an, aber wenn zwei
 * Kunden im selben Moment denselben Samstag anfragen, entscheidet der Server —
 * und seine Begründung steht danach am Bildschirm.
 */

import './stil.css';
import './buchen.css';

type Paket = {
  id: string;
  name: string;
  price: string;
  hours: number;
  features: string[];
  active: boolean;
  order: number;
};

/** Der Stand der Seite. Ein Ort, damit nichts auseinanderläuft. */
const stand = {
  pakete: [] as Paket[],
  gesperrt: [] as string[],
  belegt: [] as string[],
  paket: '' as string,
  tag: '' as string,
  monat: new Date(),
  meldung: '',
  meldungsart: 'still' as 'still' | 'gut' | 'fehler',
  laeuft: false,
  fertig: false,
};

const wurzel = document.getElementById('buchen');
if (wurzel) void starte(wurzel);

async function starte(ziel: HTMLElement): Promise<void> {
  stand.monat.setDate(1);
  stand.monat.setHours(0, 0, 0, 0);

  try {
    const [pakete, frei] = await Promise.all([
      hole<Paket[]>('/api/packages'),
      hole<{ blocked: string[]; booked: string[] }>('/api/availability'),
    ]);
    // Vom eigenen Gerät liefert die Box auch abgeschaltete Pakete mit. Hier
    // zählt aber die Sicht des Kunden — sonst bucht jemand ein Paket, das der
    // Betreiber gerade nicht anbietet.
    stand.pakete = pakete.filter((p) => p.active).sort((a, b) => (a.order || 0) - (b.order || 0));
    stand.gesperrt = frei.blocked;
    stand.belegt = frei.booked;
    if (stand.pakete.length === 1) stand.paket = stand.pakete[0]!.id;
  } catch {
    stand.meldung = 'Die Anfrage lässt sich gerade nicht laden. Bitte später noch einmal versuchen.';
    stand.meldungsart = 'fehler';
  }

  zeichne(ziel);
}

async function hole<T>(pfad: string, wunsch?: RequestInit): Promise<T> {
  const antwort = await fetch(pfad, {
    ...wunsch,
    headers: { 'Content-Type': 'application/json', ...(wunsch?.headers ?? {}) },
  });
  const text = await antwort.text();
  let daten: unknown = null;
  try {
    daten = text ? JSON.parse(text) : null;
  } catch {
    daten = null;
  }
  if (!antwort.ok) {
    const grund =
      daten && typeof daten === 'object' && 'error' in daten
        ? String((daten as { error: unknown }).error)
        : 'Die Box hat die Anfrage nicht angenommen.';
    throw new Error(grund);
  }
  return daten as T;
}

/* ------------------------------------------------------------------ */
/* Zeichnen                                                            */
/* ------------------------------------------------------------------ */

function zeichne(ziel: HTMLElement): void {
  if (stand.fertig) {
    ziel.replaceChildren(kopf(), dank());
    return;
  }
  ziel.replaceChildren(
    kopf(),
    paketwahl(ziel),
    tageswahl(ziel),
    formular(ziel),
    meldungszeile()
  );
}

function kopf(): HTMLElement {
  const bereich = tag('header', 'bkopf');
  const marke = tag('span', 'bmono bmono--amber');
  marke.textContent = 'Anfrage';
  const titel = document.createElement('h1');
  titel.textContent = 'Termin anfragen';
  const zeile = tag('p', 'bfliess');
  zeile.textContent =
    'Paket wählen, Tag wählen, Kontakt hinterlassen. Die Anfrage ist unverbindlich — ' +
    'verbindlich wird sie erst, wenn wir sie bestätigen.';
  bereich.append(marke, titel, zeile);
  return bereich;
}

function paketwahl(ziel: HTMLElement): HTMLElement {
  const bereich = tag('section', 'bbereich');
  const titel = document.createElement('h2');
  titel.textContent = '1 · Paket';
  bereich.append(titel);

  if (!stand.pakete.length) {
    bereich.append(
      hinweis('Zurzeit ist kein Paket buchbar. Schreib uns trotzdem — wir melden uns.')
    );
    return bereich;
  }

  const raster = tag('div', 'bpakete');
  stand.pakete.forEach((p) => {
    const karte = tag('button', `bpaket${stand.paket === p.id ? ' an' : ''}`) as HTMLButtonElement;
    karte.type = 'button';
    karte.setAttribute('aria-pressed', String(stand.paket === p.id));

    const name = tag('b', 'bpaket__name');
    name.textContent = p.name;
    const preis = tag('span', 'bpaket__preis');
    preis.textContent = p.price || 'auf Anfrage';
    const dauer = tag('span', 'bmono');
    dauer.textContent = p.hours ? `${p.hours} Stunden` : 'Dauer nach Absprache';

    karte.append(name, preis, dauer);

    if (p.features.length) {
      const liste = document.createElement('ul');
      liste.className = 'bpaket__liste';
      p.features.forEach((f) => {
        const glied = document.createElement('li');
        glied.textContent = f;
        liste.append(glied);
      });
      karte.append(liste);
    }

    karte.addEventListener('click', () => {
      stand.paket = p.id;
      zeichne(ziel);
    });
    raster.append(karte);
  });

  bereich.append(raster);
  return bereich;
}

function tageswahl(ziel: HTMLElement): HTMLElement {
  const bereich = tag('section', 'bbereich');
  const kopfzeile = tag('div', 'bbereich__kopf');
  const titel = document.createElement('h2');
  titel.textContent = '2 · Tag';

  const blaettern = tag('div', 'breihe');
  const zurueck = tag('button', 'bknopf bknopf--klein') as HTMLButtonElement;
  zurueck.type = 'button';
  zurueck.textContent = '‹';
  zurueck.setAttribute('aria-label', 'Vorheriger Monat');
  const heute = new Date();
  heute.setDate(1);
  heute.setHours(0, 0, 0, 0);
  // Nicht in die Vergangenheit blättern: Dort gibt es nichts zu buchen.
  zurueck.disabled = stand.monat <= heute;
  zurueck.addEventListener('click', () => {
    stand.monat = new Date(stand.monat.getFullYear(), stand.monat.getMonth() - 1, 1);
    zeichne(ziel);
  });

  const name = tag('span', 'bmono');
  name.textContent = stand.monat.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  const vor = tag('button', 'bknopf bknopf--klein') as HTMLButtonElement;
  vor.type = 'button';
  vor.textContent = '›';
  vor.setAttribute('aria-label', 'Nächster Monat');
  vor.addEventListener('click', () => {
    stand.monat = new Date(stand.monat.getFullYear(), stand.monat.getMonth() + 1, 1);
    zeichne(ziel);
  });

  blaettern.append(zurueck, name, vor);
  kopfzeile.append(titel, blaettern);
  bereich.append(kopfzeile, kalender(ziel));
  return bereich;
}

function kalender(ziel: HTMLElement): HTMLElement {
  const raster = tag('div', 'bkalender');
  ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].forEach((t) => {
    const kopfTag = tag('span', 'bkalender__wochentag');
    kopfTag.textContent = t;
    raster.append(kopfTag);
  });

  const erster = stand.monat;
  const vorlauf = (erster.getDay() + 6) % 7; // Montag zuerst
  for (let i = 0; i < vorlauf; i++) raster.append(tag('span', 'bkalender__leer'));

  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const tage = new Date(erster.getFullYear(), erster.getMonth() + 1, 0).getDate();

  for (let t = 1; t <= tage; t++) {
    const datum = new Date(erster.getFullYear(), erster.getMonth(), t);
    const schluessel = alsSchluessel(datum);
    const belegt = stand.belegt.includes(schluessel) || stand.gesperrt.includes(schluessel);
    const vorbei = datum < heute;

    const knopf = tag(
      'button',
      `btag${stand.tag === schluessel ? ' an' : ''}${belegt || vorbei ? ' btag--weg' : ''}`
    ) as HTMLButtonElement;
    knopf.type = 'button';
    knopf.textContent = String(t);
    // Belegt und gesperrt sehen für den Kunden gleich aus — dass ein Tag
    // gesperrt ist, geht ihn nichts an.
    knopf.disabled = belegt || vorbei;
    knopf.title = belegt ? 'Schon vergeben' : '';
    knopf.addEventListener('click', () => {
      stand.tag = schluessel;
      zeichne(ziel);
    });
    raster.append(knopf);
  }
  return raster;
}

function formular(ziel: HTMLElement): HTMLElement {
  const bereich = tag('section', 'bbereich');
  const titel = document.createElement('h2');
  titel.textContent = '3 · Kontakt';
  bereich.append(titel);

  const form = document.createElement('form');
  form.className = 'bformular';
  form.noValidate = true;

  const felder = {
    name: feld(form, 'Name', 'text', true),
    email: feld(form, 'E-Mail', 'email', true),
    phone: feld(form, 'Telefon', 'tel', false),
    location: feld(form, 'Ort der Feier', 'text', false),
    startTime: feld(form, 'Von', 'time', false, '18:00'),
    endTime: feld(form, 'Bis', 'time', false, '23:00'),
  };

  const nachrichtzeile = tag('label', 'bzeile bzeile--weit');
  const marke = tag('span', 'bmono');
  marke.textContent = 'Was sollen wir wissen?';
  const nachricht = document.createElement('textarea');
  nachricht.className = 'beingabe';
  nachricht.rows = 4;
  nachricht.placeholder = 'Anlass, Gästezahl, Wünsche';
  nachrichtzeile.append(marke, nachricht);
  form.append(nachrichtzeile);

  const senden = tag('button', 'bknopf bknopf--amber') as HTMLButtonElement;
  senden.type = 'submit';
  senden.textContent = stand.laeuft ? 'Wird geschickt …' : 'Anfrage schicken';
  senden.disabled = stand.laeuft;
  form.append(senden);

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Vorprüfung nur, damit niemand ins Leere schickt — entscheiden tut die Box.
    if (!stand.paket) return zeigeFehler(ziel, 'Bitte ein Paket wählen.');
    if (!stand.tag) return zeigeFehler(ziel, 'Bitte einen Tag wählen.');
    if (!felder.name.value.trim()) return zeigeFehler(ziel, 'Ohne Namen wissen wir nicht, wer fragt.');
    if (!felder.email.value.trim()) return zeigeFehler(ziel, 'Ohne E-Mail können wir nicht antworten.');

    stand.laeuft = true;
    stand.meldung = '';
    zeichne(ziel);

    void hole('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        packageId: stand.paket,
        date: stand.tag,
        startTime: felder.startTime.value || '00:00',
        endTime: felder.endTime.value || '23:59',
        name: felder.name.value.trim(),
        email: felder.email.value.trim(),
        phone: felder.phone.value.trim(),
        location: felder.location.value.trim(),
        message: nachricht.value.trim(),
      }),
    })
      .then(() => {
        stand.fertig = true;
        stand.laeuft = false;
        zeichne(ziel);
      })
      .catch((fehler: unknown) => {
        stand.laeuft = false;
        zeigeFehler(ziel, fehler instanceof Error ? fehler.message : 'Das hat nicht geklappt.');
      });
  });

  bereich.append(form);
  return bereich;
}

function dank(): HTMLElement {
  const bereich = tag('section', 'bbereich bbereich--dank');
  const titel = document.createElement('h2');
  titel.textContent = 'Angekommen';
  const text = tag('p', 'bfliess');
  text.textContent =
    'Die Anfrage liegt bei uns. Wir sehen nach, ob der Tag frei bleibt, und melden uns — ' +
    'bis dahin ist nichts verbindlich.';
  bereich.append(titel, text);
  return bereich;
}

function meldungszeile(): HTMLElement {
  const zeile = tag('p', `bmeldung bmeldung--${stand.meldungsart}`);
  zeile.textContent = stand.meldung;
  zeile.hidden = !stand.meldung;
  zeile.setAttribute('role', 'status');
  return zeile;
}

function zeigeFehler(ziel: HTMLElement, text: string): void {
  stand.meldung = text;
  stand.meldungsart = 'fehler';
  zeichne(ziel);
}

/* ------------------------------------------------------------------ */
/* Helfer                                                              */
/* ------------------------------------------------------------------ */

function tag(name: string, klasse: string): HTMLElement {
  const el = document.createElement(name);
  el.className = klasse;
  return el;
}

function hinweis(text: string): HTMLElement {
  const el = tag('p', 'bhinweis');
  el.textContent = text;
  return el;
}

function feld(
  form: HTMLFormElement,
  marke: string,
  art: string,
  pflicht: boolean,
  vorgabe = ''
): HTMLInputElement {
  const zeile = tag('label', 'bzeile');
  const beschriftung = tag('span', 'bmono');
  beschriftung.textContent = pflicht ? `${marke} *` : marke;
  const eingabe = document.createElement('input');
  eingabe.className = 'beingabe';
  eingabe.type = art;
  eingabe.value = vorgabe;
  if (pflicht) eingabe.required = true;
  zeile.append(beschriftung, eingabe);
  form.append(zeile);
  return eingabe;
}

/** Ortszeit statt UTC: `toISOString()` verschiebt bei uns um bis zu zwei Stunden. */
function alsSchluessel(d: Date): string {
  const zwei = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
}
