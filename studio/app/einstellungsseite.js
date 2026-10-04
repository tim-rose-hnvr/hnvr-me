/* Einstellungen — als Seite, in neun Bereichen.

   Nach dem Atelier-Entwurf: links die Bereiche, rechts Karten mit Zeilen,
   oben eine Suche über alle Bereiche. Drei Arten von Zeilen:

   · **Schalter und Wahl** — eine Einstellung aus dem Verzeichnis
     (einstellungen.js), die sofort wirkt (`wendeAn`).
   · **Zustand** — etwas, das man wissen, aber hier nicht ändern kann:
     „Drucker: im Druckdialog des Browsers", „KI: nicht eingebaut". Der
     Entwurf zeigt an diesen Stellen Auswahlfelder; im Browser gibt es
     dahinter nichts, also steht da, wie es ist.
   · **Tat** — ein Knopf, der einen vorhandenen Befehl auslöst
     („Unterschrift anlegen …").

   Gemerkt werden die Einstellungen nur, wenn auf diesem Gerät überhaupt
   gemerkt werden darf (dieselbe Frage wie auf der Startseite). Oben rechts
   steht deshalb entweder „Automatisch gespeichert" oder „Gilt für diese
   Sitzung". */

import { zustand, hoer, melde, el, $, sage, frage, groesse, sichereBytes } from './kern.js';
import { EINSTELLUNGEN, BEREICHE, FASSUNG, einstellung } from './einstellungen.js';
import { merkenStand, setzeMerken } from './dokumentenatelier.js';
import { belegung, leereAblage, ablageVerfuegbar } from './ablage.js';

const SPEICHER = 'studio:einstellungen';
let offen = 1;
let suche = '';
let wendeAnFn = null;
let befehleFn = () => [];

/* ---------- Merken -------------------------------------------------------- */

const darfMerken = () => merkenStand() === 'ja';

function speichere() {
  if (!darfMerken()) return;
  const werte = Object.fromEntries(Object.entries(EINSTELLUNGEN)
    .filter(([k]) => k !== 'ablage.merken').map(([k, e]) => [k, e.wert]));
  try { localStorage.setItem(SPEICHER, JSON.stringify(werte)); } catch { /* voll oder gesperrt */ }
}

/** Liest gemerkte Einstellungen ein und wendet sie an — beim Start. */
export function ladeEinstellungen() {
  if (!darfMerken()) return;
  let werte = null;
  try { werte = JSON.parse(localStorage.getItem(SPEICHER) || 'null'); } catch { werte = null; }
  if (!werte || typeof werte !== 'object') return;
  uebernimm(werte);
}

/* Übernimmt Werte — nur bekannte Schlüssel, nur erlaubte Werte. Eine
   eingespielte Datei ist fremde Eingabe. */
function uebernimm(werte) {
  let gezaehlt = 0;
  for (const [schluessel, wert] of Object.entries(werte)) {
    const eintrag = EINSTELLUNGEN[schluessel];
    if (!eintrag || schluessel === 'ablage.merken') continue;
    if (eintrag.art === 'schalter' && typeof wert !== 'boolean') continue;
    if (eintrag.art === 'wahl' && !eintrag.werte.some(([w]) => w === String(wert))) continue;
    eintrag.wert = eintrag.art === 'wahl' ? String(wert) : wert;
    wendeAnFn?.(schluessel);
    gezaehlt += 1;
  }
  return gezaehlt;
}

function setze(schluessel, wert) {
  if (schluessel === 'ablage.merken') { setzeMerken(wert); zeichne(); return; }
  EINSTELLUNGEN[schluessel].wert = wert;
  wendeAnFn?.(schluessel);
  speichere();
  zeichne();
}

/* ---------- Zeilen -------------------------------------------------------- */

