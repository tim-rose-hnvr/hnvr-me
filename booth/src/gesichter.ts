/**
 * Gesichter finden — der Foto-Finder.
 *
 * Vierhundert Bilder durchzuscrollen, um die drei mit sich selbst zu finden,
 * macht niemand. Ein Selfie tut es in Sekunden. Der Preis dafür ist hoch:
 * Ein Gesicht ist ein biometrisches Merkmal nach Art. 9 DSGVO, und ein
 * Merkmal, das man nicht wechseln kann, verdient mehr Sorgfalt als ein
 * Kennwort.
 *
 * Deshalb sind hier drei Entscheidungen getroffen, bevor die erste Zeile
 * Code steht:
 *
 *  1. **Das Selfie verlässt das Handy nicht.** Nicht verschlüsselt, nicht
 *     „nur kurz zum Abgleich". Der Vergleich läuft AUF dem Gerät des Gastes:
 *     Die Box gibt die Merkmalsliste ihrer Aufnahmen heraus, das Handy
 *     rechnet sein eigenes Merkmal aus und vergleicht selbst. Zur Box geht
 *     eine Liste von Dateinamen — mehr nicht.
 *
 *  2. **Das Modell liegt auf der Box.** Sieben Megabyte, ausgeliefert mit
 *     dem Programm. Eine Fotobox steht in einer Scheune ohne Netz; ein
 *     Modell, das erst von einem fremden Server geladen wird, ist auf der
 *     Hälfte der Feiern nicht da — und verrät nebenbei jedem, der die
 *     Leitung sieht, dass hier Gesichter gesucht werden.
 *
 *  3. **Die Merkmalsliste stirbt mit den Fotos.** Sie ist kein zweiter
 *     Datenbestand, der die Löschfrist überlebt. Wird eine Aufnahme
 *     gelöscht, geht ihr Eintrag mit.
 *
 * Was das Modell tut: Es findet Gesichter (`tiny_face_detector`), richtet sie
 * an 68 Punkten aus (`face_landmark_68`) und beschreibt jedes mit 128 Zahlen
 * (`face_recognition`). Zwei Beschreibungen desselben Menschen liegen nah
 * beieinander, zwei verschiedener weit auseinander. Mehr ist es nicht — man
 * kann aus den 128 Zahlen kein Gesicht zurückrechnen, aber man kann damit
 * einen Menschen wiedererkennen, und genau das macht sie schützenswert.
 */

import * as gesicht from '@vladmandic/face-api';

/** Ein Merkmal: 128 Zahlen, die einen Menschen beschreiben. */
export type Merkmal = number[];

/**
 * Zwei Schwellen, nicht eine — und beide nachgemessen.
 *
 * Die Lehrbuchzahl für dieses Modell ist 0,6. Sie stammt aus Prüfreihen mit
 * frontalen Porträts bei gutem Licht. Auf Partybildern gilt sie nicht: Beim
 * Nachmessen an sechs Aufnahmen mit lauter VERSCHIEDENEN Menschen lag der
 * kleinste Abstand zwischen zwei Fremden bei **0,503** — bei 0,6 hätte der
 * Finder ihnen gegenseitig ihre Bilder gezeigt.
 *
 * Deshalb zwei Bänder:
 *
 *   · bis `SICHER` gilt als derselbe Mensch. Diese Bilder stehen als
 *     „deine Bilder" da und wandern ins Paket.
 *   · bis `VIELLEICHT` wird gezeigt, aber getrennt und ausdrücklich als
 *     unsicher. Der Gast entscheidet, nicht die Schwelle.
 *   · darüber gar nicht.
 *
 * Die Richtung ist mit Absicht streng. Ein fehlendes Bild ärgert; ein
 * fremdes Bild in „deinen Bildern" ist ein Datenschutzvorfall — dann hat
 * die Box einem Gast das Foto eines anderen gezeigt.
 */
export const SICHER = 0.45;
export const VIELLEICHT = 0.55;

/** Rückwärtsverträglich: wer nur eine Schwelle will, bekommt die strenge. */
export const SCHWELLE = SICHER;

const QUELLE = '/gesichtsmodell';
let geladen: Promise<void> | null = null;

/**
 * Lädt das Modell — einmal, und nur wenn es gebraucht wird.
 *
 * Sieben Megabyte gehören nicht in den Start einer Seite, die vielleicht nur
 * angesehen wird. Der Gast bekommt sie erst, wenn er auf „Meine Bilder
 * finden" tippt, und dann über das WLAN der Box, nicht über sein Datenvolumen.
 */
