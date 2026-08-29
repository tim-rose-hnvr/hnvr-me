/* Oberfläche — Verdrahtung: Werkzeugleiste, Tafeln, Befehle, Tastatur.

   Alles, was das Studio kann, ist ein Befehl mit Kennung. Werkzeugleiste,
   Befehlspalette, Tastenkürzel und die Vorschläge des Mitdenkens rufen
   denselben Befehl auf — es gibt keine Fähigkeit, die nur über einen Weg
   erreichbar wäre. */

import {
  zustand, melde, hoer, $, $$, el, sage, zeigeDialog, schliesseDialog, frage, merkeSchritt,
  schrittZurueck, schrittVor, groesse, mitLader, sichereBytes, zeile,
} from './kern.js';
import {
  oeffneDateien, ladeBeispiel, hatDokument, nummerVon, ermittleFormularfelder,
  ermittleMerkmale, setzeKennwortFrager,
} from './dokument.js';
import {
  starteAnsicht, baueNeu, zeigeSeite, setzeZoom, zoomeSchritt, dreheAnsicht, zuPdfPunkt,
  blattVon,
} from './ansicht.js';
import {
  WERKZEUGE, FELDARTEN, starteWerkzeuge, setzeSichtHoler, fuegeAn, entferne, aendere, waehleAn,
  uebernehmeAuswahl, hatUnterschrift,
} from './anmerkungen.js';
import { starteSeiten, drehe, loesche, verdopple, gewaehlteOderAktuelle } from './seiten.js';
import {
  starteOrdnen, umschalteOrdnen, schliesseOrdnen, oeffneOrdnen, ordnenOffen,
} from './ordnen.js';
import { starteMenue } from './menue.js';
import {
  starteMappen, mappenListe, neueMappe, wechsleZu, schliesse as schliesseMappe,
} from './mappen.js';
import {
  starteSuche, suche, trefferListe, zurueck, markiereAlle, suchbegriff, textAusgeben,
} from './suche.js';
import { zumNaechstenFeld } from './formulare.js';
import { zeigeUnterschriftDialog } from './unterschrift.js';
import { starteMitdenken, befunde, untersuche } from './mitdenken.js';
import { starteInstallieren, zeichneStand } from './installieren.js';
import {
  sichereDokument, seitenAusgeben, seiteAlsBild, vorschlagsname, baueDokument,
} from './ausgabe.js';
import { zeigeErkennungsDialog } from './texterkennung.js';
import { textDerSeite } from './dokument.js';
import { vergleicheMitDatei, schliesseVergleich, vergleichOffen } from './vergleich.js';
import {
  zeigeLeiste, zeichneGliederung, zeichneDateientafel, zeichneSuchtafel, zeichneSuchergebnisse,
  zeigeRechteTafel, zeichneRechteTafeln, zeichneKommentartafel, zeichneFeldertafel,
  zeichneVerlauftafel, zeichneRechteTafel,
} from './tafeln.js';
import {
  zeigeEigenschaften, zeigeSicherungsDialog, zeigeStapelDialog, zeigeMassstabDialog,
  zeigeMessungen, zeigeEinlesenDialog, zeigeEinstellungen, zeigeSignaturDialog,
  zeigeBarrierefreiDialog, zeigeExcelDialog, zeigeWordDialog, zeigeSchutzDialog,
  zeigeVerkleinernDialog, zeigeTeilenDialog, zeigeMusterDialog, zeigeHilfe, zeigePalette,
  zeigeInstallDialog, zeigeAufdruckDialog, zeigeFelderkennung,
} from './dialoge.js';


/* ---------- Befehlsregister ------------------------------------------------ */

export const befehle = [];

function befehl(id, name, gruppe, tun, kuerzel = '') {
  befehle.push({ id, name, gruppe, tun, kuerzel });
}

