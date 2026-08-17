/* Beitrag für die PUNKT-Zentrale: Ordner, Suche und ein Löschen, das
 * das Kürzel nicht freigibt.
 *
 * Reine Funktionen, keine Abhängigkeiten, deutsche Bezeichner wie im
 * übrigen Code. Prüfen: `node punkt-zentrale.js`.
 *
 * ---------------------------------------------------------------------
 * Der Anlass
 *
 * Im Ereignisprotokoll des laufenden Projekts steht am 10. August ein
 * `code.geloescht` für das Kürzel `maepux`. In `PK_Codes` gibt es dazu
 * keine Zeile mehr. Der eindeutige Index `kuerzel-eindeutig` wirkt nur
 * auf vorhandene Zeilen — `maepux` ist damit wieder frei und kann ein
 * zweites Mal vergeben werden.
 *
 * Das ist der eine Fehler, den ein Kurzadressdienst nicht machen darf.
 * Das Kürzel steht auf Papier, und Papier lässt sich nicht löschen. Wird
 * es neu vergeben, zeigt ein gedrucktes Plakat eines Tages auf das Ziel
 * eines Fremden — und niemand kann es zurückholen.
 *
 * `loeschePlan` unten macht aus dem Löschen ein Stilllegen: die Zeile
 * bleibt, das Ziel geht weg, das Kürzel bleibt belegt. Ein Scan bekommt
 * danach eine lesbare Seite statt „unbekannt".
 * ---------------------------------------------------------------------
 */

/* ==========================================================================
   Suche
   ========================================================================== */

/** Felder, über die gesucht wird. Das Ziel gehört dazu: man erinnert
 *  sich an die Kampagnenseite, nicht an das Kürzel. */
const SUCHFELDER = ['name', 'kuerzel', 'ziel', 'gtin', 'ordner'];

/**
 * Filtert eine Codeliste.
 * @param {Array<object>} codes
 * @param {{text?: string, ordner?: string, mitGeloeschten?: boolean}} filter
 *        ordner: genau dieser Ordner; '-' heißt: ohne Ordner; leer: alle.
 */
export function sucheCodes(codes, filter = {}) {
  const text = (filter.text || '').trim().toLowerCase();
  const ordner = (filter.ordner || '').trim();

  return (codes || []).filter((c) => {
    if (c.geloescht && !filter.mitGeloeschten) return false;

    if (ordner === '-') {
      if (ordnerNameVon(c)) return false;
    } else if (ordner !== '') {
      if ((ordnerNameVon(c) || '').toLowerCase() !== ordner.toLowerCase()) return false;
    }

    if (!text) return true;
    return SUCHFELDER.some((feld) =>
      String(c[feld] ?? '').toLowerCase().includes(text));
  });
}

/** Der Ordnername eines Codes. In PK_Codes steht `ordnerId`; wer die
 *  Ordner schon aufgelöst hat, hat `ordner`. Beides geht. */
export function ordnerNameVon(code, ordnerNachId = null) {
  if (code.ordner) return code.ordner;
  if (code.ordnerId && ordnerNachId) return ordnerNachId[code.ordnerId] || '';
  return '';
}

/**
 * Zählt die Ordner. Codes ohne Ordner stehen unter dem leeren Namen —
 * sie sind kein Fehler, sondern der Normalfall am Anfang.
 * @returns {Array<{name: string, anzahl: number}>} „ohne Ordner" zuerst,
 *          danach alphabetisch.
 */
export function ordnerStand(codes, ordnerNachId = null) {
  const zaehler = new Map();
  for (const c of codes || []) {
    if (c.geloescht) continue;
    const name = ordnerNameVon(c, ordnerNachId);
    zaehler.set(name, (zaehler.get(name) || 0) + 1);
  }
  return [...zaehler.entries()]
    .map(([name, anzahl]) => ({ name, anzahl }))
    .sort((a, b) => {
      if ((a.name === '') !== (b.name === '')) return a.name === '' ? -1 : 1;
      return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
    });
}

