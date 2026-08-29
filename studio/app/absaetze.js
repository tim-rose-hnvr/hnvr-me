/* Absätze — Textläufe zu Absätzen zusammenrechnen, damit Bearbeiten umbricht.

   Ein PDF kennt keine Absätze. Es kennt Buchstabengruppen an Punkten. „Der
   Auftragnehmer liefert acht Sprechstellen." kann aus einem Stück bestehen,
   aus sieben, oder über drei Zeilen laufen — die Datei sagt es nicht.

   Solange die Werkbank nur einzelne Läufe ersetzen konnte, war „Text
   bearbeiten" ein Ersetzen an Ort und Stelle: gleich lang oder es passte
   nicht. Wer ein Wort einfügte, schob nichts nach — der Rest der Zeile stand
   weiter da, wo er stand.

   Hier wird daraus ein Absatz. Der Weg ist Geometrie, keine Zauberei:

   1. **Zeilen** — Läufe auf derselben Grundlinie, von links nach rechts
      geordnet. Eine Lücke von mehr als einem Viertel Schriftgrad ist ein
      Leerzeichen, alles darunter gehört zusammen.
   2. **Absätze** — aufeinanderfolgende Zeilen mit gleichem Schriftgrad,
      gleichem linken Rand und gleichmäßigem Abstand. Bricht eines davon,
      bricht der Absatz.
   3. **Ausrichtung** — decken sich links *und* rechts, ist es Blocksatz;
      decken sich nur die Mitten, ist es zentriert.

   **Was das nicht kann und auch nicht vorgibt zu können:** Spalten werden
   nicht erkannt (zwei Spalten nebeneinander haben verschiedene linke Ränder
   und zerfallen deshalb in zwei Absätze — das ist richtig). Fett und kursiv
   innerhalb eines Absatzes gehen beim Bearbeiten verloren, weil neu gesetzt
   wird und der Umbruch die Stellen verschiebt. Silbentrennung gibt es nicht.

   Diese Grenzen sind der Preis dafür, dass der Text hinterher wirklich
   umbricht. Ein Bearbeiten, das die Auszeichnung erhält, aber nicht umbricht,
   ist das, was vorher da war. */

import { holeSeite } from './dokument.js';

/** Zwei Werte gelten als gleich, wenn sie näher beieinander liegen als das. */
const NAH = { grundlinie: 2.2, rand: 2.5, grad: 0.1 };

/**
 * Alle Absätze einer Seite, in PDF-Punkten der Quellseite.
 * @param {object} eintrag Eintrag aus `zustand.folge`
 */
export async function absaetzeDerSeite(eintrag) {
  const seite = await holeSeite(eintrag);
  const inhalt = await seite.getTextContent();

  const laeufe = [];
  for (const stueck of inhalt.items) {
    const text = stueck.str;
    if (!text || !text.trim()) continue;
    const [a, , , d, x, y] = stueck.transform;
    /* Der Schriftgrad steckt in der Matrix, nicht in `height` — dort steht
       die Höhe der Zeile, die bei manchen Erzeugern gleich Null ist. */
    const grad = Math.abs(d) || Math.abs(a) || stueck.height || 10;
    laeufe.push({ text, x, y, b: stueck.width || 0, grad });
  }
  if (!laeufe.length) return [];

  return zuAbsaetzen(zuZeilen(laeufe));
}

/** Läufe auf derselben Grundlinie zu Zeilen. */
function zuZeilen(laeufe) {
  const zeilen = [];
  for (const lauf of [...laeufe].sort((p, q) => q.y - p.y || p.x - q.x)) {
    const passt = zeilen.find((z) => Math.abs(z.y - lauf.y) <= NAH.grundlinie
      && Math.abs(z.grad - lauf.grad) <= z.grad * NAH.grad + 0.4);
    if (passt) passt.laeufe.push(lauf);
    else zeilen.push({ y: lauf.y, grad: lauf.grad, laeufe: [lauf] });
  }

  for (const zeile of zeilen) {
    zeile.laeufe.sort((p, q) => p.x - q.x);
    zeile.x = zeile.laeufe[0].x;
    const letzter = zeile.laeufe[zeile.laeufe.length - 1];
    zeile.rechts = letzter.x + letzter.b;
    /* Zwischen zwei Läufen steht ein Leerzeichen, wenn die Lücke breiter ist
       als ein Viertel Schriftgrad — und keines, wenn einer schon eines trägt. */
    let text = '';
    for (const [i, lauf] of zeile.laeufe.entries()) {
      if (i) {
        const vorher = zeile.laeufe[i - 1];
        const luecke = lauf.x - (vorher.x + vorher.b);
        const braucht = luecke > zeile.grad * 0.22 && !/\s$/.test(text) && !/^\s/.test(lauf.text);
        if (braucht) text += ' ';
      }
      text += lauf.text;
    }
    zeile.text = text.replace(/\s+/g, ' ').trim();
  }
  return zeilen.filter((z) => z.text).sort((p, q) => q.y - p.y);
}

