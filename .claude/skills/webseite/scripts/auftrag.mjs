#!/usr/bin/env node
// Prüft das Auftragsregister: Ist wirklich alles erledigt — und ist es belegt?
//
//   node auftrag.mjs auftrag.md
//   node auftrag.mjs auftrag.md --rest-erlaubt     # offene Punkte sind zulässig, müssen aber benannt sein
//   node auftrag.mjs --vorlage > auftrag.md
//
// Das Prüfskript prüft die Seite. Dieses Skript prüft den Auftrag.
// Eine technisch makellose Seite kann die Hälfte des Auftrags nicht enthalten —
// davon merkt pruefen.mjs nichts, weil es nicht weiß, was bestellt war.
//
// Grundsatz: „Erledigt" ohne Nachweis ist eine Meinung. Jeder erledigte Punkt
// braucht mindestens einen Nachweis, und Nachweise, die auf Dateien zeigen,
// werden nachgesehen. Was nur behauptet ist, wird als behauptet ausgewiesen.

import fs from 'node:fs';
import path from 'node:path';

const ZUSTAENDE = ['erledigt', 'teilweise', 'offen', 'entfallen'];

const VORLAGE = `# Auftragsregister — <Projekt>

Jeder Punkt aus Phase 0 bekommt einen Eintrag. Kein Eintrag ohne Zustand,
kein "erledigt" ohne Nachweis.

Nachweisarten:
  pruefung:<pfad zu bericht.json>   — muss 0 Fehler haben
  screenshot:<pfad zur datei>       — muss existieren und Inhalt haben
  datei:<pfad>                      — muss existieren
  manuell: <was geprüft wurde>      — zählt als Behauptung, nicht als Beleg

## A1 <Anforderung>
- Zustand: erledigt
- Nachweis: pruefung:.pruefung/bericht.json
- Nachweis: screenshot:.pruefung/screenshots/start-desktop.png
- Nachweis: manuell: drei Eingaben durchgerechnet, gegen die Preistabelle geprüft

## A2 <Anforderung>
- Zustand: teilweise
- Offen: <was genau fehlt und warum>
- Nachweis: screenshot:.pruefung/screenshots/kontakt-mobil.png
`;

