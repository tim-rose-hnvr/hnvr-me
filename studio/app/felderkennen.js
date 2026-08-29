/* Felderkennung — aus einem flachen Formular ausfüllbare Felder machen.

   Ein PDF, das als Formular gedruckt wurde, enthält keine Felder. Es enthält
   Linien, Kästchen und Text. Wer es ausfüllen soll, druckt es aus, füllt es
   mit der Hand und scannt es wieder ein. Genau das soll aufhören.

   **Der Weg führt über das Bild, nicht über die Zeichenbefehle.** Das ist eine
   Entscheidung mit Folgen, deshalb steht sie hier: Ein PDF beschreibt seine
   Linien in einem Wust aus Pfaden, Transformationen und Grafikzuständen; sie
   sauber auszulesen heißt, den halben PDF-Zeichner nachzubauen. Ein Scan
   dagegen hat überhaupt keine Zeichenbefehle — dort ist alles ein Bild.

   Also wird die Seite gerendert und im Bild gesucht. Ein Weg für beide Fälle:
   dieselbe Erkennung findet die Linien im gesetzten Formular wie im
   eingescannten. Der Preis ist Rechenzeit und eine Genauigkeit von etwa einem
   halben Punkt — für ein Feld, das der Mensch danach bestätigt, reicht das.

   **Was gefunden wird:**

   - **Ausfülllinien** — waagerechte Striche ab 60 pt, über denen Platz ist.
     Das Feld sitzt darüber, nicht darauf.
   - **Kästchen** — Quadrate von 6 bis 22 pt. Ankreuzfelder.
   - **Rahmen** — Rechtecke ab 60 pt Breite und 12 pt Höhe. Textfelder;
     über 45 pt Höhe mehrzeilig.

   **Was einen Fund verwirft:** Ist die Fläche nicht leer, ist es kein Feld,
   sondern eine Tabellenzelle mit Inhalt oder ein Kasten um einen Absatz.
   Diese eine Regel trennt Formulare von Layout — ohne sie schlägt die
   Erkennung auf jeder Tabelle Hunderte von Feldern vor.

   **Der Name kommt aus dem Text daneben**, links auf gleicher Höhe oder
   darüber. Findet sich nichts, heißt das Feld „Feld 7" — ein Feld ohne
   brauchbaren Namen ist immer noch besser als keines.

   **Nichts wird von selbst angelegt.** Die Erkennung schlägt vor, der Mensch
   bestätigt. Ein geratenes Feld an falscher Stelle ist schlimmer als ein
   fehlendes: das fehlende sieht man. */

import { zustand } from './kern.js';
import { holeSeite } from './dokument.js';

/* Auflösung der Suche. 150 dpi ist der Punkt, an dem eine haarfeine Linie
   sicher zwei Pixel breit wird — darunter zerfällt sie, darüber kostet es nur
   noch Zeit. */
const DPI = 150;
const SKALA = DPI / 72;
const HOECHSTE_BREITE = 1700;

/* Ab wann ein Pixel dunkel ist. Ein blasses Grau ist auch eine Linie; ein
   ausgegrauter Text ist keine. */
const DUNKEL = 150;

/* Maße in PDF-Punkten. */
const MASSE = {
  linieMindestens: 60,      // eine kürzere Linie ist ein Trennstrich, kein Feld
  kastenVon: 6, kastenBis: 22,
  rahmenBreiteVon: 60, rahmenHoeheVon: 12, mehrzeiligAb: 45,
  feldHoeheUeberLinie: 14,  // wie hoch das Feld über einer Ausfülllinie wird
  leerGrenze: 0.035,        // mehr Tinte als das heißt: da steht schon etwas
};

/** Rendert die Seite als Graustufen-Bitmap. */
async function bild(eintrag) {
  const seite = await holeSeite(eintrag);
  const roh = seite.getViewport({ scale: 1, rotation: 0 });
  const skala = Math.min(SKALA, HOECHSTE_BREITE / roh.width);
  const sicht = seite.getViewport({ scale: skala, rotation: 0 });
  const breite = Math.max(1, Math.floor(sicht.width));
  const hoehe = Math.max(1, Math.floor(sicht.height));

  const leinwand = new OffscreenCanvas(breite, hoehe);
  const stift = leinwand.getContext('2d', { alpha: false, willReadFrequently: true });
  stift.fillStyle = '#fff';
  stift.fillRect(0, 0, breite, hoehe);
  await seite.render({ canvasContext: stift, viewport: sicht }).promise;

  const daten = stift.getImageData(0, 0, breite, hoehe).data;
  /* Ein Byte je Pixel: 1 = dunkel. Das spart bei einer A4-Seite in 150 dpi
     rund 5 MB gegenüber dem RGBA-Feld und macht jede Abfrage zu einem Index. */
  const punkte = new Uint8Array(breite * hoehe);
  for (let i = 0, p = 0; i < daten.length; i += 4, p++) {
    const grau = (daten[i] * 299 + daten[i + 1] * 587 + daten[i + 2] * 114) / 1000;
    punkte[p] = grau < DUNKEL ? 1 : 0;
  }
  return { punkte, breite, hoehe, skala, seitenHoehePt: roh.height, seitenBreitePt: roh.width };
}

