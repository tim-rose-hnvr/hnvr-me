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

const { app, BrowserWindow, dialog, ipcMain, session, shell, powerSaveBlocker } = require('electron');
const { fork } = require('node:child_process');
const { sucheLaufendeBox, ersterFreierPort, wieStarten } = require('./finden.cjs');
const path = require('node:path');
const fs = require('node:fs');

/* Der Wunschport. Ist er belegt, weicht die Box aus und sagt uns über den
   Nachrichtenkanal, wo sie gelandet ist — geraten wird hier nichts. */
const PORT_WUNSCH = Number(process.env.PORT || 3377);

/* Womit die Hülle aufmacht: der Zentrale, nicht dem Booth.
   Wer gerade installiert hat, will zuerst wissen, ob Drucker, Kamera und Netz
   stehen, will sich anmelden und die Lizenz eintragen — und erst danach den
   Booth öffnen. Vorher sprang die Box sofort in den Booth und ins Vollbild;
   dort gibt es keine Leiste und keinen sichtbaren Weg zurück.

   `adresse` bleibt dabei die HERKUNFT ohne Pfad. Sie ist nicht nur das Ziel
   beim Öffnen, sondern auch der Maßstab für zwei Prüfungen weiter unten:
   welche Links nach außen gehören und wer die Kamera bekommen darf. Stünde
   hier ein Pfad, wäre der Booth unter `/index.html` plötzlich „fremd" — und
   bekäme keine Kamera mehr. */
const STARTSEITE = '/zentrale.html';
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

/* Was die Box beim Start von sich gibt. Landet im Fehlerfenster und in der
   Datei daneben — ein Betreiber vor einer wartenden Gesellschaft kann mit
   „antwortet nicht" nichts anfangen, mit der Zeile aus dem Protokoll schon. */
let protokoll = [];

function merke(zeile) {
  protokoll.push(String(zeile).trimEnd());
  if (protokoll.length > 80) protokoll.shift();
}

/**
 * Wo liegt der Server?
 *
 * Neben der Hülle, als gewöhnliche Datei. Das Programm wird bewusst OHNE
 * `asar` gepackt — das Archiv hätte hier nichts gebracht und vier Fehler
 * gekostet: Ein Kindprozess kann nicht daraus starten, und wenn man den
 * Serverordner daneben auspackt, sucht er seine Abhängigkeiten, seine
 * `package.json` und seine `formate.json` an Stellen, die es im Archiv gibt
 * und daneben nicht. Genau daran ist der erste Windows-Installer gescheitert.
 *
 * Verheimlichen ließe sich damit ohnehin nichts: Der Quelltext ist offen.
 */
function serverPfad() {
  return path.join(__dirname, '..', 'server', 'server.js');
}

/* Wie oft die Box nach einem Absturz neu gestartet wurde. Ohne Zähler dreht
   sich bei einem Startfehler eine Schleife, die niemand sieht. */
let neustarts = 0;

/* Auf welchem Port die eigene Box laufen soll. Meist der Wunschport — aber
   nicht, wenn dort eine alte Fassung klebt, die sich nicht bitten lässt. */
let portFuerUns = PORT_WUNSCH;

