/* Stapel — dieselbe Arbeit an vielen Dateien.

   Acrobat nennt das „Geführte Aktionen": eine Folge von Schritten, auf einen
   Ordner losgelassen. Hier ist es dasselbe, nur ohne Ordner — der Browser
   darf keinen lesen, also werden die Dateien ausgewählt und das Ergebnis
   kommt als ein Archiv zurück.

   **Nur Schritte, die Bytes zu Bytes machen.** Schwärzen, Anmerken, Messen
   und Ausfüllen brauchen ein geöffnetes Dokument und einen Menschen, der
   hinsieht — das lässt sich nicht stapeln, ohne zu raten. Was hier steht,
   braucht keine Entscheidung: reparieren, linearisieren, entschützen,
   schützen, Metadaten entfernen, drehen.

   Ein Fehler an einer Datei hält den Lauf nicht auf. Am Ende steht, was
   gelungen ist und was nicht — ein Stapel, der beim dritten von vierzig
   abbricht, ist schlimmer als keiner. */

import { fremdWeg, ladeDatei, sichererName } from './kern.js';
import { schreibeZip } from './zip.js';

export const SCHRITTE = [
  {
    id: 'entschuetzen',
    name: 'Kennwort entfernen',
    hinweis: 'Braucht das Kennwort. Ohne das richtige bleibt die Datei zu.',
    braucht: 'kennwort',
    async tun(bytes, optionen) {
      const { entschluessle } = await import('./schutz.js');
      return entschluessle(bytes, optionen.kennwort || '');
    },
  },
  {
    id: 'reparieren',
    name: 'Reparieren (neu aufbauen)',
    hinweis: 'qpdf schreibt die Datei von Grund auf neu. Hilft bei kaputten Querverweisen.',
    async tun(bytes) {
      const { repariere } = await import('./schutz.js');
      return repariere(bytes);
    },
  },
  {
    id: 'metadaten',
    name: 'Metadaten entfernen',
    hinweis: 'Verfasser, Erzeuger, Thema und Schlagwörter. Der Inhalt bleibt.',
    async tun(bytes) {
      const { PDFDocument, PDFName } = await import(fremdWeg('pdf-lib.mjs'));
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      doc.setAuthor(''); doc.setCreator(''); doc.setSubject(''); doc.setKeywords([]);
      doc.setProducer('PDF Studio');
      try { doc.catalog.delete(PDFName.of('Metadata')); } catch { /* nicht vorhanden */ }
      return doc.save();
    },
  },
  {
    id: 'drehen',
    name: 'Alle Seiten drehen',
    hinweis: 'Um den gewählten Winkel, zusätzlich zur vorhandenen Drehung.',
    braucht: 'winkel',
    async tun(bytes, optionen) {
      const { PDFDocument, degrees } = await import(fremdWeg('pdf-lib.mjs'));
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const winkel = Number(optionen.winkel) || 90;
      for (const seite of doc.getPages()) {
        seite.setRotation(degrees((((seite.getRotation().angle + winkel) % 360) + 360) % 360));
      }
      return doc.save();
    },
  },
  {
    id: 'linearisieren',
    name: 'Fürs Web aufbereiten (linearisieren)',
    hinweis: 'Die Datei öffnet im Browser seitenweise statt erst am Stück.',
    async tun(bytes) {
      const { linearisiere } = await import('./schutz.js');
      return linearisiere(bytes);
    },
  },
  {
    id: 'schuetzen',
    name: 'Mit Kennwort schützen',
    hinweis: 'AES-256. Kommt zuletzt — danach lässt sich nichts mehr anfassen.',
    braucht: 'neuesKennwort',
    async tun(bytes, optionen) {
      const { verschluessle } = await import('./schutz.js');
      return verschluessle(bytes, { benutzer: optionen.neuesKennwort, besitzer: optionen.neuesKennwort });
    },
  },
];

/* Die Reihenfolge ist nicht beliebig: entschützen muss vor allem anderen
   kommen, schützen nach allem. Deshalb wird nicht die Klickreihenfolge
   genommen, sondern die aus SCHRITTE. */
export function ordne(ids) {
  return SCHRITTE.filter((s) => ids.includes(s.id));
}

/** Welche Zusatzangaben die gewählten Schritte brauchen. */
export function benoetigt(ids) {
  return [...new Set(ordne(ids).map((s) => s.braucht).filter(Boolean))];
}

/**
 * Lässt die Schritte über die Dateien laufen.
 * @param {File[]} dateien
 * @param {string[]} schrittIds
 * @param {object} optionen  kennwort, neuesKennwort, winkel
 * @param {(stand: {datei: string, nummer: number, gesamt: number, schritt: string}) => void} melde
 * @returns {Promise<{name: string, bytes?: Uint8Array, fehler?: string, vorher: number, nachher?: number}[]>}
 */
export async function laufeStapel(dateien, schrittIds, optionen = {}, melde = null) {
  const schritte = ordne(schrittIds);
  if (!schritte.length) throw new Error('Kein Schritt gewählt.');
  if (!dateien.length) throw new Error('Keine Datei gewählt.');

  const ergebnisse = [];
  let nummer = 0;
  for (const datei of dateien) {
    nummer += 1;
    const roh = datei.bytes || await ladeDatei(datei);
    let bytes = roh;
    let fehler = null;
    for (const schritt of schritte) {
      melde?.({ datei: datei.name, nummer, gesamt: dateien.length, schritt: schritt.name });
      try {
        bytes = await schritt.tun(bytes, optionen);
      } catch (ursache) {
        fehler = `${schritt.name}: ${ursache?.message || ursache}`;
        break;
      }
    }
    ergebnisse.push(fehler
      ? { name: datei.name, fehler, vorher: roh.byteLength }
      : { name: datei.name, bytes, vorher: roh.byteLength, nachher: bytes.byteLength });
  }
  return ergebnisse;
}

/**
 * Packt die gelungenen Ergebnisse in ein Archiv — samt einem Bericht, was
 * gelungen ist und was nicht. Der Bericht liegt bei, weil ein Archiv mit
 * achtunddreißig statt vierzig Dateien sonst unbemerkt bliebe.
 */
export async function packe(ergebnisse, schrittIds) {
  const gelungen = ergebnisse.filter((e) => e.bytes);
  const namen = new Set();
  const eintraege = gelungen.map((e) => {
    let name = sichererName(e.name.replace(/\.pdf$/i, '') + '.pdf');
    let n = 2;
    while (namen.has(name)) name = name.replace(/(\.pdf)$/i, `-${n++}$1`);
    namen.add(name);
    return { name, daten: e.bytes };
  });

  const zeilen = [
    'Stapelverarbeitung — PDF Studio',
    '',
    `Schritte: ${ordne(schrittIds).map((s) => s.name).join(' → ')}`,
    `Dateien: ${ergebnisse.length}, gelungen: ${gelungen.length}, gescheitert: ${ergebnisse.length - gelungen.length}`,
    '',
    ...ergebnisse.map((e) => e.bytes
      ? `OK        ${e.name}  ${(e.vorher / 1024).toFixed(0)} kB → ${(e.nachher / 1024).toFixed(0)} kB`
      : `GESCHEITERT ${e.name}  ${e.fehler}`),
  ];
  eintraege.push({ name: 'bericht.txt', daten: zeilen.join('\n') });

  return schreibeZip(eintraege);
}
