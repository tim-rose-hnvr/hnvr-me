/**
 * Der Start der Box unter widrigen Umständen.
 *
 * Diese Probe gibt es, weil eine Windows-Installation mit „Die Box startet
 * nicht" stehen blieb, obwohl nichts kaputt war: Ein Serverprozess einer
 * früheren Fassung hatte den Port 3377 behalten. Die neue Box sah dort ein
 * Youbooth antworten, beendete sich höflich — und die Hülle wartete auf eine
 * Meldung, die niemand mehr schickte.
 *
 * Geprüft wird deshalb nicht „startet der Server", sondern der ganze Fall:
 *
 *   1. Die Box startet und meldet ihren Port über den Nachrichtenkanal.
 *   2. Ein zweiter Start auf demselben Port beendet sich mit Code 0.
 *   3. Die Hülle findet daraufhin die laufende Box und benutzt sie.
 *   4. Eine ältere Box lässt sich von außen zum Aufhören bewegen.
 *   5. Stirbt die Hülle, stirbt die Box mit — sonst entsteht genau der
 *      Waisenprozess, der den Fehler ausgelöst hat.
 *   6. Eine ALTE Box, die `/api/beenden` noch gar nicht kennt, blockiert den
 *      Port. Dann muss die neue ausweichen — und darf die alte auf keinen
 *      Fall übernehmen: Der Betreiber hätte aktualisiert und sähe weiter die
 *      alte Oberfläche.
 *
 *   node tools/start-probe.mjs
 */

import { fork } from 'node:child_process';
import { wieStarten } from '../huelle/finden.cjs';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(HIER, '..', 'server', 'server.js');
const OBERFLAECHE = path.join(HIER, '..', 'dist');
const PORT = 3390 + Math.floor(Math.random() * 40);

let bestanden = 0;
let gefallen = 0;

function pruefe(satz, wahr, zusatz = '') {
  if (wahr) {
    bestanden++;
    console.log(`  ✓ ${satz}`);
  } else {
    gefallen++;
    console.log(`  ✗ ${satz}${zusatz ? ' — ' + zusatz : ''}`);
  }
}

const warte = (ms) => new Promise((w) => setTimeout(w, ms));

function frageBox(port, sekunden = 2) {
  return new Promise((fertig) => {
    const uhr = setTimeout(() => {
      anfrage.destroy();
      fertig(null);
    }, sekunden * 1000);
    const anfrage = http.get(
      { host: '127.0.0.1', port, path: '/api/version', timeout: sekunden * 1000 },
      (antwort) => {
        let text = '';
        antwort.on('data', (t) => (text += t));
        antwort.on('end', () => {
          clearTimeout(uhr);
          try {
            const d = JSON.parse(text);
            fertig(d && d.version ? { port, version: String(d.version) } : null);
          } catch {
            fertig(null);
          }
        });
      }
    );
    anfrage.on('error', () => {
      clearTimeout(uhr);
      fertig(null);
    });
    anfrage.on('timeout', () => anfrage.destroy());
  });
}

function bitteZuBeenden(port) {
  return new Promise((fertig) => {
    const anfrage = http.request(
      { host: '127.0.0.1', port, path: '/api/beenden', method: 'POST', timeout: 3000 },
      (antwort) => {
        antwort.resume();
        antwort.on('end', () => fertig(antwort.statusCode));
      }
    );
    anfrage.on('error', () => fertig(0));
    anfrage.on('timeout', () => {
      anfrage.destroy();
      fertig(0);
    });
    anfrage.end();
  });
}

