/* Dialoge — alles, was sich als Fenster über die Werkbank legt.

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
import { waehleAn } from './anmerkungen.js';
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
   sie eintragen. Ohne das misst die Werkbank in Papiermaß — auf einem
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
   das nicht wusste, hält die Werkbank für kaputt. Sie ist es nicht — sie
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
      'Nummerierung. Die Werkbank setzt in Helvetica auf A4.'),
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
      el('p', { klasse: 'hinweis', text: 'Was sich ohne Vermutung setzen lässt, setzt die Werkbank beim nächsten Sichern:' }),
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
      + 'Ohne Öffnen-Kennwort lässt sich die Datei nicht mehr lesen — auch nicht von dieser Werkbank. '
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
