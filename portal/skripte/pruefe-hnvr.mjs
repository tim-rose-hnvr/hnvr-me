#!/usr/bin/env node
/* Prüft die Regeln der Anmeldung über hnvr.me — ohne Server, ohne Netz.

   Die Routen selbst brauchen Wix und lassen sich hier nicht fahren. Was sie
   entscheiden, steht aber in src/hnvr-regeln.js, und das lässt sich prüfen:
   dass kein fremdes Ziel durchkommt, dass die stille Anmeldung genau einmal
   ins Formular fällt und nicht im Kreis läuft, und dass die Kekse tragen,
   was sie tragen sollen.

   Aufruf: node skripte/pruefe-hnvr.mjs   (oder npm run pruefen:hnvr) */

import assert from 'node:assert/strict';
import {
  sichererRuecksprung, liesKeks, keks, keksLoeschen, rueckkehrAdresse,
  entscheideRueckkehr, anzeigename, SITZUNG, VORGANG,
} from '../src/hnvr-regeln.js';

let gut = 0;
let schlecht = 0;
function pruefe(name, tun) {
  try { tun(); gut += 1; console.log(`  ✓ ${name}`); }
  catch (fehler) { schlecht += 1; console.log(`  ✗ ${name}\n      ${fehler.message}`); }
}

console.log('\n== Rücksprung: kein offener Umleiter ==');
pruefe('ein Pfad auf dieser Seite kommt durch, mit Suche und Anker', () => {
  assert.equal(sichererRuecksprung('/studio/index.html?werkzeug=ocr#s2'), '/studio/index.html?werkzeug=ocr#s2');
});
for (const boese of [
  'https://fremd.example/', '//fremd.example/weg', '/\\fremd.example', 'javascript:alert(1)',
  ' /portal', 'portal', '', null, undefined, 42, `/${'a'.repeat(3000)}`,
]) {
  pruefe(`abgewiesen: ${JSON.stringify(boese)?.slice(0, 40)}`, () => {
    assert.equal(sichererRuecksprung(boese, '/portal'), '/portal');
  });
}
pruefe('„/.." bleibt auf der Seite', () => {
  assert.equal(sichererRuecksprung('/studio/../portal'), '/portal');
});

console.log('\n== Kekse ==');
pruefe('der richtige Keks wird gelesen, auch zwischen anderen', () => {
  const kopf = `a=1; ${SITZUNG}=${encodeURIComponent('{"value":"x=y","role":"member"}')}; b=2`;
  assert.equal(liesKeks(kopf, SITZUNG), '{"value":"x=y","role":"member"}');
});
pruefe('ein fehlender Keks ist null, kein Fehler', () => {
  assert.equal(liesKeks('a=1', SITZUNG), null);
  assert.equal(liesKeks(null, SITZUNG), null);
  assert.equal(liesKeks('kaputt', SITZUNG), null);
});
pruefe('ein ähnlich benannter Keks wird nicht verwechselt', () => {
  assert.equal(liesKeks(`${SITZUNG}_alt=1; x${SITZUNG}=2`, SITZUNG), null);
});
pruefe('Kekse sind HttpOnly, SameSite=Lax, Pfad /, draußen Secure', () => {
  const k = keks(SITZUNG, 'w', { sekunden: 60 });
  for (const teil of ['HttpOnly', 'SameSite=Lax', 'Path=/', 'Secure', 'Max-Age=60']) {
    assert.ok(k.includes(teil), `${teil} fehlt in ${k}`);
  }
  assert.ok(!keks(SITZUNG, 'w', { sekunden: 60, sicher: false }).includes('Secure'), 'örtlich ohne Secure');
});
pruefe('Löschen heißt Max-Age=0', () => {
  assert.ok(keksLoeschen(VORGANG).includes('Max-Age=0'));
});

console.log('\n== Rücksprungadresse für Wix ==');
pruefe('draußen immer https — hinter dem Hosting kommt http an', () => {
  assert.equal(rueckkehrAdresse(new URL('http://werkbank-b2ce6ab2-hnvrme.wix-site-host.com/api/hnvr/anmelden?x=1')),
    'https://werkbank-b2ce6ab2-hnvrme.wix-site-host.com/api/hnvr/rueckkehr');
});
pruefe('örtlich bleibt http mit Port', () => {
  assert.equal(rueckkehrAdresse(new URL('http://localhost:4321/api/hnvr/anmelden')),
    'http://localhost:4321/api/hnvr/rueckkehr');
});

console.log('\n== Nach der Rückkehr von Wix ==');
const vorgang = (prompt) => ({ prompt, oauthData: { state: 'z1', originalUri: '/studio/index.html' } });
pruefe('still gefragt, niemand angemeldet → einmal mit Formular', () => {
  assert.deepEqual(entscheideRueckkehr({ fehler: 'login_required', vorgang: vorgang('none') }),
    { art: 'mit-formular', ruecksprung: '/studio/index.html' });
});
pruefe('mit Formular gefragt und wieder ein Fehler → zurück, keine Schleife', () => {
  const e = entscheideRueckkehr({ fehler: 'access_denied', vorgang: vorgang('login') });
  assert.equal(e.art, 'fehlschlag');
  assert.equal(e.grund, 'access_denied');
});
pruefe('Code mit passendem Zustand → Tokens holen', () => {
  assert.deepEqual(entscheideRueckkehr({ code: 'c', zustand: 'z1', vorgang: vorgang('none') }), { art: 'tokens' });
});
pruefe('Code mit fremdem Zustand → abgewiesen', () => {
  assert.equal(entscheideRueckkehr({ code: 'c', zustand: 'anders', vorgang: vorgang('none') }).grund, 'zustand-passt-nicht');
});
pruefe('ohne Vorgangskeks → abgewiesen, nicht Tokens', () => {
  assert.equal(entscheideRueckkehr({ code: 'c', zustand: 'z1', vorgang: null }).art, 'fehlschlag');
});
pruefe('ein fremdes Ziel im Vorgang wird auch hier abgewiesen', () => {
  const e = entscheideRueckkehr({ fehler: 'x', vorgang: { prompt: 'none', oauthData: { state: 's', originalUri: '//fremd.example' } } });
  assert.equal(e.ruecksprung, '/portal');
});

console.log('\n== Anzeige ==');
pruefe('Name: Spitzname vor Vor- und Nachname vor Adresse', () => {
  assert.equal(anzeigename({ profile: { nickname: 'Ada' }, contact: { firstName: 'A' } }), 'Ada');
  assert.equal(anzeigename({ contact: { firstName: 'Ada', lastName: 'Musterfrau' } }), 'Ada Musterfrau');
  assert.equal(anzeigename({ loginEmail: 'ada@example.org' }), 'ada@example.org');
  assert.equal(anzeigename(null), null);
});

console.log(`\n${gut} bestanden, ${schlecht} gescheitert`);
process.exit(schlecht ? 1 : 0);
