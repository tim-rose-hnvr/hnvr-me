/* Aufdruck — was auf jeder Seite landet, ohne dass es jemand hinzeichnet:
   Wasserzeichen, Kopfzeile, Fußzeile, Seitenzahlen.

   Der Unterschied zu einer Anmerkung ist grundsätzlich, nicht gradueller: eine
   Anmerkung gehört an eine Stelle auf einer Seite und wird dorthin gezogen.
   Ein Aufdruck gehört zum Dokument und erscheint auf jeder Seite, die in den
   Bereich fällt — oft auf hunderten. Niemand zieht ihn hin.

   Deshalb steht er nicht in `zustand.anmerkungen`, sondern in
   `zustand.aufdruck` — eine Beschreibung, keine Liste von Objekten. Gerechnet
   wird er zweimal aus derselben Beschreibung: einmal beim Zeichnen auf den
   Bildschirm (`ansicht.js`), einmal beim Sichern (`ausgabe.js`). Zwei Rechner,
   eine Wahrheit — wie bei den Anmerkungen. Was man sieht, kommt heraus.

   Felder in geschweiften Klammern werden beim Setzen ersetzt:

     {seite}   die Nummer dieser Seite          {seiten}  wieviele es sind
     {datum}   heute, deutsch                   {zeit}    Uhrzeit
     {datei}   Name des Dokuments               {titel}   Titel aus den Merkmalen

   Die Zählung ist nicht immer die Seitenzahl: „ab Seite 3 beginnen mit 1" ist
   der Normalfall in Gremienunterlagen, weil Deckblatt und Inhaltsverzeichnis
   nicht mitzählen. Deshalb `beginntBei` und `ersteSeite` getrennt. */

import { zustand, melde, merkeSchritt, svgEl } from './kern.js';

export const STELLEN = [
  { id: 'links', name: 'links' },
  { id: 'mitte', name: 'mittig' },
  { id: 'rechts', name: 'rechts' },
];

/** Voreinstellungen — sie sind die Antwort auf „was will man meistens". */
export const VORGABE = {
  wasserzeichen: {
    text: 'ENTWURF',
    groesse: 64,
    winkel: 45,
    deckung: 0.12,
    farbe: '#1D2327',
    ueberDemInhalt: false,
  },
  kopf: { links: '', mitte: '', rechts: '', groesse: 9, farbe: '#5F686E', abstand: 28 },
  fuss: { links: '', mitte: '', rechts: 'Seite {seite} von {seiten}', groesse: 9, farbe: '#5F686E', abstand: 28 },
};

/** Was zurzeit aufgedruckt wird. `null` heißt: nichts. */
export function aufdruck() { return zustand.aufdruck; }

export function hatAufdruck() {
  const a = zustand.aufdruck;
  if (!a) return false;
  return !!(a.wasserzeichen || zeilenVon(a.kopf).length || zeilenVon(a.fuss).length);
}

function zeilenVon(teil) {
  if (!teil) return [];
  return STELLEN.map((s) => teil[s.id]).filter((t) => t && t.trim());
}

/**
 * Setzt den Aufdruck. `null` entfernt ihn.
 * Rückgängig geht über die Historie — ein Wasserzeichen auf 200 Seiten ist
 * genau die Art Änderung, die man einmal zu oft macht.
 */
export function setzeAufdruck(neu) {
  const vorher = zustand.aufdruck;
  const setze = (wert) => {
    zustand.aufdruck = wert;
    zustand.geaendert = true;
    melde('aufdruck:geaendert');
    melde('seiten:geaendert');
  };
  merkeSchritt(neu ? 'Aufdruck gesetzt' : 'Aufdruck entfernt',
    () => setze(vorher), () => setze(neu));
  setze(neu);
}

/**
 * Für welche Seiten der Aufdruck gilt — als Menge von Seitennummern (1-basiert).
 * @param {{bereich?: string, ersteSeite?: number}} teil
 */
export function gilt(teil, seitenzahl) {
  const von = Math.max(1, teil?.ersteSeite || 1);
  const menge = new Set();
  for (let n = von; n <= seitenzahl; n++) {
    if (teil?.bereich === 'ungerade' && n % 2 === 0) continue;
    if (teil?.bereich === 'gerade' && n % 2 === 1) continue;
    menge.add(n);
  }
  return menge;
}

/**
 * Ersetzt die Felder in geschweiften Klammern.
 * @param {string} muster
 * @param {{nummer: number, seitenzahl: number, beginntBei?: number, ersteSeite?: number}} lage
 */
export function setzeFelder(muster, lage) {
  const { nummer, seitenzahl, beginntBei = 1, ersteSeite = 1 } = lage;
  /* Die gezeigte Zahl: „ab Seite 3 mit 1 beginnen" heißt, dass Seite 3 die
     Eins trägt. Vor der ersten Seite gibt es keinen Aufdruck, also keine
     negativen Zahlen. */
  const gezeigt = nummer - ersteSeite + beginntBei;
  const gesamt = seitenzahl - ersteSeite + beginntBei;
  const jetzt = new Date();
  return String(muster)
    .replace(/\{seite\}/g, String(gezeigt))
    .replace(/\{seiten\}/g, String(gesamt))
    .replace(/\{datum\}/g, jetzt.toLocaleDateString('de-DE'))
    .replace(/\{zeit\}/g, jetzt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }))
    .replace(/\{datei\}/g, zustand.name || '')
    .replace(/\{titel\}/g, zustand.eigenschaften?.titel || zustand.name?.replace(/\.pdf$/i, '') || '');
}