function baueBefehle() {
  befehl('datei:oeffnen', 'Datei öffnen', 'Datei', () => $('#dateiwahl').click(), 'Strg+O');
  befehl('datei:anhaengen', 'Datei anhängen (zusammenführen)', 'Datei', () => $('#dateiwahl-anhang').click());
  befehl('sichern', 'Sichern', 'Datei', () => sichereMit({}), 'Strg+S');
  befehl('sichern:als', 'Sichern unter …', 'Datei', zeigeSicherungsDialog, 'Strg+Umschalt+S');
  befehl('sichern:einbrennen', 'Sichern und Formular einbrennen', 'Datei', () => sichereMit({ formularEinbrennen: true }));
  befehl('seiten:ausgeben', 'Gewählte Seiten als neue Datei', 'Datei', async () => {
    const ids = gewaehlteOderAktuelle();
    await mitLader('Seiten werden ausgegeben …', () => seitenAusgeben(ids, vorschlagsname(`-auszug`)));
  });
  befehl('teilen', 'Dokument teilen …', 'Datei', zeigeTeilenDialog);
  befehl('text:ausgeben', 'Text ausgeben (.txt)', 'Datei', async () => {
    const text = await mitLader('Text wird gelesen …', textAusgeben);
    sichereBytes(new TextEncoder().encode(text), vorschlagsname('').replace(/\.pdf$/i, '.txt'), 'text/plain');
  });
  befehl('bild:ausgeben', 'Aktuelle Seite als PNG', 'Datei', async () => {
    const eintrag = zustand.folge[zustand.aktuelleSeite - 1];
    const blob = await mitLader('Bild wird erzeugt …', () => seiteAlsBild(eintrag, 3));
    sichereBytes(await blob.arrayBuffer(), vorschlagsname(`-seite-${zustand.aktuelleSeite}`).replace(/\.pdf$/i, '.png'), 'image/png');
  });
  befehl('word:ausgeben', 'Nach Word ausgeben (.docx) …', 'Datei', zeigeWordDialog);
  befehl('excel:ausgeben', 'Tabellen nach Excel ausgeben (.xlsx) …', 'Datei', zeigeExcelDialog);
  befehl('bilder:zuPdf', 'PDF aus Bildern erstellen …', 'Datei', () => $('#dateiwahl-bilder').click());
  befehl('einlesen', 'PDF aus Word, Excel, Text erstellen …', 'Datei', zeigeEinlesenDialog);
  befehl('stapel', 'Stapel: viele Dateien auf einmal …', 'Datei', zeigeStapelDialog);
  befehl('text:kopieren', 'Auswahl oder Seitentext kopieren', 'Text', async () => {
    const auswahl = String(window.getSelection() || '').trim();
    if (auswahl) {
      await inZwischenablage(auswahl);
      sage(`${auswahl.split(/\s+/).length} Wörter kopiert`);
      return;
    }
    const eintrag = zustand.folge[zustand.aktuelleSeite - 1];
    if (!eintrag) return;
    const text = await textDerSeite(eintrag);
    if (!text.trim()) return sage('Diese Seite trägt keinen Text — erst erkennen lassen?', { art: 'warn' });
    await inZwischenablage(text);
    sage(`Text von Seite ${zustand.aktuelleSeite} kopiert`);
  });
  befehl('text:alleKopieren', 'Text des ganzen Dokuments kopieren', 'Text', async () => {
    const text = await mitLader('Text wird gesammelt …', textAusgeben);
    await inZwischenablage(text);
    sage(`${text.split(/\s+/).filter(Boolean).length} Wörter in der Zwischenablage`);
  });
  befehl('vergleich', 'Mit anderer Datei vergleichen …', 'Datei', () => $('#dateiwahl-vergleich').click());
  befehl('drucken', 'Drucken', 'Datei', async () => {
    // Nicht die Bildschirmseite drucken: dort steht nur, was gerade gezeichnet
    // ist. Gedruckt wird die Datei, die auch beim Sichern entstünde.
    await mitLader('Druckfassung wird erzeugt …', async () => {
      const bytes = await baueDokument({ formularEinbrennen: true });
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const fenster = window.open(url, '_blank');
      if (!fenster) {
        sichereBytes(bytes, vorschlagsname('-druck'));
        sage('Der Browser hat das Druckfenster geblockt — die Datei wurde stattdessen gesichert.', { art: 'warn', dauer: 6000 });
      } else {
        // Der eingebaute PDF-Betrachter meldet sich nicht immer mit „load".
        // Deshalb beides: Versuch beim Laden und ein Versuch nach kurzer Frist.
        try { fenster.addEventListener?.('load', () => fenster.print(), { once: true }); } catch { /* fremdes Fenster */ }
        setTimeout(() => { try { fenster.print(); } catch { /* Betrachter druckt selbst */ } }, 1200);
        sage('Druckfassung geöffnet — falls kein Druckfenster erscheint, dort Strg+P drücken', { dauer: 6000 });
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    });
  }, 'Strg+P');
  befehl('verkleinern', 'Verkleinern …', 'Datei', zeigeVerkleinernDialog);
  befehl('reparieren', 'Datei reparieren', 'Datei', async () => {
    await mitLader('Datei wird neu geschrieben …', async () => {
      const { repariere } = await import('./schutz.js');
      const bytes = await baueDokument({ formularEinbrennen: false });
      sichereBytes(await repariere(bytes), vorschlagsname('-repariert'));
    });
    sage('Repariert — qpdf hat die Datei neu aufgebaut');
  });
  befehl('linearisieren', 'Fürs Web aufbereiten (linearisieren)', 'Datei', async () => {
    await mitLader('Datei wird linearisiert …', async () => {
      const { linearisiere } = await import('./schutz.js');
      const bytes = await baueDokument({});
      sichereBytes(await linearisiere(bytes), vorschlagsname('-web'));
    });
    sage('Linearisiert — öffnet im Browser seitenweise');
  });

  befehl('texterkennung', 'Texterkennung (OCR) …', 'Text', () => zeigeErkennungsDialog());
  befehl('schutz:setzen', 'Mit Kennwort schützen …', 'Schutz', zeigeSchutzDialog);
  befehl('schutz:entfernen', 'Schutz entfernen und offen sichern', 'Schutz', async () => {
    const warGeschuetzt = [...zustand.quellen.values()].some((q) => q.warGeschuetzt);
    await sichereMit({ dateiname: vorschlagsname('-ohne-schutz') });
    sage(warGeschuetzt
      ? 'Ohne Kennwort gesichert — die neue Datei ist für jeden lesbar.'
      : 'Das Dokument trug keinen Schutz; die Datei ist unverändert offen.', { dauer: 5000 });
  });
  befehl('einstellungen', 'Einstellungen …', 'Ansicht', () => zeigeEinstellungen());
  befehl('installieren', 'Auf diesem Gerät einrichten …', 'Datei', zeigeInstallDialog);
  befehl('aufdruck', 'Wasserzeichen, Kopf- und Fußzeile …', 'Seiten', zeigeAufdruckDialog);
  befehl('formular:erkennen', 'Formularfelder erkennen …', 'Werkzeuge', zeigeFelderkennung);
  befehl('barrierefrei', 'Barrierefreiheit prüfen …', 'Hilfe', zeigeBarrierefreiDialog);
  befehl('signieren', 'Digital unterschreiben (Zertifikat) …', 'Schutz', zeigeSignaturDialog);
  befehl('schutz:zeigen', 'Schutz und Rechte anzeigen', 'Schutz', async () => {
    await mitLader('Rechte werden gelesen …', async () => {
      const { rechte } = await import('./schutz.js');
      const bytes = await baueDokument({});
      const text = await rechte(bytes);
      zeigeDialog({
        titel: 'Schutz und Rechte',
        rumpf: el('div', {},
          el('p', { klasse: 'hinweis', text: 'Stand der Datei, die beim Sichern entstehen würde:' }),
          el('pre', { klasse: 'schutz-spalte', text: text || 'Keine Verschlüsselung.' })),
        knoepfe: [{ beschriftung: 'Schließen', betont: true }],
      });
    });
  });

  for (const werkzeug of WERKZEUGE) {
    befehl(`werkzeug:${werkzeug.id}`, `Werkzeug: ${werkzeug.name}`, 'Werkzeuge', () => setzeWerkzeug(werkzeug.id), werkzeug.kuerzel);
  }
  befehl('unterschrift:anlegen', 'Unterschrift anlegen …', 'Werkzeuge', () => {
    zeigeUnterschriftDialog(() => { setzeWerkzeug('unterschrift'); sage('Jetzt einen Rahmen auf der Seite aufziehen'); });
  });
  befehl('anmerkungen:loeschen', 'Gewählte Anmerkung löschen', 'Werkzeuge', () => {
    if (zustand.gewaehlteAnmerkung) entferne(zustand.gewaehlteAnmerkung);
    else sage('Keine Anmerkung gewählt');
  }, 'Entf');
  befehl('anmerkungen:alleLoeschen', 'Alle Anmerkungen löschen', 'Werkzeuge', async () => {
    if (!zustand.anmerkungen.length) return sage('Keine Anmerkungen vorhanden');
    if (!await frage({ titel: 'Alle Anmerkungen löschen', text: `${zustand.anmerkungen.length} Anmerkungen werden entfernt.`, jaText: 'Löschen', gefahr: true })) return;
    const vorher = [...zustand.anmerkungen];
    zustand.anmerkungen = [];
    merkeSchritt('Alle Anmerkungen gelöscht',
      () => { zustand.anmerkungen = [...vorher]; melde('anmerkungen:geaendert'); },
      () => { zustand.anmerkungen = []; melde('anmerkungen:geaendert'); });
    melde('anmerkungen:geaendert');
  });
  befehl('suche:treffer-hervorheben', 'Alle Suchtreffer hervorheben', 'Werkzeuge', hebeTrefferHervor);
  befehl('messen:massstab', 'Maßstab festlegen (kalibrieren) …', 'Werkzeuge', zeigeMassstabDialog);
  befehl('messen:liste', 'Messungen und Summen …', 'Werkzeuge', zeigeMessungen);

  befehl('seiten:ordnen', 'Seiten ordnen, sortieren, löschen …', 'Seiten', umschalteOrdnen, 'Strg+Umschalt+O');
  befehl('seiten:nurAuswahl', 'Nur gewählte Seiten zeigen', 'Seiten', () => setzeFokus(!zustand.nurAuswahl));
  befehl('seiten:drehenLinks', 'Seiten links drehen', 'Seiten', () => drehe(-90), 'Strg+Umschalt+←');
  befehl('seiten:drehenRechts', 'Seiten rechts drehen', 'Seiten', () => drehe(90), 'Strg+Umschalt+→');
  befehl('seiten:loeschen', 'Seiten löschen', 'Seiten', loesche);
  befehl('seiten:verdoppeln', 'Seiten verdoppeln', 'Seiten', verdopple);
  befehl('seiten:alleWaehlen', 'Alle Seiten wählen', 'Seiten', () => {
    zustand.folge.forEach((e) => zustand.gewaehlteSeiten.add(e.id));
    melde('auswahl:geaendert');
  }, 'Strg+A');
  befehl('leere:waehlen', 'Seiten ohne Text wählen', 'Seiten', () => {
    zustand.gewaehlteSeiten.clear();
    befunde.leereSeiten.forEach((id) => zustand.gewaehlteSeiten.add(id));
    melde('auswahl:geaendert');
    zeigeLeiste('links', 'miniaturen');
    sage(`${befunde.leereSeiten.length} Seiten ausgewählt`);
  });

  befehl('ansicht:groesser', 'Größer', 'Ansicht', () => zoomeSchritt(1), 'Strg++');
  befehl('ansicht:kleiner', 'Kleiner', 'Ansicht', () => zoomeSchritt(-1), 'Strg+−');
  befehl('ansicht:breite', 'Auf Breite einpassen', 'Ansicht', () => { $('#feld-zoom').value = 'breite'; setzeZoom('breite'); });
  befehl('ansicht:seite', 'Ganze Seite', 'Ansicht', () => { $('#feld-zoom').value = 'seite'; setzeZoom('seite'); });
  befehl('ansicht:drehen', 'Ansicht drehen', 'Ansicht', () => dreheAnsicht(90), 'Strg+Umschalt+R');
  befehl('ansicht:thema', 'Hell / Dunkel wechseln', 'Ansicht', wechsleThema);
  befehl('leiste:seiten', 'Seitenleiste: Seiten', 'Ansicht', () => zeigeLeiste('links', 'miniaturen'));
  befehl('leiste:umschalten', 'Seitenleiste ein/aus', 'Ansicht', () => {
    const huelle = $('#huelle');
    huelle.dataset.links = huelle.dataset.links === 'zu' ? 'auf' : 'zu';
    baueNeu({ haltePosition: true });
  }, 'F4');
  befehl('leiste:rechtsUmschalten', 'Rechte Leiste ein/aus', 'Ansicht', () => {
    const huelle = $('#huelle');
    huelle.dataset.rechts = huelle.dataset.rechts === 'zu' ? 'auf' : 'zu';
    baueNeu({ haltePosition: true });
  }, 'F5');

  befehl('palette', 'Befehle suchen …', 'Gehe zu', zeigePalette, 'Strg+K');
  befehl('gehezu:vor', 'Nächste Seite', 'Gehe zu', () => zeigeSeite(zustand.aktuelleSeite + 1), 'Bild ab');
  befehl('gehezu:zurueck', 'Vorherige Seite', 'Gehe zu', () => zeigeSeite(zustand.aktuelleSeite - 1), 'Bild auf');
  befehl('gehezu:erste', 'Erste Seite', 'Gehe zu', () => zeigeSeite(1), 'Pos1');
  befehl('gehezu:letzte', 'Letzte Seite', 'Gehe zu', () => zeigeSeite(zustand.folge.length), 'Ende');
  befehl('suchen', 'Suchen', 'Gehe zu', () => { zeigeLeiste('links', 'suche'); $('#suchfeld')?.focus(); }, 'Strg+F');
  befehl('gehezu:seite', 'Zu Seite springen …', 'Gehe zu', () => { $('#feld-seite').focus(); $('#feld-seite').select(); }, 'Strg+G');
  befehl('springe:unterschrift', 'Zur Unterschriftsstelle', 'Gehe zu', () => {
    const id = befunde.unterschriftStellen[0];
    if (!id) return sage('Keine Unterschriftsstelle gefunden');
    zeigeSeite(nummerVon(id));
  });
  befehl('muster:zeigen', 'Personenbezogene Fundstellen …', 'Gehe zu', zeigeMusterDialog);
  befehl('formular:naechstes', 'Zum nächsten leeren Feld', 'Gehe zu', () => zumNaechstenFeld((seitenId) => zeigeSeite(nummerVon(seitenId))));

  befehl('rueckgaengig', 'Rückgängig', 'Bearbeiten', schrittZurueck, 'Strg+Z');
  befehl('wiederholen', 'Wiederholen', 'Bearbeiten', schrittVor, 'Strg+Umschalt+Z');
  befehl('eigenschaften', 'Dokumenteigenschaften …', 'Bearbeiten', zeigeEigenschaften);
  befehl('hilfe', 'Tastenkürzel und Grenzen …', 'Hilfe', zeigeHilfe, 'F1');
}

export function fuehreAus(id) {
  const gefunden = befehle.find((b) => b.id === id);
  if (!gefunden) { console.warn('Unbekannter Befehl', id); return; }
  gefunden.tun();
}

/* ---------- Werkzeuge ------------------------------------------------------ */

export function setzeWerkzeug(id) {
  zustand.werkzeug = id;
  if (zustand.farbeJeWerkzeug[id]) zustand.farbe = zustand.farbeJeWerkzeug[id];
  if (id === 'unterschrift' && !hatUnterschrift()) {
    zeigeUnterschriftDialog(() => sage('Jetzt einen Rahmen auf der Seite aufziehen'));
  }
  melde('werkzeug:gewechselt', id);
  zeichneWerkzeugleiste();
  zeichneRechteTafel();
}

/* Die Werkzeugzeile nach dem Handoff: vier Gruppen, durch eine Haarlinie
   getrennt, jeder Knopf mit Sinnbild **und** Wort, rechts eine Gruppe, die
   beim Scrollen stehen bleibt.

   Sie trug einmal sechzehn Knöpfe, sechs davon nur als Zeichen. Das war ein
   anderes Programm als das gezeichnete: das Handoff zeigt neun beschriftete
   Knöpfe und nichts sonst. Was jetzt nicht mehr in der Zeile steht, ist
   deshalb nicht fort — es steht hinter „Mehr" und im Menü Werkzeuge. */
const WERKZEUGGRUPPEN = [
  [['auswahl', true], ['text', true]],
  [['hervor', true], ['notiz', true], ['schwaerzen', true]],
  [['feld', true], ['unterschrift', true]],
];

/* Die vierte Gruppe im Handoff sind keine Werkzeuge, sondern die drei
   Ansichten: Seiten, Vergleichen, Dokument. Genau die drei hat das Studio
   auch — der Seitenordner, der Vergleich und die Leseansicht. */
const ANSICHTEN = [
  ['ordnen', 'Seiten', 'M4 4h6v7H4zM14 4h6v7h-6zM4 13h6v7H4zM14 13h6v7h-6z'],
  ['vergleich', 'Vergleichen', 'M4 4h6v16H4zM14 4h6v16h-6z'],
  ['dokument', 'Dokument', 'M6 2h8l4 4v16H6zM14 2v5h4'],
];

/* Alles, was nicht in die vier Gruppen passt, steht hinter einem beschrifteten
   Knopf statt als Sinnbild ohne Wort in der Zeile. Das Handoff kennt keine
   unbeschrifteten Werkzeuge; ein Zeichen ohne Wort ist die stille Annahme,
   jeder wisse schon, was es bedeutet. */
const WEITERE_WERKZEUGE = [
  'unterstrich', 'durchstrich', 'freihand', 'rechteck', 'ellipse', 'pfeil',
  'ersetzen', 'stempel', 'bereich', 'messen', 'flaeche',
];

/* Die Dokumentreiter in der Titelleiste. Sie sind die einzige Stelle, an der
   sichtbar wird, dass mehrere Dateien offen sein koennen. */
function zeichneDokumentreiter() {
  const leiste = $('#dokument-reiter');
  if (!leiste) return;
  leiste.innerHTML = '';

  for (const mappe of mappenListe()) {
    const reiter = el('button', {
      klasse: `dok-reiter ${mappe.aktiv ? 'ist-aktiv' : ''}`,
      role: 'tab', 'aria-selected': mappe.aktiv ? 'true' : 'false',
      title: mappe.name,
      beiClick: () => wechsleZu(mappe.id),
    },
      el('span', { klasse: 'dok-reiter-name', text: mappe.geaendert ? `${mappe.name} •` : mappe.name }),
      mappe.seiten ? el('span', { klasse: 'dok-reiter-zahl', text: `${mappe.seiten} S.` }) : null);

    reiter.append(el('button', {
      klasse: 'dok-reiter-zu', 'aria-label': `${mappe.name} schließen`, text: '✕',
      beiClick: async (ereignis) => {
        ereignis.stopPropagation();
        if (mappe.geaendert && !await frage({
          titel: 'Ungesicherte Änderungen',
          text: `„${mappe.name}" hat Änderungen, die noch nicht gesichert sind. Wirklich schließen?`,
          jaText: 'Schließen', gefahr: true,
        })) return;
        schliesseMappe(mappe.id);
      },
    }));
    leiste.append(reiter);
  }

  leiste.append(el('button', {
    klasse: 'dok-reiter-neu', text: '+', title: 'Weitere Datei öffnen',
    beiClick: () => { neueMappe(); $('#dateiwahl').click(); },
  }));
}

function zeichneWerkzeugleiste() {
  const leiste = $('#werkzeugleiste');
  if (!leiste) return;
  leiste.innerHTML = '';

  /* Rückgängig und Wiederholen stehen ganz links, vor den Werkzeugen. Das
     Handoff sieht sie nicht vor; sie hier wegzulassen wäre aber ein Rückschritt
     hinter das, was das Studio schon konnte. */
  for (const [id, name, zeichen] of [
    ['rueckgaengig', 'Rückgängig', 'M9 14L4 9l5-5M4 9h9a6 6 0 0 1 0 12H8'],
    ['wiederholen', 'Wiederholen', 'M15 14l5-5-5-5M20 9h-9a6 6 0 0 0 0 12h5'],
  ]) {
    const naechster = id === 'rueckgaengig'
      ? zustand.historie[zustand.historieZeiger]
      : zustand.historie[zustand.historieZeiger + 1];
    const knopf = el('button', {
      klasse: 'werkzeug werkzeug-schmal', id: `knopf-${id}`,
      title: naechster ? `${name}: ${naechster.beschreibung}` : name,
      'aria-label': name,
      disabled: id === 'rueckgaengig'
        ? zustand.historieZeiger < 0
        : zustand.historieZeiger >= zustand.historie.length - 1,
      beiClick: () => fuehreAus(id),
    });
    knopf.innerHTML = `<svg viewBox="0 0 24 24" class="sinnbild"><path d="${zeichen}"/></svg>`;
    leiste.append(knopf);
  }
  leiste.append(el('span', { klasse: 'werkzeug-trenner' }));

  const werkzeugKnopf = (id) => {
    const werkzeug = WERKZEUGE.find((w) => w.id === id);
    if (!werkzeug) return null;
    const aktiv = zustand.werkzeug === werkzeug.id;
    const knopf = el('button', {
      klasse: `werkzeug ${aktiv ? 'ist-aktiv' : ''}`,
      title: `${werkzeug.name} (${werkzeug.kuerzel})`,
      'aria-label': werkzeug.name,
      'aria-pressed': aktiv ? 'true' : 'false',
      beiClick: () => setzeWerkzeug(werkzeug.id),
    });
    const kurz = werkzeug.name.replace(' anlegen', '').replace(' kopieren', '');
    knopf.innerHTML = `<svg viewBox="0 0 24 24" class="sinnbild"><path d="${werkzeug.zeichen}"/></svg><span>${kurz}</span>`;
    return knopf;
  };

  for (const gruppe of WERKZEUGGRUPPEN) {
    for (const [id] of gruppe) leiste.append(werkzeugKnopf(id));
    leiste.append(el('span', { klasse: 'werkzeug-trenner' }));
  }

  /* Vierte Gruppe: die drei Ansichten. */
  for (const [id, name, zeichen] of ANSICHTEN) {
    const aktiv = (id === 'ordnen' && ordnenOffen())
      || (id === 'vergleich' && vergleichOffen())
      || (id === 'dokument' && !ordnenOffen() && !vergleichOffen());
    const knopf = el('button', {
      klasse: `werkzeug ${aktiv ? 'ist-aktiv' : ''}`,
      title: name, 'aria-pressed': aktiv ? 'true' : 'false',
      beiClick: () => wechsleAnsicht(id),
    });
    knopf.innerHTML = `<svg viewBox="0 0 24 24" class="sinnbild"><path d="${zeichen}"/></svg><span>${name}</span>`;
    leiste.append(knopf);
  }
  leiste.append(el('span', { klasse: 'werkzeug-trenner' }));

  /* „Mehr": die übrigen Werkzeuge, beschriftet, in einer Liste am Fenster. */
  const mehrAktiv = WEITERE_WERKZEUGE.includes(zustand.werkzeug);
  const mehr = el('button', {
    klasse: `werkzeug ${mehrAktiv ? 'ist-aktiv' : ''}`,
    title: 'Weitere Werkzeuge', 'aria-haspopup': 'true',
    beiClick: (ereignis) => zeigeWeitereWerkzeuge(ereignis.currentTarget),
  });
  const gewaehlt = WERKZEUGE.find((w) => w.id === zustand.werkzeug);
  mehr.innerHTML = '<svg viewBox="0 0 24 24" class="sinnbild"><path d="M5 12h.01M12 12h.01M19 12h.01"/></svg>'
    + `<span>${mehrAktiv ? gewaehlt.name.replace(' kopieren', '') : 'Mehr'}</span>`;
  leiste.append(mehr);

  const rechts = el('div', { klasse: 'werkzeug-rechts' });
  for (const [id, name, zeichen] of [
    ['texterkennung', 'OCR ausführen', 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M8 10h8M8 14h5'],
    ['sichern:als', 'Exportieren', 'M12 3v11M8 11l4 4 4-4M4 20h16'],
  ]) {
    const knopf = el('button', { klasse: 'werkzeug', title: name, beiClick: () => fuehreAus(id) });
    knopf.innerHTML = `<svg viewBox="0 0 24 24" class="sinnbild"><path d="${zeichen}"/></svg><span>${name}</span>`;
    rechts.append(knopf);
  }
  leiste.append(rechts);
}

/* Die drei Ansichten schließen einander aus: es gibt genau eine Bühne. */
function wechsleAnsicht(id) {
  if (id === 'ordnen') {
    if (vergleichOffen()) schliesseVergleich();
    if (!ordnenOffen()) oeffneOrdnen();
  } else if (id === 'vergleich') {
    if (ordnenOffen()) schliesseOrdnen();
    if (!vergleichOffen()) $('#dateiwahl-vergleich').click();
  } else {
    if (ordnenOffen()) schliesseOrdnen();
    if (vergleichOffen()) schliesseVergleich();
  }
  zeichneWerkzeugleiste();
}

/* Die übrigen Werkzeuge als Liste am Knopf — beschriftet, mit Kürzel, wie
   ein Menü. Sie hängt am Fenster, nicht an der Zeile: die Zeile darf scrollen. */
function zeigeWeitereWerkzeuge(knopf) {
  $('#weitere-werkzeuge')?.remove();
  const liste = el('div', { klasse: 'menue-liste', id: 'weitere-werkzeuge', role: 'menu' });
  for (const id of WEITERE_WERKZEUGE) {
    const werkzeug = WERKZEUGE.find((w) => w.id === id);
    if (!werkzeug) continue;
    liste.append(el('button', {
      klasse: `menue-eintrag ${zustand.werkzeug === id ? 'ist-an' : ''}`,
      role: 'menuitem',
      beiClick: () => { liste.remove(); setzeWerkzeug(id); },
    },
      el('span', { klasse: 'menue-name', text: werkzeug.name }),
      el('span', { klasse: 'menue-kuerzel', text: werkzeug.kuerzel })));
  }
  document.body.append(liste);

  const kasten = knopf.getBoundingClientRect();
  const breite = liste.getBoundingClientRect().width;
  const rand = 8;
  liste.style.top = `${Math.round(kasten.bottom + 2)}px`;
  liste.style.left = `${Math.round(Math.max(rand, Math.min(kasten.left, window.innerWidth - breite - rand)))}px`;
  liste.style.maxHeight = `${Math.round(window.innerHeight - kasten.bottom - rand * 2)}px`;

  const zu = (ereignis) => {
    if (ereignis && liste.contains(ereignis.target)) return;
    liste.remove();
    document.removeEventListener('pointerdown', zu, true);
    window.removeEventListener('resize', zu);
  };
  setTimeout(() => document.addEventListener('pointerdown', zu, true), 0);
  window.addEventListener('resize', zu, { once: true });
  liste.querySelector('button')?.focus();
}

/* ---------- Dialoge --------------------------------------------------------- */



export async function sichereMit(optionen) {
  if (!hatDokument()) return sage('Kein Dokument geladen', { art: 'warn' });
  await mitLader('Dokument wird geschrieben …', async () => {
    await sichereDokument(optionen);
    if (optionen.metadatenEntfernen && zustand.eigenschaften) {
      zustand.eigenschaften.verfasser = '';
      zustand.eigenschaften.erzeuger = '';
    }
  });
  melde('dokument:geaendert');
}

/** Zwischenablage mit Rückfall, falls der Browser sie verweigert. */
async function inZwischenablage(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Ohne Erlaubnis bleibt der alte Weg über ein verstecktes Feld.
    const feld = el('textarea', { stil: { position: 'fixed', top: '-1000px' } });
    feld.value = text;
    document.body.append(feld);
    feld.select();
    let geklappt = false;
    try { geklappt = document.execCommand('copy'); } catch { geklappt = false; }
    feld.remove();
    if (!geklappt) sage('Der Browser lässt das Kopieren nicht zu', { art: 'warn' });
    return geklappt;
  }
}

const STEMPEL = [
  { text: 'Genehmigt', farbe: '#0D5A4D' },
  { text: 'Nicht genehmigt', farbe: '#A82E23' },
  { text: 'Entwurf', farbe: '#7E5300' },
  { text: 'Vertraulich', farbe: '#A82E23' },
  { text: 'Kopie', farbe: '#59666C' },
  { text: 'Erhalten', farbe: '#1B6AC9' },
];

function setzeStempel({ seiteId, x, y }) {
  const vorlage = el('select', { klasse: 'feld' }, ...STEMPEL.map((v, i) => el('option', { value: String(i), text: v.text })));
  const eigenerText = el('input', { klasse: 'feld', placeholder: 'oder eigener Text', stil: { flex: '1' } });
  const mitDatum = el('input', { type: 'checkbox' });

  zeigeDialog({
    titel: 'Stempel setzen',
    rumpf: el('div', {},
      zeile('Vorlage', vorlage),
      zeile('Eigener Text', eigenerText),
      el('div', { klasse: 'zeile' }, el('label', { text: 'Datum' }),
        el('label', { klasse: 'zeile-kasten' }, mitDatum, 'heutiges Datum anhängen')),
      el('p', { klasse: 'hinweis', text: 'Der Stempel wird beim Sichern in die Seite gezeichnet — er ist eine Aufschrift, keine Bestätigung durch Dritte.' })),
    knoepfe: [
      { beschriftung: 'Abbrechen' },
      {
        beschriftung: 'Setzen', betont: true,
        tun: () => {
          const gewaehlt = STEMPEL[Number(vorlage.value)];
          let text = eigenerText.value.trim() || gewaehlt.text;
          if (mitDatum.checked) text += ` ${new Date().toLocaleDateString('de-DE')}`;
          const groesse = 13;
          const breite = Math.max(120, text.length * groesse * 0.72 + 24);
          fuegeAn({
            art: 'stempel', seiteId,
            x, y: y - 34, b: breite, h: 34,
            text, groesse,
            farbe: eigenerText.value.trim() ? zustand.farbe : gewaehlt.farbe,
          });
        },
      },
    ],
  });
}

/* ---------- Stapel -------------------------------------------------------- */


/* ---------- Messen -------------------------------------------------------- */



/* ---------- Aus anderen Formaten ein PDF ---------------------------------- */


async function einlesenZuPdf(dateien) {
  const { ausDatei } = await import('./einlesen.js');
  const { oeffneBytes } = await import('./dokument.js');
  for (const datei of dateien) {
    let ergebnis;
    try {
      ergebnis = await mitLader(`${datei.name} wird gesetzt …`, () => ausDatei(datei));
    } catch { continue; }   // mitLader hat die Ursache schon gemeldet
    if (hatDokument()) neueMappe();
    await mitLader('Das Ergebnis wird geöffnet …', () => oeffneBytes(ergebnis.bytes, ergebnis.name));
    untersuche();
    sage(`${datei.name} umgewandelt — ${zustand.folge.length} Seiten`, {
      dauer: 6000,
      aktion: { beschriftung: 'gleich sichern', tun: () => sichereMit({ dateiname: ergebnis.name }) },
    });
  }
}

async function bilderZuPdf(dateien) {
  await mitLader('Bilder werden eingebettet …', async () => {
    const { starteSchreiber } = await import('./ausgabe.js');
    const pdflib = await starteSchreiber();
    const dokument = await pdflib.PDFDocument.create();
    let gezaehlt = 0;

    for (const datei of dateien) {
      const bytes = new Uint8Array(await datei.arrayBuffer());
      let bild;
      try {
        bild = /\.png$/i.test(datei.name) || datei.type === 'image/png'
          ? await dokument.embedPng(bytes)
          : await dokument.embedJpg(bytes);
      } catch (fehler) {
        sage(`${datei.name} ließ sich nicht einbetten (${fehler.message})`, { art: 'warn', dauer: 6000 });
        continue;
      }
      // Seite in Bildgröße, aber höchstens A4-Breite — sonst werden Fotos riesig.
      const hoechstBreite = 595.28;
      const massstab = Math.min(1, hoechstBreite / bild.width);
      const seite = dokument.addPage([bild.width * massstab, bild.height * massstab]);
      seite.drawImage(bild, { x: 0, y: 0, width: bild.width * massstab, height: bild.height * massstab });
      gezaehlt++;
    }
    if (!gezaehlt) throw new Error('Kein Bild ließ sich lesen.');
    dokument.setProducer('PDF Studio');
    sichereBytes(await dokument.save(), 'bilder.pdf');
    sage(`${gezaehlt} Bild${gezaehlt === 1 ? '' : 'er'} zu einem PDF gemacht`);
  });
}


/* ---------- Einstellungen ------------------------------------------------ */

/* Bis hierher hatte das Studio keine Einstellungen: alles war entweder fest
   oder ein Befehl. Das Handoff sieht acht Kategorien vor; hier stehen nur die,
   die wirklich etwas bewirken — ein Schalter ohne Wirkung ist eine Luege.

   Bewusst kein Browser-Speicher: die Einstellungen gelten fuer diese Sitzung.
   localStorage waere ein Datenspeicher, den niemand geloescht bekommt, und
   das Studio verspricht, nichts zu hinterlassen. */
export const EINSTELLUNGEN = {
  'anzeige.thema':        { kategorie: 'Anzeige & Lesen', name: 'Erscheinung', hinweis: 'Hell, dunkel oder nach Systemeinstellung', art: 'wahl', werte: [['system', 'System'], ['hell', 'Hell'], ['dunkel', 'Dunkel']], wert: 'system' },
  'anzeige.zoom':         { kategorie: 'Anzeige & Lesen', name: 'Zoom beim Öffnen', hinweis: 'Womit eine frisch geöffnete Datei beginnt', art: 'wahl', werte: [['breite', 'Breite'], ['seite', 'Ganze Seite'], ['1', '100 %']], wert: 'breite' },
  'anzeige.nummern':      { kategorie: 'Anzeige & Lesen', name: 'Seitenzahlen unter dem Blatt', hinweis: '', art: 'schalter', wert: true },

  'anmerkung.staerke':    { kategorie: 'Anmerkungen', name: 'Strichstärke', hinweis: 'Für Freihand, Rechteck, Ellipse, Pfeil', art: 'wahl', werte: [['1', 'Dünn'], ['2', 'Normal'], ['4', 'Dick']], wert: '2' },
  'anmerkung.groesse':    { kategorie: 'Anmerkungen', name: 'Schriftgröße für Textmarken', hinweis: 'In Punkt', art: 'wahl', werte: [['10', '10'], ['12', '12'], ['16', '16']], wert: '12' },

  'ocr.sprache':          { kategorie: 'OCR & Text', name: 'Sprache der Texterkennung', hinweis: '', art: 'wahl', werte: [['deu', 'Deutsch'], ['eng', 'Englisch']], wert: 'deu' },
  'ocr.dichte':           { kategorie: 'OCR & Text', name: 'Auflösung', hinweis: 'Höher ist genauer und langsamer', art: 'wahl', werte: [['150', '150 dpi'], ['200', '200 dpi'], ['300', '300 dpi']], wert: '200' },

  'schutz.metadaten':     { kategorie: 'Speicher & Privatsphäre', name: 'Metadaten beim Sichern entfernen', hinweis: 'Verfasser, Erzeuger, Stichwörter', art: 'schalter', wert: false },
  'schutz.warnen':        { kategorie: 'Speicher & Privatsphäre', name: 'Vor Weitergabe personenbezogener Angaben warnen', hinweis: '', art: 'schalter', wert: true },

  'mitdenken.an':         { kategorie: 'Allgemein', name: 'Hinweise zum Dokument zeigen', hinweis: 'Die Vorschläge in der rechten Leiste', art: 'schalter', wert: true },
  'mitdenken.hoechstens': { kategorie: 'Allgemein', name: 'Höchstens so viele Hinweise', hinweis: '', art: 'wahl', werte: [['3', '3'], ['6', '6'], ['12', '12']], wert: '6' },
};

/* Steht im Einstellungsdialog unter den Kategorien. */
export const FASSUNG = '2026.8';

export const KATEGORIEN = ['Allgemein', 'Anzeige & Lesen', 'Anmerkungen', 'OCR & Text', 'Signaturen', 'Speicher & Privatsphäre', 'Tastenkürzel'];

export function einstellung(schluessel) { return EINSTELLUNGEN[schluessel]?.wert; }


/* Eine Einstellung wirkt sofort — nicht erst nach „Übernehmen". Ein Schalter,
   der erst nach einem zweiten Knopfdruck etwas tut, wird zweimal gedrückt. */
export function wendeAn(schluessel) {
  const wert = EINSTELLUNGEN[schluessel].wert;
  if (schluessel === 'anzeige.thema') wendeThemaAn(wert);
  if (schluessel === 'anmerkung.staerke') zustand.strichstaerke = Number(wert);
  if (schluessel === 'anmerkung.groesse') zustand.schriftgroesse = Number(wert);
  if (schluessel === 'anzeige.nummern') document.documentElement.classList.toggle('ohne-seitenzahlen', !wert);
  if (schluessel === 'mitdenken.an' || schluessel === 'mitdenken.hoechstens') { untersuche(); zeichneRechteTafel(); }
}

/* ---------- Digital unterschreiben ------------------------------------------ */







function frageKennwort(name, wiederholung) {
  return new Promise((loese) => {
    const feld = el('input', { klasse: 'feld', type: 'password', stil: { flex: '1' }, placeholder: 'Kennwort' });
    const dialog = zeigeDialog({
      titel: wiederholung ? 'Kennwort stimmt nicht' : 'Datei ist geschützt',
      rumpf: el('div', {},
        el('p', { text: `„${name}" ist mit einem Kennwort verschlossen.` }),
        zeile('Kennwort', feld),
        el('p', { klasse: 'hinweis', text: 'Das Kennwort bleibt auf diesem Gerät. Die Datei wird nach dem Öffnen entschlüsselt weiterverarbeitet; beim Sichern lässt sich neuer Schutz setzen.' })),
      knoepfe: [
        { beschriftung: 'Abbrechen', tun: () => loese(null) },
        { beschriftung: 'Öffnen', betont: true, tun: () => loese(feld.value) },
      ],
      beiSchliessen: () => loese(null),
    });
    feld.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); schliesseDialog(); loese(feld.value); }
    });
    setTimeout(() => feld.focus(), 40);
    return dialog;
  });
}




