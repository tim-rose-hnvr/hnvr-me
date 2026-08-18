/**
 * Das Audio-Gästebuch — Grüße, die man hört.
 *
 * Ein gesprochener Gruß ist ehrlicher als eine Karte und schneller als ein
 * Video. Was fehlt, ist ein Bild dazu: Eine reine Tondatei liegt später in
 * einer Galerie voller Fotos und niemand tippt darauf.
 *
 * Deshalb entsteht hier ein VIDEO — mit Standbild und Stimme. Und zwar
 * live, während gesprochen wird: Eine Zeichenfläche und das Mikrofon gehen
 * gemeinsam in die Aufzeichnung. Die naheliegende Alternative — erst Ton
 * aufnehmen, dann Bild und Ton zusammenrechnen — dauert im Browser genau
 * so lange wie die Aufnahme selbst. Eine halbe Minute Warten nach einer
 * halben Minute Sprechen ist die Art von Wartezeit, nach der ein Gast
 * weggeht.
 *
 * Der Nebeneffekt ist der schönere Teil: Die Welle im Bild ist die echte
 * Welle dieser Stimme, nicht eine gezeichnete danach.
 *
 * Das Ergebnis ist eine Aufnahme wie jede andere. Galerie, Foto-Wall,
 * QR-Code und Löschfrist behandeln sie, ohne davon zu wissen.
 */

import './stil.css';
import './stimme.css';

type Lage = 'start' | 'nimmt' | 'hoert' | 'sendet' | 'fertig' | 'fehler';

/** Das gewählte Mikrofon bleibt am Gerät — es gehört zum Aufstellort. */
const MIKROFON = 'youbooth.stimme.mikrofon';

function leseMikrofon(): string {
  try {
    return localStorage.getItem(MIKROFON) || '';
  } catch {
    return '';
  }
}

/** Was die Box über das Modul sagt. */
type Stand = { an: boolean; sekunden: number; event: string };

const wurzel = document.getElementById('stimme');
if (wurzel) void starte(wurzel);

