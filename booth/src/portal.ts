/**
 * Betreiber-Portal — die Geschäftsseite der Box.
 *
 * Der übernommene Server bringt Buchungen, Pakete, Sperrtage und Tickets seit
 * Langem mit; eine Oberfläche dazu gab es nie. Genau das ist der Unterschied
 * zwischen „die Box kann es" und „der Betreiber kann es": Ohne diese Seite
 * musste man die Schnittstelle von Hand ansprechen, um eine Anfrage zu
 * bestätigen.
 *
 * Die Seite gehört dem Betreiber, nicht dem Gast — sie läuft auf der Box und
 * ist von außen nur mit Lizenzschlüssel erreichbar; im Saal selbst genügt der
 * Zugriff vom Gerät. Das entscheidet der Server (`requireKey`), nicht diese
 * Datei: Rechte werden nie in der Oberfläche geprüft.
 */

import './stil.css';
import './cockpit.css';
import './portal.css';
import { amDraht } from './draht';
import { abmelden, verlangeAnmeldung } from './anmeldung';

/* ------------------------------------------------------------------ */
/* Modelle — genau die Felder, die der Server schickt                  */
/* ------------------------------------------------------------------ */

type Buchungsstand = 'angefragt' | 'bestätigt' | 'abgelehnt' | 'abgeschlossen';

type Buchung = {
  id: string;
  packageId: string;
  packageName: string;
  price: string;
  date: string;
  startTime: string;
  endTime: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  message: string;
  status: Buchungsstand;
  galleryLink: string;
  createdAt: string;
};

type Paket = {
  id: string;
  name: string;
  price: string;
  hours: number;
  features: string[];
  active: boolean;
  order: number;
};

type Ticketstand = 'offen' | 'beantwortet' | 'geschlossen';

type Ticket = {
  id: string;
  subject: string;
  name: string;
  contact: string;
  status: Ticketstand;
  priority: 'niedrig' | 'normal' | 'hoch';
  created: string;
  updated: string;
  messages: { from: string; text: string; time: string }[];
};

type Eventseite = {
  slug: string;
  title: string;
  headline: string;
  subtitle: string;
  accent: string;
  logo: string | null;
  boxUrl: string;
  gallery: boolean;
  theme: 'glow' | 'photo' | 'minimal';
  expires: string;
  password: string;
  enabled: boolean;
  created: string;
};

const ANMUTUNGEN: { id: Eventseite['theme']; name: string }[] = [
  { id: 'glow', name: 'Leuchten' },
  { id: 'photo', name: 'Groß' },
  { id: 'minimal', name: 'Ruhig' },
];

const BUCHUNGSSTAENDE: Buchungsstand[] = ['angefragt', 'bestätigt', 'abgelehnt', 'abgeschlossen'];
const TICKETSTAENDE: Ticketstand[] = ['offen', 'beantwortet', 'geschlossen'];

/* ------------------------------------------------------------------ */
/* Verkehr mit der Box                                                 */
/* ------------------------------------------------------------------ */

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
        : `${antwort.status}`;
    throw new Error(grund);
  }
  return daten as T;
}

/* ------------------------------------------------------------------ */
/* Zustand                                                             */
/* ------------------------------------------------------------------ */

type Reiter = 'buchungen' | 'kalender' | 'pakete' | 'seiten' | 'tickets';

let reiter: Reiter = 'buchungen';
let buchungen: Buchung[] = [];
let pakete: Paket[] = [];
let tickets: Ticket[] = [];
let seiten: Eventseite[] = [];
let gesperrt: string[] = [];
let belegt: string[] = [];
let meldung = '';
let meldungsart: 'still' | 'gut' | 'fehler' = 'still';

const wurzel = document.getElementById('portal');
if (wurzel) void starte(wurzel);

