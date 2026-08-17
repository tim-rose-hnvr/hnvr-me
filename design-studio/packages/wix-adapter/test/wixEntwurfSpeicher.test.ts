import {
  type Entwurf,
  erzeugeEntwurf,
  erzeugeText,
  festeUhr,
  formatNachSchluessel,
  type Werkzeuge,
  zaehlerId,
} from '@studio/editor-core';
import { describe, expect, it } from 'vitest';
import {
  NichtGefunden,
  SpeicherFehler,
  WIX_DATENSATZ_GRENZE,
  WixEntwurfSpeicher,
} from '../src/index.js';
import { BlobDoppelgaenger, DatenDoppelgaenger, fremderMandant, mandant } from './doppelgaenger.js';

function werkzeuge(praefix = 'id'): Werkzeuge {
  return { neueId: zaehlerId(praefix), jetzt: festeUhr() };
}

function a4(): NonNullable<ReturnType<typeof formatNachSchluessel>> {
  const f = formatNachSchluessel('a4-hoch');
  if (f === null) throw new Error('Format a4-hoch fehlt');
  return f;
}

function entwurf(name = 'Aushang', w = werkzeuge()): Entwurf {
  return erzeugeEntwurf({ organisationId: 'org-1', name, format: a4() }, w);
}

function mitElementen(anzahl: number, praefix = 'gross'): Entwurf {
  const w = werkzeuge(praefix);
  const basis = entwurf('Groß', w);
  const seite = basis.seiten[0]!;
  const elemente = Array.from({ length: anzahl }, (_, i) =>
    erzeugeText(
      { x: i, y: i, breite: 200, hoehe: 40 },
      `Zeile ${i} mit reichlich Text, damit der Datensatz wirklich groß wird`,
      {},
      w,
    ),
  );
  return { ...basis, seiten: [{ ...seite, elemente }] };
}

function jsonBytes(wert: unknown): number {
  return new TextEncoder().encode(JSON.stringify(wert)).length;
}

/**
 * Die meisten Tests setzen die Schwelle künstlich herunter. Das prüft den
 * Auslagerungsweg, ohne in jedem Testlauf ein halbes Megabyte zu erzeugen —
 * dass die echte Schwelle bei realistischer Größe greift, prüft ein eigener Test.
 */
function aufbau(auslagerungsschwelle?: number) {
  const daten = new DatenDoppelgaenger();
  const blobs = new BlobDoppelgaenger();
  const optionen = auslagerungsschwelle === undefined ? {} : { auslagerungsschwelle };
  return { daten, blobs, speicher: new WixEntwurfSpeicher(daten, blobs, optionen) };
}

/** Klein genug für den Datensatz, aber groß genug für eine abgesenkte Schwelle. */
const KLEINE_SCHWELLE = 2 * 1024;

describe('Sichern und Laden', () => {
  it('legt einen kleinen Entwurf direkt in den Datensatz', async () => {
    const { blobs, speicher } = aufbau();
    const e = entwurf();

    await speicher.sichere(mandant, e);

    expect(blobs.dateien.size).toBe(0);
    expect(await speicher.lade(mandant, e.id)).toEqual(e);
  });

  it('lagert einen großen Entwurf aus und lädt ihn wieder zusammen', async () => {
    const { daten, blobs, speicher } = aufbau(KLEINE_SCHWELLE);
    const e = mitElementen(50);
    expect(jsonBytes(e)).toBeGreaterThan(KLEINE_SCHWELLE);

    await speicher.sichere(mandant, e);

    expect(blobs.dateien.size).toBe(1);
    const datensatz = daten.sammlungen.get('Entwuerfe')?.get(e.id);
    expect(datensatz?.['inhalt']).toBeNull();
    expect(typeof datensatz?.['inhaltDateiId']).toBe('string');

    expect(await speicher.lade(mandant, e.id)).toEqual(e);
  });

  it('greift bei realistischer Entwurfsgröße auch ohne abgesenkte Schwelle', async () => {
    const { daten, blobs, speicher } = aufbau();
    // 2000 Textelemente sind für ein mehrseitiges Plakat nicht abwegig — und
    // sprengen die 512 KB von Wix Data, wenn man sie inline schreiben wollte.
    const e = mitElementen(2000, 'riesig');
    expect(jsonBytes(e)).toBeGreaterThan(WIX_DATENSATZ_GRENZE);

    await speicher.sichere(mandant, e);

    expect(blobs.dateien.size).toBe(1);
    expect(daten.letzteGroesse).toBeLessThan(WIX_DATENSATZ_GRENZE);
    expect(await speicher.lade(mandant, e.id)).toEqual(e);
  });

  it('schreibt beim erneuten Sichern denselben Datensatz, statt zu vermehren', async () => {
    const { daten, speicher } = aufbau();
    const e = entwurf();

    await speicher.sichere(mandant, e);
    await speicher.sichere(mandant, { ...e, name: 'Neuer Name' });

    expect(daten.sammlungen.get('Entwuerfe')?.size).toBe(1);
    expect((await speicher.lade(mandant, e.id)).name).toBe('Neuer Name');
  });

  it('prüft geladene Daten gegen das Schema, statt ihnen zu vertrauen', async () => {
    const { daten, speicher } = aufbau();
    const e = entwurf();
    await speicher.sichere(mandant, e);

    const datensatz = daten.sammlungen.get('Entwuerfe')!.get(e.id)!;
    const kaputt = JSON.parse(String(datensatz['inhalt'])) as Record<string, unknown>;
    (kaputt['masse'] as Record<string, unknown>)['dpi'] = -1;
    datensatz['inhalt'] = JSON.stringify(kaputt);

    await expect(speicher.lade(mandant, e.id)).rejects.toThrow(/mindestens 1/);
  });

  it('meldet unlesbares JSON als Speicherfehler', async () => {
    const { daten, speicher } = aufbau();
    const e = entwurf();
    await speicher.sichere(mandant, e);
    daten.sammlungen.get('Entwuerfe')!.get(e.id)!['inhalt'] = '{kaputt';

    await expect(speicher.lade(mandant, e.id)).rejects.toThrow(SpeicherFehler);
  });

  it('meldet einen Datensatz ohne Inhalt und ohne Auslagerung als kaputt', async () => {
    const { daten, speicher } = aufbau();
    const e = entwurf();
    await speicher.sichere(mandant, e);
    const datensatz = daten.sammlungen.get('Entwuerfe')!.get(e.id)!;
    datensatz['inhalt'] = null;
    datensatz['inhaltDateiId'] = null;

    await expect(speicher.lade(mandant, e.id)).rejects.toThrow(
      /weder Inhalt noch Auslagerungsdatei/,
    );
  });

  it('meldet eine fehlende Auslagerungsdatei mit Bezug auf den Entwurf', async () => {
    const { blobs, speicher } = aufbau(KLEINE_SCHWELLE);
    const e = mitElementen(50);
    await speicher.sichere(mandant, e);
    blobs.dateien.clear();

    await expect(speicher.lade(mandant, e.id)).rejects.toThrow(/nicht lesbar/);
  });
});

