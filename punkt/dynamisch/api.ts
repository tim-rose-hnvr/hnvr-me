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
import { anmelden, ausweisKeks, ausweisLoeschen, registrieren, sitzungAus, zugangAus, type Zugang } from './konto.ts';
import {
  codeAnlegen,
  codeNachId,
  codeStilllegen,
  codeWiederAufnehmen,
  codeNachKuerzel,
  einladungAusstellen,
  einladungEinloesen,
  einladungNachSchluessel,
  fuehrtMitarbeitende,
  kontoNachId,
  kuerzelPruefen,
  kuerzelVorschlag,
  mitgliedEntfernen,
  mitgliedNachId,
  mitgliedRolleSetzen,
  nameSetzen,
  zielSetzen,
  zugehoerigkeitVon,
  type Code,
} from './ablage.ts';
import {
  adresseBereinigen,
  adresseTaugt,
  annahmeHindernis,
  darfSchreiben,
  darfVerwalten,
  rolleAmCode,
  rolleTaugt,
  rueckwegTaugt,
} from './team.ts';

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

/**
 * Der eine Ort, an dem gefragt wird, ob jemand einen Code ändern darf.
 * Nicht in der Oberfläche: die Anfrage kommt notfalls von überall her.
 *
 * Gibt den Code zurück, oder die fertige Absage.
 */
async function schreibbarerCode(zugang: Zugang, id: string): Promise<Code | Response> {
  const code = await codeNachId(id);
  const rolle = code ? rolleAmCode(code.kontoId, zugang.kontoId, zugang.zugehoerigkeit) : null;
  // Fremd und unbekannt bekommen dieselbe Antwort — sonst ließe sich
  // abfragen, welche Kennungen es gibt.
  if (!code || !rolle) return json({ fehler: 'Dieser Code gehört nicht zu diesem Konto.' }, 403);
  if (!darfSchreiben(rolle))
    return json({ fehler: 'Als Leser kannst du diesen Code ansehen, aber nicht ändern.' }, 403);
  return code;
}

/** Wohin es nach dem Anmelden geht. Nur ein Einladungslink, sonst die Zentrale. */
function weiterNach(f: Record<string, string>): string {
  const weg = (f.weiter ?? '').trim();
  return rueckwegTaugt(weg) ? weg : '/zentrale';
}

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
    return json({ ok: true, weiter: weiterNach(f), name: angemeldet.sitzung.name }, 200, ausweisKeks(angemeldet.ausweis));
  } catch (e) {
    console.error('[pnkt] Anmeldung fehlgeschlagen:', e);
    return json({ fehler: 'Die Anmeldung ist gerade nicht erreichbar.' }, 503);
  }
};

export const abmeldenEndpunkt: APIRoute = async () =>
  json({ ok: true, weiter: '/anmelden' }, 200, ausweisLoeschen());

