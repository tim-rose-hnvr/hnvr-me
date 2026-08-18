/**
 * Gemeinsamer Zugang für die Proben.
 *
 * Seit die Box eine Anmeldung hat, kommt keine Probe mehr ohne sie an
 * Buchungen, Vorlagen oder Einstellungen — und das ist der Sinn der Sache.
 * Statt jede Probe einzeln anmelden zu lassen, steht der Weg hier einmal:
 *
 *   · Ist die Box frisch, richtet die Probe einen Betreiber ein.
 *   · Sonst meldet sie sich an.
 *
 * Die Zugangsdaten kommen aus der Umgebung, damit dieselbe Probe auch gegen
 * eine echte Box laufen kann:
 *
 *   YOUBOOTH_MAIL=… YOUBOOTH_KENNWORT=… node tools/portal-probe.mjs
 */

export const BASIS = process.env.YOUBOOTH_BASIS || 'http://localhost:3377';
const MAIL = process.env.YOUBOOTH_MAIL || 'probe@example.org';
const KENNWORT = process.env.YOUBOOTH_KENNWORT || 'Probekennwort2026';

async function ruf(pfad, wunsch) {
  const a = await fetch(BASIS + pfad, {
    ...wunsch,
    headers: { 'Content-Type': 'application/json', ...(wunsch?.headers ?? {}) },
  });
  const text = await a.text();
  let daten = null;
  try { daten = text ? JSON.parse(text) : null; } catch { /* kein JSON */ }
  return { status: a.status, text, daten, keks: a.headers.get('set-cookie') || '' };
}

/**
 * Meldet sich an und gibt zurück, was eine Probe danach braucht: einen
 * Aufrufer mit Sitzung und den Keks für den Browser.
 */
export async function alsBetreiber() {
  const stand = await ruf('/api/betreiber');

  const antwort = stand.daten?.angelegt
    ? await ruf('/api/anmelden', {
        method: 'POST',
        body: JSON.stringify({ email: MAIL, kennwort: KENNWORT }),
      })
    : await ruf('/api/betreiber/einrichten', {
        method: 'POST',
        body: JSON.stringify({ name: 'Probe', email: MAIL, kennwort: KENNWORT }),
      });

  if (antwort.status !== 200) {
    throw new Error(
      `Anmeldung fehlgeschlagen (${antwort.status}): ${antwort.daten?.error || antwort.text}\n` +
        `Zugangsdaten über YOUBOOTH_MAIL und YOUBOOTH_KENNWORT setzen.`
    );
  }

  const marke = (antwort.keks.match(/youbooth_sitzung=([a-f0-9]+)/) || [])[1];
  if (!marke) throw new Error('Die Box hat keine Sitzung mitgegeben.');

  const kopf = { Cookie: `youbooth_sitzung=${marke}` };

  return {
    marke,
    /** Aufruf an die Box, angemeldet. */
    anDieBox: (pfad, wunsch) => ruf(pfad, { ...wunsch, headers: { ...kopf, ...(wunsch?.headers ?? {}) } }),
    /** Denselben Zugang einem Browser-Kontext mitgeben. */
    keksFuer: (url) => ({
      name: 'youbooth_sitzung',
      value: marke,
      url,
      httpOnly: true,
      sameSite: 'Lax',
    }),
  };
}

/** Ein Browser mit angemeldeter Sitzung — der Regelfall in den Proben. */
export async function angemeldeterKontext(browser, sitzung, optionen = {}) {
  const kontext = await browser.newContext(optionen);
  await kontext.addCookies([sitzung.keksFuer(BASIS)]);
  return kontext;
}
