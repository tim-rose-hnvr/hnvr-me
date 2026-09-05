/* Einzelwerkzeuge — ein Werkzeug, eine Adresse, eine Aufgabe.

   Die Werkbank ist eine Werkbank: man legt ein Dokument hinein und arbeitet
   daran. Das ist richtig für den, der eine Stunde damit verbringt — und zu
   viel für den, der zwei PDFs zusammenfügen will und danach wieder geht.

   Für den gibt es hier den kurzen Weg: Dateien hinlegen, ein Knopf, fertige
   Datei. Kein Dokument öffnen, keine Werkzeugzeile, keine Leisten.

     /studio/?werkzeug=zusammenfuegen

   Jedes Werkzeug hat seine eigene Adresse. Man kann sie verschicken, als
   Verknüpfung ablegen, aus einer Marketingseite darauf zeigen. Das ist der
   ganze Unterschied zu einem Menüeintrag — und der Grund, warum es sie gibt.

   **Was hier nicht passiert:** gerechnet wird nichts. Jedes Werkzeug ruft
   dieselbe Stelle wie der lange Weg — `ausgabe.js`, `schutz.js`, `word.js`
   und so fort. Es gibt keine zweite Fassung des Zusammenfügens, die anders
   zusammenfügt als die erste. Wenn ein Werkzeug hier etwas anderes täte als
   im Studio, wäre der kurze Weg eine Falle. */

import { zustand, el, $, sage, sichereBytes, mitLader, groesse, melde } from './kern.js';

/** Ein Dateiname mit anderer Endung — „vertrag.pdf" wird zu „vertrag.docx". */
const mitEndung = (name, endung) => `${String(name).replace(/\.[^.]+$/, '')}${endung}`;

/* Lädt Dateien in den Zustand, ohne die Oberfläche zu behelligen. Der kurze
   Weg braucht das Dokument im Speicher, aber keine Bühne. */
async function ladeStill(dateien, { anhaengen = false } = {}) {
  const { oeffneDateien, ermittleFormularfelder, ermittleMerkmale } = await import('./dokument.js');
  await oeffneDateien(dateien, { anhaengen });
  await ermittleFormularfelder();
  await ermittleMerkmale();
}

