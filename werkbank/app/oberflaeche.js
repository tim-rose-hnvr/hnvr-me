/* Oberfläche — Verdrahtung: Werkzeugleiste, Tafeln, Befehle, Tastatur.

   Alles, was die Werkbank kann, ist ein Befehl mit Kennung. Werkzeugleiste,
   Befehlspalette, Tastenkürzel und die Vorschläge des Mitdenkens rufen
   denselben Befehl auf — es gibt keine Fähigkeit, die nur über einen Weg
   erreichbar wäre. */

import {
  zustand, melde, hoer, $, $$, el, sage, zeigeDialog, schliesseDialog, frage,
  merkeSchritt, schrittZurueck, schrittVor, groesse, datum, mitLader, sichereBytes,
} from './kern.js';
import {
  oeffneDateien, ladeBeispiel, hatDokument, nummerVon, seitenText, ermittleFormularfelder, ermittleMerkmale,
  setzeKennwortFrager,
} from './dokument.js';
import {
  starteAnsicht, baueNeu, zeigeSeite, bringeInSicht, setzeZoom, zoomeSchritt, dreheAnsicht,
  zuPdfPunkt, blattVon, aktuelleSkala,
} from './ansicht.js';
import {
  WERKZEUGE, FARBEN, FELDARTEN, starteWerkzeuge, setzeSichtHoler, anmerkungsListe, fuegeAn, entferne,
  aendere, waehleAn, uebernehmeAuswahl, bezeichne, hatUnterschrift,
} from './anmerkungen.js';
import { starteSeiten, drehe, loesche, verdopple, gewaehlteOderAktuelle } from './seiten.js';
import { starteOrdnen, umschalteOrdnen, schliesseOrdnen } from './ordnen.js';
import { starteMenue } from './menue.js';
import { starteMappen, mappenListe, neueMappe, wechsleZu, schliesse as schliesseMappe, frischeAuf as frischeMappen } from './mappen.js';
import { starteSuche, suche, trefferListe, weiter, zurueck, leere as leereSuche, markiereAlle, suchbegriff, textAusgeben } from './suche.js';
import { formularTafel, zumNaechstenFeld, hatFormular, offeneFelder } from './formulare.js';
import { zeigeUnterschriftDialog } from './unterschrift.js';
import { starteMitdenken, tafelMitdenken, befunde, musterListe, untersuche } from './mitdenken.js';
import { sichereDokument, seitenAusgeben, teileDokument, seiteAlsBild, istUnveraendertesGeruest, vorschlagsname, baueDokument, verkleinere } from './ausgabe.js';
import { zeigeErkennungsDialog, erkennungsUebersicht } from './texterkennung.js';
import { alsWord } from './word.js';
import { alsExcel } from './excel.js';
import { pruefe as pruefeZugang, SPRACHEN } from './barrierefrei.js';
import { oeffneAusweis } from './signieren.js';
import { textDerSeite } from './dokument.js';
import { vergleicheMitDatei } from './vergleich.js';

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
          el('pre', { klasse: 'vergleich-spalte', text: text || 'Keine Verschlüsselung.' })),
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

/* Die Werkzeugzeile nach dem Handoff: Sinnbild **und** Beschriftung, in vier
   Gruppen getrennt, und rechts eine Gruppe, die beim Scrollen stehen bleibt.
   Nur Sinnbilder waren die stille Annahme, jeder kenne sie schon. */
/* Beschriftet werden die Werkzeuge, nach denen jemand sucht. Die Formen
   (Rechteck, Ellipse, Pfeil) tragen nur ihr Sinnbild: sie sind selbsterklärend
   und würden die Zeile sonst auf zwei Bildschirmbreiten dehnen. */
const WERKZEUGGRUPPEN = [
  [['auswahl', true], ['text', true]],
  [['hervor', true], ['unterstrich', false], ['durchstrich', false], ['notiz', true]],
  [['freihand', false], ['rechteck', false], ['ellipse', false], ['pfeil', false]],
  [['ersetzen', true], ['schwaerzen', true]],
  [['feld', true], ['unterschrift', true], ['stempel', false], ['bereich', false]],
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
     hinter das, was die Werkbank schon konnte. */
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

  WERKZEUGGRUPPEN.forEach((gruppe, i) => {
    for (const [id, beschriftet] of gruppe) {
      const werkzeug = WERKZEUGE.find((w) => w.id === id);
      if (!werkzeug) continue;
      const aktiv = zustand.werkzeug === werkzeug.id;
      const knopf = el('button', {
        klasse: `werkzeug ${beschriftet ? '' : 'werkzeug-schmal'} ${aktiv ? 'ist-aktiv' : ''}`,
        title: `${werkzeug.name} (${werkzeug.kuerzel})`,
        'aria-label': werkzeug.name,
        'aria-pressed': aktiv ? 'true' : 'false',
        beiClick: () => setzeWerkzeug(werkzeug.id),
      });
      const kurz = werkzeug.name.replace(' anlegen', '').replace(' kopieren', '');
      knopf.innerHTML = `<svg viewBox="0 0 24 24" class="sinnbild"><path d="${werkzeug.zeichen}"/></svg>`
        + (beschriftet ? `<span>${kurz}</span>` : '');
      leiste.append(knopf);
    }
    if (i < WERKZEUGGRUPPEN.length - 1) leiste.append(el('span', { klasse: 'werkzeug-trenner' }));
  });

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

/* ---------- Tafeln --------------------------------------------------------- */

function zeigeLeiste(seite, tafelName) {
  const huelle = $('#huelle');
  huelle.dataset[seite] = 'auf';
  if (seite === 'links' && tafelName) {
    $$('#reiter-links .reiter-knopf').forEach((k) => k.classList.toggle('ist-aktiv', k.dataset.tafel === tafelName));
    $$('.leiste-links .tafel').forEach((t) => t.classList.toggle('ist-aktiv', t.dataset.tafel === tafelName));
  }
  baueNeu({ haltePosition: true });
}

function zeichneGliederung() {
  const tafel = $('#tafel-gliederung');
  tafel.innerHTML = '';
  const gliederung = zustand.gliederung;
  if (!gliederung?.length) {
    tafel.append(el('p', { klasse: 'hinweis', text: 'Dieses Dokument hat keine Lesezeichen.' }));
    return;
  }
  const quelle = [...zustand.quellen.values()][0];

  const baue = (knoten, ebene) => {
    const behaelter = el('div', { klasse: ebene ? 'gliederung-ebene' : '' });
    for (const punkt of knoten) {
      behaelter.append(el('button', {
        klasse: 'eintrag', text: punkt.title || '(ohne Titel)',
        beiClick: async () => {
          try {
            const ziel = typeof punkt.dest === 'string' ? await quelle.pdf.getDestination(punkt.dest) : punkt.dest;
            const index = await quelle.pdf.getPageIndex(ziel[0]);
            const stelle = zustand.folge.findIndex((e) => e.quelleId === quelle.id && e.index === index);
            if (stelle >= 0) zeigeSeite(stelle + 1);
          } catch { sage('Das Lesezeichen zeigt ins Leere', { art: 'warn' }); }
        },
      }));
      if (punkt.items?.length) behaelter.append(baue(punkt.items, ebene + 1));
    }
    return behaelter;
  };
  tafel.append(baue(gliederung, 0));
}

function zeichneSuchtafel() {
  const tafel = $('#tafel-suche');
  const vorherigerWert = $('#suchfeld')?.value ?? suchbegriff();
  tafel.innerHTML = '';

  const feld = el('input', { klasse: 'feld', id: 'suchfeld', placeholder: 'Im Dokument suchen', value: vorherigerWert, stil: { width: '100%' } });
  const grossKlein = el('input', { type: 'checkbox', id: 'such-gross' });
  const ganzesWort = el('input', { type: 'checkbox', id: 'such-wort' });
  const ergebnisse = el('div', { id: 'suchergebnisse' });

  let zeitgeber = null;
  const suchen = () => {
    clearTimeout(zeitgeber);
    zeitgeber = setTimeout(async () => {
      await suche(feld.value, { grossKlein: grossKlein.checked, ganzesWort: ganzesWort.checked });
      markiereAlle();
    }, 220);
  };
  feld.addEventListener('input', suchen);
  feld.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? zurueck(hilfen()) : weiter(hilfen()); }
    if (e.key === 'Escape') { feld.value = ''; leereSuche(); }
  });
  grossKlein.addEventListener('change', suchen);
  ganzesWort.addEventListener('change', suchen);

  tafel.append(
    feld,
    el('div', { klasse: 'zeile', stil: { marginTop: '.5rem', fontSize: '.8125rem' } },
      el('label', { stil: { minWidth: 'auto', display: 'flex', gap: '.25rem', alignItems: 'center' } }, grossKlein, 'Groß/klein'),
      el('label', { stil: { minWidth: 'auto', display: 'flex', gap: '.25rem', alignItems: 'center' } }, ganzesWort, 'ganzes Wort')),
    el('div', { klasse: 'zeile' },
      el('button', { klasse: 'knopf knopf-klein', text: '↑', title: 'Vorheriger Treffer', beiClick: () => zurueck(hilfen()) }),
      el('button', { klasse: 'knopf knopf-klein', text: '↓', title: 'Nächster Treffer', beiClick: () => weiter(hilfen()) }),
      el('span', { klasse: 'hinweis', id: 'such-anzahl' }),
      trefferListe().length ? el('button', { klasse: 'knopf knopf-klein', text: 'Alle hervorheben', beiClick: hebeTrefferHervor }) : null),
    ergebnisse);

  zeichneSuchergebnisse();
}