async function starte(ziel: HTMLElement): Promise<void> {
  /* Die Tür zuerst: Hier stehen Namen, Anschriften und Telefonnummern von
     Kunden. Im Gäste-WLAN einer Feier wäre das ein Aushang. */
  if (!(await verlangeAnmeldung())) return;

  await lade();
  zeichne(ziel);

  // Eine neue Anfrage kommt vom Buchungsformular herein, nicht von hier —
  // ohne Draht sähe der Betreiber sie erst beim nächsten Neuladen.
  amDraht('cockpit', (n) => {
    if (n.type === 'buchung' || n.type === 'ticket') void lade().then(() => zeichne(ziel));
  });
}

async function lade(): Promise<void> {
  const [b, p, t, v, e] = await Promise.all([
    hole<Buchung[]>('/api/bookings').catch(() => [] as Buchung[]),
    hole<Paket[]>('/api/packages').catch(() => [] as Paket[]),
    hole<Ticket[]>('/api/tickets').catch(() => [] as Ticket[]),
    hole<{ blocked: string[]; booked: string[] }>('/api/availability').catch(() => ({
      blocked: [] as string[],
      booked: [] as string[],
    })),
    hole<Eventseite[]>('/api/microsites').catch(() => [] as Eventseite[]),
  ]);
  buchungen = b;
  pakete = p;
  tickets = t;
  gesperrt = v.blocked;
  belegt = v.booked;
  seiten = e;
}

function sage(text: string, art: 'still' | 'gut' | 'fehler' = 'still'): void {
  meldung = text;
  meldungsart = art;
}

async function tueUndZeichne(ziel: HTMLElement, tat: () => Promise<void>, gutText: string): Promise<void> {
  try {
    await tat();
    await lade();
    sage(gutText, 'gut');
  } catch (fehler) {
    sage(fehler instanceof Error ? fehler.message : 'Die Box hat abgelehnt.', 'fehler');
  }
  zeichne(ziel);
}

/* ------------------------------------------------------------------ */
/* Zeichnen                                                            */
/* ------------------------------------------------------------------ */

function zeichne(ziel: HTMLElement): void {
  const offeneAnfragen = buchungen.filter((b) => b.status === 'angefragt').length;
  const offeneTickets = tickets.filter((t) => t.status === 'offen').length;

  ziel.replaceChildren(
    kopf(offeneAnfragen, offeneTickets),
    reiterleiste(ziel, offeneAnfragen, offeneTickets),
    meldungszeile(),
    reiter === 'buchungen'
      ? buchungsbereich(ziel)
      : reiter === 'kalender'
        ? kalenderbereich(ziel)
        : reiter === 'pakete'
          ? paketbereich(ziel)
          : reiter === 'seiten'
            ? seitenbereich(ziel)
            : ticketbereich(ziel)
  );
}

function kopf(anfragen: number, offen: number): HTMLElement {
  const leiste = tag('header', 'ckopf');

  const links = tag('div', 'ckopf__marke');
  const titel = document.createElement('h1');
  titel.textContent = 'Portal';
  links.append(titel, mono(`${anfragen} offene Anfragen · ${offen} offene Tickets`));

  const rechts = tag('div', 'ckopf__aktionen');
  /* Die Buchungsseite steht zuerst: Sie ist die Adresse, die der Betreiber
     weitergibt — an Kunden, auf die eigene Website, in die Signatur. */
  (
    [
      ['Buchungsseite', './buchen.html'],
      ['Cockpit', './cockpit.html'],
      ['Galerie', './galerie.html'],
      ['Booth öffnen', './index.html'],
    ] as const
  ).forEach(([text, ziel], i) => {
    const glied = tag('a', `cknopf${i === 3 ? ' cknopf--amber' : ''}`) as HTMLAnchorElement;
    glied.href = ziel;
    glied.textContent = text;
    if (i === 0) glied.target = '_blank';
    rechts.append(glied);
  });

  const raus = tag('button', 'cknopf');
  raus.textContent = 'Abmelden';
  raus.addEventListener('click', () => void abmelden());
  rechts.append(raus);

  leiste.append(links, rechts);
  return leiste;
}