async function starte(ziel: HTMLElement): Promise<void> {
  const stand = await holeStand();

  let lage: Lage = 'start';
  let grund = '';
  let name = '';
  let aufnahme: Blob | null = null;

  /* Welches Mikrofon. Ein Gästebuch steht oft neben einem Handmikro auf
     einem Stativ, und das ist ein anderes Gerät als das eingebaute. Die Wahl
     bleibt auf dem Gerät — sie gehört zum Aufstellort, nicht zum Event. */
  let mikrofon = leseMikrofon();
  let mikrofone: MediaDeviceInfo[] = [];

  let strom: MediaStream | null = null;
  let rekorder: MediaRecorder | null = null;
  let hoerwerk: AudioContext | null = null;
  let bildlauf = 0;
  let uhr: number | null = null;

  const flaeche = tag('div', 'stflaeche');
  const buehne = tag('div', 'stbuehne');

  /* Die Zeichenfläche ist das Bild des späteren Videos. Sie steht in 16:9
     und in einer Größe, die auch auf einem Fernseher noch scharf ist —
     nicht in der Größe, in der sie hier gerade angezeigt wird. */
  const tafel = document.createElement('canvas');
  tafel.className = 'sttafel';
  tafel.width = 1280;
  tafel.height = 720;

  const abspieler = document.createElement('video');
  abspieler.className = 'stabspieler';
  abspieler.controls = true;
  abspieler.playsInline = true;

  buehne.append(tafel, abspieler);

  const sagt = tag('p', 'stsagt');
  sagt.setAttribute('role', 'status');
  const leiste = tag('div', 'stleiste');

  flaeche.append(buehne, sagt, leiste);
  ziel.replaceChildren(flaeche);

  /* --- Zeichnen der Oberfläche ------------------------------------ */

  const zeichne = (): void => {
    flaeche.dataset.lage = lage;
    leiste.replaceChildren();

    if (!stand.an) {
      sagt.textContent = 'Das Audio-Gästebuch ist für diese Feier nicht eingeschaltet.';
      return;
    }

    if (lage === 'start') {
      sagt.textContent =
        `Sprich deinen Gruß — bis zu ${stand.sekunden} Sekunden. ` +
        'Du hörst ihn danach an und entscheidest selbst, ob er bleibt.';
      leiste.append(namensfeld());
      const wahl = mikrofonfeld();
      if (wahl) leiste.append(wahl);
      leiste.append(knopf('Aufnahme starten', 'amber', () => void nimmAuf()));
      return;
    }

    if (lage === 'nimmt') {
      sagt.textContent = 'Es läuft. Tippen beendet die Aufnahme.';
      leiste.append(knopf('Fertig', 'amber', () => stoppe()));
      return;
    }

    if (lage === 'hoert') {
      sagt.textContent = grund || 'Angehört? Dann abschicken — oder noch einmal sprechen.';
      leiste.append(
        knopf('Noch einmal', 'still', () => {
          aufnahme = null;
          abspieler.removeAttribute('src');
          lage = 'start';
          zeichne();
        }),
        knopf('Abschicken', 'amber', () => void sende())
      );
      return;
    }

    if (lage === 'sendet') {
      sagt.textContent = 'Wird gesendet …';
      return;
    }

    if (lage === 'fertig') {
      sagt.textContent = 'Angekommen. Dein Gruß liegt in der Galerie.';
      leiste.append(
        knopf('Noch einen Gruß', 'amber', () => {
          aufnahme = null;
          abspieler.removeAttribute('src');
          lage = 'start';
          zeichne();
        }),
        verweis('Zur Galerie', './galerie.html')
      );
      return;
    }

    sagt.textContent = grund;
    leiste.append(knopf('Noch einmal versuchen', 'amber', () => void nimmAuf()));
  };

  const namensfeld = (): HTMLElement => {
    const zeile = tag('label', 'stname');
    const marke = tag('span', 'stmono', 'Dein Name');
    const eingabe = document.createElement('input');
    eingabe.className = 'eingabe steingabe';
    eingabe.value = name;
    eingabe.maxLength = 40;
    eingabe.placeholder = 'ohne geht auch';
    eingabe.autocomplete = 'name';
    eingabe.addEventListener('input', () => (name = eingabe.value));
    zeile.append(marke, eingabe);
    return zeile;
  };

  /**
   * Die Mikrofonwahl — nur, wenn es überhaupt etwas zu wählen gibt.
   *
   * Die Namen der Geräte gibt der Browser erst preis, NACHDEM einmal
   * Aufnahmeerlaubnis erteilt wurde. Vorher hieße jeder Eintrag „Mikrofon"
   * und die Liste wäre eine Ratestunde — deshalb erscheint sie beim ersten
   * Aufruf gar nicht und ab der zweiten Aufnahme mit echten Namen.
   */
  const mikrofonfeld = (): HTMLElement | null => {
    if (mikrofone.length < 2) return null;

    const zeile = tag('label', 'stname');
    const feld = document.createElement('select');
    feld.className = 'eingabe steingabe';
    mikrofone.forEach((geraet, nummer) => {
      const glied = document.createElement('option');
      glied.value = geraet.deviceId;
      glied.textContent = geraet.label || `Mikrofon ${nummer + 1}`;
      glied.selected = geraet.deviceId === mikrofon;
      feld.append(glied);
    });
    feld.addEventListener('change', () => {
      mikrofon = feld.value;
      try {
        localStorage.setItem(MIKROFON, mikrofon);
      } catch {
        /* Ohne Speicher gilt die Wahl für diesen Aufruf. */
      }
    });
    zeile.append(tag('span', 'stmono', 'Mikrofon'), feld);
    return zeile;
  };

  const merkeMikrofone = async (): Promise<void> => {
    try {
      const geraete = await navigator.mediaDevices.enumerateDevices();
      mikrofone = geraete.filter((g) => g.kind === 'audioinput' && g.label);
    } catch {
      mikrofone = [];
    }
  };

  /* --- Aufnehmen --------------------------------------------------- */

  const nimmAuf = async (): Promise<void> => {
    grund = '';
    try {
      /* Die drei Schalter sind der Unterschied zwischen „Gruß" und
         „Gemurmel im Saal": Ein Gästebuch steht dort, wo Musik läuft. */
      strom = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
          ...(mikrofon ? { deviceId: { exact: mikrofon } } : {}),
        },
        video: false,
      });
      // Jetzt tragen die Geräte Namen — vorher gibt der Browser keine preis.
      void merkeMikrofone();
    } catch (fehler) {
      /* Ein gemerktes Mikrofon, das nicht mehr steckt, lässt `exact`
         scheitern. Dann ohne Wunsch noch einmal — ein Gast soll nicht vor
         einer Fehlermeldung stehen, weil gestern ein anderes Kabel dran war. */
      if (mikrofon) {
        mikrofon = '';
        try {
          localStorage.removeItem(MIKROFON);
        } catch {
          /* dann eben nicht */
        }
        return void nimmAuf();
      }
      grund = deuteTonfehler(fehler);
      lage = 'fehler';
      zeichne();
      return;
    }

    hoerwerk = new AudioContext();
    const messer = hoerwerk.createAnalyser();
    messer.fftSize = 1024;
    hoerwerk.createMediaStreamSource(strom).connect(messer);
    const werte = new Uint8Array(messer.frequencyBinCount);

    const beginn = Date.now();
    const male = () => {
      messer.getByteTimeDomainData(werte);
      zeichneTafel(tafel, werte, name, stand, (Date.now() - beginn) / 1000);
      bildlauf = requestAnimationFrame(male);
    };
    male();

    /* Bild und Ton gehen GEMEINSAM in die Aufzeichnung. Deshalb sind es
       zwei Spuren in einem Strom, nicht zwei Dateien. */
    const bildstrom = tafel.captureStream(30);
    const zusammen = new MediaStream([
      ...bildstrom.getVideoTracks(),
      ...strom.getAudioTracks(),
    ]);

    const art = besteAufzeichnung();
    if (!art) {
      grund = 'Dieses Gerät kann keine Aufnahme anlegen. Bitte ein anderes Handy versuchen.';
      lage = 'fehler';
      raeumeAuf();
      zeichne();
      return;
    }

    const stuecke: Blob[] = [];
    rekorder = new MediaRecorder(zusammen, { mimeType: art });
    rekorder.addEventListener('dataavailable', (e) => {
      if (e.data.size > 0) stuecke.push(e.data);
    });
    rekorder.addEventListener('stop', () => {
      aufnahme = new Blob(stuecke, { type: art });
      abspieler.src = URL.createObjectURL(aufnahme);
      raeumeAuf();
      lage = 'hoert';
      zeichne();
    });
    rekorder.start();

    lage = 'nimmt';
    zeichne();

    /* Die Höchstlänge ist keine Schikane: Ein Zusammenschnitt aus achtzig
       Grüßen à zwei Minuten hört sich niemand an. Gestoppt wird von selbst,
       damit ein Gast, der die Seite weglegt, nicht die ganze Feier aufnimmt. */
    uhr = window.setTimeout(() => stoppe(), stand.sekunden * 1000);
  };

  const stoppe = (): void => {
    if (uhr !== null) window.clearTimeout(uhr);
    uhr = null;
    if (rekorder && rekorder.state !== 'inactive') rekorder.stop();
  };

  const raeumeAuf = (): void => {
    cancelAnimationFrame(bildlauf);
    strom?.getTracks().forEach((spur) => spur.stop());
    strom = null;
    void hoerwerk?.close().catch(() => undefined);
    hoerwerk = null;
    rekorder = null;
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
          image: await alsDatenadresse(aufnahme),
          source: 'guest',
          mode: 'stimme',
        }),
      });
      if (!antwort.ok) throw new Error(String(antwort.status));
      lage = 'fertig';
    } catch {
      /* Die Aufnahme NICHT verwerfen. Wer gerade dreißig Sekunden gesprochen
         hat, spricht sie nicht noch einmal, weil das WLAN gehustet hat. */
      grund = 'Das kam nicht an. Noch einmal abschicken?';
      lage = 'hoert';
    }
    zeichne();
  };

  window.addEventListener('pagehide', () => {
    stoppe();
    raeumeAuf();
  });

  // Ein erstes Standbild, damit die Fläche nicht leer dasteht.
  zeichneTafel(tafel, null, name, stand, 0);
  zeichne();
}