function zeichneSuchergebnisse() {
  const behaelter = $('#suchergebnisse');
  if (!behaelter) return;
  const treffer = trefferListe();
  const anzahl = $('#such-anzahl');
  if (anzahl) anzahl.textContent = suchbegriff() ? `${treffer.length} Treffer` : '';
  behaelter.innerHTML = '';
  for (const [i, t] of treffer.slice(0, 300).entries()) {
    behaelter.append(el('button', {
      klasse: 'eintrag',
      beiClick: () => { const { springeZu } = hilfenSuche(); springeZu(i); },
    },
      el('div', { klasse: 'eintrag-kopf' }, el('strong', { text: `Seite ${t.seite}` })),
      el('div', { klasse: 'eintrag-zeile', text: t.ausschnitt })));
  }
  if (treffer.length > 300) behaelter.append(el('p', { klasse: 'hinweis', text: `… und ${treffer.length - 300} weitere` }));
}

function hilfen() { return { zeigeSeite, bringeInSicht }; }
function hilfenSuche() {
  return { springeZu: (i) => import('./suche.js').then((m) => m.springeZu(i, hilfen())) };
}

async function anmerkungsBericht() {
  const zeilen = ['Anmerkungen zu ' + zustand.name, ''];
  for (const a of anmerkungsListe()) {
    zeilen.push(`Seite ${a.seite} · ${bezeichne(a)}${a.text ? `: ${a.text}` : ''}`);
  }
  sichereBytes(new TextEncoder().encode(zeilen.join('\n')), vorschlagsname('-anmerkungen').replace(/\.pdf$/i, '.txt'), 'text/plain');
}


/* ---------- Rechte Leiste: vier Tafeln --------------------------------- */

/* Das Handoff trennt Kommentare, Felder und Verlauf in eigene Reiter. Vorher
   stand alles untereinander in einer Spalte — bei einem Dokument mit
   Vorschlaegen, Formular und Anmerkungen musste man scrollen, um irgendetwas
   zu finden. */
function zeigeRechteTafel(name) {
  $$('#reiter-rechts .reiter-knopf').forEach((k) => k.classList.toggle('ist-aktiv', k.dataset.rtafel === name));
  $$('.leiste-rechts .tafel').forEach((t) => t.classList.toggle('ist-aktiv', t.dataset.rtafel === name));
  zeichneRechteTafeln();
}

function zeichneRechteTafeln() {
  zeichneKommentartafel();
  zeichneFeldertafel();
  zeichneVerlauftafel();
}

/* Kommentare mit Faden: Antworten und ein Erledigt-Zustand. Bisher war eine
   Anmerkung ein Strich auf dem Papier; ein Kommentar in einer Runde ist aber
   ein Gespraech, das irgendwann abgehakt wird. */
function zeichneKommentartafel() {
  const tafel = $('#tafel-kommentare');
  if (!tafel || !tafel.classList.contains('ist-aktiv')) return;
  tafel.innerHTML = '';

  const alle = anmerkungsListe();
  const offen = alle.filter((a) => !a.erledigt);
  const erledigt = alle.filter((a) => a.erledigt);
  const gezeigt = zustand.kommentarfilter === 'erledigt' ? erledigt : offen;

  tafel.append(el('div', { klasse: 'filterreihe' },
    ...[['offen', `Offen ${offen.length}`], ['erledigt', `Erledigt ${erledigt.length}`]].map(([wert, text]) =>
      el('button', {
        klasse: `knopf knopf-klein ${(zustand.kommentarfilter || 'offen') === wert ? 'ist-aktiv' : ''}`,
        text,
        beiClick: () => { zustand.kommentarfilter = wert; zeichneKommentartafel(); },
      })),
    alle.length ? el('button', {
      klasse: 'knopf knopf-klein', text: 'Bericht', title: 'Alle Kommentare als Textdatei',
      stil: { marginLeft: 'auto' }, beiClick: anmerkungsBericht,
    }) : null));

  if (!gezeigt.length) {
    tafel.append(el('p', { klasse: 'hinweis', text: zustand.kommentarfilter === 'erledigt'
      ? 'Noch nichts abgehakt.' : 'Keine offenen Kommentare. Mit N eine Notiz setzen.' }));
    return;
  }

  for (const a of gezeigt) {
    const karte = el('div', {
      klasse: `faden ${zustand.gewaehlteAnmerkung === a.id ? 'ist-aktiv' : ''}`,
      beiClick: () => { waehleAn(a.id); melde('seiten:springe', nummerVon(a.seiteId)); },
    },
      el('div', { klasse: 'faden-kopf' },
        el('strong', { text: bezeichne(a) }),
        el('span', { klasse: 'mono klein leise', text: `S.${nummerVon(a.seiteId)} · ${uhrzeit(a.erstellt)}` })),
      a.text ? el('p', { klasse: 'faden-text', text: a.text }) : null,
      ...(a.antworten || []).map((antwort) => el('div', { klasse: 'faden-antwort' },
        el('span', { klasse: 'mono klein leise', text: uhrzeit(antwort.zeit) }),
        el('p', { text: antwort.text }))));

    /* Antwortfeld und Erledigt-Knopf nur im geöffneten Faden — wie im
       Handoff. Sonst liegt das Eingabefeld mitten auf der Karte und fängt
       jeden Klick ab, mit dem man den Faden überhaupt öffnen wollte. */
    if (zustand.gewaehlteAnmerkung === a.id) {
      const feld = el('input', { klasse: 'feld', placeholder: 'Antworten …', stil: { flex: '1' } });
      feld.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !feld.value.trim()) return;
        e.preventDefault();
        antworteAuf(a.id, feld.value.trim());
      });
      feld.addEventListener('click', (e) => e.stopPropagation());

      karte.append(el('div', { klasse: 'faden-fuss' }, feld,
        el('button', {
          klasse: 'knopf knopf-klein', text: a.erledigt ? 'Wieder öffnen' : 'Erledigt',
          beiClick: (e) => { e.stopPropagation(); erledigeAnmerkung(a.id, !a.erledigt); },
        })));
    }
    tafel.append(karte);
  }
}

const uhrzeit = (zeit) => new Date(zeit || Date.now()).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

function antworteAuf(id, text) {
  const a = zustand.anmerkungen.find((x) => x.id === id);
  if (!a) return;
  a.antworten = [...(a.antworten || []), { text, zeit: Date.now() }];
  melde('anmerkungen:geaendert');
  sage('Antwort vermerkt');
}

function erledigeAnmerkung(id, erledigt) {
  aendere(id, { erledigt }, erledigt ? 'Kommentar erledigt' : 'Kommentar wieder geöffnet');
  zeichneKommentartafel();
}