function reiterleiste(ziel: HTMLElement, anfragen: number, offen: number): HTMLElement {
  const leiste = tag('nav', 'preiter');
  const wege: { id: Reiter; text: string; zahl?: number }[] = [
    { id: 'buchungen', text: 'Buchungen', zahl: anfragen },
    { id: 'kalender', text: 'Kalender' },
    { id: 'pakete', text: 'Pakete' },
    { id: 'seiten', text: 'Event-Seiten' },
    { id: 'tickets', text: 'Tickets', zahl: offen },
  ];
  wege.forEach((w) => {
    const knopf = tag('button', `preiter__glied${reiter === w.id ? ' an' : ''}`) as HTMLButtonElement;
    knopf.type = 'button';
    knopf.textContent = w.text;
    knopf.setAttribute('aria-pressed', String(reiter === w.id));
    if (w.zahl) {
      const zahl = tag('span', 'preiter__zahl');
      zahl.textContent = String(w.zahl);
      knopf.append(zahl);
    }
    knopf.addEventListener('click', () => {
      reiter = w.id;
      meldung = '';
      zeichne(ziel);
    });
    leiste.append(knopf);
  });
  return leiste;
}

function meldungszeile(): HTMLElement {
  const zeile = tag('p', `pmeldung pmeldung--${meldungsart}`);
  zeile.textContent = meldung;
  zeile.hidden = !meldung;
  zeile.setAttribute('role', 'status');
  return zeile;
}

/* --- Buchungen ----------------------------------------------------- */

function buchungsbereich(ziel: HTMLElement): HTMLElement {
  const bereich = tag('section', 'cbereich');
  const kopfzeile = tag('div', 'cbereich__kopf');
  const titel = document.createElement('h2');
  titel.textContent = 'Buchungen';
  kopfzeile.append(titel, mono(`${buchungen.length} insgesamt`));
  bereich.append(kopfzeile);

  if (!buchungen.length) {
    bereich.append(
      hinweis(
        'Noch keine Anfrage. Sie entsteht, wenn jemand auf der Buchungsseite ein Paket wählt — ' +
          'die Box nimmt sie auch dann an, wenn hier niemand zusieht.'
      )
    );
    return bereich;
  }

  buchungen.forEach((b) => bereich.append(buchungskarte(ziel, b)));
  return bereich;
}