/* ------------------------------------------------------------------ */
/* Das Standbild                                                       */
/* ------------------------------------------------------------------ */

/**
 * Zeichnet das Bild des Videos: Eventname, Gastname, Uhrzeit — und die
 * Welle der Stimme, die gerade spricht.
 *
 * Die Welle ist keine Zierde. Sie ist die Pegelanzeige während der Aufnahme
 * („kommt meine Stimme an?") und zugleich das, was das fertige Video
 * ansehnlich macht. Zwei Aufgaben, eine Zeichnung.
 */
function zeichneTafel(
  tafel: HTMLCanvasElement,
  werte: Uint8Array | null,
  name: string,
  stand: { event: string },
  sekunden: number
): void {
  const stift = tafel.getContext('2d');
  if (!stift) return;
  const b = tafel.width;
  const h = tafel.height;

  stift.fillStyle = '#0b0b0d';
  stift.fillRect(0, 0, b, h);

  const schein = stift.createRadialGradient(b / 2, h * 0.52, 0, b / 2, h * 0.52, b * 0.6);
  schein.addColorStop(0, 'rgba(242, 178, 62, 0.16)');
  schein.addColorStop(1, 'rgba(242, 178, 62, 0)');
  stift.fillStyle = schein;
  stift.fillRect(0, 0, b, h);

  // Kopfzeile: wo und für wen.
  stift.fillStyle = '#f2b23e';
  stift.font = '500 22px "IBM Plex Mono", ui-monospace, monospace';
  stift.textAlign = 'left';
  stift.fillText('GESPROCHENER GRUSS', 64, 76);

  stift.fillStyle = 'rgba(244, 242, 238, 0.62)';
  stift.font = '500 22px "IBM Plex Mono", ui-monospace, monospace';
  stift.textAlign = 'right';
  stift.fillText(stand.event.toUpperCase(), b - 64, 76);

  // Die Welle in der Mitte.
  const mitte = h * 0.52;
  const hoehe = h * 0.2;
  stift.strokeStyle = '#f4f2ee';
  stift.lineWidth = 4;
  stift.lineJoin = 'round';
  stift.beginPath();

  if (werte && werte.length > 0) {
    for (let i = 0; i < werte.length; i++) {
      const x = 64 + (i / (werte.length - 1)) * (b - 128);
      // 128 ist die Ruhelage der Zeitbereichsdaten, nicht null.
      const y = mitte + ((werte[i]! - 128) / 128) * hoehe;
      if (i === 0) stift.moveTo(x, y);
      else stift.lineTo(x, y);
    }
  } else {
    stift.moveTo(64, mitte);
    stift.lineTo(b - 64, mitte);
  }
  stift.stroke();

  // Fuß: Name, Datum, Länge.
  const jetzt = new Date();
  const zwei = (n: number) => String(n).padStart(2, '0');
  stift.textAlign = 'left';
  stift.fillStyle = '#f4f2ee';
  stift.font = '800 46px Archivo, system-ui, sans-serif';
  stift.fillText(name.trim() || 'Ein Gast', 64, h - 96);

  stift.fillStyle = 'rgba(244, 242, 238, 0.62)';
  stift.font = '500 22px "IBM Plex Mono", ui-monospace, monospace';
  stift.fillText(
    `${zwei(jetzt.getDate())}.${zwei(jetzt.getMonth() + 1)}.${jetzt.getFullYear()}  ` +
      `${zwei(jetzt.getHours())}:${zwei(jetzt.getMinutes())}`,
    64,
    h - 56
  );

  stift.textAlign = 'right';
  stift.fillStyle = '#f2b23e';
  stift.font = '500 34px "IBM Plex Mono", ui-monospace, monospace';
  stift.fillText(`${zwei(Math.floor(sekunden / 60))}:${zwei(Math.floor(sekunden % 60))}`, b - 64, h - 60);
}