/* Felder: was das Formular verlangt, auf einen Blick — mit Pflichtstatus. */
function zeichneFeldertafel() {
  const tafel = $('#tafel-felder');
  if (!tafel || !tafel.classList.contains('ist-aktiv')) return;
  tafel.innerHTML = '';

  if (!zustand.formularfelder.length) {
    tafel.append(el('p', { klasse: 'hinweis', text: 'Dieses Dokument hat kein Formular. Mit dem Werkzeug „Formularfeld" (K) lässt sich eines anlegen.' }));
    return;
  }

  const offen = zustand.formularfelder.filter((f) => f.pflicht && !zustand.formularwerte.get(f.name));
  tafel.append(el('p', { klasse: 'hinweis' },
    `${zustand.formularfelder.length} Felder`,
    offen.length ? `, ${offen.length} Pflichtfeld${offen.length === 1 ? '' : 'er'} offen` : ', alle Pflichtfelder ausgefüllt'));

  for (const feld of zustand.formularfelder) {
    const wert = zustand.formularwerte.get(feld.name);
    const fehlt = feld.pflicht && !wert;
    tafel.append(el('div', {
      klasse: 'feldzeile', beiClick: () => { melde('seiten:springe', nummerVon(feld.seiteId)); },
    },
      el('div', {},
        el('span', { klasse: 'mono klein leise', text: feld.art.toUpperCase() }),
        el('div', { klasse: 'feldzeile-name', text: feld.name })),
      el('span', {
        klasse: `wertmarke ${fehlt ? 'ist-offen' : ''}`,
        text: wert ? String(wert).slice(0, 24) : (feld.pflicht ? 'PFLICHT' : 'leer'),
      })));
  }
}

/* Verlauf: die Rückgängig-Kette, von hinten gelesen. Sie war schon da —
   sichtbar war sie nur im Tooltip eines Knopfes. */
function zeichneVerlauftafel() {
  const tafel = $('#tafel-verlauf');
  if (!tafel || !tafel.classList.contains('ist-aktiv')) return;
  tafel.innerHTML = '';

  const schritte = zustand.gedaechtnis.letzteAktionen;
  if (!schritte.length) {
    tafel.append(el('p', { klasse: 'hinweis', text: 'Noch nichts geändert.' }));
    return;
  }
  for (const schritt of schritte) {
    tafel.append(el('div', { klasse: 'verlauf-zeile' },
      el('i', { klasse: 'verlauf-marke' }),
      el('div', {},
        el('div', { text: schritt.beschreibung }),
        el('span', { klasse: 'mono klein leise', text: uhrzeit(schritt.zeit) }))));
  }
}

function zeichneRechteTafel() {
  const tafel = $('#tafel-rechts');
  if (!tafel) return;
  tafel.innerHTML = '';
  tafel.append(tafelMitdenken());

  // Werkzeugeigenschaften
  const zeichnend = !['auswahl'].includes(zustand.werkzeug);
  if (zeichnend) {
    const werkzeug = WERKZEUGE.find((w) => w.id === zustand.werkzeug);
    const abschnitt = el('div', { klasse: 'abschnitt' }, el('h2', { text: werkzeug?.name || 'Werkzeug' }));
    if (zustand.werkzeug !== 'schwaerzen' && zustand.werkzeug !== 'unterschrift') {
      abschnitt.append(el('div', { klasse: 'farbreihe' }, ...FARBEN.map((farbe) =>
        el('button', {
          klasse: `farbtupf ${zustand.farbe === farbe ? 'ist-aktiv' : ''}`,
          stil: { background: farbe }, title: farbe,
          beiClick: () => {
            zustand.farbe = farbe;
            zustand.farbeJeWerkzeug[zustand.werkzeug] = farbe;
            zeichneRechteTafel();
          },
        }))));
    }
    if (['freihand', 'rechteck', 'ellipse', 'pfeil'].includes(zustand.werkzeug)) {
      abschnitt.append(el('div', { klasse: 'zeile', stil: { marginTop: '.6rem' } },
        el('label', { text: 'Strich', stil: { minWidth: '4rem' } }),
        el('input', {
          type: 'range', klasse: 'schieber', min: '1', max: '12', step: '0.5', value: String(zustand.strichstaerke),
          beiInput: (e) => { zustand.strichstaerke = Number(e.target.value); },
        })));
    }
    if (zustand.werkzeug === 'text') {
      abschnitt.append(el('div', { klasse: 'zeile', stil: { marginTop: '.6rem' } },
        el('label', { text: 'Größe', stil: { minWidth: '4rem' } }),
        el('input', {
          type: 'range', klasse: 'schieber', min: '6', max: '48', step: '1', value: String(zustand.schriftgroesse),
          beiInput: (e) => { zustand.schriftgroesse = Number(e.target.value); },
        })));
    }
    if (zustand.werkzeug === 'stempel') {
      abschnitt.append(el('p', { klasse: 'hinweis', text: 'Auf die Stelle klicken. Vorlage wählen oder eigenen Text schreiben; das Datum lässt sich anhängen.' }));
    }
    if (zustand.werkzeug === 'bereich') {
      abschnitt.append(el('p', { klasse: 'hinweis', text: 'Rechteck über den Ausschnitt ziehen. Er landet in der Zwischenablage — mit einem Knopf zum Sichern als PNG.' }));
    }
    if (zustand.werkzeug === 'ersetzen') {
      abschnitt.append(el('p', { klasse: 'hinweis', text: 'Auf ein Textstück klicken. Die Werkbank übernimmt Lage, Größe und Farben und setzt den neuen Text an dieselbe Stelle.' }));
    }
    if (zustand.werkzeug === 'schwaerzen') {
      abschnitt.append(el('p', { klasse: 'hinweis', text: 'Rechteck über die Stelle ziehen. Beim Sichern wird die Seite gerastert — der Text darunter verschwindet wirklich, nicht nur optisch.' }));
    }
    if (zustand.werkzeug === 'unterschrift') {
      abschnitt.append(el('button', { klasse: 'knopf knopf-klein', text: hatUnterschrift() ? 'Unterschrift ändern' : 'Unterschrift anlegen', beiClick: () => fuehreAus('unterschrift:anlegen') }));
    }
    tafel.append(abschnitt);
  }

  // Gewählte Anmerkung
  const gewaehlt = zustand.anmerkungen.find((a) => a.id === zustand.gewaehlteAnmerkung);
  if (gewaehlt) {
    const abschnitt = el('div', { klasse: 'abschnitt' }, el('h2', { text: 'Gewählte Anmerkung' }),
      el('div', { klasse: 'merkmal' }, el('span', { text: 'Art' }), el('span', { text: bezeichne(gewaehlt) })),
      el('div', { klasse: 'merkmal' }, el('span', { text: 'Seite' }), el('span', { text: String(nummerVon(gewaehlt.seiteId)) })));
    if ('text' in gewaehlt) {
      const feld = el('textarea', { klasse: 'feld', rows: '3', stil: { width: '100%' } });
      feld.value = gewaehlt.text || '';
      feld.addEventListener('change', () => aendere(gewaehlt.id, { text: feld.value }, 'Text geändert'));
      abschnitt.append(feld);
    }
    abschnitt.append(el('div', { klasse: 'zeile', stil: { marginTop: '.5rem' } },
      el('button', { klasse: 'knopf knopf-klein knopf-gefahr', text: 'Löschen', beiClick: () => entferne(gewaehlt.id) })));
    tafel.append(abschnitt);
  }

  // Formular
  if (hatFormular()) {
    const offen = offeneFelder().length;
    const abschnitt = el('div', { klasse: 'abschnitt' },
      el('h2', { text: 'Formular' }),
      el('div', { klasse: 'zeile' },
        el('span', { klasse: offen ? 'marke marke-warn' : 'marke marke-gut', text: offen ? `${offen} offen` : 'vollständig' }),
        el('button', { klasse: 'knopf knopf-klein', text: 'Nächstes Feld', beiClick: () => fuehreAus('formular:naechstes') })),
      formularTafel());
    tafel.append(abschnitt);
  }

  // Texterkennung
  const ocr = erkennungsUebersicht();
  if (ocr) {
    tafel.append(el('div', { klasse: 'abschnitt' },
      el('h2', { text: 'Texterkennung' }),
      el('div', { klasse: 'merkmal' }, el('span', { text: 'Seiten' }), el('span', { text: String(ocr.seiten.length) })),
      el('div', { klasse: 'merkmal' }, el('span', { text: 'Wörter' }), el('span', { text: String(ocr.woerter) })),
      el('div', { klasse: 'merkmal' }, el('span', { text: 'Sicherheit' }),
        el('span', { klasse: ocr.konfidenz > 85 ? 'marke marke-gut' : 'marke marke-warn', text: `${Math.round(ocr.konfidenz)} %` })),
      el('p', { klasse: 'hinweis', text: 'Der erkannte Text liegt unsichtbar hinter dem Bild und wandert beim Sichern mit.' })));
  }

  // Dokument
  const e = zustand.eigenschaften;
  if (e) {
    tafel.append(el('div', { klasse: 'abschnitt' },
      el('h2', { text: 'Dokument' }),
      el('div', { klasse: 'merkmal' }, el('span', { text: 'Seiten' }), el('span', { text: String(zustand.folge.length) })),
      el('div', { klasse: 'merkmal' }, el('span', { text: 'Format' }), el('span', { text: `${e.breitePt} × ${e.hoehePt} pt` })),
      el('div', { klasse: 'merkmal' }, el('span', { text: 'Größe' }), el('span', { text: groesse(e.dateigroesse) })),
      el('div', { klasse: 'merkmal' }, el('span', { text: 'Ausgabeweg' }),
        el('span', { text: istUnveraendertesGeruest() ? 'Original ergänzen' : 'Neu aufbauen' })),
      el('button', { klasse: 'knopf knopf-klein', text: 'Eigenschaften …', stil: { marginTop: '.5rem' }, beiClick: zeigeEigenschaften })));
  }
}