function schalterZeile(schluessel, e) {
  const an = !!e.wert;
  return el('div', { klasse: 'einst-zeile', daten: { schluessel } },
    el('div', { klasse: 'einst-beschriftung' },
      el('div', { klasse: 'einst-name', text: e.name }),
      e.hinweis ? el('div', { klasse: 'einst-hinweis', text: e.hinweis }) : null),
    el('span', { klasse: 'einst-stand', text: an ? 'Ein' : 'Aus', 'aria-hidden': 'true' }),
    el('button', {
      klasse: `pille ${an ? 'ist-an' : ''}`, role: 'switch', type: 'button',
      'aria-checked': an ? 'true' : 'false', 'aria-label': e.name,
      daten: { einstellung: schluessel },
      beiClick: () => setze(schluessel, !an),
    }, el('i', {})));
}

function wahlZeile(schluessel, e) {
  const wert = schluessel === 'ablage.merken' ? merkenStand() : String(e.wert);
  const feld = el('select', { klasse: 'feld einst-wahl', 'aria-label': e.name, daten: { einstellung: schluessel } },
    ...(schluessel === 'ablage.merken' && wert === 'frage' ? [el('option', { value: 'frage', text: 'Noch nicht entschieden', disabled: true })] : []),
    ...e.werte.map(([w, t]) => el('option', { value: w, text: t })));
  feld.value = wert;
  feld.addEventListener('change', () => setze(schluessel, feld.value));
  if (schluessel === 'ablage.merken' && !ablageVerfuegbar()) feld.disabled = true;
  return el('div', { klasse: 'einst-zeile', daten: { schluessel } },
    el('label', { klasse: 'einst-beschriftung' },
      el('div', { klasse: 'einst-name', text: e.name }),
      e.hinweis ? el('div', { klasse: 'einst-hinweis', text: e.hinweis }) : null),
    feld);
}

const zustandZeile = (name, wert, hinweis = '') => el('div', { klasse: 'einst-zeile ist-zustand' },
  el('div', { klasse: 'einst-beschriftung' },
    el('div', { klasse: 'einst-name', text: name }),
    hinweis ? el('div', { klasse: 'einst-hinweis', text: hinweis }) : null),
  el('span', { klasse: 'einst-wert', text: wert }));

const tatZeile = (name, knopf, tun, hinweis = '') => el('div', { klasse: 'einst-zeile' },
  el('div', { klasse: 'einst-beschriftung' },
    el('div', { klasse: 'einst-name', text: name }),
    hinweis ? el('div', { klasse: 'einst-hinweis', text: hinweis }) : null),
  el('button', { klasse: 'knopf knopf-klein', type: 'button', text: knopf, beiClick: tun }));

const befehl = (id) => () => window.studio?.fuehreAus?.(id);

/* Was je Bereich zusätzlich zu den Einstellungen dasteht — Zustände und
   Taten. Jede Zeile hier ist wahr; keine verspricht etwas, das es nicht gibt. */
