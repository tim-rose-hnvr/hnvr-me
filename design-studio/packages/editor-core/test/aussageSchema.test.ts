import { describe, expect, it } from 'vitest';
import { AUSSAGE_SCHEMA_VERSION, ladeAussage, pruefeAussage, SchemaFehler } from '../src/index.js';

const GUELTIG = {
  id: 'aussage-1',
  organisationId: 'org-1',
  name: 'Sommerfest 2026',
  felder: {
    titel: {
      lang: 'Sommerfest der Hauptverwaltung',
      mittel: 'Sommerfest 2026',
      kurz: 'Sommerfest',
    },
    ort: { lang: 'Innenhof Gebäude C', mittel: null, kurz: null },
  },
  termin: '2026-09-12T00:00:00.000Z',
  erstelltAm: '2026-01-01T00:00:00.000Z',
  geaendertAm: '2026-01-01T00:00:00.000Z',
};

function verstoesse(roh: unknown): string[] {
  try {
    pruefeAussage(roh);
    return [];
  } catch (e) {
    if (!(e instanceof SchemaFehler)) throw e;
    return e.verstoesse.map((v) => v.pfad);
  }
}

describe('Aussage laden', () => {
  it('lässt eine gültige Aussage unverändert durch', () => {
    const geladen = pruefeAussage(GUELTIG);
    expect(geladen.felder.titel?.mittel).toBe('Sommerfest 2026');
    expect(geladen.felder.ort?.kurz).toBeNull();
    expect(geladen.termin).toBe('2026-09-12T00:00:00.000Z');
  });

  it('nennt die Aussage beim Namen, nicht den Entwurf', () => {
    // Die Fehlermeldung landet vor einem Menschen. „Entwurf ist ungültig" wäre
    // beim Bearbeiten einer Aussage schlicht irreführend.
    expect(() => pruefeAussage({})).toThrow(/^Aussage ist ungültig/);
  });

  it('sammelt alle Verstöße statt beim ersten abzubrechen', () => {
    const pfade = verstoesse({ ...GUELTIG, id: 42, name: '', organisationId: null });
    expect(pfade).toContain('aussage.id');
    expect(pfade).toContain('aussage.name');
    expect(pfade).toContain('aussage.organisationId');
  });

  it('besteht auf der langen Fassung', () => {
    // Ohne `lang` gibt es nichts auszuspielen — das ist kein knappes Feld,
    // sondern ein kaputtes.
    expect(verstoesse({ ...GUELTIG, felder: { titel: { mittel: 'kurz', kurz: 'k' } } })).toContain(
      'aussage.felder.titel.lang',
    );
  });

  it('meldet eine kürzere Stufe, die länger ist als die darüber', () => {
    // Sonst wird sie nie erreicht: die Auflösung nimmt die erste passende von
    // oben. Repariert wird nichts — welche Fassung gemeint war, weiß nur der
    // Mensch.
    const pfade = verstoesse({
      ...GUELTIG,
      felder: {
        titel: { lang: 'Kurz', mittel: 'Deutlich länger als lang', kurz: null },
      },
    });
    expect(pfade).toContain('aussage.felder.titel.mittel');
  });

  it('meldet kurz gegen lang auch ohne mittlere Stufe', () => {
    const pfade = verstoesse({
      ...GUELTIG,
      felder: { titel: { lang: 'Kurz', mittel: null, kurz: 'Viel zu lang für kurz' } },
    });
    expect(pfade).toContain('aussage.felder.titel.kurz');
  });

  it('verwirft unbekannte Felder, statt sie durchzureichen', () => {
    const pfade = verstoesse({
      ...GUELTIG,
      felder: { ...GUELTIG.felder, wunschfeld: { lang: 'x' } },
    });
    expect(pfade).toContain('aussage.felder.wunschfeld');
  });

  it('weist einen unlesbaren Termin ab, statt ihn zu schlucken', () => {
    expect(verstoesse({ ...GUELTIG, termin: 'nächsten Sommer' })).toContain('aussage.termin');
  });

  it('lässt eine Aussage ohne Termin zu', () => {
    expect(pruefeAussage({ ...GUELTIG, termin: null }).termin).toBeNull();
  });

  it('meldet eine Aussage, die nichts aussagt', () => {
    expect(verstoesse({ ...GUELTIG, felder: {}, termin: null })).toContain('aussage');
  });
});

describe('Fassungswechsel', () => {
  it('nimmt eine Aussage ohne Fassungsnummer als aktuelle an', () => {
    expect(ladeAussage(GUELTIG).id).toBe('aussage-1');
  });

  it('verweigert eine Aussage aus der Zukunft', () => {
    // Stillschweigend weiterzumachen hieße, Felder zu verlieren, die ein
    // neueres Programm geschrieben hat.
    expect(() => ladeAussage({ ...GUELTIG, schemaVersion: AUSSAGE_SCHEMA_VERSION + 1 })).toThrow(
      SchemaFehler,
    );
  });

  it('lässt nicht-objektartige Eingaben in die Prüfung laufen', () => {
    expect(() => ladeAussage('keine Aussage')).toThrow(SchemaFehler);
  });
});