/* ---------- Dialoge --------------------------------------------------------- */

function zeigeEigenschaften() {
  const e = zustand.eigenschaften;
  if (!e) return sage('Kein Dokument geladen');
  const zeilen = [
    ['Titel', e.titel || '—'],
    ['Verfasser', e.verfasser || '—'],
    ['Thema', e.thema || '—'],
    ['Erzeugt mit', e.erzeuger || '—'],
    ['Erstellt', datum(e.erstellt)],
    ['Geändert', datum(e.geaendert)],
    ['PDF-Fassung', e.fassung || '—'],
    ['Seiten', String(zustand.folge.length)],
    ['Seitenmaß', `${e.breitePt} × ${e.hoehePt} pt (${(e.breitePt / 72 * 25.4).toFixed(0)} × ${(e.hoehePt / 72 * 25.4).toFixed(0)} mm)`],
    ['Dateigröße', groesse(e.dateigroesse)],
    ['Formularfelder', String(zustand.formularfelder.length)],
    ['Anmerkungen', String(zustand.anmerkungen.length)],
    ['Textebene', e.wirktGescannt ? 'fehlt (Scan)' : 'vorhanden'],
  ];
  const rumpf = el('div', {}, ...zeilen.map(([links, rechts]) =>
    el('div', { klasse: 'merkmal' }, el('span', { text: links }), el('span', { text: rechts }))));
  zeigeDialog({ titel: 'Dokumenteigenschaften', rumpf, knoepfe: [{ beschriftung: 'Schließen', betont: true }] });
}

function zeigeSicherungsDialog() {
  const name = el('input', { klasse: 'feld', value: vorschlagsname(), stil: { flex: '1' } });
  const einbrennen = el('input', { type: 'checkbox', checked: hatFormular() ? true : false });
  const metadatenWeg = el('input', { type: 'checkbox' });
  const nurAuswahl = el('input', { type: 'checkbox' });

  const rumpf = el('div', {},
    el('div', { klasse: 'zeile' }, el('label', { text: 'Dateiname' }), name),
    hatFormular() ? el('div', { klasse: 'zeile' }, el('label', { text: 'Formular' }),
      el('label', { stil: { minWidth: 'auto', display: 'flex', gap: '.4rem' } }, einbrennen, 'Werte fest einbrennen (nicht mehr änderbar)')) : null,
    el('div', { klasse: 'zeile' }, el('label', { text: 'Metadaten' }),
      el('label', { stil: { minWidth: 'auto', display: 'flex', gap: '.4rem' } }, metadatenWeg, 'Verfasser und Erzeuger entfernen')),
    zustand.gewaehlteSeiten.size ? el('div', { klasse: 'zeile' }, el('label', { text: 'Umfang' }),
      el('label', { stil: { minWidth: 'auto', display: 'flex', gap: '.4rem' } }, nurAuswahl, `nur die ${zustand.gewaehlteSeiten.size} gewählten Seiten`)) : null,
    el('p', { klasse: 'hinweis' }, istUnveraendertesGeruest()
      ? 'Das Original wird geöffnet und ergänzt: Lesezeichen, Formularstruktur und Metadaten bleiben erhalten.'
      : 'Seitenfolge, Drehung oder Schwärzung wurden geändert — das Dokument wird neu aufgebaut. Formularwerte werden dabei fest eingebrannt, Lesezeichen gehen verloren.'));

  zeigeDialog({
    titel: 'Sichern unter',
    rumpf,
    knoepfe: [
      { beschriftung: 'Abbrechen' },
      {
        beschriftung: 'Sichern', betont: true,
        tun: () => {
          sichereMit({
            dateiname: name.value.endsWith('.pdf') ? name.value : `${name.value}.pdf`,
            formularEinbrennen: einbrennen.checked,
            metadatenEntfernen: metadatenWeg.checked,
            seiten: nurAuswahl.checked ? [...zustand.gewaehlteSeiten] : null,
          });
        },
      },
    ],
  });
}

async function sichereMit(optionen) {
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
      el('div', { klasse: 'zeile' }, el('label', { text: 'Vorlage' }), vorlage),
      el('div', { klasse: 'zeile' }, el('label', { text: 'Eigener Text' }), eigenerText),
      el('div', { klasse: 'zeile' }, el('label', { text: 'Datum' }),
        el('label', { stil: { minWidth: 'auto', display: 'flex', gap: '.4rem' } }, mitDatum, 'heutiges Datum anhängen')),
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
    dokument.setProducer('Werkbank');
    sichereBytes(await dokument.save(), 'bilder.pdf');
    sage(`${gezaehlt} Bild${gezaehlt === 1 ? '' : 'er'} zu einem PDF gemacht`);
  });
}


/* ---------- Einstellungen ------------------------------------------------ */

/* Bis hierher hatte die Werkbank keine Einstellungen: alles war entweder fest
   oder ein Befehl. Das Handoff sieht acht Kategorien vor; hier stehen nur die,
   die wirklich etwas bewirken — ein Schalter ohne Wirkung ist eine Luege.

   Bewusst kein Browser-Speicher: die Einstellungen gelten fuer diese Sitzung.
   localStorage waere ein Datenspeicher, den niemand geloescht bekommt, und
   die Werkbank verspricht, nichts zu hinterlassen. */
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

const KATEGORIEN = ['Allgemein', 'Anzeige & Lesen', 'Anmerkungen', 'OCR & Text', 'Signaturen', 'Speicher & Privatsphäre', 'Tastenkürzel'];
let offeneKategorie = 'Allgemein';

export function einstellung(schluessel) { return EINSTELLUNGEN[schluessel]?.wert; }

