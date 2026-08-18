/**
 * Die Endpunkte hinter den Formularen.
 *
 * Warum es sie gibt, ist eine unangenehme Erkenntnis: **auf Wix
 * funktioniert kein gewöhnlicher Formular-POST.** Der Rand von Wix
 * antwortet auf jedes `application/x-www-form-urlencoded` mit
 *
 *   403  Cross-site POST form submissions are forbidden
 *
 * und zwar auch dann, wenn Origin, Referer, Sec-Fetch-Site und die
 * Wix-Sitzungskekse alle stimmen. Nachgemessen mit browsergleichen
 * Kopfzeilen und gefülltem Keksglas; dieselbe Sperre trifft auch das
 * Nachrichtenformular von Get in Touch. Ein POST mit
 * `application/json` geht durch.
 *
 * Folge, und die muss man aussprechen: die Anmeldung ist auf diesem
 * Hoster **nicht ohne JavaScript bedienbar**. Ich hatte das Gegenteil
 * gebaut und angekündigt. Die Formulare bleiben trotzdem echte
 * Formulare — Beschriftungen, Autovervollständigung, Tastatur — nur
 * abgeschickt werden sie von einem kleinen Skript als JSON.
 *
 * Auf einem eigenen Server fällt die Sperre weg. Deshalb nehmen die
 * Endpunkte **beides** entgegen, JSON und Formular: dann ist der Umzug
 * eine Sache der Adresse und nicht des Aufbaus.
 */

import type { APIRoute } from 'astro';
import { anmelden, ausweisKeks, ausweisLoeschen, registrieren, sitzungAus } from './konto.ts';
import {
  codeAnlegen,
  codeStilllegen,
  codeWiederAufnehmen,
  codeNachKuerzel,
  codesVonKonto,
  kuerzelPruefen,
  kuerzelVorschlag,
  nameSetzen,
  zielSetzen,
} from './ablage.ts';

export const prerender = false;

/** Liest den Rumpf, gleichgültig ob JSON oder Formular. */
async function felder(anfrage: Request): Promise<Record<string, string>> {
  const art = anfrage.headers.get('content-type') ?? '';
  if (art.includes('application/json')) {
    const roh = (await anfrage.json()) as Record<string, unknown>;
    const aus: Record<string, string> = {};
    for (const [k, v] of Object.entries(roh)) aus[k] = typeof v === 'string' ? v : String(v ?? '');
    return aus;
  }
  const daten = await anfrage.formData();
  const aus: Record<string, string> = {};
  for (const [k, v] of daten.entries()) aus[k] = String(v);
  return aus;
}

const json = (wert: unknown, lage = 200, kekse?: string) =>
  new Response(JSON.stringify(wert), {
    status: lage,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(kekse ? { 'set-cookie': kekse } : {}),
    },
  });

// ─── Ziele prüfen ─────────────────────────────────────────────────────
//
// Dieselbe Regel wie beim Umhängen, an einer Stelle. Erlaubt ist, was
// ein Telefon nach dem Scannen auch öffnen soll: kein javascript:,
// kein data:, kein file:.
function zielTaugt(ziel: string): boolean {
  return /^https?:\/\/\S+$/i.test(ziel) || /^(mailto|tel):\S+$/i.test(ziel);
}

const ZIELFEHLER = 'Das Ziel muss mit http://, https://, mailto: oder tel: beginnen.';

export const anmeldenEndpunkt: APIRoute = async ({ request }) => {
  let f: Record<string, string>;
  try {
    f = await felder(request);
  } catch {
    return json({ fehler: 'Anfrage nicht lesbar.' }, 400);
  }
  const mail = (f.mail ?? '').trim();
  const passwort = f.passwort ?? '';
  if (!mail || !passwort) return json({ fehler: 'Bitte beides ausfüllen.' }, 400);

  try {
    const angemeldet = await anmelden(mail, passwort);
    // Eine Meldung für beide Fälle: wer „Adresse unbekannt" von
    // „Passwort falsch" unterscheiden kann, kann Konten abzählen.
    if (!angemeldet) return json({ fehler: 'Adresse oder Passwort stimmt nicht.' }, 401);
    return json({ ok: true, weiter: '/zentrale', name: angemeldet.sitzung.name }, 200, ausweisKeks(angemeldet.ausweis));
  } catch (e) {
    console.error('[pnkt] Anmeldung fehlgeschlagen:', e);
    return json({ fehler: 'Die Anmeldung ist gerade nicht erreichbar.' }, 503);
  }
};

