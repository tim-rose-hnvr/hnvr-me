/**
 * Wohin eine Nachricht geht.
 *
 * Nimmt das Formular des Nachricht-Bausteins entgegen, prüft es im Kern und
 * legt es in der Collection `GetInTouchNachricht` ab. Danach wird umgeleitet —
 * ein `303` nach dem POST, damit ein Neuladen die Nachricht nicht ein zweites
 * Mal abschickt (Post/Redirect/Get).
 *
 * Gelesen werden die Nachrichten heute im Wix-Dashboard. Ein eigener Eingang
 * mit Zuweisung und Antwort gehört zum Konto-Bereich und steht noch nicht —
 * aber lieber ein Eingang, der zwar schlicht, dafür echt ist, als ein Formular,
 * das ins Leere sendet.
 */

import type { APIRoute } from 'astro';

import { pruefeEingang } from '../../../kern/nachricht.ts';
import type { Nachrichtblock } from '../../../kern/profil.ts';
import { ablage } from '../../../kern/speicher/index.ts';

export const prerender = false;

const COLLECTION = 'GetInTouchNachricht';

function zurueck(slug: string, stand: string): Response {
  return new Response(null, {
    status: 303,
    headers: { location: `/t/${slug}?nachricht=${encodeURIComponent(stand)}#nachricht` },
  });
}

export const POST: APIRoute = async ({ params, request }) => {
  const slug = (params.slug ?? '').toLowerCase();
  const profil = slug ? await ablage().hole(slug) : null;
  if (!profil) return new Response('Diese Seite gibt es nicht.', { status: 404 });

  const block = profil.bloecke.find((b): b is Nachrichtblock => b.art === 'nachricht' && b.aktiv);
  if (!block) return new Response('Diese Seite nimmt keine Nachrichten entgegen.', { status: 404 });

  /**
   * Zwei Wege herein, und der Grund dafür ist der Host.
   *
   * Die Auslieferung von Wix weist formularkodierte POSTs pauschal ab —
   * „Cross-site POST form submissions are forbidden", auch bei gesetztem
   * `Origin` und gleicher Herkunft. JSON lässt sie durch. Deshalb schickt das
   * Formular sein Bündel per Skript als JSON, und der klassische Weg bleibt
   * trotzdem stehen: auf einem Host ohne diese Sperre funktioniert er, und
   * hier kostet er nichts.
   */
  let form: FormData;
  const art = (request.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  try {
    if (art === 'application/json') {
      const roh = (await request.json()) as Record<string, unknown>;
      form = new FormData();
      for (const [k, v] of Object.entries(roh)) if (typeof v === 'string') form.set(k, v);
    } else {
      form = await request.formData();
    }
  } catch {
    return zurueck(slug, 'Das Formular kam unvollständig an. Bitte noch einmal versuchen.');
  }

  const ergebnis = pruefeEingang(block, form, Date.now());
  if (!ergebnis.ok) return zurueck(slug, ergebnis.meldung);

  try {
    /**
     * Mit erhöhten Rechten schreiben.
     *
     * Die Collection darf nur die Verwaltung beschreiben, und das ist Absicht:
     * stünde sie für jeden offen, könnte jeder direkt in die Datenbank
     * schreiben, ohne je dieses Formular zu sehen — samt aller Prüfungen
     * darüber. Der Weg hinein führt deshalb ausschließlich über diese Route,
     * die dafür einmal die Rechte anhebt. Nach der Prüfung, nie davor.
     */
    const { items } = (await import('@wix/data')) as {
      items: { insert(collection: string, eintrag: Record<string, unknown>): Promise<unknown> };
    };
    const { auth } = (await import('@wix/essentials')) as {
      auth: { elevate<T extends (...a: never[]) => unknown>(f: T): T };
    };
    await auth.elevate(items.insert)(COLLECTION, {
      slug,
      ...ergebnis.eingang,
      // Der Stand der Bearbeitung. Mehr Zustände kommen mit dem Eingang.
      erledigt: false,
    });
  } catch (fehler) {
    // Nicht still verschlucken: eine verlorene Anfrage ist ein verlorener Kunde.
    console.error(`[getintouch] Nachricht an „${slug}" nicht speicherbar:`, fehler);
    return zurueck(slug, 'Das Speichern hat nicht geklappt. Bitte versuch es gleich noch einmal.');
  }

  return zurueck(slug, 'gut');
};

/** Ein GET auf diese Adresse ist kein Fehler des Besuchers, sondern ein Umweg. */
export const GET: APIRoute = ({ params }) =>
  new Response(null, { status: 303, headers: { location: `/t/${params.slug ?? ''}` } });