function zeigeEinstellungen(kategorie = offeneKategorie) {
  offeneKategorie = kategorie;
  const inhalt = el('div', { klasse: 'einst-inhalt' });
  const liste = el('nav', { klasse: 'einst-kategorien' });

  const zeichneInhalt = () => {
    inhalt.innerHTML = '';
    inhalt.append(el('h3', { text: offeneKategorie }));

    if (offeneKategorie === 'Signaturen') {
      inhalt.append(el('p', { klasse: 'hinweis' },
        'Unterschrieben wird mit einem Zertifikat aus einer .p12-Datei — unter „Schutz → Digital unterschreiben". ',
        'Es gibt hier nichts einzustellen: die Werkbank speichert weder Zertifikat noch Kennwort, weil beides ',
        'die Sitzung nicht überdauern soll.'));
      return;
    }
    if (offeneKategorie === 'Tastenkürzel') {
      const mitKuerzel = befehle.filter((b) => b.kuerzel);
      inhalt.append(el('p', { klasse: 'hinweis', text: `${mitKuerzel.length} Befehle haben ein Kürzel. Änderbar sind sie nicht — sie folgen dem, was Betrachter und Textprogramme seit Jahren belegen.` }));
      for (const b of mitKuerzel) {
        inhalt.append(el('div', { klasse: 'einst-zeile' },
          el('div', {}, el('div', { klasse: 'einst-name', text: b.name })),
          el('kbd', { klasse: 'menue-kuerzel', text: b.kuerzel })));
      }
      return;
    }

    const eintraege = Object.entries(EINSTELLUNGEN).filter(([, e]) => e.kategorie === offeneKategorie);
    for (const [schluessel, eintrag] of eintraege) {
      inhalt.append(el('div', { klasse: 'einst-zeile' },
        el('div', {},
          el('div', { klasse: 'einst-name', text: eintrag.name }),
          eintrag.hinweis ? el('div', { klasse: 'einst-hinweis', text: eintrag.hinweis }) : null),
        eintrag.art === 'schalter' ? schalter(schluessel, eintrag) : wahl(schluessel, eintrag)));
    }
  };

  const schalter = (schluessel, eintrag) => {
    const knopf = el('button', {
      klasse: `pille ${eintrag.wert ? 'ist-an' : ''}`, role: 'switch',
      'aria-checked': eintrag.wert ? 'true' : 'false', 'aria-label': eintrag.name,
      daten: { einstellung: schluessel },
      beiClick: () => { eintrag.wert = !eintrag.wert; wendeAn(schluessel); zeichneInhalt(); },
    }, el('i', {}));
    return knopf;
  };

  const wahl = (schluessel, eintrag) => el('div', { klasse: 'segmente', daten: { einstellung: schluessel } },
    ...eintrag.werte.map(([wert, text]) => el('button', {
      klasse: `segment ${String(eintrag.wert) === wert ? 'ist-an' : ''}`, text,
      beiClick: () => { eintrag.wert = wert; wendeAn(schluessel); zeichneInhalt(); },
    })));

  for (const name of KATEGORIEN) {
    liste.append(el('button', {
      klasse: `einst-kategorie ${name === offeneKategorie ? 'ist-aktiv' : ''}`, text: name,
      beiClick: () => { offeneKategorie = name; liste.querySelectorAll('.einst-kategorie').forEach((k) => k.classList.toggle('ist-aktiv', k.textContent === name)); zeichneInhalt(); },
    }));
  }
  zeichneInhalt();

  zeigeDialog({
    titel: 'Einstellungen',
    breit: true,
    rumpf: el('div', { klasse: 'einstellungen' }, liste, inhalt),
    knoepfe: [{ beschriftung: 'Schließen', betont: true }],
  });
}

/* Eine Einstellung wirkt sofort — nicht erst nach „Übernehmen". Ein Schalter,
   der erst nach einem zweiten Knopfdruck etwas tut, wird zweimal gedrückt. */
function wendeAn(schluessel) {
  const wert = EINSTELLUNGEN[schluessel].wert;
  if (schluessel === 'anzeige.thema') wendeThemaAn(wert);
  if (schluessel === 'anmerkung.staerke') zustand.strichstaerke = Number(wert);
  if (schluessel === 'anmerkung.groesse') zustand.schriftgroesse = Number(wert);
  if (schluessel === 'anzeige.nummern') document.documentElement.classList.toggle('ohne-seitenzahlen', !wert);
  if (schluessel === 'mitdenken.an' || schluessel === 'mitdenken.hoechstens') { untersuche(); zeichneRechteTafel(); }
}

/* ---------- Digital unterschreiben ------------------------------------------ */

function zeigeSignaturDialog() {
  let ausweis = null;

  const dateifeld = el('input', { type: 'file', klasse: 'feld', accept: '.p12,.pfx', stil: { flex: '1' } });
  const kennwortfeld = el('input', { type: 'password', klasse: 'feld', stil: { flex: '1' }, autocomplete: 'off' });
  const grundfeld = el('input', { klasse: 'feld', stil: { flex: '1' }, value: 'Ich bestätige dieses Dokument' });
  const ortfeld = el('input', { klasse: 'feld', stil: { flex: '1' }, placeholder: 'Hannover' });
  const bericht = el('div', { klasse: 'zugang-punkt' });

  /* Ändern und Verlassen des Kennwortfelds lösen beide eine Prüfung aus.
     Ohne Marke schreiben zwei Läufe nacheinander in denselben Kasten. */
  let lauf = 0;
  const pruefeAusweis = async () => {
    const meiner = ++lauf;
    const datei = dateifeld.files?.[0];
    bericht.innerHTML = '';
    ausweis = null;
    if (!datei || !kennwortfeld.value) return;
    try {
      const geoeffnet = await oeffneAusweis(await datei.arrayBuffer(), kennwortfeld.value);
      if (meiner !== lauf) return;
      ausweis = geoeffnet;
      const b = ausweis.beschreibung;
      const warnung = b.abgelaufen ? 'Das Zertifikat ist abgelaufen.'
        : b.nochNichtGueltig ? 'Das Zertifikat gilt noch nicht.' : '';
      bericht.classList.toggle('zugang-warnung', !!warnung);
      bericht.classList.toggle('zugang-gut', !warnung);
      /* append(null) schriebe das Wort „null" auf den Bildschirm. */
      bericht.append(...[
        el('strong', { text: warnung ? `!  ${b.name}` : `✓  ${b.name}` }),
        el('p', { klasse: 'klein leise' },
          `${b.organisation ? `${b.organisation}, ` : ''}${b.land || ''} · ausgestellt von ${b.aussteller}`,
          el('br'),
          `gültig ${datum(b.gueltigVon)} bis ${datum(b.gueltigBis)}`),
        warnung ? el('p', { klasse: 'klein', text: `${warnung} Unterschreiben ist möglich, die Prüfung wird das aber anmerken.` }) : null,
      ].filter(Boolean));
    } catch (fehler) {
      if (meiner !== lauf) return;
      bericht.classList.add('zugang-fehler');
      bericht.append(el('strong', { text: `✕  ${fehler.message}` }));
    }
  };
  dateifeld.addEventListener('change', pruefeAusweis);
  kennwortfeld.addEventListener('change', pruefeAusweis);
  kennwortfeld.addEventListener('blur', pruefeAusweis);

  zeigeDialog({
    titel: 'Digital unterschreiben',
    rumpf: el('div', {},
      el('p', { klasse: 'hinweis' },
        'Das ist etwas anderes als die Unterschrift unter „Werkzeuge": die ist ein Bild und beweist nichts. ',
        'Hier wird über die Bytes der Datei ein Hashwert gebildet und mit dem Schlüssel aus Ihrer ',
        'Ausweisdatei signiert. Ändert danach jemand ein Zeichen, meldet jeder Betrachter, dass das ',
        'Dokument nach der Unterschrift verändert wurde.'),
      el('div', { klasse: 'zeile' }, el('label', { text: 'Ausweisdatei' }), dateifeld),
      el('div', { klasse: 'zeile' }, el('label', { text: 'Kennwort' }), kennwortfeld),
      bericht,
      el('div', { klasse: 'zeile' }, el('label', { text: 'Grund' }), grundfeld),
      el('div', { klasse: 'zeile' }, el('label', { text: 'Ort' }), ortfeld),
      el('p', { klasse: 'hinweis' },
        'Die Datei verlässt dieses Gerät nicht, auch die Ausweisdatei nicht. ',
        'Grenzen: eine Unterschrift je Datei (eine zweite darüber würde die erste brechen), ',
        'kein Zeitstempel von einem Dienst — die Signaturzeit ist die Uhr dieses Geräts — ',
        'und keine Abfrage von Sperrlisten. Das ergibt PAdES-B-B. Ob die Unterschrift als ',
        'qualifiziert gilt, entscheidet Ihr Zertifikat, nicht dieses Programm.')),
    knoepfe: [
      { beschriftung: 'Abbrechen' },
      {
        beschriftung: 'Unterschreiben und sichern', betont: true,
        tun: () => {
          if (!ausweis) { sage('Erst Ausweisdatei und Kennwort angeben', { art: 'warn' }); return false; }
          mitLader('Dokument wird unterschrieben …', () => sichereDokument({
            signatur: {
              ausweis,
              grund: grundfeld.value.trim(),
              ort: ortfeld.value.trim(),
              name: ausweis.beschreibung.name,
            },
          })).then(() => sage(`Unterschrieben als ${ausweis.beschreibung.name}`, { dauer: 6000 }));
        },
      },
    ],
  });
}