/** Zeilen zu Absätzen. */
function zuAbsaetzen(zeilen) {
  const absaetze = [];
  let laufend = null;

  const schliesse = () => {
    if (!laufend) return;
    absaetze.push(fertig(laufend));
    laufend = null;
  };

  for (const zeile of zeilen) {
    if (!laufend) { laufend = { zeilen: [zeile] }; continue; }
    const vorige = laufend.zeilen[laufend.zeilen.length - 1];
    const abstand = vorige.y - zeile.y;
    const gleicherGrad = Math.abs(vorige.grad - zeile.grad) <= vorige.grad * NAH.grad + 0.3;

    /* Der erwartete Zeilenabstand: bei zwei Zeilen der gemessene, ab drei der
       bisherige Durchschnitt. So bricht ein Absatz nicht an seiner eigenen
       zweiten Zeile, nur weil sie enger steht als üblich. */
    const bisher = laufend.zeilen.length > 1
      ? (laufend.zeilen[0].y - vorige.y) / (laufend.zeilen.length - 1)
      : null;
    const passtAbstand = bisher
      ? abstand > bisher * 0.6 && abstand < bisher * 1.6
      : abstand > vorige.grad * 0.75 && abstand < vorige.grad * 2.2;

    /* Der linke Rand: gleich, oder die *erste* Zeile war eingerückt. Eine
       Einrückung mitten im Absatz gibt es nicht. */
    const randGleich = Math.abs(vorige.x - zeile.x) <= NAH.rand;
    const erstZeileEingerueckt = laufend.zeilen.length === 1
      && zeile.x < vorige.x - NAH.rand && vorige.x - zeile.x < vorige.grad * 3;

    if (gleicherGrad && passtAbstand && (randGleich || erstZeileEingerueckt)) {
      laufend.zeilen.push(zeile);
    } else {
      schliesse();
      laufend = { zeilen: [zeile] };
    }
  }
  schliesse();
  return absaetze;
}

function fertig({ zeilen }) {
  const grad = zeilen.reduce((s, z) => s + z.grad, 0) / zeilen.length;
  const links = Math.min(...zeilen.map((z) => z.x));
  const rechts = Math.max(...zeilen.map((z) => z.rechts));
  const unten = Math.min(...zeilen.map((z) => z.y));
  const oben = Math.max(...zeilen.map((z) => z.y));
  const zeilenhoehe = zeilen.length > 1 ? (oben - unten) / (zeilen.length - 1) : grad * 1.2;

  /* Ausrichtung: die letzte Zeile eines Blocksatzes ist kurz und zählt nicht
     mit — sonst gilt jeder Blocksatz als linksbündig. */
  const ohneLetzte = zeilen.length > 1 ? zeilen.slice(0, -1) : zeilen;
  const linksBuendig = ohneLetzte.every((z) => Math.abs(z.x - links) <= NAH.rand);
  const rechtsBuendig = ohneLetzte.every((z) => Math.abs(z.rechts - rechts) <= NAH.rand);
  const mittig = ohneLetzte.every((z) =>
    Math.abs((z.x + z.rechts) / 2 - (links + rechts) / 2) <= NAH.rand);

  const ausrichtung = linksBuendig && rechtsBuendig && zeilen.length > 1 ? 'blocksatz'
    : mittig && !linksBuendig ? 'mitte'
      : rechtsBuendig && !linksBuendig ? 'rechts'
        : 'links';

  return {
    text: zeilen.map((z) => z.text).join(' '),
    zeilenTexte: zeilen.map((z) => z.text),
    /* Der Kasten reicht von der Unterlänge der letzten Zeile bis zur
       Oberlänge der ersten — nicht nur von Grundlinie zu Grundlinie, sonst
       bleibt beim Überdecken eine Reihe Buchstabenreste stehen. */
    x: links,
    y: unten - grad * 0.26,
    b: rechts - links,
    h: (oben - unten) + grad * 1.1,
    grundlinieErste: oben,
    grad,
    zeilenhoehe,
    ausrichtung,
    zeilenzahl: zeilen.length,
  };
}

/**
 * Der Absatz, in dem ein Punkt liegt. Trifft nichts, kommt `null`.
 * @param {object[]} absaetze
 * @param {{x: number, y: number}} punkt in PDF-Punkten
 */
export function absatzAn(absaetze, punkt) {
  /* Etwas Luft nach außen: wer knapp neben den letzten Buchstaben klickt,
     meint den Absatz und nicht den weißen Rand daneben. */
  const luft = 3;
  return absaetze.find((a) => punkt.x >= a.x - luft && punkt.x <= a.x + a.b + luft
    && punkt.y >= a.y - luft && punkt.y <= a.y + a.h + luft) || null;
}

/**
 * Bricht Text auf eine Breite um — dieselbe Rechnung, die die Ausgabe später
 * anstellt, damit der Dialog vorher sagen kann, wieviele Zeilen es werden.
 * @param {(text: string, grad: number) => number} breiteVon Breitenmesser
 */
export function umbricht(text, breite, grad, breiteVon) {
  const zeilen = [];
  for (const absatz of String(text).split('\n')) {
    let laufend = '';
    for (const wort of absatz.split(/\s+/).filter(Boolean)) {
      const versuch = laufend ? `${laufend} ${wort}` : wort;
      if (laufend && breiteVon(versuch, grad) > breite) {
        zeilen.push(laufend);
        laufend = wort;
      } else laufend = versuch;
    }
    zeilen.push(laufend);
  }
  return zeilen;
}
