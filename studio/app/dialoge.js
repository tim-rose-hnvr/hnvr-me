/* Dialoge — alles, was sich als Fenster über das Studio legt.

   Vorher standen diese siebzehn Dialoge in `oberflaeche.js`, zusammen mit der
   Werkzeugzeile, den Reitern, den Tafeln und dem Befehlsregister: 2511 Zeilen
   in einer Datei. Wer einen Dialog ändern wollte, musste an allem anderen
   vorbeilesen.

   Sie liegen jetzt hier. Der Ring zu `oberflaeche.js` ist gewollt und
   funktioniert, weil beide Seiten erst beim Aufruf aufeinander zugreifen,
   nicht beim Laden — dieselbe Regel wie bei `menue.js`. Wer hier etwas
   ergänzt, muss die Reihenfolge der Importe nicht bedenken, nur die
   Aufrufzeit.

   Was hier **nicht** hingehört: Zustand. Ein Dialog liest `zustand`, ruft
   einen Befehl und schließt sich wieder. Alles, was zwischen zwei Dialogen
   überdauern muss, steht im Kern. */

import {
  zustand, melde, el, $, $$, sage, zeigeDialog, zeigeFormular, zeile, schliesseDialog,
  groesse, datum, mitLader, sichereBytes,
} from './kern.js';
import { nummerVon } from './dokument.js';
import { zeigeSeite } from './ansicht.js';
import { waehleAn, FELDARTEN, fuegeAn } from './anmerkungen.js';
import { weiter } from './suche.js';
import { hatFormular } from './formulare.js';
import { befunde, musterListe } from './mitdenken.js';
import {
  sichereDokument, teileDokument, istUnveraendertesGeruest, vorschlagsname, verkleinere,
} from './ausgabe.js';
import { alsWord } from './word.js';
import { alsExcel } from './excel.js';
import { pruefe as pruefeZugang, SPRACHEN } from './barrierefrei.js';
import { oeffneAusweis } from './signieren.js';
import { VORGABE as AUFDRUCK_VORGABE, setzeAufdruck, hatAufdruck } from './aufdruck.js';
import { erkenneFelder } from './felderkennen.js';
import {
  lesezeichenListe, setzeLesezeichen, anhaenge, fuegeAnhangAn, entferneAnhang,
  lieseAnhaenge, vorabpruefung,
} from './dokumentteile.js';
import {
  istInstalliert, kannInstallieren, dienstLaeuft, frageInstallation, holeVorrat, vorratsGroesse,
} from './installieren.js';
/* Aus der Oberfläche: das Befehlsregister, die Einstellungen und die zwei
   Wege, die ein Dialog auslösen können muss. Der Ring ist unbedenklich —
   siehe oben. */
import {
  befehle, fuehreAus, setzeWerkzeug, sichereMit,
  EINSTELLUNGEN, KATEGORIEN, FASSUNG, einstellung, wendeAn,
} from './oberflaeche.js';

