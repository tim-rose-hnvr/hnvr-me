/**
 * Aussagen in Wix Data.
 *
 * Anders als beim Entwurf gibt es hier **keine Auslagerung**: eine Aussage ist
 * eine Handvoll Textfelder und bleibt um Größenordnungen unter der 512-KB-Grenze
 * eines Datensatzes. Wer hier Auslagerungslogik einbaut, baut Komplexität für
 * einen Fall, den es nicht gibt.
 *
 * ## Warum die Felder flach im Datensatz stehen
 *
 * Wix Data kann nach Feldern filtern und sortieren, aber nicht in ein
 * JSON-Textfeld hineinsehen. Stünde die Aussage als ein Klumpen JSON im
 * Datensatz, könnte die Übersicht weder nach Termin sortieren noch die
 * abgelaufenen zeigen. Deshalb liegen `name`, `termin` und `geaendertAm` als
 * eigene Felder daneben; nur die Feldwerte selbst sind JSON, weil in ihnen nie
 * gesucht wird.
 *
 * ## Löschen ist gefährlich, deshalb fragt es zurück
 *
 * Eine gelöschte Aussage lässt jede Ausspielung zurück, die auf sie bindet —
 * mit leeren Platzhaltern, und zwar erst sichtbar beim nächsten Öffnen. Der
 * Speicher lehnt die Löschung deshalb ab, solange Entwürfe daran hängen.
 */

import { type Aussage, ladeAussage } from '@studio/editor-core';
import {
  type AussagenKurzfassung,
  type AussageSpeicher,
  type Kurzfassung,
  type Mandant,
  NichtGefunden,
  NochInVerwendung,
  type Seitenabfrage,
  SpeicherFehler,
} from './speicher.js';
import type { WixDatenClient, WixDatensatz } from './wixApi.js';

export const SAMMLUNG_AUSSAGEN = 'Aussagen';
export const SAMMLUNG_ENTWUERFE_STANDARD = 'Entwuerfe';

interface AussageDatensatz extends WixDatensatz {
  _id: string;
  organisationId: string;
  name: string;
  /** ISO-Datum oder `null`. Eigenes Feld, damit danach sortiert werden kann. */
  termin: string | null;
  geaendertAm: string;
  erstelltAm: string;
  /** JSON der Felder. In ihnen wird nie gesucht, deshalb reicht ein Klumpen. */
  felder: string;
}

export interface WixAussageSpeicherOptionen {
  sammlung?: string;
  /** Sammlung der Entwürfe — für die Verwendungsprüfung beim Löschen. */
  entwurfsSammlung?: string;
}

export class WixAussageSpeicher implements AussageSpeicher {
  readonly #daten: WixDatenClient;
  readonly #sammlung: string;
  readonly #entwuerfe: string;

  constructor(daten: WixDatenClient, optionen: WixAussageSpeicherOptionen = {}) {
    this.#daten = daten;
    this.#sammlung = optionen.sammlung ?? SAMMLUNG_AUSSAGEN;
    this.#entwuerfe = optionen.entwurfsSammlung ?? SAMMLUNG_ENTWUERFE_STANDARD;
  }

  async sichere(mandant: Mandant, aussage: Aussage): Promise<void> {
    if (aussage.organisationId !== mandant.organisationId) {
      throw new SpeicherFehler(
        `Aussage gehört zu "${aussage.organisationId}", gespeichert wird für "${mandant.organisationId}"`,
      );
    }

    const datensatz: AussageDatensatz = {
      _id: aussage.id,
      organisationId: aussage.organisationId,
      name: aussage.name,
      termin: aussage.termin,
      geaendertAm: aussage.geaendertAm,
      erstelltAm: aussage.erstelltAm,
      felder: JSON.stringify(aussage.felder),
    };

    try {
      await this.#daten.items.saveDataItem(this.#sammlung, datensatz);
    } catch (ursache) {
      throw new SpeicherFehler(`Aussage "${aussage.id}" ließ sich nicht sichern`, ursache);
    }
  }

