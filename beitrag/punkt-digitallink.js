/* GS1 Digital Link: Adresse zerlegen und zusammensetzen.
 *
 * Reine Funktionen, keine Abhängigkeiten. Prüfen: `node punkt-digitallink.js`.
 *
 * ---------------------------------------------------------------------
 * Der Anlass
 *
 * `/api/v1/gs1` und das Feld `gtin` gibt es im laufenden Projekt, ebenso
 * `passJson`. Was fehlt, ist die Gegenrichtung: **`/01/{gtin}` antwortet
 * mit 404.**
 *
 * Das ist die eine Adresse, die auf dem Etikett steht. Ein GS1-Code auf
 * einer Verpackung enthält nichts als `https://pnkt.me/01/04006381333931`
 * — wer ihn scannt, landet heute im Nichts. Die Angaben sind da, der Weg
 * dorthin nicht.
 *
 * Diese Datei liefert die Zerlegung; die beiden Seiten daneben in
 * `seiten/` liefern den Weg.
 * ---------------------------------------------------------------------
 */

/* ==========================================================================
   Prüfziffer und Normierung
   ========================================================================== */

/** Prüfziffer nach GS1 Modulo 10, über die Stellen ohne Prüfziffer. */
export function pruefziffer(ziffern) {
  let summe = 0;
  // Von rechts nach links: abwechselnd dreifach und einfach. Die
  // Gewichtung beginnt immer rechts, deshalb wird rückwärts gezählt —
  // sonst kippt sie bei ungerader Länge.
  for (let i = ziffern.length - 1, n = 0; i >= 0; i--, n++) {
    summe += Number(ziffern[i]) * (n % 2 === 0 ? 3 : 1);
  }
  return (10 - (summe % 10)) % 10;
}

/**
 * Prüft eine GTIN und normiert sie auf 14 Stellen.
 * Erlaubt sind 8, 12, 13 und 14 Stellen — kürzere werden links mit Nullen
 * aufgefüllt, wie GS1 es für den Digital Link vorsieht.
 */
export function pruefeGTIN(roh) {
  const ziffern = String(roh ?? '').replace(/[\s-]/g, '');
  if (!/^\d+$/.test(ziffern)) {
    return { gueltig: false, grund: 'Die GTIN darf nur Ziffern enthalten.' };
  }
  if (![8, 12, 13, 14].includes(ziffern.length)) {
    return { gueltig: false, grund: `${ziffern.length} Stellen — erlaubt sind 8, 12, 13 oder 14.` };
  }
  const soll = pruefziffer(ziffern.slice(0, -1));
  if (Number(ziffern.at(-1)) !== soll) {
    return { gueltig: false, grund: `Prüfziffer ${ziffern.at(-1)}, erwartet ${soll}.` };
  }
  return { gueltig: true, gtin14: ziffern.padStart(14, '0') };
}

/* ==========================================================================
   Adresse zerlegen
   ========================================================================== */

// Die Anwendungsbezeichner, die auf einem Etikett vorkommen. Mehr braucht
// es nicht: alles Weitere gehört in den Pass, nicht in die Adresse.
const SCHLUESSEL = {
  '01': 'gtin',      // Artikelnummer
  '10': 'charge',    // Chargennummer
  '21': 'serie',     // Seriennummer
  '17': 'verfaellt', // Mindesthaltbarkeit, JJMMTT
  '11': 'hergestellt',
};

/**
 * Zerlegt einen Digital-Link-Pfad.
 *
 * `/01/04006381333931/10/A77` → { gtin14, charge: 'A77' }
 *
 * Angaben dürfen auch in der Abfrage stehen (`?17=271231`) — GS1 lässt
 * beides zu, und Etikettendrucker nutzen beides.
 *
 * @param {string[]|string} pfad   Segmente oder ganzer Pfad
 * @param {object|URLSearchParams} abfrage
 */
