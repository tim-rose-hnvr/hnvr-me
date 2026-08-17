import { describe, expect, it } from 'vitest';
import {
  entferneTrennstriche,
  setzeTrennstriche,
  WEICHER_TRENNSTRICH,
  zaehleTrennstellen,
} from '../src/trennung.js';

describe('setzeTrennstriche', () => {
  it('trennt deutsche Wortungetüme', () => {
    // Der Grund für diese Datei: `hyphens: auto` wirkt in headless Chromium
    // nicht, die Trennmuster fehlen dort. Also vorher einsetzen.
    const getrennt = setzeTrennstriche('Betriebsversammlung');
    expect(zaehleTrennstellen(getrennt)).toBeGreaterThan(2);
    expect(entferneTrennstriche(getrennt)).toBe('Betriebsversammlung');
  });

  it('lässt kurze Wörter in Ruhe', () => {
    // Kurze Wörter zu trennen sieht billig aus und spart keine Zeile.
    expect(setzeTrennstriche('Die und der ein Uhr')).toBe('Die und der ein Uhr');
  });

  it('achtet die eingestellte Mindestlänge', () => {
    expect(zaehleTrennstellen(setzeTrennstriche('Sommer', { mindestlaenge: 20 }))).toBe(0);
    expect(zaehleTrennstellen(setzeTrennstriche('Sommer', { mindestlaenge: 4 }))).toBeGreaterThan(
      0,
    );
  });

  it('lässt Zeichensetzung und Zahlen unangetastet', () => {
    const getrennt = setzeTrennstriche('Sommerfest 2026, Anmeldung!');
    expect(entferneTrennstriche(getrennt)).toBe('Sommerfest 2026, Anmeldung!');
    expect(getrennt).toContain('2026,');
  });

  it('kann abgeschaltet werden', () => {
    expect(setzeTrennstriche('Betriebsversammlung', { sprache: 'keine' })).toBe(
      'Betriebsversammlung',
    );
  });

  it('kann englisch trennen', () => {
    expect(
      zaehleTrennstellen(setzeTrennstriche('extraordinary', { sprache: 'en' })),
    ).toBeGreaterThan(1);
  });

  it('behandelt leeren Text ohne Aufwand', () => {
    expect(setzeTrennstriche('')).toBe('');
  });

  it('benutzt den weichen Trennstrich, nicht den sichtbaren Bindestrich', () => {
    const getrennt = setzeTrennstriche('Geschäftsstellenleitung');
    expect(getrennt).toContain(WEICHER_TRENNSTRICH);
    expect(getrennt).not.toContain('-');
  });
});