function starteBox() {
  const skript = serverPfad();
  merke(`Starte ${skript}`);

  server = fork(skript, [], {
    env: {
      ...process.env,
      YOUBOOTH_DATEN: DATEN,
      YOUBOOTH_OBERFLAECHE: path.join(__dirname, '..', 'dist'),
      PORT: String(portFuerUns),
      // Damit der Server nicht in ein Archiv greifen muss, um zu wissen,
      // welche Fassung er ist.
      YOUBOOTH_FASSUNG: app.getVersion(),
      // Ohne das startet Electron eine zweite Fensteranwendung statt Node.
      ELECTRON_RUN_AS_NODE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });

  server.stdout?.on('data', (d) => {
    process.stdout.write('[Box] ' + d);
    merke(d);
  });
  server.stderr?.on('data', (d) => {
    process.stderr.write('[Box] ' + d);
    merke(d);
  });

  /* Kann der Prozess gar nicht erst starten, gibt es kein `exit`, sondern
     `error` — und ohne diesen Zuhörer stirbt die Hülle mit einer nackten
     Ausnahme. */
  server.on('error', (fehler) => merke('Start fehlgeschlagen: ' + fehler.message));

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
  server.on('exit', async (code, signal) => {
    if (beendet) return;
    merke(`Die Box ist beendet worden (Code ${code}${signal ? ', Signal ' + signal : ''}).`);

    /* Code 0 heißt: sie hat sich absichtlich verabschiedet — fast immer,
       weil auf dem Port schon eine läuft. Dann ist Neustarten genau falsch;
       richtig ist, die vorhandene zu benutzen. */
    if (code === 0) {
      const laeuft = await sucheLaufendeBox(PORT_WUNSCH);
      /* NUR bei gleicher Fassung übernehmen. Eine ältere Box liefert ihre
         eigene, alte Oberfläche aus — der Betreiber hätte aktualisiert und
         sähe davon nichts. Genau das wäre in dem Fall passiert, der diesen
         Umbau ausgelöst hat: Die alte Fassung kannte `/api/beenden` noch
         nicht, ließ sich also nicht bitten, und wäre dann übernommen worden. */
      if (laeuft && laeuft.version === app.getVersion()) {
        merke(`Es läuft bereits eine Box auf Port ${laeuft.port} (Fassung ${laeuft.version}) — sie wird benutzt.`);
        adresse = `http://127.0.0.1:${laeuft.port}`;
        server = null;
        if (meldeBereit) {
          meldeBereit();
          meldeBereit = null;
        }
        return;
      }
      if (laeuft) {
        merke(`Auf Port ${laeuft.port} klebt Fassung ${laeuft.version} — wir weichen aus.`);
        portFuerUns = await ersterFreierPort(PORT_WUNSCH);
      }
    }

    if (neustarts >= 5) {
      merke('Fünf Startversuche ohne Erfolg — es wird nicht weiter versucht.');
      return;
    }
    neustarts++;
    console.error(`[Hülle] Neustart ${neustarts} in 2 s.`);
    /* Nur neu starten, solange das Fenster steht. Stürzt sie beim Start immer
       wieder, dreht sich sonst eine Schleife, die niemand sieht. */
    if (fenster) setTimeout(starteBox, 2000);
  });
}

/**
 * Wartet auf die Meldung der Box. Kommt sie nicht, ist etwas grundsätzlich
 * kaputt — dann ein Fenster mit einem Satz statt eines Stapelaufrufs.
 */
function warteAufBox(sekunden = 45) {
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

/* Die Oberfläche darf das Vollbild schalten — mehr nicht. Sie sagt „jetzt
   läuft der Abend", die Hülle setzt es um. */
ipcMain.handle('huelle:vollbild', (_ereignis, an) => {
  if (!fenster) return false;
  fenster.setFullScreen(!!an);
  return fenster.isFullScreen();
});
ipcMain.handle('huelle:ist-vollbild', () => (fenster ? fenster.isFullScreen() : false));

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

  /* Im FENSTER starten, nicht im Vollbild.
     Vorher sprang die Box beim Öffnen sofort ins Vollbild — mitten in der
     Einrichtung, wo man noch Drucker wählt, Vorlagen ansieht und zwischen
     Programmen wechselt, ist das eine Falle: Es gibt keine Leiste, keinen
     sichtbaren Weg zurück, und der Betreiber sitzt fest.

     Vollbild ist der Zustand für den ABEND, nicht für die Vorbereitung. Es
     kommt deshalb auf Zuruf: F11, oder aus der Oberfläche heraus. */
  fenster.once('ready-to-show', () => {
    fenster.show();
  });

  /* F11 ist das, was jeder ohne Anleitung probiert. Escape führt zurück —
     auch das erwartet man, und ohne Leiste gibt es sonst keinen Weg. */
  fenster.webContents.on('before-input-event', (ereignis, eingabe) => {
    if (eingabe.type !== 'keyDown') return;
    if (eingabe.key === 'F11') {
      fenster.setFullScreen(!fenster.isFullScreen());
      ereignis.preventDefault();
    } else if (eingabe.key === 'Escape' && fenster.isFullScreen()) {
      fenster.setFullScreen(false);
      ereignis.preventDefault();
    }
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

  void fenster.loadURL(adresse + STARTSEITE);
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

/**
 * Woher die neue Fassung kommt: von youbooth.me.
 *
 * Die Adresse steht in `package.json` unter `build.publish` und landet beim
 * Verpacken als `app-update.yml` neben dem Programm. Sie zeigt bewusst auf
 * die eigene Domain und nicht auf die Ablage, in der die Datei zufällig
 * liegt: Der Ablageort darf sich ändern, ohne dass jede installierte Box
 * daran hängen bleibt — der Wegweiser auf youbooth.me führt dann eben
 * woandershin.
 */
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

    /* Vor dem eigenen Start nachsehen, ob schon eine Box läuft. Die
       Entscheidung selbst steht in `finden.cjs` — dort hängt sie nicht an
       Electron und wird von `tools/start-probe.mjs` durchgemessen. */
    const entscheidung = await wieStarten(PORT_WUNSCH, app.getVersion(), merke);
    portFuerUns = entscheidung.port;

    if (entscheidung.art === 'benutzen') {
      adresse = `http://127.0.0.1:${entscheidung.port}`;
      baueFenster();
      pruefeAktualisierung();
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) baueFenster();
      });
      return;
    }

    starteBox();

    try {
      await warteAufBox();
    } catch (fehler) {
      /* Das Protokoll gehört neben die Daten, nicht ins Programmverzeichnis:
         Dort darf nicht geschrieben werden, und genau dann wird es gebraucht. */
      let abgelegt = '';
      try {
        fs.mkdirSync(DATEN, { recursive: true });
        abgelegt = path.join(DATEN, 'start-fehler.log');
        fs.writeFileSync(
          abgelegt,
          `youbooth ${app.getVersion()} · ${new Date().toISOString()}\n` +
            `${process.platform} ${process.arch} · Node ${process.versions.node}\n\n` +
            protokoll.join('\n') + '\n'
        );
      } catch {
        /* Wenn nicht einmal das geht, bleibt der Text im Fenster. */
      }

      dialog.showErrorBox(
        'Die Box startet nicht',
        'Der Dienst der Box hat nicht geantwortet.\n\n' +
          'Was er zuletzt gesagt hat:\n' +
          (protokoll.slice(-12).join('\n') || '(nichts)') +
          '\n\nMeistens hilft: den Rechner neu starten. Dann ist ein ' +
          'übrig gebliebener Dienst einer früheren Fassung sicher weg.' +
          (abgelegt ? `\n\nVollständig in:\n${abgelegt}` : '')
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
