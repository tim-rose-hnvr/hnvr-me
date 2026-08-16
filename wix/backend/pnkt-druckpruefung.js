/**
 * pnkt.me — Druckprüfung
 *
 * Reine Funktionen. Das ist der Unterschied zum Rest des Marktes: Bitly,
 * Uniqode und Flowcode liefern hübsche Codes für Bildschirme. Wer druckt,
 * braucht eine Aussage davor, nicht eine Reklamation danach.
 *
 * Die Prüfung ersetzt keine Verifikation nach ISO/IEC 15415 am gedruckten
 * Bogen — sie sagt voraus, was ein Prüfgerät später beanstanden würde, und
 * verhindert die Fehler, die im Entwurf entstehen.
 */

/** Module je Kante nach QR-Version: Version n hat 17 + 4n Module. */
export function moduleJeKante(version) {
  return 17 + 4 * Number(version);
}

/** Fehlerkorrektur in Prozent wiederherstellbarer Daten. */
const KORREKTUR = { L: 0.07, M: 0.15, Q: 0.25, H: 0.30 };

/**
 * Verfahrensgrenzen. Werte sind Erfahrungswerte aus der Druckvorstufe:
 * die kleinste Modulgröße, bei der das Verfahren noch sicher trägt.
 */
const VERFAHREN = {
  offset:      { minXmm: 0.25, name: 'Offset' },
  digital:     { minXmm: 0.25, name: 'Digitaldruck' },
  siebdruck:   { minXmm: 0.50, name: 'Siebdruck' },
  flexo:       { minXmm: 0.50, name: 'Flexodruck' },
  thermo:      { minXmm: 0.33, name: 'Thermotransfer' },
  tintenstrahl:{ minXmm: 0.40, name: 'Tintenstrahl' },
  gravur:      { minXmm: 0.60, name: 'Gravur oder Prägung' }
};