function buchungskarte(ziel: HTMLElement, b: Buchung): HTMLElement {
  const karte = tag('article', `pkarte pkarte--${stand(b.status)}`);

  const kopfzeile = tag('div', 'pkarte__kopf');
  const name = tag('b', 'pkarte__titel');
  name.textContent = `${b.name} · ${datum(b.date)}`;
  kopfzeile.append(name, marke(b.status));
  karte.append(kopfzeile);

  karte.append(
    zeilen([
      ['Paket', `${b.packageName}${b.price ? ` · ${b.price}` : ''}`],
      ['Zeit', `${b.startTime}–${b.endTime}`],
      ['Ort', b.location || '—'],
      ['Kontakt', [b.email, b.phone].filter(Boolean).join(' · ') || '—'],
      ['Eingegangen', datumZeit(b.createdAt)],
    ])
  );

  if (b.message) {
    const text = tag('p', 'pkarte__text');
    text.textContent = b.message;
    karte.append(text);
  }

  // Statuswechsel: Der Server lehnt eine Bestätigung ab, die mit einem
  // bestätigten Termin kollidiert — deshalb wird hier nichts vorgeprüft,
  // sondern seine Antwort gezeigt.
  const reihe = tag('div', 'creihe');
  BUCHUNGSSTAENDE.filter((s) => s !== b.status).forEach((s) => {
    const knopf = tag('button', `cknopf cknopf--klein${s === 'bestätigt' ? ' cknopf--amber' : ''}`);
    knopf.textContent = s === 'bestätigt' ? 'Bestätigen' : s === 'abgelehnt' ? 'Ablehnen' : s === 'abgeschlossen' ? 'Abschließen' : 'Zurück auf angefragt';
    knopf.addEventListener('click', () =>
      void tueUndZeichne(
        ziel,
        () => hole(`/api/bookings/${encodeURIComponent(b.id)}/status`, { method: 'POST', body: JSON.stringify({ status: s }) }),
        `${b.name}: ${s}.`
      )
    );
    reihe.append(knopf);
  });

  const loeschen = tag('button', 'cknopf cknopf--klein');
  loeschen.textContent = 'Löschen';
  loeschen.addEventListener('click', () => {
    if (!window.confirm(`Buchung von ${b.name} am ${datum(b.date)} wirklich löschen?`)) return;
    void tueUndZeichne(
      ziel,
      () => hole(`/api/bookings/${encodeURIComponent(b.id)}`, { method: 'DELETE' }),
      'Buchung gelöscht.'
    );
  });
  reihe.append(loeschen);
  karte.append(reihe);

  // Galerie-Link: das, was der Kunde nach der Feier bekommt.
  const galeriezeile = tag('label', 'czeile');
  const feld = document.createElement('input');
  feld.className = 'ceingabe';
  feld.value = b.galleryLink || '';
  feld.placeholder = 'Adresse der Galerie für diesen Kunden';
  const sichern = tag('button', 'cknopf cknopf--klein');
  sichern.textContent = 'Link sichern';
  sichern.addEventListener('click', () =>
    void tueUndZeichne(
      ziel,
      () => hole(`/api/bookings/${encodeURIComponent(b.id)}/gallery`, { method: 'POST', body: JSON.stringify({ galleryLink: feld.value }) }),
      'Galerie-Link gesichert.'
    )
  );
  galeriezeile.append(mono('Galerie'), feld, sichern);
  karte.append(galeriezeile);

  return karte;
}

/* --- Kalender ------------------------------------------------------ */

function kalenderbereich(ziel: HTMLElement): HTMLElement {
  const bereich = tag('section', 'cbereich');
  const kopfzeile = tag('div', 'cbereich__kopf');
  const titel = document.createElement('h2');
  titel.textContent = 'Kalender';
  kopfzeile.append(titel, mono(`${gesperrt.length} gesperrt · ${belegt.length} belegt`));
  bereich.append(
    kopfzeile,
    hinweis(
      'Ein Tag wird durch Antippen gesperrt und ebenso wieder frei. Gesperrte und bestätigte ' +
        'Tage bietet die Buchungsseite dem Kunden gar nicht erst an.'
    )
  );

  // Drei Monate voraus reichen: Wer weiter plant, ruft an.
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  for (let m = 0; m < 3; m++) {
    bereich.append(monat(ziel, new Date(heute.getFullYear(), heute.getMonth() + m, 1), heute));
  }
  return bereich;
}

