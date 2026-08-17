/**
 * Erweiterungen für das PUNKT-Studio
 * ==================================
 *
 * Drei Stücke, die dem ausgelieferten Stand belegbar fehlen. Reine
 * Funktionen ohne Abhängigkeiten, in derselben Sprache geschrieben wie
 * der Rest: deutsche Bezeichner, englische Fachbegriffe, wo sie
 * etabliert sind.
 *
 * Einbauen:
 *   1. Diese Datei nach src/lib/ legen.
 *   2. In studio.astro importieren, was gebraucht wird.
 *   3. Die drei Andockstellen unten beachten.
 *
 * Geprüft mit Node gegen die Norm; die Prüfungen stehen am Ende der
 * Datei und laufen mit `node punkt-erweiterungen.js`.
 */

/* ==========================================================================
   1 · Sonderfarben
   --------------------------------------------------------------------------
   Der ausgelieferte Stand schreibt DeviceCMYK. Für eine Hausfarbe im
   Offsetdruck reicht das nicht: Sie braucht einen eigenen Auszug, sonst
   wird sie aus vier Prozessfarben zusammengemischt und trifft nie genau.

   Andockstelle: dort, wo heute die Füllfarbe gesetzt wird — in der
   PDF-Ausgabe vor `f`/`f*`, in der EPS-Ausgabe vor `fill`/`eofill`.
   ========================================================================== */

/**
 * Liest eine Farbangabe. Drei Schreibweisen:
 *   "#0d0d12"                      Bildschirmfarbe
 *   "cmyk(0, 0.92, 0.86, 0.12)"    vier Kanäle
 *   "sonder(HKS 13 K, 0,1,1,0)"    Vollton mit Ersatzrezept
 */
export function liesFarbe(angabe) {
  const s = String(angabe || '').trim();
  const zahl = (x) => {
    let f = parseFloat(String(x).trim());
    if (!isFinite(f)) f = 0;
    if (f > 1) f /= 100;               // Prozentangaben sind verbreitet
    return Math.max(0, Math.min(1, f));
  };

  if (s.startsWith('sonder(') && s.endsWith(')')) {
    const teile = s.slice(7, -1).split(',');
    if (teile.length !== 5) return liesFarbe('#000000');
    const cmyk = teile.slice(1).map(zahl);
    return { art: 'sonder', name: teile[0].trim(), cmyk, ...cmykZuRGB(cmyk) };
  }
  if (s.startsWith('cmyk(') && s.endsWith(')')) {
    const teile = s.slice(5, -1).split(',');
    if (teile.length !== 4) return liesFarbe('#000000');
    const cmyk = teile.map(zahl);
    return { art: 'cmyk', cmyk, ...cmykZuRGB(cmyk) };
  }

  let h = s.replace('#', '');
  if (h.length === 3) h = [...h].map((z) => z + z).join('');
  if (h.length !== 6) return { art: 'rgb', r: 0, g: 0, b: 0, cmyk: [0, 0, 0, 1] };
  const t = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return { art: 'rgb', r: t[0], g: t[1], b: t[2], cmyk: rgbZuCMYK(t[0], t[1], t[2]) };
}

function cmykZuRGB([c, m, y, k]) {
  return { r: (1 - c) * (1 - k), g: (1 - m) * (1 - k), b: (1 - y) * (1 - k) };
}

function rgbZuCMYK(r, g, b) {
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 1];
  return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k];
}

/** Name ohne Leer- und Sonderzeichen, wie PDF und EPS ihn verlangen. */
export function farbKennung(name) {
  const k = [...String(name)].map((z) =>
    /[a-zA-Z0-9]/.test(z) ? z : '#' + z.codePointAt(0).toString(16).toUpperCase().padStart(2, '0')
  ).join('');
  return k || 'Sonderfarbe';
}

