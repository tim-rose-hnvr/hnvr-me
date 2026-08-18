/**
 * Was passiert, wenn jemand einen gedruckten Code scannt.
 *
 * Diese Datei ist der Grund, warum es das ganze System gibt. Alles
 * andere — Werkstatt, Zentrale, Zahlen — hängt daran, dass diese
 * dreißig Zeilen zuverlässig antworten. Ein Aufsteller auf einem Tisch
 * fragt hier an, und er fragt vielleicht noch in fünf Jahren.
 *
 * Sie war zwischenzeitlich weg: beim Ausliefern der neuen Seiten wurde
 * die alte Anwendung ersetzt, und /r/… antwortete mit 404, obwohl die
 * Codes in der Datenbank standen. Deshalb steht hier mehr Sorgfalt als
 * die Länge vermuten lässt.
 *
 * Drei Fälle, drei Antworten:
 *
 *   Code da und aktiv      302 auf das Ziel, ein Zähler hoch
 *   Code gelöscht/gesperrt 410 mit einer lesbaren Seite — nicht 404:
 *                          es gab ihn, das Kürzel bleibt vergeben
 *   Kürzel unbekannt       404 mit einer lesbaren Seite
 *
 * Gezählt wird NACH der Entscheidung und ohne den Besucher warten zu
 * lassen: die Weiterleitung ist das Versprechen, der Zähler ist Komfort.
 * Fällt die Zählung aus, wird trotzdem weitergeleitet.
 */

import type { APIRoute } from 'astro';
import { codeNachKuerzel, zaehle, klassen } from './ablage.ts';

export const prerender = false;

const seite = (titel: string, text: string, code: number) =>
  new Response(
    `<!doctype html><html lang="de"><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${titel}</title><style>` +
      `body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5ead8;color:#201e1d;` +
      `font:16px/1.6 system-ui,sans-serif;padding:24px}` +
      `div{max-width:32rem;text-align:center}h1{font-size:24px;margin:0 0 10px}` +
      `p{margin:0;color:rgba(32,30,29,.72)}</style>` +
      `<div><h1>${titel}</h1><p>${text}</p></div>`,
    { status: code, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );

export const GET: APIRoute = async ({ params, request }) => {
  const kuerzel = (params.kuerzel ?? '').trim();
  if (!kuerzel) return seite('Kein Code angegeben', 'Diese Adresse braucht ein Kürzel.', 400);

  let code = null;
  try {
    code = await codeNachKuerzel(kuerzel);
  } catch (fehler) {
    console.error(`[pnkt] Kürzel „${kuerzel}" nicht nachschlagbar:`, fehler);
    return seite(
      'Gerade nicht erreichbar',
      'Der Code ist in Ordnung, nur die Datenbank antwortet nicht. Bitte gleich noch einmal versuchen.',
      503,
    );
  }

  if (!code) {
    return seite(
      'Diesen Code gibt es nicht',
      `Das Kürzel „${kuerzel}" ist hier nicht vergeben. Vertippt? Oder gehört der Code zu einer anderen Adresse?`,
      404,
    );
  }

  if (code.geloescht || !code.aktiv || !code.ziel) {
    return seite(
      'Dieser Code ist stillgelegt',
      code.gesperrtWegen ||
        'Er wurde von seinem Besitzer abgeschaltet. Das Kürzel bleibt dauerhaft vergeben und wird nie neu verteilt.',
      410,
    );
  }

  // Erst antworten, dann zählen. Die Zählung darf die Weiterleitung
  // weder verzögern noch verhindern.
  const zaehlung = zaehle(code.id, klassen(request.headers)).catch((fehler) => {
    console.error(`[pnkt] Zähler für „${kuerzel}" nicht erhöht:`, fehler);
  });

  // In der Wix-Laufzeit endet der Vorgang mit der Antwort; ein
  // abgeschicktes Versprechen ohne await wird dort abgeschnitten.
  // Deshalb wird gewartet — es ist eine Schreiboperation, keine Reise.
  await zaehlung;

  return new Response(null, {
    status: 302,
    headers: {
      location: code.ziel,
      // Kein Zwischenspeicher: das Ziel kann sich jederzeit ändern, und
      // genau dafür ist der Code da. Ein gecachter 302 würde die
      // Änderung für Stunden aussperren.
      'cache-control': 'no-store, max-age=0',
      'referrer-policy': 'no-referrer',
    },
  });
};
