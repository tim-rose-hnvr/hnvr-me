/* Installieren — aus der Seite eine Anwendung machen.

   Vier Dinge, die zusammengehören und deshalb hier zusammenstehen:

   1. **Den Dienst anmelden.** Danach läuft das Studio ohne Netz. Wird eine
      neue Fassung veröffentlicht, meldet sich der Dienst und das Studio
      bietet an, neu zu starten — es tut das nicht von selbst, weil dabei ein
      ungesichertes Dokument verloren ginge.

   2. **Den Installationsknopf.** Der Browser sagt, wann er bereit ist
      (`beforeinstallprompt`); vorher gibt es nichts zu drücken. Auf Safari
      gibt es dieses Ereignis nicht — dort steht stattdessen der Weg über das
      Teilen-Menü.

   3. **Vorrat anlegen.** Der Kern liegt nach dem Einrichten da; Texterkennung,
      qpdf und die Zeichentabellen sind 9 MB, die nicht jeder braucht. Wer sie
      im Zug braucht, holt sie vorher mit einem Knopf.

   4. **Dateien vom Betriebssystem annehmen.** Ein installiertes PDF Studio darf
      im „Öffnen mit" stehen. Was so hereinkommt, wird geöffnet wie eine
      gewählte Datei — es gibt keinen zweiten Weg ins Dokument.

   Nichts davon ist Vorbedingung: ohne Dienst, ohne Installation und ohne
   `launchQueue` läuft das Studio unverändert. Das ist Absicht — es darf von
   nichts abhängen, auch nicht von der eigenen Verpackung. */

import { $, sage, melde, hoer, el } from './kern.js';

let angebot = null;            // das aufgehobene `beforeinstallprompt`
let anmeldung = null;          // die ServiceWorkerRegistration, wenn es eine gibt

export function istInstalliert() {
  return matchMedia('(display-mode: standalone)').matches
    || matchMedia('(display-mode: window-controls-overlay)').matches
    || navigator.standalone === true;
}

export function kannInstallieren() { return angebot !== null; }

/** Ob überhaupt ein Dienst läuft — sonst hat „offline" keine Bedeutung. */
export function dienstLaeuft() { return !!navigator.serviceWorker?.controller; }

export async function starteInstallieren() {
  hoerAufsAngebot();
  nimmDateienAn();
  await meldeDienstAn();
}

function hoerAufsAngebot() {
  addEventListener('beforeinstallprompt', (ereignis) => {
    /* Ohne dieses `preventDefault` zeigt der Browser seine eigene Leiste und
       das Ereignis ist verbraucht. Wir wollen den Knopf an unserer Stelle. */
    ereignis.preventDefault();
    angebot = ereignis;
    melde('installieren:moeglich');
  });
  addEventListener('appinstalled', () => {
    angebot = null;
    melde('installieren:erledigt');
    sage('PDF Studio ist installiert — es steht jetzt im Startmenü.', { dauer: 6000 });
  });
}

/** Fragt den Browser. Liefert 'accepted', 'dismissed' oder 'nicht-moeglich'. */
export async function frageInstallation() {
  if (!angebot) return 'nicht-moeglich';
  angebot.prompt();
  const { outcome } = await angebot.userChoice;
  /* Ein Angebot gilt genau einmal. Lehnt jemand ab, schickt der Browser
     später ein neues — deshalb hier vergessen, nicht aufheben. */
  angebot = null;
  melde('installieren:beantwortet');
  return outcome;
}