function lies(datei) {
  const text = fs.readFileSync(datei, 'utf8');
  const eintraege = [];
  let aktuell = null;
  for (const rohzeile of text.split('\n')) {
    const zeile = rohzeile.trim();
    const ueberschrift = zeile.match(/^##\s+(\S+)\s+(.*)$/);
    if (ueberschrift) {
      aktuell = { kennung: ueberschrift[1], titel: ueberschrift[2].trim(), zustand: null, nachweise: [], offen: [], zeile: rohzeile };
      eintraege.push(aktuell);
      continue;
    }
    if (!aktuell) continue;
    const feld = zeile.match(/^-\s*(Zustand|Nachweis|Offen)\s*:\s*(.*)$/i);
    if (!feld) continue;
    const [, name, wert] = feld;
    if (/^zustand$/i.test(name)) aktuell.zustand = wert.trim().toLowerCase();
    else if (/^nachweis$/i.test(name)) aktuell.nachweise.push(wert.trim());
    else aktuell.offen.push(wert.trim());
  }
  return eintraege;
}

function pruefeNachweis(nachweis, wurzel) {
  const [artRoh, ...rest] = nachweis.split(':');
  const art = artRoh.trim().toLowerCase();
  const wert = rest.join(':').trim();

  if (art === 'manuell') {
    if (wert.length < 12) return { art, ok: false, belegt: false, text: 'manueller Nachweis ohne Beschreibung' };
    return { art, ok: true, belegt: false, text: wert };
  }

  if (!['pruefung', 'screenshot', 'datei'].includes(art)) {
    return { art, ok: false, belegt: false, text: `unbekannte Nachweisart „${artRoh.trim()}"` };
  }

  const ziel = path.resolve(wurzel, wert);
  if (!fs.existsSync(ziel)) return { art, ok: false, belegt: false, text: `${wert} existiert nicht` };
  const stat = fs.statSync(ziel);
  if (!stat.isFile() || stat.size === 0) return { art, ok: false, belegt: false, text: `${wert} ist leer` };

  if (art === 'pruefung') {
    let bericht;
    try { bericht = JSON.parse(fs.readFileSync(ziel, 'utf8')); }
    catch { return { art, ok: false, belegt: false, text: `${wert} ist kein lesbarer Bericht` }; }
    const fehler = (bericht.befunde ?? []).filter((b) => b.stufe === 'fehler');
    if (fehler.length) return { art, ok: false, belegt: true, text: `${wert}: ${fehler.length} Fehler im Prüflauf` };
    const warnungen = (bericht.befunde ?? []).filter((b) => b.stufe !== 'fehler').length;
    return { art, ok: true, belegt: true, text: `${wert}: 0 Fehler, ${warnungen} weitere Befunde` };
  }

  return { art, ok: true, belegt: true, text: `${wert} (${Math.round(stat.size / 1024)} kB)` };
}

function haupt() {
  const argumente = process.argv.slice(2);
  if (argumente.includes('--vorlage')) { process.stdout.write(VORLAGE); process.exit(0); }
  const datei = argumente.find((a) => !a.startsWith('--'));
  if (!datei) {
    console.log('Aufruf: node auftrag.mjs <auftrag.md> [--rest-erlaubt]   |   node auftrag.mjs --vorlage');
    process.exit(2);
  }
  if (!fs.existsSync(datei)) { console.error(`Nicht gefunden: ${datei}`); process.exit(2); }
  const restErlaubt = argumente.includes('--rest-erlaubt');
  const wurzel = path.dirname(path.resolve(datei));

  const eintraege = lies(datei);
  if (!eintraege.length) {
    console.error('Kein einziger Eintrag gefunden. Erwartet werden Abschnitte der Form „## A1 Anforderung".');
    process.exit(2);
  }

  const maengel = [];
  const zeilen = [];
  let belegt = 0;
  let behauptet = 0;

  for (const e of eintraege) {
    const kopf = `${e.kennung} ${e.titel}`;
    if (!e.zustand) { maengel.push(`${kopf}: kein Zustand angegeben`); zeilen.push(`  ?         ${kopf}`); continue; }
    if (!ZUSTAENDE.includes(e.zustand)) {
      maengel.push(`${kopf}: unbekannter Zustand „${e.zustand}" (erlaubt: ${ZUSTAENDE.join(', ')})`);
      continue;
    }

    const geprueft = e.nachweise.map((n) => pruefeNachweis(n, wurzel));
    const kaputt = geprueft.filter((g) => !g.ok);
    const harteBelege = geprueft.filter((g) => g.ok && g.belegt);

    if (e.zustand === 'erledigt') {
      if (!e.nachweise.length) maengel.push(`${kopf}: als erledigt gemeldet, aber ohne jeden Nachweis`);
      else if (!harteBelege.length) {
        behauptet++;
        maengel.push(`${kopf}: nur manuell belegt — behauptet, nicht nachgewiesen`);
      } else belegt++;
    }
    if (e.zustand === 'teilweise' && !e.offen.length) {
      maengel.push(`${kopf}: teilweise erledigt, aber ohne Angabe, was offen ist`);
    }
    if (e.zustand === 'offen' && !restErlaubt) {
      maengel.push(`${kopf}: offen`);
    }
    if (e.zustand === 'entfallen' && !e.offen.length) {
      maengel.push(`${kopf}: entfallen, aber ohne Begründung (als „Offen:" eintragen)`);
    }
    for (const k of kaputt) maengel.push(`${kopf}: Nachweis nicht haltbar — ${k.text}`);

    const zeichen = { erledigt: '✓', teilweise: '~', offen: '·', entfallen: '–' }[e.zustand];
    zeilen.push(`  ${zeichen} ${e.zustand.padEnd(9)} ${kopf}`);
    for (const g of geprueft) zeilen.push(`      ${g.ok ? (g.belegt ? 'Beleg  ' : 'Aussage') : 'FEHLT  '} ${g.text}`);
    for (const o of e.offen) zeilen.push(`      offen   ${o}`);
  }

  const zaehlen = (z) => eintraege.filter((e) => e.zustand === z).length;
  console.log(`Auftragsregister: ${datei}`);
  console.log('');
  console.log(zeilen.join('\n'));
  console.log('');
  console.log(`${eintraege.length} Anforderungen — ${zaehlen('erledigt')} erledigt, ${zaehlen('teilweise')} teilweise, ${zaehlen('offen')} offen, ${zaehlen('entfallen')} entfallen`);
  console.log(`davon hart belegt: ${belegt}${behauptet ? `, nur behauptet: ${behauptet}` : ''}`);

  if (maengel.length) {
    console.log('');
    console.log('Die Fertigmeldung ist nicht zulässig:');
    for (const m of maengel) console.log(`  - ${m}`);
    console.log('');
    console.log('Entweder erledigen, oder den Zustand ehrlich auf „teilweise"/„offen" setzen und den Rest benennen.');
    process.exit(1);
  }

  console.log('');
  console.log('Alle Anforderungen sind abgeschlossen und belegt.');
  process.exit(0);
}

haupt();
