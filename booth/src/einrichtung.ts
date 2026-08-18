/**
 * Installations-Zentrum: die sechs Schritte, bevor die Box läuft.
 *
 * Jeder Schritt prüft etwas Echtes — Kamera, Druckweg, Ablage, Ausgabe-Adresse
 * — statt nur einen Haken zu setzen. Was nicht geprüft werden kann, sagt das
 * offen.
 */

import './stil.css';
import './cockpit.css';
import './einrichtung.css';
import { holeEinstellungen, ladeEinstellungen, setzePin, sichereEinstellungen } from './einstellungen';
import { ARTEN } from './arten';
import { anzahl, loesche, sichere } from './speicher';
import { ausgabeAdresse, druckerListe, huellenauskunft } from './huelle';
import { drucke, qrFuer } from './ausgabe';

type Zustand = 'offen' | 'laeuft' | 'gut' | 'schlecht';

/* Ein gültiges 1×1-JPEG als Schreibprobe — kleiner geht es nicht, und es muss
   ein echtes Bild sein: Die Box nimmt nur Bilddaten an. */
const PROBEBILD =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsL' +
  'DBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAAB' +
  'AAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

const wurzel = document.getElementById('einrichtung');
if (wurzel) void starte(wurzel);

async function starte(ziel: HTMLElement): Promise<void> {
  // Die Einrichtung stellt das Gerät ein, nicht das laufende Event.
  await holeEinstellungen(true);
  const einstellungen = ladeEinstellungen();

  const kopf = tag('header', 'ekopf');
  const titel = document.createElement('h1');
  titel.textContent = 'Installations-Zentrum';
  const zeile = tag('span', 'cmono');
  /* Seit die Box einen Server hat, kann sie alles auch im Browser: ablegen,
     drucken, ausliefern. Die Hülle bringt nur noch Vollbild, Autostart und
     Selbstaktualisierung — das gehört hier hin, aber nicht als Warnung. */
  const huelle = huellenauskunft();
  zeile.textContent = huelle
    ? `Desktop-App ${huelle.fassung} · ${huelle.system} · aktualisiert sich selbst`
    : 'Im Browser · alles läuft, nur Vollbild und Selbstaktualisierung fehlen';
  kopf.append(titel, zeile);

  const liste = tag('div', 'eschritte');
  ziel.replaceChildren(kopf, liste);

  liste.append(
    schrittBox(einstellungen),
    schrittKamera(),
    schrittDruck(einstellungen),
    schrittArten(einstellungen),
    schrittNetz(einstellungen),
    await schrittPruefung(einstellungen)
  );
}

// --- Schritte -----------------------------------------------------------