export const zielEndpunkt: APIRoute = async ({ request }) => {
  const zugang = await zugangAus(request.headers);
  if (!zugang) return json({ fehler: 'Nicht angemeldet.' }, 401);

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

  // Der Code muss zu diesem Konto oder seiner Organisation gehören,
  // sonst hängt jemand mit einer fremden Kennung ein fremdes Plakat um.
  const code = await schreibbarerCode(zugang, id);
  if (code instanceof Response) return code;

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
    { ok: true, weiter: weiterNach(f), name: ergebnis.sitzung.name },
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
  const zugang = await zugangAus(request.headers);
  if (!zugang) return json({ fehler: 'Nicht angemeldet.' }, 401);
  // Wer mitarbeitet, legt für die Organisation an — Codes gehören ihr,
  // nicht der Person. Leser legen nichts an.
  if (!darfSchreiben(zugang.rolle))
    return json({ fehler: 'Als Leser kannst du Codes ansehen, aber keine anlegen.' }, 403);

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
      const code = await codeAnlegen({ kontoId: zugang.organisation, kuerzel: urteil.wert, ziel, name });
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
  const zugang = await zugangAus(request.headers);
  if (!zugang) return json({ fehler: 'Nicht angemeldet.' }, 401);

  let f: Record<string, string>;
  try {
    f = await felder(request);
  } catch {
    return json({ fehler: 'Anfrage nicht lesbar.' }, 400);
  }

  const id = (f.id ?? '').trim();
  const code = await schreibbarerCode(zugang, id);
  if (code instanceof Response) return code;

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
  const zugang = await zugangAus(request.headers);
  if (!zugang) return json({ fehler: 'Nicht angemeldet.' }, 401);

  let f: Record<string, string>;
  try {
    f = await felder(request);
  } catch {
    return json({ fehler: 'Anfrage nicht lesbar.' }, 400);
  }
  const id = (f.id ?? '').trim();
  const code = await schreibbarerCode(zugang, id);
  if (code instanceof Response) return code;

  try {
    await nameSetzen(id, (f.name ?? '').trim().slice(0, 120));
  } catch (e) {
    console.error('[pnkt] Name nicht setzbar:', e);
    return json({ fehler: 'Das Speichern hat nicht geklappt.' }, 503);
  }
  return json({ ok: true });
};

// ─── Mitarbeitende ────────────────────────────────────────────────────
//
// Die Regeln stehen in `team.ts`, die Ablage in `ablage.ts`. Hier wird
// nur entschieden, wer was darf — und zwar bei jeder Anfrage neu: wer
// gerade entlassen wurde, hat mit dem nächsten Klick keine Rechte mehr,
// nicht erst nach Ablauf seines Ausweises.

/**
 * Stellt einen Einladungslink aus. Nur der Inhaber.
 *
 * Ob es zur Adresse schon ein Konto gibt, wird hier bewusst nicht
 * gesagt: sonst könnte jedes Konto über dieses Formular abfragen, wer
 * sonst noch eines hat. Geprüft wird beim Annehmen.
 */
export const einladenEndpunkt: APIRoute = async ({ request }) => {
  const zugang = await zugangAus(request.headers);
  if (!zugang) return json({ fehler: 'Nicht angemeldet.' }, 401);
  if (!darfVerwalten(zugang.rolle)) return json({ fehler: 'Mitarbeitende führt der Inhaber.' }, 403);

  let f: Record<string, string>;
  try {
    f = await felder(request);
  } catch {
    return json({ fehler: 'Anfrage nicht lesbar.' }, 400);
  }
  const mail = adresseBereinigen(f.mail ?? '');
  const rolle = (f.rolle ?? '').trim();
  if (!adresseTaugt(mail)) return json({ fehler: 'Diese E-Mail-Adresse sieht nicht vollständig aus.' }, 400);
  if (!rolleTaugt(rolle)) return json({ fehler: 'Erlaubt sind Redakteur und Leser.' }, 400);
  if (mail === adresseBereinigen(zugang.mail)) return json({ fehler: 'Das bist du selbst.' }, 400);

  try {
    const e = await einladungAusstellen({ inhaberId: zugang.kontoId, mail, rolle });
    const link = `${new URL(request.url).origin}/einladung/${e.schluessel}`;
    return json({ ok: true, link, bis: e.bis, mail, rolle, id: e.id });
  } catch (e) {
    const grund = (e as Error)?.message;
    if (grund === 'schon-dabei') return json({ fehler: `${mail} arbeitet hier schon mit.` }, 409);
    if (grund === 'zu-viele') return json({ fehler: 'Mehr als 50 Mitarbeitende und Einladungen gehen nicht.' }, 409);
    console.error('[pnkt] Einladung nicht ausstellbar:', e);
    return json({ fehler: 'Das Ausstellen hat nicht geklappt.' }, 503);
  }
};

/**
 * Ändert eine Mitgliedschaft.
 *
 *   aktion=rolle      Inhaber setzt Redakteur oder Leser
 *   aktion=entfernen  Inhaber entlässt oder zieht eine Einladung zurück —
 *                     oder die Person tritt selbst aus
 */