/* ==========================================================================
   Löschen, das nichts freigibt
   ========================================================================== */

/**
 * Was beim Löschen wirklich geschehen soll.
 *
 * Kein `remove()` auf PK_Codes. Stattdessen ein `update()` mit diesen
 * Feldern: der Datensatz bleibt, das Ziel geht weg, das Kürzel bleibt
 * durch den bestehenden Index `kuerzel-eindeutig` belegt.
 *
 * @param {object} code
 * @returns {{aenderung: object, ereignis: object}}
 */
export function loeschePlan(code) {
  if (!code || !code.kuerzel) throw new Error('Code ohne Kürzel');
  return {
    aenderung: {
      ...code,
      geloescht: true,
      aktiv: false,
      ziel: '',
      regelnJson: null,
      geaendert: new Date().toISOString(),
    },
    ereignis: {
      was: 'code.geloescht',
      gegenstand: code._id,
      altJson: JSON.stringify({ name: code.name, kuerzel: code.kuerzel, ziel: code.ziel }),
    },
  };
}

/**
 * Prüft, ob ein Kürzel vergeben werden darf. Gelöschte zählen mit — das
 * ist der ganze Punkt.
 *
 * Wichtig: Diese Prüfung ersetzt nicht den eindeutigen Index. Zwei
 * gleichzeitige Anfragen bestehen sie beide und legen trotzdem doppelt
 * an. Der Index ist der Schutz, das hier ist die freundliche Antwort
 * davor.
 */
export function kuerzelFrei(kuerzel, codes) {
  const gesucht = String(kuerzel || '').trim().toLowerCase();
  if (!gesucht) return false;
  return !(codes || []).some((c) => String(c.kuerzel || '').toLowerCase() === gesucht);
}

/**
 * Findet die Kürzel, die im Protokoll als gelöscht stehen und in den
 * Codes fehlen. Genau die sind wieder frei, obwohl sie auf Papier
 * stehen — sie gehören als stillgelegte Zeilen zurück in PK_Codes.
 *
 * @param {Array<object>} codes      aus PK_Codes
 * @param {Array<object>} ereignisse aus PK_Ereignisse
 */
export function verwaisteKuerzel(codes, ereignisse) {
  const lebendig = new Set((codes || [])
    .map((c) => String(c.kuerzel || '').toLowerCase()).filter(Boolean));

  const aus = new Set();
  for (const e of ereignisse || []) {
    if (e.was !== 'code.geloescht' || !e.altJson) continue;
    let alt;
    try { alt = JSON.parse(e.altJson); } catch { continue; }
    const k = String(alt?.kuerzel || '').toLowerCase();
    if (k && !lebendig.has(k)) aus.add(alt.kuerzel);
  }
  return [...aus].sort();
}

/**
 * Die Zeile, mit der ein verwaistes Kürzel wieder gesperrt wird.
 * Taucht in keiner Liste auf, belegt aber den Index.
 */
export function sperrzeile(kuerzel, kontoId) {
  return {
    kuerzel,
    kontoId,
    name: 'Gelöscht vor der Sperre',
    ziel: '',
    aktiv: false,
    geloescht: true,
    erstellt: new Date().toISOString(),
    geaendert: new Date().toISOString(),
  };
}

/* ==========================================================================
   Prüfungen — `node punkt-zentrale.js`
   ========================================================================== */