/** Waagerechte Strecken: zusammenhängende dunkle Läufe, über Zeilen verschmolzen. */
function waagerechte({ punkte, breite, hoehe }, mindestens) {
  const roh = [];
  for (let y = 0; y < hoehe; y++) {
    let anfang = -1;
    for (let x = 0; x <= breite; x++) {
      const dunkel = x < breite && punkte[y * breite + x];
      if (dunkel && anfang < 0) anfang = x;
      else if (!dunkel && anfang >= 0) {
        if (x - anfang >= mindestens) roh.push({ y, x1: anfang, x2: x - 1 });
        anfang = -1;
      }
    }
  }
  /* Eine gezeichnete Linie ist zwei bis vier Pixel hoch. Sie kommt als
     mehrere Läufe untereinander an und wird hier zu einer Strecke. */
  return verschmelze(roh, 'y', 'x1', 'x2');
}

/** Senkrechte Strecken — dieselbe Suche, um 90 Grad gedreht. */
function senkrechte({ punkte, breite, hoehe }, mindestens) {
  const roh = [];
  for (let x = 0; x < breite; x++) {
    let anfang = -1;
    for (let y = 0; y <= hoehe; y++) {
      const dunkel = y < hoehe && punkte[y * breite + x];
      if (dunkel && anfang < 0) anfang = y;
      else if (!dunkel && anfang >= 0) {
        if (y - anfang >= mindestens) roh.push({ y: x, x1: anfang, x2: y - 1 });
        anfang = -1;
      }
    }
  }
  return verschmelze(roh, 'y', 'x1', 'x2');
}

/* Läufe, die höchstens 3 Pixel auseinanderliegen und sich zu mindestens 70 %
   überdecken, sind dieselbe Linie. */
function verschmelze(laeufe, quer, von, bis) {
  const raus = [];
  for (const lauf of laeufe.sort((a, b) => a[quer] - b[quer] || a[von] - b[von])) {
    const passt = raus.find((k) => Math.abs(k[quer] - lauf[quer]) <= 3
      && Math.min(k[bis], lauf[bis]) - Math.max(k[von], lauf[von])
         >= 0.7 * Math.min(k[bis] - k[von], lauf[bis] - lauf[von]));
    if (passt) {
      passt[von] = Math.min(passt[von], lauf[von]);
      passt[bis] = Math.max(passt[bis], lauf[bis]);
      passt.dicke = (passt.dicke || 1) + 1;
    } else raus.push({ ...lauf, dicke: 1 });
  }
  return raus;
}

/** Anteil dunkler Pixel in einem Bildbereich. */
function tinte({ punkte, breite, hoehe }, x1, y1, x2, y2) {
  const ax = Math.max(0, Math.floor(x1)), bx = Math.min(breite - 1, Math.ceil(x2));
  const ay = Math.max(0, Math.floor(y1)), by = Math.min(hoehe - 1, Math.ceil(y2));
  if (bx <= ax || by <= ay) return 1;
  let dunkel = 0;
  for (let y = ay; y <= by; y++) {
    for (let x = ax; x <= bx; x++) if (punkte[y * breite + x]) dunkel++;
  }
  return dunkel / ((bx - ax + 1) * (by - ay + 1));
}

/* Rechtecke: zwei waagerechte Strecken mit fast gleicher Spanne, verbunden
   von zwei senkrechten an den Enden. */
function rechtecke(karte, waag, senk) {
  const raus = [];
  for (let i = 0; i < waag.length; i++) {
    for (let j = i + 1; j < waag.length; j++) {
      const oben = waag[i], unten = waag[j];
      const hoehe = unten.y - oben.y;
      if (hoehe < 4) continue;
      if (Math.abs(oben.x1 - unten.x1) > 6 || Math.abs(oben.x2 - unten.x2) > 6) continue;
      const x1 = Math.max(oben.x1, unten.x1), x2 = Math.min(oben.x2, unten.x2);
      if (x2 - x1 < 6) continue;
      const links = senk.some((s) => Math.abs(s.y - x1) <= 5 && s.x1 <= oben.y + 4 && s.x2 >= unten.y - 4);
      const rechts = senk.some((s) => Math.abs(s.y - x2) <= 5 && s.x1 <= oben.y + 4 && s.x2 >= unten.y - 4);
      if (!links || !rechts) continue;
      raus.push({ x1, y1: oben.y, x2, y2: unten.y });
      break;   /* zu einer Oberkante gehört genau eine Unterkante: die nächste */
    }
  }
  return raus;
}

