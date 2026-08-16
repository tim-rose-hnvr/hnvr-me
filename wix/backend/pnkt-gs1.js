/**
 * pnkt.me — GS1 Digital Link
 *
 * Reine Funktionen, keine Abhängigkeit auf wix-data. Damit sind sie im
 * Studio (Browser) und im Backend gleich verwendbar.
 *
 * Grundlage: GS1 Digital Link. Der QR-Code trägt eine URL der Form
 *   https://<host>/01/<GTIN-14>[/10/<Charge>][/21/<Serie>][?17=JJMMTT]
 * Ab Sunrise 2027 sollen Kassen 2D-Codes mit GS1-Daten lesen können; ein
 * Code ohne korrekt kodierte GTIN wird an der Kasse nicht als Artikel
 * erkannt, sondern bestenfalls als Link geöffnet.
 */

/** Anwendungsbezeichner, die pnkt.me im Pfad führt (Reihenfolge ist festgelegt). */
const PFAD_AI = [
  { ai: '01', schluessel: 'gtin', laenge: 14 },
  { ai: '10', schluessel: 'charge', maxLaenge: 20 },
  { ai: '21', schluessel: 'serie', maxLaenge: 20 }
];

/** Anwendungsbezeichner, die als Abfrageteil angehängt werden. */
const ABFRAGE_AI = [
  { ai: '17', schluessel: 'verfaellt' },   // JJMMTT
  { ai: '11', schluessel: 'hergestellt' }, // JJMMTT
  { ai: '3103', schluessel: 'nettogewichtKg' }
];

/**
 * Prüfziffer nach GS1 (Modulo 10). Gilt für GTIN-8, -12, -13 und -14.
 * @param {string} ziffern Alle Stellen ohne Prüfziffer.
 * @returns {number} Die Prüfziffer.
 */
export function pruefziffer(ziffern) {
  if (!/^\d+$/.test(ziffern)) {
    throw new Error('Nur Ziffern erlaubt');
  }
  let summe = 0;
  // Von rechts nach links: die erste Stelle wird dreifach gewichtet.
  const umgekehrt = ziffern.split('').reverse();
  for (let i = 0; i < umgekehrt.length; i += 1) {
    summe += Number(umgekehrt[i]) * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (summe % 10)) % 10;
}

/**
 * Prüft eine GTIN vollständig: Länge, Ziffern, Prüfziffer.
 * @param {string} gtin
 * @returns {{gueltig: boolean, grund?: string, normiert?: string}}
 */
export function pruefeGtin(gtin) {
  const roh = String(gtin || '').replace(/[\s-]/g, '');
  if (!/^\d+$/.test(roh)) {
    return { gueltig: false, grund: 'Die GTIN enthält Zeichen, die keine Ziffern sind.' };
  }
  if (![8, 12, 13, 14].includes(roh.length)) {
    return {
      gueltig: false,
      grund: `Eine GTIN hat 8, 12, 13 oder 14 Stellen — diese hat ${roh.length}.`
    };
  }
  const soll = pruefziffer(roh.slice(0, -1));
  const ist = Number(roh.slice(-1));
  if (soll !== ist) {
    return {
      gueltig: false,
      grund: `Die Prüfziffer stimmt nicht. Erwartet ${soll}, angegeben ${ist}.`
    };
  }
  return { gueltig: true, normiert: roh.padStart(14, '0') };
}

/**
 * Baut die Digital-Link-URL.
 *
 * @param {object} angaben
 * @param {string} angaben.gtin
 * @param {string} [angaben.charge]      AI 10
 * @param {string} [angaben.serie]       AI 21
 * @param {string} [angaben.verfaellt]   AI 17, Form JJMMTT
 * @param {string} [host] Standard ist der eigene Kurzhost.
 * @returns {{url: string, gtin14: string}}
 */
export function digitalLink(angaben, host = 'https://pnkt.me') {
  const geprueft = pruefeGtin(angaben.gtin);
  if (!geprueft.gueltig) {
    throw new Error(`GTIN nicht verwendbar: ${geprueft.grund}`);
  }

  const werte = { ...angaben, gtin: geprueft.normiert };
  let pfad = '';
  for (const teil of PFAD_AI) {
    const wert = werte[teil.schluessel];
    if (wert === undefined || wert === null || wert === '') { continue; }
    pfad += `/${teil.ai}/${encodeURIComponent(String(wert))}`;
  }

  const abfrage = [];
  for (const teil of ABFRAGE_AI) {
    const wert = werte[teil.schluessel];
    if (wert === undefined || wert === null || wert === '') { continue; }
    abfrage.push(`${teil.ai}=${encodeURIComponent(String(wert))}`);
  }

  const basis = String(host).replace(/\/+$/, '');
  return {
    url: basis + pfad + (abfrage.length ? `?${abfrage.join('&')}` : ''),
    gtin14: geprueft.normiert
  };
}