/* ---------- Befehlspalette --------------------------------------------------- */


/* ---------- Suchtreffer hervorheben ------------------------------------------ */

export async function hebeTrefferHervor() {
  const treffer = trefferListe();
  if (!treffer.length) return sage('Erst suchen, dann hervorheben', { art: 'warn' });
  if (treffer.length > 300 && !await frage({
    titel: 'Viele Treffer',
    text: `${treffer.length} Treffer werden hervorgehoben. Das kann unübersichtlich werden.`,
    jaText: 'Trotzdem',
  })) return;

  await mitLader('Treffer werden hervorgehoben …', async () => {
    // Über die gezeichneten Textebenen gehen: nur dort sind Koordinaten bekannt.
    const offen = new Set(treffer.map((t) => t.seitenId));
    let gesetzt = 0;
    for (const seitenId of offen) {
      zeigeSeite(nummerVon(seitenId), { sanft: false });
      await new Promise((l) => setTimeout(l, 140));
      markiereAlle();
      const blattKnoten = document.querySelector(`.blatt[data-seite="${seitenId}"]`);
      const blatt = blattVon(seitenId);
      if (!blattKnoten || !blatt?.sicht) continue;
      const kasten = blattKnoten.getBoundingClientRect();
      const quads = [];
      for (const marke of blattKnoten.querySelectorAll('.textebene .treffer')) {
        const m = marke.getBoundingClientRect();
        if (m.width < 0.5) continue;
        const [x1, y1] = blatt.sicht.convertToPdfPoint(m.left - kasten.left, m.top - kasten.top);
        const [x2, y2] = blatt.sicht.convertToPdfPoint(m.right - kasten.left, m.bottom - kasten.top);
        quads.push({ x: Math.min(x1, x2), y: Math.min(y1, y2), b: Math.abs(x2 - x1), h: Math.abs(y2 - y1) });
      }
      if (!quads.length) continue;
      fuegeAn({ art: 'hervor', seiteId: seitenId, quads, farbe: zustand.farbe, text: suchbegriff() });
      gesetzt += quads.length;
    }
    sage(`${gesetzt} Stellen hervorgehoben`);
  });
}

