/**
 * Slow-Motion — Red-Carpet-Zeitlupe an der Box.
 *
 * Zeitlupe entsteht nicht dadurch, dass man ein Video langsamer abspielt.
 * Sie entsteht dadurch, dass mehr Bilder aufgenommen als gezeigt werden:
 * Eine Kamera, die sechzig Bilder je Sekunde liefert, ergibt bei
 * fünfundzwanzig gezeigten Bildern eine 2,4-fache Zeitlupe — und zwar in
 * der Datei, nicht nur im Abspieler. Das ist der Unterschied zwischen einem
 * Clip, den man weiterschicken kann, und einem, der beim Empfänger wieder
 * schnell läuft.
 *
 * Wie viele Bilder je Sekunde eine Kamera hergibt, entscheidet die Kamera.
 * Ein eingebautes Notebook-Modul liefert dreißig, eine Action-Cam zweihundert.
 * Diese Seite verlangt das Höchste und **sagt dann, was sie bekommen hat** —
 * eine Zahl zu versprechen, die die Hardware nicht liefert, wäre die Art von
 * Zusage, die erst auf der Feier auffällt.
 *
 * Aufgenommen wird in zwei Schritten:
 *
 *  1. **Sammeln.** Jedes Bild der Kamera wird sofort als JPEG abgelegt.
 *     Rohe Bildpunkte zu behalten wäre einfacher und kostete bei vier
 *     Sekunden über hundert Megabyte — auf einem Booth-Rechner, der
 *     nebenbei druckt, ist das der Unterschied zwischen „läuft" und
 *     „läuft nicht mehr".
 *  2. **Ausspielen.** Die gesammelten Bilder laufen einmal langsam über eine
 *     Zeichenfläche, und genau das wird aufgezeichnet — mit Vorspann,
 *     Abspann und Rahmen. Der Gast sieht dabei seinen fertigen Clip: Die
 *     Rechenzeit IST die Vorschau, keine Wartezeit mit Balken.
 */

import './stil.css';
import './zeitlupe.css';

type Lage = 'start' | 'laeuft' | 'nimmt' | 'rechnet' | 'fertig' | 'fehler';

/** Was die Box über das Modul sagt. */
type Stand = { an: boolean; sekunden: number; event: string; logo: string | null };

/**
 * Wie stark die Zeitlupe angestrebt wird.
 *
 * Die Ausspielrate wird aus der GEMESSENEN Kamerarate abgeleitet, nicht fest
 * gesetzt. Eine feste Rate von fünfundzwanzig ergäbe bei einer Kamera, die
 * nur zwanzig Bilder liefert, einen Clip, der SCHNELLER läuft als die
 * Wirklichkeit — und der hieße dann trotzdem „Zeitlupe". Genau dieser Fall
 * ist bei eingebauten Notebook-Kameras der Normalfall.
 */
const ZIELFAKTOR = 2.5;
/** Unter zwölf Bildern je Sekunde ruckelt es sichtbar, über dreißig bringt
    es nichts mehr — dazwischen wird die Ausspielrate gewählt. */
const RATE_MIN = 12;
const RATE_MAX = 30;

/** Die Ausspielrate zu einer gemessenen Kamerarate. */
function zeigerateFuer(gemessen: number): number {
  if (!(gemessen > 0)) return RATE_MIN;
  return Math.max(RATE_MIN, Math.min(RATE_MAX, Math.round(gemessen / ZIELFAKTOR)));
}

const wurzel = document.getElementById('zeitlupe');
if (wurzel) void starte(wurzel);