/** Startet die Box so, wie die Hülle es tut. */
function starteBox(daten, port, fassung = '9.9.9') {
  const kind = fork(SERVER, [], {
    env: {
      ...process.env,
      YOUBOOTH_DATEN: daten,
      YOUBOOTH_OBERFLAECHE: OBERFLAECHE,
      PORT: String(port),
      YOUBOOTH_FASSUNG: fassung,
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  const zeilen = [];
  kind.stdout.on('data', (d) => zeilen.push(String(d)));
  kind.stderr.on('data', (d) => zeilen.push(String(d)));
  return { kind, zeilen };
}

function wartetAufMeldung(kind, sekunden = 25) {
  return new Promise((fertig) => {
    const uhr = setTimeout(() => fertig(null), sekunden * 1000);
    kind.on('message', (n) => {
      if (n && n.art === 'bereit') {
        clearTimeout(uhr);
        fertig(n);
      }
    });
    kind.on('exit', (code) => {
      clearTimeout(uhr);
      fertig({ art: 'ende', code });
    });
  });
}

const daten = mkdtempSync(path.join(tmpdir(), 'youbooth-probe-'));
const aufzuraeumen = [];

console.log(`\nStart der Box unter widrigen Umständen · Port ${PORT}\n`);

try {
  /* 1 — Die Box startet und sagt, wo sie gelandet ist. */
  console.log('1 · Erster Start');
  const erste = starteBox(daten, PORT, '1.0.3');
  aufzuraeumen.push(erste.kind);
  const meldung = await wartetAufMeldung(erste.kind);
  pruefe('Die Box meldet sich über den Nachrichtenkanal', meldung && meldung.art === 'bereit',
    JSON.stringify(meldung));
  pruefe('Sie meldet den gewünschten Port', meldung && meldung.port === PORT, String(meldung && meldung.port));
  const auskunft = await frageBox(PORT);
  pruefe('Sie beantwortet /api/version', !!auskunft, 'keine Antwort');
  pruefe('Und nennt die Fassung aus der Umgebung', auskunft && auskunft.version === '1.0.3',
    auskunft && auskunft.version);

  /* 2 — Der zweite Start auf demselben Port. Genau hier stand der Fehler. */
  console.log('\n2 · Zweiter Start auf demselben Port');
  const zweite = starteBox(daten, PORT, '1.0.3');
  aufzuraeumen.push(zweite.kind);
  const zweitmeldung = await wartetAufMeldung(zweite.kind, 20);
  pruefe('Der zweite Start beendet sich, statt den Port zu erzwingen',
    zweitmeldung && zweitmeldung.art === 'ende', JSON.stringify(zweitmeldung));
  pruefe('Und zwar mit Code 0 — kein Fehler, nur überflüssig',
    zweitmeldung && zweitmeldung.code === 0, String(zweitmeldung && zweitmeldung.code));
  pruefe('Er sagt auch, warum', zweite.zeilen.join('').includes('läuft bereits'),
    zweite.zeilen.join('').slice(-160));

  /* 3 — Was die Hülle daraus macht: die laufende Box finden. */
  console.log('\n3 · Die Hülle sucht statt aufzugeben');
  const gefunden = await frageBox(PORT);
  pruefe('Nach dem gescheiterten Zweitstart läuft die erste weiter', !!gefunden);
  pruefe('Die Hülle hat damit eine Adresse für ihr Fenster',
    gefunden && gefunden.port === PORT);

  /* 4 — Eine ältere Box räumt den Platz. */
  console.log('\n4 · Ältere Fassung räumt den Platz');
  const antwort = await bitteZuBeenden(PORT);
  pruefe('POST /api/beenden wird vom Booth-PC angenommen', antwort === 200, 'Status ' + antwort);
  let frei = false;
  for (let i = 0; i < 20 && !frei; i++) {
    await warte(300);
    frei = !(await frageBox(PORT, 0.5));
  }
  pruefe('Der Port ist danach frei', frei, 'antwortet immer noch');

  /* 5 — Kein Waisenprozess: stirbt die Hülle, stirbt die Box. */
  console.log('\n5 · Kein Waisenprozess');
  const dritte = starteBox(daten, PORT, '1.0.3');
  const dritt = await wartetAufMeldung(dritte.kind);
  pruefe('Die Box läuft wieder', dritt && dritt.art === 'bereit');
  const pid = dritte.kind.pid;
  dritte.kind.disconnect();
  let weg = false;
  for (let i = 0; i < 20 && !weg; i++) {
    await warte(300);
    try {
      process.kill(pid, 0);
    } catch {
      weg = true;
    }
  }
  pruefe('Bricht der Kanal zur Hülle, beendet sich die Box von selbst', weg,
    'der Prozess lebt noch — genau das war der Waisenprozess');
  if (!weg) dritte.kind.kill('SIGKILL');
  /* 6 — Eine alte Fassung, die sich nicht bitten lässt. */
  console.log('\n6 · Alte Fassung ohne /api/beenden blockiert den Port');
  const altePort = PORT + 1;
  const alte = http.createServer((anfrage, antwort) => {
    if (anfrage.url === '/api/version') {
      antwort.writeHead(200, { 'content-type': 'application/json' });
      antwort.end(JSON.stringify({ version: '1.0.3' }));
      return;
    }
    // Genau wie 1.0.3: Diesen Weg gibt es dort noch nicht.
    antwort.writeHead(404);
    antwort.end();
  });
  await new Promise((fertig) => alte.listen(altePort, '127.0.0.1', fertig));

  const zeilen = [];
  const entscheidung = await wieStarten(altePort, '1.0.5', (z) => zeilen.push(z));
  pruefe('Die alte Box wird gefunden', zeilen.some((z) => z.includes('1.0.3')), zeilen.join(' / '));
  pruefe('Sie wird NICHT übernommen', entscheidung.art !== 'benutzen', entscheidung.art);
  pruefe('Die neue weicht auf einen freien Port aus', entscheidung.art === 'ausweichen', entscheidung.art);
  pruefe('Und zwar nicht auf den blockierten', entscheidung.port !== altePort, String(entscheidung.port));

  /* Und die Gegenprobe: Läuft dort die GLEICHE Fassung, wird sie benutzt. */
  const gleich = await wieStarten(altePort, '1.0.3', () => {});
  pruefe('Bei gleicher Fassung wird die laufende benutzt', gleich.art === 'benutzen', gleich.art);
  pruefe('Und zwar genau die auf dem Port', gleich.port === altePort, String(gleich.port));
  await new Promise((fertig) => alte.close(fertig));
} finally {
  for (const k of aufzuraeumen) {
    try {
      k.kill('SIGKILL');
    } catch {
      /* schon weg */
    }
  }
  await warte(300);
  try {
    rmSync(daten, { recursive: true, force: true });
  } catch {
    /* egal */
  }
}

console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