/* ---------- Notiz- und Textbearbeitung ---------------------------------------- */

function bearbeiteNotiz(id) {
  const anmerkung = zustand.anmerkungen.find((a) => a.id === id);
  if (!anmerkung) return;
  const feld = el('textarea', { klasse: 'feld', rows: '5', stil: { width: '100%' }, placeholder: 'Notiz …' });
  feld.value = anmerkung.text || '';
  zeigeDialog({
    titel: 'Kommentar',
    rumpf: el('div', {}, feld),
    knoepfe: [
      { beschriftung: 'Löschen', gefahr: true, tun: () => entferne(id) },
      { beschriftung: 'Übernehmen', betont: true, tun: () => aendere(id, { text: feld.value }, 'Notiz geändert') },
    ],
  });
  setTimeout(() => { feld.focus(); feld.select(); }, 30);
}

/* ---------- Formularfeld anlegen -------------------------------------------- */

/* Acrobat nennt das „Formular vorbereiten". Der Rahmen steht schon; hier
   werden Art und Name bestimmt. Geschrieben wird das Feld erst beim Sichern —
   bis dahin ist es ein Platzhalter, den man verschieben und löschen kann. */
function neuesFeld(rahmen) {
  const vorhandene = new Set([
    ...zustand.formularfelder.map((f) => f.name),
    ...zustand.anmerkungen.filter((a) => a.art === 'feldneu').map((a) => a.name),
  ]);
  let vorschlag = `Feld ${vorhandene.size + 1}`;
  while (vorhandene.has(vorschlag)) vorschlag = `Feld ${Number(vorschlag.split(' ')[1]) + 1}`;

  const artwahl = el('select', { klasse: 'feld' },
    ...Object.entries(FELDARTEN).map(([wert, name]) => el('option', { value: wert, text: name })));
  const namensfeld = el('input', { klasse: 'feld', value: vorschlag, stil: { flex: '1' } });
  const optionenfeld = el('input', { klasse: 'feld', placeholder: 'Ja, Nein, Vielleicht', stil: { flex: '1' } });
  const pflicht = el('input', { type: 'checkbox' });

  const optionenZeile = el('div', { klasse: 'zeile', hidden: true },
    el('label', { text: 'Auswahl' }), optionenfeld);
  artwahl.addEventListener('change', () => {
    optionenZeile.hidden = !['auswahl', 'option'].includes(artwahl.value);
  });

  zeigeDialog({
    titel: 'Formularfeld anlegen',
    rumpf: el('div', {},
      zeile('Art', artwahl),
      zeile('Name', namensfeld),
      optionenZeile,
      el('div', { klasse: 'zeile' }, el('label', { text: 'Pflichtfeld' }),
        el('label', { klasse: 'zeile-kasten' }, pflicht, 'muss ausgefüllt werden')),
      el('p', { klasse: 'hinweis' },
        'Der Name steht später in der ausgefüllten Datei und muss im Dokument einmalig sein. ',
        'Das Feld wird beim Sichern geschrieben — bis dahin lässt sich der Rahmen verschieben und löschen. ',
        'Ein Unterschriftsfeld wird angelegt, aber nicht ausgefüllt: dafür braucht es ein Zertifikat.')),
    knoepfe: [
      { beschriftung: 'Abbrechen' },
      {
        beschriftung: 'Anlegen', betont: true,
        tun: () => {
          const name = namensfeld.value.trim();
          if (!name) return sage('Das Feld braucht einen Namen', { art: 'warn' });
          if (vorhandene.has(name)) return sage(`„${name}" gibt es schon`, { art: 'warn' });
          const optionen = optionenfeld.value.split(',').map((o) => o.trim()).filter(Boolean);
          if (['auswahl', 'option'].includes(artwahl.value) && optionen.length < 2) {
            return sage('Mindestens zwei Auswahlmöglichkeiten, mit Komma getrennt', { art: 'warn' });
          }
          fuegeAn({
            art: 'feldneu', seiteId: rahmen.seiteId,
            x: rahmen.x, y: rahmen.y, b: rahmen.b, h: rahmen.h,
            feldArt: artwahl.value, name, optionen, pflicht: pflicht.checked,
          });
          sage(`${FELDARTEN[artwahl.value]} „${name}" angelegt — wird beim Sichern geschrieben`);
        },
      },
    ],
  });
  setTimeout(() => { namensfeld.focus(); namensfeld.select(); }, 30);
}

