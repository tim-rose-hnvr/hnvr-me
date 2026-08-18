/**
 * Die Zentrale — das erste, was nach dem Installieren aufgeht.
 *
 * Vorher sprang die Hülle direkt in den Booth, im Vollbild. Das ist die
 * Reihenfolge für den Abend, nicht für die Einrichtung: Wer gerade
 * installiert hat, will wissen, ob Drucker, Kamera und Netz stehen, will sich
 * anmelden und seine Lizenz eintragen — und erst danach den Booth öffnen.
 * Startete die Box stattdessen sofort im Vollbild, saß er ohne Leiste und
 * ohne sichtbaren Weg zurück fest.
 *
 * Drei Dinge stehen hier, in dieser Reihenfolge:
 *
 *   1. Durchcheck — neun Prüfungen, jede mit einem Handgriff daneben, wenn
 *      es etwas zu tun gibt. Ein Befund ohne Handgriff ist für jemanden vor
 *      einer wartenden Gesellschaft wertlos.
 *   2. Betreiber und Lizenz — wer die Box führt und was gebucht ist.
 *   3. Die Wege: Booth öffnen, Cockpit, Portal, Editor.
 *
 * Geprüft wird auf der Box, nicht hier. Diese Datei fragt und zeigt.
 */

import './stil.css';
import './zentrale.css';
import { verlangeAnmeldung, abmelden } from './anmeldung';
import './huelle';

type Stufe = 'gut' | 'warnung' | 'fehler';

type Befund = {
  art: Stufe;
  titel: string;
  text: string;
  /** Name der Reparatur, die diesen Befund behebt. */
  reparatur?: string;
};

type Durchcheck = {
  fassung: string;
  port: number;
  datenordner: string;
  zeitpunkt: string;
  befunde: Befund[];
};

type Modul = { id: string; name: string; frei: boolean; seiten: string[] };

const REPARATURNAMEN: Record<string, string> = {
  datenordner: 'Ordner anlegen',
  aufraeumen: 'Aufnahmen aufräumen',
  reste: 'Alte Dienste beenden',
  drucker: 'Drucker wählen',
  vorlagen: 'Vorlagen zurücksetzen',
  aktualisieren: 'Neue Fassung holen',
  neustart: 'Box neu starten',
};

/* Reparaturen, die nicht der Server macht, sondern ein Weg woandershin. */
const REPARATURWEGE: Record<string, string> = {
  drucker: './einrichtung.html',
  aktualisieren: './einrichtung.html',
};

const wurzel = document.getElementById('zentrale');
if (wurzel) void starte(wurzel);

async function starte(ziel: HTMLElement): Promise<void> {
  const stand = await verlangeAnmeldung();

  if (!stand) {
    ziel.replaceChildren(
      block('Die Box antwortet nicht', [
        satz(
          'Der Dienst der Box läuft gerade nicht. Ohne ihn gibt es weder Aufnahmen ' +
            'noch Einstellungen. Hilft ein Neustart des Rechners nicht, steht der Grund ' +
            'in der Datei start-fehler.log neben den Aufnahmen.'
        ),
      ])
    );
    return;
  }

  /* Frische Box, noch kein Betreiber: Dann ist die Einrichtung der erste
     Schritt, nicht der Durchcheck. Alles andere wäre eine Prüfliste für ein
     Gerät, das noch niemandem gehört. */
  if (!stand.angelegt) {
    location.replace('./anmelden.html?weiter=' + encodeURIComponent('/zentrale.html'));
    return;
  }

  zeichne(ziel, stand.name || stand.email);
  void ladeDurchcheck();
  void ladeModule();
}

/* ------------------------------------------------------------------ */
/* Gerüst                                                              */
/* ------------------------------------------------------------------ */