function monat(ziel: HTMLElement, erster: Date, heute: Date): HTMLElement {
  const block = tag('div', 'pmonat');
  const name = tag('h3', 'pmonat__name');
  name.textContent = erster.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  block.append(name);

  const raster = tag('div', 'pmonat__raster');
  ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].forEach((t) => {
    const kopfTag = tag('span', 'pmonat__wochentag');
    kopfTag.textContent = t;
    raster.append(kopfTag);
  });

  // Montag als erster Tag der Woche — deutsche Kalender fangen dort an.
  const vorlauf = (erster.getDay() + 6) % 7;
  for (let i = 0; i < vorlauf; i++) raster.append(tag('span', 'pmonat__leer'));

  const tage = new Date(erster.getFullYear(), erster.getMonth() + 1, 0).getDate();
  for (let t = 1; t <= tage; t++) {
    const tagesdatum = new Date(erster.getFullYear(), erster.getMonth(), t);
    const schluessel = alsSchluessel(tagesdatum);
    const istGesperrt = gesperrt.includes(schluessel);
    const istBelegt = belegt.includes(schluessel);
    const vorbei = tagesdatum < heute;

    const knopf = tag(
      'button',
      `ptag${istGesperrt ? ' ptag--gesperrt' : ''}${istBelegt ? ' ptag--belegt' : ''}${vorbei ? ' ptag--vorbei' : ''}`
    ) as HTMLButtonElement;
    knopf.type = 'button';
    knopf.textContent = String(t);
    knopf.title = istBelegt
      ? 'Bestätigte Buchung'
      : istGesperrt
        ? 'Gesperrt — antippen gibt den Tag frei'
        : 'Frei — antippen sperrt den Tag';
    // Ein belegter Tag wird nicht gesperrt: Die Buchung hält ihn schon.
    knopf.disabled = istBelegt;
    knopf.addEventListener('click', () =>
      void tueUndZeichne(
        ziel,
        () => hole('/api/blocked', { method: 'POST', body: JSON.stringify({ date: schluessel }) }),
        `${datum(schluessel)} ist jetzt ${istGesperrt ? 'wieder frei' : 'gesperrt'}.`
      )
    );
    raster.append(knopf);
  }

  block.append(raster);
  return block;
}

/* --- Pakete -------------------------------------------------------- */

function paketbereich(ziel: HTMLElement): HTMLElement {
  const bereich = tag('section', 'cbereich');
  const kopfzeile = tag('div', 'cbereich__kopf');
  const titel = document.createElement('h2');
  titel.textContent = 'Pakete';
  kopfzeile.append(titel, mono(`${pakete.filter((p) => p.active).length} von ${pakete.length} buchbar`));
  bereich.append(
    kopfzeile,
    hinweis('Nur ein aktives Paket taucht auf der Buchungsseite auf. Wer alle abschaltet, nimmt keine Anfragen mehr an.')
  );

  pakete.forEach((p) => bereich.append(paketkarte(ziel, p)));

  const neu = tag('button', 'cknopf cknopf--amber');
  neu.textContent = 'Paket anlegen';
  neu.addEventListener('click', () =>
    void tueUndZeichne(
      ziel,
      () =>
        hole('/api/packages', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Neues Paket',
            price: '',
            hours: 4,
            features: [],
            active: false,
            order: pakete.length,
          }),
        }),
      'Paket angelegt — es ist noch nicht buchbar.'
    )
  );
  bereich.append(neu);
  return bereich;
}

function paketkarte(ziel: HTMLElement, p: Paket): HTMLElement {
  const karte = tag('article', `pkarte${p.active ? '' : ' pkarte--still'}`);
  const entwurf: Paket = { ...p, features: [...p.features] };

  const kopfzeile = tag('div', 'pkarte__kopf');
  const name = tag('b', 'pkarte__titel');
  name.textContent = p.name;
  kopfzeile.append(name, marke(p.active ? 'buchbar' : 'aus'));
  karte.append(kopfzeile);

  karte.append(
    eingabe('Name', entwurf.name, (v) => (entwurf.name = v)),
    eingabe('Preis', entwurf.price, (v) => (entwurf.price = v), 'z. B. 590 € inkl. Aufbau'),
    eingabe('Stunden', String(entwurf.hours), (v) => (entwurf.hours = Number(v) || 0)),
    eingabe(
      'Leistungen',
      entwurf.features.join(' · '),
      (v) => (entwurf.features = v.split('·').map((f) => f.trim()).filter(Boolean)),
      'mit · getrennt'
    )
  );

  const reihe = tag('div', 'creihe');

  const sichern = tag('button', 'cknopf cknopf--amber cknopf--klein');
  sichern.textContent = 'Sichern';
  sichern.addEventListener('click', () =>
    void tueUndZeichne(
      ziel,
      () => hole('/api/packages', { method: 'POST', body: JSON.stringify(entwurf) }),
      `„${entwurf.name}" gesichert.`
    )
  );

  const schalten = tag('button', 'cknopf cknopf--klein');
  schalten.textContent = p.active ? 'Nicht mehr anbieten' : 'Buchbar machen';
  schalten.addEventListener('click', () =>
    void tueUndZeichne(
      ziel,
      () => hole('/api/packages', { method: 'POST', body: JSON.stringify({ ...entwurf, active: !p.active }) }),
      p.active ? `„${p.name}" ist nicht mehr buchbar.` : `„${p.name}" ist jetzt buchbar.`
    )
  );

  const loeschen = tag('button', 'cknopf cknopf--klein');
  loeschen.textContent = 'Löschen';
  loeschen.addEventListener('click', () => {
    if (!window.confirm(`Paket „${p.name}" wirklich löschen?`)) return;
    void tueUndZeichne(
      ziel,
      () => hole(`/api/packages/${encodeURIComponent(p.id)}`, { method: 'DELETE' }),
      'Paket gelöscht.'
    );
  });

  reihe.append(sichern, schalten, loeschen);
  karte.append(reihe);
  return karte;
}