function zusatz(nummer) {
  const datum = new Date().toLocaleDateString('de-DE');
  const zahl = (1234.56).toLocaleString('de-DE', { minimumFractionDigits: 2 });
  switch (nummer) {
    case 1: return {
      'Sprache & System': [
        zustandZeile('Sprache', 'Deutsch', 'Die Oberfläche gibt es auf Deutsch.'),
        zustandZeile('Region', `Deutschland · ${datum} · ${zahl} €`),
      ],
    };
    case 2: return {
      'Text & Bilder': [zustandZeile('Ersatzschrift', 'Helvetica', 'Ersetzter Text wird in Helvetica gesetzt, nicht in der Originalschrift.')],
      'Speichern & Wiederherstellen': [zustandZeile('Verlauf', 'Diese Sitzung', 'Rückgängig und Wiederholen reichen bis zum Öffnen der Datei zurück.')],
    };
    case 3: return {
      'Formulare': [
        tatZeile('Formularfelder erkennen', 'Erkennen …', befehl('formular:erkennen'), 'Linien und Kästchen werden zu Feldern — Vorschläge vor dem Einfügen.'),
        tatZeile('Zum nächsten leeren Feld', 'Springen', befehl('formular:naechstes')),
      ],
    };
    case 4: return {
      'Texterkennung': [zustandZeile('Verarbeitung', 'Lokal', 'Tesseract liegt dem Studio bei. Kein Bild verlässt das Gerät.')],
      'Ergebnis': [
        zustandZeile('Ausgabe', 'PDF mit Textschicht', 'Unsichtbarer Text hinter dem Scan, suchbar und kopierbar.'),
        tatZeile('Texterkennung starten', 'Erkennen …', befehl('texterkennung')),
      ],
    };
    case 5: return {
      'Office & Bild': [
        tatZeile('Word (.docx)', 'Ausgeben …', befehl('word:ausgeben')),
        tatZeile('Excel (.xlsx)', 'Ausgeben …', befehl('excel:ausgeben')),
        tatZeile('PDF/A und Vorabprüfung', 'Prüfen …', befehl('vorabpruefung')),
      ],
      'Dateien & Drucken': [
        zustandZeile('Speicherort', 'Downloads des Browsers', 'Einen Ordner wählen kann eine Webanwendung nicht vorgeben.'),
        zustandZeile('Drucker, Duplex, Maßstab', 'Im Druckdialog', 'Das stellt der Druckdialog des Browsers ein — das Studio sieht keinen Drucker.'),
      ],
    };
    case 6: return {
      'Lokale Verarbeitung & Freigaben': [
        zustandZeile('Verarbeitung', 'Lokal · Standard'),
        zustandZeile('Hochladen', 'Nur „Zur Unterschrift versenden"', 'Das ist der einzige Weg, auf dem eine Datei das Gerät verlässt — und er sagt es vorher.'),
      ],
      'Echte Schwärzung': [
        zustandZeile('Darstellung', 'Schwarz · deckend'),
        zustandZeile('Entfernung', 'Endgültig', 'Seiten mit Schwärzung werden als Bild neu gezeichnet; erkannter Text darunter entfällt.'),
        tatZeile('Vertraulich teilen', 'Starten', () => window.studio?.fuehreAus?.('teilen:vertraulich'), 'Schwärzen, Metadaten prüfen, sichere Kopie mit Prüfprotokoll.'),
      ],
    };
    case 7: return {
      'Gezeichnete Unterschrift': [
        tatZeile('Gespeicherte Unterschrift', 'Anlegen …', befehl('unterschrift:anlegen'), 'Gilt für diese Sitzung. Eine sichtbare Unterschrift ist kein Nachweis.'),
      ],
      'Digitale Identitäten & Zertifikate': [
        zustandZeile('Zertifikate', 'Keine hinterlegt', 'Eine .p12-Datei wird je Signatur geladen und nicht gespeichert — samt Kennwort.'),
        tatZeile('Digital unterschreiben', 'Unterschreiben …', befehl('signieren')),
        zustandZeile('Zeitstempel', 'Nicht eingerichtet', 'Bräuchte einen Zeitstempeldienst im Netz.'),
      ],
    };
    case 8: return {
      'KI-Assistent': [
        zustandZeile('KI', 'Nicht eingebaut', 'Das Studio schickt keine Dokumentinhalte an einen KI-Dienst. Die Hinweise am Dokument rechnet es selbst.'),
      ],
      'Dateianbieter & Konten': [
        zustandZeile('Lokale Dateien', 'Aktiv · Standard'),
        zustandZeile('OneDrive, Google Drive, Dropbox, iCloud', 'Nicht angebunden', 'Dateien von dort öffnen Sie über den Dateidialog Ihres Systems.'),
        zustandZeile('Anmeldung', document.querySelector('meta[name="studio-anmeldung-konto"]')?.content ? 'hnvr.me-Konto' : 'Keine', ''),
      ],
    };
    default: return {};
  }
}

