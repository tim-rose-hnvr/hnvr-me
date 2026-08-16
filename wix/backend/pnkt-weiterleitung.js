/**
 * pnkt.me — Weiterleitung
 *
 * Der heißeste Pfad des ganzen Systems. Jeder gedruckte Code endet hier.
 * Drei Regeln gelten dabei ohne Ausnahme:
 *
 *   1. Ein Scan darf nie ins Leere laufen. Ist der Code gesperrt, abgelaufen
 *      oder unbekannt, geht es auf eine erklärende Seite, nicht auf einen
 *      Fehler des Servers.
 *   2. Es wird nichts gespeichert, was eine Person kennzeichnet. Keine
 *      IP-Adresse, kein Kennzeichen im Gerät, keine Rohzeile je Scan —
 *      nur Zähler in Klassen.
 *   3. Die Auflösung des Kürzels läuft über den eindeutigen Index. Ohne ihn
 *      wächst jede Weiterleitung mit der Zahl aller Codes aller Konten.
 */

import wixData from 'wix-data';

const SAMMLUNG_CODES = 'PK_Codes';
const SAMMLUNG_STATISTIK = 'PK_Statistik';
const SAMMLUNG_EREIGNISSE = 'PK_Ereignisse';

/**
 * Alphabet ohne Zeichen, die auf Papier verwechselt werden:
 * kein 0/O, kein 1/l/I, kein 5/S, kein 8/B.
 * Wer ein Kürzel von einem Plakat abtippt, soll es treffen.
 */
const ALPHABET = '234679acdefghjkmnpqrtuvwxyz';

/**
 * Erzeugt ein Kürzel. Die Länge wächst mit der Zahl der Versuche, damit
 * ein volles Namensfeld nicht in eine Endlosschleife läuft.
 */
