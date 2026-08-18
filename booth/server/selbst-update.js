/**
 * ═══════════════ Selbst-Aktualisierung, Schnellweg ═══════════════
 *
 * WARUM ES DAS GIBT — und warum der alte Weg unzuverlässig war:
 *
 * Bisher gab es genau einen Weg: das 88-MB-Installationsprogramm. Damit es
 * durchläuft, müssen fünf Dinge gleichzeitig stimmen — die App muss sich
 * wirklich beenden, Windows muss alle Dateihandles freigeben, der alte
 * Deinstallierer muss durchlaufen, sein Registrierungseintrag muss stimmen,
 * und das Ganze darf nicht mit einer zweiten Installation kollidieren.
 * An jeder dieser fünf Stellen ist es an einem einzigen Abend gescheitert.
 *
 * Dabei ändern sich fast immer nur `server.js` und die Seiten in `public/`:
 * **1,5 MB von 88.** Die schweren Teile — Freistell-Modelle (11,8 MB),
 * Gesichtserkennung (8 MB), Druckvorlagen (5,4 MB) und Electron selbst —
 * bleiben über Dutzende Fassungen gleich.
 *
 * Der Schnellweg lädt deshalb nur die Inhalte, packt sie in einen
 * BESCHREIBBAREN Ordner neben den Einstellungen und startet die App neu.
 * Kein Installationsprogramm, kein Deinstallierer, keine Registry, keine
 * gesperrte `Youbooth.exe` — die Datei wird gar nicht angefasst.
 *
 *   %APPDATA%/youbooth/app/<fassung>/    ← entpackte Inhalte
 *   %APPDATA%/youbooth/app/aktiv.json    ← welche gilt
 *
 * Der volle Installer bleibt für das, was er wirklich braucht: eine neue
 * Electron-Fassung, neue native Bausteine, neue Modelle.
 *
 * SICHERHEIT: Heruntergeladen wird nur von der in `settings.update.url`
 * hinterlegten Adresse, und die Prüfsumme MUSS stimmen. Ohne Prüfsumme wird
 * nichts entpackt — ein Schnellweg, der beliebigen Code nachlädt, wäre eine
 * Hintertür in jede Box beim Kunden.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

/* ---------------------------------------------------------------- ZIP ---
   Node bringt keinen Entpacker mit. Statt eine Fremdbibliothek in die Box zu
   holen (die dann selbst aktualisiert werden will) hier ein knapper Leser für
   genau das, was wir erzeugen: ZIP ohne Verschlüsselung, ohne Spanning,
   Verfahren 0 (gespeichert) oder 8 (deflate).

   Gelesen wird über das ZENTRALVERZEICHNIS am Dateiende, nicht über die
   lokalen Köpfe. Das ist der einzige verlässliche Weg: Nur dort stehen die
   Größen garantiert, bei den lokalen Köpfen dürfen sie 0 sein und erst in
   einem Nachspann folgen. */
function zipLesen(puffer) {
  /* End of Central Directory: Kennung 0x06054b50, von hinten suchen — der
     Kommentar am Ende darf bis zu 64 KB lang sein. */
  let eocd = -1;
  for (let i = puffer.length - 22; i >= Math.max(0, puffer.length - 66000); i--) {
    if (puffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Kein ZIP (Zentralverzeichnis nicht gefunden)');

  const anzahl = puffer.readUInt16LE(eocd + 10);
  let p = puffer.readUInt32LE(eocd + 16);
  const eintraege = [];

  for (let i = 0; i < anzahl; i++) {
    if (puffer.readUInt32LE(p) !== 0x02014b50) throw new Error('Zentralverzeichnis beschädigt');
    const verfahren = puffer.readUInt16LE(p + 10);
    const gepackt = puffer.readUInt32LE(p + 20);
    const roh = puffer.readUInt32LE(p + 24);
    const nLen = puffer.readUInt16LE(p + 28);
    const eLen = puffer.readUInt16LE(p + 30);
    const kLen = puffer.readUInt16LE(p + 32);
    const start = puffer.readUInt32LE(p + 42);
    const name = puffer.toString('utf8', p + 46, p + 46 + nLen);
    eintraege.push({ name, verfahren, gepackt, roh, start });
    p += 46 + nLen + eLen + kLen;
  }

  return eintraege.map((e) => {
    if (puffer.readUInt32LE(e.start) !== 0x04034b50) throw new Error('Eintrag beschädigt: ' + e.name);
    const nLen = puffer.readUInt16LE(e.start + 26);
    const eLen = puffer.readUInt16LE(e.start + 28);
    const daten = e.start + 30 + nLen + eLen;
    const roh = puffer.subarray(daten, daten + e.gepackt);
    if (e.verfahren === 0) return { name: e.name, inhalt: Buffer.from(roh) };
    if (e.verfahren === 8) return { name: e.name, inhalt: zlib.inflateRawSync(roh) };
    throw new Error('Unbekanntes Packverfahren ' + e.verfahren + ' bei ' + e.name);
  });
}

/* -------------------------------------------------------------- Pfade --- */
function appWurzel(datenOrdner) {
  return path.join(datenOrdner, 'app');
}

/** Welche Inhaltsfassung ist aktiv? `null` = die im Programm mitgelieferte. */
function aktiveFassung(datenOrdner) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(appWurzel(datenOrdner), 'aktiv.json'), 'utf8'));
    const ordner = path.join(appWurzel(datenOrdner), String(d.version || ''));
    /* Nicht nur die Notiz lesen, sondern nachsehen, ob der Ordner wirklich da
       ist und einen Server enthält. Eine Notiz auf einen gelöschten Ordner
       hätte die Box beim Start ins Leere laufen lassen. */
    if (d.version && fs.existsSync(path.join(ordner, 'server.js'))) {
      return { version: String(d.version), ordner };
    }
  } catch (e) { /* nichts aktiv */ }
  return null;
}