function schrittBox(e: ReturnType<typeof ladeEinstellungen>): HTMLElement {
  const { rahmen, inhalt, melde } = schritt(1, 'Box und Kiosk-PIN', 'Name der Box und der PIN, hinter dem die Einstellungen liegen.');

  const box = feld('Boxname', e.box, (v) => (e.box = v));

  /* Die PIN steht nirgends im Feld: Die Box gibt sie nicht heraus, sie kennt
     nur ihre gesalzene Prüfsumme. Hier wird eine neue gesetzt oder die alte
     entfernt — angezeigt wird nur, ob überhaupt eine gilt. */
  let neuePin = '';
  const pin = feld('Neue Kiosk-PIN (leer = keine)', '', (v) => (neuePin = v));
  const pinFeld = pin.querySelector('input');
  if (pinFeld) {
    pinFeld.type = 'password';
    pinFeld.inputMode = 'numeric';
    pinFeld.placeholder = e.kioskGesetzt ? 'PIN gesetzt — neue eingeben zum Ändern' : 'keine PIN gesetzt';
  }

  const stand = tag('span', 'cmono');
  const zeigeStand = () => {
    // Der geltende Stand kommt von der Box, nicht aus dieser Kopie: `setzePin`
    // schreibt dorthin, und das Feld hier wüsste sonst nichts davon.
    stand.textContent = ladeEinstellungen().kioskGesetzt
      ? 'Kiosk gesperrt — die Einstellungen im Booth brauchen die PIN.'
      : 'Kiosk offen — jeder Gast kommt an die Einstellungen.';
  };
  zeigeStand();

  const sichern = knopf('Sichern', 'cknopf cknopf--amber', async () => {
    melde('laeuft', 'Sichere …');
    if (!(await sichereEinstellungen(e))) {
      melde('schlecht', 'Die Box hat die Einstellungen nicht angenommen.');
      return;
    }
    // Nur anfassen, wenn wirklich etwas eingegeben wurde — ein leeres Feld
    // beim reinen Namenswechsel darf die PIN nicht stillschweigend löschen.
    if (neuePin.trim()) {
      const antwort = await setzePin(neuePin);
      if (!antwort.ok) {
        melde('schlecht', antwort.grund ?? 'Die PIN wurde nicht angenommen.');
        return;
      }
      neuePin = '';
      if (pinFeld) {
        pinFeld.value = '';
        pinFeld.placeholder = 'PIN gesetzt — neue eingeben zum Ändern';
      }
    }
    zeigeStand();
    melde('gut', 'Gesichert.');
  });

  const entfernen = knopf('PIN entfernen', 'cknopf', async () => {
    const antwort = await setzePin('');
    if (!antwort.ok) {
      melde('schlecht', antwort.grund ?? 'Die Box antwortet nicht.');
      return;
    }
    zeigeStand();
    melde('gut', 'Der Kiosk steht jetzt offen.');
  });

  inhalt.append(box, pin, stand, reihe(sichern, entfernen));
  return rahmen;
}

function schrittKamera(): HTMLElement {
  const { rahmen, inhalt, melde } = schritt(
    2,
    'Kamera',
    'Freigabe erteilen, Gerät wählen, Testbild ansehen. Ohne Kamera nimmt die Box nichts auf.'
  );

  const video = document.createElement('video');
  video.className = 'evideo';
  video.playsInline = true;
  video.muted = true;

  const geraete = tag('div', 'cmono');
  geraete.textContent = 'Noch nicht geprüft';

  const pruefe = knopf('Kamera prüfen', 'cknopf cknopf--amber', async () => {
    melde('laeuft', 'Frage die Kamera an …');
    try {
      const strom = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      video.srcObject = strom;
      await video.play();

      const alleGeraete = await navigator.mediaDevices.enumerateDevices();
      const kameras = alleGeraete.filter((g) => g.kind === 'videoinput');
      geraete.textContent = `${kameras.length} Kamera${kameras.length === 1 ? '' : 's'} gefunden`;

      melde('gut', `Live-Bild steht: ${video.videoWidth}×${video.videoHeight}`);
    } catch (fehler) {
      const name = fehler instanceof Error ? fehler.name : '';
      melde(
        'schlecht',
        name === 'NotAllowedError'
          ? 'Die Freigabe wurde abgelehnt. Im Browser oder Betriebssystem erteilen.'
          : 'Keine Kamera erreichbar. Kabel prüfen, andere Programme schließen.'
      );
    }
  });

  inhalt.append(reihe(pruefe), geraete, video);
  return rahmen;
}

