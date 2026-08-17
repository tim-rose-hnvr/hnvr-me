import { describe, expect, it, vi } from 'vitest';
import {
  ElementEntfernen,
  ElementHinzufuegen,
  ElementVerschieben,
  type Entwurf,
  festeUhr,
  findeElement,
  KommandoFehler,
  KommandoStack,
  TextAendern,
} from '../src/index.js';
import { druckEntwurf, ersteSeiteId, erzeugeText, mitElementen, testWerkzeuge } from './hilfen.js';

function stackMitText(): { stack: KommandoStack; textId: string; ausgang: Entwurf } {
  const w = testWerkzeuge();
  const text = erzeugeText({ x: 100, y: 100, breite: 300, hoehe: 80 }, 'Anfang', {}, w);
  const ausgang = mitElementen(druckEntwurf(w), text);
  return { stack: new KommandoStack(ausgang, { jetzt: festeUhr() }), textId: text.id, ausgang };
}

describe('KommandoStack', () => {
  it('macht ein Kommando rückgängig und wieder her', () => {
    const { stack, textId } = stackMitText();

    stack.ausfuehren(new ElementVerschieben(textId, 50, -20));
    expect(findeElement(stack.entwurf, textId)?.element.x).toBe(150);
    expect(findeElement(stack.entwurf, textId)?.element.y).toBe(80);

    stack.rueckgaengig();
    expect(findeElement(stack.entwurf, textId)?.element.x).toBe(100);
    expect(findeElement(stack.entwurf, textId)?.element.y).toBe(100);

    stack.wiederholen();
    expect(findeElement(stack.entwurf, textId)?.element.x).toBe(150);
  });

  it('fasst aufeinanderfolgendes Tippen zu einem Schritt zusammen', () => {
    const { stack, textId } = stackMitText();

    stack.ausfuehren(new TextAendern(textId, 'A'));
    stack.ausfuehren(new TextAendern(textId, 'Ab'));
    stack.ausfuehren(new TextAendern(textId, 'Abc'));
    expect(stack.verlauf).toHaveLength(1);

    stack.rueckgaengig();
    const text = findeElement(stack.entwurf, textId)?.element;
    if (text?.typ !== 'text') throw new Error('Textelement erwartet');
    expect(text.inhalt).toBe('Anfang');
  });

  it('verschmilzt nicht über ein anderes Kommando hinweg', () => {
    const { stack, textId } = stackMitText();

    stack.ausfuehren(new TextAendern(textId, 'A'));
    stack.ausfuehren(new ElementVerschieben(textId, 10, 0));
    stack.ausfuehren(new TextAendern(textId, 'Ab'));

    expect(stack.verlauf).toHaveLength(3);
  });

  it('nimmt eine verschmolzene Ziehbewegung vollständig zurück', () => {
    // Die Regel hinter diesem Test: verschmelzbare Kommandos brauchen absolute
    // Umkehrungen. Mit einer relativen Gegenverschiebung nahm Rückgängig von
    // zehn Ziehschritten nur einen zurück.
    const { stack, textId } = stackMitText();

    for (let i = 0; i < 10; i += 1) stack.ausfuehren(new ElementVerschieben(textId, 5, 3));
    expect(findeElement(stack.entwurf, textId)?.element.x).toBe(150);
    expect(findeElement(stack.entwurf, textId)?.element.y).toBe(130);
    expect(stack.verlauf).toHaveLength(1);

    stack.rueckgaengig();
    expect(findeElement(stack.entwurf, textId)?.element.x).toBe(100);
    expect(findeElement(stack.entwurf, textId)?.element.y).toBe(100);

    stack.wiederholen();
    expect(findeElement(stack.entwurf, textId)?.element.x).toBe(150);
    expect(findeElement(stack.entwurf, textId)?.element.y).toBe(130);
  });

  it('bleibt auch über mehrere Rückgängig-Wiederholen-Runden richtig', () => {
    const { stack, textId } = stackMitText();
    for (let i = 0; i < 5; i += 1) stack.ausfuehren(new ElementVerschieben(textId, 10, 0));

    for (let runde = 0; runde < 3; runde += 1) {
      stack.rueckgaengig();
      expect(findeElement(stack.entwurf, textId)?.element.x).toBe(100);
      stack.wiederholen();
      expect(findeElement(stack.entwurf, textId)?.element.x).toBe(150);
    }
  });

  it('nimmt verschmolzenes Tippen vollständig zurück', () => {
    const { stack, textId } = stackMitText();
    for (const inhalt of ['A', 'Ab', 'Abc', 'Abcd']) {
      stack.ausfuehren(new TextAendern(textId, inhalt));
    }

    stack.rueckgaengig();
    const text = findeElement(stack.entwurf, textId)?.element;
    if (text?.typ !== 'text') throw new Error('Textelement erwartet');
    expect(text.inhalt).toBe('Anfang');
  });

  it('verschmilzt Verschiebungen je Element getrennt', () => {
    const w = testWerkzeuge();
    const a = erzeugeText({ x: 0, y: 0, breite: 10, hoehe: 10 }, 'a', {}, w);
    const b = erzeugeText({ x: 0, y: 0, breite: 10, hoehe: 10 }, 'b', {}, w);
    const stack = new KommandoStack(mitElementen(druckEntwurf(w), a, b), { jetzt: festeUhr() });

    stack.ausfuehren(new ElementVerschieben(a.id, 5, 0));
    stack.ausfuehren(new ElementVerschieben(b.id, 5, 0));
    expect(stack.verlauf).toHaveLength(2);
  });

  it('lässt Stand und Verlauf unangetastet, wenn ein Kommando scheitert', () => {
    const { stack, textId } = stackMitText();
    stack.ausfuehren(new ElementVerschieben(textId, 10, 10));
    const vorher = stack.entwurf;

    expect(() => stack.ausfuehren(new ElementEntfernen('gibt-es-nicht'))).toThrow(KommandoFehler);

    expect(stack.entwurf).toBe(vorher);
    expect(stack.verlauf).toHaveLength(1);
  });

  it('verwirft die Wiederholen-Liste, sobald etwas Neues geschieht', () => {
    const { stack, textId } = stackMitText();

    stack.ausfuehren(new ElementVerschieben(textId, 10, 0));
    stack.rueckgaengig();
    expect(stack.kannWiederholen).toBe(true);

    stack.ausfuehren(new ElementVerschieben(textId, 0, 10));
    expect(stack.kannWiederholen).toBe(false);
  });

  it('läuft ins Leere statt zu werfen, wenn nichts zurückzunehmen ist', () => {
    const { stack, ausgang } = stackMitText();
    expect(stack.kannRueckgaengig).toBe(false);
    expect(stack.rueckgaengig().id).toBe(ausgang.id);
    expect(stack.wiederholen().id).toBe(ausgang.id);
  });

  it('hält die Verlaufsgrenze ein', () => {
    const { textId, ausgang } = stackMitText();
    const stack = new KommandoStack(ausgang, { grenze: 3, jetzt: festeUhr() });

    for (let i = 0; i < 10; i += 1) {
      stack.ausfuehren(
        new ElementHinzufuegen(
          { seiteId: ersteSeiteId(ausgang), gruppenId: null, index: 0 },
          erzeugeText({ x: i, y: 0, breite: 10, hoehe: 10 }, `t${i}`, {}, testWerkzeuge(`f${i}`)),
        ),
      );
    }

    expect(stack.verlauf).toHaveLength(3);
    expect(findeElement(stack.entwurf, textId)).not.toBeNull();
  });

  it('meldet jede Änderung an die Abonnenten und stempelt geaendertAm', () => {
    const { stack, textId } = stackMitText();
    const hoerer = vi.fn();
    const abbestellen = stack.abonniere(hoerer);

    stack.ausfuehren(new ElementVerschieben(textId, 1, 1));
    expect(hoerer).toHaveBeenCalledTimes(1);
    expect(stack.entwurf.geaendertAm).toBe('2026-01-01T00:00:00.000Z');

    abbestellen();
    stack.ausfuehren(new ElementVerschieben(textId, 1, 1));
    expect(hoerer).toHaveBeenCalledTimes(1);
  });
});
