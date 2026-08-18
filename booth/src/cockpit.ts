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
import {
  holeEinstellungen,
  ladeEinstellungen,
  sichereEinstellungen,
  ENTWICKLUNGEN,
  FILMLAENGEN,
  FILMLOOKS,
} from './einstellungen';
import { alle, raeumeAuf, type Aufnahme } from './speicher';
import { druckeInLetzterStunde, qrBild } from './ausgabe';
import { artname } from './arten';
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
    filmbereich(einstellungen, ziel),
    stimmbereich(einstellungen, ziel),
    zeitlupenbereich(einstellungen, ziel),
    offenerBereich()
  );
}

/**
 * Die Einwegkamera. Der Bereich, den der Betreiber am Sonntagmorgen
 * aufmacht — deshalb steht der Knopf „Jetzt entwickeln" darin und nicht
 * irgendwo in den Einstellungen der Box.
 *
 * Was hier NICHT steht: die Bilder. Sie liegen bis zur Entwicklung in einem
 * eigenen Ordner, und auch der Betreiber sieht sie erst danach — dort, wo
 * alle Aufnahmen liegen. Ein Vorschaufenster hier wäre die eine Hintertür,
 * die das ganze Versprechen aushebelt.
 */
function filmbereich(
  einstellungen: ReturnType<typeof ladeEinstellungen>,
  ziel: HTMLElement
): HTMLElement {
  const bereich = tag('section', 'cbereich');
  const kopfzeile = tag('div', 'cbereich__kopf');
  const titel = document.createElement('h2');
  titel.textContent = 'Einwegkamera';
  const stand = mono('wird geladen …');
  stand.dataset.feld = 'filmstand';
  kopfzeile.append(titel, stand);
  bereich.append(kopfzeile);

  const e = einstellungen.einweg;

  /* Der Schalter ist ein Zustand, kein Aufruf — deshalb NICHT amber. Zwei
     amberfarbene Knöpfe nebeneinander streiten sich um dieselbe Aufmerksamkeit,
     und die gehört hier dem „Sichern". Welcher Zustand gilt, sagt der Punkt. */
  const schalter = tag('button', 'cknopf');
  const punkt = tag('span', e.an ? 'cpunkt cpunkt--an' : 'cpunkt');
  schalter.append(punkt, document.createTextNode(e.an ? 'Ausgabefach offen' : 'Ausgabefach geschlossen'));
  schalter.addEventListener('click', async () => {
    e.an = !e.an;
    schalter.replaceChildren(document.createTextNode('Sichere …'));
    await sichereEinstellungen(einstellungen);
    await zeichne(ziel);
  });

  const formular = tag('div', 'cformular');

  const wahl = <T extends string | number>(
    marke: string,
    liste: readonly { id: T; name: string }[],
    ist: T,
    setze: (v: T) => void
  ) => {
    const zeile = tag('label', 'czeile');
    const feld = document.createElement('select');
    feld.className = 'ceingabe';
    liste.forEach((eintrag) => {
      const glied = document.createElement('option');
      glied.value = String(eintrag.id);
      glied.textContent = eintrag.name;
      glied.selected = eintrag.id === ist;
      feld.append(glied);
    });
    feld.addEventListener('change', () => {
      const gewaehlt = liste.find((l) => String(l.id) === feld.value);
      if (gewaehlt) setze(gewaehlt.id);
    });
    zeile.append(mono(marke), feld);
    formular.append(zeile);
  };

  wahl(
    'Filmlänge',
    FILMLAENGEN.map((n) => ({ id: n, name: `${n} Aufnahmen` })),
    e.bilder,
    (v) => (e.bilder = v)
  );
  wahl('Entwicklung', ENTWICKLUNGEN, e.entwicklung, (v) => (e.entwicklung = v));
  wahl('Look', FILMLOOKS, e.look, (v) => (e.look = v));
  wahl(
    'Zweiter Film',
    [
      { id: 'nein', name: 'Ein Film je Gast' },
      { id: 'ja', name: 'Nachladen erlaubt' },
    ] as const,
    e.nachladen ? 'ja' : 'nein',
    (v) => (e.nachladen = v === 'ja')
  );

  const sichern = tag('button', 'cknopf cknopf--amber');
  sichern.textContent = 'Sichern';
  sichern.addEventListener('click', async () => {
    sichern.textContent = 'Sichere …';
    const gut = await sichereEinstellungen(einstellungen);
    sichern.textContent = gut ? 'Sichern' : 'Die Box hat nicht angenommen';
    if (gut) await zeichne(ziel);
  });

  const entwickeln = tag('button', 'cknopf');
  entwickeln.dataset.feld = 'entwickeln';
  entwickeln.textContent = 'Jetzt entwickeln';
  entwickeln.addEventListener('click', async () => {
    entwickeln.textContent = 'Entwickle …';
    try {
      const antwort = await fetch('/api/film/entwickeln', { method: 'POST' });
      const daten = (await antwort.json()) as { entwickelt?: number };
      entwickeln.textContent = antwort.ok
        ? `${daten.entwickelt ?? 0} Bilder entwickelt`
        : 'Die Box hat nicht angenommen';
    } catch {
      entwickeln.textContent = 'Die Box antwortet nicht';
    }
    window.setTimeout(() => void zeichne(ziel), 1500);
  });

  const zuruecksetzen = tag('button', 'cknopf cknopf--klein');
  zuruecksetzen.dataset.feld = 'filme-zuruecksetzen';
  zuruecksetzen.textContent = 'Filme zurücksetzen';
  zuruecksetzen.title = 'Für die nächste Veranstaltung. Geht erst, wenn alles entwickelt ist.';
  zuruecksetzen.addEventListener('click', async () => {
    zuruecksetzen.textContent = 'Setze zurück …';
    try {
      const antwort = await fetch('/api/filme/zuruecksetzen', { method: 'POST' });
      const daten = (await antwort.json()) as { verworfen?: number; error?: string };
      zuruecksetzen.textContent = antwort.ok
        ? `${daten.verworfen ?? 0} Filme verworfen`
        : daten.error || 'Ging nicht';
    } catch {
      zuruecksetzen.textContent = 'Die Box antwortet nicht';
    }
    window.setTimeout(() => void zeichne(ziel), 2200);
  });

  const knoepfe = tag('div', 'creihe');
  knoepfe.append(schalter, sichern, entwickeln, zuruecksetzen);

  const liste = tag('div', 'cfilme');
  liste.dataset.feld = 'filme';

  /* Der Aufsteller für den Tisch. Ohne ihn ist das Modul unbenutzbar: Kein
     Gast tippt eine Adresse mit Doppelpunkt und Portnummer ab. Der Code wird
     im Browser gerechnet, nicht bei einem Dienst — er zeigt auf das WLAN im
     Saal und hat außerhalb ohnehin keinen Sinn. */
  const aufsteller = tag('div', 'caufsteller');
  aufsteller.dataset.feld = 'aufsteller';
  bereich.append(
    hinweis(
      'Gäste holen ihren Film mit diesem Code am Tisch. Bis zur Entwicklung sieht die ' +
        'Bilder niemand — auch hier stehen keine.'
    ),
    aufsteller,
    formular,
    knoepfe,
    liste
  );

  // Beides kommt nach, damit der Rest des Cockpits nicht darauf wartet.
  void ladeFilme(stand, liste);
  void zeigeAufsteller(aufsteller);
  return bereich;
}