/** Füllfarbe in PDF: drei, vier oder ein Kanal. */
export function pdfFuellfarbe(angabe) {
  const f = liesFarbe(angabe);
  const n = (x) => x.toFixed(4);
  if (f.art === 'cmyk')   return `${n(f.cmyk[0])} ${n(f.cmyk[1])} ${n(f.cmyk[2])} ${n(f.cmyk[3])} k\n`;
  // Bei einer Volltonfarbe ist der Wert die Deckung, nicht die Farbe.
  if (f.art === 'sonder') return `/${farbKennung(f.name)} cs 1 scn\n`;
  return `${n(f.r)} ${n(f.g)} ${n(f.b)} rg\n`;
}

/** Füllfarbe in PostScript. */
export function psFuellfarbe(angabe) {
  const f = liesFarbe(angabe);
  const n = (x) => x.toFixed(4);
  if (f.art === 'cmyk')
    return `${n(f.cmyk[0])} ${n(f.cmyk[1])} ${n(f.cmyk[2])} ${n(f.cmyk[3])} setcmykcolor\n`;
  if (f.art === 'sonder')
    return `[/Separation (${f.name}) /DeviceCMYK { dup ${n(f.cmyk[0])} mul exch dup ` +
           `${n(f.cmyk[1])} mul exch dup ${n(f.cmyk[2])} mul exch ${n(f.cmyk[3])} mul }] ` +
           `setcolorspace 1 setcolor\n`;
  return `${n(f.r)} ${n(f.g)} ${n(f.b)} setrgbcolor\n`;
}

/**
 * Der Farbraum-Eintrag für die PDF-Ressourcen. Ohne das Ersatzrezept
 * weiß ein Betrachter ohne diese Farbe nicht, was er anzeigen soll.
 * Gehört in /Resources der Seite: `/ColorSpace << … >>`
 */
export function pdfSonderraum(angabe) {
  const f = liesFarbe(angabe);
  if (f.art !== 'sonder') return '';
  const k = farbKennung(f.name);
  const n = (x) => x.toFixed(4);
  return `/${k} [/Separation /${k} /DeviceCMYK ` +
    `<< /FunctionType 2 /Domain [0 1] /C0 [0 0 0 0] ` +
    `/C1 [${n(f.cmyk[0])} ${n(f.cmyk[1])} ${n(f.cmyk[2])} ${n(f.cmyk[3])}] /N 1 >>]`;
}

/**
 * Die DSC-Zeile für den EPS-Kopf. Die Vorstufe liest sie, um die
 * Auszüge zu benennen. Gehört vor %%EndComments.
 */
export function epsSonderfarbenZeile(angaben) {
  const namen = [];
  for (const a of angaben) {
    const f = liesFarbe(a);
    if (f.art === 'sonder' && !namen.includes(f.name)) namen.push(f.name);
  }
  return namen.length ? `%%DocumentCustomColors: ${namen.map((n) => `(${n})`).join(' ')}\n` : '';
}

/* ==========================================================================
   2 · GS1 Digital Link
   --------------------------------------------------------------------------
   Fehlt im ausgelieferten Stand vollständig. Ab GS1 Sunrise 2027 sollen
   Kassen zweidimensionale Codes mit GS1-Daten lesen; ohne korrekt
   kodierte GTIN ist ein QR-Code für die Kasse kein Artikel, sondern nur
   ein Link.

   Andockstelle: als weiterer Inhaltstyp neben url, vcard, wlan, girocode.
   ========================================================================== */

/** Prüfziffer nach GS1, Modulo 10. Gilt für GTIN-8, -12, -13 und -14. */
export function pruefziffer(ziffern) {
  let summe = 0;
  const umgekehrt = [...String(ziffern)].reverse();
  for (let i = 0; i < umgekehrt.length; i++) {
    summe += Number(umgekehrt[i]) * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (summe % 10)) % 10;
}