function schrittDruck(e: ReturnType<typeof ladeEinstellungen>): HTMLElement {
  const { rahmen, inhalt, melde } = schritt(
    3,
    'Drucker',
    'In der Desktop-Hülle druckt die Box selbst — randlos, ohne Dialog. Im Browser bleibt der Druckdialog des Systems.'
  );

  // Die Druckerliste kommt vom Betriebssystem, nicht aus einer Eingabe: Ein
  // getippter Druckername ist ein Tippfehler, der erst um 19 Uhr auffällt.
  const wahl = tag('div', 'creihe');
  const stand = tag('span', 'cmono');
  stand.textContent = e.drucker ? `Gewählt: ${e.drucker}` : 'Kein Drucker gewählt';

  const zeichneWahl = (liste: string[], standard: string | null) => {
    wahl.replaceChildren();
    if (!liste.length) {
      const hinweis = tag('span', 'cmono');
      /* Die Liste kommt von der Box, nicht vom Browser. Ist sie leer, meldet
         das Betriebssystem der Box keinen Drucker — egal, wo man gerade sitzt. */
      hinweis.textContent = 'Die Box meldet keinen Drucker. Kabel, Treiber und Einschalten prüfen.';
      wahl.append(hinweis);
      return;
    }
    liste.forEach((name) => {
      const k = tag('button', e.drucker === name ? 'cknopf cknopf--amber' : 'cknopf');
      k.textContent = name + (name === standard ? ' · Standard' : '');
      k.addEventListener('click', () => {
        e.drucker = e.drucker === name ? '' : name;
        sichereEinstellungen(e);
        stand.textContent = e.drucker ? `Gewählt: ${e.drucker}` : 'Kein Drucker gewählt';
        zeichneWahl(liste, standard);
      });
      wahl.append(k);
    });
  };

  void druckerListe().then(({ drucker, standard }) => {
    zeichneWahl(drucker, standard);
    // Ohne eigene Wahl den Standarddrucker übernehmen — er ist die beste
    // Vermutung, und sie steht sichtbar da, statt still zu gelten.
    if (!e.drucker && standard && drucker.includes(standard)) {
      e.drucker = standard;
      sichereEinstellungen(e);
      stand.textContent = `Gewählt: ${standard} (Standard des Systems)`;
      zeichneWahl(drucker, standard);
    }
  });

  const testdruck = knopf('Testdruck auslösen', 'cknopf cknopf--amber', () => {
    // Ein einfaches Prüfblatt statt einer Aufnahme.
    const flaeche = document.createElement('canvas');
    flaeche.width = 1200;
    flaeche.height = 1800;
    const stift = flaeche.getContext('2d');
    if (!stift) {
      melde('schlecht', 'Zeichenfläche nicht verfügbar.');
      return;
    }

    stift.fillStyle = '#ffffff';
    stift.fillRect(0, 0, 1200, 1800);
    stift.strokeStyle = '#17171c';
    stift.lineWidth = 6;
    stift.strokeRect(40, 40, 1120, 1720);
    stift.fillStyle = '#17171c';
    stift.font = '800 74px Archivo, system-ui, sans-serif';
    stift.textAlign = 'center';
    stift.fillText('youbooth', 600, 820);
    stift.font = "500 34px 'IBM Plex Mono', ui-monospace, monospace";
    stift.fillText('TESTDRUCK 10 × 15', 600, 900);
    stift.fillText(new Date().toLocaleString('de-DE'), 600, 960);

    melde('laeuft', 'Das Prüfblatt geht an den Drucker …');
    void drucke(flaeche.toDataURL('image/jpeg', 0.92), 'youbooth Testdruck', e.drucker).then(
      (ergebnis) => {
        if ('fehler' in ergebnis) {
          melde('schlecht', `Der Drucker meldet: ${ergebnis.fehler}`);
        } else if (ergebnis.weg === 'box') {
          melde('gut', `Prüfblatt an „${e.drucker}" geschickt. Jetzt muss Papier kommen.`);
        } else {
          melde('gut', 'Der Systemdruckdialog ist geöffnet. Kommt kein Dialog, fehlt ein Drucker.');
        }
      }
    );
  });

  inhalt.append(wahl, stand, reihe(testdruck));
  return rahmen;
}

