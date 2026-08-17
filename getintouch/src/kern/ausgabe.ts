/**
 * Ausgabe — vCard und QR-Code als Antwort.
 *
 * Beides wird an zwei Stellen gebraucht: unter `/t/<name>/…` für die
 * veröffentlichte Seite und unter `/werkstatt/…` für einen Entwurf, den es noch
 * nicht gibt. Die Regeln — welches Format, welche Fehlerkorrektur, welche
 * Kopfzeilen — dürfen deshalb nicht zweimal irgendwo stehen.
 */

import QRCode from 'qrcode';

import { alsDatenadresse } from './bild.ts';
import type { Profil } from './profil.ts';
import { baueVcard, vcardDateiname } from './vcard.ts';

/**
 * Die eigene Herkunft, verlässlich. `Astro.url` taugt dafür nicht (siehe
 * `Umgebung.hier`), der `Host`-Kopf schon — er trägt Name und Port so, wie der
 * Aufruf tatsächlich hereinkam.
 */
export function herkunft(request: Request, ersatz: URL): URL {
  const host = request.headers.get('host');
  if (!host) return ersatz;
  try {
    return new URL(ersatz.pathname + ersatz.search, `${ersatz.protocol}//${host}`);
  } catch {
    return ersatz;
  }
}

export function fehlt(text: string): Response {
  return new Response(text, {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

export interface Umgebung {
  /** Adresse der Seite, die im QR-Code stehen soll. */
  seite: string;
  /**
   * Adresse des laufenden Aufrufs, aufgebaut aus dem `Host`-Kopf.
   *
   * Nicht aus `Astro.url` übernehmen: der gebaute Node-Server liefert dort
   * `http://localhost/` ohne Port, und ein relativer Bildpfad landet dann auf
   * Port 80 statt beim eigenen Dienst. Das Foto fehlte daraufhin stillschweigend
   * in der Visitenkarte.
   */
  hier: URL;
  /** Wie lange ein Zwischenspeicher die Antwort halten darf. */
  zwischenspeicher: string;
}

/**
 * Die Visitenkarte als Datei.
 *
 * Eine echte Adresse statt eines Blobs im Browser: ältere iOS-Versionen brechen
 * bei blob-Downloads ab, und ohne JavaScript gäbe es gar keine Karte.
 */
export async function vcardAntwort(profil: Profil, umgebung: Umgebung): Promise<Response> {
  if (!profil.visitenkarte) return fehlt('Für diese Seite gibt es keine Visitenkarte.');

  // Das Foto wird eingebettet, nicht verlinkt — siehe `bild.ts`.
  const bild = await alsDatenadresse(profil.kopf.bild, umgebung.hier);

  const vcard = baueVcard(profil.visitenkarte, { bild, seite: umgebung.seite, stand: new Date() });

  return new Response(vcard, {
    headers: {
      // charset gehört dazu: ohne sie landen Umlaute in manchen Adressbüchern
      // als Fragezeichen.
      'content-type': 'text/vcard; charset=utf-8',
      'content-disposition': `attachment; filename="${vcardDateiname(profil.visitenkarte)}"`,
      'cache-control': umgebung.zwischenspeicher,
    },
  });
}

/**
 * Der QR-Code als SVG.
 *
 * Fehlerkorrektur „M" ist der brauchbare Mittelweg — rund 15 % der Fläche
 * dürfen zerstört sein. „H" verträgt zwar 30 %, macht das Muster aber so dicht,
 * dass kleine Aufkleber schlechter gelesen werden statt besser.
 */
export async function qrAntwort(ziel: string, zwischenspeicher: string): Promise<Response> {
  const svg = await QRCode.toString(ziel, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    // Vier Module Ruhezone verlangt die Norm. Ohne sie finden viele Scanner
    // das Muster nicht, sobald es auf farbigem Grund sitzt.
    margin: 4,
    color: { dark: '#000000', light: '#FFFFFF' },
  });

  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': zwischenspeicher,
    },
  });
}