describe('Mandantentrennung', () => {
  it('weigert sich, einen fremden Entwurf unter falscher Organisation zu sichern', async () => {
    const { speicher } = aufbau();

    await expect(speicher.sichere(fremderMandant, entwurf())).rejects.toThrow(
      /gehört zu "org-1", gespeichert wird für "org-2"/,
    );
  });

  it('gibt einen fremden Entwurf nicht heraus', async () => {
    const { speicher } = aufbau();
    const e = entwurf();
    await speicher.sichere(mandant, e);

    await expect(speicher.lade(fremderMandant, e.id)).rejects.toThrow(NichtGefunden);
  });

  it('listet nur die eigenen Entwürfe', async () => {
    const { speicher } = aufbau();
    await speicher.sichere(mandant, entwurf('Eigener', werkzeuge('a')));

    const fremd = { ...entwurf('Fremder', werkzeuge('b')), organisationId: 'org-2' };
    await speicher.sichere(fremderMandant, fremd);

    const liste = await speicher.liste(mandant);
    expect(liste.map((k) => k.name)).toEqual(['Eigener']);
  });
});

describe('liste', () => {
  it('sortiert nach Änderungszeit, jüngste zuerst', async () => {
    const { speicher } = aufbau();
    const alt = { ...entwurf('Alt', werkzeuge('a')), geaendertAm: '2026-01-01T00:00:00.000Z' };
    const neu = { ...entwurf('Neu', werkzeuge('b')), geaendertAm: '2026-06-01T00:00:00.000Z' };

    await speicher.sichere(mandant, alt);
    await speicher.sichere(mandant, neu);

    expect((await speicher.liste(mandant)).map((k) => k.name)).toEqual(['Neu', 'Alt']);
  });

  it('lädt den Inhalt nicht mit — die Übersicht bleibt billig', async () => {
    const { blobs, speicher } = aufbau(KLEINE_SCHWELLE);
    await speicher.sichere(mandant, mitElementen(50));
    const gelesen: string[] = [];
    const echtesLies = blobs.liesText.bind(blobs);
    blobs.liesText = async (referenz) => {
      gelesen.push(referenz.id);
      return echtesLies(referenz);
    };

    await speicher.liste(mandant);
    expect(gelesen).toEqual([]);
  });

  it('beachtet Limit und Offset', async () => {
    const { speicher } = aufbau();
    for (let i = 0; i < 5; i += 1) {
      await speicher.sichere(mandant, {
        ...entwurf(`E${i}`, werkzeuge(`w${i}`)),
        geaendertAm: `2026-0${i + 1}-01T00:00:00.000Z`,
      });
    }

    const seite = await speicher.liste(mandant, { limit: 2, offset: 1 });
    expect(seite.map((k) => k.name)).toEqual(['E3', 'E2']);
  });
});

describe('loesche', () => {
  it('entfernt Datensatz und Auslagerungsdatei', async () => {
    const { daten, blobs, speicher } = aufbau(KLEINE_SCHWELLE);
    const e = mitElementen(50);
    await speicher.sichere(mandant, e);

    await speicher.loesche(mandant, e.id);

    expect(daten.sammlungen.get('Entwuerfe')?.size).toBe(0);
    expect(blobs.dateien.size).toBe(0);
  });

  it('löscht keinen fremden Entwurf', async () => {
    const { daten, speicher } = aufbau();
    const e = entwurf();
    await speicher.sichere(mandant, e);

    await expect(speicher.loesche(fremderMandant, e.id)).rejects.toThrow(NichtGefunden);
    expect(daten.sammlungen.get('Entwuerfe')?.size).toBe(1);
  });

  it('meldet einen unbekannten Entwurf', async () => {
    const { speicher } = aufbau();
    await expect(speicher.loesche(mandant, 'gibt-es-nicht')).rejects.toThrow(NichtGefunden);
  });
});