/* Bereich 9 ist zu großen Teilen Zustand des Geräts — eigens gezeichnet. */
async function bereichNeun() {
  const karten = [];
  const profil = $('#profil')?.title || 'Nicht angemeldet';
  karten.push(karte('Profil & Lizenz', [
    zustandZeile('Profil', profil.replace(/^Angemeldet als /, '')),
    zustandZeile('Lizenz', 'Kostenlos', 'Ohne Stufen, ohne Zahlungsdaten.'),
    zustandZeile('Gerät', $('#fuss-stand')?.textContent.trim() || '—', $('#fuss-stand')?.title || ''),
  ]));
  const platz = await belegung();
  const anteil = platz.frei ? Math.min(100, (platz.bytes / (platz.bytes + platz.frei)) * 100) : 0;
  karten.push(karte('Speicher & Sicherung', [
    el('div', { klasse: 'einst-speicher' },
      el('div', { klasse: 'einst-speicher-kopf' },
        el('strong', { text: `${groesse(platz.bytes)} lokal verwendet` }),
        el('span', { text: platz.frei != null ? `${groesse(platz.frei)} frei` : '' })),
      el('div', { klasse: 'einst-speicher-balken', role: 'img', 'aria-label': `${Math.round(anteil)} Prozent belegt` },
        el('i', { style: `width: ${Math.max(anteil, platz.bytes ? 1 : 0)}%` })),
      el('div', { klasse: 'einst-hinweis', text: `${platz.anzahl} ${platz.anzahl === 1 ? 'Dokument' : 'Dokumente'} in der Ablage dieses Browsers` })),
    tatZeile('Ablage leeren', 'Leeren …', async () => {
      if (!await frage({ titel: 'Ablage leeren', text: 'Alle gemerkten Dokumente und Sammlungen werden von diesem Gerät gelöscht. Die Originaldateien bleiben, wo sie sind.', jaText: 'Alles löschen', gefahr: true })) return;
      await leereAblage(); zustand.ablageId = null; zeichne();
    }),
    tatZeile('Für offline einrichten', 'Einrichten …', befehl('installieren'), 'Das Studio liegt danach auf dem Gerät und startet ohne Verbindung.'),
    zustandZeile('Fassung', FASSUNG),
  ]));
  const mitKuerzel = befehleFn().filter((b) => b.kuerzel);
  karten.push(karte('Kurzbefehle', [
    el('p', { klasse: 'einst-hinweis', text: `${mitKuerzel.length} Befehle haben ein Kürzel. Sie folgen dem, was Betrachter und Textprogramme seit Jahren belegen, und sind nicht änderbar.` }),
    ...mitKuerzel.map((b) => el('div', { klasse: 'einst-zeile ist-kuerzel' },
      el('div', { klasse: 'einst-name', text: b.name }),
      el('kbd', { klasse: 'einst-taste', text: b.kuerzel }))),
  ]));
  karten.push(karte('Einstellungen übertragen', [
    el('p', { klasse: 'einst-hinweis', text: 'Kennwörter, Zertifikate und Dokumente sind nicht enthalten.' }),
    tatZeile('Konfiguration exportieren', 'Als JSON …', () => {
      const werte = Object.fromEntries(Object.entries(EINSTELLUNGEN).filter(([k]) => k !== 'ablage.merken').map(([k, e]) => [k, e.wert]));
      sichereBytes(new TextEncoder().encode(JSON.stringify({ studio: 'PDF Studio', fassung: FASSUNG, einstellungen: werte }, null, 2)), 'pdf-studio-einstellungen.json', 'application/json');
    }),
    tatZeile('Konfiguration importieren', 'Datei wählen …', () => {
      const wahl = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
      wahl.addEventListener('change', async () => {
        const datei = wahl.files?.[0];
        if (!datei) return;
        try {
          const inhalt = JSON.parse(await datei.text());
          const zahl = uebernimm(inhalt?.einstellungen || {});
          speichere(); zeichne();
          sage(`${zahl} Einstellung${zahl === 1 ? '' : 'en'} übernommen`);
        } catch { sage('Die Datei ist keine Konfiguration des Studios.', { art: 'warn' }); }
      });
      document.body.append(wahl); wahl.click(); setTimeout(() => wahl.remove(), 60000);
    }),
    tatZeile('Alle Einstellungen', 'Zurücksetzen …', async () => {
      if (!await frage({ titel: 'Alle Einstellungen zurücksetzen', text: 'Alle Bereiche bekommen ihre Voreinstellung zurück. Dokumente bleiben.', jaText: 'Zurücksetzen' })) return;
      setzeZurueck(null);
    }),
  ]));
  return karten;
}

function karte(titel, zeilen, satz = '') {
  return el('section', { klasse: 'einst-karte' },
    el('h3', { text: titel }),
    satz ? el('p', { klasse: 'einst-karten-satz', text: satz }) : null,
    ...zeilen);
}