export function zeigeEigenschaften() {
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
export function zeigeSicherungsDialog() {
  zeigeFormular({
    titel: 'Sichern unter',
    felder: [
      { name: 'dateiname', beschriftung: 'Dateiname', wert: vorschlagsname() },
      hatFormular()
        ? { name: 'einbrennen', beschriftung: 'Formular', kasten: 'Werte fest einbrennen (nicht mehr änderbar)', wert: true }
        : null,
      { name: 'metadatenWeg', beschriftung: 'Metadaten', kasten: 'Verfasser und Erzeuger entfernen' },
      zustand.gewaehlteSeiten.size
        ? { name: 'nurAuswahl', beschriftung: 'Umfang', kasten: `nur die ${zustand.gewaehlteSeiten.size} gewählten Seiten` }
        : null,
    ],
    hinweise: [
      istUnveraendertesGeruest()
        ? 'Das Original wird geöffnet und ergänzt: Lesezeichen, Formularstruktur und Metadaten bleiben erhalten.'
        : 'Seitenfolge, Drehung oder Schwärzung wurden geändert — das Dokument wird neu aufgebaut. Formularwerte werden dabei fest eingebrannt, Lesezeichen gehen verloren.',
    ],
    tat: {
      beschriftung: 'Sichern',
      tun: ({ dateiname, einbrennen, metadatenWeg, nurAuswahl }) => {
        sichereMit({
          dateiname: dateiname.endsWith('.pdf') ? dateiname : `${dateiname}.pdf`,
          formularEinbrennen: einbrennen === true,
          metadatenEntfernen: metadatenWeg === true,
          seiten: nurAuswahl === true ? [...zustand.gewaehlteSeiten] : null,
        });
      },
    },
  });
}
/* Der Stapel geht bewusst nicht über das offene Dokument, sondern über
   gewählte Dateien: was hier läuft, braucht keinen Menschen, der hinsieht.
   Alles, was eine Entscheidung braucht — schwärzen, anmerken, ausfüllen —
   bleibt draußen. */
export async function zeigeStapelDialog() {
  const { SCHRITTE, benoetigt, laufeStapel, packe } = await import('./stapel.js');

  const kaesten = new Map();
  const kennwort = el('input', { klasse: 'feld', type: 'password', placeholder: 'Kennwort der Dateien' });
  const neuesKennwort = el('input', { klasse: 'feld', type: 'password', placeholder: 'Neues Kennwort' });
  const winkel = el('select', { klasse: 'feld' },
    el('option', { value: '90', text: 'nach rechts (90°)' }),
    el('option', { value: '-90', text: 'nach links (−90°)' }),
    el('option', { value: '180', text: 'auf den Kopf (180°)' }));
  const zusatz = {
    kennwort: el('div', { klasse: 'zeile', hidden: true }, el('label', { text: 'Kennwort' }), kennwort),
    neuesKennwort: el('div', { klasse: 'zeile', hidden: true }, el('label', { text: 'Neues Kennwort' }), neuesKennwort),
    winkel: el('div', { klasse: 'zeile', hidden: true }, el('label', { text: 'Drehen um' }), winkel),
  };

  const gewaehlte = () => [...kaesten.entries()].filter(([, k]) => k.checked).map(([id]) => id);
  const frischeZusatz = () => {
    const noetig = benoetigt(gewaehlte());
    for (const [schluessel, knoten] of Object.entries(zusatz)) knoten.hidden = !noetig.includes(schluessel);
  };

  const auswahlListe = el('div', {}, ...SCHRITTE.map((schritt) => {
    const kasten = el('input', { type: 'checkbox', beiChange: frischeZusatz });
    kaesten.set(schritt.id, kasten);
    return el('label', { klasse: 'stapel-schritt' },
      kasten,
      el('span', {}, el('strong', { text: schritt.name }),
        el('span', { klasse: 'leise klein', text: ` — ${schritt.hinweis}` })));
  }));

  const dateiwahl = el('input', { type: 'file', accept: 'application/pdf,.pdf', multiple: true, klasse: 'feld' });
  const stand = el('p', { klasse: 'hinweis', text: 'Noch nichts gewählt.' });
  dateiwahl.addEventListener('change', () => {
    const zahl = dateiwahl.files?.length || 0;
    stand.textContent = zahl ? `${zahl} Datei${zahl === 1 ? '' : 'en'} gewählt.` : 'Noch nichts gewählt.';
  });

  zeigeDialog({
    titel: 'Stapel — dieselbe Arbeit an vielen Dateien',
    breit: true,
    rumpf: el('div', {},
      zeile('Dateien', dateiwahl),
      stand,
      el('p', { klasse: 'hinweis' }, el('strong', { text: 'Schritte' }),
        ' — sie laufen immer in dieser Reihenfolge, nicht in der des Anklickens.'),
      auswahlListe,
      zusatz.kennwort, zusatz.neuesKennwort, zusatz.winkel,
      el('p', { klasse: 'hinweis klein' },
        'Das Ergebnis kommt als ZIP-Archiv, mit einem Bericht darin: welche Datei gelungen ist, ',
        'welche nicht und warum. Eine gescheiterte Datei hält den Lauf nicht auf.')),
    knoepfe: [
      { beschriftung: 'Abbrechen' },
      {
        beschriftung: 'Stapel starten',
        betont: true,
        tun: () => {
          const dateien = [...(dateiwahl.files || [])];
          const schritte = gewaehlte();
          if (!dateien.length) { sage('Erst Dateien wählen', { art: 'warn' }); return false; }
          if (!schritte.length) { sage('Erst mindestens einen Schritt wählen', { art: 'warn' }); return false; }
          setTimeout(async () => {
            const ergebnisse = await mitLader('Stapel läuft …', () => laufeStapel(
              dateien, schritte,
              { kennwort: kennwort.value, neuesKennwort: neuesKennwort.value, winkel: winkel.value },
              ({ nummer, gesamt, datei, schritt }) => {
                const anzeige = $('#lader-text');
                if (anzeige) anzeige.textContent = `${nummer}/${gesamt} · ${datei} · ${schritt} …`;
              }));
            const gelungen = ergebnisse.filter((e) => e.bytes).length;
            if (!gelungen) {
              sage('Keine Datei ließ sich verarbeiten — der Bericht sagt, woran es lag.', { art: 'fehler', dauer: 8000 });
            }
            const archiv = await packe(ergebnisse, schritte);
            sichereBytes(archiv, 'stapel.zip', 'application/zip');
            sage(`${gelungen} von ${ergebnisse.length} Dateien verarbeitet — als stapel.zip gesichert`, { dauer: 7000 });
          }, 0);
        },
      },
    ],
  });
}
/* Kalibrieren heißt: eine Strecke ziehen, deren wahre Länge man kennt, und
   sie eintragen. Ohne das misst das Studio in Papiermaß — auf einem
   Grundriss 1:50 wären das die Millimeter auf dem Blatt, nicht die im Haus.
   Der Dialog sagt das, statt es vorauszusetzen. */
export async function zeigeMassstabDialog() {
  const m = await import('./messen.js');
  const strecken = m.messungen().filter((a) => a.art === 'messen');
  const jetzt = m.massstab();

  const auswahl = el('select', { klasse: 'feld' },
    ...strecken.map((a, i) => el('option', {
      value: a.id,
      selected: a.id === zustand.gewaehlteAnmerkung,
      text: `Strecke ${i + 1} auf Seite ${nummerVon(a.seiteId)} — ${m.alsLaenge(m.laengeInPunkten(a), jetzt)}`,
    })));
  const laenge = el('input', { klasse: 'feld', type: 'number', step: 'any', min: '0', placeholder: 'z. B. 3,50' });
  const einheit = el('select', { klasse: 'feld' },
    ...Object.entries(m.EINHEITEN).map(([schluessel, wert]) => el('option', {
      value: schluessel, selected: schluessel === jetzt.einheit, text: `${wert.name} (${schluessel})`,
    })));

  const rumpf = el('div', {},
    el('p', { klasse: 'hinweis' },
      'Zurzeit gilt: ', el('strong', { text: jetzt.benannt ? m.verhaeltnis(jetzt) : 'Papiermaß (1:1)' }),
      jetzt.benannt ? '' : ' — gemessen wird, was auf dem Blatt steht.'),
    strecken.length
      ? el('div', {},
        zeile('Welche Strecke?', auswahl),
        zeile('Wie lang ist sie wirklich?', laenge),
        zeile('Einheit', einheit))
      : el('div', {},
        el('p', { klasse: 'hinweis ist-warnung' },
          'Zum Kalibrieren fehlt eine Strecke. Erst mit dem Werkzeug „Strecke messen" eine ',
          'Länge ziehen, die Sie kennen — dann hier eintragen, wie lang sie wirklich ist.'),
        zeile('Einheit', einheit)),
    el('p', { klasse: 'hinweis klein' },
      'Ein PDF-Punkt ist 1/72 Zoll. Auf dem Papier stimmt das Maß deshalb auch ohne ',
      'Kalibrierung — sie wird erst gebraucht, wenn die Zeichnung selbst einen Maßstab hat.'));

  zeigeDialog({
    titel: 'Maßstab festlegen',
    rumpf,
    knoepfe: [
      { beschriftung: 'Abbrechen' },
      {
        beschriftung: 'Auf Papiermaß zurücksetzen',
        tun: () => { zustand.massstab = null; melde('anmerkungen:geaendert'); sage('Maßstab zurückgesetzt — es gilt wieder das Papiermaß'); },
      },
      {
        beschriftung: strecken.length ? 'Maßstab setzen' : 'Einheit übernehmen',
        betont: true,
        tun: () => {
          if (!strecken.length) {
            m.setzeEinheit(einheit.value);
            melde('anmerkungen:geaendert');
            sage(`Einheit: ${m.EINHEITEN[einheit.value].name}`);
            return;
          }
          const strecke = strecken.find((a) => a.id === auswahl.value);
          const wert = Number(String(laenge.value).replace(',', '.'));
          try {
            const gesetzt = m.kalibriere(m.laengeInPunkten(strecke), wert, einheit.value);
            melde('anmerkungen:geaendert');
            sage(`Maßstab ${m.verhaeltnis(gesetzt)} — alle Messungen sind neu gerechnet`, { dauer: 5000 });
          } catch (fehler) {
            sage(fehler.message, { art: 'fehler' });
            return false;
          }
        },
      },
    ],
  });
}
export async function zeigeMessungen() {
  const m = await import('./messen.js');
  const liste = m.messungen();
  const jetzt = m.massstab();

  const rumpf = el('div', {},
    el('p', { klasse: 'hinweis' },
      'Maßstab: ', el('strong', { text: jetzt.benannt ? m.verhaeltnis(jetzt) : 'Papiermaß (1:1)' })),
    liste.length
      ? el('table', { klasse: 'liste-tafel' },
        el('thead', {}, el('tr', {},
          el('th', { text: 'Art' }), el('th', { text: 'Seite' }), el('th', { text: 'Maß' }))),
        el('tbody', {}, ...liste.map((a) => el('tr', {
          klasse: 'anklickbar',
          beiClick: () => { schliesseDialog(); zeigeSeite(nummerVon(a.seiteId)); waehleAn(a.id); },
        },
          el('td', { text: a.art === 'messen' ? 'Strecke' : 'Fläche' }),
          el('td', { text: String(nummerVon(a.seiteId)) }),
          el('td', { text: m.beschriftung(a, jetzt) })))))
      : el('p', { klasse: 'hinweis' }, 'Noch nichts gemessen. Werkzeug „Strecke messen" (L) oder „Fläche messen" (A).'),
    liste.length
      ? el('p', { klasse: 'hinweis' },
        el('strong', { text: 'Summen: ' }),
        `${m.summeStrecken(jetzt)} an Strecken, ${m.summeFlaechen(jetzt)} an Fläche.`)
      : null);

  zeigeDialog({
    titel: 'Messungen',
    rumpf,
    knoepfe: [
      { beschriftung: 'Maßstab festlegen …', tun: () => { setTimeout(zeigeMassstabDialog, 0); } },
      { beschriftung: 'Schließen', betont: true },
    ],
  });
}
/* Der Dialog sagt vorher, was ankommt und was nicht. Das ist wichtiger als es
   klingt: wer eine Word-Datei mit Kopfzeile, Logo und Fußnoten umwandelt und
   das nicht wusste, hält das Studio für kaputt. Sie ist es nicht — sie
   nimmt den Text und lässt das Layout. */
export function zeigeEinlesenDialog() {
  const rumpf = el('div', {},
    el('p', { klasse: 'hinweis' },
      'Aus einer Word-, Excel-, Text-, Markdown- oder CSV-Datei wird ein PDF — im Browser, ',
      'ohne dass die Datei das Gerät verlässt.'),
    el('p', { klasse: 'hinweis' },
      el('strong', { text: 'Was ankommt: ' }),
      'Überschriften, Absätze, Aufzählungen, Tabellen, fett und kursiv. Bei Excel jedes ',
      'Blatt als eigene Tabelle.'),
    el('p', { klasse: 'hinweis' },
      el('strong', { text: 'Was nicht: ' }),
      'Bilder, Kopf- und Fußzeilen, Fußnoten, Spalten, Farben, Rahmen und die genaue ',
      'Nummerierung. Das Studio setzt in Helvetica auf A4.'),
    el('p', { klasse: 'hinweis' },
      'Das Ergebnis wird gleich geöffnet — Sie können es also ansehen, ergänzen und dann sichern.'));

  zeigeDialog({
    titel: 'PDF aus Word, Excel oder Text',
    rumpf,
    knoepfe: [
      { beschriftung: 'Abbrechen' },
      { beschriftung: 'Datei wählen …', betont: true, tun: () => { $('#dateiwahl-einlesen').click(); } },
    ],
  });
}
/* Welche Kategorie zuletzt offen war — der Dialog kommt dorthin zurück. */
let offeneKategorie = 'Allgemein';

export function zeigeEinstellungen(kategorie = offeneKategorie) {
  offeneKategorie = kategorie;
  const inhalt = el('div', { klasse: 'einst-inhalt' });
  const liste = el('nav', { klasse: 'einst-kategorien' });

  const zeichneInhalt = () => {
    inhalt.innerHTML = '';
    inhalt.append(el('h3', { text: offeneKategorie }));

    if (offeneKategorie === 'Signaturen') {
      inhalt.append(el('p', { klasse: 'hinweis' },
        'Unterschrieben wird mit einem Zertifikat aus einer .p12-Datei — unter „Schutz → Digital unterschreiben". ',
        'Es gibt hier nichts einzustellen: das Studio speichert weder Zertifikat noch Kennwort, weil beides ',
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

  /* Abzeichen an einer Kategorie wie im Handoff: eine Zahl, die sagt, dass
     dort etwas offen ist. Sie wird gerechnet, nicht gesetzt — ein Abzeichen,
     das immer dieselbe Zahl zeigt, ist Zierrat. */
  const abzeichen = (name) => {
    if (name === 'OCR & Text') return befunde.leereSeiten.length;
    if (name === 'Anmerkungen') return zustand.anmerkungen.filter((a) => !a.erledigt).length;
    if (name === 'Speicher & Privatsphäre') return musterListe().length;
    return 0;
  };

  for (const name of KATEGORIEN) {
    const zahl = abzeichen(name);
    liste.append(el('button', {
      klasse: `einst-kategorie ${name === offeneKategorie ? 'ist-aktiv' : ''}`,
      daten: { kategorie: name },
      beiClick: () => { offeneKategorie = name; liste.querySelectorAll('.einst-kategorie').forEach((k) => k.classList.toggle('ist-aktiv', k.dataset.kategorie === name)); zeichneInhalt(); },
    },
      el('span', { text: name }),
      zahl ? el('span', { klasse: 'einst-abzeichen', text: String(zahl) }) : null));
  }
  /* Das Handoff setzt die Fassung unter die Kategorien. Sie steht hier, weil
     es der einzige Ort ist, an dem jemand danach sucht. */
  liste.append(el('div', { klasse: 'einst-fassung' },
    el('div', { klasse: 'mono', text: 'FASSUNG' }),
    el('div', { klasse: 'mono', text: `${FASSUNG} · örtlich` })));

  zeichneInhalt();

  zeigeDialog({
    titel: 'Einstellungen',
    breit: true,
    rumpf: el('div', { klasse: 'einstellungen' }, liste, inhalt),
    fussHinweis: 'Änderungen wirken sofort — für diese Sitzung.',
    knoepfe: [{ beschriftung: 'Schließen', betont: true }],
  });
}
export function zeigeSignaturDialog() {
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
      zeile('Ausweisdatei', dateifeld),
      zeile('Kennwort', kennwortfeld),
      bericht,
      zeile('Grund', grundfeld),
      zeile('Ort', ortfeld),
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
export function zeigeBarrierefreiDialog() {
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
      el('p', { klasse: 'hinweis', text: 'Was sich ohne Vermutung setzen lässt, setzt das Studio beim nächsten Sichern:' }),
      zeile('Sprache', sprachwahl),
      zeile('Titel', titelfeld),
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
export function zeigeExcelDialog() {
  zeigeFormular({
    titel: 'Nach Excel ausgeben',
    felder: [
      {
        name: 'umfang', beschriftung: 'Umfang',
        wahl: [
          ['alle', `Alle Seiten (${zustand.folge.length})`],
          ['auswahl', `Gewählte Seiten (${zustand.gewaehlteSeiten.size})`],
        ],
      },
      {
        name: 'weg', beschriftung: 'Weg',
        wahl: [['tabellen', 'Nur erkannte Tabellen'], ['alles', 'Jede Zeile ins Raster']],
      },
    ],
    hinweise: [
      'Ein PDF kennt keine Tabellen, nur Buchstaben an Punkten. Als Tabelle gilt hier, '
      + 'was in mindestens drei Zeilen hintereinander an denselben Stellen beginnt. '
      + 'Findet das nichts, holt „Jede Zeile ins Raster" den Text trotzdem — dann steht '
      + 'auch Fließtext in den Zellen.',
      'Je Seite entsteht ein Blatt. Zahlen werden als Zahlen geschrieben, damit sich '
      + 'damit rechnen lässt; Bestellnummern mit führender Null bleiben Text. '
      + 'Nicht übernommen: Rahmen, Farben, verbundene Zellen, Formeln, Bilder.',
    ],
    tat: {
      beschriftung: 'Ausgeben',
      tun: ({ umfang, weg }) => mitLader('Tabellen werden gelesen …', async () => {
        try {
          const { bytes, blaetter, zeilen, zellen, uebersprungen } = await alsExcel({
            seiten: umfang === 'auswahl' && zustand.gewaehlteSeiten.size ? [...zustand.gewaehlteSeiten] : null,
            nurTabellen: weg === 'tabellen',
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
  });
}
export function zeigeWordDialog() {
  zeigeFormular({
    titel: 'Nach Word ausgeben',
    felder: [
      {
        name: 'umfang', beschriftung: 'Umfang',
        wahl: [
          ['alle', `Alle Seiten (${zustand.folge.length})`],
          ['auswahl', `Gewählte Seiten (${zustand.gewaehlteSeiten.size})`],
        ],
      },
      { name: 'ueberschriften', beschriftung: 'Überschriften', kasten: 'aus der Schriftgröße erkennen', wert: true },
      { name: 'umbrueche', beschriftung: 'Seiten', kasten: 'Seitenumbrüche übernehmen', wert: true },
    ],
    hinweise: [
      'Übernommen werden Absätze, Überschriften, fette und kursive Stellen. '
      + 'Nicht übernommen werden Spalten, Tabellenraster und Bilder — ein PDF beschreibt Buchstaben an Punkten, keine Absätze. '
      + 'Wer das Aussehen braucht, gibt das PDF weiter; wer weiterschreiben will, nimmt diese Datei.',
      zustand.ocr.size
        ? 'Erkannter Text aus Scans wandert mit.'
        : 'Seiten ohne Textebene bleiben leer — dafür erst die Texterkennung laufen lassen.',
    ],
    tat: {
      beschriftung: 'Ausgeben',
      tun: ({ umfang, ueberschriften, umbrueche }) => mitLader('Word-Datei wird geschrieben …', async () => {
        const { bytes, woerter, absaetze, seitenOhneText } = await alsWord({
          seiten: umfang === 'auswahl' && zustand.gewaehlteSeiten.size ? [...zustand.gewaehlteSeiten] : null,
          ueberschriftenErkennen: ueberschriften,
          seitenumbrueche: umbrueche,
        });
        sichereBytes(bytes, vorschlagsname('').replace(/\.pdf$/i, '.docx'),
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        sage(seitenOhneText
          ? `${woerter} Wörter in ${absaetze} Absätzen — ${seitenOhneText} Seite${seitenOhneText === 1 ? '' : 'n'} ohne Text blieb leer`
          : `${woerter} Wörter in ${absaetze} Absätzen ausgegeben`, { dauer: 6000 });
      }),
    },
  });
}
export function zeigeSchutzDialog() {
  zeigeFormular({
    titel: 'Mit Kennwort schützen',
    felder: [
      { name: 'benutzer', beschriftung: 'Öffnen-Kennwort', art: 'kennwort', platzhalter: 'zum Öffnen nötig' },
      { name: 'besitzer', beschriftung: 'Besitzer-Kennwort', art: 'kennwort', platzhalter: 'zum Ändern der Rechte' },
      {
        name: 'drucken', beschriftung: 'Drucken',
        wahl: [['full', 'erlaubt'], ['low', 'nur in niedriger Auflösung'], ['none', 'verboten']],
      },
      {
        name: 'aendern', beschriftung: 'Ändern',
        wahl: [
          ['all', 'alles erlaubt'],
          ['annotate', 'nur kommentieren und Formulare ausfüllen'],
          ['form', 'nur Formulare ausfüllen'],
          ['none', 'nichts erlaubt'],
        ],
      },
      { name: 'kopieren', beschriftung: 'Text kopieren', kasten: 'erlaubt', wert: true },
    ],
    hinweise: [
      'Verschlüsselt mit AES-256 durch qpdf, das hier als WebAssembly mitläuft. '
      + 'Ohne Öffnen-Kennwort lässt sich die Datei nicht mehr lesen — auch nicht von diesem Studio. '
      + 'Rechtebeschränkungen ohne Öffnen-Kennwort sind eine Bitte an den Betrachter, kein technischer Riegel.',
    ],
    tat: {
      beschriftung: 'Geschützt sichern',
      tun: (schutz) => {
        /* Ein Dokument ohne beide Kennwörter wäre unverschlüsselt — dann führt
           der Knopf in die Irre. `false` hält den Dialog offen. */
        if (!schutz.benutzer && !schutz.besitzer) { sage('Mindestens ein Kennwort angeben', { art: 'warn' }); return false; }
        sichereMit({ dateiname: vorschlagsname('-geschuetzt'), formularEinbrennen: false, schutz });
      },
    },
  });
}
export function zeigeVerkleinernDialog() {
  const jetzt = zustand.eigenschaften?.dateigroesse || 0;
  zeigeFormular({
    titel: 'Verkleinern',
    oben: `Zurzeit ${groesse(jetzt)}.`,
    felder: [
      {
        name: 'dichte', beschriftung: 'Auflösung', wert: '110',
        wahl: [
          ['72', '72 dpi — Bildschirm, kleinste Datei'],
          ['110', '110 dpi — Weitergabe per E-Mail'],
          ['150', '150 dpi — Ausdruck im Büro'],
          ['200', '200 dpi — sorgfältiger Ausdruck'],
        ],
      },
      {
        name: 'guete', beschriftung: 'Bildgüte', wert: 0.72,
        schieber: { von: 0.4, bis: 0.92, schritt: 0.02 },
        benennung: (w) => (w < 0.55 ? 'grob' : w < 0.75 ? 'mittel' : 'fein'),
      },
    ],
    hinweise: [
      zustand.ocr.size
        ? 'Die Seiten werden zu Bildern. Der erkannte Text wandert als unsichtbare Ebene mit — die Datei bleibt durchsuchbar.'
        : 'Die Seiten werden zu Bildern: kleiner, aber der Text ist danach nicht mehr auswählbar. Mit vorheriger Texterkennung bleibt die Datei durchsuchbar.',
    ],
    tat: {
      beschriftung: 'Verkleinern',
      tun: ({ dichte, guete }) => mitLader('Seiten werden neu berechnet …', async () => {
        const bytes = await verkleinere({ dichte: Number(dichte), guete });
        sichereBytes(bytes, vorschlagsname('-klein'));
        const anteil = jetzt ? Math.round((1 - bytes.length / jetzt) * 100) : 0;
        sage(anteil > 0
          ? `${groesse(jetzt)} → ${groesse(bytes.length)} (${anteil} % kleiner)`
          : `${groesse(bytes.length)} — nicht kleiner geworden, das Original war schon sparsam`);
      }),
    },
  });
}
export function zeigeTeilenDialog() {
  zeigeFormular({
    titel: 'Dokument teilen',
    oben: `${zustand.folge.length} Seiten werden in gleich große Teile zerlegt und einzeln heruntergeladen.`,
    felder: [
      { name: 'proDatei', beschriftung: 'Seiten je Datei', art: 'zahl', von: 1, wert: 1, stil: { width: '6rem' } },
    ],
    tat: {
      beschriftung: 'Teilen',
      tun: ({ proDatei }) => mitLader('Teile werden geschrieben …',
        () => teileDokument(Math.max(1, proDatei || 1))),
    },
  });
}
export function zeigeMusterDialog() {
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
export function zeigeHilfe() {
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

  rumpf.append(el('h3', { text: 'Was dieses Studio nicht kann', klasse: 'klein leise', stil: { margin: '1rem 0 .25rem' } }));
  for (const satz of [
    'Kryptografisch signieren nach eIDAS — die Unterschrift ist ein Bild, kein Zertifikat.',
    'Ersetzter Text wird in Helvetica gesetzt, nicht in der Originalschrift.',
    'Nach Word oder Excel ausgeben — hier gibt es PDF, Text und PNG.',
    'Ein unbekanntes Kennwort erraten. Entschlüsseln geht nur mit Kennwort.',
    'Lesezeichen bleiben nur erhalten, solange die Seitenfolge unverändert ist.',
  ]) rumpf.append(el('p', { klasse: 'hinweis', text: `· ${satz}` }));

  zeigeDialog({ titel: 'Tastenkürzel und Grenzen', rumpf, knoepfe: [{ beschriftung: 'Schließen', betont: true }] });
}
export function zeigePalette() {
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

/* Auf diesem Gerät einrichten.

   Drei Zustände, drei verschiedene Texte — und keiner davon lügt:

   - Schon installiert: dann steht hier, was das heißt, und wie man Vorrat holt.
   - Installierbar: der Browser hat sich gemeldet, es gibt einen echten Knopf.
   - Nicht installierbar: dann sagen wir den Weg von Hand, statt einen Knopf
     anzubieten, der nichts tut. Safari kennt kein `beforeinstallprompt`; dort
     geht es über „Teilen → Zum Dock" bzw. „Zum Home-Bildschirm".

   Der Vorrat ist ein eigener Knopf, nicht Teil des Einrichtens: neun Megabyte
   ungefragt zu ziehen, weil jemand ein Symbol im Dock wollte, wäre unhöflich. */
export function zeigeInstallDialog() {
  const stand = el('p', { klasse: 'hinweis' });
  const vorratKnopf = el('button', {
    klasse: 'knopf knopf-klein',
    text: 'Alles für offline sichern (9 MB)',
    title: 'Texterkennung, qpdf und die Zeichentabellen vorab holen',
    beiClick: async () => {
      vorratKnopf.disabled = true;
      try {
        const { fertig, gesamt } = await holeVorrat(({ fertig: f, gesamt: g }) => {
          stand.textContent = `${f} von ${g} Teilen gesichert …`;
        });
        stand.textContent = `${fertig} von ${gesamt} Teilen liegen jetzt auf dem Gerät.`;
        sage('Texterkennung und Kennwortschutz laufen jetzt auch ohne Netz.', { dauer: 6000 });
      } catch (fehler) {
        stand.textContent = fehler.message;
        vorratKnopf.disabled = false;
      }
    },
  });

  vorratsGroesse().then((bytes) => {
    if (bytes) stand.textContent = `Zurzeit liegen ${groesse(bytes)} auf diesem Gerät.`;
  });

  const laeuft = dienstLaeuft();
  const drin = istInstalliert();

  const rumpf = el('div', {},
    el('p', {}, drin
      ? 'Das Studio ist auf diesem Gerät eingerichtet. Sie startet ohne Verbindung, '
        + 'und die Dateien, die Sie öffnen, verlassen es weiterhin nicht.'
      : 'Das Studio lässt sich einrichten wie ein Programm: eigenes Fenster ohne Adresszeile, '
        + 'Symbol im Dock oder Startmenü, und es läuft ohne Verbindung.'),
    el('p', { klasse: 'hinweis' },
      'Es wird nichts heruntergeladen, was Sie auspacken müssten. Der Browser legt die '
      + 'PDF Studio auf dem Gerät ab — rund 4 MB fürs Lesen, Ordnen, Anmerken und Ausfüllen. '
      + 'Texterkennung und Kennwortschutz kommen beim ersten Gebrauch dazu.'),
    laeuft ? null : el('p', { klasse: 'hinweis' },
      'Auf dieser Adresse läuft noch kein Dienst — ohne ihn gibt es kein Offline. '
      + 'Das ist so, wenn das Studio über file:// oder in einem fremden Rahmen geöffnet wurde.'),
    drin || kannInstallieren() ? null : el('p', { klasse: 'hinweis' },
      'Dieser Browser bietet das Einrichten nicht von selbst an. In Safari geht es über '
      + '„Teilen → Zum Dock hinzufügen" (macOS) oder „Zum Home-Bildschirm" (iPhone, iPad); '
      + 'in Chrome und Edge über das Symbol rechts in der Adresszeile.'),
    zeile('Auf dem Gerät', stand),
    zeile('Vorrat', vorratKnopf));

  const knoepfe = [{ beschriftung: 'Schließen', betont: !kannInstallieren() }];
  if (!drin && kannInstallieren()) {
    knoepfe.push({
      beschriftung: 'Einrichten',
      betont: true,
      tun: () => {
        frageInstallation().then((antwort) => {
          if (antwort === 'dismissed') sage('Nicht eingerichtet — der Befehl steht weiter im Menü „Datei".');
        });
      },
    });
  }
  zeigeDialog({ titel: 'Auf diesem Gerät einrichten', rumpf, knoepfe });
}

/* Aufdruck — Wasserzeichen, Kopf- und Fußzeile, Seitenzahlen.

   Ein Dialog für drei Dinge, weil es dreimal dieselbe Frage ist: was steht auf
   jeder Seite, wo, ab wo. Getrennte Dialoge hätten dreimal dieselbe Zeile
   „ab Seite" und dreimal dieselbe Vorschau bedeutet.

   Der Aufdruck erscheint sofort auf der Bühne — nicht erst beim Sichern.
   Ein Wasserzeichen blind einzustellen und erst in der fertigen Datei zu
   sehen, dass es quer über der Unterschrift liegt, ist der Fehler, den
   Acrobats Vorschaufenster zu klein macht, um ihn zu verhindern. */
export function zeigeAufdruckDialog() {
  if (!zustand.folge.length) return sage('Kein Dokument geladen', { art: 'warn' });
  const jetzt = zustand.aufdruck || {};
  const w = { ...AUFDRUCK_VORGABE.wasserzeichen, ...(jetzt.wasserzeichen || {}), an: !!jetzt.wasserzeichen };
  const kopf = { ...AUFDRUCK_VORGABE.kopf, ...(jetzt.kopf || {}) };
  const fuss = { ...AUFDRUCK_VORGABE.fuss, ...(jetzt.fuss || {}) };
  const bates = { ...AUFDRUCK_VORGABE.bates, ...(jetzt.bates || {}) };

  /* Die Felder werden beim Tippen wirksam: die Bühne zeigt mit. Erst beim
     Schließen wird der Stand endgültig — „Abbrechen" stellt den alten
     wieder her. */
  const vorher = zustand.aufdruck;
  const feld = (wert, platzhalter, breit = false) => el('input', {
    klasse: 'feld', value: wert || '', placeholder: platzhalter,
    stil: breit ? { flex: '1' } : {},
  });

  const wAn = el('input', { type: 'checkbox', checked: w.an });
  const wText = feld(w.text, 'ENTWURF, VERTRAULICH, KOPIE …', true);
  const wGroesse = el('input', { klasse: 'feld', type: 'number', min: '8', max: '200', value: String(w.groesse), stil: { width: '5rem' } });
  const wWinkel = el('input', { klasse: 'feld', type: 'number', min: '-90', max: '90', value: String(w.winkel), stil: { width: '5rem' } });
  const wDeckung = el('input', { type: 'range', klasse: 'schieber', min: '0.04', max: '0.6', step: '0.02', value: String(w.deckung) });
  const wDeckungAnzeige = el('span', { klasse: 'hinweis', text: `${Math.round(w.deckung * 100)} %` });

  const kFelder = { links: feld(kopf.links, 'links'), mitte: feld(kopf.mitte, 'mittig'), rechts: feld(kopf.rechts, 'rechts') };
  const fFelder = { links: feld(fuss.links, 'links'), mitte: feld(fuss.mitte, 'mittig'), rechts: feld(fuss.rechts, 'rechts') };
  const abSeite = el('input', { klasse: 'feld', type: 'number', min: '1', max: String(zustand.folge.length), value: String(fuss.ersteSeite || 1), stil: { width: '5rem' } });
  const beginntBei = el('input', { klasse: 'feld', type: 'number', min: '0', value: String(fuss.beginntBei || 1), stil: { width: '5rem' } });
  const bPraefix = feld(bates.praefix, 'z. B. AKTE-');
  const bBeginn = el('input', { klasse: 'feld', type: 'number', min: '0', value: String(bates.beginn), stil: { width: '7rem' } });
  const bStellen = el('input', { klasse: 'feld', type: 'number', min: '1', max: '12', value: String(bates.stellen), stil: { width: '5rem' } });
  const bSuffix = feld(bates.suffix, 'z. B. -A');
  const bProbe = el('span', { klasse: 'mono klein leise' });

  const bereich = el('select', { klasse: 'feld' },
    el('option', { value: 'alle', text: 'alle Seiten' }),
    el('option', { value: 'ungerade', text: 'nur ungerade' }),
    el('option', { value: 'gerade', text: 'nur gerade' }));
  bereich.value = fuss.bereich || 'alle';

  const zusammen = () => {
    const gemein = {
      ersteSeite: Math.max(1, Number(abSeite.value) || 1),
      beginntBei: Number(beginntBei.value) || 1,
      bereich: bereich.value,
    };
    const kopfLeer = !kFelder.links.value && !kFelder.mitte.value && !kFelder.rechts.value;
    const fussLeer = !fFelder.links.value && !fFelder.mitte.value && !fFelder.rechts.value;
    const stand = {
      bates: {
        praefix: bPraefix.value,
        beginn: Number(bBeginn.value) || 0,
        stellen: Math.max(1, Math.min(12, Number(bStellen.value) || 6)),
        suffix: bSuffix.value,
      },
      wasserzeichen: wAn.checked && wText.value.trim() ? {
        ...AUFDRUCK_VORGABE.wasserzeichen,
        text: wText.value,
        groesse: Number(wGroesse.value) || 64,
        winkel: Number(wWinkel.value) || 0,
        deckung: Number(wDeckung.value),
        ...gemein,
      } : null,
      kopf: kopfLeer ? null : {
        ...AUFDRUCK_VORGABE.kopf,
        links: kFelder.links.value, mitte: kFelder.mitte.value, rechts: kFelder.rechts.value,
        ...gemein,
      },
      fuss: fussLeer ? null : {
        ...AUFDRUCK_VORGABE.fuss,
        links: fFelder.links.value, mitte: fFelder.mitte.value, rechts: fFelder.rechts.value,
        ...gemein,
      },
    };
    return stand.wasserzeichen || stand.kopf || stand.fuss ? stand : null;
  };

  /* Vorschau ohne Historieneintrag: sonst stünden hundert Schritte im Verlauf,
     einer je Tastendruck. Gemerkt wird erst beim Übernehmen. */
  const zeigeMit = () => {
    zustand.aufdruck = zusammen();
    wDeckungAnzeige.textContent = `${Math.round(Number(wDeckung.value) * 100)} %`;
    const b = zustand.aufdruck?.bates;
    bProbe.textContent = b
      ? `erste Seite: ${b.praefix}${String(b.beginn).padStart(b.stellen, '0')}${b.suffix}`
      : '';
    melde('aufdruck:geaendert');
    melde('seiten:geaendert');
  };
  for (const knoten of [wAn, wText, wGroesse, wWinkel, wDeckung, abSeite, beginntBei, bereich,
    bPraefix, bBeginn, bStellen, bSuffix,
    ...Object.values(kFelder), ...Object.values(fFelder)]) {
    knoten.addEventListener('input', zeigeMit);
    knoten.addEventListener('change', zeigeMit);
  }

  const dreiFelder = (felder) => el('div', { klasse: 'aufdruck-drei' }, felder.links, felder.mitte, felder.rechts);

  const rumpf = el('div', {},
    zeile('Wasserzeichen', el('label', { klasse: 'zeile-kasten' }, wAn, 'aufdrucken'), wText),
    zeile('Größe und Winkel', wGroesse, el('span', { klasse: 'hinweis', text: 'pt' }), wWinkel, el('span', { klasse: 'hinweis', text: 'Grad' })),
    zeile('Deckung', wDeckung, wDeckungAnzeige),
    el('p', { klasse: 'hinweis', text: 'Das Wasserzeichen liegt unter den Anmerkungen und über der Seite. Es wird beim Sichern eingerechnet, nicht nur angezeigt.' }),
    el('div', { klasse: 'dialog-trenner' }),
    zeile('Kopfzeile', dreiFelder(kFelder)),
    zeile('Fußzeile', dreiFelder(fFelder)),
    el('p', { klasse: 'hinweis' },
      'Felder in geschweiften Klammern werden ersetzt: ',
      el('code', { text: '{seite}' }), ' ', el('code', { text: '{seiten}' }), ' ',
      el('code', { text: '{datum}' }), ' ', el('code', { text: '{zeit}' }), ' ',
      el('code', { text: '{datei}' }), ' ', el('code', { text: '{titel}' }), ' ',
      el('code', { text: '{bates}' }), '.'),
    el('div', { klasse: 'dialog-trenner' }),
    zeile('Bates-Nummer', bPraefix, bBeginn, bStellen, bSuffix),
    zeile('Ergibt', bProbe),
    el('p', { klasse: 'hinweis' },
      'Präfix, erste Zahl, Stellen, Suffix. Die Bates-Nummer zählt nicht das ',
      'Dokument, sondern den Vorgang: sie läuft über Dokumentgrenzen hinweg weiter. ',
      'Für den zweiten Band setzen Sie die erste Zahl auf die Zahl nach der letzten ',
      'Seite des ersten — zwei Vorgänge dürfen nie dieselbe Nummer tragen. ',
      'Eingesetzt wird sie über ', el('code', { text: '{bates}' }), ' in Kopf- oder Fußzeile.'),
    el('div', { klasse: 'dialog-trenner' }),
    zeile('Ab Seite', abSeite, el('span', { klasse: 'hinweis', text: `von ${zustand.folge.length}` })),
    zeile('Zählung beginnt bei', beginntBei),
    zeile('Nur', bereich),
    el('p', { klasse: 'hinweis', text: 'Deckblatt und Inhaltsverzeichnis zählen in Gremienunterlagen selten mit: „ab Seite 3, Zählung beginnt bei 1" heißt, dass die dritte Seite die Eins trägt.' }));

  zeigeMit();

  /* Merkt sich, ob der Dialog mit einer Entscheidung verlassen wurde. Ohne
     das würde das Wegklicken die Vorschau stehen lassen. */
  let uebernommen = false;

  zeigeDialog({
    titel: 'Aufdruck: Wasserzeichen, Kopf- und Fußzeile',
    rumpf,
    breit: true,
    fussHinweis: 'Was hier steht, steht auf jeder Seite im Bereich — und in der gesicherten Datei.',
    beiSchliessen: () => {
      /* Wer den Dialog wegklickt, hat nicht übernommen. Zurück auf den Stand
         von vorher — sonst bleibt eine Vorschau als Ergebnis stehen. */
      if (!uebernommen) {
        zustand.aufdruck = vorher;
        melde('aufdruck:geaendert');
        melde('seiten:geaendert');
      }
    },
    knoepfe: [
      { beschriftung: 'Abbrechen' },
      ...(hatAufdruck() || vorher ? [{
        beschriftung: 'Entfernen',
        gefahr: true,
        tun: () => { uebernommen = true; zustand.aufdruck = vorher; setzeAufdruck(null); sage('Aufdruck entfernt'); },
      }] : []),
      {
        beschriftung: 'Übernehmen',
        betont: true,
        tun: () => {
          const neu = zusammen();
          uebernommen = true;
          /* Erst zurück auf den alten Stand, dann setzen: nur so trägt die
             Historie den Schritt richtig und „Rückgängig" führt dorthin,
             wo es vor dem Dialog stand. */
          zustand.aufdruck = vorher;
          setzeAufdruck(neu);
          sage(neu ? 'Aufdruck übernommen — er wird beim Sichern eingerechnet' : 'Aufdruck entfernt');
        },
      },
    ],
  });
}

/* Felder erkennen — ein flaches Formular ausfüllbar machen.

   Der Dialog zeigt, was gefunden wurde, und lässt einzeln abwählen. Er legt
   nichts von selbst an: ein geratenes Feld an falscher Stelle ist schlimmer
   als ein fehlendes, weil man das fehlende sieht.

   Jeder Fund nennt seinen Grund — „Ausfülllinie", „Kästchen", „Rahmen". Wer
   einen Fehlgriff sieht, versteht auch, warum er zustande kam, und kann die
   Erkennung beim nächsten Mal einschätzen. */
export function zeigeFelderkennung() {
  if (!zustand.folge.length) return sage('Kein Dokument geladen', { art: 'warn' });

  const umfang = el('select', { klasse: 'feld' },
    el('option', { value: 'alle', text: `Alle Seiten (${zustand.folge.length})` }),
    el('option', { value: 'diese', text: `Nur diese Seite (${zustand.aktuelleSeite})` }),
    ...(zustand.gewaehlteSeiten.size
      ? [el('option', { value: 'auswahl', text: `Gewählte Seiten (${zustand.gewaehlteSeiten.size})` })]
      : []));

  const stand = el('p', { klasse: 'hinweis', text: 'Noch nicht gesucht.' });
  const liste = el('div', { klasse: 'fundliste' });
  let funde = [];

  const zeichneListe = () => {
    liste.innerHTML = '';
    if (!funde.length) {
      liste.append(el('p', { klasse: 'hinweis', text: 'Nichts gefunden. Dieses Formular hat keine Linien oder Kästchen, die als Feld durchgehen — dann bleibt das Werkzeug „Formularfeld" (K), mit dem sich ein Rahmen von Hand ziehen lässt.' }));
      return;
    }
    for (const fund of funde) {
      const an = el('input', { type: 'checkbox', checked: fund.an !== false });
      an.addEventListener('change', () => { fund.an = an.checked; });
      const name = el('input', { klasse: 'feld', value: fund.name || '', placeholder: 'Name des Feldes' });
      name.addEventListener('input', () => { fund.name = name.value; });
      const art = el('select', { klasse: 'feld' },
        ...Object.entries(FELDARTEN).map(([wert, text]) => el('option', { value: wert, text })));
      art.value = fund.feldArt;
      art.addEventListener('change', () => { fund.feldArt = art.value; });

      liste.append(el('div', { klasse: 'fundzeile' },
        an,
        el('span', { klasse: 'mono klein leise', text: `S.${fund.nummer}` }),
        name,
        art,
        el('span', { klasse: 'marke', text: fund.grund })));
    }
  };
  zeichneListe();

  const suchen = async () => {
    const eintraege = umfang.value === 'diese'
      ? [zustand.folge[zustand.aktuelleSeite - 1]]
      : umfang.value === 'auswahl'
        ? zustand.folge.filter((e) => zustand.gewaehlteSeiten.has(e.id))
        : zustand.folge;
    stand.textContent = 'Seiten werden durchgesehen …';
    liste.innerHTML = '';
    funde = await erkenneFelder(eintraege, ({ seite: n, gesamt, gefunden }) => {
      stand.textContent = `Seite ${n} von ${gesamt} — ${gefunden} Vorschläge`;
    });
    stand.textContent = funde.length
      ? `${funde.length} Vorschläge auf ${new Set(funde.map((f) => f.nummer)).size} Seiten. Prüfen Sie jede Zeile.`
      : 'Nichts gefunden.';
    zeichneListe();
  };

  zeigeDialog({
    titel: 'Formularfelder erkennen',
    breit: true,
    fussHinweis: 'Erkannt wird an Linien und Kästchen — bestätigt wird von Hand.',
    rumpf: el('div', {},
      zeile('Umfang', umfang,
        el('button', { klasse: 'knopf knopf-klein', text: 'Suchen', beiClick: () => mitLader('Formular wird gelesen …', suchen) })),
      stand,
      el('p', { klasse: 'hinweis' },
        'Gesucht wird im gerenderten Bild, nicht in den Zeichenbefehlen — deshalb ',
        'findet dieselbe Suche die Felder im gesetzten wie im eingescannten Formular. ',
        'Eine Fläche, in der schon etwas steht, gilt nicht als Feld.'),
      liste),
    knoepfe: [
      { beschriftung: 'Abbrechen' },
      {
        beschriftung: 'Gewählte anlegen', betont: true,
        tun: () => {
          const genommen = funde.filter((f) => f.an !== false);
          if (!genommen.length) { sage('Nichts ausgewählt', { art: 'warn' }); return false; }
          const namen = new Set([
            ...zustand.formularfelder.map((f) => f.name),
            ...zustand.anmerkungen.filter((a) => a.art === 'feldneu').map((a) => a.name),
          ]);
          let angelegt = 0;
          for (const [i, f] of genommen.entries()) {
            let name = (f.name || '').trim() || `Feld ${namen.size + 1}`;
            while (namen.has(name)) name = `${name.replace(/ \d+$/, '')} ${namen.size + i + 2}`;
            namen.add(name);
            fuegeAn({
              art: 'feldneu', seiteId: f.seiteId,
              x: f.x, y: f.y, b: f.b, h: f.h,
              feldArt: f.feldArt, name, optionen: [], pflicht: false,
            });
            angelegt += 1;
          }
          sage(`${angelegt} Felder angelegt — sie werden beim Sichern geschrieben`, { dauer: 6000 });
        },
      },
    ],
  });

  /* Gleich losgehen: wer den Dialog öffnet, will das Ergebnis, nicht erst
     einen zweiten Knopf. */
  mitLader('Formular wird gelesen …', suchen);
}

/* Lesezeichen — anlegen, umbenennen, verschieben, löschen.

   Das Studio las sie bisher nur. Bei einer 200-seitigen Sitzungsmappe ist das
   der Unterschied zwischen brauchbar und unbrauchbar: die Gliederung ist der
   einzige Weg, in einem so langen Dokument etwas wiederzufinden.

   Eine flache Liste mit Einrückung statt eines Baums. Wer eine Ebene tiefer
   will, drückt „→"; wer heraus will, „←". Das ist weniger schön als ein Baum
   und deutlich weniger fehleranfällig — ein Baum, den man mit der Maus
   umhängt, hat immer einen Zustand, in dem ein Ast im Nichts hängt. */
export async function zeigeLesezeichenDialog() {
  if (!zustand.folge.length) return sage('Kein Dokument geladen', { art: 'warn' });
  const liste = [...await lesezeichenListe()];
  const rumpf = el('div', {});
  const tafel = el('div', { klasse: 'fundliste' });

  const zeichne = () => {
    tafel.innerHTML = '';
    if (!liste.length) {
      tafel.append(el('p', { klasse: 'hinweis', text: 'Noch keine Lesezeichen. „Aus aktueller Seite" legt das erste an.' }));
      return;
    }
    for (const [i, punkt] of liste.entries()) {
      const titel = el('input', { klasse: 'feld', value: punkt.titel });
      titel.addEventListener('input', () => { punkt.titel = titel.value; });
      const seite = el('input', {
        klasse: 'feld', type: 'number', min: '1', max: String(zustand.folge.length),
        value: String(punkt.seite), stil: { width: '5rem' },
      });
      seite.addEventListener('input', () => {
        punkt.seite = Math.max(1, Math.min(zustand.folge.length, Number(seite.value) || 1));
      });
      const knopf = (text, titelText, tun, aus = false) => el('button', {
        klasse: 'knopf knopf-klein knopf-still', text, title: titelText, disabled: aus,
        beiClick: () => { tun(); zeichne(); },
      });
      tafel.append(el('div', { klasse: 'fundzeile' },
        el('span', { klasse: 'mono klein leise', stil: { paddingLeft: `${punkt.ebene * 14}px` }, text: '•' }),
        titel, seite,
        knopf('←', 'Eine Ebene heraus', () => { punkt.ebene = Math.max(0, punkt.ebene - 1); }, punkt.ebene === 0),
        /* Tiefer geht nur, wenn darüber etwas steht, worunter es passt —
           sonst entsteht ein Ast ohne Stamm. */
        knopf('→', 'Eine Ebene hinein', () => { punkt.ebene += 1; },
          i === 0 || liste[i - 1].ebene < punkt.ebene),
        knopf('↑', 'Nach oben', () => { [liste[i - 1], liste[i]] = [liste[i], liste[i - 1]]; }, i === 0),
        knopf('↓', 'Nach unten', () => { [liste[i + 1], liste[i]] = [liste[i], liste[i + 1]]; }, i === liste.length - 1),
        el('button', {
          klasse: 'knopf knopf-klein knopf-gefahr', text: '✕', title: 'Löschen',
          beiClick: () => { liste.splice(i, 1); zeichne(); },
        })));
    }
  };
  zeichne();

  rumpf.append(
    zeile('Hinzufügen',
      el('button', {
        klasse: 'knopf knopf-klein', text: 'Aus aktueller Seite',
        beiClick: () => {
          const seite = zustand.aktuelleSeite;
          const eintrag = zustand.folge[seite - 1];
          const kurz = zustand.ocr.get(eintrag?.id)?.zeilen?.[0]?.text
            || `Seite ${seite}`;
          liste.push({ titel: kurz.slice(0, 60), seite, ebene: 0 });
          zeichne();
        },
      })),
    tafel,
    el('p', { klasse: 'hinweis' },
      'Die Gliederung wird beim Sichern geschrieben. Sie überschreibt die vorhandene — ',
      'wer sie hier leert und sichert, hat danach keine mehr. Untereinträge werden ',
      'zugeklappt gespeichert; eine Mappe, die beim Öffnen ganz aufgeklappt ist, hilft niemandem.'));

  zeigeDialog({
    titel: 'Lesezeichen',
    breit: true,
    rumpf,
    fussHinweis: `${zustand.folge.length} Seiten im Dokument`,
    knoepfe: [
      { beschriftung: 'Abbrechen' },
      {
        beschriftung: 'Übernehmen', betont: true,
        tun: () => {
          setzeLesezeichen(liste.filter((p) => p.titel.trim()));
          sage(liste.length ? `${liste.length} Lesezeichen — werden beim Sichern geschrieben` : 'Gliederung geleert');
        },
      },
    ],
  });
}

/* Dateianhänge — Dateien *im* PDF.

   Die Rechnung im Vertrag, die Tabelle zum Bericht. Jeder Betrachter zeigt
   sie als Büroklammer; wer das PDF weitergibt, gibt sie mit. Das ist etwas
   anderes als ein zweites PDF im selben Ordner: der Ordner geht verloren,
   das PDF nicht. */
export async function zeigeAnhangDialog() {
  if (!zustand.folge.length) return sage('Kein Dokument geladen', { art: 'warn' });
  /* Was schon in der Datei steckt, gehört dazu — sonst löscht ein Sichern
     die Anhänge des Originals, ohne dass jemand danach gefragt hat. */
  if (!zustand.anhaenge?.length) {
    const vorhandene = await lieseAnhaenge();
    for (const a of vorhandene) fuegeAnhangAn(a);
  }

  const wahl = el('input', { type: 'file', hidden: true, multiple: true });
  const tafel = el('div', { klasse: 'fundliste' });

  const zeichne = () => {
    tafel.innerHTML = '';
    const alle = anhaenge();
    if (!alle.length) {
      tafel.append(el('p', { klasse: 'hinweis', text: 'Keine Anhänge. „Datei anhängen" legt die erste hinein.' }));
      return;
    }
    for (const anhang of alle) {
      tafel.append(el('div', { klasse: 'fundzeile' },
        el('span', { klasse: 'einzel-datei-name', text: anhang.name }),
        el('span', { klasse: 'mono klein leise', text: groesse(anhang.bytes?.length || 0) }),
        anhang.ausDerDatei ? el('span', { klasse: 'marke', text: 'schon drin' }) : null,
        el('button', {
          klasse: 'knopf knopf-klein', text: 'Sichern', title: 'Den Anhang herausholen',
          beiClick: () => sichereBytes(anhang.bytes, anhang.name, anhang.art),
        }),
        el('button', {
          klasse: 'knopf knopf-klein knopf-gefahr', text: '✕', title: 'Entfernen',
          beiClick: () => { entferneAnhang(anhang.name); zeichne(); },
        })));
    }
  };
  zeichne();

  wahl.addEventListener('change', async (ereignis) => {
    for (const datei of ereignis.target.files) {
      fuegeAnhangAn({
        name: datei.name,
        bytes: new Uint8Array(await datei.arrayBuffer()),
        art: datei.type || 'application/octet-stream',
        beschreibung: '',
      });
    }
    zeichne();
  });

  zeigeDialog({
    titel: 'Dateianhänge',
    breit: true,
    fussHinweis: 'Anhänge werden beim Sichern in die Datei geschrieben.',
    rumpf: el('div', {},
      zeile('Hinzufügen', el('button', {
        klasse: 'knopf knopf-klein', text: 'Datei anhängen', beiClick: () => wahl.click(),
      })),
      tafel,
      el('p', { klasse: 'hinweis' },
        'Angehängte Dateien liegen unverändert im PDF und werden mit ihm weitergegeben. ',
        'Sie werden nicht durchsucht und nicht geprüft — ein angehängtes Programm bleibt ein Programm. ',
        'Wer ein PDF aus fremder Hand öffnet, sollte seine Anhänge mit derselben Vorsicht behandeln wie einen E-Mail-Anhang.'),
      wahl),
    knoepfe: [{ beschriftung: 'Schließen', betont: true }],
  });
}

/* Vorabprüfung — was der Datei zum Druck oder zur Archivierung fehlt.

   Sie ändert nichts. Das ist der ganze Sinn: wer eine Datei weitergibt, will
   vorher wissen, woran sie scheitert, nicht hinterher. Jeder Befund nennt die
   Folge, nicht nur den Zustand — „Schrift nicht eingebettet" sagt nichts,
   „auf einem fremden Rechner wird sie ersetzt" schon. */
export function zeigeVorabpruefung() {
  if (!zustand.folge.length) return sage('Kein Dokument geladen', { art: 'warn' });
  const tafel = el('div', {});
  const stand = el('p', { klasse: 'hinweis', text: 'Wird durchgesehen …' });
  const pdfA = el('input', { type: 'checkbox', checked: !!zustand.pdfA });
  pdfA.addEventListener('change', () => { zustand.pdfA = pdfA.checked; });

  const rumpf = el('div', {}, stand, tafel,
    el('div', { klasse: 'dialog-trenner' }),
    zeile('PDF/A', el('label', { klasse: 'zeile-kasten' }, pdfA, 'beim Sichern vorbereiten')),
    el('p', { klasse: 'hinweis' },
      'Vorbereiten heißt: Ausgabeabsicht, XMP-Kennzeichnung und Markierung werden gesetzt. ',
      'Ob die Datei danach die Norm erfüllt, sagt ein Prüfprogramm wie veraPDF — nicht wir. ',
      'Ein „PDF/A" auf einem Knopf, hinter dem keine Prüfung steht, wäre eine Zusage, die niemand halten kann. ',
      'Ohne eingebettetes ICC-Profil bleibt die Ausgabeabsicht außerdem unvollständig.'));

  zeigeDialog({
    titel: 'Vorabprüfung',
    breit: true,
    rumpf,
    fussHinweis: 'Sieht nach, ändert nichts.',
    knoepfe: [{ beschriftung: 'Schließen', betont: true }],
  });

  const ZEICHEN = { fehler: '✕', warnung: '!', gut: '✓' };
  vorabpruefung(({ seite, gesamt }) => { stand.textContent = `Seite ${seite} von ${gesamt} …`; })
    .then(({ befunde, zahlen }) => {
      const schlimm = befunde.filter((b) => b.art === 'fehler').length;
      const laut = befunde.filter((b) => b.art === 'warnung').length;
      stand.textContent = schlimm
        ? `${schlimm} Sache${schlimm === 1 ? '' : 'n'}, die dem Druck oder der Archivierung im Weg steht — und ${laut} zum Nachdenken.`
        : laut ? `Nichts Blockierendes, ${laut} zum Nachdenken.`
          : `${zahlen.seiten} Seiten, nichts zu beanstanden.`;
      for (const b of befunde) {
        tafel.append(el('div', { klasse: `befund ist-${b.art}` },
          el('span', { klasse: 'befund-zeichen', text: ZEICHEN[b.art] }),
          el('div', {},
            el('div', { klasse: 'befund-was', text: b.was }),
            b.folge ? el('div', { klasse: 'befund-folge', text: b.folge }) : null,
            b.wo ? el('div', { klasse: 'mono klein leise', text: b.wo }) : null)));
      }
    })
    .catch((fehler) => { stand.textContent = `Die Prüfung scheiterte: ${fehler.message}`; });
}

/* PowerPoint — je Seite eine Folie.

   Was hier entsteht, ist keine Umwandlung des Layouts, sondern ein Umzug des
   Textes: erste Zeile als Titel, der Rest als Aufzählung. Spalten, Bilder,
   Farben und Tabellen bleiben zurück. Das steht im Dialog, weil eine Ausgabe,
   die mehr verspricht, als sie hält, mehr Zeit kostet als eine, die es gar
   nicht gibt. */
export function zeigePowerPointDialog() {
  zeigeFormular({
    titel: 'Nach PowerPoint ausgeben',
    felder: [
      {
        name: 'umfang', beschriftung: 'Umfang',
        wahl: [
          ['alle', `Alle Seiten (${zustand.folge.length})`],
          ['auswahl', `Gewählte Seiten (${zustand.gewaehlteSeiten.size})`],
        ],
      },
      {
        name: 'zeilen', beschriftung: 'Zeilen je Folie', art: 'zahl', von: 3, bis: 30, wert: 12,
        stil: { width: '6rem' },
      },
    ],
    hinweise: [
      'Je Seite eine Folie: die erste Zeile wird der Titel, der Rest eine Aufzählung. '
      + 'Das trifft bei Berichten und Protokollen fast immer und ist bei Fließtext '
      + 'höchstens unglücklich, nie falsch.',
      'Nicht übernommen werden Spalten, Bilder, Farben und Tabellen — ein PDF beschreibt '
      + 'Buchstaben an Punkten, keine Folien. Wer das Aussehen braucht, gibt das PDF weiter; '
      + 'wer die Sätze in eine Präsentation heben will, nimmt diese Datei.',
    ],
    tat: {
      beschriftung: 'Ausgeben',
      tun: ({ umfang, zeilen }) => mitLader('Folien werden gebaut …', async () => {
        const { alsPowerPoint } = await import('./powerpoint.js');
        const { bytes, folien, leereFolien } = await alsPowerPoint({
          seiten: umfang === 'auswahl' && zustand.gewaehlteSeiten.size ? [...zustand.gewaehlteSeiten] : null,
          zeilenJeFolie: zeilen,
        });
        sichereBytes(bytes, vorschlagsname('').replace(/\.pdf$/i, '.pptx'),
          'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        sage(leereFolien
          ? `${folien} Folien — ${leereFolien} davon leer, weil die Seite keinen Text hat`
          : `${folien} Folien ausgegeben`, { dauer: 6000 });
      }),
    },
  });
}

/* Bilder im PDF — ersetzen und entfernen.

   Getauscht wird der Eintrag im Mittelverzeichnis, nicht der Seitenstrom:
   das Bild wechselt, Lage und Größe bleiben. Verschieben oder anders
   zuschneiden geht deshalb nicht — dafür müsste die Matrix im Strom geändert
   werden, und der Strom ist ein Wust aus Zuständen, in den man nicht einfach
   hineinschreibt. Das steht im Dialog, damit niemand es erwartet. */
export async function zeigeBilderDialog() {
  if (!zustand.folge.length) return sage('Kein Dokument geladen', { art: 'warn' });
  const { bilderImDokument, bildauftraege, setzeBildauftrag } = await import('./bilder.js');

  const tafel = el('div', { klasse: 'fundliste' });
  const stand = el('p', { klasse: 'hinweis', text: 'Wird durchgesehen …' });

  zeigeDialog({
    titel: 'Bilder im Dokument',
    breit: true,
    fussHinweis: 'Getauscht wird beim Sichern.',
    rumpf: el('div', {}, stand, tafel,
      el('p', { klasse: 'hinweis' },
        'Ein Bild wird über seinen Namen gezeichnet; getauscht wird der Eintrag, nicht die Stelle. ',
        'Deshalb behält das neue Bild Lage, Größe und Drehung des alten — und deshalb lässt sich ',
        'ein Bild hier nicht verschieben oder anders zuschneiden. ',
        'Passen die Seitenverhältnisse nicht zueinander, wird das neue Bild verzerrt.')),
    knoepfe: [{ beschriftung: 'Schließen', betont: true }],
  });

  let bilder = [];
  try {
    bilder = await bilderImDokument();
  } catch (fehler) {
    stand.textContent = `Die Bilder ließen sich nicht lesen: ${fehler.message}`;
    return;
  }

  if (!bilder.length) {
    stand.textContent = 'Keine Bilder gefunden. Dieses Dokument besteht aus Text und Linien.';
    return;
  }
  const grobe = bilder.filter((b) => b.dpi < 150).length;
  stand.textContent = grobe
    ? `${bilder.length} Bilder, ${grobe} davon unter 150 dpi.`
    : `${bilder.length} Bilder, alle über 150 dpi.`;

  for (const bild of bilder) {
    const wahl = el('input', { type: 'file', accept: 'image/png,image/jpeg', hidden: true });
    const marke = el('span', { klasse: 'marke' });
    const zeigeMarke = () => {
      const auftrag = bildauftraege().find((a) => a.seite === bild.seite && a.name === bild.name);
      marke.textContent = auftrag ? (auftrag.entfernen ? 'wird entfernt' : 'wird ersetzt') : '';
      marke.hidden = !auftrag;
    };
    zeigeMarke();

    wahl.addEventListener('change', async (ereignis) => {
      const datei = ereignis.target.files[0];
      if (!datei) return;
      setzeBildauftrag({
        seite: bild.seite, name: bild.name,
        ersatz: new Uint8Array(await datei.arrayBuffer()), entfernen: false,
      });
      zeigeMarke();
      sage(`${datei.name} ersetzt beim Sichern das Bild auf Seite ${bild.seite}`);
    });

    /* Vorschau nur beim JPEG: sein Strom **ist** die Datei. Alles andere
       müsste erst entpackt werden; lieber kein Bild als ein falsches. */
    const vorschau = bild.bytes
      ? el('img', {
        klasse: 'bildvorschau',
        src: URL.createObjectURL(new Blob([bild.bytes], { type: 'image/jpeg' })),
        alt: `Bild auf Seite ${bild.seite}`,
      })
      : el('span', { klasse: 'bildvorschau ist-ohne mono klein', text: bild.art || '?' });

    tafel.append(el('div', { klasse: 'fundzeile' },
      vorschau,
      el('span', { klasse: 'mono klein leise', text: `S.${bild.seite}` }),
      el('span', { klasse: 'einzel-datei-name', text: `${bild.breite} × ${bild.hoehe} px · etwa ${bild.dpi} dpi` }),
      marke,
      el('button', { klasse: 'knopf knopf-klein', text: 'Ersetzen …', beiClick: () => wahl.click() }),
      el('button', {
        klasse: 'knopf knopf-klein knopf-gefahr', text: 'Entfernen',
        beiClick: () => {
          setzeBildauftrag({ seite: bild.seite, name: bild.name, ersatz: null, entfernen: true });
          zeigeMarke();
          sage(`Das Bild auf Seite ${bild.seite} wird beim Sichern weiß überdeckt`);
        },
      }),
      el('button', {
        klasse: 'knopf knopf-klein knopf-still', text: '↺', title: 'Zurücknehmen',
        beiClick: () => {
          setzeBildauftrag({ seite: bild.seite, name: bild.name, zuruecknehmen: true });
          zeigeMarke();
        },
      }),
      wahl));
  }
}

/* Zur Unterschrift versenden.

   **Hier verlässt die Datei das Gerät.** Alles andere in diesem Programm
   rechnet im Browserfenster; dieser eine Weg nicht, und er kann es nicht:
   ein Ablauf, bei dem ein anderer Mensch unterschreiben soll, braucht eine
   Stelle, die beide erreichen.

   Deshalb steht die Warnung nicht im Kleingedruckten, sondern als erster
   Absatz, und der Knopf heißt „Hochladen und versenden" und nicht „Senden".
   Wer das nicht will, hat zwei andere Wege: die Datei selbst verschicken, oder
   digital unterschreiben mit eigenem Zertifikat — beides ohne Server. Auch
   das steht da. */
export function zeigeVersendenDialog() {
  if (!zustand.folge.length) return sage('Kein Dokument geladen', { art: 'warn' });

  const empfaenger = el('input', { klasse: 'feld', type: 'email', placeholder: 'name@beispiel.de', autocomplete: 'off' });
  const titel = el('input', { klasse: 'feld', value: vorschlagsname('').replace(/\.pdf$/i, '') });
  const verstanden = el('input', { type: 'checkbox' });
  const ergebnis = el('div', {});

  zeigeDialog({
    titel: 'Zur Unterschrift versenden',
    breit: true,
    fussHinweis: 'Der einzige Weg in diesem Programm, bei dem eine Datei das Gerät verlässt.',
    rumpf: el('div', {},
      el('p', { klasse: 'hinweis ist-warnung' },
        'Achtung: Für diesen einen Weg wird das Dokument auf den Server hochgeladen. ',
        'Anders geht es nicht — der Empfänger muss es erreichen können. ',
        'Alles andere in diesem Programm bleibt auf Ihrem Gerät; dies nicht.'),
      el('p', { klasse: 'hinweis' },
        'Der Empfänger bekommt einen Link mit einem zufälligen Schlüssel, sieht das Dokument, ',
        'zeichnet seine Unterschrift und schickt es zurück. Wer den Link hat, hat den Auftrag — ',
        'er ist so vertraulich wie die E-Mail, in der er steht.'),
      el('p', { klasse: 'hinweis' },
        'Das Ergebnis ist eine ', el('b', { text: 'sichtbare Unterschrift mit Protokoll' }),
        ' — wer, wann, von welcher Adresse. Es ist ',
        el('b', { text: 'keine qualifizierte elektronische Signatur' }),
        ' nach eIDAS; dafür braucht es ein Zertifikat und eine Signaturkarte. ',
        'Wer das braucht, nimmt „Digital unterschreiben" — das läuft ohne Server.'),
      el('div', { klasse: 'dialog-trenner' }),
      zeile('Titel', titel),
      zeile('Empfänger', empfaenger),
      zeile('Einverstanden', el('label', { klasse: 'zeile-kasten' }, verstanden,
        'Ich weiß, dass das Dokument dafür hochgeladen wird')),
      ergebnis),
    knoepfe: [
      { beschriftung: 'Abbrechen' },
      {
        beschriftung: 'Hochladen und versenden', betont: true,
        tun: () => {
          if (!verstanden.checked) { sage('Bitte bestätigen Sie zuerst, dass die Datei hochgeladen wird', { art: 'warn' }); return false; }
          if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(empfaenger.value.trim())) {
            sage('Ohne gültige Empfängeradresse gibt es niemanden zum Unterschreiben', { art: 'warn' });
            return false;
          }
          mitLader('Dokument wird hochgeladen …', async () => {
            try {
              const bytes = await baueDokument({});
              let text = '';
              for (let i = 0; i < bytes.length; i += 8192) {
                text += String.fromCharCode(...bytes.subarray(i, i + 8192));
              }
              const antwort = await fetch('/api/signatur/anlegen.json', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  titel: titel.value.trim(),
                  dateiname: vorschlagsname(''),
                  empfaenger: empfaenger.value.trim(),
                  datei: btoa(text),
                }),
              });
              const stand = await antwort.json();
              if (stand.fehler) throw new Error(stand.fehler);
              const link = `${location.origin}${stand.weg}`;
              /* Der Server verschickt keine E-Mail — er kennt den Absender
                 nicht und soll in fremdem Namen nichts verschicken. Der Link
                 geht deshalb an den Menschen zurück, der ihn weitergibt. */
              ergebnis.innerHTML = '';
              ergebnis.append(
                el('div', { klasse: 'dialog-trenner' }),
                el('p', {}, 'Der Auftrag steht bereit. Schicken Sie diesen Link an ',
                  el('b', { text: empfaenger.value.trim() }), ':'),
                zeile('Link', el('input', { klasse: 'feld', value: link, readonly: true })),
                el('p', { klasse: 'hinweis' },
                  'Wir verschicken die E-Mail nicht selbst — ein Server, der in Ihrem Namen ',
                  'schreibt, ist ein Server, dem Sie mehr anvertrauen als nötig.'));
              sage('Auftrag angelegt — den Link finden Sie im Dialog', { dauer: 9000 });
            } catch (fehler) {
              sage(fehler.message, { art: 'warn', dauer: 9000 });
            }
          });
          return false;   /* offen lassen: der Link steht im Dialog */
        },
      },
    ],
  });
}
