/* Regeln der Anmeldung über hnvr.me — ohne Netz, ohne SDK, prüfbar.

   Alles, was hier steht, entscheidet etwas, das schiefgehen kann, ohne dass
   es jemand sieht: wohin nach der Anmeldung zurückgesprungen wird, was in
   einem Keks steht, und was passiert, wenn Wix mit einem Fehler zurückkommt.
   Deshalb steht es getrennt von den Routen, und skripte/pruefe-hnvr.mjs prüft
   es ohne Server. */

/** Der Keks mit dem Refresh-Token des hnvr.me-Mitglieds. */
export const SITZUNG = 'hnvr_sitzung';
/** Der Keks, der den Anmeldevorgang über den Umweg zu Wix trägt (PKCE). */
export const VORGANG = 'hnvr_vorgang';

/** 30 Tage — so lange wie der Merkzettel im Studio. */
export const SITZUNG_SEKUNDEN = 60 * 60 * 24 * 30;
/** Eine halbe Stunde für den Weg zu Wix und zurück. */
export const VORGANG_SEKUNDEN = 60 * 30;

/**
 * Das Ziel nach der Anmeldung — nur ein Pfad auf dieser Seite.
 *
 * Ohne diese Prüfung wäre /api/hnvr/anmelden?returnToUrl=https://fremd.example
 * ein offener Umleiter: jemand verschickt einen Link, der echt aussieht, und
 * wer sich anmeldet, landet danach bei ihm. Erlaubt ist deshalb nur, was mit
 * genau einem Schrägstrich beginnt und nach dem Auflösen auf dieser Seite
 * bleibt.
 * @param {unknown} wert
 * @param {string} [ersatz]
 */
export function sichererRuecksprung(wert, ersatz = '/') {
  if (typeof wert !== 'string' || wert.length > 2000) return ersatz;
  if (!wert.startsWith('/') || wert.startsWith('//') || wert.startsWith('/\\')) return ersatz;
  try {
    const PROBE = 'https://probe.invalid';
    const aufgeloest = new URL(wert, PROBE);
    if (aufgeloest.origin !== PROBE) return ersatz;
    return `${aufgeloest.pathname}${aufgeloest.search}${aufgeloest.hash}`;
  } catch {
    return ersatz;
  }
}

/**
 * Liest einen Keks aus dem Cookie-Kopf.
 * @param {string | null | undefined} kopf
 * @param {string} name
 * @returns {string | null}
 */
export function liesKeks(kopf, name) {
  if (!kopf) return null;
  for (const teil of kopf.split(';')) {
    const gleich = teil.indexOf('=');
    if (gleich < 0) continue;
    if (teil.slice(0, gleich).trim() !== name) continue;
    try { return decodeURIComponent(teil.slice(gleich + 1).trim()); } catch { return null; }
  }
  return null;
}

/**
 * Baut einen Set-Cookie-Wert. Immer HttpOnly — kein Skript auf der Seite soll
 * an ein Token kommen — und immer SameSite=Lax: die Rückkehr von Wix ist eine
 * Navigation, bei der Lax-Kekse mitgehen; eingebettete Anfragen fremder
 * Seiten bekommen sie nicht.
 * @param {string} name
 * @param {string} wert
 * @param {{ sekunden: number, sicher?: boolean }} optionen
 */
export function keks(name, wert, { sekunden, sicher = true }) {
  return [
    `${name}=${encodeURIComponent(wert)}`,
    `Max-Age=${Math.max(0, Math.floor(sekunden))}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    sicher ? 'Secure' : null,
  ].filter(Boolean).join('; ');
}

/** @param {string} name @param {boolean} [sicher] */
export function keksLoeschen(name, sicher = true) {
  return keks(name, '', { sekunden: 0, sicher });
}

/**
 * Die Adresse, an die Wix nach der Anmeldung zurückschickt. Sie muss Zeichen
 * für Zeichen in den erlaubten Rücksprungadressen des Zugangs stehen.
 *
 * Hinter dem Wix-Hosting kommt die Anfrage als http an, draußen ist es https;
 * ohne das Umschreiben stimmte die Adresse nie. Nur localhost bleibt, wie es ist.
 * @param {URL} anfrage
 */
export function rueckkehrAdresse(anfrage) {
  const basis = new URL('/api/hnvr/rueckkehr', anfrage);
  if (!['localhost', '127.0.0.1'].includes(basis.hostname)) basis.protocol = 'https:';
  return basis.toString();
}

/** @param {URL} anfrage */
export function istOertlich(anfrage) {
  return ['localhost', '127.0.0.1'].includes(anfrage.hostname);
}

/**
 * Was nach der Rückkehr von Wix zu tun ist.
 *
 * Die Anmeldung beginnt still (`prompt=none`): wer bei hnvr.me schon
 * angemeldet ist, kommt ohne Formular durch. Ist niemand angemeldet, kommt
 * Wix mit einem Fehler zurück — dann, und nur dann, geht es ein zweites Mal
 * hin, jetzt mit Formular. Ein zweiter Fehlschlag führt nicht in eine
 * Schleife, sondern mit einem Hinweis zurück.
 *
 * @param {{ fehler?: string | null, code?: string | null, zustand?: string | null,
 *   vorgang?: { prompt?: string, oauthData?: { state?: string, originalUri?: string } } | null }} eingang
 * @returns {{ art: 'tokens' } | { art: 'mit-formular', ruecksprung: string }
 *   | { art: 'fehlschlag', ruecksprung: string, grund: string }}
 */
export function entscheideRueckkehr({ fehler, code, zustand, vorgang }) {
  const ruecksprung = sichererRuecksprung(vorgang?.oauthData?.originalUri, '/portal');
  if (!vorgang?.oauthData?.state) {
    return { art: 'fehlschlag', ruecksprung: '/portal', grund: 'vorgang-fehlt' };
  }
  if (fehler) {
    if (vorgang.prompt === 'none') return { art: 'mit-formular', ruecksprung };
    return { art: 'fehlschlag', ruecksprung, grund: String(fehler).slice(0, 60) };
  }
  if (!code) return { art: 'fehlschlag', ruecksprung, grund: 'ohne-code' };
  if (zustand !== vorgang.oauthData.state) {
    return { art: 'fehlschlag', ruecksprung, grund: 'zustand-passt-nicht' };
  }
  return { art: 'tokens' };
}

/**
 * Der Name, unter dem ein Mitglied gezeigt wird.
 * @param {any} mitglied
 */
export function anzeigename(mitglied) {
  if (!mitglied) return null;
  return mitglied.profile?.nickname
    || [mitglied.contact?.firstName, mitglied.contact?.lastName].filter(Boolean).join(' ')
    || mitglied.loginEmail
    || 'Angemeldet';
}