function zeigeBarrierefreiDialog() {
  const wurzel = el('div', {}, el('p', { klasse: 'hinweis', text: 'Wird geprüft …' }));
  zeigeDialog({
    titel: 'Barrierefreiheit',
    rumpf: wurzel,
    knoepfe: [{ beschriftung: 'Schließen' }],
  });

  pruefeZugang().then((punkte) => {
    wurzel.innerHTML = '';
    const fehler = punkte.filter((p) => p.stufe === 'fehler').length;
    const warnungen = punkte.filter((p) => p.stufe === 'warnung').length;

    wurzel.append(el('p', { klasse: 'hinweis' },
      fehler || warnungen
        ? `${fehler} Punkt${fehler === 1 ? '' : 'e'} zu klären, ${warnungen} Hinweis${warnungen === 1 ? '' : 'e'}.`
        : 'Nichts zu beanstanden, soweit sich das maschinell feststellen lässt.'));

    for (const punkt of punkte) {
      wurzel.append(el('div', { klasse: `zugang-punkt zugang-${punkt.stufe}` },
        el('strong', { text: `${{ fehler: '✕', warnung: '!', gut: '✓' }[punkt.stufe]}  ${punkt.titel}` }),
        punkt.text ? el('p', { klasse: 'klein leise', text: punkt.text }) : null,
        punkt.befehl
          ? el('button', { klasse: 'knopf knopf-klein', text: 'Jetzt erledigen',
              beiClick: () => { schliesseDialog(); fuehreAus(punkt.befehl); } })
          : null));
    }

    const behebbar = punkte.filter((p) => p.behebbar);
    if (!behebbar.length) return;

    const sprachwahl = el('select', { klasse: 'feld' },
      ...SPRACHEN.map((s) => el('option', { value: s.wert, text: s.name })));
    const titelfeld = el('input', { klasse: 'feld', stil: { flex: '1' },
      value: zustand.eigenschaften?.titel || zustand.name.replace(/\.pdf$/i, '') });

    wurzel.append(
      el('hr', { klasse: 'menue-trenner' }),
      el('p', { klasse: 'hinweis', text: 'Was sich ohne Vermutung setzen lässt, setzt die Werkbank beim nächsten Sichern:' }),
      el('div', { klasse: 'zeile' }, el('label', { text: 'Sprache' }), sprachwahl),
      el('div', { klasse: 'zeile' }, el('label', { text: 'Titel' }), titelfeld),
      el('button', { klasse: 'knopf', text: 'Übernehmen und sichern', beiClick: () => {
        zustand.zugang = { sprache: sprachwahl.value, titel: titelfeld.value.trim(), feldbeschriftungen: true };
        schliesseDialog();
        fuehreAus('sichern');
      } }));
  }).catch((fehler) => {
    wurzel.innerHTML = '';
    wurzel.append(el('p', { klasse: 'hinweis', text: `Die Prüfung ist gescheitert: ${fehler.message}` }));
  });
}

