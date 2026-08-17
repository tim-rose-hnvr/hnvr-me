/**
 * Dateien im Wix Media Manager.
 *
 * ## Der Fallstrick mit privaten Dateien
 *
 * Kundendateien werden `private: true` abgelegt — ein Entwurf einer
 * Organisation darf nicht über eine geratene URL bei einer anderen landen.
 * Damit gilt aber laut Wix-Dokumentation:
 *
 * > `yourFile.url`: Has a URL value, but it returns a 403 (unauthorized)
 * > response, meaning it won't work.
 *
 * Die beim Hochladen zurückgegebene URL ist für private Dateien also **wertlos
 * zum Lesen**. Der einzige Weg führt über `generateFileDownloadUrl`, das eine
 * befristete Download-URL ausstellt (Vorgabe 600 Minuten).
 * https://dev.wix.com/docs/api-reference/assets/media/media-manager/files/private-files
 *
 * ## Und der Fallstrick daran
 *
 * `generateFileDownloadUrl` verlangt `SCOPE.DC-MEDIA.MANAGE-MEDIAMANAGER`.
 * Eine Besuchersitzung im Browser hat den nicht. Im Frontend muss die Auflösung
 * deshalb über eine eigene Serverfunktion laufen, die die Mandantengrenze prüft
 * und den Aufruf mit erhöhten Rechten ausführt. Genau dafür ist
 * `downloadUrlAufloeser` da: im Backend die SDK-Vorgabe, im Browser der Aufruf
 * des eigenen Endpunkts.
 */

import { type Blobreferenz, type BlobSpeicher, type Mandant, SpeicherFehler } from './speicher.js';
import type { Netzzugriff, WixMedienClient } from './wixApi.js';

/** Löst eine Datei-id in eine lesbare, befristete URL auf. */
export type DownloadUrlAufloeser = (dateiId: string) => Promise<string>;

export interface WixBlobSpeicherOptionen {
  /** Ordner je Organisation. Ohne Angabe landet alles im Wurzelordner. */
  ordnerFuer?: (mandant: Mandant) => string | undefined;
  netz?: Netzzugriff;
  /**
   * Vorgabe ist der direkte SDK-Aufruf, der erhöhte Rechte braucht. Im Browser
   * hier den Aufruf der eigenen Serverfunktion einsetzen.
   */
  downloadUrlAufloeser?: DownloadUrlAufloeser;
  /** Gültigkeitsdauer der Download-URL in Minuten. Wix-Vorgabe ist 600. */
  gueltigkeitMinuten?: number;
}

export class WixBlobSpeicher implements BlobSpeicher {
  readonly #medien: WixMedienClient;
  readonly #netz: Netzzugriff;
  readonly #ordnerFuer: (mandant: Mandant) => string | undefined;
  readonly #aufloeser: DownloadUrlAufloeser;

  constructor(medien: WixMedienClient, optionen: WixBlobSpeicherOptionen = {}) {
    this.#medien = medien;
    this.#netz = optionen.netz ?? globalThis.fetch.bind(globalThis);
    this.#ordnerFuer = optionen.ordnerFuer ?? (() => undefined);
    this.#aufloeser =
      optionen.downloadUrlAufloeser ??
      ((dateiId) => this.#downloadUrlUeberSdk(dateiId, optionen.gueltigkeitMinuten));
  }

  async schreibe(
    mandant: Mandant,
    name: string,
    mimeTyp: string,
    daten: Blob,
  ): Promise<Blobreferenz> {
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
    if (typeof id !== 'string' || id === '') {
      throw new SpeicherFehler(`Upload von "${name}" lieferte keine verwertbare Dateikennung`);
    }

    // Die url wird mitgeführt, aber bei privaten Dateien nie zum Lesen benutzt.
    return { id, url: typeof ergebnis.file?.url === 'string' ? ergebnis.file.url : '' };
  }

  async liesText(referenz: Blobreferenz): Promise<string> {
    if (referenz.id === '') {
      throw new SpeicherFehler('Blobreferenz ohne id ist nicht lesbar');
    }

    const url = await this.#aufloeser(referenz.id);
    const antwort = await this.#netz(url);

    if (antwort.status === 403) {
      throw new SpeicherFehler(
        `Datei "${referenz.id}" antwortet mit 403. Bei privaten Dateien ist das der Hinweis, ` +
          'dass eine dauerhafte URL statt einer befristeten Download-URL benutzt wurde.',
      );
    }
    if (!antwort.ok) {
      throw new SpeicherFehler(
        `Datei "${referenz.id}" nicht lesbar: ${antwort.status} ${antwort.statusText}`,
      );
    }
    return await antwort.text();
  }

  async loesche(referenz: Blobreferenz): Promise<void> {
    // Wix bietet dafür `media.files.bulkDeleteFiles`. Der Aufruf braucht
    // dieselben erhöhten Rechte wie das Auflösen der Download-URL und gehört
    // deshalb in dieselbe Serverfunktion. Bis die steht, bleibt eine verwaiste
    // Datei liegen — das kostet Speicher, aber niemals Daten.
    void referenz;
    return Promise.resolve();
  }

  async #downloadUrlUeberSdk(dateiId: string, gueltigkeitMinuten?: number): Promise<string> {
    const aufrufen = this.#medien.files.generateFileDownloadUrl;
    if (aufrufen === undefined) {
      throw new SpeicherFehler(
        `Für "${dateiId}" wird eine Download-URL gebraucht, aber der Medienclient bietet ` +
          'kein generateFileDownloadUrl. Im Browser einen downloadUrlAufloeser übergeben, ' +
          'der die eigene Serverfunktion aufruft.',
      );
    }

    let antwort: { downloadUrls?: { url?: string; assetKey?: string }[] };
    try {
      antwort = await aufrufen.call(this.#medien.files, dateiId, {
        contentDisposition: 'INLINE',
        ...(gueltigkeitMinuten === undefined ? {} : { expirationInMinutes: gueltigkeitMinuten }),
      });
    } catch (ursache) {
      throw new SpeicherFehler(`Download-URL für "${dateiId}" nicht erhalten`, ursache);
    }

    const url = antwort.downloadUrls?.[0]?.url;
    if (typeof url !== 'string' || url === '') {
      throw new SpeicherFehler(`Download-URL für "${dateiId}" kam leer zurück`);
    }
    return url;
  }
}
