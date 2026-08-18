/**
 * Die Desktop-Hülle. Sie startet die Box und zeigt sie im Vollbild.
 *
 * Warum Electron und nicht mehr Tauri: Die Box ist seit der Zusammenführung
 * ein Node-Server — Aufnahmen, Einstellungen, Vorlagen, Buchungen, Druck.
 * Tauri bringt keine Node-Laufzeit mit; die Hülle hätte den Server nicht
 * starten können. Electron bringt sie mit, und derselbe Server läuft dann
 * unverändert auf dem Rechner des Betreibers wie hier im Entwicklungsbetrieb.
 *
 * Drei Dinge macht die Hülle, die ein Browser nicht kann:
 *   1. Vollbild ohne Leiste — auf einer Feier fasst niemand eine Adresszeile an
 *   2. Betriebsdaten an einem Ort, den das Betriebssystem dafür vorsieht
 *   3. Selbstaktualisierung, aber nie mitten in einer Feier
 */

const { app, BrowserWindow, dialog, session, shell, powerSaveBlocker } = require('electron');
const { fork } = require('node:child_process');
const path = require('node:path');

/* Der Wunschport. Ist er belegt, weicht die Box aus und sagt uns über den
   Nachrichtenkanal, wo sie gelandet ist — geraten wird hier nichts. */
const PORT_WUNSCH = Number(process.env.PORT || 3377);
let adresse = `http://127.0.0.1:${PORT_WUNSCH}`;

/* Betriebsdaten gehören NICHT ins Programmverzeichnis: Unter Windows liegt es
   in `Program Files` und ist schreibgeschützt, und beim Aktualisieren wird es
   ersetzt. Beides hätte die Aufnahmen eines Abends gekostet. */
const DATEN = path.join(app.getPath('userData'), 'daten');

let fenster = null;
let server = null;
let meldeBereit = null;
let schlafsperre = null;
let beendet = false;

/* ---------------------------------------------------------------- */
/* Die Box                                                           */
/* ---------------------------------------------------------------- */

function starteBox() {
  const skript = path.join(__dirname, '..', 'server', 'server.js');

  server = fork(skript, [], {
    env: {
      ...process.env,
      YOUBOOTH_DATEN: DATEN,
      YOUBOOTH_OBERFLAECHE: path.join(__dirname, '..', 'dist'),
      PORT: String(PORT_WUNSCH),
      // Ohne das startet Electron eine zweite Fensteranwendung statt Node.
      ELECTRON_RUN_AS_NODE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });

  server.stdout?.on('data', (d) => process.stdout.write('[Box] ' + d));
  server.stderr?.on('data', (d) => process.stderr.write('[Box] ' + d));

  server.on('message', (nachricht) => {
    if (nachricht && nachricht.art === 'bereit') {
      adresse = `http://127.0.0.1:${nachricht.port}`;
      if (meldeBereit) {
        meldeBereit();
        meldeBereit = null;
      }
    }
  });

  /* Stirbt die Box mitten in einer Feier, ist Neustarten das einzig
     Richtige — die Aufnahmen liegen auf der Platte, der Abend läuft weiter. */
  server.on('exit', (code) => {
    if (beendet) return;
    console.error(`[Hülle] Die Box ist beendet worden (${code}). Neustart in 2 s.`);
    setTimeout(starteBox, 2000);
  });
}

/**
 * Wartet auf die Meldung der Box. Kommt sie nicht, ist etwas grundsätzlich
 * kaputt — dann ein Fenster mit einem Satz statt eines Stapelaufrufs.
 */
function warteAufBox(sekunden = 30) {
  return new Promise((fertig, scheitern) => {
    const uhr = setTimeout(() => {
      meldeBereit = null;
      scheitern(new Error('Die Box hat sich nicht gemeldet.'));
    }, sekunden * 1000);
    meldeBereit = () => {
      clearTimeout(uhr);
      fertig();
    };
  });
}

/* ---------------------------------------------------------------- */
/* Das Fenster                                                       */
/* ---------------------------------------------------------------- */

function baueFenster() {
  fenster = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#0b0b0d',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'vorschalt.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // Die Kamera fragt der Booth selbst an; ohne das kommt der Dialog
      // gar nicht erst, weil es in der Hülle keinen gibt, der ihn beantwortet.
      backgroundThrottling: false,
    },
  });

  fenster.once('ready-to-show', () => {
    fenster.show();
    fenster.setFullScreen(true);
  });

  /* Der Bildschirm darf während einer Feier nicht schlafen gehen. */
  schlafsperre = powerSaveBlocker.start('prevent-display-sleep');

  // Links nach außen gehören in den Browser, nicht in den Booth.
  fenster.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(adresse)) {
      void shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  void fenster.loadURL(adresse);
  fenster.on('closed', () => (fenster = null));
}