/* --- Tickets ------------------------------------------------------- */

function ticketbereich(ziel: HTMLElement): HTMLElement {
  const bereich = tag('section', 'cbereich');
  const kopfzeile = tag('div', 'cbereich__kopf');
  const titel = document.createElement('h2');
  titel.textContent = 'Tickets';
  kopfzeile.append(titel, mono(`${tickets.filter((t) => t.status === 'offen').length} offen`));
  bereich.append(kopfzeile);

  if (!tickets.length) {
    bereich.append(hinweis('Keine Anfragen. Tickets entstehen über das Kontaktformular der Box.'));
    return bereich;
  }

  tickets.forEach((t) => bereich.append(ticketkarte(ziel, t)));
  return bereich;
}

function ticketkarte(ziel: HTMLElement, t: Ticket): HTMLElement {
  const karte = tag('article', `pkarte pkarte--${t.status === 'offen' ? 'offen' : 'still'}`);

  const kopfzeile = tag('div', 'pkarte__kopf');
  const titel = tag('b', 'pkarte__titel');
  titel.textContent = `${t.id} · ${t.subject}`;
  kopfzeile.append(titel, marke(t.status), marke(t.priority));
  karte.append(kopfzeile);

  karte.append(
    zeilen([
      ['Von', `${t.name || '—'} · ${t.contact}`],
      ['Zuletzt', datumZeit(t.updated)],
    ])
  );

  const verlauf = tag('div', 'pverlauf');
  t.messages.forEach((m) => {
    const eintrag = tag('div', `pverlauf__glied pverlauf__glied--${m.from === 'customer' ? 'kunde' : 'wir'}`);
    const wer = mono(`${m.from === 'customer' ? 'Kunde' : 'Wir'} · ${datumZeit(m.time)}`);
    const text = document.createElement('p');
    text.textContent = m.text;
    eintrag.append(wer, text);
    verlauf.append(eintrag);
  });
  karte.append(verlauf);

  const antwortfeld = document.createElement('textarea');
  antwortfeld.className = 'ceingabe pantwort';
  antwortfeld.rows = 3;
  antwortfeld.placeholder = 'Antwort an den Kunden';
  karte.append(antwortfeld);

  const reihe = tag('div', 'creihe');

  const senden = tag('button', 'cknopf cknopf--amber cknopf--klein');
  senden.textContent = 'Antworten';
  senden.addEventListener('click', () => {
    const text = antwortfeld.value.trim();
    if (!text) {
      sage('Ohne Text keine Antwort.', 'fehler');
      zeichne(ziel);
      return;
    }
    void tueUndZeichne(
      ziel,
      () => hole(`/api/tickets/${encodeURIComponent(t.id)}/reply`, { method: 'POST', body: JSON.stringify({ text }) }),
      'Antwort abgelegt.'
    );
  });
  reihe.append(senden);

  TICKETSTAENDE.filter((s) => s !== t.status).forEach((s) => {
    const knopf = tag('button', 'cknopf cknopf--klein');
    knopf.textContent = s === 'geschlossen' ? 'Schließen' : s === 'offen' ? 'Wieder öffnen' : 'Als beantwortet';
    knopf.addEventListener('click', () =>
      void tueUndZeichne(
        ziel,
        () => hole(`/api/tickets/${encodeURIComponent(t.id)}/status`, { method: 'POST', body: JSON.stringify({ status: s }) }),
        `${t.id}: ${s}.`
      )
    );
    reihe.append(knopf);
  });

  karte.append(reihe);
  return karte;
}