export function zerlegeDigitalLink(pfad, abfrage = {}) {
  const teile = (Array.isArray(pfad) ? pfad : String(pfad).split('/'))
    .map((t) => String(t).trim())
    .filter(Boolean);

  const aus = {};
  for (let i = 0; i < teile.length; i += 2) {
    const name = SCHLUESSEL[teile[i]];
    // Ein unbekannter Bezeichner wird übersprungen, nicht abgelehnt: GS1
    // erlaubt Paare, die dieser Dienst nicht kennt, und ein Code mit einem
    // Paar zu viel soll trotzdem auflösen.
    if (name && teile[i + 1] !== undefined) aus[name] = decodeURIComponent(teile[i + 1]);
  }

  const lies = (k) =>
    typeof abfrage?.get === 'function' ? abfrage.get(k) : abfrage?.[k];
  for (const [bezeichner, name] of Object.entries(SCHLUESSEL)) {
    const wert = lies(bezeichner);
    if (wert != null && wert !== '' && aus[name] === undefined) aus[name] = String(wert);
  }

  if (!aus.gtin) {
    return { gueltig: false, grund: 'Die Adresse enthält keine GTIN (Bezeichner 01).' };
  }
  const geprueft = pruefeGTIN(aus.gtin);
  if (!geprueft.gueltig) return { gueltig: false, grund: geprueft.grund };

  return { gueltig: true, ...aus, gtin14: geprueft.gtin14 };
}

/** Baut eine Digital-Link-Adresse. Die Umkehrung von `zerlegeDigitalLink`. */
export function digitalLink({ gtin, charge, serie, verfaellt }, host = 'https://pnkt.me') {
  const geprueft = pruefeGTIN(gtin);
  if (!geprueft.gueltig) throw new Error(geprueft.grund);

  let weg = `${String(host).replace(/\/+$/, '')}/01/${geprueft.gtin14}`;
  if (charge) weg += `/10/${encodeURIComponent(charge)}`;
  if (serie) weg += `/21/${encodeURIComponent(serie)}`;
  if (verfaellt) weg += `?17=${encodeURIComponent(verfaellt)}`;
  return weg;
}

/* ==========================================================================
   Den passenden Pass wählen
   ========================================================================== */

/**
 * Sucht aus einer Liste von Pässen den genauesten.
 *
 * Gefragt wird von genau nach allgemein: erst GTIN mit Charge und Serie,
 * dann nur mit Charge, dann der Pass für den ganzen Artikel. So bekommt
 * eine Rückrufcharge ihre eigenen Angaben, ohne dass jede Charge einen
 * Pass braucht.
 */
export function waehlePass(paesse, { gtin14, charge, serie }) {
  const gleich = (a, b) => String(a ?? '') === String(b ?? '');
  const kandidaten = (paesse || []).filter(
    (p) => p && !p.zurueckgezogen && pruefeGTIN(p.gtin).gtin14 === gtin14);

  for (const [c, s] of [[charge, serie], [charge, ''], ['', '']]) {
    const treffer = kandidaten.find((p) => gleich(p.charge, c) && gleich(p.serie, s));
    if (treffer) return treffer;
  }
  return null;
}

/**
 * Trennt die beschränkten Angaben ab.
 *
 * Die ESPR sieht Felder vor, die nur Marktaufsicht, Reparaturbetriebe und
 * Verwerter sehen. Die Trennung gehört hierher und nicht in die Anzeige:
 * eine Seite, die etwas ausblendet, hat es trotzdem ausgeliefert.
 */
export function oeffentlicherPass(pass) {
  if (!pass) return { pass: null, zurueckgehalten: 0 };
  const offen = (liste) => (liste || []).filter((x) => !x?.beschraenkt);
  const zurueck = ['angaben', 'belege', 'stoffe']
    .reduce((n, f) => n + (pass[f] || []).filter((x) => x?.beschraenkt).length, 0);

  return {
    pass: { ...pass, angaben: offen(pass.angaben), belege: offen(pass.belege), stoffe: offen(pass.stoffe) },
    zurueckgehalten: zurueck,
  };
}

/* ==========================================================================
   Prüfungen — `node punkt-digitallink.js`
   ========================================================================== */