export const WERKZEUGE = [
  {
    id: 'zusammenfuegen',
    name: 'PDF zusammenfügen',
    satz: 'Mehrere PDFs zu einer Datei, in der Reihenfolge, in der Sie sie wählen.',
    zeichen: 'M4 4h9l3 3v4H4zM8 13h12v7H8z',
    nimmt: '.pdf,application/pdf',
    mehrere: true,
    mindestens: 2,
    knopf: 'Zusammenfügen',
    async tun(dateien) {
      await ladeStill([dateien[0]]);
      for (const datei of dateien.slice(1)) await ladeStill([datei], { anhaengen: true });
      const { baueDokument } = await import('./ausgabe.js');
      return {
        bytes: await baueDokument({}),
        name: 'zusammengefuegt.pdf',
        satz: `${dateien.length} Dateien, ${zustand.folge.length} Seiten`,
      };
    },
  },
  {
    id: 'teilen',
    name: 'PDF teilen',
    satz: 'Zerlegt ein Dokument in einzelne Seiten oder Stücke fester Länge.',
    zeichen: 'M12 3v18M7 8H4v8h3M17 8h3v8h-3',
    nimmt: '.pdf,application/pdf',
    zahl: { name: 'Seiten je Datei', wert: 1, von: 1 },
    knopf: 'Teilen',
    async tun(dateien, { zahl }) {
      await ladeStill(dateien);
      const { teileDokument } = await import('./ausgabe.js');
      const proDatei = Math.max(1, zahl || 1);
      await teileDokument(proDatei);
      /* `teileDokument` lädt selbst herunter — hier gibt es nichts zurück,
         nur die Nachricht, was passiert ist. */
      return { satz: `${Math.ceil(zustand.folge.length / proDatei)} Dateien heruntergeladen` };
    },
  },
  {
    id: 'verkleinern',
    name: 'PDF verkleinern',
    satz: 'Rechnet die Seiten neu und macht die Datei kleiner. Sagt vorher und nachher.',
    zeichen: 'M4 4h16v16H4zM9 9h6v6H9z',
    nimmt: '.pdf,application/pdf',
    wahl: {
      name: 'Auflösung', wert: '110',
      werte: [['72', '72 dpi — Bildschirm'], ['110', '110 dpi — E-Mail'],
        ['150', '150 dpi — Büroausdruck'], ['200', '200 dpi — sorgfältig']],
    },
    knopf: 'Verkleinern',
    async tun(dateien, { wahl }) {
      const vorher = dateien[0].size;
      await ladeStill(dateien);
      const { verkleinere } = await import('./ausgabe.js');
      const bytes = await verkleinere({ dichte: Number(wahl), guete: 0.72 });
      const anteil = Math.round((1 - bytes.length / vorher) * 100);
      return {
        bytes, name: mitEndung(dateien[0].name, '-klein.pdf'),
        satz: anteil > 0
          ? `${groesse(vorher)} → ${groesse(bytes.length)} (${anteil} % kleiner)`
          : `${groesse(bytes.length)} — nicht kleiner, das Original war schon sparsam`,
      };
    },
  },
  {
    id: 'nach-word',
    name: 'PDF nach Word',
    satz: 'Absätze, Überschriften und Auszeichnungen als .docx. Kein Layout.',
    zeichen: 'M6 3h8l4 4v14H6zM9 12l1.5 5L12 13l1.5 4L15 12',
    nimmt: '.pdf,application/pdf',
    knopf: 'Nach Word',
    async tun(dateien) {
      await ladeStill(dateien);
      const { alsWord } = await import('./word.js');
      const { bytes, woerter, absaetze } = await alsWord({});
      return {
        bytes, name: mitEndung(dateien[0].name, '.docx'),
        art: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        satz: `${woerter} Wörter in ${absaetze} Absätzen`,
      };
    },
  },
  {
    id: 'nach-excel',
    name: 'Tabellen nach Excel',
    satz: 'Erkennt Tabellen und schreibt sie als .xlsx — je Seite ein Blatt.',
    zeichen: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14M15 5v14',
    nimmt: '.pdf,application/pdf',
    knopf: 'Nach Excel',
    async tun(dateien) {
      await ladeStill(dateien);
      const { alsExcel } = await import('./excel.js');
      const { bytes, blaetter, zeilen } = await alsExcel({ nurTabellen: true });
      return {
        bytes, name: mitEndung(dateien[0].name, '.xlsx'),
        art: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        satz: `${zeilen} Zeilen auf ${blaetter} Blättern`,
      };
    },
  },
  {
    id: 'nach-pdf',
    name: 'Word, Excel, Text nach PDF',
    satz: 'Setzt .docx, .xlsx, .csv, .txt und .md auf A4 — mit Gliederung und Tabellen.',
    zeichen: 'M6 3h8l4 4v14H6zM9 11h6M9 15h6',
    nimmt: '.docx,.xlsx,.csv,.txt,.md',
    mehrere: true,
    knopf: 'Nach PDF',
    async tun(dateien) {
      const { liesBloecke, setze } = await import('./einlesen.js');
      const bloecke = [];
      for (const datei of dateien) {
        const bytes = new Uint8Array(await datei.arrayBuffer());
        bloecke.push(...await liesBloecke(bytes, datei.name));
      }
      if (!bloecke.length) throw new Error('Kein Text gefunden, den das Studio setzen könnte.');
      const bytes = await setze(bloecke, { titel: mitEndung(dateien[0].name, '') });
      return {
        bytes, name: mitEndung(dateien[0].name, '.pdf'),
        satz: `${bloecke.length} Abschnitte gesetzt`,
      };
    },
  },
  {
    id: 'bilder-zu-pdf',
    name: 'Bilder zu PDF',
    satz: 'PNG und JPEG werden zu Seiten — je Bild eine, im Format des Bildes.',
    zeichen: 'M4 5h16v14H4zM4 15l4-4 3 3 4-5 5 6',
    nimmt: 'image/png,image/jpeg,.png,.jpg,.jpeg',
    mehrere: true,
    knopf: 'Zu PDF',
    async tun(dateien) {
      const { bilderZuPdfBytes } = await import('./einlesen.js');
      const { bytes, seiten } = await bilderZuPdfBytes(dateien);
      return { bytes, name: 'bilder.pdf', satz: `${seiten} Seiten` };
    },
  },
  {
    id: 'texterkennung',
    name: 'Scan durchsuchbar machen',
    satz: 'Texterkennung legt den erkannten Text unsichtbar hinter das Bild.',
    zeichen: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M8 11h8M8 15h5',
    nimmt: '.pdf,application/pdf',
    wahl: {
      name: 'Sprache', wert: 'deu',
      werte: [['deu', 'Deutsch'], ['eng', 'Englisch'], ['deu+eng', 'Deutsch und Englisch']],
    },
    knopf: 'Erkennen',
    async tun(dateien, { wahl }, melden) {
      await ladeStill(dateien);
      const { erkenneSeiten } = await import('./texterkennung.js');
      await erkenneSeiten({
        seiten: zustand.folge, sprache: wahl, dichte: 200,
        beiFortschritt: (stand) => melden?.(stand.seite
          ? `Seite ${stand.seite} von ${stand.gesamt} …` : 'Texterkennung wird geladen …'),
      });
      const { baueDokument } = await import('./ausgabe.js');
      const woerter = [...zustand.ocr.values()].reduce((s, o) => s + (o.woerter?.length || 0), 0);
      return {
        bytes: await baueDokument({}),
        name: mitEndung(dateien[0].name, '-durchsuchbar.pdf'),
        satz: `${woerter} Wörter erkannt`,
      };
    },
  },
  {
    id: 'schuetzen',
    name: 'PDF mit Kennwort schützen',
    satz: 'AES-256 durch qpdf. Ohne Kennwort lässt sich die Datei nicht mehr lesen.',
    zeichen: 'M6 11h12v9H6zM9 11V7a3 3 0 0 1 6 0v4',
    nimmt: '.pdf,application/pdf',
    kennwort: { name: 'Kennwort', platzhalter: 'zum Öffnen nötig' },
    knopf: 'Schützen',
    async tun(dateien, { kennwort }) {
      if (!kennwort) throw new Error('Ohne Kennwort gibt es nichts zu schützen.');
      const { verschluessle } = await import('./schutz.js');
      const bytes = await verschluessle(new Uint8Array(await dateien[0].arrayBuffer()),
        { benutzer: kennwort, besitzer: kennwort, drucken: 'full', aendern: 'all', kopieren: true });
      return { bytes, name: mitEndung(dateien[0].name, '-geschuetzt.pdf'), satz: 'AES-256' };
    },
  },
  {
    id: 'entschuetzen',
    name: 'Kennwort entfernen',
    satz: 'Braucht das richtige Kennwort. Ohne das bleibt die Datei zu — auch hier.',
    zeichen: 'M6 11h12v9H6zM9 11V7a3 3 0 0 1 5.2-2',
    nimmt: '.pdf,application/pdf',
    kennwort: { name: 'Kennwort', platzhalter: 'das Kennwort der Datei' },
    knopf: 'Entsperren',
    async tun(dateien, { kennwort }) {
      const { entschluessle } = await import('./schutz.js');
      const bytes = await entschluessle(new Uint8Array(await dateien[0].arrayBuffer()), kennwort || '');
      return { bytes, name: mitEndung(dateien[0].name, '-offen.pdf'), satz: 'offen gesichert' };
    },
  },
  {
    id: 'drehen',
    name: 'Seiten drehen',
    satz: 'Dreht jede Seite um denselben Winkel, zusätzlich zur vorhandenen Drehung.',
    zeichen: 'M4 12a8 8 0 1 1 3 6M4 12V7m0 5h5',
    nimmt: '.pdf,application/pdf',
    wahl: {
      name: 'Richtung', wert: '90',
      werte: [['90', 'nach rechts (90°)'], ['-90', 'nach links (−90°)'], ['180', 'auf den Kopf (180°)']],
    },
    knopf: 'Drehen',
    async tun(dateien, { wahl }) {
      const { SCHRITTE } = await import('./stapel.js');
      const schritt = SCHRITTE.find((s) => s.id === 'drehen');
      const bytes = await schritt.tun(new Uint8Array(await dateien[0].arrayBuffer()), { winkel: Number(wahl) });
      return { bytes, name: mitEndung(dateien[0].name, '-gedreht.pdf'), satz: `${wahl}°` };
    },
  },
  {
    id: 'felder-erkennen',
    name: 'Formular ausfüllbar machen',
    satz: 'Erkennt Linien und Kästchen und legt daraus Felder an — auch auf Scans.',
    zeichen: 'M3 7h18v10H3zM7 11h6M7 14h9',
    nimmt: '.pdf,application/pdf',
    knopf: 'Felder erkennen',
    imStudioWeiter: true,
    async tun(dateien, _optionen, melden) {
      await ladeStill(dateien);
      const { erkenneFelder } = await import('./felderkennen.js');
      const funde = await erkenneFelder(zustand.folge,
        ({ seite, gesamt }) => melden?.(`Seite ${seite} von ${gesamt} …`));
      if (!funde.length) throw new Error('Keine Linien oder Kästchen gefunden, die als Feld durchgehen.');
      const { fuegeAn } = await import('./anmerkungen.js');
      const namen = new Set();
      for (const f of funde) {
        let name = f.name || 'Feld';
        while (namen.has(name)) name = `${name.replace(/ \d+$/, '')} ${namen.size + 1}`;
        namen.add(name);
        fuegeAn({ art: 'feldneu', seiteId: f.seiteId, x: f.x, y: f.y, b: f.b, h: f.h,
          feldArt: f.feldArt, name, optionen: [], pflicht: false });
      }
      const { baueDokument } = await import('./ausgabe.js');
      return {
        bytes: await baueDokument({}),
        name: mitEndung(dateien[0].name, '-ausfuellbar.pdf'),
        satz: `${funde.length} Felder angelegt`,
      };
    },
  },
];