/* --- Event-Seiten -------------------------------------------------- */

function seitenbereich(ziel: HTMLElement): HTMLElement {
  const bereich = tag('section', 'cbereich');
  const kopfzeile = tag('div', 'cbereich__kopf');
  const titel = document.createElement('h2');
  titel.textContent = 'Event-Seiten';
  kopfzeile.append(titel, mono(`${seiten.filter((s) => s.enabled).length} von ${seiten.length} offen`));
  bereich.append(
    kopfzeile,
    hinweis(
      'Eine Adresse, die der Kunde weitergeben kann. Ein Kennwort davor und ein Datum, an dem ' +
        'alles verschwindet, sind beide freiwillig — versprochen ist aber, was hier steht.'
    )
  );

  seiten.forEach((s) => bereich.append(seitenkarte(ziel, s)));

  const neuKnopf = tag('button', 'cknopf cknopf--amber');
  neuKnopf.textContent = 'Event-Seite anlegen';
  neuKnopf.addEventListener('click', () =>
    void tueUndZeichne(
      ziel,
      () =>
        hole('/api/microsites', {
          method: 'POST',
          body: JSON.stringify({ title: 'Neue Feier', headline: '', subtitle: '', enabled: false }),
        }),
      'Seite angelegt — sie ist noch zu.'
    )
  );
  bereich.append(neuKnopf);
  return bereich;
}