async function starte(ziel: HTMLElement): Promise<void> {
  const stand = await holeStand();

  let lage: Lage = 'start';
  let grund = '';
  let strom: MediaStream | null = null;
  let gemessen = 0;
  let ergebnis: Blob | null = null;
  let marke: HTMLImageElement | null = null;

  if (stand.logo) marke = await ladeBild(stand.logo).catch(() => null);

  const video = document.createElement('video');
  video.className = 'zllive';
  video.playsInline = true;
  video.muted = true;
  video.setAttribute('aria-hidden', 'true');

  const tafel = document.createElement('canvas');
  tafel.className = 'zltafel';
  tafel.width = 1280;
  tafel.height = 720;

  const abspieler = document.createElement('video');
  abspieler.className = 'zlabspieler';
  abspieler.controls = true;
  abspieler.loop = true;
  abspieler.playsInline = true;

  const buehne = tag('div', 'zlbuehne');
  const zaehler = tag('span', 'zlzaehler');
  /* Eine leere dunkle Fläche sieht aus wie ein Fehler. Solange die Kamera aus
     ist, steht deshalb hier, warum nichts zu sehen ist — der Betreiber baut
     an dieser Stelle auf und soll nicht raten, ob das Gerät kaputt ist. */
  const ruhe = tag('div', 'zlruhe');
  ruhe.append(
    tag('span', 'zlruhe__marke', 'Kamera aus'),
    tag('p', 'zlruhe__text', 'Der Sucher erscheint, sobald die Kamera läuft.')
  );
  buehne.append(video, tafel, abspieler, ruhe, zaehler);

  const kopf = tag('header', 'zlkopf');
  kopf.append(tag('span', 'zlmarke', 'Zeitlupe'), tag('span', 'zlrate', ''));

  const sagt = tag('p', 'zlsagt');
  sagt.setAttribute('role', 'status');
  const leiste = tag('div', 'zlleiste');

  const flaeche = tag('div', 'zlflaeche');
  flaeche.append(kopf, buehne, sagt, leiste);
  ziel.replaceChildren(flaeche);

  const rate = kopf.querySelector('.zlrate') as HTMLElement;

  /* --- Zeichnen ---------------------------------------------------- */

  const zeichne = (): void => {
    flaeche.dataset.lage = lage;
    leiste.replaceChildren();
    const faktor = gemessen ? gemessen / zeigerateFuer(gemessen) : 0;
    rate.textContent = gemessen
      ? `${Math.round(gemessen)} B/s · ${faktor.toFixed(1)}-fache Zeitlupe`
      : '';
    /* Unter dem Doppelten sieht ein Gast keine Zeitlupe, sondern ein
       zähes Video. Das darf nicht erst im fertigen Clip auffallen. */
    rate.classList.toggle('zlrate--schwach', gemessen > 0 && faktor < 1.8);

    if (!stand.an) {
      sagt.textContent = 'Die Zeitlupe ist für diese Feier nicht eingeschaltet.';
      return;
    }

    if (lage === 'start') {
      sagt.textContent =
        'Zeitlupe braucht Licht — Dauerlicht, keinen Blitz. Zwei Meter Anlauf reichen.';
      leiste.append(knopf('Kamera einschalten', 'amber', () => void anschalten()));
      return;
    }

    if (lage === 'laeuft') {
      /* Die Dauer steht IMMER da — sie ist das, was der Gast vor dem Auslösen
         wissen muss. Der Hinweis auf die schwache Kamera kommt dazu, nicht
         an ihrer Stelle. */
      sagt.textContent =
        `Bereit. ${stand.sekunden} Sekunden werden aufgenommen.` +
        (faktor > 0 && faktor < 1.8
          ? ` Die Kamera liefert nur ${Math.round(gemessen)} Bilder je Sekunde — ` +
            'mehr Licht bringt mehr Bilder, eine Action-Cam deutlich mehr.'
          : '');
      leiste.append(
        knopf('Aufnehmen', 'amber', () => void nimmAuf()),
        knopf('Kamera aus', 'still', () => {
          stoppeKamera();
          lage = 'start';
          zeichne();
        })
      );
      return;
    }

    if (lage === 'nimmt') {
      sagt.textContent = 'Läuft — jetzt!';
      return;
    }

    if (lage === 'rechnet') {
      sagt.textContent = 'Dein Clip läuft gerade durch. Was du siehst, wird aufgezeichnet.';
      return;
    }

    if (lage === 'fertig') {
      sagt.textContent = grund || 'Fertig. Behalten oder noch einmal?';
      leiste.append(
        knopf('Noch einmal', 'still', () => {
          ergebnis = null;
          abspieler.removeAttribute('src');
          void anschalten();
        }),
        knopf('Behalten', 'amber', () => void sende())
      );
      return;
    }

    sagt.textContent = grund;
    leiste.append(knopf('Noch einmal versuchen', 'amber', () => void anschalten()));
  };

  /* --- Kamera ------------------------------------------------------ */

  const anschalten = async (): Promise<void> => {
    stoppeKamera();
    try {
      /* Das Höchste verlangen, mit dem Vermerk „ideal": Eine Kamera, die
         nur dreißig kann, liefert dann dreißig, statt die Anfrage rundweg
         abzulehnen. `exact` wäre hier der Fehler, den man erst im Saal
         bemerkt. */
      strom = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 240 } },
        audio: false,
      });
    } catch (fehler) {
      grund = deuteFehler(fehler);
      lage = 'fehler';
      zeichne();
      return;
    }

    video.srcObject = strom;
    await video.play();
    if (video.videoWidth === 0) {
      await new Promise<void>((f) =>
        video.addEventListener('loadedmetadata', () => f(), { once: true })
      );
    }

    /* Was die Kamera MELDET, ist nicht immer, was sie liefert. Gemessen wird
       deshalb später an den tatsächlich eingegangenen Bildern; bis dahin
       gilt die Angabe als Anhaltspunkt. */
    gemessen = strom.getVideoTracks()[0]?.getSettings().frameRate ?? 0;
    lage = 'laeuft';
    zeichne();
  };

  const stoppeKamera = (): void => {
    strom?.getTracks().forEach((spur) => spur.stop());
    strom = null;
  };

  /* --- Sammeln ----------------------------------------------------- */

  const nimmAuf = async (): Promise<void> => {
    lage = 'nimmt';
    zeichne();

    const bilder: Blob[] = [];
    const hilf = document.createElement('canvas');
    /* 960 Punkte Breite: Auf einer Leinwand noch gut, und schmal genug, dass
       das Ablegen jedes einzelnen Bildes mit der Kamera Schritt hält. */
    const breite = Math.min(960, video.videoWidth || 960);
    hilf.width = breite;
    hilf.height = Math.round((breite / (video.videoWidth || 16)) * (video.videoHeight || 9));
    const hstift = hilf.getContext('2d');
    if (!hstift) {
      grund = 'Zeichenfläche nicht verfügbar.';
      lage = 'fehler';
      zeichne();
      return;
    }

    const beginn = performance.now();
    const bis = beginn + stand.sekunden * 1000;

    await new Promise<void>((fertig) => {
      const naechstes = () => {
        if (performance.now() >= bis) return fertig();
        hstift.drawImage(video, 0, 0, hilf.width, hilf.height);
        hilf.toBlob(
          (b) => {
            if (b) bilder.push(b);
          },
          'image/jpeg',
          0.82
        );
        zaehler.textContent = `${bilder.length}`;
        /* `requestVideoFrameCallback` liefert JEDES Kamerabild, auch wenn der
           Bildschirm nur sechzig Mal je Sekunde neu zeichnet — genau darauf
           beruht die Zeitlupe. Wo es fehlt (ältere Browser), bleibt der Weg
           über die Bildwiederholrate, dann eben ohne den Gewinn. */
        if ('requestVideoFrameCallback' in video) {
          (video as HTMLVideoElement & {
            requestVideoFrameCallback: (r: () => void) => void;
          }).requestVideoFrameCallback(naechstes);
        } else {
          requestAnimationFrame(naechstes);
        }
      };
      naechstes();
    });

    // Kurz warten, bis das letzte `toBlob` fertig ist.
    await warte(120);
    zaehler.textContent = '';

    const dauer = (performance.now() - beginn) / 1000;
    gemessen = bilder.length / dauer;
    stoppeKamera();

    if (bilder.length < RATE_MIN) {
      grund =
        'Die Kamera hat zu wenige Bilder geliefert. Mehr Licht hilft — bei wenig Licht ' +
        'belichtet eine Kamera länger und liefert weniger Bilder je Sekunde.';
      lage = 'fehler';
      zeichne();
      return;
    }

    await spieleAus(bilder);
  };

  /* --- Ausspielen -------------------------------------------------- */

  const spieleAus = async (bilder: Blob[]): Promise<void> => {
    lage = 'rechnet';
    zeichne();

    const stift = tafel.getContext('2d');
    const art = besteAufzeichnung();
    if (!stift || !art) {
      grund = 'Dieses Gerät kann keinen Clip anlegen.';
      lage = 'fehler';
      zeichne();
      return;
    }

    /* Erst hier steht die Ausspielrate fest: Sie folgt aus dem, was die
       Kamera tatsächlich geliefert hat, nicht aus dem, was sie versprochen
       hat. */
    const zeigerate = zeigerateFuer(gemessen);
    const strichstrom = tafel.captureStream(zeigerate);
    const stuecke: Blob[] = [];
    const rekorder = new MediaRecorder(strichstrom, { mimeType: art });
    rekorder.addEventListener('dataavailable', (e) => {
      if (e.data.size > 0) stuecke.push(e.data);
    });
    const geschrieben = new Promise<void>((f) =>
      rekorder.addEventListener('stop', () => f(), { once: true })
    );
    rekorder.start();

    const vorspann = Math.round(zeigerate * 0.8);
    const abspann = Math.round(zeigerate * 1.2);

    for (let i = 0; i < vorspann; i++) {
      zeichneTafel(stift, tafel, null, stand, marke, i / vorspann, 'vor');
      await warte(1000 / zeigerate);
    }

    for (let i = 0; i < bilder.length; i++) {
      const bild = await ladeBlob(bilder[i]!);
      zeichneTafel(stift, tafel, bild, stand, marke, i / bilder.length, 'clip');
      bild.close();
      await warte(1000 / zeigerate);
    }

    for (let i = 0; i < abspann; i++) {
      zeichneTafel(stift, tafel, null, stand, marke, i / abspann, 'nach');
      await warte(1000 / zeigerate);
    }

    rekorder.stop();
    await geschrieben;

    ergebnis = new Blob(stuecke, { type: art });
    abspieler.src = URL.createObjectURL(ergebnis);
    void abspieler.play().catch(() => undefined);
    grund = '';
    lage = 'fertig';
    zeichne();
  };

  const sende = async (): Promise<void> => {
    if (!ergebnis) return;
    const alt = leiste.textContent;
    sagt.textContent = 'Wird gesichert …';
    try {
      const antwort = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: await alsDatenadresse(ergebnis),
          source: 'booth',
          mode: 'zeitlupe',
        }),
      });
      if (!antwort.ok) throw new Error(String(antwort.status));
      grund = 'Gesichert. Der Clip liegt in der Galerie.';
    } catch {
      // Den Clip NICHT verwerfen — er ist nicht wiederholbar.
      grund = 'Das kam nicht an. Noch einmal auf „Behalten".';
    }
    void alt;
    lage = 'fertig';
    zeichne();
  };

  window.addEventListener('pagehide', stoppeKamera);
  zeichne();
}