/** QR-Code und abtippbare Adresse für einen Tischaufsteller. */
async function zeigeAufsteller(ziel: HTMLElement, pfad = '/film'): Promise<void> {
  let basis = '';
  try {
    const antwort = await fetch('/api/info');
    if (antwort.ok) basis = ((await antwort.json()) as { base?: string }).base ?? '';
  } catch {
    basis = '';
  }
  /* Ohne Auskunft der Box die Adresse dieses Fensters. Sie stimmt immer dann,
     wenn das Cockpit nicht gerade auf `localhost` läuft — und genau dann
     steht der Betreiber ohnehin an der Box. */
  if (!basis) basis = location.origin;
  const adresse = `${basis.replace(/\/$/, '')}${pfad}`;

  const zeile = mono(adresse);
  zeile.classList.add('caufsteller__adresse');

  try {
    const code = document.createElement('img');
    code.className = 'caufsteller__code';
    code.alt = `QR-Code auf ${adresse}`;
    code.src = await qrBild(adresse);
    ziel.replaceChildren(code, zeile);
  } catch {
    // Ohne Code bleibt die Adresse — abtippbar ist sie allemal.
    ziel.replaceChildren(zeile);
  }
}

/**
 * Das Audio-Gästebuch. Klein gehalten: ein Schalter, eine Länge, ein Code.
 * Mehr gibt es nicht zu entscheiden — die Grüße landen als Aufnahmen in der
 * Galerie und werden dort behandelt wie alles andere.
 */