function seitenkarte(ziel: HTMLElement, s: Eventseite): HTMLElement {
  const karte = tag('article', `pkarte${s.enabled ? '' : ' pkarte--still'}`);
  const entwurf: Eventseite = { ...s };

  const adresse = `${location.origin}/m/${s.slug}`;

  const kopfzeile = tag('div', 'pkarte__kopf');
  const name = tag('b', 'pkarte__titel');
  name.textContent = s.title;
  kopfzeile.append(name, marke(s.enabled ? 'offen' : 'zu'));
  if (s.password) kopfzeile.append(marke('kennwort'));
  if (s.expires) kopfzeile.append(marke(`bis ${datum(s.expires)}`));
  karte.append(kopfzeile);

  const link = tag('a', 'pkarte__adresse') as HTMLAnchorElement;
  link.href = adresse;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent = adresse;
  karte.append(link);

  karte.append(
    eingabe('Titel', entwurf.title, (v) => (entwurf.title = v)),
    eingabe('Überschrift', entwurf.headline, (v) => (entwurf.headline = v), 'steht groß auf der Seite'),
    eingabe('Zeile darunter', entwurf.subtitle, (v) => (entwurf.subtitle = v)),
    eingabe('Kennwort', entwurf.password, (v) => (entwurf.password = v), 'leer = ohne'),
    eingabe('Läuft ab am', entwurf.expires, (v) => (entwurf.expires = v), 'JJJJ-MM-TT, leer = nie'),
    eingabe('Farbe', entwurf.accent, (v) => (entwurf.accent = v), '#f2b23e')
  );

  const anmutung = tag('div', 'creihe');
  ANMUTUNGEN.forEach((a) => {
    const knopf = tag('button', `cknopf cknopf--klein${entwurf.theme === a.id ? ' cknopf--amber' : ''}`);
    knopf.textContent = a.name;
    knopf.addEventListener('click', () =>
      void tueUndZeichne(
        ziel,
        () => hole(`/api/microsites/${encodeURIComponent(s.slug)}`, { method: 'PUT', body: JSON.stringify({ ...entwurf, theme: a.id }) }),
        `Anmutung: ${a.name}.`
      )
    );
    anmutung.append(knopf);
  });
  karte.append(mono('Anmutung'), anmutung);

  const reihe = tag('div', 'creihe');

  const sichern = tag('button', 'cknopf cknopf--amber cknopf--klein');
  sichern.textContent = 'Sichern';
  sichern.addEventListener('click', () =>
    void tueUndZeichne(
      ziel,
      () => hole(`/api/microsites/${encodeURIComponent(s.slug)}`, { method: 'PUT', body: JSON.stringify(entwurf) }),
      `„${entwurf.title}" gesichert.`
    )
  );

  const schalten = tag('button', 'cknopf cknopf--klein');
  schalten.textContent = s.enabled ? 'Schließen' : 'Öffnen';
  schalten.addEventListener('click', () =>
    void tueUndZeichne(
      ziel,
      () => hole(`/api/microsites/${encodeURIComponent(s.slug)}`, { method: 'PUT', body: JSON.stringify({ ...entwurf, enabled: !s.enabled }) }),
      s.enabled ? 'Die Seite ist zu.' : 'Die Seite ist offen.'
    )
  );

  const loeschen = tag('button', 'cknopf cknopf--klein');
  loeschen.textContent = 'Löschen';
  loeschen.addEventListener('click', () => {
    if (!window.confirm(`Event-Seite „${s.title}" wirklich löschen? Die Adresse führt danach ins Leere.`)) return;
    void tueUndZeichne(
      ziel,
      () => hole(`/api/microsites/${encodeURIComponent(s.slug)}`, { method: 'DELETE' }),
      'Seite gelöscht.'
    );
  });

  reihe.append(sichern, schalten, loeschen);
  karte.append(reihe);
  return karte;
}

/* ------------------------------------------------------------------ */
/* Helfer                                                              */
/* ------------------------------------------------------------------ */

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

function marke(text: string): HTMLElement {
  const el = tag('span', `pmarke pmarke--${stand(text)}`);
  el.textContent = text;
  return el;
}

/** Umlaute und Akzente raus, damit daraus ein Klassenname werden kann. */
function stand(wert: string): string {
  return wert
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z]/g, '');
}

function zeilen(paare: [string, string][]): HTMLElement {
  const liste = tag('dl', 'pdaten');
  paare.forEach(([marke, wert]) => {
    const dt = document.createElement('dt');
    dt.textContent = marke;
    const dd = document.createElement('dd');
    dd.textContent = wert;
    liste.append(dt, dd);
  });
  return liste;
}

function eingabe(
  marke: string,
  wert: string,
  setze: (v: string) => void,
  platzhalter = ''
): HTMLElement {
  const zeile = tag('label', 'czeile');
  const feld = document.createElement('input');
  feld.className = 'ceingabe';
  feld.value = wert;
  feld.placeholder = platzhalter;
  feld.addEventListener('input', () => setze(feld.value));
  zeile.append(mono(marke), feld);
  return zeile;
}

/** `2026-08-18` → `18.08.2026`. Ohne Zeitzone gerechnet, sonst rutscht der Tag. */
function datum(schluessel: string): string {
  const teile = schluessel.split('-');
  return teile.length === 3 ? `${teile[2]}.${teile[1]}.${teile[0]}` : schluessel;
}

function datumZeit(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

/** Ortszeit statt UTC: `toISOString()` verschiebt bei uns um bis zu zwei Stunden. */
function alsSchluessel(d: Date): string {
  const zwei = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
}
