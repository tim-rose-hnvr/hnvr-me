/**
 * Die Web-Kamera — eine Fotobox auf dem Handy des Gastes.
 *
 * Die Box nimmt Aufnahmen von fremden Geräten seit Langem entgegen
 * (`POST /api/photos` mit `source: 'guest'`); es fehlte die Seite, auf der
 * jemand sie macht. Gebraucht wird sie in drei Lagen: in der Testphase ohne
 * Hardware, bei Feiern an mehreren Orten gleichzeitig, und wenn vor der
 * einen Box eine Schlange steht.
 *
 * Drei Entscheidungen, die den Unterschied machen:
 *
 *  1. **Rückkamera zuerst.** Ein Gast, der eine Fotobox öffnet, will meist
 *     die Gruppe gegenüber fotografieren, nicht sich selbst. Umschalten geht
 *     mit einem Griff.
 *  2. **Erst ansehen, dann senden.** Anders als der Booth, der sofort
 *     ablegt: Hier hält niemand die Kamera ruhig, und ein verwackeltes Bild
 *     soll nicht in der Galerie des Paares landen.
 *  3. **Kein Konto, keine App.** Wer auf einer Feier etwas installieren
 *     soll, macht kein Foto.
 */

import './stil.css';
import './gastkamera.css';
import { Kamera, deuteFehler } from './kamera';

type Lage = 'start' | 'live' | 'ansehen' | 'sendet' | 'fertig' | 'fehler';

const wurzel = document.getElementById('gastkamera');
if (wurzel) void starte(wurzel);