/* Kamerafreigabe: Auf dem eigenen Rechner gibt es niemanden, der einen Dialog
   wegklickt — und ohne Kamera nimmt die Box nichts auf. Erlaubt wird deshalb
   genau das, und nur für die eigene Adresse. */
function erlaubeKamera() {
  const sitzung = session.defaultSession;
  sitzung.setPermissionRequestHandler((inhalt, recht, erlauben) => {
    const vonUns = (inhalt.getURL() || '').startsWith(adresse);
    erlauben(vonUns && (recht === 'media' || recht === 'fullscreen'));
  });
}

/* ---------------------------------------------------------------- */
/* Selbstaktualisierung                                              */
/* ---------------------------------------------------------------- */

function pruefeAktualisierung() {
  let updater;
  try {
    updater = require('electron-updater').autoUpdater;
  } catch {
    return; // Im Entwicklungsbetrieb nicht vorhanden — dann eben nicht.
  }

  updater.autoDownload = true;
  /* NIE von selbst neu starten. Ein Neustart mitten in einer Feier ist der
     teuerste Fehler, den eine Selbstaktualisierung machen kann: Der Bildschirm
     verschwindet, während Gäste davorstehen. Eingespielt wird beim Beenden. */
  updater.autoInstallOnAppQuit = true;

  updater.on('update-downloaded', (stand) => {
    if (!fenster) return;
    void dialog
      .showMessageBox(fenster, {
        type: 'info',
        buttons: ['Jetzt neu starten', 'Beim nächsten Beenden'],
        defaultId: 1,
        cancelId: 1,
        title: 'Neue Fassung',
        message: `youbooth ${stand.version} liegt bereit.`,
        detail:
          'Eingespielt wird sie beim nächsten Beenden. Steht gerade keine Feier an, ' +
          'kann die Box auch sofort neu starten.',
      })
      .then(({ response }) => {
        if (response === 0) updater.quitAndInstall();
      });
  });

  updater.on('error', (fehler) => {
    console.error('[Hülle] Aktualisierung fehlgeschlagen:', fehler && fehler.message);
  });

  void updater.checkForUpdates().catch(() => null);
  // Einmal am Tag reicht: Eine Box läuft oft wochenlang durch.
  setInterval(() => void updater.checkForUpdates().catch(() => null), 24 * 60 * 60 * 1000);
}

/* ---------------------------------------------------------------- */
/* Ablauf                                                            */
/* ---------------------------------------------------------------- */

/* Zwei laufende Boxen auf einem Rechner streiten um den Port und um die
   Dateien. Der zweite Start holt deshalb nur das vorhandene Fenster nach vorn. */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!fenster) return;
    if (fenster.isMinimized()) fenster.restore();
    fenster.focus();
  });

  app.whenReady().then(async () => {
    erlaubeKamera();
    starteBox();

    try {
      await warteAufBox();
    } catch (fehler) {
      dialog.showErrorBox(
        'Die Box startet nicht',
        'Der Dienst der Box hat nicht geantwortet. Läuft schon eine zweite Fassung, ' +
          'oder sind die Ports ab ' + PORT_WUNSCH + ' alle belegt?'
      );
      app.quit();
      return;
    }

    baueFenster();
    pruefeAktualisierung();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) baueFenster();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    beendet = true;
    if (schlafsperre !== null && powerSaveBlocker.isStarted(schlafsperre)) {
      powerSaveBlocker.stop(schlafsperre);
    }
    if (server) server.kill();
  });
}
