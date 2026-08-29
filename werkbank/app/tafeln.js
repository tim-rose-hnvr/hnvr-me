/* Tafeln — die beiden Leisten links und rechts.

   Links liegen die Wege ins Dokument: Lesezeichen, Quelldateien, Suche. Rechts
   liegt, was zum Dokument gehört, aber nicht darauf steht: Kommentare mit
   Faden, Formularfelder, Verlauf und die Werkzeugeigenschaften.

   Sie standen bis eben mitten in `oberflaeche.js`, zwischen Befehlsregister und
   Tastatur. Beides sind Tafeln, beides zeichnet sich aus `zustand` neu — aber
   wer eine Tafel ändern wollte, las an der Werkzeugleiste und den Tastenkürzeln
   vorbei.

   Die Regel ist dieselbe wie in `dialoge.js`: hier steht kein Zustand. Eine
   Tafel liest, zeichnet und ruft einen Befehl. Der Ring zu `oberflaeche.js` ist
   gewollt — beide Seiten greifen erst beim Aufruf aufeinander zu. */

import {
  zustand, melde, $, $$, el, sage, groesse, sichereBytes, leerBild,
} from './kern.js';
import { nummerVon } from './dokument.js';
import { baueNeu, zeigeSeite, bringeInSicht } from './ansicht.js';
import {
  WERKZEUGE, FARBEN, anmerkungsListe, entferne, aendere, waehleAn, bezeichne, hatUnterschrift,
} from './anmerkungen.js';
import {
  suche, trefferListe, weiter, zurueck, leere as leereSuche, markiereAlle, suchbegriff,
} from './suche.js';
import { formularTafel, hatFormular, offeneFelder } from './formulare.js';
import { tafelMitdenken } from './mitdenken.js';
import { istUnveraendertesGeruest, vorschlagsname } from './ausgabe.js';
import { erkennungsUebersicht } from './texterkennung.js';
import { zeigeEigenschaften } from './dialoge.js';
/* Aus der Oberfläche: der Weg, einen Befehl auszulösen, und das Hervorheben
   aller Suchtreffer. Der Ring ist unbedenklich — siehe oben. */
import { fuehreAus, hebeTrefferHervor } from './oberflaeche.js';

/* ---------- Tafeln --------------------------------------------------------- */

export function zeigeLeiste(seite, tafelName) {
  const huelle = $('#huelle');
  huelle.dataset[seite] = 'auf';
  if (seite === 'links' && tafelName) {
    $$('#reiter-links .reiter-knopf').forEach((k) => k.classList.toggle('ist-aktiv', k.dataset.tafel === tafelName));
    $$('.leiste-links .tafel').forEach((t) => t.classList.toggle('ist-aktiv', t.dataset.tafel === tafelName));
  }
  baueNeu({ haltePosition: true });
}

