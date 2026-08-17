import {
  type Aussage,
  erzeugeEntwurf,
  feldwert,
  festeUhr,
  formatNachSchluessel,
  SchemaFehler,
  type Werkzeuge,
  zaehlerId,
} from '@studio/editor-core';
import { describe, expect, it } from 'vitest';
import {
  NichtGefunden,
  NochInVerwendung,
  SAMMLUNG_AUSSAGEN,
  SpeicherFehler,
  WixAussageSpeicher,
  WixEntwurfSpeicher,
} from '../src/index.js';
import { BlobDoppelgaenger, DatenDoppelgaenger, fremderMandant, mandant } from './doppelgaenger.js';

function aussage(ueberschreibung: Partial<Aussage> = {}): Aussage {
  return {
    id: 'aussage-1',
    organisationId: 'org-1',
    name: 'Sommerfest 2026',
    felder: {
      titel: feldwert('Sommerfest der Hauptverwaltung', 'Sommerfest 2026', 'Sommerfest'),
      ort: feldwert('Innenhof Gebäude C'),
    },
    termin: '2026-09-12T00:00:00.000Z',
    erstelltAm: '2026-01-01T00:00:00.000Z',
    geaendertAm: '2026-01-01T00:00:00.000Z',
    ...ueberschreibung,
  };
}

function werkzeuge(praefix = 'id'): Werkzeuge {
  return { neueId: zaehlerId(praefix), jetzt: festeUhr() };
}

function a4(): NonNullable<ReturnType<typeof formatNachSchluessel>> {
  const f = formatNachSchluessel('a4-hoch');
  if (f === null) throw new Error('Format a4-hoch fehlt');
  return f;
}

function aufbau() {
  const daten = new DatenDoppelgaenger();
  const speicher = new WixAussageSpeicher(daten);
  const entwuerfe = new WixEntwurfSpeicher(daten, new BlobDoppelgaenger());
  return { daten, speicher, entwuerfe };
}

describe('Aussagen sichern und laden', () => {
  it('gibt zurück, was hineingegangen ist', async () => {
    const { speicher } = aufbau();
    await speicher.sichere(mandant, aussage());

    const geladen = await speicher.lade(mandant, 'aussage-1');
    expect(geladen).toEqual(aussage());
  });

  it('legt Name und Termin als eigene Felder ab, nicht nur im JSON', async () => {
    // Wix Data kann nicht in ein JSON-Textfeld hineinsehen. Lägen sie nur dort,
    // könnte die Übersicht weder sortieren noch die abgelaufenen zeigen.
    const { daten, speicher } = aufbau();
    await speicher.sichere(mandant, aussage());

    const datensatz = daten.sammlungen.get(SAMMLUNG_AUSSAGEN)?.get('aussage-1');
    expect(datensatz?.['name']).toBe('Sommerfest 2026');
    expect(datensatz?.['termin']).toBe('2026-09-12T00:00:00.000Z');
  });

  it('lehnt eine Aussage ab, die einem anderen Mandanten gehört', async () => {
    const { speicher } = aufbau();
    await expect(speicher.sichere(fremderMandant, aussage())).rejects.toBeInstanceOf(
      SpeicherFehler,
    );
  });

  it('gibt eine fremde Aussage nicht heraus — auch nicht als „nicht gefunden" mit Inhalt', async () => {
    const { speicher } = aufbau();
    await speicher.sichere(mandant, aussage());
    await expect(speicher.lade(fremderMandant, 'aussage-1')).rejects.toBeInstanceOf(NichtGefunden);
  });

  it('meldet eine Aussage, die es nicht gibt', async () => {
    const { speicher } = aufbau();
    await expect(speicher.lade(mandant, 'gibt-es-nicht')).rejects.toBeInstanceOf(NichtGefunden);
  });

  it('prüft beim Laden gegen das Schema, statt Fremddaten durchzureichen', async () => {
    // Ein Datensatz kann in der Wix-Oberfläche von Hand bearbeitet worden sein.
    const { daten, speicher } = aufbau();
    await speicher.sichere(mandant, aussage());

    const sammlung = daten.sammlungen.get(SAMMLUNG_AUSSAGEN);
    const datensatz = sammlung?.get('aussage-1');
    if (sammlung === undefined || datensatz === undefined) throw new Error('Datensatz erwartet');
    // „kurz" länger als „lang" — die Stufenwahl käme nie dorthin.
    sammlung.set('aussage-1', {
      ...datensatz,
      felder: JSON.stringify({ titel: { lang: 'Kurz', mittel: null, kurz: 'Viel zu lang' } }),
    });

    await expect(speicher.lade(mandant, 'aussage-1')).rejects.toBeInstanceOf(SchemaFehler);
  });

  it('meldet kaputtes JSON als Speicherfehler, nicht als Absturz', async () => {
    const { daten, speicher } = aufbau();
    await speicher.sichere(mandant, aussage());

    const sammlung = daten.sammlungen.get(SAMMLUNG_AUSSAGEN);
    const datensatz = sammlung?.get('aussage-1');
    if (sammlung === undefined || datensatz === undefined) throw new Error('Datensatz erwartet');
    sammlung.set('aussage-1', { ...datensatz, felder: '{kaputt' });

    await expect(speicher.lade(mandant, 'aussage-1')).rejects.toBeInstanceOf(SpeicherFehler);
  });
});

describe('Übersicht', () => {
  it('listet nur die eigenen Aussagen, mit Termin', async () => {
    const { speicher } = aufbau();
    await speicher.sichere(mandant, aussage());
    await speicher.sichere(
      mandant,
      aussage({ id: 'aussage-2', name: 'Winterfeier', termin: null }),
    );
    await speicher.sichere(fremderMandant, aussage({ id: 'fremd', organisationId: 'org-2' }));

    const liste = await speicher.liste(mandant);
    expect(liste.map((a) => a.id).sort()).toEqual(['aussage-1', 'aussage-2']);
    expect(liste.find((a) => a.id === 'aussage-2')?.termin).toBeNull();
  });
});

