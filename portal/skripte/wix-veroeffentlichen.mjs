#!/usr/bin/env node
/* Bringt das Portal samt PDF Studio auf Wix — in einem Zug, ohne Rückfragen.

   Der einzige Schritt, den kein Programm für Sie tun kann, ist die Zustimmung
   in Ihrem Wix-Konto. Dafür gibt es zwei Wege, und dieses Skript nimmt
   selbsttätig den, der möglich ist:

     · Schlüssel:  WIX_API_KEY in der Umgebung → Anmeldung ohne Zutun.
                   Schlüssel anlegen: https://manage.wix.com/account/api-keys
     · Gerätecode: sonst zeigt das Skript eine Adresse und einen achtstelligen
                   Code. Den Code auf der Adresse bestätigen — an einem
                   beliebigen Gerät, auch am Telefon — und das Skript läuft
                   von allein weiter. Der Code verfällt nach zehn Minuten.

   Danach ohne weiteres Zutun:
     1. Projekt anhängen (nur beim ersten Mal)   npm create @wix/new -- headless link
     2. Bauskripte zurückholen, die der Link-Befehl überschreibt
     3. PDF Studio einbetten                        skripte/app-einbetten.mjs
     4. bauen und veröffentlichen                 wix build && wix release

   Aufruf:
     npm run wix:veroeffentlichen
     npm run wix:veroeffentlichen -- --name "Anderer Name"
*/