export function zeichneGliederung() {
  const tafel = $('#tafel-gliederung');
  tafel.innerHTML = '';
  const gliederung = zustand.gliederung;
  if (!gliederung?.length) {
    tafel.append(leerBild({
      zeichen: 'M6 3h12v18l-6-4-6 4z',
      titel: 'Keine Lesezeichen',
      satz: 'Diese Datei bringt keine Gliederung mit. Beim Sichern bleiben vorhandene erhalten, solange die Seitenfolge steht.',
    }));
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

/* Die Tafel „Dateien" aus dem Handoff: welche Quellen im Arbeitsdokument
   stecken. Bei einer zusammengeführten Datei ist das die einzige Stelle, an
   der man sieht, woher welche Seiten kommen. Unten die Ablegefläche, wie
   gezeichnet. */
export function zeichneDateientafel() {
  const tafel = $('#tafel-dateien');
  if (!tafel) return;
  tafel.innerHTML = '';

  if (!zustand.quellen.size) {
    tafel.append(leerBild({
      titel: 'Noch keine Datei',
      satz: 'Hier steht später, aus welchen Dateien das Arbeitsdokument besteht.',
      tat: { beschriftung: 'Datei öffnen', tun: () => fuehreAus('datei:oeffnen') },
    }));
    return;
  }

  for (const quelle of zustand.quellen.values()) {
    const seiten = zustand.folge.filter((e) => e.quelleId === quelle.id);
    const karte = el('div', {
      klasse: 'dateikarte',
      title: seiten.length ? `Zur ersten Seite aus ${quelle.name}` : 'Keine Seite dieser Datei mehr im Dokument',
      beiClick: () => { if (seiten.length) zeigeSeite(nummerVon(seiten[0].id)); },
    },
      el('div', { klasse: 'dateikarte-name', text: quelle.name }),
      el('div', { klasse: 'dateikarte-mass mono' },
        `${seiten.length} von ${quelle.seitenzahl} Seiten · ${groesse(quelle.bytes.byteLength)}`),
      quelle.warGeschuetzt
        ? el('div', { klasse: 'dateikarte-mass mono', text: 'WAR KENNWORTGESCHÜTZT' })
        : null);
    tafel.append(karte);
  }

  tafel.append(el('button', {
    klasse: 'ablegeflaeche',
    text: 'Weitere Datei anhängen',
    title: 'Eine weitere Datei an das Arbeitsdokument anhängen',
    beiClick: () => fuehreAus('datei:anhaengen'),
  }));
}

export function zeichneSuchtafel() {
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

export function zeichneSuchergebnisse() {
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
    if (a.zitat) zeilen.push(`    „${a.zitat}"`);
  }
  sichereBytes(new TextEncoder().encode(zeilen.join('\n')), vorschlagsname('-anmerkungen').replace(/\.pdf$/i, '.txt'), 'text/plain');
}


/* ---------- Rechte Leiste: vier Tafeln --------------------------------- */

/* Das Handoff trennt Kommentare, Felder und Verlauf in eigene Reiter. Vorher
   stand alles untereinander in einer Spalte — bei einem Dokument mit
   Vorschlaegen, Formular und Anmerkungen musste man scrollen, um irgendetwas
   zu finden. */
export function zeigeRechteTafel(name) {
  $$('#reiter-rechts .reiter-knopf').forEach((k) => k.classList.toggle('ist-aktiv', k.dataset.rtafel === name));
  $$('.leiste-rechts .tafel').forEach((t) => t.classList.toggle('ist-aktiv', t.dataset.rtafel === name));
  zeichneRechteTafeln();
}

export function zeichneRechteTafeln() {
  zeichneKommentartafel();
  zeichneFeldertafel();
  zeichneVerlauftafel();
}

/* Kommentare mit Faden: Antworten und ein Erledigt-Zustand. Bisher war eine
   Anmerkung ein Strich auf dem Papier; ein Kommentar in einer Runde ist aber
   ein Gespraech, das irgendwann abgehakt wird. */
export function zeichneKommentartafel() {
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
    tafel.append(zustand.kommentarfilter === 'erledigt'
      ? leerBild({
        zeichen: 'M4 12l5 5L20 6',
        titel: 'Noch nichts abgehakt',
        satz: 'Erledigte Kommentare wandern hierher — mit dem Knopf im offenen Faden.',
      })
      : leerBild({
        zeichen: 'M4 4h16v11H9l-5 5z',
        titel: 'Keine offenen Kommentare',
        satz: 'Text markieren oder eine Notiz setzen — beides landet hier als Faden mit Antwort und Erledigt.',
        tat: { beschriftung: 'Kommentar setzen (N)', tun: () => fuehreAus('werkzeug:notiz') },
      }));
    return;
  }

  for (const a of gezeigt) {
    const karte = el('div', {
      klasse: `faden ${zustand.gewaehlteAnmerkung === a.id ? 'ist-aktiv' : ''}`,
      beiClick: () => { waehleAn(a.id); melde('seiten:springe', nummerVon(a.seiteId)); },
    },
      el('div', { klasse: 'faden-kopf' },
        /* Handoff: die Art steht als Mono-Chip in Versalien, nicht als fette
           Zeile. Das trennt sie sichtbar vom Text des Kommentars. */
        el('span', { klasse: 'art-chip', text: bezeichne(a) }),
        el('span', { klasse: 'mono klein leise', text: `S.${nummerVon(a.seiteId)} · ${uhrzeit(a.erstellt)}` })),
      /* Zitat aus dem Dokument — Serif kursiv mit goldener Kante, wie im
         Handoff. Es steht über dem Kommentar, weil es der Anlass ist. */
      a.zitat ? el('p', { klasse: 'faden-zitat', text: `…${a.zitat}…` }) : null,
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
export function zeichneFeldertafel() {
  const tafel = $('#tafel-felder');
  if (!tafel || !tafel.classList.contains('ist-aktiv')) return;
  tafel.innerHTML = '';

  if (!zustand.formularfelder.length) {
    tafel.append(leerBild({
      zeichen: 'M3 7h18v10H3zM7 11h6',
      titel: 'Kein Formular',
      satz: 'Diese Datei bringt keine Felder mit. Anlegen geht mit dem Werkzeug „Formularfeld": Rahmen ziehen, Art wählen.',
      tat: { beschriftung: 'Feld anlegen (K)', tun: () => fuehreAus('werkzeug:feld') },
    }));
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
export function zeichneVerlauftafel() {
  const tafel = $('#tafel-verlauf');
  if (!tafel || !tafel.classList.contains('ist-aktiv')) return;
  tafel.innerHTML = '';

  const schritte = zustand.gedaechtnis.letzteAktionen;
  if (!schritte.length) {
    tafel.append(leerBild({
      zeichen: 'M12 7v5l3 3M21 12a9 9 0 1 1-9-9',
      titel: 'Noch nichts geändert',
      satz: 'Jeder Schritt steht hier mit Namen und Uhrzeit — und lässt sich von hier aus zurücknehmen.',
    }));
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

export function zeichneRechteTafel() {
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