describe('Löschen fragt zurück', () => {
  it('verweigert die Löschung, solange ein Entwurf darauf bindet', async () => {
    // Eine gelöschte Aussage lässt jede Ausspielung mit leeren Platzhaltern
    // zurück — sichtbar erst beim nächsten Öffnen.
    const { speicher, entwuerfe } = aufbau();
    await speicher.sichere(mandant, aussage());
    await entwuerfe.sichere(mandant, {
      ...erzeugeEntwurf({ organisationId: 'org-1', name: 'Plakat A1', format: a4() }, werkzeuge()),
      aussageId: 'aussage-1',
    });

    const fehler = await speicher.loesche(mandant, 'aussage-1').catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(NochInVerwendung);
    expect((fehler as NochInVerwendung).verwender.map((v) => v.name)).toEqual(['Plakat A1']);
    // Und die Aussage ist noch da.
    await expect(speicher.lade(mandant, 'aussage-1')).resolves.toBeDefined();
  });

  it('löscht, wenn nichts mehr daran hängt', async () => {
    const { speicher } = aufbau();
    await speicher.sichere(mandant, aussage());
    await speicher.loesche(mandant, 'aussage-1');
    await expect(speicher.lade(mandant, 'aussage-1')).rejects.toBeInstanceOf(NichtGefunden);
  });

  it('zählt Entwürfe fremder Mandanten nicht als Verwender', async () => {
    const { speicher, entwuerfe } = aufbau();
    await speicher.sichere(mandant, aussage());
    await entwuerfe.sichere(fremderMandant, {
      ...erzeugeEntwurf({ organisationId: 'org-2', name: 'Fremd', format: a4() }, werkzeuge('f')),
      aussageId: 'aussage-1',
    });

    await expect(speicher.loesche(mandant, 'aussage-1')).resolves.toBeUndefined();
  });

  it('meldet eine Aussage, die es nicht gibt', async () => {
    const { speicher } = aufbau();
    await expect(speicher.loesche(mandant, 'gibt-es-nicht')).rejects.toBeInstanceOf(NichtGefunden);
  });

  it('findet keinen Verwender, wenn der Entwurf gar nicht bindet', async () => {
    const { speicher, entwuerfe } = aufbau();
    await speicher.sichere(mandant, aussage());
    await entwuerfe.sichere(
      mandant,
      erzeugeEntwurf({ organisationId: 'org-1', name: 'Frei', format: a4() }, werkzeuge()),
    );

    expect(await speicher.verwendetVon(mandant, 'aussage-1')).toEqual([]);
  });
});

describe('Wenn Wix nicht mitspielt', () => {
  it('verpackt einen Schreibfehler als Speicherfehler', async () => {
    const daten = new DatenDoppelgaenger();
    daten.items.saveDataItem = async () => {
      throw new Error('WDE0025');
    };
    const speicher = new WixAussageSpeicher(daten);

    await expect(speicher.sichere(mandant, aussage())).rejects.toBeInstanceOf(SpeicherFehler);
  });

  it('verpackt einen Löschfehler als Speicherfehler', async () => {
    const daten = new DatenDoppelgaenger();
    const speicher = new WixAussageSpeicher(daten);
    await speicher.sichere(mandant, aussage());

    daten.items.removeDataItem = async () => {
      throw new Error('Zeitüberschreitung');
    };
    await expect(speicher.loesche(mandant, 'aussage-1')).rejects.toBeInstanceOf(SpeicherFehler);
  });

  it('nimmt die Felder auch als Objekt entgegen', async () => {
    // Wird die Sammlung in der Wix-Oberfläche als Objektfeld angelegt statt als
    // Text, kommt kein JSON-String zurück, sondern ein fertiges Objekt.
    const daten = new DatenDoppelgaenger();
    const speicher = new WixAussageSpeicher(daten);
    await speicher.sichere(mandant, aussage());

    const sammlung = daten.sammlungen.get(SAMMLUNG_AUSSAGEN);
    const datensatz = sammlung?.get('aussage-1');
    if (sammlung === undefined || datensatz === undefined) throw new Error('Datensatz erwartet');
    sammlung.set('aussage-1', {
      ...datensatz,
      felder: { titel: { lang: 'Sommerfest', mittel: null, kurz: null } },
    });

    const geladen = await speicher.lade(mandant, 'aussage-1');
    expect(geladen.felder.titel?.lang).toBe('Sommerfest');
  });

  it('lässt Lücken in einem Datensatz die Liste nicht sprengen', async () => {
    const daten = new DatenDoppelgaenger();
    const speicher = new WixAussageSpeicher(daten);
    await daten.items.saveDataItem(SAMMLUNG_AUSSAGEN, {
      _id: 'halb',
      organisationId: 'org-1',
    });

    const liste = await speicher.liste(mandant);
    expect(liste).toEqual([{ id: 'halb', name: '', geaendertAm: '', termin: null }]);
  });

  it('liest Verwender auch ohne Vorlagenangabe', async () => {
    const daten = new DatenDoppelgaenger();
    const speicher = new WixAussageSpeicher(daten);
    await daten.items.saveDataItem('Entwuerfe', {
      _id: 'e-1',
      organisationId: 'org-1',
      aussageId: 'aussage-1',
    });

    expect(await speicher.verwendetVon(mandant, 'aussage-1')).toEqual([
      { id: 'e-1', name: '', geaendertAm: '', vorlageId: null },
    ]);
  });
});