/**
 * Liest eine Digital-Link-URL zurück in ihre Bestandteile.
 * Verträgt beide Schreibweisen: Pfad-AIs und Abfrage-AIs.
 * @param {string} url
 * @returns {{gtin?: string, charge?: string, serie?: string, weitere: object}}
 */
export function leseDigitalLink(url) {
  const ergebnis = { weitere: {} };
  let pfadteil = String(url);
  let abfrageteil = '';

  const fragezeichen = pfadteil.indexOf('?');
  if (fragezeichen >= 0) {
    abfrageteil = pfadteil.slice(fragezeichen + 1);
    pfadteil = pfadteil.slice(0, fragezeichen);
  }

  const stuecke = pfadteil.replace(/^https?:\/\/[^/]+/, '').split('/').filter(Boolean);
  for (let i = 0; i + 1 < stuecke.length; i += 2) {
    const ai = stuecke[i];
    const wert = decodeURIComponent(stuecke[i + 1]);
    const bekannt = PFAD_AI.find((t) => t.ai === ai);
    if (bekannt) { ergebnis[bekannt.schluessel] = wert; }
    else { ergebnis.weitere[ai] = wert; }
  }

  for (const paar of abfrageteil.split('&').filter(Boolean)) {
    const [ai, wert] = paar.split('=');
    const bekannt = ABFRAGE_AI.find((t) => t.ai === ai);
    if (bekannt) { ergebnis[bekannt.schluessel] = decodeURIComponent(wert || ''); }
    else { ergebnis.weitere[ai] = decodeURIComponent(wert || ''); }
  }

  return ergebnis;
}

/**
 * Kassentauglichkeit: Was an der Kasse gelesen werden soll, darf nicht
 * beliebig gestaltet sein. Diese Prüfung gehört vor jede Druckfreigabe
 * eines GS1-Codes.
 *
 * @param {object} code  Der Code, wie er in PK_Codes liegt (gs1Json/druckJson bereits geparst).
 * @returns {{tauglich: boolean, befunde: Array<{schwere: string, text: string}>}}
 */
export function pruefeKassentauglichkeit(code) {
  const befunde = [];
  const stil = code.stil || {};
  const druck = code.druck || {};

  const gtin = pruefeGtin(code.gtin || '');
  if (!gtin.gueltig) {
    befunde.push({ schwere: 'fehler', text: `GTIN: ${gtin.grund}` });
  }

  if (druck.xDimensionMm !== undefined) {
    const x = Number(druck.xDimensionMm);
    if (x < 0.396) {
      befunde.push({
        schwere: 'fehler',
        text: `Modulgröße ${x.toFixed(3)} mm liegt unter dem GS1-Mindestmaß 0,396 mm für den Handel.`
      });
    } else if (x > 0.990) {
      befunde.push({
        schwere: 'warnung',
        text: `Modulgröße ${x.toFixed(3)} mm liegt über dem GS1-Höchstmaß 0,990 mm.`
      });
    }
  } else {
    befunde.push({ schwere: 'warnung', text: 'Ohne Modulgröße ist keine Aussage zur Kasse möglich.' });
  }

  if ((stil.ruhezone ?? 0) < 4) {
    befunde.push({
      schwere: 'fehler',
      text: `Ruhezone ${stil.ruhezone ?? 0} Module — GS1 verlangt mindestens 4 Module auf allen Seiten.`
    });
  }

  if (stil.vordergrund && stil.vordergrund.art === 'verlauf') {
    befunde.push({
      schwere: 'fehler',
      text: 'Farbverlauf im Code. Für die Kasse muss dunkel auf hell einfarbig sein.'
    });
  }

  if (stil.logo) {
    befunde.push({
      schwere: 'warnung',
      text: 'Logo im Code. An der Kasse ist jede Verdeckung ein Risiko, unabhängig von der Fehlerkorrektur.'
    });
  }

  const harteFehler = befunde.filter((b) => b.schwere === 'fehler');
  return { tauglich: harteFehler.length === 0, befunde };
}
