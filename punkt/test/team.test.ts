/**
 * Mitarbeitende: die Regeln, die ohne Wix prüfbar sind.
 *
 * Rollen und Rechte, wem ein Code gehört, der Einladungslink und wann
 * eine Einladung nicht angenommen werden darf. Die Ablage selbst
 * (PK_Mitglieder) braucht eine Laufzeit und wird auf der ausgelieferten
 * Seite durchgeklickt.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  adresseTaugt,
  annahmeHindernis,
  darfSchreiben,
  darfVerwalten,
  einladungAbdruck,
  einladungAblauf,
  einladungErzeugen,
  einladungFormOk,
  einladungGueltig,
  organisationVon,
  rolleAmCode,
  rolleTaugt,
  rueckwegTaugt,
  type Annahmelage,
  type Zugehoerigkeit,
} from '../dynamisch/team.ts';
import { kuerzelPruefen } from '../dynamisch/ablage.ts';

const bei = (rolle: 'redakteur' | 'leser'): Zugehoerigkeit => ({
  inhaberId: 'chefin',
  inhaberName: 'Bäckerei Klein',
  rolle,
  mitgliedschaft: 'm1',
});

test('Rechte: dieselbe Tabelle wie im Go-Programm', () => {
  assert.equal(darfSchreiben('inhaber'), true);
  assert.equal(darfSchreiben('redakteur'), true);
  assert.equal(darfSchreiben('leser'), false);
  assert.equal(darfSchreiben(null), false, 'ohne Rolle darf niemand schreiben');

  assert.equal(darfVerwalten('inhaber'), true);
  assert.equal(darfVerwalten('redakteur'), false, 'Redakteure laden niemanden ein');
  assert.equal(darfVerwalten('leser'), false);
  assert.equal(darfVerwalten(null), false);
});

test('Rollen: vergeben werden nur Redakteur und Leser', () => {
  assert.equal(rolleTaugt('redakteur'), true);
  assert.equal(rolleTaugt('leser'), true);
  assert.equal(rolleTaugt('inhaber'), false, 'Inhaber wird man nicht per Einladung');
  assert.equal(rolleTaugt('hauptmann'), false);
  assert.equal(rolleTaugt(''), false);
});

test('Codes gehören der Organisation, eigene bleiben eigene', () => {
  // Ohne Organisation: nur die eigenen Codes.
  assert.equal(rolleAmCode('ich', 'ich', null), 'inhaber');
  assert.equal(rolleAmCode('fremd', 'ich', null), null);

  // Mitarbeit: Codes der Chefin mit der vergebenen Rolle …
  assert.equal(rolleAmCode('chefin', 'ich', bei('redakteur')), 'redakteur');
  assert.equal(rolleAmCode('chefin', 'ich', bei('leser')), 'leser');
  // … eigene Codes von vorher weiter mit vollen Rechten …
  assert.equal(rolleAmCode('ich', 'ich', bei('leser')), 'inhaber');
  // … und eine dritte Organisation bleibt zu.
  assert.equal(rolleAmCode('fremd', 'ich', bei('redakteur')), null);
  assert.equal(rolleAmCode('', 'ich', bei('redakteur')), null, 'ein Code ohne Besitzer gehört niemandem');

  assert.equal(organisationVon('ich', null), 'ich');
  assert.equal(organisationVon('ich', bei('redakteur')), 'chefin', 'neue Codes gehen an die Organisation');
});

test('Einladungslink: 32 Zeichen, nie zweimal derselbe', () => {
  const gesehen = new Set<string>();
  for (let i = 0; i < 300; i++) {
    const s = einladungErzeugen();
    assert.equal(einladungFormOk(s), true, `„${s}"`);
    assert.equal(rueckwegTaugt(`/einladung/${s}`), true);
    gesehen.add(s);
  }
  assert.equal(gesehen.size, 300);

  for (const murks of ['', 'kurz', 'x'.repeat(31), 'x'.repeat(33), 'ä'.repeat(32), `${'a'.repeat(31)}/`]) {
    assert.equal(einladungFormOk(murks), false, `„${murks}"`);
  }
});

test('Einladungslink: abgelegt wird nur der Abdruck', async () => {
  const s = einladungErzeugen();
  const a = await einladungAbdruck(s);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, s);
  assert.equal(await einladungAbdruck(s), a, 'derselbe Link findet dieselbe Zeile');
  assert.notEqual(await einladungAbdruck(einladungErzeugen()), a);
});

test('Einladungslink: sieben Tage, dann nicht mehr', () => {
  const jetzt = Date.parse('2026-10-04T12:00:00Z');
  const bis = einladungAblauf(jetzt);
  assert.equal(bis, '2026-10-11T12:00:00.000Z');
  assert.equal(einladungGueltig(bis, jetzt), true);
  assert.equal(einladungGueltig(bis, Date.parse('2026-10-11T11:59:59Z')), true);
  assert.equal(einladungGueltig(bis, Date.parse('2026-10-11T12:00:00Z')), false);
  assert.equal(einladungGueltig('', jetzt), false, 'ohne Ablauf gilt nichts');
  assert.equal(einladungGueltig('morgen', jetzt), false);
});

test('Rückweg nach dem Anmelden: nur zur Einladung, nirgends sonst', () => {
  const s = einladungErzeugen();
  for (const fremd of [
    '', '/zentrale', '//boese.example', 'https://boese.example', `/einladung/${s}/../../x`,
    `/einladung/${s}?x=1`, `//boese.example/einladung/${s}`, '/einladung/', `/Einladung/${s}`,
  ]) {
    assert.equal(rueckwegTaugt(fremd), false, `„${fremd}" wäre eine offene Weiterleitung`);
  }
});

test('Adressen: grob, aber nicht beliebig', () => {
  assert.equal(adresseTaugt('anna@baeckerei-klein.de'), true);
  assert.equal(adresseTaugt('a.b+zentrale@x.co'), true);
  for (const murks of ['', 'anna', 'anna@', 'anna@klein', 'anna@klein.d', 'an na@klein.de']) {
    assert.equal(adresseTaugt(murks), false, `„${murks}"`);
  }
});

test('Annehmen: nur mit der eingeladenen Adresse und nur einmal', () => {
  const grund: Annahmelage = {
    eingeladen: 'anna@klein.de',
    angemeldet: 'Anna@Klein.de ',
    kontoId: 'anna',
    inhaberId: 'chefin',
    schonDabei: null,
    fuehrtSelbst: false,
    inhaberArbeitetWoanders: false,
  };
  assert.equal(annahmeHindernis(grund), null, 'Schreibweise der Adresse ist gleichgültig');

  assert.match(annahmeHindernis({ ...grund, angemeldet: 'bert@klein.de' }) ?? '', /gilt für anna@klein\.de/);
  assert.match(annahmeHindernis({ ...grund, kontoId: 'chefin' }) ?? '', /eigene Organisation/);
  assert.match(annahmeHindernis({ ...grund, schonDabei: bei('leser') }) ?? '', /schon dabei/);
  assert.match(
    annahmeHindernis({ ...grund, schonDabei: { ...bei('leser'), inhaberId: 'andere', inhaberName: 'Café Rot' } }) ?? '',
    /Café Rot.*Tritt dort zuerst aus/,
    'höchstens eine fremde Organisation',
  );
  assert.match(annahmeHindernis({ ...grund, fuehrtSelbst: true }) ?? '', /selbst Mitarbeitende/);
  assert.match(annahmeHindernis({ ...grund, inhaberArbeitetWoanders: true }) ?? '', /gilt nicht mehr/);
});

test('Kürzel: „einladung" ist ein eigener Weg der Seite', () => {
  const urteil = kuerzelPruefen('einladung');
  assert.equal(urteil.ok, false);
  assert.match(urteil.grund ?? '', /reserviert/);
});