export const werkzeugMit = (id) => WERKZEUGE.find((w) => w.id === id) || null;

/* ---------- Der kurze Weg als Oberfläche --------------------------------- */

/**
 * Legt die Einzelwerkzeug-Ansicht über den Empfang.
 * @param {string} id
 * @returns {boolean} ob es das Werkzeug gibt
 */
export function zeigeEinzelwerkzeug(id) {
  const werkzeug = werkzeugMit(id);
  if (!werkzeug) return false;

  const rumpf = $('#empfang-rumpf');
  const empfang = $('#empfang');
  if (!rumpf || !empfang) return false;

  const wahl = el('input', {
    type: 'file', hidden: true, accept: werkzeug.nimmt,
    multiple: werkzeug.mehrere === true,
  });
  const stand = el('p', { klasse: 'einzel-stand hinweis' });
  const liste = el('div', { klasse: 'einzel-dateien' });
  let dateien = [];

  /* Die Angaben, die dieses eine Werkzeug braucht — und keine mehr. Ein
     Schieber für die Bildgüte gehört ins Studio, nicht auf den kurzen Weg. */
  const felder = {};
  const zusatz = el('div', { klasse: 'einzel-zusatz' });
  if (werkzeug.wahl) {
    felder.wahl = el('select', { klasse: 'feld' },
      ...werkzeug.wahl.werte.map(([w, t]) => el('option', { value: w, text: t })));
    felder.wahl.value = werkzeug.wahl.wert;
    zusatz.append(el('label', { klasse: 'einzel-feld' },
      el('span', { text: werkzeug.wahl.name }), felder.wahl));
  }
  if (werkzeug.zahl) {
    felder.zahl = el('input', { klasse: 'feld', type: 'number',
      min: String(werkzeug.zahl.von ?? 1), value: String(werkzeug.zahl.wert) });
    zusatz.append(el('label', { klasse: 'einzel-feld' },
      el('span', { text: werkzeug.zahl.name }), felder.zahl));
  }
  if (werkzeug.kennwort) {
    felder.kennwort = el('input', { klasse: 'feld', type: 'password',
      placeholder: werkzeug.kennwort.platzhalter, autocomplete: 'off' });
    zusatz.append(el('label', { klasse: 'einzel-feld' },
      el('span', { text: werkzeug.kennwort.name }), felder.kennwort));
  }

  const tun = el('button', { klasse: 'knopf knopf-voll knopf-gross', text: werkzeug.knopf, disabled: true });

  const zeichneListe = () => {
    liste.innerHTML = '';
    for (const [i, datei] of dateien.entries()) {
      liste.append(el('div', { klasse: 'einzel-datei' },
        el('span', { klasse: 'mono klein leise', text: String(i + 1) }),
        el('span', { klasse: 'einzel-datei-name', text: datei.name }),
        el('span', { klasse: 'mono klein leise', text: groesse(datei.size) }),
        el('button', {
          klasse: 'knopf knopf-klein knopf-still', text: '✕', 'aria-label': `${datei.name} entfernen`,
          beiClick: () => { dateien = dateien.filter((d) => d !== datei); zeichneListe(); },
        })));
    }
    const genug = dateien.length >= (werkzeug.mindestens || 1);
    tun.disabled = !genug;
    stand.textContent = !dateien.length ? ''
      : genug ? `${dateien.length} Datei${dateien.length === 1 ? '' : 'en'} bereit.`
        : `Noch mindestens ${werkzeug.mindestens - dateien.length} Datei nötig.`;
  };

  wahl.addEventListener('change', (e) => {
    const neue = [...e.target.files];
    dateien = werkzeug.mehrere ? [...dateien, ...neue] : neue.slice(0, 1);
    zeichneListe();
  });

  tun.addEventListener('click', () => mitLader(`${werkzeug.name} läuft …`, async () => {
    try {
      const optionen = Object.fromEntries(Object.entries(felder).map(([k, f]) =>
        [k, f.type === 'number' ? Number(f.value) : f.value]));
      const ergebnis = await werkzeug.tun(dateien, optionen, (text) => { stand.textContent = text; });
      if (ergebnis.bytes) sichereBytes(ergebnis.bytes, ergebnis.name, ergebnis.art);
      stand.textContent = ergebnis.satz || 'Fertig.';
      sage(`${werkzeug.name}: ${ergebnis.satz || 'fertig'}`, { dauer: 7000 });
      /* Manche Werkzeuge lohnen das Weiterarbeiten — dann steht der Weg
         dorthin da, statt dass man die Datei noch einmal hinlegt. */
      if (werkzeug.imStudioWeiter && zustand.folge.length) {
        stand.append(el('button', {
          klasse: 'knopf knopf-klein', stil: { marginLeft: '8px' }, text: 'Im Studio öffnen',
          beiClick: () => { verlasseEinzelwerkzeug(); melde('dokument:geladen'); melde('dokument:geaendert'); },
        }));
      }
    } catch (fehler) {
      stand.textContent = fehler.message;
      stand.classList.add('ist-warnung');
      setTimeout(() => stand.classList.remove('ist-warnung'), 6000);
    }
  }));

  const ansicht = el('div', { klasse: 'einzel', id: 'einzelwerkzeug' },
    el('div', { klasse: 'einzel-karte' },
      el('a', { klasse: 'einzel-zurueck', href: './', text: '← Alle Werkzeuge' }),
      el('div', { klasse: 'einzel-zeichen', html:
        `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${werkzeug.zeichen}"/></svg>` }),
      el('h1', { text: werkzeug.name }),
      el('p', { klasse: 'einzel-satz', text: werkzeug.satz }),
      el('button', {
        klasse: 'knopf knopf-gross einzel-waehlen',
        text: werkzeug.mehrere ? 'Dateien wählen' : 'Datei wählen',
        beiClick: () => wahl.click(),
      }),
      liste,
      zusatz,
      stand,
      tun,
      el('p', { klasse: 'einzel-fuss hinweis' },
        'Läuft in diesem Fenster. Die Datei wird nicht hochgeladen. ',
        el('a', { href: './', text: 'Zum vollen Studio' }), '.'),
      wahl));

  /* Nur der Rumpf wird ersetzt — der Kopf mit der Wortmarke bleibt stehen.
     Ein Werkzeug ist ein Teil des Studios, nicht ein anderes Programm.

     Der alte Rumpf wird aufgehoben, nicht weggeworfen: wer das Werkzeug
     verlaesst und spaeter die letzte Mappe schliesst, landet sonst auf einem
     leeren Empfang ohne Karte und ohne Kacheln — und kommt da nur mit einem
     Neuladen wieder heraus. */
  if (!rumpfVorher) rumpfVorher = rumpf.innerHTML;
  rumpf.innerHTML = '';
  rumpf.append(ansicht);
  empfang.hidden = false;
  document.documentElement.dataset.einzelwerkzeug = werkzeug.id;
  document.title = `${werkzeug.name} — PDF Studio`;
  return true;
}