export function baueKuerzel(laenge = 6) {
  let aus = '';
  for (let i = 0; i < laenge; i += 1) {
    aus += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return aus;
}

/**
 * Legt einen Code an und sichert das Kürzel über den eindeutigen Index ab.
 * Der Index ist die einzige verlässliche Stelle: eine Vorabfrage „gibt es
 * das Kürzel schon" ist ein Wettlauf, den zwei gleichzeitige Anfragen
 * verlieren — und bei gedruckten Codes ist das nicht reparierbar.
 *
 * Setzt voraus: eindeutiger Index auf PK_Codes.kuerzel.
 */
export async function legeCodeAn(daten, optionen = { suppressAuth: true }) {
  for (let versuch = 0; versuch < 6; versuch += 1) {
    const kuerzel = daten.kuerzel || baueKuerzel(versuch < 3 ? 6 : 7);
    try {
      return await wixData.insert(SAMMLUNG_CODES, { ...daten, kuerzel }, optionen);
    } catch (fehler) {
      const doppelt = String(fehler && fehler.message || '').includes('WDE0113')
        || String(fehler && fehler.code || '') === 'WDE0113';
      // Ein vom Aufrufer vorgegebenes Kürzel wird nicht heimlich ersetzt.
      if (!doppelt || daten.kuerzel) { throw fehler; }
    }
  }
  throw new Error('Kein freies Kürzel gefunden — Alphabet oder Länge prüfen.');
}

/**
 * Wählt das Ziel aus dem Regelwerk.
 *
 * regelnJson kennt:
 *   { "standard": "https://…",
 *     "zeit":    [{ "von": "2026-12-01", "bis": "2026-12-26", "ziel": "…" }],
 *     "land":    { "DE": "…", "AT": "…" },
 *     "sprache": { "de": "…", "en": "…" },
 *     "geraet":  { "ios": "…", "android": "…" } }
 *
 * Reihenfolge ist festgelegt und nicht verhandelbar, sonst ist das Ergebnis
 * für den Kunden nicht vorhersagbar: Zeit vor Land vor Sprache vor Gerät.
 */
export function waehleZiel(regeln, umstand = {}) {
  const jetzt = umstand.jetzt ? new Date(umstand.jetzt) : new Date();

  if (Array.isArray(regeln.zeit)) {
    for (const fenster of regeln.zeit) {
      const von = fenster.von ? new Date(fenster.von) : null;
      const bis = fenster.bis ? new Date(fenster.bis) : null;
      if ((!von || jetzt >= von) && (!bis || jetzt <= bis) && fenster.ziel) {
        return { ziel: fenster.ziel, grund: 'zeit' };
      }
    }
  }

  if (regeln.land && umstand.land && regeln.land[umstand.land]) {
    return { ziel: regeln.land[umstand.land], grund: 'land' };
  }

  if (regeln.sprache && umstand.sprache) {
    const kurz = String(umstand.sprache).slice(0, 2).toLowerCase();
    if (regeln.sprache[kurz]) {
      return { ziel: regeln.sprache[kurz], grund: 'sprache' };
    }
  }

  if (regeln.geraet && umstand.geraet && regeln.geraet[umstand.geraet]) {
    return { ziel: regeln.geraet[umstand.geraet], grund: 'geraet' };
  }

  return { ziel: regeln.standard, grund: 'standard' };
}

/** Hängt Kampagnenparameter an, ohne vorhandene zu überschreiben. */
export function ergaenzeKampagne(ziel, utm) {
  if (!utm || !Object.keys(utm).length) { return ziel; }
  const [basis, vorhandenerTeil = ''] = String(ziel).split('?');
  const vorhanden = new Set(
    vorhandenerTeil.split('&').filter(Boolean).map((p) => p.split('=')[0])
  );
  const neu = Object.entries(utm)
    .filter(([k, v]) => v && !vorhanden.has(k))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  if (!neu.length) { return ziel; }
  const trenner = vorhandenerTeil ? '&' : '?';
  return `${basis}${vorhandenerTeil ? '?' + vorhandenerTeil : ''}${trenner}${neu.join('&')}`;
}

/**
 * Ordnet den Scan in Klassen ein. Was hier nicht entsteht, kann später auch
 * nicht verlangt, gestohlen oder herausgegeben werden.
 */
export function klassen(kopfzeilen = {}, jetzt = new Date()) {
  const kennung = String(kopfzeilen['user-agent'] || '').toLowerCase();
  const sprache = String(kopfzeilen['accept-language'] || '').slice(0, 2).toLowerCase();

  let geraet = 'rechner';
  if (/iphone|ipod/.test(kennung)) { geraet = 'iphone'; }
  else if (/ipad/.test(kennung)) { geraet = 'ipad'; }
  else if (/android/.test(kennung)) { geraet = 'android'; }

  let system = 'sonstige';
  if (/iphone|ipad|ipod|mac os/.test(kennung)) { system = 'apple'; }
  else if (/android/.test(kennung)) { system = 'android'; }
  else if (/windows/.test(kennung)) { system = 'windows'; }

  const stunde = String(jetzt.getUTCHours()).padStart(2, '0');

  return {
    geraet: `geraet:${geraet}`,
    system: `system:${system}`,
    sprache: `sprache:${sprache || '*'}`,
    stunde: `stunde:${stunde}`
  };
}

/** Tagesschlüssel in UTC — eine Zeile je Code und Tag, nie je Scan. */
export function tagesschluessel(codeId, jetzt = new Date()) {
  return `${codeId}_${jetzt.toISOString().slice(0, 10)}`;
}

/**
 * Zählt einen Scan. Legt die Tageszeile an oder erhöht sie.
 * Bewusst ohne Sperre: ein verlorener Zähler bei gleichzeitigen Scans ist
 * hinnehmbar, eine langsamere Weiterleitung nicht.
 */
export async function zaehleScan(code, kopfzeilen, jetzt = new Date()) {
  const id = tagesschluessel(code._id, jetzt);
  const klasse = klassen(kopfzeilen, jetzt);
  const optionen = { suppressAuth: true };

  let zeile = null;
  try {
    zeile = await wixData.get(SAMMLUNG_STATISTIK, id, optionen);
  } catch (fehler) {
    zeile = null; // noch keine Zeile für heute
  }

  const zaehler = zeile && zeile.zaehlerJson ? JSON.parse(zeile.zaehlerJson) : {};
  const hoch = (schluessel) => { zaehler[schluessel] = (zaehler[schluessel] || 0) + 1; };

  hoch('gesamt');
  hoch(klasse.geraet);
  hoch(klasse.system);
  hoch(klasse.sprache);
  hoch(klasse.stunde);
  hoch(`quelle:${kopfzeilen.referer ? 'verweis' : 'direkt'}`);

  await wixData.save(SAMMLUNG_STATISTIK, {
    _id: id,
    codeId: code._id,
    tag: jetzt.toISOString().slice(0, 10),
    gesamt: zaehler.gesamt,
    zaehlerJson: JSON.stringify(zaehler)
  }, optionen);

  return zaehler.gesamt;
}

/**
 * Löst ein Kürzel auf und liefert die Entscheidung.
 * Gibt immer eine Antwort — nie einen Fehler nach außen.
 *
 * @returns {{art: 'weiterleitung'|'hinweis', ziel?: string, grund: string, code?: object}}
 */
export async function loeseAuf(kuerzel, umstand = {}) {
  const optionen = { suppressAuth: true };
  const treffer = await wixData.query(SAMMLUNG_CODES)
    .eq('kuerzel', String(kuerzel || '').toLowerCase())
    .limit(1)
    .find(optionen);

  const code = treffer.items[0];
  if (!code) {
    return { art: 'hinweis', grund: 'unbekannt' };
  }
  if (code.gesperrtWegen) {
    return { art: 'hinweis', grund: 'gesperrt', code };
  }
  if (code.aktiv === false) {
    return { art: 'hinweis', grund: 'stillgelegt', code };
  }
  if (code.gueltigBis && new Date(code.gueltigBis) < new Date()) {
    return { art: 'hinweis', grund: 'abgelaufen', code };
  }

  const regeln = code.regelnJson ? JSON.parse(code.regelnJson) : { standard: code.ziel };
  const gewaehlt = waehleZiel(regeln, umstand);
  if (!gewaehlt.ziel) {
    return { art: 'hinweis', grund: 'ohne Ziel', code };
  }

  const utm = code.utmJson ? JSON.parse(code.utmJson) : null;
  return {
    art: 'weiterleitung',
    ziel: ergaenzeKampagne(gewaehlt.ziel, utm),
    grund: gewaehlt.grund,
    code
  };
}

/**
 * Schreibt einen Eintrag ins Ereignisprotokoll. Jede Zieländerung eines
 * gedruckten Codes muss hier stehen — sie ist der einzige Vorgang, den
 * niemand mehr zurückholen kann, wenn der Bogen einmal läuft.
 */
export async function protokolliere(kontoId, wer, was, gegenstand, alt, neu) {
  return wixData.insert(SAMMLUNG_EREIGNISSE, {
    kontoId,
    wer,
    was,
    gegenstand,
    altJson: alt ? JSON.stringify(alt) : null,
    neuJson: neu ? JSON.stringify(neu) : null,
    zeit: new Date().toISOString()
  }, { suppressAuth: true });
}