/* Text bearbeiten — der Absatz, nicht der Lauf.

   Angeklickt wird ein Textstück; bearbeitet wird der Absatz, zu dem es
   gehört. Das ist der Unterschied zwischen „ersetzen" und „bearbeiten": wer
   ein Wort einfügt, will, dass der Rest nachrückt.

   Mit gedrückter Alt-Taste bleibt es beim einzelnen Lauf. Für eine Zahl in
   einer Tabellenzelle ist der Absatz zu viel — und die Zelle ist ohnehin
   kein Absatz, sondern eine Zeile für sich.

   Vor dem Übernehmen steht da, wieviele Zeilen es werden. Ein Absatz, der um
   zwei Zeilen wächst, überdeckt, was darunter steht — das gehört gesagt,
   bevor es passiert, nicht danach. */
async function ersetzeText(stelle) {
  const eintrag = zustand.folge.find((e) => e.id === stelle.seiteId);
  let absatz = null;
  if (!stelle.nurDieserLauf && eintrag) {
    try {
      const { absaetzeDerSeite, absatzAn } = await import('./absaetze.js');
      const absaetze = await absaetzeDerSeite(eintrag);
      absatz = absatzAn(absaetze, { x: stelle.x + stelle.b / 2, y: stelle.y + stelle.h / 2 });
    } catch (fehler) {
      console.warn('Absätze ließen sich nicht lesen:', fehler?.message);
    }
  }

  /* Fällt die Absatzsuche aus, bleibt der einzelne Lauf — die Bearbeitung
     muss auch dann gehen, wenn die Seite sich nicht lesen lässt. */
  const ziel = absatz
    ? { ...absatz, seiteId: stelle.seiteId, grundfarbe: stelle.grundfarbe, schriftfarbe: stelle.schriftfarbe }
    : { ...stelle, zeilenzahl: 1, grad: stelle.groesse, zeilenhoehe: null, ausrichtung: 'links' };

  const feld = el('textarea', {
    klasse: 'feld', rows: String(Math.min(10, Math.max(2, ziel.zeilenzahl + 1))),
    stil: { width: '100%', resize: 'vertical' },
  });
  feld.value = ziel.text;
  const groesse = el('input', {
    type: 'number', klasse: 'feld', step: '0.5', min: '3', max: '96',
    value: (ziel.grad || stelle.groesse).toFixed(1), stil: { width: '6rem' },
  });
  const rastern = el('input', { type: 'checkbox' });
  const umbruchStand = el('p', { klasse: 'hinweis' });

  /* Dieselbe Umbruchrechnung wie in der Ausgabe — die Breite misst hier
     der Browser, dort Helvetica aus pdf-lib. Der Unterschied liegt unter
     einem Prozent; für eine Warnung reicht das. */
  const messer = document.createElement('canvas').getContext('2d');
  const zeigeUmbruch = async () => {
    if (!ziel.zeilenhoehe) { umbruchStand.textContent = 'Ein Textstück, eine Zeile — es wird nicht umgebrochen.'; return; }
    const { umbricht } = await import('./absaetze.js');
    const grad = Number(groesse.value) || ziel.grad;
    messer.font = `${grad}px Helvetica, Arial, sans-serif`;
    const zeilen = umbricht(feld.value, ziel.b, grad, (t) => messer.measureText(t).width);
    const mehr = zeilen.length - ziel.zeilenzahl;
    umbruchStand.textContent = mehr === 0
      ? `${zeilen.length} Zeilen — genau so viele wie vorher.`
      : mehr > 0
        ? `${zeilen.length} Zeilen, ${mehr} mehr als vorher — der Absatz wächst nach unten und überdeckt, was dort steht.`
        : `${zeilen.length} Zeilen, ${-mehr} weniger als vorher — darunter bleibt eine Lücke.`;
    umbruchStand.classList.toggle('ist-warnung', mehr > 0);
  };
  feld.addEventListener('input', zeigeUmbruch);
  groesse.addEventListener('input', zeigeUmbruch);
  zeigeUmbruch();

  zeigeDialog({
    titel: ziel.zeilenhoehe ? 'Absatz bearbeiten' : 'Textstück ersetzen',
    breit: !!ziel.zeilenhoehe,
    fussHinweis: ziel.zeilenhoehe
      ? `${ziel.zeilenzahl} Zeilen, ${Math.round(ziel.b)} pt breit, ${AUSRICHTUNG[ziel.ausrichtung] || 'linksbündig'}`
      : 'Alt beim Klicken bearbeitet nur das angeklickte Stück.',
    rumpf: el('div', {},
      zeile('Text', feld),
      umbruchStand,
      zeile('Schriftgröße', groesse, el('span', { klasse: 'hinweis', text: 'pt' })),
      el('div', { klasse: 'zeile' }, el('label', { text: 'Alten Text' }),
        el('label', { klasse: 'zeile-kasten' }, rastern, 'wirklich entfernen (Seite wird zum Bild)')),
      el('p', { klasse: 'hinweis' },
        'Ohne Haken wird der alte Text überdeckt und neu gesetzt — er steckt dann noch in der Datei und ließe sich auslesen. ',
        'Mit Haken wird die Seite gerastert: der alte Text ist wirklich fort, dafür ist die restliche Seite danach ein Bild.'),
      ziel.zeilenhoehe
        ? el('p', { klasse: 'hinweis' },
          'Der Absatz wird in Helvetica neu gesetzt und dabei umgebrochen. ',
          'Fette und kursive Stellen innerhalb des Absatzes gehen dabei verloren — beim Umbrechen ',
          'verschieben sie sich, und geraten ist schlechter als weggelassen.')
        : null),
    knoepfe: [
      { beschriftung: 'Abbrechen' },
      {
        beschriftung: ziel.zeilenhoehe ? 'Absatz ersetzen' : 'Ersetzen', betont: true,
        tun: () => {
          if (!feld.value.length) return;
          fuegeAn({
            art: 'ersatz', seiteId: stelle.seiteId,
            x: ziel.x, y: ziel.y, b: ziel.b, h: ziel.h,
            text: feld.value, alt: ziel.text,
            groesse: Number(groesse.value) || ziel.grad || stelle.groesse,
            zeilenhoehe: ziel.zeilenhoehe,
            ausrichtung: ziel.ausrichtung === 'blocksatz' ? 'links' : ziel.ausrichtung,
            grundfarbe: stelle.grundfarbe, schriftfarbe: stelle.schriftfarbe,
            rastern: rastern.checked,
          });
        },
      },
    ],
  });
  setTimeout(() => { feld.focus(); feld.select(); }, 30);
}