function stimmbereich(
  einstellungen: ReturnType<typeof ladeEinstellungen>,
  ziel: HTMLElement
): HTMLElement {
  const bereich = tag('section', 'cbereich');
  const titel = document.createElement('h2');
  titel.textContent = 'Gesprochene Grüße';
  bereich.append(titel);

  const e = einstellungen.stimme;

  const schalter = tag('button', 'cknopf');
  const punkt = tag('span', e.an ? 'cpunkt cpunkt--an' : 'cpunkt');
  schalter.append(punkt, document.createTextNode(e.an ? 'Eingeschaltet' : 'Ausgeschaltet'));
  schalter.addEventListener('click', async () => {
    e.an = !e.an;
    schalter.replaceChildren(document.createTextNode('Sichere …'));
    await sichereEinstellungen(einstellungen);
    await zeichne(ziel);
  });

  const formular = tag('div', 'cformular');
  const zeile = tag('label', 'czeile');
  const laenge = document.createElement('select');
  laenge.className = 'ceingabe';
  [20, 30, 45, 60].forEach((n) => {
    const glied = document.createElement('option');
    glied.value = String(n);
    glied.textContent = `${n} Sekunden`;
    glied.selected = n === e.sekunden;
    laenge.append(glied);
  });
  laenge.addEventListener('change', () => (e.sekunden = Number(laenge.value)));
  zeile.append(mono('Höchstlänge'), laenge);
  formular.append(zeile);

  const sichern = tag('button', 'cknopf cknopf--amber');
  sichern.textContent = 'Sichern';
  sichern.addEventListener('click', async () => {
    sichern.textContent = 'Sichere …';
    const gut = await sichereEinstellungen(einstellungen);
    sichern.textContent = gut ? 'Sichern' : 'Die Box hat nicht angenommen';
    if (gut) await zeichne(ziel);
  });

  const aufsteller = tag('div', 'caufsteller');
  aufsteller.dataset.feld = 'stimm-aufsteller';

  const knoepfe = tag('div', 'creihe');
  knoepfe.append(schalter, sichern);

  bereich.append(
    hinweis(
      'Der Gast spricht seinen Gruß ins Handy; daraus entsteht ein Video mit Standbild und ' +
        'Stimme, das wie jede andere Aufnahme in der Galerie liegt.'
    ),
    aufsteller,
    formular,
    knoepfe
  );

  void zeigeAufsteller(aufsteller, '/stimme');
  return bereich;
}

/**
 * Die Zeitlupe. Ein Schalter und eine Sammeldauer — mehr ist es nicht: Wie
 * stark die Zeitlupe ausfällt, entscheidet die Kamera, und das steht auf der
 * Seite selbst, wo man es beim Aufbau braucht.
 */
function zeitlupenbereich(
  einstellungen: ReturnType<typeof ladeEinstellungen>,
  ziel: HTMLElement
): HTMLElement {
  const bereich = tag('section', 'cbereich');
  const titel = document.createElement('h2');
  titel.textContent = 'Zeitlupe';
  bereich.append(titel);

  const e = einstellungen.zeitlupe;

  const schalter = tag('button', 'cknopf');
  const punkt = tag('span', e.an ? 'cpunkt cpunkt--an' : 'cpunkt');
  schalter.append(punkt, document.createTextNode(e.an ? 'Eingeschaltet' : 'Ausgeschaltet'));
  schalter.addEventListener('click', async () => {
    e.an = !e.an;
    schalter.replaceChildren(document.createTextNode('Sichere …'));
    await sichereEinstellungen(einstellungen);
    await zeichne(ziel);
  });

  const formular = tag('div', 'cformular');
  const zeile = tag('label', 'czeile');
  const dauer = document.createElement('select');
  dauer.className = 'ceingabe';
  [2, 3, 4, 6, 8].forEach((n) => {
    const glied = document.createElement('option');
    glied.value = String(n);
    glied.textContent = `${n} Sekunden sammeln`;
    glied.selected = n === e.sekunden;
    dauer.append(glied);
  });
  dauer.addEventListener('change', () => (e.sekunden = Number(dauer.value)));
  zeile.append(mono('Aufnahmedauer'), dauer);
  formular.append(zeile);

  const sichern = tag('button', 'cknopf cknopf--amber');
  sichern.textContent = 'Sichern';
  sichern.addEventListener('click', async () => {
    sichern.textContent = 'Sichere …';
    const gut = await sichereEinstellungen(einstellungen);
    sichern.textContent = gut ? 'Sichern' : 'Die Box hat nicht angenommen';
    if (gut) await zeichne(ziel);
  });

  const oeffnen = tag('a', 'cknopf') as HTMLAnchorElement;
  oeffnen.href = './zeitlupe.html';
  oeffnen.textContent = 'Zeitlupe öffnen';

  const knoepfe = tag('div', 'creihe');
  knoepfe.append(schalter, sichern, oeffnen);

  bereich.append(
    hinweis(
      'Läuft an der Box, nicht am Gästehandy: Zeitlupe braucht Dauerlicht und eine Kamera, ' +
        'die viele Bilder je Sekunde liefert. Wie stark sie ausfällt, zeigt die Seite selbst — ' +
        'sie misst, was wirklich ankommt.'
    ),
    formular,
    knoepfe
  );
  return bereich;
}