/** Text der Seite mit Kästen, in PDF-Punkten. Für die Namen. */
async function beschriftungen(eintrag) {
  const seite = await holeSeite(eintrag);
  const inhalt = await seite.getTextContent();
  const raus = [];
  for (const stueck of inhalt.items) {
    const text = (stueck.str || '').trim();
    if (!text) continue;
    const [, , , , x, y] = stueck.transform;
    raus.push({ text, x, y, b: stueck.width || 0, h: stueck.height || 10 });
  }
  /* Nichts im Text? Dann vielleicht ein Scan — der erkannte Text tut es auch. */
  if (!raus.length) {
    const ocr = zustand.ocr.get(eintrag.id);
    for (const wort of ocr?.woerter || []) {
      raus.push({ text: wort.text, x: wort.x, y: wort.y, b: wort.b, h: wort.h });
    }
  }
  return raus;
}

/* Der Name eines Feldes: der Text links davon auf gleicher Höhe, sonst der
   darüber. Doppelpunkt und Unterstriche fallen weg — „Name:" heißt „Name". */
function nameFuer(kasten, texte) {
  const mitte = kasten.y + kasten.h / 2;
  const links = texte
    .filter((t) => t.x + t.b <= kasten.x + 4 && Math.abs(t.y + t.h / 2 - mitte) < Math.max(10, kasten.h))
    .sort((a, b) => (kasten.x - (a.x + a.b)) - (kasten.x - (b.x + b.b)));
  const darueber = texte
    .filter((t) => t.y >= kasten.y + kasten.h - 2 && t.y < kasten.y + kasten.h + 26
      && t.x + t.b > kasten.x - 10 && t.x < kasten.x + kasten.b + 10)
    .sort((a, b) => a.y - b.y);
  const gefunden = links[0]?.text || darueber[0]?.text || '';
  return gefunden.replace(/[:_.…\s]+$/g, '').replace(/^[\s_]+/, '').slice(0, 60);
}

const UNTERSCHRIFT = /unterschrift|signatur|rechtsverbindlich|gezeichnet/i;
const DATUM = /datum|ort,?\s*datum/i;

/**
 * Sucht Feldvorschläge auf einer Seite.
 * @param {object} eintrag Eintrag aus `zustand.folge`
 * @returns {Promise<Array<{x:number,y:number,b:number,h:number,feldArt:string,name:string,
 *   grund:string,seiteId:string}>>} in PDF-Punkten der Quellseite
 */
export async function erkenneSeite(eintrag) {
  const karte = await bild(eintrag);
  const { skala, seitenHoehePt } = karte;
  const texte = await beschriftungen(eintrag);

  const waag = waagerechte(karte, Math.round(MASSE.kastenVon * skala));
  const senk = senkrechte(karte, Math.round(MASSE.kastenVon * skala));
  const kaesten = rechtecke(karte, waag, senk);

  /* Von Bildkoordinaten (oben links) auf PDF-Punkte (unten links). */
  const zuPunkt = (x, y) => ({ x: x / skala, y: seitenHoehePt - y / skala });
  const vorschlaege = [];

  for (const k of kaesten) {
    const breitePt = (k.x2 - k.x1) / skala;
    const hoehePt = (k.y2 - k.y1) / skala;
    const innen = tinte(karte, k.x1 + 2, k.y1 + 2, k.x2 - 2, k.y2 - 2);
    if (innen > MASSE.leerGrenze) continue;      /* da steht schon etwas */

    const quadratisch = Math.abs(breitePt - hoehePt) < Math.max(4, hoehePt * 0.45);
    const unten = zuPunkt(k.x1, k.y2);
    if (quadratisch && breitePt >= MASSE.kastenVon && breitePt <= MASSE.kastenBis) {
      vorschlaege.push({
        x: unten.x, y: unten.y, b: breitePt, h: hoehePt,
        feldArt: 'ankreuz', grund: 'Kästchen', seiteId: eintrag.id,
      });
    } else if (breitePt >= MASSE.rahmenBreiteVon && hoehePt >= MASSE.rahmenHoeheVon) {
      vorschlaege.push({
        x: unten.x, y: unten.y, b: breitePt, h: hoehePt,
        feldArt: hoehePt > MASSE.mehrzeiligAb ? 'mehrzeilig' : 'text',
        grund: 'Rahmen', seiteId: eintrag.id,
      });
    }
  }

  /* Ausfülllinien: waagerechte Strecken, die zu keinem Rahmen gehören. */
  const gehoertZuRahmen = (s) => kaesten.some((k) =>
    Math.abs(k.y1 - s.y) <= 4 || Math.abs(k.y2 - s.y) <= 4);

  for (const s of waag) {
    const laengePt = (s.x2 - s.x1) / skala;
    if (laengePt < MASSE.linieMindestens) continue;
    if (gehoertZuRahmen(s)) continue;
    const hoehePx = MASSE.feldHoeheUeberLinie * skala;
    /* Über der Linie muss Platz sein. Ist dort Text, ist die Linie eine
       Unterstreichung und kein Feld. */
    if (tinte(karte, s.x1, s.y - hoehePx, s.x2, s.y - 3) > MASSE.leerGrenze) continue;

    const unten = zuPunkt(s.x1, s.y);
    vorschlaege.push({
      x: unten.x, y: unten.y + 1, b: laengePt, h: MASSE.feldHoeheUeberLinie,
      feldArt: 'text', grund: 'Ausfülllinie', seiteId: eintrag.id,
    });
  }

  /* Namen anhängen, Unterschriftsfelder erkennen. */
  for (const v of vorschlaege) {
    v.name = nameFuer(v, texte);
    if (v.feldArt === 'text' && v.b >= 100 && UNTERSCHRIFT.test(v.name)) v.feldArt = 'unterschrift';
    else if (v.feldArt === 'text' && UNTERSCHRIFT.test(v.name) && !DATUM.test(v.name)) v.feldArt = 'unterschrift';
  }

  return entdopple(vorschlaege);
}