const AUSRICHTUNG = {
  links: 'linksbündig', mitte: 'zentriert', rechts: 'rechtsbündig', blocksatz: 'Blocksatz',
};

/** Momentaufnahme: der gezogene Bereich wird als Bild abgelichtet. */
async function nimmBereichAuf({ seiteId, x, y, b, h }) {
  const eintrag = zustand.folge.find((e) => e.id === seiteId);
  if (!eintrag) return;
  await mitLader('Bereich wird abgelichtet …', async () => {
    const { holeSeite } = await import('./dokument.js');
    const seite = await holeSeite(eintrag);
    const dichte = 3;
    const sicht = seite.getViewport({ scale: dichte, rotation: (seite.rotate + eintrag.drehung) % 360 });
    const ganz = document.createElement('canvas');
    ganz.width = Math.ceil(sicht.width);
    ganz.height = Math.ceil(sicht.height);
    const stift = ganz.getContext('2d');
    stift.fillStyle = '#fff';
    stift.fillRect(0, 0, ganz.width, ganz.height);
    await seite.render({ canvasContext: stift, viewport: sicht }).promise;

    const [x1, y1] = sicht.convertToViewportPoint(x, y);
    const [x2, y2] = sicht.convertToViewportPoint(x + b, y + h);
    const links = Math.max(0, Math.min(x1, x2));
    const oben = Math.max(0, Math.min(y1, y2));
    const breite = Math.min(ganz.width - links, Math.abs(x2 - x1));
    const hoehe = Math.min(ganz.height - oben, Math.abs(y2 - y1));

    const ausschnitt = document.createElement('canvas');
    ausschnitt.width = Math.max(1, Math.round(breite));
    ausschnitt.height = Math.max(1, Math.round(hoehe));
    ausschnitt.getContext('2d').drawImage(ganz, links, oben, breite, hoehe, 0, 0, ausschnitt.width, ausschnitt.height);

    const blob = await new Promise((loese) => ausschnitt.toBlob(loese, 'image/png'));
    let inAblage = false;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      inAblage = true;
    } catch { inAblage = false; }

    const name = vorschlagsname(`-ausschnitt-s${nummerVon(seiteId)}`).replace(/\.pdf$/i, '.png');
    sage(inAblage ? `Bereich in der Zwischenablage (${ausschnitt.width}×${ausschnitt.height})` : 'Bereich abgelichtet', {
      dauer: 7000,
      aktion: { beschriftung: 'als PNG sichern', tun: async () => sichereBytes(await blob.arrayBuffer(), name, 'image/png') },
    });
  });
}

function neuerText({ seiteId, x, y }) {
  const feld = el('textarea', { klasse: 'feld', rows: '4', stil: { width: '100%' }, placeholder: 'Text …' });
  zeigeDialog({
    titel: 'Text einsetzen',
    rumpf: el('div', {}, feld, el('p', { klasse: 'hinweis', text: 'Der Text wird über die Seite gelegt. Bestehender Fließtext im PDF bleibt unverändert.' })),
    knoepfe: [
      { beschriftung: 'Abbrechen' },
      {
        beschriftung: 'Einsetzen', betont: true,
        tun: () => {
          if (!feld.value.trim()) return;
          fuegeAn({ art: 'text', seiteId, x, y, text: feld.value, farbe: zustand.farbe, groesse: zustand.schriftgroesse, breite: 260 });
        },
      },
    ],
  });
  setTimeout(() => feld.focus(), 30);
}

/* ---------- Tastatur ---------------------------------------------------------- */

function istEingabe(knoten) {
  return knoten && (knoten.tagName === 'INPUT' || knoten.tagName === 'TEXTAREA' || knoten.tagName === 'SELECT' || knoten.isContentEditable);
}