type Filmstand = {
  entwickelt: boolean;
  entwickeltAm: number | null;
  imLabor: number;
  filme: { id: string; name: string; laenge: number; geknipst: number; geholt: number }[];
};

async function ladeFilme(stand: HTMLElement, liste: HTMLElement): Promise<void> {
  let daten: Filmstand;
  try {
    const antwort = await fetch('/api/filme');
    if (!antwort.ok) throw new Error(String(antwort.status));
    daten = (await antwort.json()) as Filmstand;
  } catch {
    stand.textContent = 'Filme nicht abrufbar';
    return;
  }

  const wann = daten.entwickeltAm ? new Date(daten.entwickeltAm) : null;
  stand.textContent = daten.entwickelt
    ? `entwickelt · ${daten.filme.length} ${daten.filme.length === 1 ? 'Film' : 'Filme'}`
    : `${daten.imLabor} ${daten.imLabor === 1 ? 'Bild' : 'Bilder'} im Labor · ` +
      `${daten.filme.length} ${daten.filme.length === 1 ? 'Film' : 'Filme'}` +
      (wann ? ` · Entwicklung ${wann.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}` : ' · von Hand');

  liste.replaceChildren();
  if (daten.filme.length === 0) {
    liste.append(hinweis('Noch hat kein Gast einen Film geholt.'));
    return;
  }

  daten.filme.forEach((f) => {
    const zeile = tag('div', 'cfilm');
    const name = tag('span', 'cfilm__name');
    name.textContent = f.name;

    /* Der Balken sagt in einem Blick, was eine Zahl erst nach Nachdenken
       sagt: Wie voll ist der Film? Bei achtzig Gästen zählt niemand mehr. */
    const balken = tag('span', 'cfilm__balken');
    const fuellung = tag('span', 'cfilm__fuellung');
    fuellung.style.width = `${Math.round((f.geknipst / f.laenge) * 100)}%`;
    balken.append(fuellung);

    const zahl = mono(`${f.geknipst} / ${f.laenge}`);
    zeile.append(name, balken, zahl);
    liste.append(zeile);
  });
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
    { ziel: './diashow.html', text: 'Diashow' },
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

    /* Seit gesprochene Grüße und Zeitlupen-Clips in derselben Ablage liegen,
       ist nicht mehr jede Aufnahme ein Bild. Ein Video in einem `<img>` zeigt
       nichts — die Kachel bliebe leer, mit einem Sichern-Knopf darunter. */
    let vorschau: HTMLElement;
    if (a.video) {
      const bewegung = document.createElement('video');
      bewegung.src = a.url;
      bewegung.muted = true;
      bewegung.playsInline = true;
      bewegung.controls = true;
      bewegung.preload = 'metadata';
      vorschau = bewegung;
    } else {
      const bild = document.createElement('img');
      bild.src = a.url;
      bild.alt = '';
      bild.loading = 'lazy';
      vorschau = bild;
    }

    const zeile = document.createElement('figcaption');
    zeile.append(
      mono(new Date(a.zeit).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })),
      mono(artname(a.art))
    );

    const laden = tag('a', 'cknopf cknopf--klein') as HTMLAnchorElement;
    laden.href = a.url;
    laden.download = a.id;
    laden.textContent = 'Sichern';

    kachel.append(vorschau, zeile, laden);
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