export function ladeModell(): Promise<void> {
  if (!geladen) {
    geladen = (async () => {
      await gesicht.nets.tinyFaceDetector.loadFromUri(QUELLE);
      await gesicht.nets.faceLandmark68Net.loadFromUri(QUELLE);
      await gesicht.nets.faceRecognitionNet.loadFromUri(QUELLE);
    })().catch((fehler) => {
      // Beim nächsten Versuch neu laden, statt den Fehlschlag zu merken.
      geladen = null;
      throw fehler;
    });
  }
  return geladen;
}

/** Läuft das Modell schon? Für Oberflächen, die sonst „Lade …" zeigen. */
export function modellBereit(): boolean {
  return gesicht.nets.faceRecognitionNet.isLoaded;
}

type Bildquelle = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

/**
 * Alle Gesichter in einem Bild, je eines als Merkmal.
 *
 * Ein Gruppenbild bringt mehrere zurück — und genau darauf beruht der
 * Nutzen: Der Gast, der bei Bild 212 nur am Rand steht, findet es trotzdem.
 */
export async function merkmale(quelle: Bildquelle): Promise<Merkmal[]> {
  await ladeModell();
  const gefunden = await gesicht
    .detectAllFaces(quelle, new gesicht.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.45 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  return gefunden.map((g) => Array.from(g.descriptor));
}

/**
 * Das EINE Gesicht eines Selfies.
 *
 * Beim Suchbild ist mehr als ein Gesicht ein Problem, kein Gewinn: Steht
 * jemand im Hintergrund, suchte die Box am Ende nach dem Falschen. Deshalb
 * wird hier bewusst nur das größte genommen — das ist das, dessentwegen das
 * Selfie gemacht wurde.
 */
export async function suchmerkmal(quelle: Bildquelle): Promise<Merkmal | null> {
  await ladeModell();
  const gefunden = await gesicht
    .detectSingleFace(quelle, new gesicht.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return gefunden ? Array.from(gefunden.descriptor) : null;
}

/**
 * Abstand zweier Merkmale. Klein heißt ähnlich.
 *
 * Der euklidische Abstand im 128-dimensionalen Raum — genau das Maß, für das
 * das Modell trainiert wurde. Etwas anderes zu nehmen (Kosinus etwa) wäre
 * nicht falsch, aber die Schwelle 0,6 gälte dann nicht mehr.
 */
export function abstand(a: Merkmal, b: Merkmal): number {
  let summe = 0;
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    summe += d * d;
  }
  return Math.sqrt(summe);
}

/** Ein Eintrag der Merkmalsliste, wie die Box sie herausgibt. */
export type Eintrag = { datei: string; merkmale: Merkmal[] };

/** Ein Treffer: die Aufnahme, der Abstand und in welchem Band er liegt. */
export type Treffer = { datei: string; abstand: number; sicher: boolean };

/**
 * Vergleicht das Suchmerkmal mit der ganzen Liste — auf dem Gerät des Gastes.
 *
 * Je Aufnahme zählt das ÄHNLICHSTE Gesicht darin: Auf einem Gruppenbild mit
 * acht Leuten soll der eine, der gesucht wird, das Bild in die Trefferliste
 * bringen, nicht die sieben anderen es hinausdrängen.
 *
 * Sortiert wird nach Abstand, sicherster Treffer zuerst — so steht ganz oben,
 * was der Gast erwartet, und die Zweifelsfälle stehen unten, wo sie niemanden
 * stören.
 */
export function suche(such: Merkmal, liste: Eintrag[], schwelle = VIELLEICHT): Treffer[] {
  const treffer: Treffer[] = [];
  for (const eintrag of liste) {
    let bester = Infinity;
    for (const m of eintrag.merkmale) {
      const d = abstand(such, m);
      if (d < bester) bester = d;
    }
    if (bester <= schwelle) {
      treffer.push({ datei: eintrag.datei, abstand: bester, sicher: bester <= SICHER });
    }
  }
  return treffer.sort((a, b) => a.abstand - b.abstand);
}

/**
 * Merkmale einer Aufnahme rechnen und zur Box schicken.
 *
 * Läuft im Booth, gleich nachdem eine Aufnahme abgelegt wurde — dort liegt
 * das Blatt ohnehin im Speicher. Fehlschläge sind still: Ein Gast, dessen
 * Bild gerade gedruckt wird, hat mit der Merkmalsliste nichts zu tun, und
 * ein fehlender Eintrag lässt sich nachtragen.
 */
export async function merkeGesichter(
  datei: string,
  quelle: HTMLCanvasElement | HTMLImageElement
): Promise<number> {
  try {
    const gefunden = await merkmale(quelle);
    const antwort = await fetch(`/api/gesichter/${encodeURIComponent(datei)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merkmale: gefunden }),
    });
    return antwort.ok ? gefunden.length : 0;
  } catch {
    return 0;
  }
}