/* ------------------------------------------------------------------ */

/**
 * Das Aufzeichnungsformat, das dieses Gerät kann.
 *
 * Chrome und Firefox liefern WebM, Safari auf dem iPhone MP4. Beides ist
 * recht — falsch wäre nur, eines davon zu verlangen und auf der Hälfte der
 * Geräte gar nichts aufzunehmen.
 */
function besteAufzeichnung(): string | null {
  const kandidaten = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
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
      stimme?: { enabled?: boolean; sekunden?: number };
      eventName?: string;
    };
    return {
      an: roh.stimme?.enabled ?? false,
      sekunden: roh.stimme?.sekunden ?? 30,
      event: roh.eventName ?? 'youbooth',
    };
  } catch {
    // Ohne Box keine Aufnahme — sie hätte auch nirgends hingehen können.
    return { an: false, sekunden: 30, event: 'youbooth' };
  }
}

function deuteTonfehler(fehler: unknown): string {
  const name = fehler instanceof Error ? fehler.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Das Mikrofon ist nicht freigegeben. In den Einstellungen des Browsers erlauben.';
  }
  if (name === 'NotFoundError') {
    return 'Kein Mikrofon gefunden.';
  }
  if (name === 'NotReadableError') {
    return 'Das Mikrofon ist von einer anderen App belegt.';
  }
  return 'Das Mikrofon meldet einen Fehler.';
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
  k.className = art === 'amber' ? 'knopf knopf--amber stknopf' : 'knopf knopf--rahmen-hell stknopf';
  k.textContent = text;
  k.addEventListener('click', tue);
  return k;
}

function verweis(text: string, ziel: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = 'knopf knopf--rahmen-hell stknopf';
  a.href = ziel;
  a.textContent = text;
  return a;
}

function tag(name: string, klasse: string, text = ''): HTMLElement {
  const el = document.createElement(name);
  el.className = klasse;
  if (text) el.textContent = text;
  return el;
}