function starteTastatur() {
  document.addEventListener('keydown', (e) => {
    const steuerung = e.ctrlKey || e.metaKey;

    if (e.key === 'Escape') {
      if (!$('#schirm').hidden) { schliesseDialog(); return; }
      if (zustand.gewaehlteAnmerkung) { waehleAn(null); return; }
      if (zustand.werkzeug !== 'auswahl') { setzeWerkzeug('auswahl'); return; }
      return;
    }

    if (steuerung && e.key.toLowerCase() === 'k') { e.preventDefault(); zeigePalette(); return; }
    if (steuerung && e.key.toLowerCase() === 'o') { e.preventDefault(); fuehreAus('datei:oeffnen'); return; }
    if (steuerung && e.key.toLowerCase() === 's') { e.preventDefault(); fuehreAus(e.shiftKey ? 'sichern:als' : 'sichern'); return; }
    if (steuerung && e.key.toLowerCase() === 'f') { e.preventDefault(); fuehreAus('suchen'); return; }
    if (steuerung && e.key.toLowerCase() === 'g') { e.preventDefault(); fuehreAus('gehezu:seite'); return; }
    if (steuerung && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? schrittVor() : schrittZurueck(); return; }
    if (steuerung && e.key.toLowerCase() === 'y') { e.preventDefault(); schrittVor(); return; }
    if (steuerung && (e.key === '+' || e.key === '=')) { e.preventDefault(); zoomeSchritt(1); return; }
    if (steuerung && (e.key === '-' || e.key === '_')) { e.preventDefault(); zoomeSchritt(-1); return; }
    if (steuerung && e.key === '0') { e.preventDefault(); fuehreAus('ansicht:breite'); return; }
    if (steuerung && e.shiftKey && e.key.toLowerCase() === 'r') { e.preventDefault(); dreheAnsicht(90); return; }
    if (steuerung && e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault(); drehe(e.key === 'ArrowLeft' ? -90 : 90); return;
    }
    if (steuerung && e.key.toLowerCase() === 'a' && !istEingabe(e.target)) { e.preventDefault(); fuehreAus('seiten:alleWaehlen'); return; }
    if (e.key === 'F1') { e.preventDefault(); zeigeHilfe(); return; }
    if (e.key === 'F4') { e.preventDefault(); fuehreAus('leiste:umschalten'); return; }
    if (e.key === 'F5' && !steuerung) { e.preventDefault(); fuehreAus('leiste:rechtsUmschalten'); return; }

    if (istEingabe(e.target) || steuerung || e.altKey) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (zustand.gewaehlteAnmerkung) { e.preventDefault(); entferne(zustand.gewaehlteAnmerkung); return; }
      if (zustand.gewaehlteSeiten.size) { e.preventDefault(); loesche(); return; }
    }
    if (e.key === 'PageDown' || (e.key === 'ArrowRight' && zustand.zoom === 'seite')) { e.preventDefault(); zeigeSeite(zustand.aktuelleSeite + 1); return; }
    if (e.key === 'PageUp' || (e.key === 'ArrowLeft' && zustand.zoom === 'seite')) { e.preventDefault(); zeigeSeite(zustand.aktuelleSeite - 1); return; }
    if (e.key === 'Home') { e.preventDefault(); zeigeSeite(1); return; }
    if (e.key === 'End') { e.preventDefault(); zeigeSeite(zustand.folge.length); return; }

    const werkzeug = WERKZEUGE.find((w) => w.kuerzel.toLowerCase() === e.key.toLowerCase());
    if (werkzeug) {
      e.preventDefault();
      // Steht Text markiert bereit, wird gleich angewandt statt nur umgeschaltet.
      const auswahl = window.getSelection();
      if (!auswahl.isCollapsed && ['hervor', 'unterstrich', 'durchstrich'].includes(werkzeug.id)) {
        uebernehmeAuswahl(werkzeug.id);
        return;
      }
      setzeWerkzeug(werkzeug.id);
    }
  });
}

/* ---------- Anschluss ---------------------------------------------------------- */

export function starteOberflaeche() {
  baueBefehle();
  starteMappen();
  starteAnsicht();
  starteSeiten();
  starteOrdnen();
  starteMenue();
  starteSuche();
  starteMitdenken();
  setzeSichtHoler((seitenId) => blattVon(seitenId)?.sicht || null);
  starteWerkzeuge($('#spur'), zuPdfPunkt);
  starteTastatur();
  setzeKennwortFrager(frageKennwort);
  zeichneWerkzeugleiste();

  // Kopf und Fuß
  $('#knopf-seitenleiste').addEventListener('click', () => fuehreAus('leiste:umschalten'));
  $('#knopf-befehle').addEventListener('click', zeigePalette);
  $('#knopf-sichern').addEventListener('click', () => fuehreAus('sichern'));
  $('#knopf-fokus-aus').addEventListener('click', () => setzeFokus(false));
  $('#knopf-einstellungen').addEventListener('click', zeigeEinstellungen);
  $('#knopf-einfuegen').addEventListener('click', () => fuehreAus('datei:anhaengen'));
  $('#knopf-aufteilen').addEventListener('click', () => fuehreAus('teilen'));
  $('#knopf-zurueck').addEventListener('click', () => zeigeSeite(zustand.aktuelleSeite - 1));
  $('#knopf-vor').addEventListener('click', () => zeigeSeite(zustand.aktuelleSeite + 1));
  $('#knopf-kleiner').addEventListener('click', () => zoomeSchritt(-1));
  $('#knopf-groesser').addEventListener('click', () => zoomeSchritt(1));
  $('#knopf-drehen').addEventListener('click', () => dreheAnsicht(90));
  $('#knopf-thema').addEventListener('click', wechsleThema);
  $('#feld-zoom').addEventListener('change', (e) => setzeZoom(e.target.value));
  $('#feld-seite').addEventListener('change', (e) => {
    const nummer = Math.max(1, Math.min(zustand.folge.length, Number(e.target.value) || 1));
    zeigeSeite(nummer);
  });

  // Reiter links
  $$('#reiter-links .reiter-knopf').forEach((knopf) => {
    knopf.addEventListener('click', () => zeigeLeiste('links', knopf.dataset.tafel));
  });

  // Reiter rechts
  $$('#reiter-rechts .reiter-knopf').forEach((knopf) => {
    knopf.addEventListener('click', () => zeigeRechteTafel(knopf.dataset.rtafel));
  });

  // Dateiwahl
  $('#dateiwahl').addEventListener('change', async (e) => {
    if (e.target.files?.length) await oeffne(e.target.files, false);
    e.target.value = '';
  });
  $('#dateiwahl-anhang').addEventListener('change', async (e) => {
    if (e.target.files?.length) await oeffne(e.target.files, true);
    e.target.value = '';
  });
  $('#dateiwahl-vergleich').addEventListener('change', async (e) => {
    const datei = e.target.files?.[0];
    e.target.value = '';
    if (datei) await mitLader('Vergleich läuft …', () => vergleicheMitDatei(datei));
  });
  $('#dateiwahl-bilder').addEventListener('change', async (e) => {
    const dateien = [...(e.target.files || [])];
    e.target.value = '';
    if (dateien.length) await bilderZuPdf(dateien);
  });
  $('#dateiwahl-einlesen').addEventListener('change', async (e) => {
    const dateien = [...(e.target.files || [])];
    e.target.value = '';
    if (dateien.length) await einlesenZuPdf(dateien);
  });
  $('#knopf-oeffnen').addEventListener('click', () => $('#dateiwahl').click());
  $('#knopf-beispiel').addEventListener('click', () => mitLader('Beispiel wird geladen …', ladeBeispiel));

  // Ziehen und Ablegen
  let ziehZaehler = 0;
  window.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    ziehZaehler++;
    $('#ablegeschirm').hidden = false;
  });
  window.addEventListener('dragover', (e) => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); });
  window.addEventListener('dragleave', () => { if (--ziehZaehler <= 0) { ziehZaehler = 0; $('#ablegeschirm').hidden = true; } });
  window.addEventListener('drop', async (e) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    ziehZaehler = 0;
    $('#ablegeschirm').hidden = true;
    await oeffne(e.dataTransfer.files, hatDokument());
  });

  $('#schirm').addEventListener('click', (e) => { if (e.target.id === 'schirm') schliesseDialog(); });

  // Ereignisse der Module
  hoer('befehl', (id) => fuehreAus(id));
  hoer('dokument:geladen', () => {
    $('#huelle').hidden = false;
    $('#empfang').hidden = true;
    zeichneGliederung();
    zeichneDateientafel();
    zeichneRechteTafel();
    zeichneRechteTafeln();
    aktualisiereFuss();
  });
  /* Die Dateienliste zeigt, wie viele Seiten je Quelle noch im Dokument
     stehen — nach jedem Löschen oder Anhängen ist das eine andere Zahl. */
  hoer('seiten:geaendert', zeichneDateientafel);
  hoer('dokument:geaendert', zeichneDateientafel);
  hoer('dokument:geaendert', () => {
    ($('#titel-zusatz') || {}).textContent = `${zustand.folge.length} Seiten${zustand.geaendert ? ' · ungesichert' : ''}${zustand.quellen.size > 1 ? ` · ${zustand.quellen.size} Quellen` : ''}`;
    zeichneRechteTafel();
  });
  hoer('seite:gewechselt', aktualisiereFuss);
  hoer('mappen:geaendert', zeichneDokumentreiter);
  /* Ein Vergleich gilt für das Dokument, in dem er begonnen wurde. */
  hoer('dokument:geladen', () => { if (vergleichOffen()) schliesseVergleich(); });
  hoer('dokument:geladen', zeichneDokumentreiter);
  hoer('dokument:geaendert', zeichneDokumentreiter);
  hoer('werkzeug:gewechselt', aktualisiereFuss);
  hoer('historie:geaendert', () => { aktualisiereRueckgaengig(); zeichneVerlauftafel(); });
  hoer('auswahl:geaendert', aktualisiereFuss);
  hoer('ordnen:auszug', async () => {
    const ids = gewaehlteOderAktuelle();
    schliesseOrdnen();
    await mitLader('Seiten werden ausgegeben …', () => seitenAusgeben(ids, vorschlagsname('-auszug')));
  });
  hoer('zoom:geaendert', aktualisiereZoomAnzeige);
  hoer('ansicht:neu', aktualisiereZoomAnzeige);
  hoer('seiten:geaendert', () => { aktualisiereFuss(); zeichneRechteTafel(); zeichneRechteTafeln(); });
  hoer('seiten:springe', (nummer) => zeigeSeite(nummer));
  hoer('anmerkungen:geaendert', () => { zeichneRechteTafel(); zeichneRechteTafeln(); });
  hoer('anmerkung:gewaehlt', () => { zeichneRechteTafel(); zeichneKommentartafel(); });
  hoer('anmerkung:bearbeiten', bearbeiteNotiz);
  hoer('anmerkung:neuerText', neuerText);
  hoer('anmerkung:textErsetzen', ersetzeText);
  hoer('anmerkung:neuesFeld', neuesFeld);
  hoer('anmerkung:stempel', setzeStempel);
  hoer('bereich:aufgenommen', nimmBereichAuf);
  hoer('suche:geaendert', zeichneSuchergebnisse);
  hoer('mitdenken:geaendert', zeichneRechteTafel);
  hoer('ocr:geaendert', () => { zeichneRechteTafel(); aktualisiereFuss(); });
  hoer('formular:geaendert', () => { zeichneRechteTafel(); zeichneFeldertafel(); });
  hoer('werkzeug:gewechselt', zeichneWerkzeugleiste);
  /* Vom Betriebssystem hereingereicht („Öffnen mit → PDF Studio"). Derselbe
     Weg wie der Dateiwähler — es gibt keinen zweiten Eingang. */
  hoer('dateien:hereingereicht', (dateien) => oeffne(dateien, false));
  /* Der Stand in der Fußzeile ändert sich genau dann, wenn sich am Dienst
     oder an der Installation etwas tut. */
  const standAnzeige = $('#fuss-stand');
  if (standAnzeige) {
    zeichneStand(standAnzeige);
    for (const ereignis of ['installieren:moeglich', 'installieren:erledigt', 'installieren:beantwortet']) {
      hoer(ereignis, () => zeichneStand(standAnzeige));
    }
    navigator.serviceWorker?.addEventListener?.('controllerchange', () => zeichneStand(standAnzeige));
  }
  starteInstallieren();
  // Klick in ein Unterschriftsfeld: anlegen und gleich passend einsetzen —
  // niemand soll danach noch einen Rahmen aufziehen müssen.
  hoer('unterschrift:anfordern', ({ seiteId, rechteck }) => {
    zeigeUnterschriftDialog((bild) => {
      const [x1, y1, x2, y2] = rechteck;
      const breite = Math.abs(x2 - x1), hoehe = Math.abs(y2 - y1);
      const passendeHoehe = Math.min(hoehe, breite / bild.verhaeltnis);
      fuegeAn({
        art: 'unterschrift', seiteId,
        x: Math.min(x1, x2), y: Math.min(y1, y2) + (hoehe - passendeHoehe) / 2,
        b: Math.min(breite, passendeHoehe * bild.verhaeltnis), h: passendeHoehe,
        bild: bild.datenUrl,
      });
      sage('Unterschrift eingesetzt');
    });
  });
  hoer('tafel:auffrischen', () => { /* Platz für spätere Anzeigen */ });

  window.addEventListener('beforeunload', (e) => {
    if (!zustand.geaendert) return;
    e.preventDefault();
    e.returnValue = '';
  });

  zeichneSuchtafel();
  wendeThemaAn(localStorage_lesen());

  /* Erst jetzt sind die Knöpfe verdrahtet. Vorher stehen sie abgeblendet da —
     ein Klick ins Leere, während das Programm noch lädt, ist ärgerlicher als
     eine Sekunde Warten. */
  for (const knopf of [$('#knopf-oeffnen'), $('#knopf-beispiel')]) knopf?.removeAttribute('disabled');
}