if (import.meta.url === `file://${process?.argv?.[1]}`) {
  let n = 0, f = 0;
  const ok = (b, t) => { n++; if (!b) { f++; console.log('  FEHLGESCHLAGEN:', t); } };

  ok(pruefziffer('400638133393') === 1, 'Prüfziffer 13-stellig');
  ok(pruefziffer('0400638133393') === 1, 'Prüfziffer 14-stellig, führende Null');
  ok(pruefeGTIN('4006381333931').gtin14 === '04006381333931', 'auf 14 Stellen gefüllt');
  ok(pruefeGTIN('04006381333931').gtin14 === '04006381333931', '14-stellig bleibt');
  ok(pruefeGTIN('4006381333930').gueltig === false, 'falsche Prüfziffer erkannt');
  ok(pruefeGTIN('40063813339').gueltig === false, 'falsche Länge erkannt');
  ok(pruefeGTIN('400638133393a').gueltig === false, 'Buchstaben abgelehnt');
  ok(pruefeGTIN('4006381-333931').gtin14 === '04006381333931', 'Bindestrich egal');

  const a = zerlegeDigitalLink(['01', '04006381333931', '10', 'A77']);
  ok(a.gueltig && a.gtin14 === '04006381333931' && a.charge === 'A77', 'Pfad mit Charge');

  const b = zerlegeDigitalLink('/01/4006381333931/21/S-9', {});
  ok(b.gueltig && b.serie === 'S-9', 'Pfad als Zeichenkette, mit Serie');

  const c = zerlegeDigitalLink(['01', '04006381333931'], { 17: '271231' });
  ok(c.verfaellt === '271231', 'Angabe aus der Abfrage');

  const d = zerlegeDigitalLink(['01', '04006381333931'], new URLSearchParams('17=271231'));
  ok(d.verfaellt === '271231', 'URLSearchParams verstanden');

  const e = zerlegeDigitalLink(['01', '04006381333931', '99', 'unbekannt', '10', 'A77']);
  ok(e.gueltig && e.charge === 'A77', 'unbekanntes Paar wird übersprungen, nicht abgelehnt');

  ok(zerlegeDigitalLink(['10', 'A77']).gueltig === false, 'ohne GTIN abgelehnt');
  ok(zerlegeDigitalLink(['01', '4006381333930']).gueltig === false, 'falsche GTIN abgelehnt');
  ok(zerlegeDigitalLink(['01', '04006381333931', '10', 'A%2F77']).charge === 'A/77',
      'Schrägstrich in der Charge entschlüsselt');

  ok(digitalLink({ gtin: '4006381333931', charge: 'A77', verfaellt: '271231' })
      === 'https://pnkt.me/01/04006381333931/10/A77?17=271231', 'Adresse gebaut');
  ok(digitalLink({ gtin: '4006381333931' }, 'https://qr.baecker.de/')
      === 'https://qr.baecker.de/01/04006381333931', 'eigener Host, Schrägstrich weg');

  // Hin und zurück muss dasselbe ergeben.
  const rund = zerlegeDigitalLink(
    new URL(digitalLink({ gtin: '4006381333931', charge: 'L 2026/11' })).pathname);
  ok(rund.charge === 'L 2026/11', 'Charge mit Leerzeichen und Schrägstrich übersteht Hin und Zurück');

  const paesse = [
    { gtin: '4006381333931', bezeichnung: 'Artikel' },
    { gtin: '4006381333931', charge: 'L11', bezeichnung: 'Charge L11' },
    { gtin: '4006381333931', charge: 'L12', bezeichnung: 'zurückgezogen', zurueckgezogen: true },
    { gtin: '4260000000004', bezeichnung: 'anderer Artikel' },
  ];
  const g = '04006381333931';
  ok(waehlePass(paesse, { gtin14: g, charge: 'L11' }).bezeichnung === 'Charge L11', 'Charge schlägt Artikel');
  ok(waehlePass(paesse, { gtin14: g, charge: 'L99' }).bezeichnung === 'Artikel', 'fremde Charge fällt zurück');
  ok(waehlePass(paesse, { gtin14: g }).bezeichnung === 'Artikel', 'ohne Charge der Artikel');
  ok(waehlePass(paesse, { gtin14: g, charge: 'L12' }).bezeichnung === 'Artikel', 'zurückgezogener zählt nicht');
  ok(waehlePass(paesse, { gtin14: '09999999999993' }) === null, 'unbekannte GTIN ohne Pass');

  const pass = {
    angaben: [{ feld: 'Gewicht' }, { feld: 'Lieferant', beschraenkt: true }],
    belege: [{ titel: 'KE' }, { titel: 'Prüfbericht', beschraenkt: true }],
    stoffe: [{ name: 'Papier' }],
  };
  const { pass: offen, zurueckgehalten } = oeffentlicherPass(pass);
  ok(zurueckgehalten === 2, 'zurückgehaltene gezählt');
  ok(offen.angaben.length === 1 && offen.belege.length === 1, 'beschränkte heraus');
  ok(pass.angaben.length === 2, 'das Original bleibt unangetastet');
  ok(oeffentlicherPass(null).pass === null, 'kein Pass, kein Fehler');

  console.log(f ? `\n${f} von ${n} fehlgeschlagen` : `\nalle ${n} Prüfungen bestanden`);
  if (f) process.exit(1);
}