/** Zahlenvergleich, nicht Textvergleich: '1.9.0' ist als Text größer als '1.26.0'. */
function alsZahl(v) {
  return String(v || '0').split('.').reduce((s, t) => s * 1000 + (parseInt(t, 10) || 0), 0);
}

/* ------------------------------------------------------------ Einspielen ---
   Reihenfolge ist hier die halbe Zuverlässigkeit:
   1. herunterladen  2. Prüfsumme  3. in einen NEBENordner entpacken
   4. auf Vollständigkeit prüfen  5. erst dann als aktiv eintragen
   Bricht es in 1–4 ab, ist die laufende Fassung unangetastet. */
async function schnellEinspielen(datenOrdner, quelle, melde = () => {}) {
  const { version, url, sha256, dateien } = quelle;
  if (!version || !url || !sha256) throw new Error('Unvollständige Angaben zum Inhaltspaket');

  melde('lädt', 'Lade Inhalte (' + version + ') …');
  const antwort = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!antwort.ok) throw new Error('Download fehlgeschlagen: HTTP ' + antwort.status);
  const puffer = Buffer.from(await antwort.arrayBuffer());

  const ist = crypto.createHash('sha256').update(puffer).digest('hex');
  if (ist !== sha256) {
    /* Kein Entpacken bei falscher Prüfsumme — nicht „warnen und trotzdem".
       Eine Box beim Kunden führt aus, was hier landet. */
    throw new Error('Prüfsumme stimmt nicht (erwartet ' + sha256.slice(0, 12)
      + '…, bekommen ' + ist.slice(0, 12) + '…)');
  }
  melde('packt', 'Prüfsumme stimmt, entpacke …');

  const wurzel = appWurzel(datenOrdner);
  const ziel = path.join(wurzel, version);
  const neben = ziel + '.neu';
  fs.rmSync(neben, { recursive: true, force: true });
  fs.mkdirSync(neben, { recursive: true });

  let n = 0;
  for (const e of zipLesen(puffer)) {
    /* Pfade aus einem Archiv sind Fremddaten. Ein Eintrag „../../server.js"
       schriebe sonst außerhalb des Zielordners.
       Rückstriche zuerst vereinheitlichen: Windows-Packer schreiben
       `public\booth.html`, und auf einem Mac wäre das EIN Dateiname mit
       Rückstrich statt zweier Ebenen — die Datei landete am falschen Ort und
       würde nie gefunden. */
    const rein = path.normalize(e.name.replace(/\\/g, '/')).replace(/^([/\\]|\.\.[/\\])+/, '');
    const datei = path.join(neben, rein);
    if (!datei.startsWith(neben + path.sep)) throw new Error('Verdächtiger Pfad im Paket: ' + e.name);
    if (e.name.endsWith('/')) { fs.mkdirSync(datei, { recursive: true }); continue; }
    fs.mkdirSync(path.dirname(datei), { recursive: true });
    fs.writeFileSync(datei, e.inhalt);
    n++;
  }

  /* Vollständigkeit: Was das Paket verspricht, muss auch drin sein. Ein
     abgebrochener Entpackvorgang hinterlässt sonst eine Box, die halb neu und
     halb alt ist — und das ist schlimmer als gar kein Update. */
  const pflicht = Array.isArray(dateien) && dateien.length
    ? dateien : ['server.js', 'public/booth.html', 'public/admin.html'];
  for (const f of pflicht) {
    if (!fs.existsSync(path.join(neben, f))) {
      fs.rmSync(neben, { recursive: true, force: true });
      throw new Error('Im Paket fehlt: ' + f);
    }
  }

  fs.rmSync(ziel, { recursive: true, force: true });
  fs.renameSync(neben, ziel);
  fs.writeFileSync(path.join(wurzel, 'aktiv.json'),
    JSON.stringify({ version, seit: new Date().toISOString(), dateien: n }, null, 2));

  /* Ältere Inhaltsordner wegräumen, aber EINEN behalten: Er ist der Rückweg,
     falls die neue Fassung beim Start scheitert. */
  try {
    const alle = fs.readdirSync(wurzel)
      .filter((d) => /^\d+\.\d+\.\d+$/.test(d) && d !== version)
      .sort((a, b) => alsZahl(b) - alsZahl(a));
    for (const alt of alle.slice(1)) fs.rmSync(path.join(wurzel, alt), { recursive: true, force: true });
  } catch (e) { /* Aufräumen ist Beiwerk */ }

  melde('fertig', 'Inhalte ' + version + ' eingespielt (' + n + ' Dateien).');
  return { version, dateien: n, ordner: ziel };
}

/** Nach einem gescheiterten Start: die kaputte Fassung beiseite und zurück. */
function zurueckfallen(datenOrdner, grund) {
  const wurzel = appWurzel(datenOrdner);
  const aktiv = aktiveFassung(datenOrdner);
  if (!aktiv) return null;
  try {
    fs.renameSync(aktiv.ordner, aktiv.ordner + '.kaputt-' + Date.now());
  } catch (e) { /* dann eben nur die Notiz */ }
  try { fs.unlinkSync(path.join(wurzel, 'aktiv.json')); } catch (e) {}
  try {
    fs.appendFileSync(path.join(wurzel, 'rueckfall.log'),
      new Date().toISOString() + '  ' + aktiv.version + '  ' + String(grund).slice(0, 300) + '\n');
  } catch (e) {}
  return aktiv.version;
}

module.exports = { aktiveFassung, schnellEinspielen, zurueckfallen, alsZahl, zipLesen };