async function starte(ziel: HTMLElement): Promise<void> {
  const video = document.createElement('video');
  video.className = 'gklive';
  video.playsInline = true;
  video.muted = true;
  video.setAttribute('aria-hidden', 'true');

  const kamera = new Kamera(video);
  /* Vorn oder hinten. Die Kameraklasse der Box kennt nur „vorn"; hier wird
     der Strom deshalb selbst geholt, wenn umgeschaltet wird. */
  let seite: 'environment' | 'user' = 'environment';
  let aufnahme: HTMLCanvasElement | null = null;
  let lage: Lage = 'start';
  let grund = '';

  const flaeche = tag('div', 'gkflaeche');
  const buehne = tag('div', 'gkbuehne');
  const vorschau = document.createElement('img');
  vorschau.className = 'gkvorschau';
  vorschau.alt = 'Deine Aufnahme';
  const blitz = tag('span', 'gkblitz');
  const zaehler = tag('span', 'gkzaehler');
  buehne.append(video, vorschau, blitz, zaehler);

  const leiste = tag('div', 'gkleiste');
  const sagt = tag('p', 'gksagt');
  sagt.setAttribute('role', 'status');

  flaeche.append(buehne, sagt, leiste);
  ziel.replaceChildren(flaeche);

  /* --- Was in welcher Lage dasteht --- */
  const zeichne = (): void => {
    flaeche.dataset.lage = lage;
    leiste.replaceChildren();

    if (lage === 'start') {
      sagt.textContent = 'Ein Foto für den Abend. Es landet in der Galerie und auf der Wand.';
      leiste.append(knopf('Kamera einschalten', 'amber', () => void anschalten()));
      return;
    }

    if (lage === 'live') {
      sagt.textContent = 'Bereit. Auslösen, ansehen, dann erst senden.';
      leiste.append(
        knopf('Wenden', 'still', () => void wende()),
        ausloeser(() => void loeseAus()),
        knopf('Abbrechen', 'still', () => {
          kamera.stoppe();
          lage = 'start';
          zeichne();
        })
      );
      return;
    }

    if (lage === 'ansehen') {
      sagt.textContent = 'Passt das? Erst wenn du sendest, sieht es jemand.';
      leiste.append(
        knopf('Noch mal', 'still', () => {
          aufnahme = null;
          lage = 'live';
          zeichne();
        }),
        knopf('Senden', 'amber', () => void sende())
      );
      return;
    }

    if (lage === 'sendet') {
      sagt.textContent = 'Wird gesendet …';
      return;
    }

    if (lage === 'fertig') {
      sagt.textContent = 'Angekommen. Es hängt gleich auf der Wand.';
      leiste.append(knopf('Noch eins', 'amber', () => void anschalten()));
      return;
    }

    sagt.textContent = grund;
    leiste.append(knopf('Noch einmal versuchen', 'amber', () => void anschalten()));
  };

  const anschalten = async (): Promise<void> => {
    aufnahme = null;
    vorschau.removeAttribute('src');
    try {
      await hole(seite);
      lage = 'live';
    } catch (fehler) {
      const gedeutet = deuteFehler(fehler);
      grund = gedeutet.text;
      lage = 'fehler';
    }
    zeichne();
  };

  /** Den Strom selbst holen, damit die Seite wählbar bleibt. */
  const hole = async (welche: 'user' | 'environment'): Promise<void> => {
    kamera.stoppe();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('keine');
    const strom = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: welche },
      audio: false,
    });
    video.srcObject = strom;
    await video.play();
    if (video.videoWidth === 0) {
      await new Promise<void>((fertig) =>
        video.addEventListener('loadedmetadata', () => fertig(), { once: true })
      );
    }
    /* Damit `kamera.stoppe()` beim nächsten Wechsel auch diesen Strom
       schließt — sonst leuchtet die Kamera weiter, während der Gast schon
       das Bild ansieht. */
    (kamera as unknown as { strom: MediaStream | null }).strom = strom;
  };

  const wende = async (): Promise<void> => {
    seite = seite === 'user' ? 'environment' : 'user';
    try {
      await hole(seite);
    } catch {
      /* Manche Geräte haben nur eine Kamera. Dann bleibt es bei der einen —
         eine Fehlermeldung dafür wäre lauter als das Problem. */
      seite = seite === 'user' ? 'environment' : 'user';
      await hole(seite).catch(() => undefined);
    }
    zeichne();
  };

  const loeseAus = async (): Promise<void> => {
    for (const zahl of [3, 2, 1]) {
      zaehler.textContent = String(zahl);
      zaehler.dataset.an = '';
      await warte(700);
      zaehler.removeAttribute('data-an');
      await warte(120);
    }
    zaehler.textContent = '';

    blitz.dataset.an = '';
    window.setTimeout(() => blitz.removeAttribute('data-an'), 320);

    /* Die vordere Kamera zeigt gespiegelt — der Abzug darf es nicht sein,
       sonst steht jede Schrift im Bild verkehrt herum. */
    aufnahme = kamera.standbild(seite === 'user');
    vorschau.src = aufnahme.toDataURL('image/jpeg', 0.9);
    kamera.stoppe();
    lage = 'ansehen';
    zeichne();
  };

  const sende = async (): Promise<void> => {
    if (!aufnahme) return;
    lage = 'sendet';
    zeichne();
    try {
      const antwort = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: aufnahme.toDataURL('image/jpeg', 0.9),
          source: 'guest',
          mode: 'gast',
        }),
      });
      if (!antwort.ok) throw new Error(String(antwort.status));
      lage = 'fertig';
    } catch {
      /* Die Aufnahme NICHT verwerfen: Wer sie gerade gemacht hat, soll sie
         nicht verlieren, weil das WLAN einen Moment weg war. */
      grund = 'Das kam nicht an. Noch einmal senden?';
      lage = 'ansehen';
      sagt.textContent = grund;
    }
    zeichne();
  };

  zeichne();
}

/* ------------------------------------------------------------------ */

function ausloeser(tue: () => void): HTMLButtonElement {
  const k = document.createElement('button');
  k.type = 'button';
  k.className = 'gkausloeser';
  k.setAttribute('aria-label', 'Auslösen');
  k.append(tag('span', 'gkring'));
  k.addEventListener('click', tue);
  return k;
}

function knopf(text: string, art: 'amber' | 'still', tue: () => void): HTMLButtonElement {
  const k = document.createElement('button');
  k.type = 'button';
  k.className = art === 'amber' ? 'knopf knopf--amber gkknopf' : 'knopf knopf--rahmen-hell gkknopf';
  k.textContent = text;
  k.addEventListener('click', tue);
  return k;
}

function tag(name: string, klasse: string): HTMLElement {
  const el = document.createElement(name);
  el.className = klasse;
  return el;
}

const warte = (ms: number) => new Promise<void>((fertig) => window.setTimeout(fertig, ms));