function zeichne(ziel: HTMLElement, wer: string): void {
  const wurzelkasten = tag('div', 'zwurzel');

  /* --- Kopf --- */
  const kopf = tag('header', 'zkopf');
  const links = tag('div');
  const titel = tag('h1');
  titel.textContent = 'Zentrale';
  const unterzeile = tag('span', 'zmono');
  unterzeile.id = 'zfassung';
  unterzeile.textContent = 'Wird geprüft …';
  links.append(titel, unterzeile);

  const rechts = tag('div', 'zkopfrechts');
  const wername = tag('span', 'zmono');
  wername.textContent = wer;
  const raus = knopf('Abmelden', () => void abmelden());
  rechts.append(wername, raus);
  kopf.append(links, rechts);

  /* --- Durchcheck --- */
  const pruefblock = block('Durchcheck', []);
  pruefblock.id = 'zpruefung';
  const pruefkopf = tag('div', 'zzeile');
  const pruefhinweis = tag('span', 'zmono');
  pruefhinweis.id = 'zpruefzeit';
  pruefhinweis.textContent = 'läuft …';
  const nochmal = knopf('Nochmal prüfen', () => void ladeDurchcheck());
  nochmal.id = 'znochmal';
  pruefkopf.append(pruefhinweis, nochmal);
  const liste = tag('div', 'zbefunde');
  liste.id = 'zbefunde';
  const meldung = tag('div', 'zmeldung');
  meldung.id = 'zmeldung';
  meldung.hidden = true;
  meldung.setAttribute('role', 'status');
  pruefblock.append(pruefkopf, liste, meldung);

  /* --- Module --- */
  const modulblock = block('Was gebucht ist', []);
  const modulraster = tag('div', 'zraster');
  modulraster.id = 'zmodule';
  const modulhinweis = tag('span', 'zmono');
  modulhinweis.id = 'zmodulhinweis';
  modulhinweis.textContent = 'wird geladen …';
  modulblock.append(modulhinweis, modulraster);

  /* --- Wege --- */
  const wegeblock = block('Wohin', []);
  const wege = tag('div', 'zraster');
  for (const [name, zeile, ziel2] of [
    ['Cockpit', 'Event, Aufnahmen, Löschfrist', './cockpit.html'],
    ['Einrichtung', 'Drucker, Kamera, Netz, Lizenz', './einrichtung.html'],
    ['Vorlagen-Editor', 'Druckbild bearbeiten', './editor.html'],
    ['Portal', 'Buchungen, Pakete, Tickets', './portal.html'],
    ['Galerie', 'Aufnahmen des Abends', './galerie.html'],
    ['Foto-Wall', 'Beamer und Fernseher', './wand.html'],
  ] as [string, string, string][]) {
    wege.append(kachel(name, zeile, ziel2));
  }
  wegeblock.append(wege);

  /* --- Fuß: der Booth --- */
  const fuss = tag('div', 'zfuss');
  const fusstext = tag('span', 'zmono');
  fusstext.textContent = 'Der Booth läuft im Vollbild. Escape oder F11 bringt zurück.';
  const start = knopf(
    'Fotobox öffnen',
    () => {
      /* Vollbild erst hier, und nur auf Zuruf: Der Booth ist der Zustand für
         den Abend. Ohne Hülle (im Browser) tut die Zeile nichts — dann
         schaltet der Betreiber selbst um. */
      void window.youboothHuelle?.vollbild?.(true);
      location.href = './index.html';
    },
    'amber'
  );
  start.classList.add('zknopf--gross');
  fuss.append(fusstext, start);

  wurzelkasten.append(kopf, pruefblock, modulblock, wegeblock, fuss);
  ziel.replaceChildren(wurzelkasten);
}

/* ------------------------------------------------------------------ */
/* Durchcheck                                                          */
/* ------------------------------------------------------------------ */

async function ladeDurchcheck(): Promise<void> {
  const liste = document.getElementById('zbefunde');
  const zeit = document.getElementById('zpruefzeit');
  const nochmal = document.getElementById('znochmal') as HTMLButtonElement | null;
  if (!liste || !zeit) return;

  if (nochmal) nochmal.disabled = true;
  zeit.textContent = 'läuft …';

  let stand: Durchcheck | null = null;
  try {
    const antwort = await fetch('/api/zentrale/check');
    if (antwort.ok) stand = (await antwort.json()) as Durchcheck;
  } catch {
    stand = null;
  }
  if (nochmal) nochmal.disabled = false;

  if (!stand) {
    zeit.textContent = 'Die Box hat nicht geantwortet.';
    liste.replaceChildren();
    return;
  }

  const fassung = document.getElementById('zfassung');
  if (fassung) {
    fassung.textContent = `Fassung ${stand.fassung} · Port ${stand.port} · ${stand.datenordner}`;
  }

  const schlimm = stand.befunde.filter((b) => b.art === 'fehler').length;
  const lau = stand.befunde.filter((b) => b.art === 'warnung').length;
  zeit.textContent =
    schlimm > 0
      ? `${schlimm} Fehler, ${lau} Hinweise`
      : lau > 0
        ? `Alles läuft, ${lau} Hinweise`
        : 'Alles in Ordnung';

  liste.replaceChildren(...stand.befunde.map(befundzeile));
}

function befundzeile(b: Befund): HTMLElement {
  const zeile = tag('div', 'zbefund');
  const punkt = tag('span', `zampel zampel--${b.art}`);
  punkt.setAttribute('role', 'img');
  punkt.setAttribute(
    'aria-label',
    b.art === 'gut' ? 'in Ordnung' : b.art === 'warnung' ? 'Hinweis' : 'Fehler'
  );

  const titel = tag('span', 'ztitel');
  titel.textContent = b.titel;

  const text = tag('span', 'ztext');
  text.textContent = b.text;

  const platz = tag('span', 'zknopfplatz');
  if (b.reparatur) {
    const name = REPARATURNAMEN[b.reparatur] ?? 'Beheben';
    const weg = REPARATURWEGE[b.reparatur];
    platz.append(
      weg
        ? verweisknopf(name, weg)
        : knopf(name, (k) => void repariere(b.reparatur as string, k, zeile))
    );
  }

  zeile.append(punkt, titel, text, platz);
  return zeile;
}