/** Prüft Länge, Ziffern und Prüfziffer; liefert die GTIN-14. */
export function pruefeGTIN(gtin) {
  const roh = String(gtin || '').replace(/[\s-]/g, '');
  if (!roh) return { gueltig: false, grund: 'keine GTIN angegeben' };
  if (!/^\d+$/.test(roh)) return { gueltig: false, grund: 'die GTIN enthält Zeichen, die keine Ziffern sind' };
  if (![8, 12, 13, 14].includes(roh.length)) {
    return { gueltig: false, grund: `eine GTIN hat 8, 12, 13 oder 14 Stellen — diese hat ${roh.length}` };
  }
  const soll = pruefziffer(roh.slice(0, -1));
  const ist = Number(roh.slice(-1));
  if (soll !== ist) {
    return { gueltig: false, grund: `die Prüfziffer stimmt nicht: erwartet ${soll}, angegeben ${ist}` };
  }
  return { gueltig: true, gtin14: roh.padStart(14, '0') };
}

/**
 * Baut die Digital-Link-URL. Die Reihenfolge der Bezeichner im Pfad ist
 * vorgeschrieben: erst 01, dann 10, dann 21.
 */
export function digitalLink({ gtin, charge, serie, verfaellt }, host = 'https://pnkt.me') {
  const g = pruefeGTIN(gtin);
  if (!g.gueltig) throw new Error(`GTIN nicht verwendbar: ${g.grund}`);
  let url = host.replace(/\/+$/, '') + '/01/' + g.gtin14;
  if (charge) url += '/10/' + encodeURIComponent(charge);
  if (serie) url += '/21/' + encodeURIComponent(serie);
  if (verfaellt) url += '?17=' + encodeURIComponent(verfaellt);
  return url;
}

/** Grenzen der Modulgröße für den Handel, in Millimetern. */
export const GS1_MIN_MODUL_MM = 0.396;
export const GS1_MAX_MODUL_MM = 0.990;

/**
 * Kassentauglichkeit. Gehört vor jede Druckfreigabe eines GS1-Codes —
 * was an der Kasse gelesen werden soll, ist nicht frei gestaltbar.
 */
export function pruefeKassentauglichkeit({ gtin, modulMm, ruhezone, verlauf, logo }) {
  const befunde = [];
  const g = pruefeGTIN(gtin);
  if (!g.gueltig) befunde.push({ schwere: 'fehler', text: `GTIN: ${g.grund}` });

  if (typeof modulMm === 'number') {
    if (modulMm < GS1_MIN_MODUL_MM) {
      befunde.push({ schwere: 'fehler',
        text: `Modulgröße ${modulMm.toFixed(3)} mm liegt unter dem GS1-Mindestmaß ${GS1_MIN_MODUL_MM} mm für den Handel.` });
    } else if (modulMm > GS1_MAX_MODUL_MM) {
      befunde.push({ schwere: 'warnung',
        text: `Modulgröße ${modulMm.toFixed(3)} mm liegt über dem GS1-Höchstmaß ${GS1_MAX_MODUL_MM} mm.` });
    }
  }
  if ((ruhezone ?? 0) < 4) {
    befunde.push({ schwere: 'fehler',
      text: `Ruhezone ${ruhezone ?? 0} Module — GS1 verlangt mindestens 4 auf allen Seiten.` });
  }
  if (verlauf) {
    befunde.push({ schwere: 'fehler',
      text: 'Farbverlauf im Code. Für die Kasse muss dunkel auf hell einfarbig sein.' });
  }
  if (logo) {
    befunde.push({ schwere: 'warnung',
      text: 'Logo im Code. An der Kasse ist jede Verdeckung ein Risiko, unabhängig von der Fehlerkorrektur.' });
  }
  return { tauglich: !befunde.some((b) => b.schwere === 'fehler'), befunde };
}

/* ==========================================================================
   3 · Die gemessenen Augenformen
   --------------------------------------------------------------------------
   Das Studio bietet runde und blattförmige Positionsmarken an, ohne zu
   sagen, was sie kosten. Gemessen an 160 Kombinationen aus Modul-,
   Rahmen- und Kernform, gegengelesen mit OpenCV:
   ========================================================================== */

export const AUGEN_MESSUNG = {
  quadrat: { gelesen: 40, von: 40 },
  kissen:  { gelesen: 40, von: 40 },
  blatt:   { gelesen: 0,  von: 40 },
  rund:    { gelesen: 0,  von: 40 },
};