function zeigeExcelDialog() {
  const umfang = el('select', { klasse: 'feld' },
    el('option', { value: 'alle', text: `Alle Seiten (${zustand.folge.length})` }),
    el('option', { value: 'auswahl', text: `Gewählte Seiten (${zustand.gewaehlteSeiten.size})` }));
  const weg = el('select', { klasse: 'feld' },
    el('option', { value: 'tabellen', text: 'Nur erkannte Tabellen' }),
    el('option', { value: 'alles', text: 'Jede Zeile ins Raster' }));

  zeigeDialog({
    titel: 'Nach Excel ausgeben',
    rumpf: el('div', {},
      el('div', { klasse: 'zeile' }, el('label', { text: 'Umfang' }), umfang),
      el('div', { klasse: 'zeile' }, el('label', { text: 'Weg' }), weg),
      el('p', { klasse: 'hinweis' },
        'Ein PDF kennt keine Tabellen, nur Buchstaben an Punkten. Als Tabelle gilt hier, ',
        'was in mindestens drei Zeilen hintereinander an denselben Stellen beginnt. ',
        'Findet das nichts, holt „Jede Zeile ins Raster" den Text trotzdem — dann steht ',
        'auch Fließtext in den Zellen.'),
      el('p', { klasse: 'hinweis' },
        'Je Seite entsteht ein Blatt. Zahlen werden als Zahlen geschrieben, damit sich ',
        'damit rechnen lässt; Bestellnummern mit führender Null bleiben Text. ',
        'Nicht übernommen: Rahmen, Farben, verbundene Zellen, Formeln, Bilder.')),
    knoepfe: [
      { beschriftung: 'Abbrechen' },
      {
        beschriftung: 'Ausgeben', betont: true,
        tun: () => mitLader('Tabellen werden gelesen …', async () => {
          try {
            const { bytes, blaetter, zeilen, zellen, uebersprungen } = await alsExcel({
              seiten: umfang.value === 'auswahl' && zustand.gewaehlteSeiten.size ? [...zustand.gewaehlteSeiten] : null,
              nurTabellen: weg.value === 'tabellen',
            });
            sichereBytes(bytes, vorschlagsname('').replace(/\.pdf$/i, '.xlsx'),
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            sage(uebersprungen
              ? `${zeilen} Zeilen, ${zellen} Zellen auf ${blaetter} Blättern — ${uebersprungen} Seite${uebersprungen === 1 ? '' : 'n'} ohne Tabelle übersprungen`
              : `${zeilen} Zeilen, ${zellen} Zellen auf ${blaetter} Blättern ausgegeben`, { dauer: 6000 });
          } catch (fehler) {
            sage(fehler.message, { art: 'warn', dauer: 8000 });
          }
        }),
      },
    ],
  });
}

function zeigeWordDialog() {
  const umfang = el('select', { klasse: 'feld' },
    el('option', { value: 'alle', text: `Alle Seiten (${zustand.folge.length})` }),
    el('option', { value: 'auswahl', text: `Gewählte Seiten (${zustand.gewaehlteSeiten.size})` }));
  const ueberschriften = el('input', { type: 'checkbox', checked: true });
  const umbrueche = el('input', { type: 'checkbox', checked: true });

  zeigeDialog({
    titel: 'Nach Word ausgeben',
    rumpf: el('div', {},
      el('div', { klasse: 'zeile' }, el('label', { text: 'Umfang' }), umfang),
      el('div', { klasse: 'zeile' }, el('label', { text: 'Überschriften' }),
        el('label', { stil: { minWidth: 'auto', display: 'flex', gap: '.4rem' } }, ueberschriften, 'aus der Schriftgröße erkennen')),
      el('div', { klasse: 'zeile' }, el('label', { text: 'Seiten' }),
        el('label', { stil: { minWidth: 'auto', display: 'flex', gap: '.4rem' } }, umbrueche, 'Seitenumbrüche übernehmen')),
      el('p', { klasse: 'hinweis' },
        'Übernommen werden Absätze, Überschriften, fette und kursive Stellen. ',
        'Nicht übernommen werden Spalten, Tabellenraster und Bilder — ein PDF beschreibt Buchstaben an Punkten, keine Absätze. ',
        'Wer das Aussehen braucht, gibt das PDF weiter; wer weiterschreiben will, nimmt diese Datei.'),
      zustand.ocr.size
        ? el('p', { klasse: 'hinweis', text: 'Erkannter Text aus Scans wandert mit.' })
        : el('p', { klasse: 'hinweis', text: 'Seiten ohne Textebene bleiben leer — dafür erst die Texterkennung laufen lassen.' })),
    knoepfe: [
      { beschriftung: 'Abbrechen' },
      {
        beschriftung: 'Ausgeben', betont: true,
        tun: () => mitLader('Word-Datei wird geschrieben …', async () => {
          const { bytes, woerter, absaetze, seitenOhneText } = await alsWord({
            seiten: umfang.value === 'auswahl' && zustand.gewaehlteSeiten.size ? [...zustand.gewaehlteSeiten] : null,
            ueberschriftenErkennen: ueberschriften.checked,
            seitenumbrueche: umbrueche.checked,
          });
          sichereBytes(bytes, vorschlagsname('').replace(/\.pdf$/i, '.docx'),
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
          sage(seitenOhneText
            ? `${woerter} Wörter in ${absaetze} Absätzen — ${seitenOhneText} Seite${seitenOhneText === 1 ? '' : 'n'} ohne Text blieb leer`
            : `${woerter} Wörter in ${absaetze} Absätzen ausgegeben`, { dauer: 6000 });
        }),
      },
    ],
  });
}

function zeigeSchutzDialog() {
  const benutzer = el('input', { klasse: 'feld', type: 'password', placeholder: 'zum Öffnen nötig', stil: { flex: '1' } });
  const besitzer = el('input', { klasse: 'feld', type: 'password', placeholder: 'zum Ändern der Rechte', stil: { flex: '1' } });
  const drucken = el('select', { klasse: 'feld' },
    el('option', { value: 'full', text: 'erlaubt' }),
    el('option', { value: 'low', text: 'nur in niedriger Auflösung' }),
    el('option', { value: 'none', text: 'verboten' }));
  const aendern = el('select', { klasse: 'feld' },
    el('option', { value: 'all', text: 'alles erlaubt' }),
    el('option', { value: 'annotate', text: 'nur kommentieren und Formulare ausfüllen' }),
    el('option', { value: 'form', text: 'nur Formulare ausfüllen' }),
    el('option', { value: 'none', text: 'nichts erlaubt' }));
  const kopieren = el('input', { type: 'checkbox', checked: true });

  zeigeDialog({
    titel: 'Mit Kennwort schützen',
    rumpf: el('div', {},
      el('div', { klasse: 'zeile' }, el('label', { text: 'Öffnen-Kennwort' }), benutzer),
      el('div', { klasse: 'zeile' }, el('label', { text: 'Besitzer-Kennwort' }), besitzer),
      el('div', { klasse: 'zeile' }, el('label', { text: 'Drucken' }), drucken),
      el('div', { klasse: 'zeile' }, el('label', { text: 'Ändern' }), aendern),
      el('div', { klasse: 'zeile' }, el('label', { text: 'Text kopieren' }),
        el('label', { stil: { minWidth: 'auto', display: 'flex', gap: '.4rem' } }, kopieren, 'erlaubt')),
      el('p', { klasse: 'hinweis' },
        'Verschlüsselt mit AES-256 durch qpdf, das hier als WebAssembly mitläuft. ',
        'Ohne Öffnen-Kennwort lässt sich die Datei nicht mehr lesen — auch nicht von dieser Werkbank. ',
        'Rechtebeschränkungen ohne Öffnen-Kennwort sind eine Bitte an den Betrachter, kein technischer Riegel.')),
    knoepfe: [
      { beschriftung: 'Abbrechen' },
      {
        beschriftung: 'Geschützt sichern', betont: true,
        tun: () => {
          if (!benutzer.value && !besitzer.value) { sage('Mindestens ein Kennwort angeben', { art: 'warn' }); return false; }
          sichereMit({
            dateiname: vorschlagsname('-geschuetzt'),
            formularEinbrennen: false,
            schutz: {
              benutzer: benutzer.value, besitzer: besitzer.value,
              drucken: drucken.value, aendern: aendern.value, kopieren: kopieren.checked,
            },
          });
        },
      },
    ],
  });
}

function zeigeVerkleinernDialog() {
  const dichte = el('select', { klasse: 'feld' },
    el('option', { value: '72', text: '72 dpi — Bildschirm, kleinste Datei' }),
    el('option', { value: '110', text: '110 dpi — Weitergabe per E-Mail' }),
    el('option', { value: '150', text: '150 dpi — Ausdruck im Büro' }),
    el('option', { value: '200', text: '200 dpi — sorgfältiger Ausdruck' }));
  dichte.value = '110';
  const guete = el('input', { type: 'range', klasse: 'schieber', min: '0.4', max: '0.92', step: '0.02', value: '0.72' });
  const anzeige = el('span', { klasse: 'hinweis', text: 'mittel' });
  guete.addEventListener('input', () => {
    const w = Number(guete.value);
    anzeige.textContent = w < 0.55 ? 'grob' : w < 0.75 ? 'mittel' : 'fein';
  });

  const jetzt = zustand.eigenschaften?.dateigroesse || 0;
  zeigeDialog({
    titel: 'Verkleinern',
    rumpf: el('div', {},
      el('p', { klasse: 'hinweis', text: `Zurzeit ${groesse(jetzt)}.` }),
      el('div', { klasse: 'zeile' }, el('label', { text: 'Auflösung' }), dichte),
      el('div', { klasse: 'zeile' }, el('label', { text: 'Bildgüte' }), guete, anzeige),
      el('p', { klasse: 'hinweis' },
        zustand.ocr.size
          ? 'Die Seiten werden zu Bildern. Der erkannte Text wandert als unsichtbare Ebene mit — die Datei bleibt durchsuchbar.'
          : 'Die Seiten werden zu Bildern: kleiner, aber der Text ist danach nicht mehr auswählbar. Mit vorheriger Texterkennung bleibt die Datei durchsuchbar.')),
    knoepfe: [
      { beschriftung: 'Abbrechen' },
      {
        beschriftung: 'Verkleinern', betont: true,
        tun: () => mitLader('Seiten werden neu berechnet …', async () => {
          const bytes = await verkleinere({ dichte: Number(dichte.value), guete: Number(guete.value) });
          const name = vorschlagsname('-klein');
          sichereBytes(bytes, name);
          const anteil = jetzt ? Math.round((1 - bytes.length / jetzt) * 100) : 0;
          sage(anteil > 0
            ? `${groesse(jetzt)} → ${groesse(bytes.length)} (${anteil} % kleiner)`
            : `${groesse(bytes.length)} — nicht kleiner geworden, das Original war schon sparsam`);
        }),
      },
    ],
  });
}

function frageKennwort(name, wiederholung) {
  return new Promise((loese) => {
    const feld = el('input', { klasse: 'feld', type: 'password', stil: { flex: '1' }, placeholder: 'Kennwort' });
    const dialog = zeigeDialog({
      titel: wiederholung ? 'Kennwort stimmt nicht' : 'Datei ist geschützt',
      rumpf: el('div', {},
        el('p', { text: `„${name}" ist mit einem Kennwort verschlossen.` }),
        el('div', { klasse: 'zeile' }, el('label', { text: 'Kennwort' }), feld),
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

function zeigeTeilenDialog() {
  const proDatei = el('input', { klasse: 'feld', type: 'number', min: '1', value: '1', stil: { width: '6rem' } });
  const rumpf = el('div', {},
    el('p', { klasse: 'hinweis', text: `${zustand.folge.length} Seiten werden in gleich große Teile zerlegt und einzeln heruntergeladen.` }),
    el('div', { klasse: 'zeile' }, el('label', { text: 'Seiten je Datei' }), proDatei));
  zeigeDialog({
    titel: 'Dokument teilen',
    rumpf,
    knoepfe: [
      { beschriftung: 'Abbrechen' },
      { beschriftung: 'Teilen', betont: true, tun: () => mitLader('Teile werden geschrieben …', () => teileDokument(Math.max(1, Number(proDatei.value) || 1))) },
    ],
  });
}

function zeigeMusterDialog() {
  const liste = musterListe();
  if (!liste.length) return sage('Keine Fundstellen');
  const rumpf = el('div', {});
  for (const fund of liste.slice(0, 200)) {
    rumpf.append(el('button', {
      klasse: 'eintrag',
      beiClick: () => { schliesseDialog(); zeigeSeite(fund.seite); },
    },
      el('div', { klasse: 'eintrag-kopf' },
        el('strong', { text: fund.art }),
        el('span', { klasse: 'marke', text: `S. ${fund.seite}` })),
      el('div', { klasse: 'eintrag-zeile', text: fund.text })));
  }
  zeigeDialog({
    titel: `${liste.length} personenbezogene Fundstellen`,
    rumpf: el('div', {}, el('p', { klasse: 'hinweis', text: 'Muster-Erkennung, keine Rechtsberatung. Prüfen Sie jede Stelle selbst — und schwärzen Sie mit dem Werkzeug S.' }), rumpf),
    knoepfe: [{ beschriftung: 'Schwärzen-Werkzeug', tun: () => setzeWerkzeug('schwaerzen') }, { beschriftung: 'Schließen', betont: true }],
  });
}

function zeigeHilfe() {
  const gruppen = new Map();
  for (const b of befehle.filter((b) => b.kuerzel)) {
    if (!gruppen.has(b.gruppe)) gruppen.set(b.gruppe, []);
    gruppen.get(b.gruppe).push(b);
  }
  const rumpf = el('div', {});
  for (const [gruppe, liste] of gruppen) {
    rumpf.append(el('h3', { text: gruppe, klasse: 'klein leise', stil: { margin: '.75rem 0 .25rem' } }));
    for (const b of liste) {
      rumpf.append(el('div', { klasse: 'merkmal' }, el('span', { text: b.name }), el('span', { klasse: 'marke', text: b.kuerzel })));
    }
  }
  rumpf.append(el('h3', { text: 'Ohne Befehl', klasse: 'klein leise', stil: { margin: '.75rem 0 .25rem' } }));
  for (const [was, taste] of [
    ['Werkzeug abwählen, Dialog schließen', 'Esc'],
    ['Text markieren und Werkzeugtaste drücken — wendet es sofort an', 'H / U / D'],
    ['Markierten Text kopieren (wie überall im Browser)', 'Strg+C'],
    ['Seiten mehrfach wählen', 'Umschalt- oder Strg-Klick in den Miniaturen'],
    ['Seiten umsortieren', 'Miniatur ziehen'],
  ]) rumpf.append(el('div', { klasse: 'merkmal' }, el('span', { text: was }), el('span', { klasse: 'marke', text: taste })));

  rumpf.append(el('h3', { text: 'Was diese Werkbank nicht kann', klasse: 'klein leise', stil: { margin: '1rem 0 .25rem' } }));
  for (const satz of [
    'Kryptografisch signieren nach eIDAS — die Unterschrift ist ein Bild, kein Zertifikat.',
    'Ersetzter Text wird in Helvetica gesetzt, nicht in der Originalschrift.',
    'Nach Word oder Excel ausgeben — hier gibt es PDF, Text und PNG.',
    'Ein unbekanntes Kennwort erraten. Entschlüsseln geht nur mit Kennwort.',
    'Lesezeichen bleiben nur erhalten, solange die Seitenfolge unverändert ist.',
  ]) rumpf.append(el('p', { klasse: 'hinweis', text: `· ${satz}` }));

  zeigeDialog({ titel: 'Tastenkürzel und Grenzen', rumpf, knoepfe: [{ beschriftung: 'Schließen', betont: true }] });
}

/* ---------- Befehlspalette --------------------------------------------------- */

function zeigePalette() {
  let gewaehlt = 0;
  let gefiltert = befehle;
  const feld = el('input', { placeholder: 'Befehl suchen — z. B. „drehen", „schwärzen", „teilen"', 'aria-label': 'Befehl suchen' });
  const liste = el('div', { klasse: 'palette-liste' });

  const zeichne = () => {
    liste.innerHTML = '';
    gefiltert.slice(0, 40).forEach((b, i) => {
      liste.append(el('div', {
        klasse: `palette-treffer ${i === gewaehlt ? 'ist-aktiv' : ''}`,
        beiClick: () => { schliesseDialog(); b.tun(); },
        beiMousemove: () => { if (gewaehlt !== i) { gewaehlt = i; zeichne(); } },
      },
        el('span', {}, b.name, el('span', { klasse: 'gruppe', text: ` · ${b.gruppe}` })),
        el('span', { klasse: 'kuerzel', text: b.kuerzel || '' })));
    });
    if (!gefiltert.length) liste.append(el('p', { klasse: 'hinweis', text: 'Kein Befehl gefunden.' }));
  };

  feld.addEventListener('input', () => {
    const wort = feld.value.trim().toLowerCase();
    gefiltert = wort
      ? befehle.filter((b) => `${b.name} ${b.gruppe} ${b.id}`.toLowerCase().includes(wort))
      : befehle;
    gewaehlt = 0;
    zeichne();
  });
  feld.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); gewaehlt = Math.min(gewaehlt + 1, Math.min(gefiltert.length, 40) - 1); zeichne(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); gewaehlt = Math.max(0, gewaehlt - 1); zeichne(); }
    if (e.key === 'Enter') { e.preventDefault(); const b = gefiltert[gewaehlt]; if (b) { schliesseDialog(); b.tun(); } }
  });

  const schirm = $('#schirm');
  schirm.innerHTML = '';
  schirm.append(el('div', { klasse: 'dialog palette' }, feld, liste));
  schirm.hidden = false;
  zeichne();
  feld.focus();
}

/* ---------- Suchtreffer hervorheben ------------------------------------------ */

async function hebeTrefferHervor() {
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
    titel: 'Notiz',
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
      el('div', { klasse: 'zeile' }, el('label', { text: 'Art' }), artwahl),
      el('div', { klasse: 'zeile' }, el('label', { text: 'Name' }), namensfeld),
      optionenZeile,
      el('div', { klasse: 'zeile' }, el('label', { text: 'Pflichtfeld' }),
        el('label', { stil: { minWidth: 'auto', display: 'flex', gap: '.4rem' } }, pflicht, 'muss ausgefüllt werden')),
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

function ersetzeText(stelle) {
  const feld = el('input', { klasse: 'feld', stil: { flex: '1' }, value: stelle.text });
  const rastern = el('input', { type: 'checkbox' });
  const groesse = el('input', { type: 'number', klasse: 'feld', step: '0.5', min: '3', max: '96', value: stelle.groesse.toFixed(1), stil: { width: '6rem' } });

  zeigeDialog({
    titel: 'Text ersetzen',
    rumpf: el('div', {},
      el('div', { klasse: 'zeile' }, el('label', { text: 'Bisher' }), el('span', { klasse: 'leise', text: stelle.text })),
      el('div', { klasse: 'zeile' }, el('label', { text: 'Neu' }), feld),
      el('div', { klasse: 'zeile' }, el('label', { text: 'Schriftgröße' }), groesse,
        el('span', { klasse: 'hinweis', text: 'pt' })),
      el('div', { klasse: 'zeile' }, el('label', { text: 'Alten Text' }),
        el('label', { stil: { minWidth: 'auto', display: 'flex', gap: '.4rem' } }, rastern, 'wirklich entfernen (Seite wird zum Bild)')),
      el('p', { klasse: 'hinweis' },
        'Ohne Haken wird der alte Text überdeckt und neu gesetzt — er steckt dann noch in der Datei und ließe sich auslesen. ',
        'Mit Haken wird die Seite gerastert: der alte Text ist wirklich fort, dafür ist die restliche Seite danach ein Bild. ',
        'Ersetzter Text wird in Helvetica gesetzt; bei ausgefallenen Schriften fällt der Unterschied auf.')),
    knoepfe: [
      { beschriftung: 'Abbrechen' },
      {
        beschriftung: 'Ersetzen', betont: true,
        tun: () => {
          if (!feld.value.length) return;
          fuegeAn({
            art: 'ersatz', seiteId: stelle.seiteId,
            x: stelle.x, y: stelle.y, b: stelle.b, h: stelle.h,
            text: feld.value, alt: stelle.text,
            groesse: Number(groesse.value) || stelle.groesse,
            grundfarbe: stelle.grundfarbe, schriftfarbe: stelle.schriftfarbe,
            rastern: rastern.checked,
          });
        },
      },
    ],
  });
  setTimeout(() => { feld.focus(); feld.select(); }, 30);
}

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
    zeichneRechteTafel();
    zeichneRechteTafeln();
    aktualisiereFuss();
  });
  hoer('dokument:geaendert', () => {
    ($('#titel-zusatz') || {}).textContent = `${zustand.folge.length} Seiten${zustand.geaendert ? ' · ungesichert' : ''}${zustand.quellen.size > 1 ? ` · ${zustand.quellen.size} Quellen` : ''}`;
    zeichneRechteTafel();
  });
  hoer('seite:gewechselt', aktualisiereFuss);
  hoer('mappen:geaendert', zeichneDokumentreiter);
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
