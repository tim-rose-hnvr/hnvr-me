/**
 * Spiegelreflex-Anbindung über digiCamControl.
 *
 * Warum dieser Weg: Canon, Nikon und Sony sprechen nur über herstellereigene
 * SDKs mit nativem Code. digiCamControl ist ein freies Windows-Programm, das
 * genau das schon tut und eine kleine HTTP-Schnittstelle mitbringt (Port 5513).
 * Wir reden also mit einem Programm statt mit drei Kamera-SDKs — kein
 * Compiler, kein natives Modul im Installer.
 *
 * Schnittstelle laut Handbuch (digicamcontrol.com/doc/userguide/web):
 *   ?slc=set&param1=session.folder&param2=<Pfad>
 *   ?slc=set&param1=session.filenametemplate&param2=<Name>
 *   ?CMD=Capture
 *   ?slc=get&param1=lastcaptured&param2=      → Dateiname, "-" solange es läuft
 *   /image/<name>                             → die Datei
 *   ?CMD=LiveViewWnd_Show | LiveViewWnd_Hide
 *   /liveview.jpg                             → Einzelbild der Live-Vorschau
 * Das Auflisten der Kameras (`?slc=list&param1=cameras`) ist im Handbuch nicht
 * ausdrücklich beschrieben; schlägt es fehl, arbeiten wir trotzdem weiter und
 * melden nur „Kameraliste nicht lesbar".
 */

const fs = require('node:fs');
const path = require('node:path');

const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));

/** Ein Aufruf an digiCamControl. Gibt immer Text zurück, wirft bei Netzfehlern. */
async function ruf(basis, pfad, zeit = 8000) {
  const ctrl = new AbortController();
  const uhr = setTimeout(() => ctrl.abort(), zeit);
  try {
    const res = await fetch(basis + pfad, { signal: ctrl.signal });
    const text = (await res.text()).trim();
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + text.slice(0, 120));
    return text;
  } finally {
    clearTimeout(uhr);
  }
}

/** Läuft digiCamControl, und welche Kameras hängen dran? */
async function status(basis) {
  try {
    /* `lastcaptured` ist der billigste Aufruf, der beweist, dass jemand
       zuhört – und er verändert nichts an der Kamera. */
    await ruf(basis, '/?slc=get&param1=lastcaptured&param2=', 4000);
  } catch (err) {
    return {
      erreichbar: false,
      fehler: err.name === 'AbortError' ? 'Keine Antwort (Zeitüberschreitung)' : err.message,
      hinweis: 'Läuft digiCamControl, und ist dort unter Einstellungen der Webserver eingeschaltet?',
    };
  }

  let kameras = [];
  let listeLesbar = true;
  try {
    const roh = await ruf(basis, '/?slc=list&param1=cameras&param2=', 4000);
    kameras = roh.split(/\r?\n/).map((z) => z.trim()).filter((z) => z && z !== 'OK' && z !== '-');
  } catch {
    listeLesbar = false;
  }
  return { erreichbar: true, kameras, listeLesbar };
}

/**
 * Auslösen und warten, bis die Datei da ist.
 * digiCamControl legt sie direkt in unseren Fotoordner; klappt das nicht,
 * holen wir sie über /image/<name> nach.
 */
async function ausloesen(basis, zielOrdner, { warteMs = 25000 } = {}) {
  const vorher = await ruf(basis, '/?slc=get&param1=lastcaptured&param2=').catch(() => '');

  /* Zielordner und Namensschema setzen. Fehlschläge sind nicht tödlich –
     dann liegt das Bild eben im Ordner von digiCamControl und wird geholt. */
  const marke = 'youbooth_' + Date.now();
  await ruf(basis, '/?slc=set&param1=session.folder&param2=' + encodeURIComponent(zielOrdner)).catch(() => {});
  await ruf(basis, '/?slc=set&param1=session.filenametemplate&param2=' + encodeURIComponent(marke)).catch(() => {});

  await ruf(basis, '/?CMD=Capture', 15000);

  /* Warten, bis sich der zuletzt aufgenommene Name ändert und nicht mehr "-"
     ist. Eine Spiegelreflex braucht dafür je nach Karte ein paar Sekunden. */
  const bis = Date.now() + warteMs;
  let name = '';
  while (Date.now() < bis) {
    await schlaf(400);
    const jetzt = await ruf(basis, '/?slc=get&param1=lastcaptured&param2=').catch(() => '-');
    if (jetzt && jetzt !== '-' && jetzt !== vorher) { name = jetzt; break; }
  }
  if (!name) throw new Error('Kamera hat nicht ausgelöst oder die Datei kam nicht an');

  const nurName = path.basename(name);
  const ziel = path.join(zielOrdner, nurName);
  if (fs.existsSync(ziel)) return { datei: ziel, name: nurName, geholt: false };

  /* Nachholen: die Datei liegt woanders. */
  const res = await fetch(basis + '/image/' + encodeURIComponent(nurName));
  if (!res.ok) throw new Error('Bild nicht abholbar (HTTP ' + res.status + ')');
  const puffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(ziel, puffer);
  return { datei: ziel, name: nurName, geholt: true };
}

/** Einzelbild der Live-Vorschau. Gibt null zurück, wenn keine läuft. */
async function liveBild(basis) {
  try {
    const res = await fetch(basis + '/liveview.jpg');
    if (!res.ok) return null;
    const puffer = Buffer.from(await res.arrayBuffer());
    return puffer.length > 100 ? puffer : null;
  } catch { return null; }
}

const liveAn = (basis) => ruf(basis, '/?CMD=LiveViewWnd_Show').catch(() => null);
const liveAus = (basis) => ruf(basis, '/?CMD=LiveViewWnd_Hide').catch(() => null);

module.exports = { status, ausloesen, liveBild, liveAn, liveAus };