async function repariere(was: string, k: HTMLButtonElement, zeile: HTMLElement): Promise<void> {
  k.disabled = true;
  zeile.classList.add('zbefund--laeuft');
  const vorher = k.textContent;
  k.textContent = 'läuft …';

  try {
    const antwort = await fetch('/api/zentrale/reparatur', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ was }),
    });
    const daten = (await antwort.json().catch(() => null)) as
      | { ok?: boolean; text?: string; error?: string }
      | null;

    if (!antwort.ok || !daten) {
      sage(daten?.error ?? `Die Reparatur ist gescheitert (${antwort.status}).`, 'fehler');
    } else {
      sage(daten.text ?? 'Erledigt.', daten.ok === false ? 'fehler' : 'gut');
    }
  } catch {
    /* Beim Neustart bricht die Verbindung mitten im Aufruf ab — das ist kein
       Fehler, sondern genau das, worum gebeten wurde. */
    sage(
      was === 'neustart'
        ? 'Die Box startet neu. In ein paar Sekunden noch einmal prüfen.'
        : 'Die Box hat nicht geantwortet.',
      was === 'neustart' ? 'gut' : 'fehler'
    );
  }

  k.disabled = false;
  k.textContent = vorher;
  zeile.classList.remove('zbefund--laeuft');

  /* Nach einem Neustart braucht die Box einen Moment, bis sie wieder da ist. */
  window.setTimeout(() => void ladeDurchcheck(), was === 'neustart' ? 4000 : 400);
}

function sage(text: string, art: 'gut' | 'fehler' | 'still' = 'still'): void {
  const kasten = document.getElementById('zmeldung');
  if (!kasten) return;
  kasten.textContent = text;
  kasten.className = 'zmeldung' + (art === 'still' ? '' : ` zmeldung--${art}`);
  kasten.hidden = false;
}

/* ------------------------------------------------------------------ */
/* Module                                                              */
/* ------------------------------------------------------------------ */

async function ladeModule(): Promise<void> {
  const raster = document.getElementById('zmodule');
  const hinweis = document.getElementById('zmodulhinweis');
  if (!raster) return;

  let daten: { produkte: string[]; module: Modul[] } | null = null;
  try {
    const antwort = await fetch('/api/module');
    if (antwort.ok) daten = await antwort.json();
  } catch {
    daten = null;
  }

  if (!daten) {
    if (hinweis) hinweis.textContent = 'Die Modulliste ließ sich nicht laden.';
    return;
  }

  const alles = daten.produkte.includes('all');
  const offen = daten.module.filter((m) => m.frei).length;
  if (hinweis) {
    hinweis.textContent = alles
      ? `Alle ${daten.module.length} Module frei — keine Lizenzgrenze hinterlegt`
      : `${offen} von ${daten.module.length} Modulen gebucht`;
  }

  raster.replaceChildren(
    ...daten.module.map((m) => {
      const ziel = m.seiten[0] ?? './cockpit.html';
      const k = m.frei
        ? kachel(m.name, 'gebucht', '.' + ziel)
        : kachel(m.name, 'nicht gebucht', './einrichtung.html');
      if (!m.frei) k.classList.add('zkachel--zu');
      return k;
    })
  );
}

/* ------------------------------------------------------------------ */
/* Kleinteile                                                          */
/* ------------------------------------------------------------------ */

function tag(art: string, klasse = ''): HTMLElement {
  const e = document.createElement(art);
  if (klasse) e.className = klasse;
  return e;
}

function satz(text: string): HTMLElement {
  const p = tag('p', 'ztext');
  p.textContent = text;
  return p;
}

function block(titel: string, kinder: HTMLElement[]): HTMLElement {
  const b = tag('section', 'zblock');
  const h = tag('h2');
  h.textContent = titel;
  b.append(h, ...kinder);
  return b;
}

function knopf(
  text: string,
  tue: (k: HTMLButtonElement) => void,
  art: 'still' | 'amber' = 'still'
): HTMLButtonElement {
  const k = tag('button', 'zknopf' + (art === 'amber' ? ' zknopf--amber' : '')) as HTMLButtonElement;
  k.type = 'button';
  k.textContent = text;
  k.addEventListener('click', () => tue(k));
  return k;
}

/** Ein Weg woandershin sieht aus wie ein Knopf, ist aber ein Link — sonst
    lässt er sich nicht in einem zweiten Fenster öffnen. */
function verweisknopf(text: string, ziel: string): HTMLAnchorElement {
  const a = tag('a', 'zknopf') as HTMLAnchorElement;
  a.href = ziel;
  a.textContent = text;
  a.style.display = 'inline-flex';
  a.style.alignItems = 'center';
  a.style.textDecoration = 'none';
  return a;
}

function kachel(name: string, zeile: string, ziel: string): HTMLAnchorElement {
  const a = tag('a', 'zkachel') as HTMLAnchorElement;
  a.href = ziel;
  const n = tag('span', 'zkachelname');
  n.textContent = name;
  const z = tag('span', 'zkachelzeile');
  z.textContent = zeile;
  a.append(n, z);
  return a;
}
