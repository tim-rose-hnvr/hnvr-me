/**
 * Dateien im Wix Media Manager.
 *
 * Der Weg ist zweistufig und nicht abkürzbar: erst eine signierte Upload-URL
 * anfordern, dann die Datei dorthin schicken. Wix weist ausdrücklich darauf hin,
 * dass eine hochgeladene Datei nicht sofort verfügbar ist — sie wird noch
 * verarbeitet. Für ausgelagerte Entwurfsinhalte ist das unkritisch, für
 * Bildvorschauen im Editor nicht: dort muss die Oberfläche mit einem
 * Platzhalter arbeiten, bis die Datei bereit ist.
 *
 * Kundendateien werden `private: true` abgelegt. Ein Entwurf einer Organisation
 * darf nicht über eine geratene URL bei einer anderen landen.
 */

import { SpeicherFehler, type BlobSpeicher, type Mandant } from './speicher.js';
import type { Netzzugriff, WixMedienClient } from './wixApi.js';

export interface WixBlobSpeicherOptionen {
  /** Ordner je Organisation. Ohne Angabe landet alles im Wurzelordner. */
  ordnerFuer?: (mandant: Mandant) => string | undefined;
  netz?: Netzzugriff;
}

export class WixBlobSpeicher implements BlobSpeicher {
  readonly #medien: WixMedienClient;
  readonly #netz: Netzzugriff;
  readonly #ordnerFuer: (mandant: Mandant) => string | undefined;
  /** Merkt sich die URL je id, damit `liesText` nicht erneut auflösen muss. */
  readonly #urls = new Map<string, string>();

  constructor(medien: WixMedienClient, optionen: WixBlobSpeicherOptionen = {}) {
    this.#medien = medien;
    this.#netz = optionen.netz ?? globalThis.fetch.bind(globalThis);
    this.#ordnerFuer = optionen.ordnerFuer ?? (() => undefined);
  }

  async schreibe(
    mandant: Mandant,
    name: string,
    mimeTyp: string,
    daten: Blob,
  ): Promise<{ id: string; url: string }> {
    const ordner = this.#ordnerFuer(mandant);

    let uploadUrl: string;
    try {
      const antwort = await this.#medien.files.generateFileUploadUrl(mimeTyp, {
        fileName: name,
        private: true,
        labels: [`org:${mandant.organisationId}`],
        ...(ordner === undefined ? {} : { parentFolderId: ordner }),
      });
      uploadUrl = antwort.uploadUrl;
    } catch (ursache) {
      throw new SpeicherFehler(`Upload-URL für "${name}" nicht erhalten`, ursache);
    }

    const antwort = await this.#netz(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mimeTyp },
      body: daten,
    });

    if (!antwort.ok) {
      throw new SpeicherFehler(
        `Upload von "${name}" scheiterte mit ${antwort.status} ${antwort.statusText}`,
      );
    }

    const ergebnis = (await antwort.json()) as { file?: { id?: string; url?: string } };
    const id = ergebnis.file?.id;
    const url = ergebnis.file?.url;
    if (typeof id !== 'string' || typeof url !== 'string') {
      throw new SpeicherFehler(`Upload von "${name}" lieferte keine verwertbare Dateikennung`);
    }

    this.#urls.set(id, url);
    return { id, url };
  }

  async liesText(id: string): Promise<string> {
    const url = this.#urls.get(id) ?? id;
    const antwort = await this.#netz(url);
    if (!antwort.ok) {
      throw new SpeicherFehler(
        `Datei "${id}" nicht lesbar: ${antwort.status} ${antwort.statusText}`,
      );
    }
    return await antwort.text();
  }

  async loesche(id: string): Promise<void> {
    // Wix bietet dafür `media.files.bulkDeleteFiles`. Der Aufruf braucht
    // Verwaltungsrechte, die eine Besuchersitzung nicht hat — Löschen gehört
    // deshalb in eine Serverfunktion und wird hier bewusst nicht ausgeführt.
    // Bis dahin bleibt eine verwaiste Datei liegen; das kostet Speicher, aber
    // niemals Daten. Siehe apps/studio, sobald es das Backend gibt.
    this.#urls.delete(id);
    return Promise.resolve();
  }
}