/* Zwei Vorschläge, die sich zur Hälfte überdecken, sind einer. Der größere
   gewinnt: ein Rahmen um eine Linie ist der Rahmen. */
function entdopple(liste) {
  const raus = [];
  for (const v of [...liste].sort((a, b) => b.b * b.h - a.b * a.h)) {
    const deckt = raus.some((k) => ueberdeckung(k, v) > 0.5);
    if (!deckt) raus.push(v);
  }
  return raus.sort((a, b) => b.y - a.y || a.x - b.x);
}

function ueberdeckung(a, b) {
  const breite = Math.min(a.x + a.b, b.x + b.b) - Math.max(a.x, b.x);
  const hoehe = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (breite <= 0 || hoehe <= 0) return 0;
  return (breite * hoehe) / Math.min(a.b * a.h, b.b * b.h);
}

/** Was schon da ist — vorhandene Felder und bereits angelegte Entwürfe. */
function bereitsDa(seiteId) {
  const raus = [];
  for (const f of zustand.formularfelder.filter((f) => f.seiteId === seiteId)) {
    const [x1, y1, x2, y2] = f.rechteck;
    raus.push({ x: Math.min(x1, x2), y: Math.min(y1, y2), b: Math.abs(x2 - x1), h: Math.abs(y2 - y1) });
  }
  for (const a of zustand.anmerkungen.filter((a) => a.art === 'feldneu' && a.seiteId === seiteId)) {
    raus.push({ x: a.x, y: a.y, b: a.b, h: a.h });
  }
  return raus;
}

/**
 * Sucht über mehrere Seiten und lässt weg, was es schon gibt.
 * @param {object[]} eintraege
 * @param {(stand: {seite: number, gesamt: number, gefunden: number}) => void} [beiFortschritt]
 */
export async function erkenneFelder(eintraege, beiFortschritt = null) {
  const alle = [];
  for (const [i, eintrag] of eintraege.entries()) {
    beiFortschritt?.({ seite: i + 1, gesamt: eintraege.length, gefunden: alle.length });
    let gefunden = [];
    try { gefunden = await erkenneSeite(eintrag); } catch (fehler) {
      console.warn('Felderkennung auf einer Seite gescheitert', fehler);
      continue;
    }
    const vorhanden = bereitsDa(eintrag.id);
    for (const v of gefunden) {
      if (vorhanden.some((k) => ueberdeckung(k, v) > 0.4)) continue;
      alle.push({ ...v, nummer: zustand.folge.indexOf(eintrag) + 1 });
    }
  }
  /* Namen im ganzen Dokument einmalig machen — sonst überschreiben sich zwei
     Felder namens „Datum" beim Ausfüllen gegenseitig. */
  const gezaehlt = new Map();
  for (const v of alle) {
    const grund = v.name || 'Feld';
    const zahl = (gezaehlt.get(grund) || 0) + 1;
    gezaehlt.set(grund, zahl);
    v.name = zahl === 1 ? grund : `${grund} ${zahl}`;
  }
  beiFortschritt?.({ seite: eintraege.length, gesamt: eintraege.length, gefunden: alle.length });
  return alle;
}