/** Relative Leuchtdichte eines sRGB-Wertes nach WCAG. */
function leuchtdichte(hex) {
  const wert = String(hex).replace('#', '');
  const voll = wert.length === 3 ? wert.split('').map((z) => z + z).join('') : wert;
  const teile = [0, 2, 4].map((i) => parseInt(voll.slice(i, i + 2), 16) / 255);
  const linear = teile.map((k) => (k <= 0.03928 ? k / 12.92 : ((k + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/**
 * Kontrastverhältnis zweier Farben, 1:1 bis 21:1.
 * Scanner brauchen deutlich mehr als Text: unter 3:1 wird es unzuverlässig,
 * unter 4:1 ist es bei ungünstigem Licht verloren.
 */
export function kontrast(vordergrund, hintergrund) {
  const a = leuchtdichte(vordergrund);
  const b = leuchtdichte(hintergrund);
  const hell = Math.max(a, b);
  const dunkel = Math.min(a, b);
  return (hell + 0.05) / (dunkel + 0.05);
}

/**
 * Vollständige Druckprüfung.
 *
 * @param {object} eingabe
 * @param {number} eingabe.breiteMm        Kantenlänge des Codes ohne Ruhezone.
 * @param {number} eingabe.version         QR-Version (1–40).
 * @param {string} eingabe.fehlerkorrektur L, M, Q oder H.
 * @param {string} eingabe.verfahren       Schlüssel aus VERFAHREN.
 * @param {number} [eingabe.ruhezone]      In Modulen.
 * @param {string} [eingabe.vordergrund]   Hexfarbe.
 * @param {string} [eingabe.hintergrund]   Hexfarbe.
 * @param {number} [eingabe.logoAnteil]    Flächenanteil des Logos, 0 bis 1.
 * @param {boolean} [eingabe.invertiert]   Hell auf dunkel.
 * @param {boolean} [eingabe.gs1]          Soll an der Kasse gelesen werden.
 * @returns {{note: string, druckreif: boolean, xDimensionMm: number, befunde: Array}}
 */
export function pruefeDruck(eingabe) {
  const befunde = [];
  const module = moduleJeKante(eingabe.version);
  const x = Number(eingabe.breiteMm) / module;

  const melde = (schwere, text, rat) => befunde.push({ schwere, text, rat });

  // --- Modulgröße gegen das Verfahren -------------------------------
  const verfahren = VERFAHREN[eingabe.verfahren] || VERFAHREN.offset;
  if (x < verfahren.minXmm) {
    const nötig = (verfahren.minXmm * module).toFixed(1);
    melde(
      'fehler',
      `Modulgröße ${x.toFixed(3)} mm ist zu klein für ${verfahren.name} (mindestens ${verfahren.minXmm} mm).`,
      `Code auf mindestens ${nötig} mm vergrößern oder weniger Inhalt kodieren.`
    );
  } else if (x < verfahren.minXmm * 1.2) {
    melde(
      'warnung',
      `Modulgröße ${x.toFixed(3)} mm liegt dicht an der Grenze für ${verfahren.name}.`,
      'Bei saugendem Papier oder Tonwertzuwachs eine Nummer größer wählen.'
    );
  }

  // --- Kassenmaße nach GS1 ------------------------------------------
  if (eingabe.gs1) {
    if (x < 0.396) {
      melde('fehler', `Für die Kasse verlangt GS1 mindestens 0,396 mm je Modul — hier ${x.toFixed(3)} mm.`,
        `Mindestbreite wären ${(0.396 * module).toFixed(1)} mm.`);
    }
    if (x > 0.990) {
      melde('warnung', `GS1 nennt 0,990 mm als Höchstmaß je Modul — hier ${x.toFixed(3)} mm.`);
    }
  }

  // --- Ruhezone ------------------------------------------------------
  const ruhezone = eingabe.ruhezone ?? 4;
  if (ruhezone < 4) {
    melde('fehler', `Ruhezone ${ruhezone} Module. Die Norm verlangt 4.`,
      'Ruhezone auf 4 Module setzen — sie ist Teil des Codes, nicht Weißraum.');
  }

  // --- Kontrast ------------------------------------------------------
  const vg = eingabe.vordergrund || '#000000';
  const hg = eingabe.hintergrund || '#ffffff';
  const verhaeltnis = kontrast(vg, hg);
  if (verhaeltnis < 3) {
    melde('fehler', `Kontrast ${verhaeltnis.toFixed(1)}:1 — unter 3:1 lesen viele Geräte nicht mehr.`,
      'Dunkler drucken oder den Hintergrund aufhellen.');
  } else if (verhaeltnis < 4.5) {
    melde('warnung', `Kontrast ${verhaeltnis.toFixed(1)}:1 trägt bei gutem Licht, bei schlechtem nicht.`);
  }

  if (leuchtdichte(vg) > leuchtdichte(hg)) {
    melde('fehler', 'Der Code ist heller als sein Hintergrund.',
      'Invertierte Codes lesen ältere Geräte und Kassenscanner nicht. Dunkel auf hell drucken.');
  }

  // --- Logo gegen Fehlerkorrektur ------------------------------------
  const stufe = KORREKTUR[eingabe.fehlerkorrektur] ?? KORREKTUR.M;
  const logo = Number(eingabe.logoAnteil || 0);
  if (logo > 0) {
    // Faustregel der Vorstufe: höchstens die halbe Reserve verbrauchen,
    // die andere Hälfte gehört dem Druck, dem Papier und dem Knick.
    const zulaessig = stufe / 2;
    if (logo > stufe) {
      melde('fehler',
        `Das Logo verdeckt ${(logo * 100).toFixed(0)} % der Fläche, die Fehlerkorrektur ${eingabe.fehlerkorrektur} trägt ${(stufe * 100).toFixed(0)} %.`,
        'Logo verkleinern oder Fehlerkorrektur auf H setzen.');
    } else if (logo > zulaessig) {
      melde('warnung',
        `Das Logo verbraucht ${(logo * 100).toFixed(0)} % von ${(stufe * 100).toFixed(0)} % Reserve — für den Druck bleibt zu wenig.`,
        'Unter der Hälfte der Reserve bleiben.');
    }
  }

  if (eingabe.fehlerkorrektur === 'L' && !eingabe.gs1) {
    melde('warnung', 'Fehlerkorrektur L ist für Druck knapp bemessen.',
      'Für Papier ist M die untere Grenze, für Verpackung Q.');
  }

  // --- Note ----------------------------------------------------------
  const fehler = befunde.filter((b) => b.schwere === 'fehler').length;
  const warnungen = befunde.filter((b) => b.schwere === 'warnung').length;
  let note = 'A';
  if (fehler > 0) { note = fehler > 1 ? 'F' : 'D'; }
  else if (warnungen > 1) { note = 'C'; }
  else if (warnungen === 1) { note = 'B'; }

  return {
    note,
    druckreif: fehler === 0,
    xDimensionMm: Number(x.toFixed(4)),
    moduleJeKante: module,
    kontrast: Number(verhaeltnis.toFixed(2)),
    befunde
  };
}

/**
 * Kleinste Breite, bei der ein Code im gewählten Verfahren noch trägt.
 * Für die Frage im Studio: „Wie klein darf ich das drucken?"
 */
export function kleinsteBreiteMm(version, verfahren, gs1 = false) {
  const module = moduleJeKante(version);
  const grenze = Math.max(
    (VERFAHREN[verfahren] || VERFAHREN.offset).minXmm,
    gs1 ? 0.396 : 0
  );
  return Number((grenze * module).toFixed(1));
}
