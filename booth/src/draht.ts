/**
 * Der Draht zur Box — eine offene Verbindung statt ständigem Nachfragen.
 *
 * Vier Oberflächen schauen gleichzeitig auf dieselbe Box: Booth, Foto-Wall am
 * Beamer, Galerie auf dem Handy, Cockpit am Laptop. Ohne Draht müsste jede im
 * Takt nachfragen — bei fünf Sekunden Takt sieht die Wand ein neues Bild im
 * Mittel erst nach zweieinhalb, und zwanzig Geräte machen daraus eine
 * Dauerlast auf einer Box, die nebenbei druckt.
 *
 * Die Box sagt von sich aus Bescheid: neue Aufnahme, geänderte Einstellungen,
 * geänderte Vorlagen. Diese Datei nimmt das entgegen, führt den gemeinsamen
 * Stand nach und ruft die Oberfläche.
 *
 * Bricht die Verbindung ab, wird sie wieder aufgebaut — mit wachsender Pause,
 * damit ein neu startender Server nicht von zwanzig Geräten gleichzeitig
 * angesprungen wird. Bis dahin läuft jede Oberfläche mit dem Stand weiter, den
 * sie hat: Ein Ausfall darf Komfort kosten, niemals Daten.
 */

import { einstellungenGeaendert } from './einstellungen';
import { vorlagenGeaendert } from './vorlagen';

/* Wer am Draht hängt. Die Rolle steht in der Adresse, damit der Server
   gezielt eine Sorte Oberfläche ansprechen kann — „alle Wände neu laden"
   soll nicht den Booth mitreißen. */
export type Rolle =
  | 'booth'
  | 'cockpit'
  | 'wand'
  | 'galerie'
  | 'editor'
  | 'einrichtung'
  | 'gaestebuch';

export type Nachricht = { type: string } & Record<string, unknown>;

/** Erste Pause nach einem Abbruch, danach verdoppelt bis zur Obergrenze. */
const PAUSE_ANFANG = 1000;
const PAUSE_MAX = 20000;

function adresse(rolle: Rolle): string {
  const schema = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${schema}//${location.host}/ws?role=${encodeURIComponent(rolle)}`;
}

/**
 * Verbindet die Oberfläche mit der Box.
 *
 * `horcher` bekommt jede Nachricht — auch die, die hier schon verarbeitet
 * wurden, denn die Oberfläche muss danach neu zeichnen. Der Rückgabewert
 * trennt die Verbindung wieder.
 */
export function amDraht(rolle: Rolle, horcher: (n: Nachricht) => void): () => void {
  let draht: WebSocket | null = null;
  let pause = PAUSE_ANFANG;
  let uhr: number | null = null;
  let beendet = false;

  const verbinde = () => {
    if (beendet) return;
    let neu: WebSocket;
    try {
      neu = new WebSocket(adresse(rolle));
    } catch {
      spaeterNochmal();
      return;
    }
    draht = neu;

    neu.addEventListener('open', () => {
      pause = PAUSE_ANFANG;
    });

    neu.addEventListener('message', (e) => {
      let nachricht: Nachricht;
      try {
        nachricht = JSON.parse(String(e.data)) as Nachricht;
      } catch {
        return; // Kein JSON — dann eben nicht. Die Oberfläche läuft weiter.
      }
      verarbeite(nachricht);
      try {
        horcher(nachricht);
      } catch {
        // Ein Fehler beim Zeichnen darf die Verbindung nicht mitreißen.
      }
    });

    neu.addEventListener('close', spaeterNochmal);
    neu.addEventListener('error', () => {
      try {
        neu.close();
      } catch {
        /* schließt sich ohnehin */
      }
    });
  };

  const spaeterNochmal = () => {
    if (beendet || uhr !== null) return;
    uhr = window.setTimeout(() => {
      uhr = null;
      verbinde();
    }, pause);
    pause = Math.min(pause * 2, PAUSE_MAX);
  };

  verbinde();

  return () => {
    beendet = true;
    if (uhr !== null) window.clearTimeout(uhr);
    try {
      draht?.close();
    } catch {
      /* war schon zu */
    }
  };
}

/**
 * Was jede Oberfläche gleich behandeln muss: der gemeinsame Stand. Wer im
 * Cockpit den Eventnamen ändert, ändert ihn für die Wand am Beamer mit — sonst
 * stünden zwei Namen im selben Raum.
 */
function verarbeite(n: Nachricht): void {
  if ((n.type === 'settings' || n.type === 'hello') && n.settings && typeof n.settings === 'object') {
    einstellungenGeaendert(n.settings as Record<string, unknown>);
  }
  if (n.type === 'templates' && Array.isArray(n.templates)) {
    vorlagenGeaendert({ templates: n.templates as unknown[] });
  }
}

/**
 * Der Befehl „alle Bildschirme neu laden" aus dem Cockpit. Er kommt nach
 * einem Update und nach einem Vorlagenwechsel, den die Oberfläche nicht
 * nachziehen kann — und er darf während einer laufenden Aufnahme nicht
 * greifen, deshalb entscheidet die Oberfläche selbst, wann sie ihn befolgt.
 */
export function istNeuladen(n: Nachricht, rolle: Rolle): boolean {
  if (n.type !== 'control' || n.action !== 'reload') return false;
  const ziel = typeof n.target === 'string' ? n.target : 'all';
  return ziel === 'all' || ziel === rolle;
}