async function meldeDienstAn() {
  if (!('serviceWorker' in navigator)) return;
  /* Über `file://` und in manchen eingebetteten Rahmen gibt es keinen Dienst.
     Das ist kein Fehler, nur weniger Offline. */
  try {
    anmeldung = await navigator.serviceWorker.register('dienst.js', { scope: './' });
  } catch (fehler) {
    console.info('Kein Dienst angemeldet:', fehler.message);
    return;
  }

  anmeldung.addEventListener('updatefound', () => {
    const neuer = anmeldung.installing;
    if (!neuer) return;
    neuer.addEventListener('statechange', () => {
      if (neuer.state !== 'installed' || !navigator.serviceWorker.controller) return;
      /* Eine neue Fassung liegt bereit. Nicht von selbst wechseln: ein
         Neuladen wirft das offene Dokument weg. Der Mensch entscheidet. */
      sage('Eine neue Fassung des Studios liegt bereit.', {
        dauer: 0,
        aktion: { beschriftung: 'Neu starten', tun: () => location.reload() },
      });
    });
  });
}

/**
 * Holt den Nachschub — Texterkennung, qpdf, Zeichentabellen — vorab in den
 * Zwischenspeicher.
 * @param {(stand: {fertig: number, gesamt: number}) => void} [beiFortschritt]
 * @returns {Promise<{fertig: number, gesamt: number}>}
 */
export function holeVorrat(beiFortschritt = null) {
  const dienst = navigator.serviceWorker?.controller;
  if (!dienst) return Promise.reject(new Error('Kein Dienst angemeldet — ohne ihn gibt es keinen Vorrat.'));

  return new Promise((loese, weise) => {
    const zeitgeber = setTimeout(() => {
      navigator.serviceWorker.removeEventListener('message', hoere);
      weise(new Error('Der Vorrat kam nicht durch — vermutlich fehlt das Netz.'));
    }, 180000);

    function hoere(ereignis) {
      const { art, fertig, gesamt } = ereignis.data || {};
      if (art === 'nachschub-stand') beiFortschritt?.({ fertig, gesamt });
      if (art !== 'nachschub-fertig') return;
      clearTimeout(zeitgeber);
      navigator.serviceWorker.removeEventListener('message', hoere);
      loese({ fertig, gesamt });
    }

    navigator.serviceWorker.addEventListener('message', hoere);
    dienst.postMessage({ art: 'nachschub-holen' });
  });
}

/** Wieviel im Zwischenspeicher liegt, in Bytes — 0, wenn der Browser nichts sagt. */
export async function vorratsGroesse() {
  try {
    const { usage = 0 } = await navigator.storage.estimate();
    return usage;
  } catch { return 0; }
}

/* Dateien, die das Betriebssystem hereinreicht: „Öffnen mit → PDF Studio".
   Es gibt keinen eigenen Weg ins Dokument — dieselbe Meldung wie beim
   Dateiwähler, damit nicht zwei Wege auseinanderlaufen können. */
function nimmDateienAn() {
  if (!('launchQueue' in window)) return;
  window.launchQueue.setConsumer(async (start) => {
    if (!start?.files?.length) return;
    const dateien = [];
    for (const griff of start.files) {
      try { dateien.push(await griff.getFile()); } catch { /* Griff abgelaufen */ }
    }
    if (dateien.length) melde('dateien:hereingereicht', dateien);
  });
}

/* Ein Wort in der Fußzeile: läuft das Studio offline-fest oder nicht. Es
   steht dort und nicht in einem Dialog, weil es eine Eigenschaft ist, keine
   Nachricht — man sieht hin, wenn man es wissen will. */
export function zeichneStand(behaelter) {
  behaelter.innerHTML = '';
  const laeuft = dienstLaeuft();
  behaelter.append(el('span', {
    klasse: `punkt stand-punkt ${laeuft ? 'ist-bereit' : ''}`,
    'aria-hidden': 'true',
  }));
  behaelter.append(el('span', {
    text: laeuft ? (istInstalliert() ? 'installiert, läuft offline' : 'läuft offline')
      : 'nur mit Netz',
    title: laeuft
      ? 'Das Studio ist auf diesem Gerät hinterlegt und startet ohne Verbindung.'
      : 'Es ist kein Dienst angemeldet — ohne Verbindung startet das Studio nicht.',
  }));
}
