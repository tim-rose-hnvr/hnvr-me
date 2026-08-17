/**
 * Der Eingang entscheidet, wer die Anfragen fremder Leute lesen darf. Von
 * allen Regeln in diesem Programm sind das die, bei denen ein Fehler am
 * teuersten ist.
 */

import { ok, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import {
  antwortAdresse,
  neuerSchluessel,
  SCHLUESSEL_LAENGE,
  schluesselFormStimmt,
  schluesselStimmt,
} from '../src/kern/eingang.ts';

describe('Eingang', () => {
  it('erzeugt Schlüssel der vollen Länge, jeden nur einmal', () => {
    const viele = new Set(Array.from({ length: 200 }, () => neuerSchluessel()));
    strictEqual(viele.size, 200, 'zwei gleiche Schlüssel in 200 Versuchen');
    for (const s of viele) {
      strictEqual(s.length, SCHLUESSEL_LAENGE);
      ok(/^[A-Za-z0-9]+$/.test(s));
    }
  });

  it('nimmt nur an, was die Form eines Schlüssels hat', () => {
    ok(schluesselFormStimmt(neuerSchluessel()));
    strictEqual(schluesselFormStimmt('kurz'), false);
    strictEqual(schluesselFormStimmt('a'.repeat(31)), false);
    // Ein Punkt oder Schrägstrich hätte in einem Pfad nichts zu suchen.
    strictEqual(schluesselFormStimmt('../'.padEnd(40, 'a')), false);
    strictEqual(schluesselFormStimmt(''), false);
  });

  it('lässt genau den richtigen Schlüssel durch', () => {
    const echt = neuerSchluessel();
    ok(schluesselStimmt(echt, echt));
    strictEqual(schluesselStimmt(echt, neuerSchluessel()), false);
    // Ein Zeichen daneben ist genauso falsch wie alles daneben.
    strictEqual(schluesselStimmt(echt.slice(0, -1) + (echt.endsWith('a') ? 'b' : 'a'), echt), false);
  });

  /* Fällt zu, nicht auf: fehlt am Profil der Schlüssel oder ist er zu kurz,
     darf kein leerer Vergleich zufällig aufgehen. */
  it('lässt einen fehlenden oder zu kurzen Schlüssel nie gelten', () => {
    strictEqual(schluesselStimmt('', ''), false);
    strictEqual(schluesselStimmt('kurz', 'kurz'), false);
    strictEqual(schluesselStimmt('a'.repeat(31), 'a'.repeat(31)), false);
    // Voll ausgeschriebene Länge geht wieder.
    ok(schluesselStimmt('a'.repeat(SCHLUESSEL_LAENGE), 'a'.repeat(SCHLUESSEL_LAENGE)));
  });

  it('baut eine Antwortmail nur bei einer Mailadresse', () => {
    const basis = { id: '1', absicht: 'Auftrag', text: 'Zwei Tage Technik.', name: 'Anna', erledigt: false, eingegangen: null };
    const mit = antwortAdresse({ ...basis, antwortweg: 'anna@example.org' }, 'hnvr');
    ok(mit?.startsWith('mailto:anna@example.org?'));
    ok(mit?.includes(encodeURIComponent('Zwei Tage Technik.')), 'die Anfrage wird zitiert');
    strictEqual(antwortAdresse({ ...basis, antwortweg: '0176 83025781' }, 'hnvr'), null);
  });
});