/* ------------------------------------------------------------------ */
/* Der Rahmen                                                          */
/* ------------------------------------------------------------------ */

/**
 * Zeichnet ein Bild des Clips: das Kamerabild, darüber Rahmen, Eventname
 * und — wenn hinterlegt — das Zeichen des Betreibers.
 *
 * Vor- und Abspann sind dieselbe Zeichnung ohne Kamerabild. Das spart eine
 * zweite Gestaltung und hält Anfang, Mitte und Ende sichtbar zusammen.
 */
function zeichneTafel(
  stift: CanvasRenderingContext2D,
  tafel: HTMLCanvasElement,
  bild: ImageBitmap | null,
  stand: { event: string },
  marke: HTMLImageElement | null,
  fortschritt: number,
  teil: 'vor' | 'clip' | 'nach'
): void {
  const b = tafel.width;
  const h = tafel.height;

  stift.fillStyle = '#0b0b0d';
  stift.fillRect(0, 0, b, h);

  if (bild) {
    // Formatfüllend und mittig — schwarze Balken im Clip sehen aus wie ein Fehler.
    const faktor = Math.max(b / bild.width, h / bild.height);
    const bb = bild.width * faktor;
    const bh = bild.height * faktor;
    stift.drawImage(bild, (b - bb) / 2, (h - bh) / 2, bb, bh);
  }

  /* Vor- und Abspann blenden auf beziehungsweise ab. Ein harter Schnitt am
     Anfang wirkt wie ein abgeschnittener Clip. */
  if (teil !== 'clip') {
    const deckung = teil === 'vor' ? 1 - fortschritt : fortschritt;
    stift.fillStyle = `rgba(11, 11, 13, ${deckung.toFixed(3)})`;
    stift.fillRect(0, 0, b, h);
  }

  // Der Rahmen: zwei feine Linien, keine Zierleiste.
  stift.strokeStyle = 'rgba(242, 178, 62, 0.9)';
  stift.lineWidth = 3;
  stift.strokeRect(28, 28, b - 56, h - 56);

  stift.fillStyle = '#f2b23e';
  stift.font = '500 22px "IBM Plex Mono", ui-monospace, monospace';
  stift.textAlign = 'left';
  stift.fillText('ZEITLUPE', 56, 74);

  stift.fillStyle = 'rgba(244, 242, 238, 0.82)';
  stift.textAlign = 'right';
  stift.fillText(stand.event.toUpperCase(), b - 56, 74);

  if (marke) {
    /* Das Zeichen unten rechts, in fester Höhe. Auf die Breite skaliert
       ergäbe ein breites Logo einen Streifen quer durchs Bild. */
    const hoehe = 54;
    const breite = (marke.naturalWidth / Math.max(1, marke.naturalHeight)) * hoehe;
    stift.globalAlpha = 0.9;
    stift.drawImage(marke, b - 56 - breite, h - 56 - hoehe, breite, hoehe);
    stift.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------------ */

function besteAufzeichnung(): string | null {
  const kandidaten = [
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  if (typeof MediaRecorder === 'undefined') return null;
  return kandidaten.find((art) => MediaRecorder.isTypeSupported(art)) ?? null;
}

async function holeStand(): Promise<Stand> {
  try {
    const antwort = await fetch('/api/settings');
    if (!antwort.ok) throw new Error(String(antwort.status));
    const roh = (await antwort.json()) as {
      zeitlupe?: { enabled?: boolean; sekunden?: number };
      eventName?: string;
      betreiber?: { logo?: string | null };
    };
    return {
      an: roh.zeitlupe?.enabled ?? false,
      sekunden: roh.zeitlupe?.sekunden ?? 4,
      event: roh.eventName ?? 'youbooth',
      logo: roh.betreiber?.logo ?? null,
    };
  } catch {
    return { an: false, sekunden: 4, event: 'youbooth', logo: null };
  }
}

function ladeBlob(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}

function ladeBild(quelle: string): Promise<HTMLImageElement> {
  return new Promise((fertig, schiefgegangen) => {
    const bild = new Image();
    bild.addEventListener('load', () => fertig(bild), { once: true });
    bild.addEventListener('error', () => schiefgegangen(new Error('Bild')), { once: true });
    bild.src = quelle;
  });
}

function deuteFehler(fehler: unknown): string {
  const name = fehler instanceof Error ? fehler.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Die Kamera ist nicht freigegeben.';
  }
  if (name === 'NotFoundError') return 'Keine Kamera gefunden.';
  if (name === 'NotReadableError') return 'Die Kamera ist von einem anderen Programm belegt.';
  return 'Die Kamera meldet einen Fehler.';
}

function alsDatenadresse(blob: Blob): Promise<string> {
  return new Promise((fertig, schiefgegangen) => {
    const leser = new FileReader();
    leser.onload = () => fertig(String(leser.result));
    leser.onerror = () => schiefgegangen(new Error('Datei'));
    leser.readAsDataURL(blob);
  });
}

function knopf(text: string, art: 'amber' | 'still', tue: () => void): HTMLButtonElement {
  const k = document.createElement('button');
  k.type = 'button';
  k.className = art === 'amber' ? 'knopf knopf--amber zlknopf' : 'knopf knopf--rahmen-hell zlknopf';
  k.textContent = text;
  k.addEventListener('click', tue);
  return k;
}

function tag(name: string, klasse: string, text = ''): HTMLElement {
  const el = document.createElement(name);
  el.className = klasse;
  if (text) el.textContent = text;
  return el;
}

const warte = (ms: number) => new Promise<void>((fertig) => window.setTimeout(fertig, ms));