function schrittArten(e: ReturnType<typeof ladeEinstellungen>): HTMLElement {
  const { rahmen, inhalt, melde } = schritt(
    4,
    'Aufnahmearten',
    'Angeboten wird am Screen nur, was hier eingeschaltet ist.'
  );

  const chips = tag('div', 'creihe');
  ARTEN.forEach((a) => {
    const knopfEl = tag('button', e.arten.includes(a.id) ? 'cknopf cknopf--amber' : 'cknopf');
    knopfEl.textContent = a.name;
    knopfEl.addEventListener('click', () => {
      const an = e.arten.includes(a.id);
      e.arten = an ? e.arten.filter((x) => x !== a.id) : [...e.arten, a.id];
      knopfEl.className = an ? 'cknopf' : 'cknopf cknopf--amber';
      if (e.arten.length === 0) {
        melde('schlecht', 'Mindestens eine Aufnahmeart muss eingeschaltet sein.');
      } else {
        sichereEinstellungen(e);
        melde('gut', `${e.arten.length} Arten aktiv.`);
      }
    });
    chips.append(knopfEl);
  });

  inhalt.append(chips);
  return rahmen;
}

function schrittNetz(e: ReturnType<typeof ladeEinstellungen>): HTMLElement {
  const { rahmen, inhalt, melde } = schritt(
    5,
    'Ausgabe im lokalen Netz',
    'Der QR-Code am Screen zeigt auf diese Adresse. In der Desktop-App trägt die Box sie selbst ein.'
  );

  const adresse = feld('Ausgabe-Adresse', e.ausgabeBasis, (v) => (e.ausgabeBasis = v));
  const vorschau = tag('div', 'eqr');

  const pruefe = knopf('Adresse holen und QR prüfen', 'cknopf cknopf--amber', async () => {
    melde('laeuft', 'Frage die Hülle …');
    const gemeldet = await ausgabeAdresse();
    if (gemeldet) {
      e.ausgabeBasis = gemeldet;
      const feldEl = adresse.querySelector('input');
      if (feldEl) feldEl.value = gemeldet;
    }

    sichereEinstellungen(e);

    const bild = await qrFuer(e.ausgabeBasis, 'probe');
    if (!bild) {
      vorschau.replaceChildren();
      melde(
        'schlecht',
        'Die Box meldet keine Adresse im Netz. Hängt sie am WLAN?'
      );
      return;
    }

    const img = document.createElement('img');
    img.src = bild;
    img.alt = 'QR-Probe';
    vorschau.replaceChildren(img);
    melde('gut', `QR zeigt auf ${e.ausgabeBasis}/f/…`);
  });

  inhalt.append(adresse, reihe(pruefe), vorschau);
  return rahmen;
}

async function schrittPruefung(e: ReturnType<typeof ladeEinstellungen>): Promise<HTMLElement> {
  const { rahmen, inhalt, melde } = schritt(
    6,
    'Selbstprüfung',
    'Ein Durchlauf über Kamera, Ablage, Ausgabe und Speicher — so wie vor jedem Event.'
  );

  const ergebnisse = tag('div', 'epruefung');

  const los = knopf('Selbstprüfung starten', 'cknopf cknopf--amber', async () => {
    ergebnisse.replaceChildren();
    melde('laeuft', 'Prüfe …');
    let schlecht = 0;

    // Kamera
    try {
      const strom = await navigator.mediaDevices.getUserMedia({ video: true });
      strom.getTracks().forEach((s) => s.stop());
      ergebnisse.append(befund('Kamera', true, 'erreichbar'));
    } catch {
      ergebnisse.append(befund('Kamera', false, 'nicht erreichbar'));
      schlecht++;
    }

    // Ablage: eine Probe wirklich schreiben, zählen — und wieder wegräumen.
    // Eine Prüfung, die Spuren hinterlässt, füllt über Monate die Galerie.
    try {
      const vorher = await anzahl();
      const probe = await sichere(PROBEBILD, 'probe');
      const nachher = await anzahl();
      const ok = nachher > vorher;
      await loesche(probe.id).catch(() => undefined);
      ergebnisse.append(befund('Ablage', ok, ok ? 'beschreibbar' : 'schreibt nicht'));
      if (!ok) schlecht++;
    } catch {
      ergebnisse.append(befund('Ablage', false, 'nicht erreichbar'));
      schlecht++;
    }

    // Ausgabe-Adresse
    const adresse = e.ausgabeBasis || (await ausgabeAdresse());
    ergebnisse.append(
      befund('Ausgabe', Boolean(adresse), adresse || 'keine Adresse — QR-Weg fehlt')
    );

    // Speicherplatz
    try {
      const platz = await navigator.storage?.estimate?.();
      if (platz?.quota) {
        const freiMb = Math.round(((platz.quota - (platz.usage ?? 0)) / 1024 / 1024) * 10) / 10;
        const ok = freiMb > 200;
        ergebnisse.append(befund('Speicher', ok, `${freiMb} MB frei`));
        if (!ok) schlecht++;
      } else {
        ergebnisse.append(befund('Speicher', true, 'nicht messbar'));
      }
    } catch {
      ergebnisse.append(befund('Speicher', true, 'nicht messbar'));
    }

    // Aufnahmearten
    const artenOk = e.arten.length > 0;
    ergebnisse.append(
      befund('Aufnahmearten', artenOk, artenOk ? `${e.arten.length} aktiv` : 'keine aktiv')
    );
    if (!artenOk) schlecht++;

    melde(
      schlecht === 0 ? 'gut' : 'schlecht',
      schlecht === 0
        ? 'Alles bereit. Die Box kann laufen.'
        : `${schlecht} Punkt${schlecht === 1 ? '' : 'e'} braucht noch Aufmerksamkeit.`
    );
  });

  inhalt.append(reihe(los), ergebnisse);
  return rahmen;
}