/** Was auf dem Empfang stand, bevor ein Werkzeug ihn belegt hat. */
let rumpfVorher = null;

/** Räumt die Einzelansicht weg und gibt das Studio frei. */
export function verlasseEinzelwerkzeug() {
  $('#einzelwerkzeug')?.remove();
  /* Den Empfang wiederherstellen, nicht nur verstecken. */
  const rumpf = $('#empfang-rumpf');
  if (rumpf && rumpfVorher !== null) {
    rumpf.innerHTML = rumpfVorher;
    rumpfVorher = null;
    /* Die Kacheln sind aus Zeichenketten wieder da, aber ohne ihre
       Ereignisse — sie sind Verweise, die brauchen keine. Die zwei Knoepfe
       schon: sie werden neu verdrahtet. */
    melde('empfang:wiederhergestellt');
  }
  delete document.documentElement.dataset.einzelwerkzeug;
  document.title = 'PDF Studio';
  $('#empfang').hidden = true;
  $('#huelle').hidden = false;
}

/** Die Kacheln für den Empfang. */
export function werkzeugKacheln() {
  return el('div', { klasse: 'werkzeugkacheln' },
    ...WERKZEUGE.map((w) => el('a', {
      klasse: 'werkzeugkachel', href: `?werkzeug=${w.id}`, title: w.satz,
    },
      el('span', { klasse: 'werkzeugkachel-zeichen', html:
        `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${w.zeichen}"/></svg>` }),
      el('span', { klasse: 'werkzeugkachel-name', text: w.name }))));
}
