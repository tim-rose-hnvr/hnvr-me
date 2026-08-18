/**
 * Die Regeln, die nicht kaputtgehen dürfen.
 *
 * Getestet wird nur, was ohne Wix läuft: Kürzelform, Passwortstreuung,
 * Sitzungsausweis. Alles mit Datenbank steht in `ablage.ts` und braucht
 * eine Laufzeit — das prüft der Durchklick auf der ausgelieferten Seite,
 * nicht dieser Lauf.
 *
 *   node --experimental-strip-types --test test/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { kuerzelPruefen, kuerzelVorschlag } from '../dynamisch/ablage.ts';
import { passwortHashen, passwortStimmt, ausweisBauen, AUSWEIS } from '../dynamisch/konto.ts';

test('Kürzel: erlaubt ist wenig, und das mit Absicht', () => {
  assert.equal(kuerzelPruefen('tisch12').ok, true);
  assert.equal(kuerzelPruefen('a-b-c').ok, true);
  assert.equal(kuerzelPruefen('TISCH12').wert, 'tisch12', 'wird kleingeschrieben');
  assert.equal(kuerzelPruefen('  tisch12 ').wert, 'tisch12', 'Rand wird abgeschnitten');

  assert.equal(kuerzelPruefen('').ok, false);
  assert.equal(kuerzelPruefen('a').ok, false, 'ein Zeichen ist zu wenig');
  assert.equal(kuerzelPruefen('x'.repeat(33)).ok, false);
  assert.equal(kuerzelPruefen('-tisch').ok, false, 'Bindestrich am Anfang');
  assert.equal(kuerzelPruefen('tisch-').ok, false, 'Bindestrich am Ende');
  assert.equal(kuerzelPruefen('a--b').ok, false, 'zwei Bindestriche sind nicht abschreibbar');
  assert.equal(kuerzelPruefen('tisch 12').ok, false, 'kein Leerzeichen');
  assert.equal(kuerzelPruefen('tisch/12').ok, false, 'kein Schrägstrich');
  assert.equal(kuerzelPruefen('Ölwechsel').ok, false, 'keine Umlaute — ein Code wird abgetippt');
});

test('Kürzel: eigene Wege der Seite bleiben gesperrt', () => {
  for (const wort of ['preise', 'zentrale', 'api', 'r', 'studio', 'datenschutz']) {
    const urteil = kuerzelPruefen(wort);
    assert.equal(urteil.ok, false, `„${wort}" darf nicht vergeben werden`);
    assert.match(urteil.grund ?? '', /reserviert/);
  }
});

test('Vorschlag: sieben Zeichen, keine verwechselbaren', () => {
  for (let i = 0; i < 200; i++) {
    const v = kuerzelVorschlag();
    assert.equal(v.length, 7);
    assert.equal(kuerzelPruefen(v).ok, true, `„${v}" muss die eigene Prüfung bestehen`);
    assert.doesNotMatch(v, /[l1o0]/, `„${v}" enthält ein verwechselbares Zeichen`);
  }
});

test('Passwort: eigenes Format, gegen sich selbst prüfbar', async () => {
  const gestreut = await passwortHashen('ein ordentlich langes passwort');
  assert.match(gestreut, /^pbkdf2\$210000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
  assert.equal(await passwortStimmt('ein ordentlich langes passwort', gestreut), true);
  assert.equal(await passwortStimmt('ein ordentlich langes passwor', gestreut), false);
  assert.equal(await passwortStimmt('', gestreut), false);
});

test('Passwort: zweimal dasselbe ergibt zwei verschiedene Sätze', async () => {
  const a = await passwortHashen('immer dasselbe passwort');
  const b = await passwortHashen('immer dasselbe passwort');
  assert.notEqual(a, b, 'ohne eigenes Salz wäre eine Liste gestohlener Hashes viel wert');
  assert.equal(await passwortStimmt('immer dasselbe passwort', a), true);
  assert.equal(await passwortStimmt('immer dasselbe passwort', b), true);
});

test('Passwort: kaputte Sätze werden abgewiesen, nicht geraten', async () => {
  for (const murks of ['', 'pbkdf2', 'pbkdf2$210000$zz$zz', 'bcrypt$12$abc$def', 'pbkdf2$1$aa$bb']) {
    assert.equal(await passwortStimmt('irgendwas', murks), false, `„${murks}"`);
  }
});

test('Ausweis: drei Teile, Ablauf in der Zukunft', async () => {
  const ausweis = await ausweisBauen('konto-1', 'salz-1');
  const [id, ablauf, zeichen] = ausweis.split('.');
  assert.equal(id, 'konto-1');
  assert.ok(Number(ablauf) > Date.now(), 'ein abgelaufener Ausweis wäre sofort wertlos');
  assert.match(zeichen, /^[0-9a-f]{64}$/);

  // Anderes Salz, andere Unterschrift: wer das Salz tauscht, wirft alle
  // Sitzungen dieses Kontos hinaus. Genau dafür ist es da.
  const anderes = await ausweisBauen('konto-1', 'salz-2');
  assert.notEqual(anderes.split('.')[2], zeichen);
  assert.equal(AUSWEIS, 'pnkt_sitzung');
});