/* Die Voreinstellungen, einmal beim Start abgelegt — für „Bereich
   zurücksetzen". */
const VOR = Object.fromEntries(Object.entries(EINSTELLUNGEN).map(([k, e]) => [k, e.wert]));

function setzeZurueck(bereich) {
  for (const [schluessel, e] of Object.entries(EINSTELLUNGEN)) {
    if (schluessel === 'ablage.merken') continue;
    if (bereich && e.bereich !== bereich) continue;
    e.wert = VOR[schluessel];
    wendeAnFn?.(schluessel);
  }
  speichere();
  zeichne();
  sage(bereich ? 'Bereich zurückgesetzt' : 'Alle Einstellungen zurückgesetzt');
}

/* ---------- Seite ----------------------------------------------------------- */

function zeilenFuer(eintraege) {
  return eintraege.map(([k, e]) => (e.art === 'schalter' ? schalterZeile(k, e) : wahlZeile(k, e)));
}

let lauf = 0;
async function zeichne() {
  const seite = $('#ansicht-einstellungen');
  if (!seite || seite.hidden) return;
  const meinLauf = ++lauf;
  const bereich = BEREICHE.find((b) => b.nummer === offen) || BEREICHE[0];

  /* Inhalt: entweder die Treffer einer Suche über alle Bereiche, oder die
     Karten des offenen Bereichs. */
  let karten = [];
  const wort = suche.trim().toLowerCase();
  if (wort) {
    const treffer = Object.entries(EINSTELLUNGEN).filter(([, e]) =>
      `${e.name} ${e.hinweis} ${e.karte}`.toLowerCase().includes(wort));
    const gruppen = new Map();
    for (const [k, e] of treffer) {
      const name = BEREICHE.find((b) => b.nummer === e.bereich)?.name || '';
      if (!gruppen.has(name)) gruppen.set(name, []);
      gruppen.get(name).push([k, e]);
    }
    karten = [...gruppen].map(([name, eintraege]) => karte(name, zeilenFuer(eintraege)));
    if (!karten.length) karten = [el('p', { klasse: 'stapel-leer', text: `Keine Einstellung zu „${suche}".` })];
  } else if (offen === 9) {
    karten = await bereichNeun();
  } else {
    const eigene = Object.entries(EINSTELLUNGEN).filter(([, e]) => e.bereich === offen);
    const extra = zusatz(offen);
    const titel = [...new Set([...eigene.map(([, e]) => e.karte), ...Object.keys(extra)])];
    karten = titel.map((t) => karte(t, [
      ...zeilenFuer(eigene.filter(([, e]) => e.karte === t)),
      ...(extra[t] || []),
    ]));
    if (offen === 1) karten.splice(1, 0, karten.splice(titel.indexOf('Erscheinungsbild'), 1)[0]);
  }
  if (meinLauf !== lauf) return;

  const merken = darfMerken();
  /* Der Kopf bleibt stehen, solange die Seite offen ist: würde das Suchfeld
     bei jedem Tastendruck neu gebaut, spränge die Schreibmarke an den
     Anfang („Metadaten" wurde zu „netadateM"). */
  let kopf = seite.querySelector('.einst-kopf');
  if (!kopf) {
    seite.innerHTML = '';
    const suchfeld = el('input', { type: 'search', id: 'einst-suche', placeholder: 'Einstellungen durchsuchen', 'aria-label': 'Einstellungen durchsuchen' });
    suchfeld.addEventListener('input', () => { suche = suchfeld.value; zeichne(); });
    kopf = el('header', { klasse: 'einst-kopf' },
      el('div', {},
        el('p', { klasse: 'seitenkopf-etikett', text: 'Persönlicher Arbeitsraum' }),
        el('h1', { text: 'Einstellungen' })),
      el('label', { klasse: 'suchfeld einst-suchfeld' },
        el('span', { html: '<svg viewBox="0 0 24 24" class="sinnbild" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="16" y1="16" x2="21" y2="21"/></svg>' }),
        suchfeld),
      el('span', { klasse: 'einst-gespeichert' }));
    seite.append(kopf);
  }
  const feld = kopf.querySelector('#einst-suche');
  if (feld.value !== suche) feld.value = suche;
  const schild = kopf.querySelector('.einst-gespeichert');
  schild.classList.toggle('ist-gemerkt', merken);
  schild.textContent = merken ? '✓ Automatisch gespeichert' : 'Gilt für diese Sitzung';
  schild.title = merken ? 'Auf diesem Gerät gemerkt' : 'Ohne „merken" gilt die Einstellung bis zum Schließen';

  const liste = el('nav', { klasse: 'einst-bereiche', 'aria-label': 'Bereiche' },
    el('span', { klasse: 'einst-bereiche-etikett', text: 'Alle Bereiche' }));
  for (const b of BEREICHE) {
    const offen_ = !wort && b.nummer === offen;
    const zahl = b.nummer === 3 ? zustand.anmerkungen.filter((a) => !a.erledigt).length : 0;
    liste.append(el('button', {
      klasse: `einst-kategorie ${offen_ ? 'ist-aktiv' : ''}`, type: 'button',
      'aria-current': offen_ ? 'page' : null, daten: { bereich: String(b.nummer), kategorie: b.name },
      beiClick: () => { offen = b.nummer; suche = ''; zeichne(); },
    },
      el('span', { klasse: 'einst-nummer', text: String(b.nummer).padStart(2, '0') }),
      el('span', { klasse: 'einst-kategorie-name', text: b.name }),
      zahl ? el('span', { klasse: 'einst-abzeichen', text: String(zahl), title: `${zahl} offen in „Kommentare"` }) : null));
  }
  liste.append(el('div', { klasse: 'einst-fassung' },
    el('div', { text: 'Für neue Dokumente' }),
    el('p', { text: 'Bestehende Dateien behalten, was in ihnen steht. Fassung ' }, el('span', { klasse: 'mono', text: FASSUNG }))));

  const inhalt = el('div', { klasse: 'einst-inhalt' },
    el('p', { klasse: 'einst-pfad', text: wort ? 'Einstellungen / Suche' : `Einstellungen / ${String(bereich.nummer).padStart(2, '0')}` }),
    el('h2', { text: wort ? `Treffer für „${suche}"` : bereich.name }),
    wort ? null : el('p', { klasse: 'einst-satz', text: bereich.satz }),
    el('div', { klasse: 'einst-karten' }, ...karten),
    el('footer', { klasse: 'einst-fuss' },
      el('span', { text: merken ? 'Änderungen werden lokal gespeichert.' : 'Änderungen gelten für diese Sitzung.' }),
      wort || offen === 9 ? null : el('button', { klasse: 'knopf', type: 'button', text: 'Bereich zurücksetzen', beiClick: () => setzeZurueck(offen) })));

  /* Beim Umschalten im selben Bereich bleibt die Stelle, an der man war. */
  const alt = seite.querySelector('.einst-rumpf');
  const gleich = alt && alt.dataset.ansicht === (wort ? 'suche' : String(offen));
  const stelle = gleich ? alt.querySelector('.einst-inhalt').scrollTop : 0;
  alt?.remove();
  seite.append(el('div', { klasse: 'einst-rumpf', daten: { ansicht: wort ? 'suche' : String(offen) } }, liste, inhalt));
  inhalt.scrollTop = stelle;
}

/** Öffnet die Seite auf einem Bereich (Nummer oder Name). */
export function oeffneBereich(bereich) {
  const b = BEREICHE.find((x) => x.nummer === bereich || x.name === bereich);
  if (b) offen = b.nummer;
  suche = '';
  zeichne();
}

export function starteEinstellungsseite({ wendeAn, befehle }) {
  wendeAnFn = wendeAn;
  befehleFn = () => befehle;
  ladeEinstellungen();
  hoer('ansicht:gewechselt', (name) => { if (name === 'einstellungen') zeichne(); });
  hoer('ablage:geaendert', () => { speichere(); zeichne(); });
  hoer('anmerkungen:geaendert', zeichne);
  hoer('einstellungen:geaendert', () => { /* von außen geändert, z. B. Thema über den Knopf */ speichere(); });
}

export { einstellung };
