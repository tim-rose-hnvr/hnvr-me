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
import { anmelden, ausweisKeks, ausweisLoeschen, sitzungAus } from './konto.ts';
import { codesVonKonto, zielSetzen } from './ablage.ts';

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
  // von überall her. Erlaubt ist, was ein Telefon nach dem Scannen auch
  // öffnen soll — kein javascript:, kein data:.
  const erlaubt = /^https?:\/\/\S+$/i.test(ziel) || /^(mailto|tel):\S+$/i.test(ziel);
  if (!erlaubt) return json({ fehler: 'Das Ziel muss mit http://, https://, mailto: oder tel: beginnen.' }, 400);

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