export const mitgliedEndpunkt: APIRoute = async ({ request }) => {
  const zugang = await zugangAus(request.headers);
  if (!zugang) return json({ fehler: 'Nicht angemeldet.' }, 401);

  let f: Record<string, string>;
  try {
    f = await felder(request);
  } catch {
    return json({ fehler: 'Anfrage nicht lesbar.' }, 400);
  }
  const m = await mitgliedNachId((f.id ?? '').trim());
  const istInhaber = Boolean(m) && darfVerwalten(zugang.rolle) && m!.inhaberId === zugang.kontoId;
  const istSelbst = Boolean(m) && m!.zustand === 'aktiv' && m!.mitgliedId === zugang.kontoId;
  if (!m || (!istInhaber && !istSelbst)) return json({ fehler: 'Diese Mitgliedschaft gehört nicht zu diesem Konto.' }, 403);

  try {
    if (f.aktion === 'rolle') {
      if (!istInhaber) return json({ fehler: 'Rollen vergibt der Inhaber.' }, 403);
      const rolle = (f.rolle ?? '').trim();
      if (!rolleTaugt(rolle)) return json({ fehler: 'Erlaubt sind Redakteur und Leser.' }, 400);
      await mitgliedRolleSetzen(m.id, rolle);
      return json({ ok: true, rolle });
    }
    if (f.aktion === 'entfernen') {
      await mitgliedEntfernen(m.id);
      return json({ ok: true, weiter: istSelbst ? '/zentrale' : undefined });
    }
  } catch (e) {
    console.error('[pnkt] Mitgliedschaft nicht änderbar:', e);
    return json({ fehler: 'Das Speichern hat nicht geklappt.' }, 503);
  }
  return json({ fehler: 'Unbekannte Aktion.' }, 400);
};

/** Nimmt eine Einladung an. Braucht eine Anmeldung mit der eingeladenen Adresse. */
export const annehmenEndpunkt: APIRoute = async ({ request }) => {
  const sitzung = await sitzungAus(request.headers);
  if (!sitzung) return json({ fehler: 'Nicht angemeldet.' }, 401);

  let f: Record<string, string>;
  try {
    f = await felder(request);
  } catch {
    return json({ fehler: 'Anfrage nicht lesbar.' }, 400);
  }

  try {
    const e = await einladungNachSchluessel((f.schluessel ?? '').trim());
    if (!e) return json({ fehler: 'Diese Einladung gilt nicht (mehr). Bitte um einen neuen Link.' }, 404);

    const [schonDabei, fuehrtSelbst, inhaberWoanders] = await Promise.all([
      zugehoerigkeitVon(sitzung.kontoId),
      fuehrtMitarbeitende(sitzung.kontoId),
      zugehoerigkeitVon(e.inhaberId),
    ]);
    const hindernis = annahmeHindernis({
      eingeladen: e.mail,
      angemeldet: sitzung.mail,
      kontoId: sitzung.kontoId,
      inhaberId: e.inhaberId,
      schonDabei,
      fuehrtSelbst,
      inhaberArbeitetWoanders: inhaberWoanders !== null,
    });
    if (hindernis) return json({ fehler: hindernis }, 409);

    const inhaber = await kontoNachId(e.inhaberId);
    if (!inhaber) return json({ fehler: 'Diese Einladung gilt nicht (mehr). Bitte um einen neuen Link.' }, 404);

    await einladungEinloesen(e.id, { id: sitzung.kontoId, name: sitzung.name });
    return json({ ok: true, weiter: '/zentrale' });
  } catch (e) {
    if ((e as Error)?.message === 'schon-woanders')
      return json({ fehler: 'Du bist gerade eben woanders beigetreten. Tritt dort zuerst aus.' }, 409);
    console.error('[pnkt] Einladung nicht annehmbar:', e);
    return json({ fehler: 'Das Annehmen hat nicht geklappt.' }, 503);
  }
};