if (import.meta.url === `file://${process?.argv?.[1]}`) {
  let n = 0, f = 0;
  const ok = (b, t) => { n++; if (!b) { f++; console.log('  FEHLGESCHLAGEN:', t); } };

  const codes = [
    { _id: 'a', kuerzel: 'plak01', name: 'Plakat Bahnhof', ordner: 'Frühjahr 2026', ziel: 'https://example.de/aktion' },
    { _id: 'b', kuerzel: 'plak02', name: 'Plakat Markt', ordner: 'Frühjahr 2026', ziel: 'https://example.de/markt' },
    { _id: 'c', kuerzel: 'etik01', name: 'Etikett', ordner: 'Produkte', gtin: '4006381333931', ziel: 'https://example.de/kaffee' },
    { _id: 'd', kuerzel: 'lose01', name: 'Aufkleber', ziel: 'https://example.de/lose' },
    { _id: 'e', kuerzel: 'weg001', name: 'Alt', geloescht: true, ziel: '' },
  ];

  ok(sucheCodes(codes).length === 4, 'Gelöschte bleiben draußen');
  ok(sucheCodes(codes, { mitGeloeschten: true }).length === 5, 'auf Wunsch mit Gelöschten');
  ok(sucheCodes(codes, { ordner: 'Frühjahr 2026' }).length === 2, 'Ordnerfilter');
  ok(sucheCodes(codes, { ordner: '-' }).length === 1, 'ohne Ordner');
  ok(sucheCodes(codes, { text: 'PLAKAT' }).length === 2, 'Suche unabhängig von der Schreibweise');
  ok(sucheCodes(codes, { text: 'kaffee' })[0].kuerzel === 'etik01', 'Suche im Ziel');
  ok(sucheCodes(codes, { text: '4006381333931' })[0].kuerzel === 'etik01', 'Suche in der GTIN');
  ok(sucheCodes(codes, { ordner: 'Produkte', text: 'plakat' }).length === 0, 'Ordner und Wort zusammen');

  const stand = ordnerStand(codes);
  ok(stand.length === 3, 'drei Ordnerstände');
  ok(stand[0].name === '' && stand[0].anzahl === 1, '„ohne Ordner" zuerst');
  ok(stand[1].name === 'Frühjahr 2026' && stand[1].anzahl === 2, 'danach alphabetisch');

  ok(ordnerNameVon({ ordnerId: 'o1' }, { o1: 'Frühjahr' }) === 'Frühjahr', 'Ordner über die Kennung');
  ok(ordnerNameVon({ ordnerId: 'o9' }, { o1: 'Frühjahr' }) === '', 'fehlender Ordner bleibt leer');

  const plan = loeschePlan(codes[0]);
  ok(plan.aenderung.geloescht === true, 'Löschen setzt geloescht');
  ok(plan.aenderung.kuerzel === 'plak01', 'das Kürzel bleibt stehen');
  ok(plan.aenderung.ziel === '' && plan.aenderung.regelnJson === null, 'das Ziel geht weg');
  ok(plan.ereignis.was === 'code.geloescht', 'Protokolleintrag');
  ok(JSON.parse(plan.ereignis.altJson).kuerzel === 'plak01', 'das alte Kürzel im Protokoll');

  ok(!kuerzelFrei('plak01', codes), 'vergebenes Kürzel ist nicht frei');
  ok(!kuerzelFrei('WEG001', codes), 'gelöschtes Kürzel bleibt belegt — der ganze Punkt');
  ok(kuerzelFrei('neu001', codes), 'unbenutztes Kürzel ist frei');
  ok(!kuerzelFrei('  ', codes), 'leeres Kürzel ist nie frei');

  const ereignisse = [
    { was: 'code.geloescht', altJson: '{"kuerzel":"maepux"}' },
    { was: 'code.geloescht', altJson: '{"kuerzel":"maepux"}' },
    { was: 'code.geloescht', altJson: '{"kuerzel":"weg001"}' },
    { was: 'code.angelegt', neuJson: '{"kuerzel":"plak01"}' },
    { was: 'code.geloescht', altJson: 'kaputt' },
  ];
  const verwaist = verwaisteKuerzel(codes, ereignisse);
  ok(verwaist.length === 1 && verwaist[0] === 'maepux', 'nur wirklich verwaiste, ohne Dubletten');
  ok(sperrzeile('maepux', 'k1').geloescht === true, 'Sperrzeile ist gelöscht');
  ok(sperrzeile('maepux', 'k1').kuerzel === 'maepux', 'Sperrzeile belegt das Kürzel');

  console.log(f ? `\n${f} von ${n} fehlgeschlagen` : `\nalle ${n} Prüfungen bestanden`);
  if (f) process.exit(1);
}