async function oeffne(dateien, anhaengen) {
  /* Wer eine Word-Datei ins Studio zieht, will sie sehen — nicht die
     Meldung „Keine PDF-Datei dabei". Was sich einlesen lässt, wird eingelesen,
     der Rest geht den gewohnten Weg. */
  const { istEingangsformat } = await import('./einlesen.js');
  const alle = [...dateien];
  const fremde = alle.filter((d) => istEingangsformat(d.name));
  const pdfs = alle.filter((d) => !fremde.includes(d));
  if (fremde.length) {
    await einlesenZuPdf(fremde);
    if (!pdfs.length) return;
  }
  dateien = pdfs;

  /* „Datei oeffnen" ersetzt nicht mehr, was offen ist: es kommt ein Reiter
     dazu. Nur in eine leere Mappe wird direkt geladen. */
  if (!anhaengen && hatDokument()) neueMappe();
  await mitLader(anhaengen ? 'Datei wird angehängt …' : 'Datei wird geöffnet …', async () => {
    await oeffneDateien(dateien, { anhaengen });
    if (anhaengen) { await ermittleFormularfelder(); await ermittleMerkmale(); untersuche(); melde('seiten:geaendert'); }
  });
  sage(anhaengen ? 'Angehängt' : `${zustand.name} geöffnet`);
}

/** Haelt das Auswahlfeld am tatsaechlichen Zoom — auch nach Strg+/-. */
function aktualisiereZoomAnzeige() {
  const feld = $('#feld-zoom');
  if (!feld) return;
  const wert = String(zustand.zoom);
  let eigene = feld.querySelector('option[data-eigen]');
  if (wert === 'breite' || wert === 'seite' || [...feld.options].some((o) => o.value === wert && !o.dataset.eigen)) {
    eigene?.remove();
    feld.value = wert;
    return;
  }
  if (!eigene) {
    eigene = el('option', { daten: { eigen: '1' } });
    feld.append(eigene);
  }
  eigene.value = wert;
  eigene.textContent = `${Math.round(Number(wert) * 100)} %`;
  feld.value = wert;
}

function aktualisiereFuss() {
  $('#feld-seite').value = String(zustand.aktuelleSeite);
  $('#anzeige-seitenzahl').textContent = String(zustand.folge.length);
  const melder = $('#fuss-melder');
  const teile = [];
  if (zustand.gewaehlteSeiten.size) teile.push(`${zustand.gewaehlteSeiten.size} Seiten gewählt`);
  if (zustand.anmerkungen.length) teile.push(`${zustand.anmerkungen.length} Anmerkungen`);
  if (befunde.gescannt) teile.push('Scan ohne Textebene');
  melder.textContent = teile.join(' · ');

  const stand = $('#menue-stand');
  if (stand) {
    stand.textContent = zustand.folge.length
      ? `${zustand.name} · ${zustand.folge.length} Seiten · ${zustand.geaendert ? 'geändert' : 'gesichert'}`
      : '';
  }
  const format = $('#fuss-format');
  if (format) {
    const eintrag = zustand.folge[zustand.aktuelleSeite - 1];
    format.textContent = eintrag ? seitenformat(eintrag) : '–';
  }
  const werkzeugfeld = $('#fuss-werkzeug');
  if (werkzeugfeld) {
    const werkzeug = WERKZEUGE.find((w) => w.id === zustand.werkzeug);
    werkzeugfeld.textContent = werkzeug ? `Werkzeug: ${werkzeug.name}` : '';
  }
  aktualisiereRueckgaengig();
  aktualisiereFokusanzeige();
}

/* „A4 · 210 × 297 mm" im Fuß: die Blattgroesse ist die Angabe, nach der in
   einer Sitzung am haeufigsten gefragt wird. Ein PDF-Punkt ist 1/72 Zoll. */
const BLATTMASSE = [
  { name: 'A4', b: 210, h: 297 }, { name: 'A3', b: 297, h: 420 },
  { name: 'A5', b: 148, h: 210 }, { name: 'Letter', b: 216, h: 279 },
  { name: 'Legal', b: 216, h: 356 },
];
/* Die Masse kommen aus der Ansicht, die die Seite ohnehin schon vermessen
   hat — ein zweiter, asynchroner Weg dafuer waere im Fuss zu langsam. */
function seitenformat(eintrag) {
  const blatt = blattVon(eintrag.id);
  const skala = blatt?.skala;
  const knoten = blatt?.knoten;
  if (!knoten || !skala) return '–';
  const mm = (punkte) => Math.round(punkte * 25.4 / 72);
  const b = mm(knoten.offsetWidth / skala), h = mm(knoten.offsetHeight / skala);
  const quer = b > h;
  const [kurz, lang] = quer ? [h, b] : [b, h];
  const treffer = BLATTMASSE.find((m) => Math.abs(m.b - kurz) <= 2 && Math.abs(m.h - lang) <= 2);
  return `${treffer ? `${treffer.name}${quer ? ' quer' : ''} · ` : ''}${b} × ${h} mm`;
}

/* Zwei Knöpfe, die vorher nur als Tastenkombination existierten. Ein Mensch,
   der einen Fehler gemacht hat, sucht einen Knopf, keine Kombination. */
function aktualisiereRueckgaengig() {
  /* Die beiden Knöpfe stehen in der Werkzeugzeile und werden mit ihr
     gezeichnet — Zustand und Tooltip entstehen dort. */
  zeichneWerkzeugleiste();
}

/* ---------- Nur gewählte Seiten zeigen -------------------------------------- */

/* „Fokussieren" heißt: die übrigen Seiten treten zurück, bleiben aber im
   Dokument. Deshalb wird nichts gelöscht und nichts umsortiert — die Ansicht
   blendet aus. Damit niemand vergisst, dass er nur einen Ausschnitt sieht,
   steht es im Fuß, mit dem Weg zurück daneben. */
export function setzeFokus(an) {
  if (an && !zustand.gewaehlteSeiten.size) {
    sage('Erst Seiten wählen — in der Seitenleiste oder unter „Seiten ordnen"', { art: 'warn' });
    return;
  }
  zustand.nurAuswahl = !!an;
  melde('fokus:geaendert');
  baueNeu({ haltePosition: true });
  aktualisiereFokusanzeige();
  sage(an
    ? `Nur ${zustand.gewaehlteSeiten.size} von ${zustand.folge.length} Seiten sichtbar`
    : 'Wieder alle Seiten sichtbar');
}

function aktualisiereFokusanzeige() {
  const kasten = $('#fuss-fokus');
  if (!kasten) return;
  const an = !!zustand.nurAuswahl && zustand.gewaehlteSeiten.size > 0;
  kasten.hidden = !an;
  if (an) $('#fokus-text').textContent = `Nur ${zustand.gewaehlteSeiten.size} von ${zustand.folge.length} Seiten`;
}

/* ---------- Thema ------------------------------------------------------------- */

function localStorage_lesen() {
  // Bewusst kein Browser-Speicher: das Thema folgt dem System, bis es
  // in dieser Sitzung umgestellt wird.
  return document.documentElement.dataset.thema || 'system';
}

function wendeThemaAn(thema) { document.documentElement.dataset.thema = thema; }

function wechsleThema() {
  const jetzt = document.documentElement.dataset.thema;
  const dunkelAktiv = jetzt === 'dunkel' || (jetzt === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  wendeThemaAn(dunkelAktiv ? 'hell' : 'dunkel');
}