import { spawn } from 'node:child_process';
import { readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = ['--yes', '@wix/cli@latest'];

const benannt = process.argv.indexOf('--name');
const GESCHAEFT = benannt > -1 && process.argv[benannt + 1] ? process.argv[benannt + 1] : 'PDF Studio';

/* Skripte, die der Link-Befehl aus package.json entfernt, obwohl die Seite
   ohne sie unvollständig ist: ohne app:einbetten fehlt die Anwendung. */
const EIGENE_SKRIPTE = {
  'app:einbetten': 'node skripte/app-einbetten.mjs',
  prebuild: 'npm run app:einbetten',
  'wix:veroeffentlichen': 'node skripte/wix-veroeffentlichen.mjs',
};

function schritt(nummer, text) {
  console.log(`\n[1m[${nummer}] ${text}[0m`);
}

function abbruch(text, rat) {
  console.error(`\n[31mAbgebrochen:[0m ${text}`);
  if (rat) console.error(`  ${rat}`);
  process.exit(1);
}

async function vorhanden(pfad) {
  try { await access(pfad); return true; } catch { return false; }
}

/* Führt einen Befehl aus und gibt seine Ausgabe durch. Liefert den Rückgabewert
   und die gesammelte Ausgabe, damit der Aufrufer darin nachsehen kann. */
function fuehreAus(befehl, argumente, { zeileGesehen } = {}) {
  return new Promise((fertig) => {
    const kind = spawn(befehl, argumente, { cwd: WURZEL, stdio: ['inherit', 'pipe', 'pipe'] });
    let alles = '';
    for (const strom of [kind.stdout, kind.stderr]) {
      const zeilen = createInterface({ input: strom });
      zeilen.on('line', (zeile) => {
        alles += `${zeile}\n`;
        if (zeileGesehen) zeileGesehen(zeile);
        else console.log(`    ${zeile}`);
      });
    }
    kind.on('error', (fehler) => fertig({ code: -1, alles: `${alles}${fehler.message}\n` }));
    kind.on('close', (code) => fertig({ code, alles }));
  });
}

/* ------------------------------------------------------------------ 1. Anmelden */

async function schonAngemeldet() {
  const { code, alles } = await fuehreAus('npx', [...CLI, 'whoami'], { zeileGesehen: () => {} });
  if (code !== 0) return null;
  const treffer = alles.match(/[\w.+-]+@[\w.-]+\.\w+/);
  return treffer ? treffer[0] : 'angemeldet';
}

async function anmelden() {
  const wer = await schonAngemeldet();
  if (wer) {
    console.log(`    schon angemeldet als ${wer}`);
    return;
  }

  const schluessel = process.env.WIX_API_KEY;
  if (schluessel) {
    console.log('    Schlüssel aus WIX_API_KEY gefunden');
    const { code } = await fuehreAus('npx', [...CLI, 'login', '--api-key', schluessel]);
    if (code !== 0) abbruch('Die Anmeldung mit dem Schlüssel ist gescheitert.',
      'Prüfen Sie den Schlüssel unter https://manage.wix.com/account/api-keys — er muss Zugriff auf alle Seiten des Kontos haben.');
    return;
  }

  console.log('    kein WIX_API_KEY gesetzt — Anmeldung über Gerätecode');
  let angezeigt = false;
  const { code } = await fuehreAus('npx', [...CLI, 'login'], {
    zeileGesehen: (zeile) => {
      let meldung;
      try { meldung = JSON.parse(zeile); } catch { console.log(`    ${zeile}`); return; }
      if (meldung.event === 'awaiting_user') {
        angezeigt = true;
        const minuten = Math.round((meldung.expiresInSeconds ?? 600) / 60);
        console.log('\n    ┌───────────────────────────────────────────────────────────');
        console.log('    │  Bitte einmal bestätigen — an einem beliebigen Gerät:');
        console.log(`    │  ${meldung.verificationUri}`);
        console.log(`    │  Code:  ${meldung.userCode}`);
        console.log(`    │  gültig ${minuten} Minuten; danach läuft alles Weitere allein`);
        console.log('    └───────────────────────────────────────────────────────────\n');
      } else {
        console.log(`    ${zeile}`);
      }
    },
  });
  if (code !== 0) {
    abbruch(angezeigt ? 'Der Code wurde nicht rechtzeitig bestätigt.' : 'Die Anmeldung ist gescheitert.',
      'Skript noch einmal starten — es fragt einen frischen Code an.');
  }
}

/* ------------------------------------------------------------ 2. Projekt anhängen */

async function anhaengen() {
  if (await vorhanden(join(WURZEL, 'wix.config.json'))) {
    const inhalt = JSON.parse(await readFile(join(WURZEL, 'wix.config.json'), 'utf8'));
    console.log(`    schon angehängt (siteId ${inhalt.siteId ?? '?'})`);
    return;
  }
  const { code } = await fuehreAus('npm', ['create', '@wix/new@latest', '--', 'headless', 'link', '--business-name', GESCHAEFT]);
  if (code !== 0) abbruch('Das Anhängen an Wix ist gescheitert.',
    'Häufigster Grund: Astro 6 im Projekt. Der Link-Befehl verlangt Astro 5.');
  if (!(await vorhanden(join(WURZEL, 'wix.config.json')))) {
    abbruch('Nach dem Anhängen fehlt wix.config.json.', 'Ohne diese Datei weiß der Bau nicht, wohin er gehört.');
  }
}

/* -------------------------------------------- 3. Eigene Skripte zurück in package.json */

async function skripteZurueckholen() {
  const weg = join(WURZEL, 'package.json');
  const paket = JSON.parse(await readFile(weg, 'utf8'));
  paket.scripts ??= {};
  const ergaenzt = [];
  for (const [name, befehl] of Object.entries(EIGENE_SKRIPTE)) {
    if (paket.scripts[name] !== befehl) {
      paket.scripts[name] = befehl;
      ergaenzt.push(name);
    }
  }
  if (!ergaenzt.length) {
    console.log('    nichts zu ergänzen');
    return;
  }
  await writeFile(weg, `${JSON.stringify(paket, null, 2)}\n`);
  console.log(`    zurückgeholt: ${ergaenzt.join(', ')}`);
}

/* --------------------------------------------------- 4. Einbetten, bauen, freigeben */

async function bauenUndFreigeben() {
  const einbetten = await fuehreAus('node', ['skripte/app-einbetten.mjs']);
  if (einbetten.code !== 0) abbruch('Das Studio ließ sich nicht einbetten.');

  const bauen = await fuehreAus('npx', [...CLI, 'build']);
  if (bauen.code !== 0) abbruch('Der Bau ist gescheitert.');

  const freigeben = await fuehreAus('npx', [...CLI, 'release']);
  if (freigeben.code !== 0) abbruch('Die Freigabe ist gescheitert.');

  const adresse = freigeben.alles.match(/https?:\/\/\S+/g)?.filter((a) => !a.includes('dev.wix.com'));
  return adresse?.[adresse.length - 1];
}

/* ------------------------------------------------------------------------ Ablauf */

schritt(1, 'Bei Wix anmelden');
await anmelden();

schritt(2, `Projekt an Wix anhängen — Geschäft „${GESCHAEFT}"`);
await anhaengen();

schritt(3, 'Eigene Bauskripte sichern');
await skripteZurueckholen();

schritt(4, 'PDF Studio einbetten, bauen, veröffentlichen');
const adresse = await bauenUndFreigeben();

console.log('\n[32mFertig.[0m Die Seite ist veröffentlicht.');
if (adresse) console.log(`  ${adresse}`);
console.log('  Die Anwendung selbst liegt darunter unter /studio/.');
console.log('  Eigene Domain verbinden: https://manage.wix.com/account/sites');