/**
 * Hinweis zur gewählten Augenform. Verboten wird nichts — Telefonkameras
 * sind nachsichtiger als ein Prüfdecoder, und die Entscheidung gehört
 * dem Gestalter. Aber die Zahl gehört daneben.
 */
export function augenHinweis(augenrahmen) {
  const m = AUGEN_MESSUNG[augenrahmen];
  if (!m || m.gelesen === m.von) return null;
  return {
    schwere: 'warnung',
    text: `Der Augenrahmen „${augenrahmen}" wurde in unserer Messung von einem ` +
          `verbreiteten Decoder in ${m.gelesen} von ${m.von} Fällen gelesen.`,
    rat: 'Quadratische oder nur leicht gerundete Positionsmarken (Kissen) wählen — ' +
         'die lasen sich in derselben Messung durchgehend. Der Scanner sucht in den ' +
         'Ecken das Verhältnis 1:1:3:1:1.',
  };
}

/* ==========================================================================
   Prüfungen — `node punkt-erweiterungen.js`
   ========================================================================== */

if (import.meta.url === `file://${process?.argv?.[1]}`) {
  let n = 0, f = 0;
  const ok = (b, t) => { n++; if (!b) { f++; console.log('  FEHLGESCHLAGEN:', t); } };

  ok(liesFarbe('#a82e23').art === 'rgb', 'Hexfarbe erkannt');
  ok(liesFarbe('cmyk(0,100,100,0)').cmyk[1] === 1, 'Prozentangabe umgerechnet');
  ok(liesFarbe('sonder(HKS 13 K, 0,1,1,0)').name === 'HKS 13 K', 'Sonderfarbe erkannt');
  ok(farbKennung('HKS 13 K') === 'HKS#2013#20K', 'Kennung ohne Leerzeichen');
  ok(pdfFuellfarbe('cmyk(0,1,1,0)').endsWith('k\n'), 'PDF setzt CMYK');
  ok(pdfFuellfarbe('sonder(X,0,1,1,0)').includes('cs 1 scn'), 'PDF setzt Vollton');
  ok(psFuellfarbe('sonder(X,0,1,1,0)').includes('/Separation'), 'EPS setzt Vollton');
  ok(pdfSonderraum('sonder(X,0,1,1,0)').includes('/Separation /X /DeviceCMYK'), 'Farbraum mit Ersatzrezept');
  ok(epsSonderfarbenZeile(['#000', 'sonder(HKS 13 K,0,1,1,0)', 'sonder(HKS 13 K,0,1,1,0)'])
      === '%%DocumentCustomColors: (HKS 13 K)\n', 'DSC-Zeile ohne Dubletten');

  ok(pruefziffer('400638133393') === 1, 'Prüfziffer');
  ok(pruefeGTIN('4006381333931').gtin14 === '04006381333931', 'GTIN auf 14 Stellen');
  ok(!pruefeGTIN('4006381333930').gueltig, 'falsche Prüfziffer erkannt');
  ok(!pruefeGTIN('40063813339').gueltig, 'falsche Länge erkannt');
  ok(digitalLink({ gtin: '4006381333931', charge: 'A77', verfaellt: '271231' })
      === 'https://pnkt.me/01/04006381333931/10/A77?17=271231', 'Digital-Link-URL');
  ok(pruefeKassentauglichkeit({ gtin: '4006381333931', modulMm: 0.5, ruhezone: 4 }).tauglich,
      'kassentauglich');
  ok(!pruefeKassentauglichkeit({ gtin: '4006381333931', modulMm: 0.2, ruhezone: 4 }).tauglich,
      'zu kleine Module fallen durch');
  ok(!pruefeKassentauglichkeit({ gtin: '4006381333931', modulMm: 0.5, ruhezone: 1 }).tauglich,
      'zu kleine Ruhezone fällt durch');

  ok(augenHinweis('quadrat') === null, 'quadratisches Auge ohne Hinweis');
  ok(augenHinweis('rund').text.includes('0 von 40'), 'rundes Auge mit Messung');

  console.log(f ? `\n${f} von ${n} fehlgeschlagen` : `\nalle ${n} Prüfungen bestanden`);
  if (f) process.exit(1);
}