// --- Bausteine ----------------------------------------------------------

function schritt(
  nummer: number,
  name: string,
  beschreibung: string
): { rahmen: HTMLElement; inhalt: HTMLElement; melde: (z: Zustand, text: string) => void } {
  const rahmen = tag('section', 'eschritt');

  const kopf = tag('div', 'eschritt__kopf');
  const zahl = tag('span', 'eschritt__nummer');
  zahl.textContent = String(nummer);

  const text = tag('div', 'eschritt__text');
  const titel = document.createElement('h2');
  titel.textContent = name;
  const unter = tag('p', 'chinweis');
  unter.textContent = beschreibung;
  text.append(titel, unter);

  const meldung = tag('span', 'emeldung');

  kopf.append(zahl, text, meldung);

  const inhalt = tag('div', 'eschritt__inhalt');
  rahmen.append(kopf, inhalt);

  const melde = (z: Zustand, t: string) => {
    meldung.textContent = t;
    meldung.dataset.zustand = z;
  };

  return { rahmen, inhalt, melde };
}

function befund(name: string, gut: boolean, text: string): HTMLElement {
  const zeile = tag('span', 'ebefund');
  const lampe = tag('span', gut ? 'elampe elampe--gut' : 'elampe elampe--schlecht');
  const marke = tag('b', 'ebefund__name');
  marke.textContent = name;
  const wert = tag('span', 'cmono');
  wert.textContent = text;
  zeile.append(lampe, marke, wert);
  return zeile;
}

function feld(marke: string, wert: string, setze: (v: string) => void): HTMLElement {
  const zeile = tag('label', 'czeile');
  const beschriftung = tag('span', 'cmono');
  beschriftung.textContent = marke;
  const eingabe = document.createElement('input');
  eingabe.className = 'ceingabe';
  eingabe.value = wert;
  eingabe.addEventListener('input', () => setze(eingabe.value));
  zeile.append(beschriftung, eingabe);
  return zeile;
}

function knopf(text: string, klasse: string, tue: () => void | Promise<void>): HTMLElement {
  const el = tag('button', klasse);
  el.textContent = text;
  el.addEventListener('click', () => void tue());
  return el;
}

function reihe(...kinder: HTMLElement[]): HTMLElement {
  const el = tag('div', 'creihe');
  el.append(...kinder);
  return el;
}

function tag(name: string, klasse: string): HTMLElement {
  const el = document.createElement(name);
  el.className = klasse;
  return el;
}