export const abmeldenEndpunkt: APIRoute = async () =>
  json({ ok: true, weiter: '/anmelden' }, 200, ausweisLoeschen());

export const zielEndpunkt: APIRoute = async ({ request }) => {
  const sitzung = await sitzungAus(request.headers);
  if (!sitzung) return json({ fehler: 'Nicht angemeldet.' }, 401);

  let f: Record<string, string>;
  try {
    f = await felder(request);
  } catch {
    return json({ fehler: 'Anfrage nicht lesbar.' }, 400);
  }
  const id = (f.id ?? '').trim();
  const ziel = (f.ziel ?? '').trim();

  // Geprüft wird hier und nicht im Browser: die Anfrage kommt notfalls
  // von überall her.
  if (!zielTaugt(ziel)) return json({ fehler: ZIELFEHLER }, 400);

  // Der Code muss diesem Konto gehören, sonst hängt jemand mit einer
  // fremden Kennung ein fremdes Plakat um.
  const eigene = await codesVonKonto(sitzung.kontoId, 500);
  if (!eigene.some((c) => c.id === id)) return json({ fehler: 'Dieser Code gehört nicht zu diesem Konto.' }, 403);

  try {
    await zielSetzen(id, ziel);
  } catch (e) {
    console.error('[pnkt] Ziel nicht setzbar:', e);
    return json({ fehler: 'Das Speichern hat nicht geklappt.' }, 503);
  }
  return json({ ok: true, ziel });
};

export const registrierenEndpunkt: APIRoute = async ({ request }) => {
  let f: Record<string, string>;
  try {
    f = await felder(request);
  } catch {
    return json({ fehler: 'Anfrage nicht lesbar.' }, 400);
  }

  const ergebnis = await registrieren(f.mail ?? '', f.passwort ?? '', f.name ?? '');
  if ('fehler' in ergebnis) return json({ fehler: ergebnis.fehler }, 400);
  return json(
    { ok: true, weiter: '/zentrale', name: ergebnis.sitzung.name },
    200,
    ausweisKeks(ergebnis.ausweis),
  );
};

/**
 * Sagt, ob ein Kürzel noch frei ist. Nur für die Anzeige neben dem
 * Feld — entschieden wird beim Anlegen, dort und nirgends sonst.
 */
export const kuerzelEndpunkt: APIRoute = async ({ request }) => {
  if (!(await sitzungAus(request.headers))) return json({ fehler: 'Nicht angemeldet.' }, 401);
  const gefragt = new URL(request.url).searchParams.get('kuerzel') ?? '';
  const urteil = kuerzelPruefen(gefragt);
  if (!urteil.ok) return json({ frei: false, grund: urteil.grund, wert: urteil.wert });
  try {
    const belegt = await codeNachKuerzel(urteil.wert);
    return json(
      belegt
        ? { frei: false, grund: `„${urteil.wert}" ist schon vergeben.`, wert: urteil.wert }
        : { frei: true, wert: urteil.wert },
    );
  } catch {
    // Kein Urteil ist besser als ein falsches: das Anlegen prüft ohnehin.
    return json({ frei: null, wert: urteil.wert });
  }
};