/**
 * Rechnet den Aufdruck einer Seite in Zeichenbefehle um — in PDF-Punkten, mit
 * dem Ursprung unten links, wie alles andere auch.
 *
 * Beide Zeichner (Bildschirm und Ausgabe) rufen dies auf. Wer hier etwas
 * ändert, ändert beide — das ist der ganze Zweck.
 *
 * @param {{nummer: number, seitenzahl: number, breitePt: number, hoehePt: number}} seite
 * @returns {{art: 'text'|'schraeg', text: string, x: number, y: number, groesse: number,
 *            farbe: string, deckung: number, winkel: number, ausrichtung: 'links'|'mitte'|'rechts'}[]}
 */
export function befehleFuerSeite({ nummer, seitenzahl, breitePt, hoehePt }) {
  const a = zustand.aufdruck;
  if (!a) return [];
  const raus = [];

  if (a.wasserzeichen && gilt(a.wasserzeichen, seitenzahl).has(nummer)) {
    const w = a.wasserzeichen;
    if (w.text?.trim()) {
      raus.push({
        art: 'schraeg',
        text: setzeFelder(w.text, { nummer, seitenzahl, ...w }),
        x: breitePt / 2,
        y: hoehePt / 2,
        groesse: w.groesse ?? VORGABE.wasserzeichen.groesse,
        farbe: w.farbe || VORGABE.wasserzeichen.farbe,
        deckung: w.deckung ?? VORGABE.wasserzeichen.deckung,
        winkel: w.winkel ?? VORGABE.wasserzeichen.winkel,
        ausrichtung: 'mitte',
        ueberDemInhalt: !!w.ueberDemInhalt,
      });
    }
  }

  for (const [teilName, obenOderUnten] of [['kopf', 'oben'], ['fuss', 'unten']]) {
    const teil = a[teilName];
    if (!teil || !gilt(teil, seitenzahl).has(nummer)) continue;
    const abstand = teil.abstand ?? 28;
    const groesse = teil.groesse ?? 9;
    /* Der Text sitzt auf seiner Grundlinie. Oben misst der Abstand von der
       Oberkante bis zur Grundlinie, unten von der Unterkante — sonst wandert
       eine größere Schrift oben nach oben und unten nach oben, und die beiden
       Zeilen stehen ungleich weit von der Kante. */
    const y = obenOderUnten === 'oben' ? hoehePt - abstand : abstand;
    for (const stelle of STELLEN) {
      const muster = teil[stelle.id];
      if (!muster || !muster.trim()) continue;
      raus.push({
        art: 'text',
        text: setzeFelder(muster, { nummer, seitenzahl, ...teil }),
        x: stelle.id === 'links' ? abstand : stelle.id === 'rechts' ? breitePt - abstand : breitePt / 2,
        y,
        groesse,
        farbe: teil.farbe || '#5F686E',
        deckung: 1,
        winkel: 0,
        ausrichtung: stelle.id,
        ueberDemInhalt: true,
      });
    }
  }
  return raus;
}


/* ---------- Auf den Bildschirm ------------------------------------------- */

/* Dieselben Befehle wie in der Ausgabe, nur in SVG statt in die Datei. Der
   Aufdruck liegt in einer eigenen Ebene über dem Seitenbild und unter den
   Anmerkungen — er ist Teil des Dokuments, nicht eine Notiz darauf, aber er
   soll nichts verdecken, was jemand hingezeichnet hat.

   Die Ebene fängt keine Klicks: durch ein Wasserzeichen hindurch muss man
   Text markieren können. */
export function zeichneAufdruck(ebene, eintrag, sicht) {
  ebene.innerHTML = '';
  if (!zustand.aufdruck) return;

  const nummer = zustand.folge.indexOf(eintrag) + 1;
  const befehle = befehleFuerSeite({
    nummer,
    seitenzahl: zustand.folge.length,
    breitePt: sicht.viewBox[2],
    hoehePt: sicht.viewBox[3],
  });
  if (!befehle.length) return;

  const svg = svgEl('svg', {
    width: sicht.width, height: sicht.height,
    viewBox: `0 0 ${sicht.width} ${sicht.height}`,
  });
  ebene.append(svg);

  for (const b of befehle) {
    const [x, y] = sicht.convertToViewportPoint(b.x, b.y);
    const knoten = svgEl('text', {
      x, y,
      'font-family': 'Helvetica, Arial, sans-serif',
      'font-size': b.groesse * sicht.scale,
      'font-weight': b.art === 'schraeg' ? '700' : '400',
      fill: b.farbe,
      'fill-opacity': b.deckung,
      'text-anchor': b.ausrichtung === 'mitte' ? 'middle' : b.ausrichtung === 'rechts' ? 'end' : 'start',
      /* Der Bildschirm dreht andersherum als das PDF: dort zählt der Winkel
         gegen den Uhrzeigersinn, hier mit ihm. */
      transform: b.winkel ? `rotate(${-b.winkel} ${x} ${y})` : null,
    });
    knoten.textContent = b.text;
    svg.append(knoten);
  }
}