  async lade(mandant: Mandant, aussageId: string): Promise<Aussage> {
    const datensatz = await this.#hole(mandant, aussageId);
    if (datensatz === null) throw new NichtGefunden('Aussage', aussageId);

    const rohFelder = datensatz['felder'];
    let felder: unknown;
    try {
      felder = typeof rohFelder === 'string' ? JSON.parse(rohFelder) : rohFelder;
    } catch (ursache) {
      throw new SpeicherFehler(`Aussage "${aussageId}" enthält kein gültiges JSON`, ursache);
    }

    // Bewusst durch die Schemaprüfung: gespeicherte Daten sind Fremddaten, auch
    // wenn sie aus dem eigenen Backend kommen. Ein Datensatz kann von Hand in
    // der Wix-Oberfläche bearbeitet worden sein.
    const aussage = ladeAussage({
      id: datensatz['_id'],
      organisationId: datensatz['organisationId'],
      name: datensatz['name'],
      felder,
      termin: datensatz['termin'] ?? null,
      erstelltAm: datensatz['erstelltAm'],
      geaendertAm: datensatz['geaendertAm'],
    });

    if (aussage.organisationId !== mandant.organisationId) {
      throw new NichtGefunden('Aussage', aussageId);
    }
    return aussage;
  }

  async loesche(mandant: Mandant, aussageId: string): Promise<void> {
    const datensatz = await this.#hole(mandant, aussageId);
    if (datensatz === null) throw new NichtGefunden('Aussage', aussageId);

    const verwender = await this.verwendetVon(mandant, aussageId);
    if (verwender.length > 0) throw new NochInVerwendung('Aussage', aussageId, verwender);

    try {
      await this.#daten.items.removeDataItem(this.#sammlung, aussageId);
    } catch (ursache) {
      throw new SpeicherFehler(`Aussage "${aussageId}" ließ sich nicht löschen`, ursache);
    }
  }

  async liste(mandant: Mandant, abfrage: Seitenabfrage = {}): Promise<AussagenKurzfassung[]> {
    const antwort = await this.#daten.items.queryDataItems(this.#sammlung, {
      query: {
        filter: { organisationId: mandant.organisationId },
        sort: [{ fieldName: 'geaendertAm', order: 'DESC' }],
        paging: { limit: abfrage.limit ?? 50, offset: abfrage.offset ?? 0 },
      },
    });

    return this.#datensaetze(antwort).map((d) => ({
      id: String(d['_id'] ?? ''),
      name: String(d['name'] ?? ''),
      geaendertAm: String(d['geaendertAm'] ?? ''),
      termin: typeof d['termin'] === 'string' ? d['termin'] : null,
    }));
  }

  async verwendetVon(mandant: Mandant, aussageId: string): Promise<Kurzfassung[]> {
    const antwort = await this.#daten.items.queryDataItems(this.#entwuerfe, {
      query: {
        filter: { organisationId: mandant.organisationId, aussageId },
        // Deckel bei 100: für die Entscheidung „darf gelöscht werden?" genügt
        // ein einziger Treffer, und die Fehlermeldung soll nicht dreihundert
        // Namen aufzählen. Wer die vollständige Liste braucht, blättert selbst.
        paging: { limit: 100 },
      },
    });

    return this.#datensaetze(antwort).map((d) => ({
      id: String(d['_id'] ?? ''),
      name: String(d['name'] ?? ''),
      geaendertAm: String(d['geaendertAm'] ?? ''),
      vorlageId: typeof d['vorlageId'] === 'string' ? d['vorlageId'] : null,
    }));
  }

  async #hole(mandant: Mandant, aussageId: string): Promise<WixDatensatz | null> {
    const antwort = await this.#daten.items.queryDataItems(this.#sammlung, {
      query: {
        filter: { _id: aussageId, organisationId: mandant.organisationId },
        paging: { limit: 1 },
      },
    });
    return this.#datensaetze(antwort)[0] ?? null;
  }

  #datensaetze(antwort: { dataItems?: { data?: WixDatensatz }[] }): WixDatensatz[] {
    return (antwort.dataItems ?? [])
      .map((eintrag) => eintrag.data)
      .filter((d): d is WixDatensatz => d !== undefined);
  }
}