/** Legt einen neuen dynamischen Code an. */
export const neuEndpunkt: APIRoute = async ({ request }) => {
  const sitzung = await sitzungAus(request.headers);
  if (!sitzung) return json({ fehler: 'Nicht angemeldet.' }, 401);

  let f: Record<string, string>;
  try {
    f = await felder(request);
  } catch {
    return json({ fehler: 'Anfrage nicht lesbar.' }, 400);
  }

  const ziel = (f.ziel ?? '').trim();
  if (!zielTaugt(ziel)) return json({ fehler: ZIELFEHLER }, 400);

  const name = (f.name ?? '').trim().slice(0, 120);
  const gewuenscht = (f.kuerzel ?? '').trim();

  // Ohne Wunsch wird gewürfelt, und zwar mehrmals: ein Zusammenstoß bei
  // sieben Zeichen aus 32 ist selten, aber „selten" ist keine Antwort
  // für jemanden, der gerade drucken will.
  const versuche = gewuenscht ? [gewuenscht] : [kuerzelVorschlag(), kuerzelVorschlag(), kuerzelVorschlag()];

  let letzterFehler = 'Das Anlegen hat nicht geklappt.';
  for (const versuch of versuche) {
    const urteil = kuerzelPruefen(versuch);
    if (!urteil.ok) return json({ fehler: urteil.grund }, 400);
    try {
      const code = await codeAnlegen({ kontoId: sitzung.kontoId, kuerzel: urteil.wert, ziel, name });
      return json({ ok: true, kuerzel: code.kuerzel, id: code.id });
    } catch (e) {
      if ((e as Error)?.message === 'kuerzel-vergeben') {
        if (gewuenscht) return json({ fehler: `„${urteil.wert}" ist schon vergeben. Nimm ein anderes.` }, 409);
        letzterFehler = 'Gerade war jedes gewürfelte Kürzel belegt. Bitte noch einmal.';
        continue;
      }
      console.error('[pnkt] Code nicht anlegbar:', e);
      return json({ fehler: 'Das Anlegen hat nicht geklappt.' }, 503);
    }
  }
  return json({ fehler: letzterFehler }, 503);
};

/**
 * Legt einen Code still oder nimmt ihn wieder auf. Gelöscht wird nie:
 * das Kürzel bleibt vergeben, sonst zeigt ein alter Aufsteller
 * irgendwann auf ein fremdes Ziel.
 */
export const standEndpunkt: APIRoute = async ({ request }) => {
  const sitzung = await sitzungAus(request.headers);
  if (!sitzung) return json({ fehler: 'Nicht angemeldet.' }, 401);

  let f: Record<string, string>;
  try {
    f = await felder(request);
  } catch {
    return json({ fehler: 'Anfrage nicht lesbar.' }, 400);
  }

  const id = (f.id ?? '').trim();
  const eigene = await codesVonKonto(sitzung.kontoId, 500);
  const meiner = eigene.find((c) => c.id === id);
  if (!meiner) return json({ fehler: 'Dieser Code gehört nicht zu diesem Konto.' }, 403);

  try {
    if (f.stand === 'aktiv') {
      await codeWiederAufnehmen(id);
      return json({ ok: true, aktiv: true });
    }
    await codeStilllegen(
      id,
      (f.grund ?? '').trim() ||
        'Er wurde von seinem Besitzer abgeschaltet. Das Kürzel bleibt dauerhaft vergeben und wird nie neu verteilt.',
    );
    return json({ ok: true, aktiv: false });
  } catch (e) {
    console.error('[pnkt] Stand nicht setzbar:', e);
    return json({ fehler: 'Das Speichern hat nicht geklappt.' }, 503);
  }
};

/** Benennt einen Code um. Ändert nichts am Ziel und nichts am Muster. */
export const nameEndpunkt: APIRoute = async ({ request }) => {
  const sitzung = await sitzungAus(request.headers);
  if (!sitzung) return json({ fehler: 'Nicht angemeldet.' }, 401);

  let f: Record<string, string>;
  try {
    f = await felder(request);
  } catch {
    return json({ fehler: 'Anfrage nicht lesbar.' }, 400);
  }
  const id = (f.id ?? '').trim();
  const eigene = await codesVonKonto(sitzung.kontoId, 500);
  if (!eigene.some((c) => c.id === id)) return json({ fehler: 'Dieser Code gehört nicht zu diesem Konto.' }, 403);

  try {
    await nameSetzen(id, (f.name ?? '').trim().slice(0, 120));
  } catch (e) {
    console.error('[pnkt] Name nicht setzbar:', e);
    return json({ fehler: 'Das Speichern hat nicht geklappt.' }, 503);
  }
  return json({ ok: true });
};
